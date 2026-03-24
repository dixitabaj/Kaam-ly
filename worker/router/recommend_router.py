from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import joblib, os
import numpy as np
from math import radians, sin, cos, sqrt, atan2
from ..config.database import collection_worker

router = APIRouter(tags=["Recommendation"])


# ═══════════════════════════════════════════════════════════════════════════════
# CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════════

TASK_CATEGORIES = [
    "Plumbing", "Moving", "Cleaning", "Gardening", "Painting",
    "Carpentry", "Appliance Repair", "Electrical", "HVAC", "Assembly"
]

CATEGORY_ALIAS = {
    "plumbing":         "Plumbing",
    "moving":           "Moving",
    "cleaning":         "Cleaning",
    "gardening":        "Gardening",
    "painting":         "Painting",
    "carpentry":        "Carpentry",
    "appliance repair": "Appliance Repair",
    "electrical":       "Electrical",
    "hvac":             "HVAC",
    "assembly":         "Assembly",
}

# ── Subcategory definitions ───────────────────────────────────────────────────
SUBCATEGORY_MAP = {
    "Plumbing":         ["Drain Cleaning", "Faucet Repair", "Toilet Repair", "Water Heater Repair", "Pipe Repair"],
    "Moving":           ["Furniture Moving", "Box Moving", "Specialty Moving", "Equipment Moving"],
    "Cleaning":         ["House Cleaning", "Deep Cleaning", "Move-in/Move-out Cleaning"],
    "Gardening":        ["Lawn Mowing", "Tree Trimming", "Plant Care", "Weed Control", "Fertilization"],
    "Painting":         ["Interior Painting", "Exterior Painting"],
    "Carpentry":        ["Furniture Repair", "Flooring Installation", "Custom Built-ins", "Refinishing", "Trim Work"],
    "Appliance Repair": ["AC Repair", "AC Installation", "Washer Repair", "Dryer Repair",
                         "Refrigerator Repair", "Dishwasher Repair", "Oven Repair"],
    "Electrical":       ["Switch Repair", "Socket Repair", "Lighting Installation"],
    "HVAC":             ["HVAC Maintenance", "AC Installation", "AC Repair"],
    "Assembly":         ["Furniture Assembly", "Equipment Assembly", "Outdoor Assembly"],
}

SUBCATEGORY_KEYWORDS = {
    "Drain Cleaning":            ["drain cleaning", "drain", "sewer"],
    "Faucet Repair":             ["faucet", "tap repair", "fixture"],
    "Toilet Repair":             ["toilet", "bathroom repair"],
    "Water Heater Repair":       ["water heater", "hot water", "boiler"],
    "Pipe Repair":               ["pipe", "plumbing", "leak"],
    "House Cleaning":            ["house cleaning", "home cleaning", "maid", "residential cleaning"],
    "Deep Cleaning":             ["deep cleaning", "deep clean"],
    "Move-in/Move-out Cleaning": ["move-in", "move-out", "moving cleaning"],
    "Furniture Moving":          ["furniture moving", "furniture", "movers"],
    "Box Moving":                ["box moving", "boxes", "relocation"],
    "Specialty Moving":          ["specialty moving", "piano moving", "specialty"],
    "Equipment Moving":          ["equipment moving", "equipment", "movers"],
    "Lawn Mowing":               ["lawn mowing", "lawn", "mowing"],
    "Tree Trimming":             ["tree trimming", "tree service", "trimming"],
    "Plant Care":                ["plant care", "plants", "garden"],
    "Weed Control":              ["weed control", "weed", "landscaping"],
    "Fertilization":             ["fertilization", "fertilizer", "lawn care"],
    "Interior Painting":         ["interior painting", "interior", "wall painting"],
    "Exterior Painting":         ["exterior painting", "exterior", "outside painting"],
    "Furniture Repair":          ["furniture repair", "furniture", "woodwork"],
    "Flooring Installation":     ["flooring", "floor installation", "hardwood"],
    "Custom Built-ins":          ["cabinet", "built-in", "custom woodwork"],
    "Refinishing":               ["refinishing", "restoration", "wood refinishing"],
    "Trim Work":                 ["trim", "molding", "carpentry trim"],
    "AC Repair":                 ["ac repair", "air conditioning repair", "hvac repair"],
    "AC Installation":           ["ac installation", "air conditioning installation", "cooling"],
    "Washer Repair":             ["washer repair", "washing machine", "laundry repair"],
    "Dryer Repair":              ["dryer repair", "dryer", "laundry"],
    "Refrigerator Repair":       ["refrigerator", "fridge repair", "fridge"],
    "Dishwasher Repair":         ["dishwasher", "dishwasher repair"],
    "Oven Repair":               ["oven repair", "oven", "stove repair"],
    "Switch Repair":             ["switch repair", "switch", "electrical switch"],
    "Socket Repair":             ["socket repair", "outlet", "socket"],
    "Lighting Installation":     ["lighting", "light installation", "electrician"],
    "HVAC Maintenance":          ["hvac maintenance", "hvac", "heating ventilation"],
    "Furniture Assembly":        ["furniture assembly", "assembly", "ikea"],
    "Equipment Assembly":        ["equipment assembly", "equipment", "setup"],
    "Outdoor Assembly":          ["outdoor assembly", "outdoor", "garden assembly"],
}

