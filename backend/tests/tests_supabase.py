from app.database.supabase import supabase

response = supabase.table("sensor_readings").select("*").limit(1).execute()

print(response)