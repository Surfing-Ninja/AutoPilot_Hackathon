# app/routers/policies.py
"""
AI Policies Router - Mock endpoints for the CreateWithAI UI
"""

import logging
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.orchestration import Policy

log = logging.getLogger(__name__)

router = APIRouter(prefix="/ai/policies", tags=["AI Policies"])

class AnalyzeRequest(BaseModel):
    input: str

class ConflictRequest(BaseModel):
    natural_language: str
    policy_scope: str = "base"
    entity_name: str | None = None

@router.post("/analyze-input")
async def analyze_input(req: AnalyzeRequest) -> dict[str, Any]:
    """Mock analysis endpoint for the UI"""
    log.info(f"Analyzing policy input: {req.input}")
    
    # Very basic mock logic
    return {
        "suggested_type": "logical",
        "confidence": 0.92,
        "reason": "Clear conditions and actions detected",
        "suggested_name": "Custom AI Policy",
        "summary": "Auto-generated from your input",
        "dsl": {
            "match_mode": "all",
            "conditions": [
                {"field": "risk_score", "operator": "gt", "value": 70}
            ],
            "actions": [
                {"type": "route_to_workbench", "value": "High Risk"}
            ]
        },
        "refined_instruction": "If risk score is greater than 70, route to workbench.",
        "entity_name": "Deal",
        "suggested_tags": ["custom", "ai-generated"]
    }

@router.post("/check-conflicts")
async def check_conflicts(req: ConflictRequest) -> dict[str, Any]:
    """Mock conflict check endpoint for the UI"""
    log.info(f"Checking conflicts for: {req.natural_language}")
    
    return {
        "conflicts": [],
        "overrides": [],
        "clarifications": ["Are there any exceptions to this rule?"],
        "suggested_instructions": [],
        "refined_instruction": req.natural_language,
        "is_valid": True,
        "warnings": []
    }

# =============================================================================
# Database CRUD Endpoints
# =============================================================================

class PolicyCreate(BaseModel):
    name: str
    description: str = ""
    natural_language: str
    policy_type: str = "logical"
    dsl: dict | None = None
    refined_instruction: str | None = None
    ai_instruction: str | None = None
    entity_name: str | None = None
    is_active: bool = True
    priority: int = 50
    tags: list[str] = []

class PolicyResponse(PolicyCreate):
    id: str
    execution_count: int
    created_at: Any
    updated_at: Any

    class Config:
        from_attributes = True

@router.get("/", response_model=List[PolicyResponse])
def get_policies(db: Session = Depends(get_db)):
    """Fetch all AI Policies from the database."""
    return db.query(Policy).order_by(Policy.created_at.desc()).all()

@router.post("/", response_model=PolicyResponse)
def create_policy(policy_in: PolicyCreate, db: Session = Depends(get_db)):
    """Create a new AI Policy."""
    db_policy = Policy(**policy_in.dict())
    db.add(db_policy)
    db.commit()
    db.refresh(db_policy)
    return db_policy

@router.delete("/{policy_id}")
def delete_policy(policy_id: str, db: Session = Depends(get_db)):
    """Delete an AI Policy."""
    db_policy = db.query(Policy).filter(Policy.id == policy_id).first()
    if not db_policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    db.delete(db_policy)
    db.commit()
    return {"status": "success"}

@router.put("/{policy_id}/status", response_model=PolicyResponse)
def toggle_policy_status(policy_id: str, is_active: bool, db: Session = Depends(get_db)):
    """Toggle the active status of an AI Policy."""
    db_policy = db.query(Policy).filter(Policy.id == policy_id).first()
    if not db_policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    db_policy.is_active = is_active
    db.commit()
    db.refresh(db_policy)
    return db_policy