MAX_DIST_KM       = 5.0
DISTANCE_DECAY_KM = 2.0

MIN_STARS_ESTABLISHED = 3.5
MIN_STARS_NEW         = 3.0
COLD_START_REVIEWS    = 10

# Subcategory score multipliers
SUBCAT_EXACT_BOOST   = 1.35   # worker explicitly has this skill
SUBCAT_PARTIAL_BOOST = 1.15   # worker text hints at it
SUBCAT_MISS_PENALTY  = 0.70   # subcategory requested but worker has none of the keywords


# ═══════════════════════════════════════════════════════════════════════════════
# REQUEST SCHEMA
# ═══════════════════════════════════════════════════════════════════════════════

class RecommendRequest(BaseModel):
    taskType:    str
    top_k:       Optional[int]   = 5
    lat:         Optional[float] = None
    lng:         Optional[float] = None
    subCategory: Optional[str]   = None


# ═══════════════════════════════════════════════════════════════════════════════
# LOAD MODEL
# ═══════════════════════════════════════════════════════════════════════════════

MODEL_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "model", "linucb_model.joblib")
)

linucb       = None
n_features   = None
n_arms       = None
global_theta = None

try:
    model_data = joblib.load(MODEL_PATH)
    linucb     = model_data["linucb"]
    n_features = model_data["n_features"]
    n_arms     = model_data["n_arms"]

    trained_mask = linucb.n > 0
    n_trained    = int(np.sum(trained_mask))

    if n_trained > 0:
        thetas = []
        for arm_idx in np.where(trained_mask)[0]:
            A_inv = np.linalg.inv(linucb.A[arm_idx].astype(np.float64))
            theta = A_inv @ linucb.b[arm_idx].astype(np.float64)
            thetas.append(theta)
        global_theta = np.mean(thetas, axis=0)
        print(f"✅ LinUCB model loaded | n_features={n_features} | n_arms={n_arms} | trained_arms={n_trained}")
    else:
        print("⚠️  No trained arms — falling back to content-based scoring")

except Exception as e:
    print(f"❌ Failed to load model: {e}")
    import traceback
    traceback.print_exc()


# ═══════════════════════════════════════════════════════════════════════════════
# SUBCATEGORY HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def _worker_text(worker: dict) -> str:
    """
    Flatten all relevant worker fields into a single searchable text blob.
    Checks: skills list, description, bio, subcategories, taskType.
    """
    parts = []

    skills = worker.get("skills", [])
    if isinstance(skills, list):
        for s in skills:
            if isinstance(s, dict):
                parts.append(str(s.get("name", "")).lower())
                parts.append(str(s.get("description", "")).lower())
            elif isinstance(s, str):
                parts.append(s.lower())

    parts.append(str(worker.get("description", "")).lower())
    parts.append(str(worker.get("bio", "")).lower())

    subcats = worker.get("subcategories", [])
    if isinstance(subcats, list):
        parts.extend([str(s).lower() for s in subcats])
    elif isinstance(subcats, str):
        parts.append(subcats.lower())

    parts.append(str(worker.get("taskType", "")).lower())

    return " ".join(filter(None, parts))


