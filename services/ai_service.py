from fastapi import FastAPI
from pydantic import BaseModel
import requests
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="Gemini AI Server")
BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
GEMINI_MODEL = "gemini-2.5-pro"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

class TextRequest(BaseModel):
    text: str

@app.post("/analyze-resume")
async def analyze_resume(prompt: str) -> str:
    url = f"{BASE_URL}/models/{GEMINI_MODEL}:generateContent"
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY
    }
    payload = {
        "contents": [
            {"parts": [{"text": prompt}]}
        ]
    }

    response = requests.post(url, json=payload, headers=headers)
    response.raise_for_status()
    data = response.json()

    return data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")

@app.post("/classify")
async def classify_text(request: TextRequest):
    prompt = (
        "Classify the following text into one of these tags: "
        "name, phone, email, education, address, skills, experience. "
        "Return only the tag.\n"
        f"Text: \"{request.text}\""
    )
    url = f"{BASE_URL}/models/{GEMINI_MODEL}:generateContent"
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY
    }
    payload = {
        "contents": [
            {"parts": [{"text": prompt}]}
        ]
    }

    response = requests.post(url, json=payload, headers=headers)
    response.raise_for_status()
    data = response.json()
    tag = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()
    return {"tag": tag}