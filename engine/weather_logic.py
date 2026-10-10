import requests

def get_flood_risk_data(lat, lon):
    
    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&daily=precipitation_sum,precipitation_probability_max&timezone=auto"
    
    try:
        response = requests.get(url).json()
        rain_sum = response['daily']['precipitation_sum'][0]
        prob = response['daily']['precipitation_probability_max'][0]
        
        # Risk Math
        threshold = 50.0
        risk = ((rain_sum / threshold) * 70) + (prob * 0.3)
        
        return {
            "rain": rain_sum,
            "risk": min(round(risk, 1), 100)
        }
    except Exception as e:
        print(f"Logic Error: {e}")
        return None