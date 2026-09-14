from fastapi import FastAPI
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