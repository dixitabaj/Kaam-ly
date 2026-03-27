# config/cloudinary_config.py
import cloudinary
import os
from dotenv import load_dotenv

# Same fix: go one level up from config/ to worker/ where .env is
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY    = os.getenv("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET")

# Debug prints
print("CLOUDINARY_CLOUD_NAME:", CLOUDINARY_CLOUD_NAME)
print("CLOUDINARY_API_KEY:", CLOUDINARY_API_KEY)
print("CLOUDINARY_API_SECRET:", CLOUDINARY_API_SECRET)

cloudinary.config(
    cloud_name = CLOUDINARY_CLOUD_NAME,
    api_key    = CLOUDINARY_API_KEY,
    api_secret = CLOUDINARY_API_SECRET,
    secure     = True
)