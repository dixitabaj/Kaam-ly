# worker/services/recommendWorker.py
import numpy as np
from math import radians, sin, cos, sqrt, atan2
from datetime import datetime

MAX_DIST_KM = 5

SUBCATEGORY_MAP = {
    "Cleaning":         ["House Cleaning", "Deep Cleaning", "Move-in/Move-out Cleaning"],
    "Carpentry":        ["Furniture Repair", "Flooring Installation", "Custom Built-ins", "Refinishing", "Trim Work"],
    "Plumbing":         ["Drain Cleaning", "Faucet Repair", "Toilet Repair", "Water Heater Repair", "Pipe Repair"],
    "Moving":           ["Furniture Moving", "Box Moving", "Specialty Moving", "Equipment Moving"],
    "Electrical":       ["Switch Repair", "Socket Repair", "Lighting Installation"],
    "Assembly":         ["Furniture Assembly", "Equipment Assembly", "Outdoor Assembly"],
    "Gardening":        ["Lawn Mowing", "Tree Trimming", "Plant Care", "Weed Control", "Fertilization"],
    "HVAC":             ["HVAC Maintenance", "AC Installation", "AC Repair"],
    "Painting":         ["Interior", "Exterior"],
    "Appliance Repair": ["AC Installation", "AC Repair", "Dryer Repair", "Washer Repair",
                         "Refrigerator Repair", "Dishwasher Repair", "Oven Repair"],
}

SUBCATEGORY_KEYWORDS = {
    "Drain Cleaning":            ["drain cleaning", "drain", "sewer"],
    "Faucet Repair":             ["faucet", "tap repair", "fixture"],
    "Toilet Repair":             ["toilet", "bathroom repair"],
    "Water Heater Repair":       ["water heater", "hot water", "boiler"],
    "Pipe Repair":               ["pipe", "plumbing", "leak"],
    "House Cleaning":            ["house cleaning", "home cleaning", "maid", "residential cleaning"],
    "Deep Cleaning":             ["deep cleaning", "deep clean", "cleaning"],
    "Move-in/Move-out Cleaning": ["move", "moving cleaning", "cleaning"],
    "Switch Repair":             ["electrical", "wiring", "switch"],
    "Socket Repair":             ["electrical", "outlet", "socket"],
    "Lighting Installation":     ["lighting", "light installation", "electrician"],
    "HVAC Maintenance":          ["hvac", "heating", "ventilation"],
    "AC Installation":           ["air conditioning", "ac installation", "cooling"],
    "AC Repair":                 ["air conditioning", "ac repair", "hvac"],
    "Washer Repair":             ["washer", "laundry", "appliance"],
    "Dryer Repair":              ["dryer", "laundry", "appliance"],
    "Refrigerator Repair":       ["refrigerator", "fridge", "appliance"],
    "Dishwasher Repair":         ["dishwasher", "appliance repair"],
    "Oven Repair":               ["oven", "stove", "appliance repair"],
    "Furniture Repair":          ["furniture", "furniture repair", "woodwork"],
    "Flooring Installation":     ["flooring", "floor installation", "hardwood"],
    "Custom Built-ins":          ["cabinet", "built-in", "custom woodwork"],
    "Refinishing":               ["refinishing", "wood refinishing", "restoration"],
    "Trim Work":                 ["trim", "molding", "carpentry"],
    "Furniture Moving":          ["moving", "furniture moving", "movers"],
    "Box Moving":                ["moving", "movers", "relocation"],
    "Specialty Moving":          ["specialty moving", "piano", "moving"],
    "Equipment Moving":          ["equipment", "moving", "movers"],
    "Furniture Assembly":        ["assembly", "furniture assembly", "ikea"],
    "Equipment Assembly":        ["assembly", "equipment", "handyman"],
    "Outdoor Assembly":          ["assembly", "outdoor", "handyman"],
    "Lawn Mowing":               ["lawn", "mowing", "lawn care"],
    "Tree Trimming":             ["tree", "trimming", "tree service"],
    "Plant Care":                ["plant", "garden", "landscaping"],
    "Weed Control":              ["weed", "landscaping", "lawn care"],
    "Fertilization":             ["fertiliz", "lawn care", "landscaping"],
    "Interior":                  ["interior painting", "interior", "painting"],
    "Exterior":                  ["exterior painting", "exterior", "painting"],
}

