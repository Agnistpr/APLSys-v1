from fastapi import FastAPI
from pydantic import BaseModel
import requests
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
GEMINI_MODEL = "gemini-2.5-pro"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")


def gemini_extract_resume_profile(full_text: str) -> dict:
    """
    Use Gemini to extract a structured resume profile from raw resume text.
    """
    prompt = (
        "Given the following resume text, extract all details into a JSON object with this structure:\n"
        "{\n"
        "  \"profile\": {\n"
        "    \"firstName\": \"\",\n"
        "    \"middleName\": \"\",\n"
        "    \"lastName\": \"\",\n"
        "    \"age\": \"\",\n"
        "    \"gender\": \"\",\n"
        "    \"email\": \"\",\n"
        "    \"phone\": \"\",\n"
        "    \"location\": \"\",\n"
        "    \"url\": \"\",\n"
        "    \"summary\": \"\"\n"
        "  },\n"
        "  \"educations\": [\n"
        "    {\"school\": \"\", \"degree\": \"\", \"gpa\": \"\", \"date\": \"\", \"descriptions\": \"\"}\n"
        "  ],\n"
        "  \"workExperiences\": [\n"
        "    {\"company\": \"\", \"jobTitle\": \"\", \"date\": \"\", \"descriptions\": \"\"}\n"
        "  ],\n"
        "  \"projects\": [\n"
        "    {\"project\": \"\", \"date\": \"\", \"descriptions\": \"\"}\n"
        "  ],\n"
        "  \"skills\": {\n"
        "    \"descriptions\": \"\",\n"
        "    \"featuredSkills\": [{\"skill\": \"\"}]\n"
        "  }\n"
        "}\n"
        "Fill in as much as possible from the resume. Use empty strings for missing fields. "
        "Resume Text:\n"
        f"{full_text}\n"
        "JSON:"
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
    text = (
        data.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "")
    )
    import json
    try:
        start = text.find('{')
        end = text.rfind('}') + 1
        profile_json = json.loads(text[start:end])
        return profile_json
    except Exception:
        return {"error": "Failed to parse Gemini response", "raw": text}
    
def gemini_extract_metadata_from_image(image_path: str) -> dict:
    """
    Use Gemini to extract and label structured metadata from any document image.
    Returns a JSON object with all detected fields, key-value pairs, and inferred structure.
    """
    image_b64 = image_to_base64(image_path)
    prompt = (
        "You are an expert document parser. Given the following image of a document, "
        "extract all relevant metadata, key-value pairs, and any structured information you can infer. "
        "Return your answer as a JSON object. If the document is a resume, include fields like name, email, education, etc. "
        "If it's an invoice, include invoice number, date, total, etc. "
        "For certificates, extract recipient, issuer, date, etc. "
        "For any other document, extract as much structured information as possible. "
        "Use empty strings for missing fields. Respond only with JSON."
    )
    url = f"{BASE_URL}/models/{GEMINI_MODEL}:generateContent"
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY
    }
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": "image/png",  # or "image/jpeg" as needed
                            "data": image_b64
                        }
                    }
                ]
            }
        ]
    }
    response = requests.post(url, json=payload, headers=headers)
    response.raise_for_status()
    data = response.json()
    text = (
        data.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "")
    )
    import json
    try:
        start = text.find('{')
        end = text.rfind('}') + 1
        metadata_json = json.loads(text[start:end])
        return metadata_json
    except Exception:
        return {"error": "Failed to parse Gemini response", "raw": text}
