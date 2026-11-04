import os
import logging

from fastapi import FastAPI, HTTPException, Query, Response, Request
from fastapi.exceptions import RequestValidationError
from fastapi.exception_handlers import request_validation_exception_handler
from app.services.realtime_sensor import latest_sensor_reading
from app.services.gemini_proxy import router as gemini_router
from app.services.sensor_service import save_sensor_data
from app.utils.sensor_generator import generate_sensor_data
from app.database.supabase import supabase
from app.machine_learning.predict import predict_crop
from app.services.prediction_service import save_prediction
from pydantic import BaseModel, ConfigDict, Field, model_validator
from app.services.history_service import get_prediction_history
from fastapi.middleware.cors import CORSMiddleware
from app.machine_learning.predict_fertilizer import predict_fertilizer
from app.services.fertilizer_service import save_fertilizer_prediction
from app.services.zone_recommendations import recommend_for_zone
from app.services.sensor_assignment import get_sensor_zone, assign_sensor_zone

app = FastAPI()
app.include_router(gemini_router)


@app.exception_handler(RequestValidationError)
async def log_request_validation_error(request: Request, exc: RequestValidationError):
    if request.url.path == '/sensor/realtime':
        failures = [
            {'field': '.'.join(str(part) for part in error['loc']),
             'type': error['type'], 'message': error['msg']}
            for error in exc.errors()
        ]
        logging.getLogger('uvicorn.error').warning(
            'Sensor payload rejected: content_type=%s errors=%s',
            request.headers.get('content-type'), failures,
        )
    return await request_validation_exception_handler(request, exc)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {"message": "Soil Health Monitoring API is running"}


class ZoneInput(BaseModel):
    name_en: str
    name_tl: str
    soil_type: str


EMPTY_BOUNDARY_GEOJSON = {"type": "FeatureCollection", "features": []}


class SensorZoneInput(BaseModel):
    zone_id: int


@app.get('/sensor-attempts')
def list_sensor_attempts(zone_id: int):
    farm_id = get_default_farm_id()
    rows = (supabase.table('sensor_attempts').select('*').eq('farm_id', farm_id)
            .eq('zone_id', zone_id).order('attempt_number', desc=True).limit(20).execute()).data
    active = (supabase.table('sensor_attempts').select('*').eq('farm_id', farm_id)
              .is_('ended_at', 'null').limit(1).execute()).data
    return {'attempts': rows, 'active': active[0] if active else None}


@app.post('/sensor-attempts/start')
def start_sensor_attempt(assignment: SensorZoneInput):
    return {'attempt': supabase.rpc('start_sensor_attempt', {
        'p_farm_id': get_default_farm_id(), 'p_zone_id': assignment.zone_id,
    }).execute().data}


@app.post('/sensor-attempts/{attempt_id}/finish')
def finish_sensor_attempt(attempt_id: int):
    return {'attempt': supabase.rpc('finish_sensor_attempt', {
        'p_farm_id': get_default_farm_id(), 'p_attempt_id': attempt_id,
    }).execute().data}


@app.get('/device/active-zone')
def get_active_sensor_zone():
    try:
        return {'zone': get_sensor_zone(supabase, get_default_farm_id())}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail='Unable to load sensor assignment') from exc


@app.post('/device/active-zone')
def set_active_sensor_zone(assignment: SensorZoneInput):
    try:
        return {'zone': assign_sensor_zone(supabase, get_default_farm_id(), assignment.zone_id)}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail='Unable to save sensor assignment') from exc


def get_default_farm_id() -> int:
    """Use the configured farm until the app supports selecting a farm."""
    farm_id = os.getenv("DEFAULT_FARM_ID")
    if not farm_id:
        raise HTTPException(status_code=500, detail="DEFAULT_FARM_ID is not configured")
    try:
        return int(farm_id)
    except ValueError as exc:
        raise HTTPException(status_code=500, detail="DEFAULT_FARM_ID must be an integer") from exc


@app.get("/zones")
def get_zones():
    """Return the persisted field zones used by the mobile app."""
    try:
        farm_id = get_default_farm_id()
        response = (
            supabase.table("zones")
            .select("*")
            .eq("farm_id", farm_id)
            .order("id")
            .execute()
        )
        return {"status": "success", "data": response.data}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Unable to load zones") from exc


