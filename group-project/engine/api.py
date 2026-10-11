from flask import Flask, request, jsonify, send_from_directory, abort
from flask_cors import CORS
import requests
from pathlib import Path

from copernicus_data import register_data_record, get_registered_records
from image_data import get_image_file_path, get_image_records, register_image_record, scan_image_folder
from sentinel_hub import sentinel_hub_evalscript, evaluate_sample

# Optional ML model import
try:
    from ml_model import predict_flood_probability, predict_drought_probability
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False
    print("ML model not available - running without ML predictions")

# Setup Flask app with static files
app = Flask(__name__, 
            static_folder=str(Path(__file__).resolve().parents[1] / "assets"),
            static_url_path="/static")
CORS(app)

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


def compute_flood_risk(precip_sum: float, precip_prob: float) -> float:
    threshold = 50.0
    risk = ((precip_sum / threshold) * 70) + (precip_prob * 0.3)
    return min(round(risk, 1), 100.0)


def fetch_daily_forecast(lat: float, lon: float, days: int) -> list:
    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": "precipitation_sum,precipitation_probability_max",
        "timezone": "auto",
        "forecast_days": days,
    }
    response = requests.get(OPEN_METEO_URL, params=params, timeout=15)
    response.raise_for_status()
    data = response.json()

    daily_data = data.get("daily", {})
    dates = daily_data.get("time", [])
    sums = daily_data.get("precipitation_sum", [])
    probs = daily_data.get("precipitation_probability_max", [])

    forecast = []
    for date, rain, prob in zip(dates, sums, probs):
        forecast.append({
            "date": date,
            "precipitation_sum_mm": rain,
            "precipitation_probability_max": prob,
            "risk": compute_flood_risk(rain, prob),
        })

    return forecast


@app.route("/forecast", methods=["GET"])
def forecast():
    lat = request.args.get("lat", type=float)
    lon = request.args.get("lon", type=float)
    days = request.args.get("days", default=7, type=int)

    if lat is None or lon is None:
        return jsonify({"error": "Missing required query parameters: lat and lon"}), 400

    days = max(3, min(days, 7))

    try:
        forecast_data = fetch_daily_forecast(lat, lon, days)
    except requests.RequestException as exc:
        return jsonify({"error": f"Weather API request failed: {exc}"}), 502
    except Exception as exc:
        return jsonify({"error": f"Internal error: {exc}"}), 500

    risk_values = [day["risk"] for day in forecast_data]
    summary = {
        "forecast_days": days,
        "max_risk": max(risk_values) if risk_values else None,
        "average_risk": round(sum(risk_values) / len(risk_values), 1) if risk_values else None,
    }

    return jsonify({
        "location": {
            "latitude": lat,
            "longitude": lon,
        },
        "forecast": forecast_data,
        "summary": summary,
    })


@app.route("/copernicus/records", methods=["GET"])
def copernicus_records():
    return jsonify({"records": get_registered_records()})


@app.route("/copernicus/register", methods=["POST"])
def copernicus_register():
    payload = request.get_json(silent=True)
    if not payload:
        return jsonify({"error": "Request JSON body required"}), 400
    record = register_data_record(payload)
    return jsonify({"record": record}), 201


@app.route("/sentinel-hub/evalscript", methods=["GET"])
def sentinel_evalscript():
    lim = request.args.get("lim", default=15.0, type=float)
    f = request.args.get("f", default=0.0008, type=float)
    return jsonify({"evalscript": sentinel_hub_evalscript(lim, f)})


@app.route("/sentinel-hub/evaluate", methods=["POST"])
def sentinel_evaluate():
    payload = request.get_json(silent=True)
    if not payload:
        return jsonify({"error": "Request JSON body required"}), 400

    try:
        sample = payload.get("sample", {})
        result = evaluate_sample(sample)
        return jsonify({"result": result})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 400


@app.route("/images/records", methods=["GET"])
def image_records():
    return jsonify({"records": get_image_records()})


@app.route("/images/register", methods=["POST"])
def image_register():
    payload = request.get_json(silent=True)
    if not payload:
        return jsonify({"error": "Request JSON body required"}), 400

    record = register_image_record(payload)
    return jsonify({"record": record}), 201


@app.route("/images/scan", methods=["POST"])
def image_scan():
    payload = request.get_json(silent=True)
    if not payload or "path" not in payload:
        return jsonify({"error": "Request JSON body with 'path' required"}), 400

    folder = payload["path"]
    try:
        records = scan_image_folder(folder)
        return jsonify({"records": records, "source": folder})
    except FileNotFoundError as exc:
        return jsonify({"error": str(exc)}), 404
    except Exception as exc:
        return jsonify({"error": str(exc)}), 400


@app.route("/images/file/<path:filename>", methods=["GET"])
def serve_image(filename):
    try:
        path = get_image_file_path(filename)
    except ValueError:
        abort(400)

    if not path.exists():
        abort(404)

    return send_from_directory(str(path.parent), path.name)


@app.route("/", methods=["GET"])
def index():
    return send_from_directory(app.static_folder, "hackathon.html")


@app.route("/app", methods=["GET"])
def app_page():
    return send_from_directory(app.static_folder, "hackathon.html")

@app.route("/predict/flood", methods=["POST"])
def predict_flood():
    if not ML_AVAILABLE:
        return jsonify({"error": "ML model not available"}), 503
    
    payload = request.get_json(silent=True)
    if not payload:
        return jsonify({"error": "Request JSON required"}), 400
    
    try:
        lat = payload.get("lat", 41.99)
        lon = payload.get("lon", 21.43)
        precipitation = payload.get("precipitation", 0)
        probability = payload.get("probability", 0)
        
        ml_prediction = predict_flood_probability(lat, lon, precipitation, probability)
        
        return jsonify({
            "ml_prediction": ml_prediction,
            "location": {"lat": lat, "lon": lon}
        })
    except Exception as exc:
        return jsonify({"error": str(exc)}), 400


@app.route("/predict/drought", methods=["POST"])
def predict_drought():
    if not ML_AVAILABLE:
        return jsonify({"error": "ML model not available"}), 503
    
    payload = request.get_json(silent=True)
    if not payload:
        return jsonify({"error": "Request JSON required"}), 400
    
    try:
        lat = payload.get("lat", 41.99)
        lon = payload.get("lon", 21.43)
        precipitation = payload.get("precipitation", 0)
        probability = payload.get("probability", 0)
        
        ml_prediction = predict_drought_probability(lat, lon, precipitation, probability)
        
        return jsonify({
            "ml_prediction": ml_prediction,
            "location": {"lat": lat, "lon": lon}
        })
    except Exception as exc:
        return jsonify({"error": str(exc)}), 400


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
