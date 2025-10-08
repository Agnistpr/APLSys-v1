from fastapi import APIRouter, Request
from pydantic import BaseModel
from services.parsing_service import parse_resume_text
router = APIRouter()

class ResumeParseRequest(BaseModel):
    text: str

@router.post("/parse-resume")
async def parse_resume(request: ResumeParseRequest, fastapi_req: Request):
    ner_parsing_pipeline = fastapi_req.app.state.ner_parsing_pipeline
    return parse_resume_text(request.text, ner_parsing_pipeline)