# Build subcategory index
ALL_SUBCATEGORIES = []
SUBCAT_TO_INDEX   = {}
for _cat, _subcats in SUBCATEGORY_MAP.items():
    for _sub in _subcats:
        if _sub not in SUBCAT_TO_INDEX:
            SUBCAT_TO_INDEX[_sub] = len(ALL_SUBCATEGORIES)
            ALL_SUBCATEGORIES.append(_sub)

N_SUBCATEGORIES = len(ALL_SUBCATEGORIES)


def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


def is_available_now(hours_dict):
    if not hours_dict or not isinstance(hours_dict, dict):
        return 0.5
    now = datetime.now()
    day = now.strftime("%A")
    current_hour = now.hour + now.minute / 60.0
    day_hours = hours_dict.get(day)
    if not day_hours:
        return 0.0
    try:
        open_str, close_str = day_hours.split("-")
        open_h  = int(open_str.split(":")[0]) + int(open_str.split(":")[1]) / 60.0
        close_h = int(close_str.split(":")[0]) + int(close_str.split(":")[1]) / 60.0
        return 1.0 if open_h <= current_hour <= close_h else 0.0
    except Exception:
        return 0.5


def experience_factor(review_count, min_factor=0.3, full_experience_at=20):
    if review_count <= 0:
        return min_factor
    factor = np.log1p(review_count) / np.log1p(full_experience_at)
    return float(np.clip(factor, min_factor, 1.0))


def quality_penalty(stars, review_count):
    if review_count < 3:
        return 0.7
    normalized = max(0, (stars - 2.5) / 2.5)
    penalty = 1 / (1 + np.exp(-5 * (normalized - 0.5)))
    return float(np.clip(penalty, 0.3, 1.0))


def get_new_worker_score(row):
    score = 0.3
    if row.get("verified_skills", False):
        score += 0.15
    if row.get("background_check", False):
        score += 0.15
    years = row.get("years_experience", 0)
    score += min(years / 20, 0.2)
    certs = row.get("certifications", [])
    if isinstance(certs, list):
        score += min(len(certs) * 0.05, 0.15)
    completeness = row.get("profile_completeness", 0)
    score += (completeness / 100) * 0.1
    rate = row.get("hourly_rate", 0)
    if 300 <= rate <= 1500:
        score += 0.1
    return float(np.clip(score, 0.0, 1.0))


def get_subcategory_vector(categories_str, primary_category):
    vec = np.zeros(N_SUBCATEGORIES, dtype=np.float32)
    cats_lower = categories_str.lower() if categories_str else ""
    for sub in SUBCATEGORY_MAP.get(primary_category, []):
        keywords = SUBCATEGORY_KEYWORDS.get(sub, [sub.lower()])
        if any(kw in cats_lower for kw in keywords):
            idx = SUBCAT_TO_INDEX.get(sub)
            if idx is not None:
                vec[idx] = 1.0
    return vec


def subcategory_match_score(categories_str, primary_category, target_subcategory):
    if not target_subcategory:
        return 0.5
    cats_lower = categories_str.lower() if categories_str else ""
    keywords = SUBCATEGORY_KEYWORDS.get(target_subcategory, [target_subcategory.lower()])
    return 1.0 if any(kw in cats_lower for kw in keywords) else 0.0


def build_context(row, user_lat=None, user_lon=None, target_subcategory=None):
    cat_cols    = [c for c in row.index if c.startswith("cat_")]
    cat_vec     = row[cat_cols].values.astype(float)
    primary     = row.get("primary_category", "")
    cat_str     = row.get("categories", "")
    subcat_vec  = get_subcategory_vector(cat_str, primary)
    match_score = subcategory_match_score(cat_str, primary, target_subcategory)

    rating     = float(row["stars"]) / 5.0
    popularity = np.log1p(row["review_count"]) / 10.0

    if user_lat and user_lon:
        dist = haversine_distance(user_lat, user_lon, row["latitude"], row["longitude"])
        dist_feature = max(0.0, 1.0 - dist / MAX_DIST_KM)
    else:
        dist_feature = 0.5

    availability = is_available_now(row.get("hours", {}))
    is_open      = float(row.get("is_open", 1))

    return np.concatenate([
        cat_vec, subcat_vec,
        [match_score, rating, popularity, dist_feature, availability, is_open]
    ])