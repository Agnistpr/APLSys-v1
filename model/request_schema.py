from pydantic import BaseModel
from typing import Optional

class ResumeAnalysisRequest(BaseModel):
    resume: str
    job_role: Optional[str] = None
    job_description: Optional[str] = None
