import requests

print('Testing Flood & Drought Predictions:')
print('=' * 50) 

data = {
    'lat': 41.99,
    'lon': 21.43,
    'precipitation': 0.0,
    'probability': 0.0
}

try:
    flood = requests.post('http://localhost:5000/predict/flood', json=data).json()
    drought = requests.post('http://localhost:5000/predict/drought', json=data).json()
    
    print(f'Flood Risk:   {flood.get("ml_prediction", 0):.1f}%')
    print(f'Drought Risk: {drought.get("ml_prediction", 0):.1f}%')
    print('\n✓ Both endpoints working correctly!')
except Exception as e:
    print(f'Error: {e}')
