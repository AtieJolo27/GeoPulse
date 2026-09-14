from app.database.connection import get_connection
try:
    connection = get_connection()

    if connection.is_connected():
        print("✅ Connected to MySQL successfully!")

    connection.close()

except Exception as e:
    print("❌ Error:", e)