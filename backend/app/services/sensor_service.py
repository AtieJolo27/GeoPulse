from app.database.supabase import supabase
from app.services.sensor_assignment import prepare_sensor_reading
import os


def save_sensor_data(sensor_data):
    farm_id = int(os.environ['DEFAULT_FARM_ID'])
    sensor_data = prepare_sensor_reading(supabase, farm_id, sensor_data)
    try:
        response = (
            supabase
            .table("sensor_readings")
            .insert(sensor_data)
            .execute()
        )

        print("Supabase INSERT OK")
        return response

    except Exception as e:
        print("Supabase ERROR:", e)
        raise
