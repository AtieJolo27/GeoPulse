from app.utils.sensor_generator import generate_sensor_data
from app.services.sensor_service import save_sensor_data

sensor = generate_sensor_data()

print("ABOUT TO SAVE:", sensor)

save_sensor_data(sensor)

print("✅ SAVED TO MYSQL")