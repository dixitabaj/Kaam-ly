import cloudinary
import cloudinary.uploader
import os
from ..config import cloudinary_config


async def upload_file(file_bytes: bytes, filename: str, folder: str = "disputes") -> dict:
    """
    Uploads bytes to Cloudinary. Returns secure URL + metadata.
    folder: logical Cloudinary folder.
      - "dispute_evidence" for dispute photos
      - "profiles"         for worker/user avatars
    """
    try:
        result = cloudinary.uploader.upload(
            file_bytes,
            folder          = folder,
            public_id       = f"{folder}/{filename}",
            resource_type   = "auto",
            overwrite       = False,
            unique_filename = True,
        )
        return {
            "success":   True,
            "url":       result["secure_url"],
            "public_id": result["public_id"],
            "format":    result.get("format"),
            "bytes":     result.get("bytes"),
        }
    except Exception as e:
        return {"success": False, "error": str(e)}