# app/services/policy_engine.py

def evaluate_risk_policy(risk_score: int, risks_detected: list) -> bool:
    """
    Evaluates the execution state to determine if human review is required.
    In a real enterprise setup, this would load rules dynamically from PostgreSQL.
    """
    if risk_score > 80:
        return True
    
    if len(risks_detected) > 0:
        return True
        
    return False

def route_lead(execution_state: dict) -> dict:
    """
    Evaluates the lead data and OCR risks, and routes accordingly.
    """
    risks = execution_state.get('risks_detected', [])
    risk_score = len(risks) * 25
    
    requires_human_review = evaluate_risk_policy(risk_score, risks)
    
    return {
        "status": "human_review_required" if requires_human_review else "auto_approved",
        "risk_score": risk_score,
        "risks": risks
    }
