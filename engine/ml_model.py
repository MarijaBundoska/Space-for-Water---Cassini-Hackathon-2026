import pickle
import numpy as np
import os

# Try to load the ML models
model = None
drought_model = None
try:
    import xgboost  # Required for the model
    model_path = os.path.join(os.path.dirname(__file__), 'models', 'flood_model.pkl')
    model = pickle.load(open(model_path, 'rb'))
    print("Flood ML model loaded successfully")
except ImportError:
    print("XGBoost not available - using fallback predictions")
except Exception as e:
    print(f"Error loading flood ML model: {e} - using fallback predictions")

# Load drought model
try:
    drought_model_path = os.path.join(os.path.dirname(__file__), 'models', 'drought_model.pkl')
    drought_model = pickle.load(open(drought_model_path, 'rb'))
    print("Drought ML model loaded successfully")
except Exception as e:
    print(f"Error loading drought ML model: {e} - using fallback predictions")

def predict_flood_probability(lat, lon, precipitation, probability, humidity=None, temperature=None):
    """
    Predict flood probability using ML model or fallback calculation

    Args:
        lat, lon: Location coordinates
        precipitation: rainfall amount (mm)
        probability: weather probability (%)
        humidity, temperature: Optional features

    Returns:
        flood_probability (0-100%)
    """
    if model is not None:
        # Use ML model prediction - pad features to match model expectations (12 features)
        features = np.array([[
            lat,           # 0: latitude
            lon,           # 1: longitude
            precipitation, # 2: precipitation
            probability,   # 3: probability
            humidity or 0, # 4: humidity
            temperature or 0, # 5: temperature
            0, 0, 0, 0, 0, 0  # Pad with zeros to reach 12 features
        ]])

        prediction = model.predict(features)[0]

        # Convert to percentage (0-100)
        base_risk = float(prediction) * 100 if prediction <= 1 else float(prediction)

        # Add geographical variation for Macedonia
        # Northern mountains (higher risk), Central valleys (medium risk), Southern plains (lower risk)
        geo_factor = 0
        if lat > 42.0:  # Northern region
            geo_factor = 15  # Higher risk in mountains
        elif lat < 41.0:  # Southern region
            geo_factor = -10  # Lower risk in plains
        # Central region stays neutral

        # Lakes and rivers 
        if (41.0 <= lat <= 41.2) and (20.7 <= lon <= 21.0):  # Ohrid lake area
            geo_factor += 10
        if (41.5 <= lat <= 42.0) and (21.0 <= lon <= 21.8):  # Vardar river valley
            geo_factor += 8

        final_risk = base_risk + geo_factor
        return min(max(round(final_risk, 1), 0.0), 100.0)  # Clamp between 0% and 100%
    else:
        # Fallback calculation based on weather data
        threshold = 50.0
        risk = ((precipitation / threshold) * 70) + (probability * 0.3)
        return min(round(risk, 1), 100.0)

def predict_drought_probability(lat, lon, precipitation, probability, humidity=None, temperature=None):
    """
    Predict drought probability using ML model or fallback calculation

    Args:
        lat, lon: Location coordinates
        precipitation: rainfall amount (mm)
        probability: weather probability (%)
        humidity, temperature: Optional features

    Returns:
        drought_probability (0-100%)
    """
    if drought_model is not None:
        # Use ML model prediction - pad features to match model expectations (21 features)
        features = np.array([[
            lat,           # 0: latitude
            lon,           # 1: longitude
            precipitation, # 2: precipitation
            probability,   # 3: probability
            humidity or 0, # 4: humidity
            temperature or 0, # 5: temperature
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0  # Pad with zeros to reach 21 features
        ]])

        prediction = drought_model.predict(features)[0]

        # Convert to percentage (0-100)
        base_risk = float(prediction) * 100 if prediction <= 1 else float(prediction)

        # Drought inversely related to precipitation (less rain = more drought)
        # Add geographical variation for Macedonia
        geo_factor = 0
        
        # Southern and southeastern regions are more drought-prone
        if lat < 41.1:  # Southern region
            geo_factor = 8  # Higher drought risk in south
        elif lat > 42.0:  # Northern mountains
            geo_factor = -5  # Lower drought risk (more rainfall)
        
        # Eastern regions (further from Adriatic) have higher drought risk
        if lon > 21.8:  # Eastern region
            geo_factor += 5

        final_risk = base_risk + geo_factor
        return min(max(round(final_risk, 1), 0.0), 100.0)  # Clamp between 0% and 100%
    else:
        # Fallback calculation: inverse of precipitation
        # Higher drought risk when precipitation is low
        drought_risk = 100 - ((precipitation / 50.0) * 70) - (probability * 0.3)
        return min(max(round(drought_risk, 1), 0.0), 100.0)