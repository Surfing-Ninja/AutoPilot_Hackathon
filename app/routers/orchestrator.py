# app/routers/orchestrator.py
import json
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.execution_context import ExecutionContext
from app.models.workbench import WorkbenchItem
from app.models.audit import AuditLog, AuditSeverity, AuditCategory
from app.services.document_pipeline import process_document
from app.services.policy_engine import route_lead
from app.services.supervity import call_supervity_workflow

router = APIRouter(prefix="/api/orchestrate", tags=["Orchestration"])

@router.post("/lead")
async def orchestrate_lead(
    lead_data: str = Form(...),
    document: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Enterprise Orchestration Endpoint:
    1. Receives lead + PDF
    2. Stores ExecutionContext
    3. Runs OCR Document Pipeline
    4. Evaluates Policies
    5. Calls Supervity Workflow
    6. Tracks Audit Logs & Exceptions (Workbench)
    """
    try:
        lead_json = json.loads(lead_data)
        lead_id = lead_json.get("lead_id", "unknown_lead")
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid lead_data JSON")

    # 1. Store Execution Context
    exec_ctx = ExecutionContext(
        workflow_id="lead_processing_workflow",
        lead_id=lead_id,
        current_stage="received",
        status="running"
    )
    db.add(exec_ctx)
    db.commit()
    db.refresh(exec_ctx)

    try:
        # 2. Process Document (OCR + Intelligence)
        pdf_bytes = await document.read()
        ocr_result = process_document(pdf_bytes)
        
        # 3. Policy Engine Evaluation
        routing_decision = route_lead(ocr_result)
        
        exec_ctx.current_stage = "policy_evaluated"
        exec_ctx.shared_context_json = {"ocr_result": ocr_result, "routing": routing_decision}
        db.commit()

        # 4. Supervity Execution
        supervity_payload = {
            "lead_data": lead_json,
            "ocr_result": ocr_result,
            "routing_decision": routing_decision
        }
        
        supervity_response = await call_supervity_workflow(supervity_payload)
        
        # 5. Handle Exceptions / Human Routing
        if routing_decision["status"] == "human_review_required":
            workbench_item = WorkbenchItem(
                lead_id=lead_id,
                status="pending",
                data=supervity_payload
            )
            db.add(workbench_item)
            exec_ctx.status = "waiting_for_human"
            message = "Lead routed to human workbench due to risk policies."
        else:
            exec_ctx.status = "completed"
            message = "Lead processed successfully via Supervity."
            
        db.commit()
        
        # 6. Audit Logging
        audit_log = AuditLog(
            action="lead.orchestrate",
            category=AuditCategory.API,
            severity=AuditSeverity.INFO,
            description=message,
            extra_data={"lead_id": lead_id, "supervity_response": supervity_response, "routing": routing_decision}
        )
        db.add(audit_log)
        db.commit()
        
        return {
            "status": "success",
            "execution_id": exec_ctx.id,
            "message": message,
            "routing": routing_decision,
            "supervity_response": supervity_response
        }

    except Exception as e:
        exec_ctx.status = "failed"
        db.commit()
        
        audit_log = AuditLog(
            action="lead.orchestrate.error",
            category=AuditCategory.ERROR,
            severity=AuditSeverity.ERROR,
            description=f"Error processing lead: {str(e)}",
            extra_data={"lead_id": lead_id}
        )
        db.add(audit_log)
        db.commit()
        raise HTTPException(status_code=500, detail=str(e))
