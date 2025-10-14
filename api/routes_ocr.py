# app/routers/ocr_router.py
from fastapi import APIRouter, UploadFile, File, Query
from services.ocr_service import (
    run_ocr,
    extract_on_document,
    search_word,
    collect_all_pages
)
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter()


class SearchRequest(BaseModel):
    file_path: str
    query: str



@router.post("/run-ocr-on-document-upload")
async def run_ocr_document_upload(file: UploadFile = File(...)):
    content = await file.read()
    doc, exported = extract_on_document(content)
    return {"pages": exported["pages"]}

@router.post("/search-word")
def search_word_endpoint(request: SearchRequest):
    doc, exported = extract_on_document(request.file_path)
    matches = []
    # search_word is async, but not awaited in your code; make it sync for router or use asyncio.run
    import asyncio
    matches = asyncio.run(search_word(exported, request.query))
    return {"matches": matches}

# @router.post("/ocr-and-visualize")
# async def ocr_and_visualize_endpoint(file: UploadFile = File(...), search_query: Optional[str] = None):
#     content = await file.read()
#     doc, exported = extract_on_document(content)
#     output = []
#     for page_idx, page_dict in enumerate(exported["pages"]):
#         lines = []
#         if "blocks" in page_dict:
#             for block in page_dict["blocks"]:
#                 if isinstance(block, dict) and "lines" in block:
#                     if isinstance(block, dict) and "lines" in block:
#                         for line in block["lines"]:
#                             words = line.get("words", []) if isinstance(line, dict) else []
#                             line_text = " ".join([word if isinstance(word, str) else word.get("value", "") for word in words])
#                             lines.append(line_text)
#         elif "text" in page_dict:
#             # Digital PDF: just use the text field
#             lines = page_dict["text"].splitlines()
#         output.append({"page": page_idx + 1, "lines": lines})
#     search_results = None
#     if search_query:
#         import asyncio
#         search_results = await search_word(exported, search_query)
#     return {"pages": output, "search_results": search_results}

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

@router.post("/search")
async def search_text(file: UploadFile, query: str):
    """
    Run OCR and search for a word in the extracted text.
    """
    result = await run_ocr(file)
    matches = await search_word(result, query)
    return {"matches": matches}
