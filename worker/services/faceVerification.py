# worker/services/faceVerifyService.py
# All face verification logic — anti-spoof, liveness validation, DeepFace match

import base64
import tempfile
import os
import time
import cv2
import numpy as np
from datetime import datetime
from bson import ObjectId

from ..config.database import collection_worker


# ═══════════════════════════════════════════════════════════════════════════════
# LAZY LOADERS
# ═══════════════════════════════════════════════════════════════════════════════

_deepface  = None
_antispoof = None


def _load_deepface():
    global _deepface
    if _deepface is None:
        print("⏳ Loading DeepFace...")
        from deepface import DeepFace
        _deepface = DeepFace
        print("✅ DeepFace loaded")
    return _deepface


def _load_antispoof():
    global _antispoof
    if _antispoof is not None:
        return _antispoof

    try:
        from src.anti_spoof_predict import AntiSpoofPredict
        from src.generate_patches import CropImage
        from src.utility import parse_model_name

        model_dir = os.path.join(
            os.path.dirname(__file__), "../model/anti_spoof_models"
        )
        _antispoof = {
            "type":    "silent_face",
            "predict": AntiSpoofPredict(0),
            "crop":    CropImage(),
            "dir":     model_dir,
            "parse":   parse_model_name,
        }
        print("✅ Silent-Face anti-spoof loaded")
    except ImportError:
        _antispoof = {"type": "simple"}
        print("⚠️  Silent-Face not installed — using texture fallback")

    return _antispoof


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def save_temp(data: bytes, suffix=".jpg") -> str:
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(data)
    tmp.close()
    return tmp.name


def decode_b64(b64: str) -> bytes:
    if "," in b64:
        b64 = b64.split(",", 1)[1]
    return base64.b64decode(b64)