def subcategory_match(worker: dict, target_subcat: Optional[str]) -> str:
    """
    "exact"   — subcategory name or primary keyword found in worker text
    "partial" — any secondary keyword found
    "none"    — no match
    """
    if not target_subcat:
        return "none"

    keywords     = SUBCATEGORY_KEYWORDS.get(target_subcat, [target_subcat.lower()])
    text_blob    = _worker_text(worker)
    subcat_lower = target_subcat.lower()

    if subcat_lower in text_blob:
        return "exact"
    if keywords and keywords[0] in text_blob:
        return "exact"
    if any(kw in text_blob for kw in keywords):
        return "partial"

    return "none"


def subcat_multiplier(worker: dict, target_subcat: Optional[str]) -> float:
    if not target_subcat:
        return 1.0
    match = subcategory_match(worker, target_subcat)
    if match == "exact":
        return SUBCAT_EXACT_BOOST
    if match == "partial":
        return SUBCAT_PARTIAL_BOOST
    return SUBCAT_MISS_PENALTY


# ═══════════════════════════════════════════════════════════════════════════════
# OTHER HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def normalize_category(task_type: str) -> str:
    return CATEGORY_ALIAS.get(task_type.lower().strip(), task_type)


def haversine_distance(lat1, lon1, lat2, lon2) -> float:
    R = 6371
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


def distance_score(dist_km: float) -> float:
    return float(np.exp(-dist_km / DISTANCE_DECAY_KM))


def experience_factor(review_count: int) -> float:
    if review_count <= 0:
        return 0.3
    return float(np.clip(np.log1p(review_count) / np.log1p(20), 0.3, 1.0))


def quality_penalty(stars: float, review_count: int) -> float:
    if review_count < 3:
        return 0.7
    normalized = max(0.0, (stars - 2.5) / 2.5)
    penalty = 1 / (1 + np.exp(-5 * (normalized - 0.5)))
    return float(np.clip(penalty, 0.3, 1.0))


def review_trust_weight(review_count: int) -> float:
    if review_count <= 0:
        return 0.5
    return float(np.clip(np.log1p(review_count) / np.log1p(50), 0.5, 1.0))


def compute_elite_boost(stars: float, review_count: int, worker: dict) -> float:
    boost = 1.0
    if review_count >= 100 and stars >= 4.5:
        boost += 0.30
    elif review_count >= 50 and stars >= 4.0:
        boost += 0.20
    elif review_count >= 20 and stars >= 4.0:
        boost += 0.15
    if worker.get("face_verified") or worker.get("skill_verified"):
        boost += 0.05
    return float(min(boost, 1.40))


def _get_worker_scalars(worker: dict):
    stars = float(
        worker.get("ratings") or worker.get("rating") or worker.get("stars") or 3.0
    )
    review_count = int(
        worker.get("noOfCompletedTask") or
        worker.get("reviewCount")       or
        worker.get("review_count")      or 0
    )
    return stars, review_count


# ═══════════════════════════════════════════════════════════════════════════════
# FEATURE BUILDER
# ═══════════════════════════════════════════════════════════════════════════════

def build_feature_vector(
    worker:   dict,
    task_type: str,
    user_lat:  Optional[float] = None,
    user_lon:  Optional[float] = None,
) -> tuple:
    """
    15-dim vector matching training layout:
      [cat_one_hot x10] + [rating, popularity, dist_feature, availability, is_open]
    Returns (array, dist_km_or_None)
    """
    cat_vec = np.zeros(len(TASK_CATEGORIES), dtype=np.float32)
    if task_type in TASK_CATEGORIES:
        cat_vec[TASK_CATEGORIES.index(task_type)] = 1.0

    stars, review_count = _get_worker_scalars(worker)
    rating     = stars / 5.0
    popularity = float(np.log1p(review_count) / 10.0)

    worker_lat = worker.get("latitude") or worker.get("lat")
    worker_lon = worker.get("longitude") or worker.get("lng") or worker.get("lon")

    if user_lat is not None and user_lon is not None and worker_lat and worker_lon:
        dist_km      = haversine_distance(user_lat, user_lon, float(worker_lat), float(worker_lon))
        dist_feature = float(max(0.0, 1.0 - dist_km / MAX_DIST_KM))
    else:
        dist_feature = 0.5
        dist_km      = None

    availability = 1.0 if worker.get("isAvailable", True) else 0.0
    is_open      = 1.0

    feature = np.concatenate([
        cat_vec,
        [rating, popularity, dist_feature, availability, is_open]
    ]).astype(np.float32)

    target = n_features or 15
    feature = np.pad(feature, (0, max(0, target - len(feature))))[:target]

    return feature, dist_km


