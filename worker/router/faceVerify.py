# routers/faceVerification.py
#
# Handles all face verification logic in one place.
#
# Dependencies:
#   pip install deepface fastapi python-multipart
#
# Mount in your main.py:
#   from routers.faceVerification import router as face_router
#   app.include_router(face_router, prefix="/api")

import base64
import os
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel

try:
    from deepface import DeepFace
except ImportError:
    raise ImportError("Run: pip install deepface")

# ── Config ─────────────────────────────────────────────────────────────────
UPLOAD_DIR   = "uploads"
DEEPFACE_MODEL   = "Facenet512"
DEEPFACE_BACKEND = "opencv"

os.makedirs(UPLOAD_DIR, exist_ok=True)

router = APIRouter(prefix="/face", tags=["Face Verification"])


# ── Helpers ─────────────────────────────────────────────────────────────────

def save_temp(b64_string: str) -> str:
    """Decode a base64 image string and save it as a temp file. Returns the path."""
    if "," in b64_string:
        b64_string = b64_string.split(",")[1]
    image_bytes = base64.b64decode(b64_string)
    path = os.path.join(UPLOAD_DIR, f"temp_{uuid.uuid4().hex}.jpg")
    with open(path, "wb") as f:
        f.write(image_bytes)
    return path


def cleanup(*paths: str):
    """Delete temp files silently."""
    for path in paths:
        try:
            if path and os.path.exists(path):
                os.remove(path)
        except Exception:
            pass


def compare_images(img1_path: str, img2_path: str) -> dict:
    """
    Run DeepFace verification between two image paths.
    Returns a dict with verified, confidence, distance, threshold.
    """
    match = DeepFace.verify(
        img1_path         = img1_path,
        img2_path         = img2_path,
        model_name        = DEEPFACE_MODEL,
        detector_backend  = DEEPFACE_BACKEND,
        enforce_detection = False,
    )
    distance   = round(match.get("distance",  1.0), 4)
    threshold  = round(match.get("threshold", 0.3), 4)
    # Clamp confidence to 0–100
    raw_conf   = (1 - distance / threshold) * 100
    confidence = round(max(0.0, min(100.0, raw_conf)), 1)
    verified   = match.get("verified", False)

    return {
        "verified":   verified,
        "confidence": confidence,
        "distance":   distance,
        "threshold":  threshold,
    }


# ── Service layer ────────────────────────────────────────────────────────────

def run_face_verification(
    worker_id:            str,
    selfie_b64:           str,
    reference_photo_b64:  str,
    liveness_proof:       dict,
) -> dict:
    """
    Core verification logic:
      1. Decode both images to temp files
      2. Run DeepFace comparison
      3. Build and return the result payload
      4. Clean up temp files

    The reference_photo is the profile photo the worker uploaded in Step 3.
    No separate ID document is needed.
    """
    selfie_path    = None
    reference_path = None

    try:
        selfie_path    = save_temp(selfie_b64)
        reference_path = save_temp(reference_photo_b64)

        result = compare_images(selfie_path, reference_path)

        verified = result["verified"]

        return {
            "verified":   verified,
            "confidence": result["confidence"],
            "distance":   result["distance"],
            "threshold":  result["threshold"],
            "worker_id":  worker_id,
            "liveness":   liveness_proof,
            "message":    (
                "Your identity has been confirmed."
                if verified else
                "Your selfie did not match your profile photo. Please try again."
            ),
            "failed_at":  None if verified else "face_match",
        }

    finally:
        cleanup(selfie_path, reference_path)


# ── Endpoints ────────────────────────────────────────────────────────────────

class FaceVerifyRequest(BaseModel):
    worker_id:       str
    selfie:          str            # base64 JPEG from liveness capture
    reference_photo: str            # base64 profile photo uploaded in Step 3
    liveness_proof:  Optional[dict] = None


@router.post("/verify")
def verify_face(request: FaceVerifyRequest):
    """
    Main verification endpoint called by the frontend after liveness check.
    Compares the live selfie against the worker's uploaded profile photo.
    """
    try:
        return run_face_verification(
            worker_id           = request.worker_id,
            selfie_b64          = request.selfie,
            reference_photo_b64 = request.reference_photo,
            liveness_proof      = request.liveness_proof or {},
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"Face verify error: {e}")
        raise HTTPException(status_code=500, detail=f"Verification failed: {str(e)}")


@router.post("/compare")
async def compare_faces(
    selfie:          UploadFile = File(...),
    reference_photo: UploadFile = File(...),
):
    """
    Dev/testing utility — upload two images as multipart and get a match result.
    Not called by the frontend; useful for testing DeepFace directly.
    """
    selfie_path    = None
    reference_path = None
    try:
        selfie_path    = save_temp(base64.b64encode(await selfie.read()).decode())
        reference_path = save_temp(base64.b64encode(await reference_photo.read()).decode())
        return compare_images(selfie_path, reference_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cleanup(selfie_path, reference_path)