from app.database.supabase import supabase


def save_fertilizer_prediction(crop_prediction, fertilizer_prediction):

    data = {

        "best_crop": crop_prediction["best_crop"],

        "best_fertilizer": fertilizer_prediction["best_fertilizer"],

        "recommendations": fertilizer_prediction["recommendations"]

    }

    response = (
        supabase
        .table("fertilizer_predictions")
        .insert(data)
        .execute()
    )

    return response