def to_cv2(image_bytes: bytes):
    arr = np.frombuffer(image_bytes, np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


# ═══════════════════════════════════════════════════════════════════════════════
# ANTI-SPOOF
# ═══════════════════════════════════════════════════════════════════════════════

def check_anti_spoof(image_bytes: bytes) -> dict:
    """
    Detects printed photos and screen replay attacks.
    Uses Silent-Face if installed, otherwise texture analysis fallback.
    """
    antispoof = _load_antispoof()
    img = to_cv2(image_bytes)

    if img is None:
        return {"is_real": False, "confidence": 0, "reason": "Could not decode image"}

    # ── Silent-Face (accurate) ────────────────────────────────────────────────
    if antispoof["type"] == "silent_face":
        try:
            image_bbox = antispoof["predict"].get_bbox(img)
            prediction = np.zeros((1, 3))
            for model_name in os.listdir(antispoof["dir"]):
                h_input, w_input, model_type, scale = antispoof["parse"](model_name)
                img_cropped = antispoof["crop"].crop(
                    img, image_bbox, scale, (h_input, w_input)
                )
                prediction += antispoof["predict"].predict(
                    img_cropped, os.path.join(antispoof["dir"], model_name)
                )
            label      = np.argmax(prediction)
            value      = prediction[0][label] / 2
            is_real    = label == 1
            confidence = round(float(value) * 100, 1)
            return {
                "is_real":    is_real,
                "confidence": confidence,
                "reason":     "Real face" if is_real else "Spoof detected (photo/screen replay)",
            }
        except Exception as e:
            print(f"⚠️  Silent-Face error: {e}, falling back to texture check")

    # ── Texture fallback ──────────────────────────────────────────────────────
    try:
        gray      = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        lap_var   = cv2.Laplacian(gray, cv2.CV_64F).var()
        b, g, r   = cv2.split(img)
        color_std = float(np.mean([b.std(), g.std(), r.std()]))
        noise     = float(np.std(
            gray.astype(float) - cv2.GaussianBlur(gray, (5, 5), 0).astype(float)
        ))

        is_real    = lap_var > 80 and color_std > 25 and noise > 2.0
        confidence = min(100, round((lap_var / 5 + color_std + noise * 10) / 3, 1))
        reason     = (
            "Real face detected" if is_real else
            "Image too blurry — possible printed photo" if lap_var < 80
            else "Unusual color distribution — possible screen replay"
        )
        return {"is_real": is_real, "confidence": confidence, "reason": reason}

    except Exception as e:
        print(f"⚠️  Texture check failed: {e}")
        return {"is_real": True, "confidence": 50, "reason": "Anti-spoof check skipped"}


# ═══════════════════════════════════════════════════════════════════════════════
# LIVENESS VALIDATION
# ═══════════════════════════════════════════════════════════════════════════════

def validate_liveness(proof: dict) -> dict:
    """
    Validates the liveness proof sent by the React/MediaPipe frontend.
    Checks: completeness, freshness (< 5 min), frame count.
    """
    if not proof:
        return {"passed": False, "reason": "No liveness proof — complete the face challenge first"}

    if not proof.get("challenge_passed"):
        return {"passed": False, "reason": "Liveness challenge not completed"}

    if not proof.get("blink_detected"):
        return {"passed": False, "reason": "Blink not detected — please blink when prompted"}

    if not proof.get("head_turn_detected"):
        return {"passed": False, "reason": "Head turn not detected — please turn your head when prompted"}

    ts = proof.get("timestamp", 0)
    if ts and (time.time() - ts / 1000) > 300:
        return {"passed": False, "reason": "Challenge expired — please retry"}

    if proof.get("frames_count", 0) < 10:
        return {"passed": False, "reason": "Not enough frames captured — please retry"}

    return {"passed": True, "reason": "Liveness verified"}


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN SERVICE FUNCTION
# ═══════════════════════════════════════════════════════════════════════════════

def run_face_verification(worker_id: str, selfie_b64: str, id_photo_b64: str, liveness_proof: dict) -> dict:
    """
    Full 3-step pipeline:
      1. Liveness proof validation
      2. Anti-spoof check
      3. DeepFace match (selfie vs ID photo)

    Returns a result dict — never raises, always returns structured response.
    Raises ValueError for worker not found.
    """
    # ── Find worker ───────────────────────────────────────────────────────────
    worker = None
    try:
        worker = collection_worker.find_one({"_id": ObjectId(worker_id)})
    except Exception:
        pass
    if not worker:
        worker = collection_worker.find_one({"email": worker_id})
    if not worker:
        raise ValueError(f"Worker not found: {worker_id}")

    if worker.get("face_verified"):
        return {"verified": True, "already_done": True, "message": "Worker already verified"}

    selfie_bytes   = decode_b64(selfie_b64)
    id_photo_bytes = decode_b64(id_photo_b64)

    selfie_path = None
    id_path     = None

    try:
        # ── STEP 1: Liveness ──────────────────────────────────────────────────
        liveness = validate_liveness(liveness_proof)
        if not liveness["passed"]:
            return {
                "verified":  False,
                "failed_at": "liveness",
                "message":   liveness["reason"],
                "liveness":  liveness,
            }

        # ── STEP 2: Anti-spoof ────────────────────────────────────────────────
        spoof = check_anti_spoof(selfie_bytes)
        if not spoof["is_real"]:
            return {
                "verified":   False,
                "failed_at":  "anti_spoof",
                "message":    spoof["reason"],
                "anti_spoof": spoof,
            }

        # ── STEP 3: Face match ────────────────────────────────────────────────
        DeepFace    = _load_deepface()
        selfie_path = save_temp(selfie_bytes)
        id_path     = save_temp(id_photo_bytes)

        match = DeepFace.verify(
            img1_path         = selfie_path,
            img2_path         = id_path,
            model_name        = "Facenet512",
            detector_backend  = "opencv",
            enforce_detection = False,
        )

        matched    = match.get("verified", False)
        distance   = round(match.get("distance", 1.0), 4)
        threshold  = round(match.get("threshold", 0.3), 4)
        confidence = round((1 - distance / threshold) * 100, 1) if threshold > 0 else 0

        if not matched:
            return {
                "verified":   False,
                "failed_at":  "face_match",
                "message":    "Selfie does not match ID photo. Ensure good lighting and try again.",
                "confidence": confidence,
                "distance":   distance,
            }

        # ── ALL PASSED — save to DB ───────────────────────────────────────────
        collection_worker.update_one(
            {"_id": worker["_id"]},
            {"$set": {
                "face_verified":     True,
                "face_verified_at":  datetime.utcnow(),
                "profilePhoto":      selfie_b64,
                "face_match_score":  confidence,
                "liveness_verified": True,
                "anti_spoof_score":  spoof["confidence"],
            }}
        )

        return {
            "verified":   True,
            "message":    "Identity verified successfully.",
            "confidence": confidence,
            "liveness":   liveness,
            "anti_spoof": spoof,
            "face_match": {
                "matched":    matched,
                "confidence": confidence,
                "distance":   distance,
                "threshold":  threshold,
            },
        }

    finally:
        if selfie_path and os.path.exists(selfie_path): os.remove(selfie_path)
        if id_path     and os.path.exists(id_path):     os.remove(id_path)


def get_verification_status(worker_id: str) -> dict:
    worker = None
    try:
        worker = collection_worker.find_one({"_id": ObjectId(worker_id)})
    except Exception:
        pass
    if not worker:
        worker = collection_worker.find_one({"email": worker_id})
    if not worker:
        raise ValueError(f"Worker not found: {worker_id}")

    return {
        "worker_id":         worker_id,
        "face_verified":     worker.get("face_verified", False),
        "liveness_verified": worker.get("liveness_verified", False),
        "verified_at":       worker.get("face_verified_at"),
        "face_match_score":  worker.get("face_match_score"),
        "anti_spoof_score":  worker.get("anti_spoof_score"),
    }


def reset_verification(worker_id: str) -> dict:
    try:
        result = collection_worker.update_one(
            {"_id": ObjectId(worker_id)},
            {"$set": {
                "face_verified":     False,
                "liveness_verified": False,
                "face_verified_at":  None,
                "face_match_score":  None,
                "anti_spoof_score":  None,
            }}
        )
        if result.matched_count == 0:
            raise ValueError(f"Worker not found: {worker_id}")
        return {"message": "Verification reset successfully"}
    except ValueError:
        raise
    except Exception as e:
        raise RuntimeError(str(e))