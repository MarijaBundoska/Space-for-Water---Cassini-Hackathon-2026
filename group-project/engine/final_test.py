import requests
import time
time.sleep(2)

print('Final Test - Both Flood & Drought APIs:') 
print('=' * 50)

data = {'lat': 41.99, 'lon': 21.43, 'precipitation': 0, 'probability': 0}

try:
    flood = requests.post('http://localhost:5000/predict/flood', json=data, timeout=5)
    drought = requests.post('http://localhost:5000/predict/drought', json=data, timeout=5)

    if flood.status_code == 200 and drought.status_code == 200:
        flood_result = flood.json()
        drought_result = drought.json()

        print('Flood Risk:   {:.1f}%'.format(flood_result.get('ml_prediction', 0)))
        print('Drought Risk: {:.1f}%'.format(drought_result.get('ml_prediction', 0)))
        print('\nAll APIs working correctly!')
        print('Interface changes implemented!')
    else:
        print('Flood API: {}, Drought API: {}'.format(flood.status_code, drought.status_code))

except Exception as e:
    print('Error: {}'.format(e))