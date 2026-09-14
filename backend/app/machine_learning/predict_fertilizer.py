import joblib
import pandas as pd

MODEL_PATH = "app/machine_learning/models/fertilizer_model.pkl"
CROP_ENCODER_PATH = "app/machine_learning/models/crop_encoder.pkl"
FERTILIZER_ENCODER_PATH = "app/machine_learning/models/fertilizer_encoder.pkl"

model = joblib.load(MODEL_PATH)
crop_encoder = joblib.load(CROP_ENCODER_PATH)
fertilizer_encoder = joblib.load(FERTILIZER_ENCODER_PATH)


def predict_fertilizer(sensor_data, crop_name):

    crop_encoded = crop_encoder.transform([crop_name])[0]

    features = pd.DataFrame([{
        "N": sensor_data["nitrogen"],
        "P": sensor_data["phosphorus"],
        "K": sensor_data["potassium"],
        "temperature": sensor_data["soil_temperature"],
        "humidity": sensor_data["humidity"],
        "ph": sensor_data["ph"],
        "label": crop_encoded
    }])

    probabilities = model.predict_proba(features)[0]
    classes = model.classes_

    recommendations = []

    for fertilizer, probability in zip(classes, probabilities):

        recommendations.append({
            "fertilizer": fertilizer_encoder.inverse_transform([fertilizer])[0],
            "confidence": round(probability * 100, 2)
        })

    recommendations.sort(
        key=lambda x: x["confidence"],
        reverse=True
    )

    return {
        "best_fertilizer": recommendations[0]["fertilizer"],
        "recommendations": recommendations[:5]
    }