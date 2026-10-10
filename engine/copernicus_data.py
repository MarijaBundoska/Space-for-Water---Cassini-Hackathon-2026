import json
from datetime import datetime
from pathlib import Path

try:
    from sentinelsat import SentinelAPI
except ImportError:  # pragma: no cover
    SentinelAPI = None

BASE_DIR = Path(__file__).resolve().parents[1]
COPERNICUS_DIR = BASE_DIR / "data" / "copernicus"
COPERNICUS_DIR.mkdir(parents=True, exist_ok=True)
RECORD_FILE = COPERNICUS_DIR / "records.json"
 

def _load_records():
    if not RECORD_FILE.exists():
        return []
    try:
        with RECORD_FILE.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except json.JSONDecodeError:
        return []


def _save_records(records):
    with RECORD_FILE.open("w", encoding="utf-8") as handle:
        json.dump(records, handle, indent=2, ensure_ascii=False)


def register_data_record(record: dict) -> dict:
    """Register metadata for a Copernicus satellite dataset or flood document."""
    now = datetime.utcnow().isoformat() + "Z"
    stored = {
        "id": record.get("id") or now,
        "created_at": record.get("created_at") or now,
        "title": record.get("title", "copernicus-data"),
        "platform": record.get("platform"),
        "instrument": record.get("instrument"),
        "tile": record.get("tile"),
        "date": record.get("date"),
        "type": record.get("type", "flood"),
        "source_url": record.get("source_url"),
        "notes": record.get("notes"),
        "metadata": record.get("metadata", {}),
    }

    records = _load_records()
    records.append(stored)
    _save_records(records)
    return stored


def get_registered_records() -> list:
    """Return all registered Copernicus dataset records."""
    return _load_records()


def initialize_copernicus_api(username: str, password: str, api_url: str = "https://scihub.copernicus.eu/dhus"):
    """Create a Copernicus Open Access Hub API client."""
    if SentinelAPI is None:
        raise ImportError("sentinelsat is required for Copernicus API access. Install it with pip install sentinelsat")
    return SentinelAPI(username, password, api_url)


def search_products(api, footprint_wkt: str, start_date: str, end_date: str, platformname: str = "Sentinel-1", processinglevel: str = "Level-1", cloudcoverpercentage: tuple = (0, 100), limit: int = 50):
    """Search for Copernicus products matching a time range and geometry."""
    if api is None:
        raise ValueError("A valid SentinelAPI client is required")
    products = api.query(
        footprint_wkt,
        date=(start_date, end_date),
        platformname=platformname,
        processinglevel=processinglevel,
        cloudcoverpercentage=cloudcoverpercentage,
    )
    result = []
    for count, (product_id, product_info) in enumerate(products.items()):
        if count >= limit:
            break
        result.append({"id": product_id, **product_info})
    return result


def download_products(api, products, target_directory: str):
    """Download selected Copernicus products into a local directory."""
    if api is None:
        raise ValueError("A valid SentinelAPI client is required")
    target_path = Path(target_directory)
    target_path.mkdir(parents=True, exist_ok=True)
    downloaded = api.download_all(products, directory=str(target_path))
    return downloaded