@app.post("/zones", status_code=201)
def create_zone(zone: ZoneInput):
    """Persist a new field zone instead of only adding it to app state."""
    values = {
        "name_en": zone.name_en.strip(),
        "name_tl": zone.name_tl.strip(),
        "soil_type": zone.soil_type.strip(),
    }
    if not all(values.values()):
        raise HTTPException(status_code=422, detail="Zone name and soil type are required")

    try:
        values.update({
            "farm_id": get_default_farm_id(),
            # The app does not yet collect a boundary. Store valid empty GeoJSON
            # rather than inventing a location; it can be replaced later.
            "boundary_geojson": EMPTY_BOUNDARY_GEOJSON,
            "name": values["name_en"],
        })
        response = supabase.table("zones").insert(values).execute()
        if not response.data:
            raise HTTPException(status_code=500, detail="Zone was not created")
        return {"status": "success", "zone": response.data[0]}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Unable to create zone") from exc

@app.post("/sensor")
def create_sensor():
    sensor = generate_sensor_data()
    save_sensor_data(sensor)

    return {
        "message": "Sensor saved successfully",
        "data": sensor
    }

class RealtimeSensorInput(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False, extra='forbid')

    @model_validator(mode='before')
    @classmethod
    def normalize_reading(cls, value):
        if not isinstance(value, dict):
            return value
        reading = dict(value)
        if isinstance(reading.get('data'), dict):
            outer_zone = reading.get('zone_id')
            if set(reading) - {'zone_id', 'data'}:
                raise ValueError('Nested readings only accept zone_id and data at the top level')
            reading = dict(reading['data'])
            inner_zone = reading.get('zone_id')
            if outer_zone is not None and inner_zone is not None and str(outer_zone) != str(inner_zone):
                raise ValueError('Outer and nested zone_id must match')
            if outer_zone is not None:
                reading['zone_id'] = outer_zone
        # These describe an existing database row, not a new measurement.
        for field in ('id', 'created_at', 'recorded_at', 'sensor_id', 'reading_status',
                      'data_source', 'is_valid', 'validation_notes'):
            reading.pop(field, None)
        if 'temperature' in reading:
            # Compatibility with the original ESP32 payload. These fallback
            # values are shared measurements, not independent sensor readings.
            temperature = reading.pop('temperature')
            reading.setdefault('soil_temperature', temperature)
            reading.setdefault('air_temperature', temperature)
            if 'humidity' in reading:
                reading.setdefault('soil_moisture', reading['humidity'])
        return reading

    soil_moisture: float
    soil_temperature: float
    ph: float
    nitrogen: float
    phosphorus: float
    potassium: float
    # Accepted from ESP32, but the current storage contract omits conductivity.
    conductivity: float | None = None
    air_temperature: float | None = None
    humidity: float | None = None
    zone_id: int | None = Field(default=None, gt=0)


@app.post('/sensor/realtime', status_code=201)
def receive_realtime_sensor(sensor: RealtimeSensorInput):
    """Save device measurements, using the configured collection zone if omitted."""
    try:
        result = save_sensor_data(sensor.model_dump(exclude_none=True, exclude={'conductivity'}))
        if not result.data:
            raise HTTPException(status_code=500, detail='Sensor insert returned no saved reading')
        return {'message': 'Sensor saved successfully', 'data': result.data[0]}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail='Unable to save sensor reading') from exc


@app.get('/sensor/realtime')
def get_realtime_sensor(response: Response, zone_id: int | None = Query(default=None, gt=0)):
    """Return a fresh snapshot; live push updates use Supabase Realtime."""
    response.headers['Cache-Control'] = 'no-store'
    try:
        return latest_sensor_reading(supabase, get_default_farm_id(), zone_id)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail='Unable to load latest sensor reading') from exc


@app.get("/sensor")
def get_sensors():

    response = (
        supabase
        .table("sensor_readings")
        .select("*")
        .order("id", desc=True)
        .execute()
    )

    return {
        "count": len(response.data),
        "data": response.data
    }
    

class SensorInput(BaseModel):
    soil_moisture: float
    soil_temperature: float
    air_temperature: float
    humidity: float
    ph: float
    nitrogen: int
    phosphorus: int
    potassium: int


@app.post("/predict")
def predict(sensor: SensorInput):

    sensor_data = sensor.dict()

    crop_prediction = predict_crop(sensor_data)

    fertilizer_prediction = predict_fertilizer(
        sensor_data,
        crop_prediction["best_crop"]
    )

    save_prediction(
        sensor_data,
        crop_prediction
    )

    save_fertilizer_prediction(
        crop_prediction,
        fertilizer_prediction
    )

    return {
        "crop": crop_prediction,
        "fertilizer": fertilizer_prediction
    }
    
@app.get("/predictions")
def prediction_history():

    history = get_prediction_history()

    return {
        "count": len(history),
        "data": history
    }


@app.get('/zones/{zone_id}/recommendations')
def zone_recommendations(zone_id: int):
    try:
        return recommend_for_zone(supabase, zone_id, get_default_farm_id(), predict_crop, predict_fertilizer)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail='Unable to generate zone recommendations') from exc
