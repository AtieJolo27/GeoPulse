import random


def generate_sensor_data():
    return {
        "soil_moisture": round(random.uniform(20, 80), 2),
        "soil_temperature": round(random.uniform(20, 35), 2),
        "ph": round(random.uniform(5.0, 7.5), 2),
        "nitrogen": random.randint(20, 120),
        "phosphorus": random.randint(10, 80),
        "potassium": random.randint(20, 100)
    }