import os
from pathlib import Path

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "witw")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "witw")

ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = Path(__file__).parent
DATA_DIR = BACKEND_DIR / "data"
DB_PATH = DATA_DIR / "blog.db"
STATIC_DIR = ROOT_DIR / "frontend" / "dist"
ASSETS_DIR = STATIC_DIR / "assets"
STUDIO_DIR = ROOT_DIR / "studio"
DOWNLOADS_DIR = BACKEND_DIR / "downloads"
UPLOADS_DIR = ROOT_DIR / "uploads"

# Ensure directories exist
UPLOADS_DIR.mkdir(exist_ok=True)