# ═══════════════════════════════════════════════════════════════════════════════
# SCORING
# ═══════════════════════════════════════════════════════════════════════════════

def score_worker(
    worker:        dict,
    task_type:     str,
    user_lat:      Optional[float] = None,
    user_lon:      Optional[float] = None,
    target_subcat: Optional[str]   = None,
) -> tuple:
    """
    Returns (final_score, dist_km) or (-1, None) if worker excluded.

    Pipeline:
      base_score × trust × distance × elite × availability × subcategory_boost
    """
    stars, review_count = _get_worker_scalars(worker)

    is_new = review_count <= COLD_START_REVIEWS
    if is_new and stars < MIN_STARS_NEW:
        return -1.0, None
    if not is_new and stars < MIN_STARS_ESTABLISHED:
        return -1.0, None

    x, dist_km = build_feature_vector(worker, task_type, user_lat, user_lon)

    if global_theta is not None:
        x64          = x.astype(np.float64)
        exploitation = float(global_theta @ x64)
        exp_factor   = experience_factor(review_count)
        qual_factor  = quality_penalty(stars, review_count)
        exploration  = min(float(0.5 * np.sqrt(np.sum(x64 ** 2)) * exp_factor * qual_factor), 0.5)
        base_score   = exploitation + exploration
    else:
        base_score = _content_based_score(worker, stars, review_count)

    dist_mult   = distance_score(dist_km) if dist_km is not None else 0.6
    trust       = review_trust_weight(review_count)
    elite       = compute_elite_boost(stars, review_count, worker)
    avail_mult  = 1.2 if worker.get("isAvailable", True) else 0.8
    subcat_mult = subcat_multiplier(worker, target_subcat)   # ✅ subcategory

    final = base_score * trust * dist_mult * elite * avail_mult * subcat_mult
    return float(final), dist_km


def _content_based_score(worker: dict, stars: float, review_count: int) -> float:
    score = 0.3
    if worker.get("skill_verified") or worker.get("face_verified"):
        score += 0.15
    score += min(review_count / 50, 0.25)
    score += (stars / 5.0) * 0.30
    return float(np.clip(score, 0.0, 1.0))


# ═══════════════════════════════════════════════════════════════════════════════
# DATABASE FETCH
# ═══════════════════════════════════════════════════════════════════════════════

def get_workers_by_task(task_type: str, target_subcat: Optional[str] = None) -> list:
    """
    Fetch workers by taskType. If a subcategory is given, try a DB-level
    pre-filter first (fast). If that returns < 3 results, fall back to
    fetching the full category and letting Python scoring handle ranking.
    """
    base_query = {"taskType": {"$regex": f"^{task_type}$", "$options": "i"}}

    if target_subcat:
        keywords = SUBCATEGORY_KEYWORDS.get(target_subcat, [target_subcat.lower()])
        kw_conditions = []
        for kw in keywords:
            kw_conditions += [
                {"skills":        {"$elemMatch": {"name": {"$regex": kw, "$options": "i"}}}},
                {"description":   {"$regex": kw, "$options": "i"}},
                {"subcategories": {"$regex": kw, "$options": "i"}},
                {"bio":           {"$regex": kw, "$options": "i"}},
            ]

        workers = list(collection_worker.find({**base_query, "$or": kw_conditions}))
        print(f"DEBUG: subcat pre-filter '{target_subcat}' → {len(workers)} workers")

        # Too few — widen to full category (subcategory scoring still applies)
        if len(workers) < 3:
            print(f"DEBUG: widening to full category fetch")
            workers = list(collection_worker.find(base_query))
    else:
        workers = list(collection_worker.find(base_query))

    print(f"DEBUG: worker pool for '{task_type}' [{target_subcat or 'no subcat'}] → {len(workers)}")
    return workers


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN RECOMMEND FUNCTION
# ═══════════════════════════════════════════════════════════════════════════════

