from pydantic import BaseModel
from typing import Optional

class Lead(BaseModel):
    company_name: str
    company_domain: str
    lead_email: str
    workflow_id: Optional[str] = None
