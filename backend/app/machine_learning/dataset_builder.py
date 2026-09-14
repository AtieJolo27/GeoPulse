from app.database.connection import get_connection


def fetch_all_sensor_data():
    connection = get_connection()
    cursor = connection.cursor(dictionary=True)

    cursor.execute("SELECT * FROM sensor_readings")
    rows = cursor.fetchall()

    cursor.close()
    connection.close()

    return rows