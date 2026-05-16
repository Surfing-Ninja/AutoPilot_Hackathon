# app/routers/policies.py
"""
AI Policies Router - Mock endpoints for the CreateWithAI UI
"""

import logging
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

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
