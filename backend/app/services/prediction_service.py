from app.database.supabase import supabase


def save_prediction(sensor_data, prediction_result):

    data = {
        "soil_moisture": sensor_data["soil_moisture"],
        "soil_temperature": sensor_data["soil_temperature"],
        "air_temperature": sensor_data["air_temperature"],
        "humidity": sensor_data["humidity"],
        "ph": sensor_data["ph"],
        "nitrogen": sensor_data["nitrogen"],
        "phosphorus": sensor_data["phosphorus"],
        "potassium": sensor_data["potassium"],

        "best_crop": prediction_result["best_crop"],
        "recommendations": prediction_result["recommendations"]
    }

    response = (
        supabase
        .table("crop_predictions")
        .insert(data)
        .execute()
    )

    return response