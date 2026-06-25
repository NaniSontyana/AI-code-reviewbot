import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Config:
    PORT = int(os.getenv("PORT", 5001))
    DATABASE_URL = os.getenv("DATABASE_URL")
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "all-MiniLM-L6-v2")
    
    @staticmethod
    def validate():
        missing = []
        if not Config.DATABASE_URL:
            missing.append("DATABASE_URL")
        if not Config.GROQ_API_KEY:
            missing.append("GROQ_API_KEY")
        if missing:
            print(f"WARNING: Missing environment variables: {', '.join(missing)}")
            return False
        return True
