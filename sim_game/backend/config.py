import os
from dotenv import load_dotenv

# Load environmental variables from .env
load_dotenv()

NOVELAI_API_KEY = os.getenv("NOVELAI_API_KEY", "")
NOVELAI_BASE_URL = os.getenv("NOVELAI_BASE_URL", "https://text.novelai.net/oa/v1").rstrip("/")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./sim_game.db")
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./static/uploads")

# Ensure upload directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)
