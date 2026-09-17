import os

from fastapi import FastAPI, HTTPException
from app.services.sensor_service import save_sensor_data
from app.utils.sensor_generator import generate_sensor_data
from app.database.supabase import supabase
from app.machine_learning.predict import predict_crop
from app.services.prediction_service import save_prediction
from pydantic import BaseModel
from app.services.history_service import get_prediction_history
from fastapi.middleware.cors import CORSMiddleware
from app.machine_learning.predict_fertilizer import predict_fertilizer
from app.services.fertilizer_service import save_fertilizer_prediction

app = FastAPI()

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
