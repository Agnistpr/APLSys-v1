# app/routers/ocr_router.py
from fastapi import APIRouter, UploadFile, File, Query, Request
from services.ocr_service import (
    run_ocr,
    extract_on_document,
    search_word,
    collect_all_pages
)
from typing import List
from doctr.io import DocumentFile
from doctr.models import ocr_predictor
from model.request_schema import SearchRequest
router = APIRouter()

# Load once at startup
ocr_model = ocr_predictor(det_arch="db_resnet34", reco_arch="crnn_vgg16_bn", pretrained=True)

@router.post("/run-ocr-on-document-upload")
async def run_ocr_document_upload(file: UploadFile = File(...)):
    content = await file.read()
    doc, exported = extract_on_document(content)
    return {"pages": exported["pages"]}

@router.post("/search-word")
async def search_word_endpoint(request: SearchRequest):
    doc, exported = extract_on_document(request.file_path)
    matches = []
    matches = search_word(exported, request.query)
    return {"matches": matches}

@router.post("/batch-ocr")
async def batch_ocr(files: List[UploadFile] = File(...)):
    """
    Run OCR on multiple uploaded files and return structured JSON for each.
    """
    results = []
    for file in files:
        try:
            ocr_result = await run_ocr(file)
            results.append({
                "filename": file.filename,
                "result": ocr_result
            })
        except Exception as e:
            results.append({
                "filename": file.filename,
                "error": str(e)
            })
    return {"results": results}

@router.post("/collect-all-pages")
def collect_all_pages_endpoint(file_path: str = Query(..., description="Path to image or PDF file")):
    pages = collect_all_pages(file_path)
    # Remove image objects from response for JSON serialization
    for page in pages:
        if "image" in page:
            page["image"] = "Image data omitted"
    return {"pages": pages}

@router.post("/extract-full")
async def extract_text_full(file: UploadFile):
    """
    Run OCR on an uploaded file and return structured JSON.
    """
    result = await run_ocr(file)
    return {"result": result}

@router.post("/extract-region")
async def extract_text_region(file: UploadFile = File(...)):
    """
    Run OCR on an uploaded file and return extracted text and average confidence.
    """
    result = await run_ocr(file)
    text = []
    confidences = []
    for page in result["pages"]:
        for block in page["blocks"]:
            for line in block["lines"]:
                line_text = " ".join([word["value"] for word in line["words"]])
                text.append(line_text)
                for word in line["words"]:
                    if "confidence" in word:
                        confidences.append(word["confidence"])
    avg_conf = float(sum(confidences) / len(confidences)) if confidences else 0.0
    return {"text": "\n".join(text), "confidence": avg_conf}

@router.post("/extract-metadata")
async def extract_metadata_from_image(file: UploadFile = File(...)):
    """
    Extract metadata from an image using OCR.
    Returns both the full extracted text and the structured OCR layer.
    """
    # Read image bytes
    content = await file.read()
    # Use the loaded OCR model from app state
    doc = DocumentFile.from_images([content])
    result = ocr_model(doc)
    exported = result.export()

    # Aggregate all text lines for convenience
    full_text = []
    for page in exported["pages"]:
        for block in page.get("blocks", []):
            for line in block.get("lines", []):
                line_text = " ".join([word["value"] for word in line.get("words", [])])
                full_text.append(line_text)
    plain_text = "\n".join(full_text)

    return {
        "text": plain_text,
        "ocr_layer": exported
    }

@router.post("/search")
async def search_text(file: UploadFile, query: str):
    """
    Run OCR and search for a word in the extracted text.
    """
    result = await run_ocr(file)
    matches = await search_word(result, query)
    return {"matches": matches}
