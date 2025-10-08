# app/routers/ocr_router.py
from fastapi import APIRouter, UploadFile, File, Query
from services.ocr_service import (
    run_ocr,
    run_ocr_on_document,
    search_word,
    collect_all_pages
)
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter()


class SearchRequest(BaseModel):
    file_path: str
    query: str


@router.post("/run-ocr-on-document")
def run_ocr_document(file_path: str = Query(..., description="Path to image or PDF file")):
    """
    Run OCR on a document and return the extracted text and images.
    """
    doc, exported = run_ocr_on_document(file_path)
    return {"pages": exported["pages"]}

@router.post("/search-word")
def search_word_endpoint(request: SearchRequest):
    doc, exported = run_ocr_on_document(request.file_path)
    matches = []
    # search_word is async, but not awaited in your code; make it sync for router or use asyncio.run
    import asyncio
    matches = asyncio.run(search_word(exported, request.query))
    return {"matches": matches}

@router.post("/ocr-and-visualize")
async def ocr_and_visualize_endpoint(file: UploadFile = File(...), search_query: Optional[str] = None):
    content = await file.read()
    doc, exported = run_ocr_on_document(content)
    output = []
    for page_idx, page_dict in enumerate(exported["pages"]):
        lines = []
        for block in page_dict["blocks"]:
            for line in block["lines"]:
                line_text = " ".join([word["value"] for word in line["words"]])
                lines.append(line_text)
        output.append({"page": page_idx + 1, "lines": lines})
    search_results = None
    if search_query:
        import asyncio
        search_results = await search_word(exported, search_query)
    return {"pages": output, "search_results": search_results}

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

@router.post("/extract")
async def extract_text(file: UploadFile):
    """
    Run OCR on an uploaded file and return structured JSON.
    """
    result = await run_ocr(file)
    return {"result": result}

@router.post("/search")
async def search_text(file: UploadFile, query: str):
    """
    Run OCR and search for a word in the extracted text.
    """
    result = await run_ocr(file)
    matches = await search_word(result, query)
    return {"matches": matches}
