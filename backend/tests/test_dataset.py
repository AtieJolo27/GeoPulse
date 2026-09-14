from app.machine_learning.dataset_builder import fetch_all_sensor_data

data = fetch_all_sensor_data()

print("TOTAL RECORDS:", len(data))
print(data[:3])  # preview first 3 rows