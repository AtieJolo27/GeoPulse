import joblib
import numpy as np

MODEL_PATH = "app/machine_learning/models/crop_model.pkl"


def load_model():
    return joblib.load(MODEL_PATH)


def predict_crop(sensor_data):
    model = load_model()

    features = np.array([[
        sensor_data["soil_moisture"],
        sensor_data["soil_temperature"],
        sensor_data["air_temperature"],
        sensor_data["humidity"],
        sensor_data["ph"],
        sensor_data["nitrogen"],
        sensor_data["phosphorus"],
        sensor_data["potassium"]
]])

    probabilities = model.predict_proba(features)[0]
    classes = model.classes_

    recommendations = []

    for crop, probability in zip(classes, probabilities):
        recommendations.append({
            "crop": crop,
            "confidence": round(probability * 100, 2)
        })

    recommendations.sort(
        key=lambda x: x["confidence"],
        reverse=True
    )

    return {
    "best_crop": recommendations[0]["crop"],
    "best_confidence": recommendations[0]["confidence"],
    "recommendations": recommendations[:5]
}