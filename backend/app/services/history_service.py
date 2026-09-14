from app.database.supabase import supabase


def get_prediction_history():

    response = (
        supabase
        .table("crop_predictions")
        .select("*")
        .order("created_at", desc=True)
        .execute()
    )

    return response.data