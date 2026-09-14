import pandas as pd
import joblib

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score

# Load dataset
df = pd.read_csv(
    "app/machine_learning/datasets/crop_fertilizer_recommendation_dataset.csv"
)

print(df.head())

# Encode crop labels
crop_encoder = LabelEncoder()
df["label"] = crop_encoder.fit_transform(df["label"])

# Encode fertilizer labels
fertilizer_encoder = LabelEncoder()
df["fertilizer"] = fertilizer_encoder.fit_transform(df["fertilizer"])

# Features
X = df[
    [
        "N",
        "P",
        "K",
        "temperature",
        "humidity",
        "ph",
        "label",
    ]
]

# Target
y = df["fertilizer"]

# Split
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
)

# Train
model = RandomForestClassifier(
    n_estimators=200,
    random_state=42
)

model.fit(X_train, y_train)

# Evaluate
predictions = model.predict(X_test)

accuracy = accuracy_score(y_test, predictions)

print(f"Accuracy: {accuracy*100:.2f}%")

# Save model
joblib.dump(
    model,
    "app/machine_learning/models/fertilizer_model.pkl"
)

joblib.dump(
    crop_encoder,
    "app/machine_learning/models/crop_encoder.pkl"
)

joblib.dump(
    fertilizer_encoder,
    "app/machine_learning/models/fertilizer_encoder.pkl"
)

print("Fertilizer model saved successfully!")