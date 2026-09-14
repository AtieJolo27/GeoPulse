from app.database.supabase import supabase


def save_sensor_data(sensor_data):
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