def recommend_workers(
    task_type:     str,
    top_k:         int             = 5,
    user_lat:      Optional[float] = None,
    user_lon:      Optional[float] = None,
    target_subcat: Optional[str]   = None,
) -> list:
    if task_type not in TASK_CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown category '{task_type}'. Valid: {TASK_CATEGORIES}"
        )

    workers = get_workers_by_task(task_type, target_subcat)
    if not workers:
        return []

    n_cold    = max(1, round(top_k * 0.20))
    n_quality = top_k - n_cold

    quality_pool = []
    cold_pool    = []

    for worker in workers:
        try:
            if user_lat is not None and user_lon is not None:
                w_lat = worker.get("latitude") or worker.get("lat")
                w_lon = worker.get("longitude") or worker.get("lng") or worker.get("lon")
                if w_lat and w_lon:
                    d = haversine_distance(user_lat, user_lon, float(w_lat), float(w_lon))
                    if d > MAX_DIST_KM:
                        continue

            score, dist_km = score_worker(
                worker        = worker,
                task_type     = task_type,
                user_lat      = user_lat,
                user_lon      = user_lon,
                target_subcat = target_subcat,
            )

            if score < 0:
                continue

            stars, review_count = _get_worker_scalars(worker)
            is_new = review_count <= COLD_START_REVIEWS
            match  = subcategory_match(worker, target_subcat) if target_subcat else "n/a"

            result = {
                **{k: str(v) if k == "_id" else v for k, v in worker.items()},
                "_id":           str(worker["_id"]),
                "_score":        round(score, 4),
                "_distance_km":  round(dist_km, 2) if dist_km is not None else None,
                "_is_new":       is_new,
                "_subcat_match": match,   # "exact" / "partial" / "none" / "n/a"
            }

            if is_new:
                cold_pool.append(result)
            else:
                quality_pool.append(result)

        except Exception as e:
            print(f"⚠️  Scoring error for worker {worker.get('_id')}: {e}")
            continue

    quality_pool.sort(key=lambda w: w["_score"], reverse=True)
    cold_pool.sort(   key=lambda w: w["_score"], reverse=True)

    recommendations  = quality_pool[:n_quality]
    shortfall        = n_quality - len(recommendations)
    if shortfall > 0:
        recommendations += quality_pool[n_quality: n_quality + shortfall]
    recommendations += cold_pool[:n_cold]

    return recommendations[:top_k]


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/recommend")
def get_recommendations(request: RecommendRequest):
    normalized = normalize_category(request.taskType)

    results = recommend_workers(
        task_type     = normalized,
        top_k         = request.top_k or 5,
        user_lat      = request.lat,
        user_lon      = request.lng,
        target_subcat = request.subCategory,
    )

    return {
        "task_type":           normalized,
        "sub_category":        request.subCategory or None,
        "recommended_workers": results,
        "count":               len(results),
    }


@router.get("/recommend/subcategories/{task_type}")
def get_subcategories(task_type: str):
    """Returns valid subcategories for a given task type. Use this to populate your frontend dropdown."""
    normalized = normalize_category(task_type)
    subcats    = SUBCATEGORY_MAP.get(normalized)
    if not subcats:
        raise HTTPException(status_code=404, detail=f"No subcategories for '{normalized}'")
    return {"task_type": normalized, "subcategories": subcats}


@router.get("/recommend/debug/{task_type}")
def debug_recommendations(task_type: str, subCategory: Optional[str] = None):
    normalized = normalize_category(task_type)
    workers    = get_workers_by_task(normalized, subCategory)

    sample_feature = None
    subcat_hits    = {"exact": 0, "partial": 0, "none": 0}

    if workers:
        try:
            feat, _ = build_feature_vector(workers[0], normalized)
            sample_feature = feat.tolist()
        except Exception as e:
            sample_feature = f"Error: {e}"

        if subCategory:
            for w in workers:
                m = subcategory_match(w, subCategory)
                subcat_hits[m] = subcat_hits.get(m, 0) + 1

    return {
        "task_type":          normalized,
        "sub_category":       subCategory,
        "workers_found":      len(workers),
        "subcat_match_breakdown": subcat_hits,
        "model_loaded":       linucb is not None,
        "global_theta_ready": global_theta is not None,
        "n_features":         n_features,
        "n_arms":             n_arms,
        "feature_length":     len(sample_feature) if isinstance(sample_feature, list) else None,
        "sample_feature":     sample_feature,
    }


@router.get("/recommend/model-status")
def model_status():
    return {
        "model_loaded":       linucb is not None,
        "model_path":         MODEL_PATH,
        "file_exists":        os.path.exists(MODEL_PATH),
        "n_features":         n_features,
        "n_arms":             n_arms,
        "global_theta_ready": global_theta is not None,
    }