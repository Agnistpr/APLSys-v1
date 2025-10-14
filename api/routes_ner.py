from fastapi import APIRouter, Request
from pydantic import BaseModel
from services.parsing_service import lbl_resume_text
router = APIRouter()

class ResumeParseRequest(BaseModel):
    text: str

@router.post("/label-tokens")
async def label_tokens_resume(request: ResumeParseRequest, fastapi_req: Request):
    ner_resume_pipeline = fastapi_req.app.state.ner_resume_pipeline
    return lbl_resume_text(request.text, ner_resume_pipeline)
