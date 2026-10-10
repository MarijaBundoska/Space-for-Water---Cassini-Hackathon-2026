import math

DEFAULT_WATER_THRESHOLD = 15
DEFAULT_BRIGHTNESS_GAIN = 0.0008

EVALSCRIPT_TEMPLATE = """function setup() {
    return {
        input: [
            {
                datasource: "CUSTOM",
                bands: ["B02", "B03", "B04"],
            },
            {
                datasource: "S1GRD",
                bands: ["VV", "VH", "dataMask"],
            },
        ],
        output: { bands: 4 },
        mosaicking: "SIMPLE",
    };
}

function toDB(input) {
    return (10 * Math.log(input)) / Math.LN10;
}

const lim = {lim};
const f = {f};

function evaluatePixel(sample) {
    var S1 = sample.S1GRD[0];
    var S2 = sample.CUSTOM[0];
    if (toDB(S1.VV) <= -1 * lim) {
        return [S1.VV * 10, S1.VV * 10, S1.VV * 50, 1];
    } else {
        return [f * S2.B04, f * S2.B03, f * S2.B02, 1];
    }
}
"""


def sentinel_hub_evalscript(lim: float = DEFAULT_WATER_THRESHOLD, f: float = DEFAULT_BRIGHTNESS_GAIN) -> str:
    return EVALSCRIPT_TEMPLATE.format(lim=lim, f=f)


def to_db(value: float) -> float:
    if value <= 0:
        raise ValueError("VV value must be positive to convert to dB")
    return (10 * math.log(value)) / math.log(10)


def detect_water_pixel(vv: float, b02: float, b03: float, b04: float, lim: float = DEFAULT_WATER_THRESHOLD, f: float = DEFAULT_BRIGHTNESS_GAIN) -> dict:
    """Evaluate a single sample and return RGB overlay values plus a water flag."""
    db_value = to_db(vv)
    if db_value <= -lim:
        return {
            "water": True,
            "r": vv * 10,
            "g": vv * 10,
            "b": vv * 50,
            "a": 1,
        }
    return {
        "water": False,
        "r": f * b04,
        "g": f * b03,
        "b": f * b02,
        "a": 1,
    }


def evaluate_sample(sample: dict, lim: float = DEFAULT_WATER_THRESHOLD, f: float = DEFAULT_BRIGHTNESS_GAIN) -> dict:
    """Evaluate a sample shaped like the Sentinel Hub input structure."""
    vv = sample.get("S1GRD", {}).get("VV")
    b02 = sample.get("CUSTOM", {}).get("B02")
    b03 = sample.get("CUSTOM", {}).get("B03")
    b04 = sample.get("CUSTOM", {}).get("B04")
    return detect_water_pixel(vv, b02, b03, b04, lim=lim, f=f)
