import sys
import os

# -------- Paths --------
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
libs_path = os.path.join(project_root, "backend", "libs")
if libs_path not in sys.path:
    sys.path.insert(0, libs_path)

# Now import packages from backend/libs
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import re


# ONNX runtime
import onnxruntime as ort
from transformers import AutoTokenizer

# -------- Paths --------
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
libs_path = os.path.join(project_root, "backend", "libs")
if libs_path not in sys.path:
    sys.path.insert(0, libs_path)

model_dir = os.path.join(os.path.dirname(__file__), "model", "bert-base-NER")
onnx_model_path = os.path.join(model_dir, "onnx", "model.onnx")

# -------- Tokenizer --------
tokenizer = AutoTokenizer.from_pretrained(model_dir, local_files_only=True)

# -------- ONNX Model --------
ort_session = ort.InferenceSession(onnx_model_path)

# -------- FastAPI setup --------
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class TextRequest(BaseModel):
    text: str

# -------- Helper functions --------
def convert_entities(entities):
    converted = []
    for ent in entities:
        ent = dict(ent)
        for k, v in ent.items():
            if hasattr(v, "item"):
                ent[k] = v.item()
        converted.append(ent)
    return converted

def find_emails(text):
    emails = []
    for match in re.finditer(r"\b[\w\.-]+@[\w\.-]+\.com\b", text, re.IGNORECASE):
        emails.append({
            "entity": "EMAIL",
            "score": 1.0,
            "word": match.group(),
            "start": match.start(),
            "end": match.end()
        })
    return emails

def postprocess_entities(entities, full_text):
    if not any(ent['entity'].lower() == 'phone' for ent in entities):
        matches = re.findall(r"(09\d{9}|\+63\d{10})", full_text.replace(" ", "").replace("-", ""))
        for match in matches:
            entities.append({
                "entity": "PHONE",
                "score": 1.0,
                "word": match,
                "start": full_text.find(match),
                "end": full_text.find(match) + len(match)
            })

    education_keywords = ["pamantasan", "university", "school", "college", "academy", "institute"]
    for keyword in education_keywords:
        for match in re.finditer(rf"\b{keyword}\b", full_text, re.IGNORECASE):
            entities.append({
                "entity": "EDUCATION",
                "score": 1.0,
                "word": match.group(),
                "start": match.start(),
                "end": match.end()
            })

    if not any(ent['entity'].lower() == 'email' for ent in entities):
        entities.extend(find_emails(full_text))
    return entities

# -------- Simple ONNX NER Inference --------
id2label = {
    0: "O",
    1: "B-MISC",
    2: "I-MISC",
    3: "B-PER",
    4: "I-PER",
    5: "B-ORG",
    6: "I-ORG",
    7: "B-LOC",
    8: "I-LOC"
}

def ner_pipeline(text):
    import numpy as np
    inputs = tokenizer(text, return_tensors="np", truncation=True)
    outputs = ort_session.run(None, dict(inputs))
    logits = outputs[0][0]
    predictions = logits.argmax(axis=-1)
    entities = []

    for idx, label_id in enumerate(predictions):
        label = id2label[label_id]  # map predicted label id → actual label
        token_text = tokenizer.convert_ids_to_tokens([inputs['input_ids'][0][idx].item()])[0]

        if label.startswith("B-") or label.startswith("I-"):
            entities.append({
                "entity": label[2:],  # remove B-/I-
                "score": float(logits[idx][label_id]),
                "word": token_text,
                "start": idx,
                "end": idx+1
            })

    return entities

# -------- API endpoint --------
@app.post("/classify")
def classify_text(req: TextRequest):
    results = ner_pipeline(req.text)
    print("NER raw results:", results)  # log raw model outputs

    new_results = convert_entities(results)
    print("Converted results:", new_results)  # log converted outputs

    refined_results = postprocess_entities(new_results, req.text)
    print("Refined results:", refined_results)  # log after post-processing

    return {"entities": refined_results}


# -------- Run standalone --------
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
