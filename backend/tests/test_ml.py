from app.machine_learning.dataset_builder import fetch_all_sensor_data
from app.machine_learning.train_model import train_model

data = fetch_all_sensor_data()

print("Training model with records:", len(data))

model = train_model(data)

print("✅ Model trained successfully!")