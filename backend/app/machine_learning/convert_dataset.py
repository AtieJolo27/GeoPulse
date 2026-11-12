import pandas as pd
import random
from pathlib import Path

DATASET_DIR = Path(__file__).resolve().parent / "datasets"

# Keep the supplied source, including its guidance and references, unchanged.
df = pd.read_csv(DATASET_DIR / "crop_recommendation_dataset_ph_full.csv")
random_generator = random.Random(42)

# Rename columns to match our system
df = df.rename(columns={
    "N": "nitrogen",
    "P": "phosphorus",
    "K": "potassium",
    "temperature": "air_temperature"
})

# ------------------------------------------------------------------
# Create simulated sensor values
# ------------------------------------------------------------------

# Rainfall (0-300 mm) -> Soil Moisture (20-95 %)
df["soil_moisture"] = (
    (df["rainfall"] / df["rainfall"].max()) * 75 + 20
).round(2)

# Soil temperature is usually slightly lower than air temperature
df["soil_temperature"] = df["air_temperature"].apply(
    lambda t: round(t - random_generator.uniform(0.5, 2.5), 2)
)

# Reorder columns
df = df[
    [
        "soil_moisture",
        "soil_temperature",
        "air_temperature",
        "humidity",
        "ph",
        "nitrogen",
        "phosphorus",
        "potassium",
        "crop"
    ]
]

# Save new dataset
output = DATASET_DIR / "soil_crop_dataset.csv"

df.to_csv(output, index=False)

print("Dataset converted successfully!")

print(df.head())
