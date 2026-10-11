import json
from datetime import datetime
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
IMAGE_ROOT = ROOT_DIR / "data" / "collected_images"
IMAGE_ROOT.mkdir(parents=True, exist_ok=True)
RECORD_FILE = IMAGE_ROOT / "metadata.json"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp", ".gif", ".webp"}


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


def build_image_record(image_path: Path, source_root: Path = IMAGE_ROOT) -> dict:
    rel_path = image_path.relative_to(source_root)
    parts = rel_path.parts
    year = None
    month = None
    if len(parts) >= 2 and parts[0].isdigit() and len(parts[0]) == 4 and parts[1].isdigit():
        year = parts[0]
        month = parts[1]

    return {
        "filename": rel_path.name,
        "relative_path": str(rel_path).replace('\\', '/'),
        "absolute_path": str(image_path),
        "year": year,
        "month": month,
        "directory": "/".join(parts[:-1]),
        "created_at": datetime.utcnow().isoformat() + "Z",
        "source": "collected_images",
    }


def _is_image_file(path: Path) -> bool:
    return path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS


def scan_image_folder(folder: str = None) -> list:
    if folder:
        folder_path = Path(folder)
        if not folder_path.is_absolute():
            folder_path = ROOT_DIR / folder_path
    else:
        folder_path = IMAGE_ROOT

    if not folder_path.exists() or not folder_path.is_dir():
        raise FileNotFoundError(f"Image folder not found: {folder_path}")

    records = []
    for path in sorted(folder_path.rglob("*")):
        if _is_image_file(path):
            # keep the source root consistent for relative paths
            source_root = IMAGE_ROOT if folder is None or folder_path == IMAGE_ROOT else folder_path
            records.append(build_image_record(path, source_root=source_root))

    _save_records(records)
    return records


def register_image_record(record: dict) -> dict:
    records = _load_records()
    image_record = {
        "filename": record.get("filename"),
        "relative_path": record.get("relative_path"),
        "absolute_path": record.get("absolute_path"),
        "year": record.get("year"),
        "month": record.get("month"),
        "directory": record.get("directory"),
        "source": record.get("source", "manual"),
        "metadata": record.get("metadata", {}),
        "created_at": record.get("created_at", datetime.utcnow().isoformat() + "Z"),
    }
    records.append(image_record)
    _save_records(records)
    return image_record


def get_image_records() -> list:
    return _load_records()


def get_image_file_path(relative_path: str) -> Path:
    candidate = IMAGE_ROOT / Path(relative_path)
    candidate = candidate.resolve()
    if IMAGE_ROOT not in candidate.parents and candidate != IMAGE_ROOT:
        raise ValueError("Requested image path is outside the allowed image directory")
    return candidate
