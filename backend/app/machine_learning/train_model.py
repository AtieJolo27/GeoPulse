import pandas as pd
import joblib
from pathlib import Path

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

# --------------------------------------------------
# Load Dataset
# --------------------------------------------------

ML_DIR = Path(__file__).resolve().parent
df = pd.read_csv(ML_DIR / "datasets" / "soil_crop_dataset.csv")

# --------------------------------------------------
# Features and Label
# --------------------------------------------------

X = df[
    [
        "soil_moisture",
        "soil_temperature",
        "air_temperature",
        "humidity",
        "ph",
        "nitrogen",
        "phosphorus",
        "potassium"
    ]
]

y = df["crop"]

# --------------------------------------------------
# Split Dataset
# --------------------------------------------------

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y
)

# --------------------------------------------------
# Train Random Forest
# --------------------------------------------------

model = RandomForestClassifier(
    n_estimators=200,
    random_state=42
)

model.fit(X_train, y_train)

# --------------------------------------------------
# Evaluate
# --------------------------------------------------

prediction = model.predict(X_test)

accuracy = accuracy_score(y_test, prediction)

print(f"Accuracy: {accuracy * 100:.2f}%")

# --------------------------------------------------
# Save Model
# --------------------------------------------------

joblib.dump(
    model,
    ML_DIR / "models" / "crop_model.pkl"
)

print("Model saved successfully!")
