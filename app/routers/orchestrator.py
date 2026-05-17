# app/routers/orchestrator.py
"""
POST /api/process_lead — Multi-Agent Hub-and-Spoke Orchestrator

Execution Flow
──────────────
1. Receive & validate the inbound lead payload.
2. Fire 3 parallel data-extraction calls via asyncio.gather:
     • OP-1  Web Intel        (company_name)
     • OP-2  Comms Intel      (email_thread)
     • OP-3  OCR / Doc Parse  (contract_text)
3. Aggregate results → send to OP-4 Risk Assessor.
4. Feed OP-4 output → ORCH-01 Governance Orchestrator (RAG policy).
5. Route on the returned system_command:
     ROUTE_TO_WORKBENCH        → mock DB insert
     TRIGGER_SLACK_ESCALATION  → console warning
     ROUTE_TO_CRM_AUTO         → mock CRM update
6. Return a consolidated JSON envelope with decision, risk score,
   routing result, per-agent payloads, and a full execution trace.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
import uuid
import httpx
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.audit import AuditLog
from app.models.orchestration import ExecutionContext, WorkbenchItem

from app.schemas.orchestrator import (
    AgentResult,
    ExecutionStep,
    ExecutionTrace,
    LeadProcessRequest,
    LeadProcessResponse,
    RoutingResult,
)
from app.services.supervity_client import execute_agent

log = logging.getLogger("orchestrator.pipeline")

router = APIRouter(prefix="/orchestrator", tags=["Orchestrator"])


# ─────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────

def _now_iso() -> str:
    """UTC timestamp in ISO-8601."""
    return datetime.utcnow().isoformat() + "Z"


async def _call_agent(
    alias: str,
    inputs: dict[str, Any],
) -> tuple[str, dict[str, Any], float]:
    """
    Wrapper that times an agent call and returns (alias, response, latency_ms).
    Exceptions are caught so asyncio.gather never short-circuits.
    """
    start = time.perf_counter()
    try:
        result = await execute_agent(alias, inputs)
    except Exception as exc:  # noqa: BLE001
        log.exception("Unhandled error calling agent '%s': %s", alias, exc)
        result = {"status": "error", "message": "API timeout"}

    latency_ms = round((time.perf_counter() - start) * 1_000, 2)
    return alias, result, latency_ms


def _build_agent_result(
    alias: str,
    label: str,
    response: dict[str, Any],
    latency_ms: float,
) -> AgentResult:
    """Normalise a raw Supervity response into an AgentResult."""
    from app.services.supervity_client import AGENT_IDS

    is_error = response.get("status") == "error"
    return AgentResult(
        agent_id=AGENT_IDS.get(alias, "unknown"),
        agent_alias=label,
        status="error" if is_error else "success",
        latency_ms=latency_ms,
        payload=response,
    )


# ─────────────────────────────────────────────────────────────
# ROUTING ACTIONS (Real Integrations)
# ─────────────────────────────────────────────────────────────

async def _route_to_workbench(orchestrator_output: dict[str, Any]) -> RoutingResult:
    """Insert a record into the Workbench table (handled in the main endpoint)."""
    ticket_id = str(uuid.uuid4())
    log.info(
        "📋 [WORKBENCH] Preparing ticket %s — lead requires manual review.",
        ticket_id,
    )
    return RoutingResult(
        command="ROUTE_TO_WORKBENCH",
        action_taken="workbench_insert",
        detail=f"Workbench ticket prepared for manual human-in-the-loop review.",
    )


async def _trigger_slack_escalation(orchestrator_output: dict[str, Any]) -> RoutingResult:
    """Fire a real Slack escalation alert using webhooks."""
    webhook_url = os.getenv("SLACK_WEBHOOK_URL")
    
    # Extract some useful info for the Slack message
    company = orchestrator_output.get("company_name", "Unknown Company")
    risk_score = orchestrator_output.get("risk_score", orchestrator_output.get("unified_risk_score", "N/A"))
    reason = orchestrator_output.get("reasoning", "High risk detected.")
    
    payload = {
        "text": f"🚨 *High-Risk Lead Escalated: {company}*\n"
                f"*Risk Score:* {risk_score}\n"
                f"*Reasoning:* {reason}"
    }

    if webhook_url:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(webhook_url, json=payload, timeout=5.0)
                resp.raise_for_status()
            
            log.warning("🚨 [SLACK ESCALATION] Sent to %s", company)
            return RoutingResult(
                command="TRIGGER_SLACK_ESCALATION",
                action_taken="slack_escalation_sent",
                detail="Slack escalation dispatched to configured webhook channel.",
            )
        except Exception as e:
            log.error("Failed to send Slack escalation: %s", e)
            return RoutingResult(
                command="TRIGGER_SLACK_ESCALATION",
                action_taken="slack_escalation_failed",
                detail=f"Failed to dispatch Slack escalation: {e}",
            )
    else:
        log.warning("🚨 [SLACK ESCALATION] Webhook URL not configured. Simulating escalation for %s.", company)
        return RoutingResult(
            command="TRIGGER_SLACK_ESCALATION",
            action_taken="slack_escalation_simulated",
            detail="Slack escalation simulated (SLACK_WEBHOOK_URL not set).",
        )


async def _route_to_crm_auto(orchestrator_output: dict[str, Any]) -> RoutingResult:
    """Auto-update CRM with a successful lead conversion via API push.
    
    Supports two modes:
    - If CRM_API_URL is a Slack webhook, sends a formatted Slack message.
    - If CRM_API_URL is a standard REST API, sends JSON with Bearer auth.
    """
    crm_url = os.getenv("CRM_API_URL")
    crm_key = os.getenv("CRM_API_KEY", "")
    
    company = orchestrator_output.get("company_name", "Unknown Company")
    risk_score = orchestrator_output.get("risk_score", orchestrator_output.get("unified_risk_score", "N/A"))
    reasoning = orchestrator_output.get("reasoning", "Lead qualified by AI pipeline.")

    if not crm_url:
        crm_record_id = str(uuid.uuid4())
        log.info("✅ [CRM] Auto-routed lead %s (Simulated) → CRM record %s.", company, crm_record_id)
        return RoutingResult(
            command="ROUTE_TO_CRM_AUTO",
            action_taken="crm_auto_update_simulated",
            detail=f"CRM update simulated (CRM_API_URL not set). Assigned mock ID: {crm_record_id}",
        )

    # Detect if CRM_API_URL is actually a Slack webhook
    is_slack_webhook = "hooks.slack.com" in crm_url

    try:
        async with httpx.AsyncClient() as client:
            if is_slack_webhook:
                # Format a rich Slack message for CRM-style notifications
                slack_payload = {
                    "text": (
                        f"✅ *CRM Auto-Update: {company}*\n"
                        f"*Status:* Qualified Lead\n"
                        f"*Risk Score:* {risk_score}\n"
                        f"*Reasoning:* {reasoning}\n"
                        f"*Source:* AutoPilot AI Orchestrator\n"
                        f"*Timestamp:* {_now_iso()}"
                    )
                }
                resp = await client.post(crm_url, json=slack_payload, timeout=5.0)
            else:
                # Standard REST CRM API call
                crm_payload = {
                    "lead_source": "AutoPilot Orchestrator",
                    "company_name": company,
                    "status": "Qualified",
                    "risk_score": risk_score,
                    "reasoning": reasoning,
                    "orchestrator_data": orchestrator_output,
                }
                headers = {"Authorization": f"Bearer {crm_key}"} if crm_key else {}
                resp = await client.post(crm_url, json=crm_payload, headers=headers, timeout=5.0)
            
            resp.raise_for_status()
        
        target = "Slack CRM channel" if is_slack_webhook else "CRM API"
        log.info("✅ [CRM] Auto-routed lead %s to %s successfully.", company, target)
        return RoutingResult(
            command="ROUTE_TO_CRM_AUTO",
            action_taken="crm_auto_update",
            detail=f"CRM record dispatched to {target} successfully.",
        )
    except Exception as e:
        log.error("Failed to update CRM for %s: %s", company, e)
        return RoutingResult(
            command="ROUTE_TO_CRM_AUTO",
            action_taken="crm_update_failed",
            detail=f"Failed to update CRM: {e}",
        )


_ROUTING_TABLE: dict[str, Any] = {
    "ROUTE_TO_WORKBENCH": _route_to_workbench,
    "TRIGGER_SLACK_ESCALATION": _trigger_slack_escalation,
    "ROUTE_TO_CRM_AUTO": _route_to_crm_auto,
}


# ─────────────────────────────────────────────────────────────
# MAIN ENDPOINT
# ─────────────────────────────────────────────────────────────

@router.post(
    "/process_lead",
    response_model=LeadProcessResponse,
    status_code=status.HTTP_200_OK,
    summary="Multi-Agent Lead Processing Pipeline",
    description=(
        "Orchestrates 5 Supervity AI agents in a hub-and-spoke pattern to "
        "extract intelligence, assess risk, enforce governance policies, "
        "and route the lead to the appropriate downstream system."
    ),
)
async def process_lead(
    payload: LeadProcessRequest,
    db: Session = Depends(get_db)
) -> LeadProcessResponse:
    """
    Full orchestration pipeline:
      Parallel extraction → Risk synthesis → Governance → Routing
    """
    pipeline_start = time.perf_counter()
    trace_steps: list[ExecutionStep] = []
    agent_results: dict[str, AgentResult] = {}

    log.info(
        "━━━ Pipeline START for company='%s' ━━━",
        payload.company_name,
    )

    # ── STEP 1 — Parallel Data Extraction (OP1 + OP2 + OP3) ─────────

    extraction_tasks = [
        _call_agent("web_intel", {"company_name": payload.company_name}),
        _call_agent("comms_intel", {"email_thread": payload.email_thread}),
        _call_agent("ocr_doc", {"contract_text": payload.contract_text}),
    ]

    (web_alias, web_resp, web_ms), \
    (comms_alias, comms_resp, comms_ms), \
    (ocr_alias, ocr_resp, ocr_ms) = await asyncio.gather(*extraction_tasks)

    # Build normalised agent results
    agent_results["web_intel"] = _build_agent_result(
        "web_intel", "OP-1 Web Intel", web_resp, web_ms,
    )
    agent_results["comms_intel"] = _build_agent_result(
        "comms_intel", "OP-2 Comms Intel", comms_resp, comms_ms,
    )
    agent_results["ocr_doc"] = _build_agent_result(
        "ocr_doc", "OP-3 OCR/Doc Parse", ocr_resp, ocr_ms,
    )

    # Trace entries for the parallel phase
    for alias, label, ms in [
        ("web_intel", "OP-1 Web Intel", web_ms),
        ("comms_intel", "OP-2 Comms Intel", comms_ms),
        ("ocr_doc", "OP-3 OCR/Doc Parse", ocr_ms),
    ]:
        trace_steps.append(ExecutionStep(
            step="parallel_extraction",
            agent=label,
            status=agent_results[alias].status,
            latency_ms=ms,
            timestamp=_now_iso(),
        ))

    log.info(
        "✔ Parallel extraction complete — Web=%.0fms  Comms=%.0fms  OCR=%.0fms",
        web_ms, comms_ms, ocr_ms,
    )

    # ── STEP 2 — Risk Synthesis (OP4) ────────────────────────────────

    aggregated_intel: dict[str, Any] = {
        "company_name": payload.company_name,
        "web_intel": web_resp,
        "comms_intel": comms_resp,
        "ocr_doc_intel": ocr_resp,
    }

    risk_alias, risk_resp, risk_ms = await _call_agent(
        "risk_assessor", aggregated_intel,
    )

    agent_results["risk_assessor"] = _build_agent_result(
        "risk_assessor", "OP-4 Risk Assessor", risk_resp, risk_ms,
    )
    trace_steps.append(ExecutionStep(
        step="risk_synthesis",
        agent="OP-4 Risk Assessor",
        status=agent_results["risk_assessor"].status,
        latency_ms=risk_ms,
        timestamp=_now_iso(),
    ))

    log.info("✔ Risk assessment complete — %.0f ms", risk_ms)

    # ── STEP 3 — Governance Orchestration (ORCH-01) ──────────────────

    governance_input: dict[str, Any] = {
        "company_name": payload.company_name,
        "risk_assessment": risk_resp,
        "extraction_summary": {
            "web_intel": web_resp,
            "comms_intel": comms_resp,
            "ocr_doc_intel": ocr_resp,
        },
    }

    gov_alias, gov_resp, gov_ms = await _call_agent(
        "governance", governance_input,
    )

    agent_results["governance"] = _build_agent_result(
        "governance", "ORCH-01 Governance", gov_resp, gov_ms,
    )
    trace_steps.append(ExecutionStep(
        step="governance_orchestration",
        agent="ORCH-01 Governance",
        status=agent_results["governance"].status,
        latency_ms=gov_ms,
        timestamp=_now_iso(),
    ))

    log.info("✔ Governance orchestration complete — %.0f ms", gov_ms)

    # ── STEP 4 — Extract system_command & route ──────────────────────

    system_command: str = (
        gov_resp.get("system_command")
        or gov_resp.get("systemCommand")
        or gov_resp.get("command")
        or "ROUTE_TO_WORKBENCH"  # safe default
    )
    # Normalise to upper-case to match our enum
    system_command = system_command.strip().upper()

    route_fn = _ROUTING_TABLE.get(system_command, _route_to_workbench)
    routing_result: RoutingResult = await route_fn(gov_resp)

    trace_steps.append(ExecutionStep(
        step="routing",
        agent="system",
        status="executed",
        latency_ms=0.0,
        timestamp=_now_iso(),
    ))

    # ── STEP 5 — Build response envelope ─────────────────────────────

    total_ms = round((time.perf_counter() - pipeline_start) * 1_000, 2)

    # Try to extract a numeric risk score from OP4
    unified_risk: float | None = None
    for key in ("risk_score", "riskScore", "unified_risk_score", "score"):
        val = risk_resp.get(key)
        if val is not None:
            try:
                unified_risk = float(val)
            except (TypeError, ValueError):
                pass
            break

    response = LeadProcessResponse(
        success=True,
        orchestrator_decision=gov_resp,
        unified_risk_score=unified_risk,
        system_command=system_command,
        routing_result=routing_result,
        agent_results=agent_results,
        trace=ExecutionTrace(
            total_latency_ms=total_ms,
            steps=trace_steps,
        ),
    )

    log.info(
        "━━━ Pipeline COMPLETE for company='%s' — %s — %.0f ms total ━━━",
        payload.company_name,
        system_command,
        total_ms,
    )

    # ── STEP 6 — Persist to Database ─────────────────────────────────
    context_id = str(uuid.uuid4())
    db_ctx = ExecutionContext(
        id=context_id,
        company_name=payload.company_name,
        system_command=system_command,
        unified_risk_score=unified_risk,
        trace=response.trace.model_dump(mode="json"),
        agent_results={k: v.model_dump(mode="json") for k, v in agent_results.items()},
    )
    db.add(db_ctx)

    if system_command == "ROUTE_TO_WORKBENCH":
        # Extract metadata from agent results
        missing_fields = []
        if "ocr_doc" in agent_results:
            missing_fields = agent_results["ocr_doc"].payload.get("extraction", {}).get("missing_fields", [])
        
        risk_factors = risk_resp.get("risk_factors", [])
        if not isinstance(risk_factors, list):
            risk_factors = [risk_factors] if risk_factors else []

        wb_item = WorkbenchItem(
            execution_context_id=context_id,
            company_name=payload.company_name,
            risk_factors=risk_factors,
            missing_fields=missing_fields,
            status="pending"
        )
        db.add(wb_item)

    db.commit()

    return response

# ─────────────────────────────────────────────────────────────
# WORKBENCH ENDPOINTS
# ─────────────────────────────────────────────────────────────

@router.get("/workbench-items")
def list_workbench_items(
    status_filter: str | None = None,
    db: Session = Depends(get_db),
):
    """Fetch workbench items for the exception queue.
    
    Query params:
        status_filter: 'pending', 'approved', 'rejected', or None for all.
    """
    query = db.query(WorkbenchItem).order_by(WorkbenchItem.created_at.desc())
    if status_filter:
        query = query.filter(WorkbenchItem.status == status_filter)
    
    items = query.all()
    
    result = []
    for item in items:
        ctx = item.execution_context
        ctx_data = {}
        if ctx:
            ctx_data = {
                "system_command": ctx.system_command,
                "unified_risk_score": ctx.unified_risk_score,
                "agent_results": ctx.agent_results,
                "trace": ctx.trace,
            }
        result.append({
            "id": item.id,
            "company_name": item.company_name,
            "status": item.status,
            "risk_factors": item.risk_factors or [],
            "missing_fields": item.missing_fields or [],
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "resolved_at": item.resolved_at.isoformat() if item.resolved_at else None,
            "orchestratorResult": ctx_data,
        })
    return result


async def _notify_slack_workbench_action(company: str, action: str, risk_score: float | None = None):
    """Send a Slack notification when a workbench item is approved or rejected."""
    webhook_url = os.getenv("SLACK_WEBHOOK_URL")
    if not webhook_url:
        return
    
    emoji = "✅" if action == "approved" else "❌"
    payload = {
        "text": (
            f"{emoji} *Workbench Item {action.upper()}: {company}*\n"
            f"*Risk Score:* {risk_score or 'N/A'}\n"
            f"*Action:* Human reviewer {action} this item.\n"
            f"*Timestamp:* {_now_iso()}"
        )
    }
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(webhook_url, json=payload, timeout=5.0)
            resp.raise_for_status()
        log.info("📤 [SLACK] Workbench %s notification sent for %s", action, company)
    except Exception as e:
        log.error("Failed to send Slack workbench notification: %s", e)


@router.post("/workbench-items/{item_id}/approve")
async def approve_workbench_item(item_id: str, db: Session = Depends(get_db)):
    """Approve a workbench item and notify Slack."""
    item = db.query(WorkbenchItem).filter(WorkbenchItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    item.status = "approved"
    item.resolved_at = datetime.utcnow()
    db.commit()

    # Get risk score from execution context
    risk_score = item.execution_context.unified_risk_score if item.execution_context else None
    await _notify_slack_workbench_action(item.company_name, "approved", risk_score)
    
    return {"success": True, "message": f"{item.company_name} approved successfully"}


@router.post("/workbench-items/{item_id}/reject")
async def reject_workbench_item(item_id: str, db: Session = Depends(get_db)):
    """Reject/dismiss a workbench item and notify Slack."""
    item = db.query(WorkbenchItem).filter(WorkbenchItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    item.status = "rejected"
    item.resolved_at = datetime.utcnow()
    db.commit()

    risk_score = item.execution_context.unified_risk_score if item.execution_context else None
    await _notify_slack_workbench_action(item.company_name, "rejected", risk_score)
    
    return {"success": True, "message": f"{item.company_name} rejected and dismissed"}


@router.delete("/workbench-items/{item_id}")
async def delete_workbench_item(item_id: str, db: Session = Depends(get_db)):
    """Permanently delete a workbench item."""
    item = db.query(WorkbenchItem).filter(WorkbenchItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    company = item.company_name
    db.delete(item)
    db.commit()
    
    return {"success": True, "message": f"{company} removed from workbench"}

# ─────────────────────────────────────────────────────────────
# SYSTEM DIAGNOSTICS
# ─────────────────────────────────────────────────────────────

@router.get("/diagnostics")
def run_diagnostics(db: Session = Depends(get_db)):
    """
    Run real system diagnostics:
    - Database connectivity & table row counts
    - Supervity agent configuration status
    - Execution history summary
    """
    from app.services.supervity_client import AGENT_IDS, SUPERVITY_EXECUTE_URL
    from sqlalchemy import text

    checks: list[dict[str, Any]] = []

    # ── Database Connectivity ──
    try:
        db.execute(text("SELECT 1"))
        checks.append({
            "name": "PostgreSQL Connection",
            "status": "healthy",
            "detail": "Database connection pool active",
        })
    except Exception as exc:
        checks.append({
            "name": "PostgreSQL Connection",
            "status": "error",
            "detail": str(exc),
        })

    # ── Table Row Counts ──
    try:

        audit_count = db.execute(text("SELECT COUNT(*) FROM audit_logs")).scalar() or 0
        exec_count = db.execute(text("SELECT COUNT(*) FROM execution_contexts")).scalar() or 0
        wb_count = db.execute(text("SELECT COUNT(*) FROM workbench_items")).scalar() or 0

        checks.append({
            "name": "Audit Logs Table",
            "status": "healthy",
            "detail": f"{audit_count} records",
            "count": audit_count,
        })
        checks.append({
            "name": "Execution Contexts",
            "status": "healthy",
            "detail": f"{exec_count} pipeline runs stored",
            "count": exec_count,
        })
        checks.append({
            "name": "Workbench Items",
            "status": "healthy",
            "detail": f"{wb_count} items queued",
            "count": wb_count,
        })
    except Exception as exc:
        checks.append({
            "name": "Table Stats",
            "status": "error",
            "detail": str(exc),
        })

    # ── Supervity Agent Config ──
    supervity_ok = bool(SUPERVITY_EXECUTE_URL)
    agents_configured = sum(1 for v in AGENT_IDS.values() if v)
    checks.append({
        "name": "Supervity API Endpoint",
        "status": "healthy" if supervity_ok else "warning",
        "detail": SUPERVITY_EXECUTE_URL[:60] + "…" if supervity_ok else "Not configured — using fallback responses",
    })
    checks.append({
        "name": "AI Agent Workflows",
        "status": "healthy" if agents_configured == len(AGENT_IDS) else "warning",
        "detail": f"{agents_configured}/{len(AGENT_IDS)} agents configured",
        "count": agents_configured,
    })

    # ── Slack Integration ──
    slack_url = os.getenv("SLACK_WEBHOOK_URL")
    if slack_url:
        checks.append({
            "name": "Slack Integration",
            "status": "healthy",
            "detail": "Webhook configured — live escalations enabled",
        })
    else:
        checks.append({
            "name": "Slack Integration",
            "status": "warning",
            "detail": "SLACK_WEBHOOK_URL not set — escalations will be simulated",
        })

    # ── CRM Integration ──
    crm_url = os.getenv("CRM_API_URL")
    if crm_url:
        is_slack = "hooks.slack.com" in crm_url
        mode = "Slack webhook (CRM channel)" if is_slack else "REST API"
        checks.append({
            "name": "CRM Integration",
            "status": "healthy",
            "detail": f"Connected via {mode}",
        })
    else:
        checks.append({
            "name": "CRM Integration",
            "status": "warning",
            "detail": "CRM_API_URL not set — CRM updates will be simulated",
        })

    # ── Latest Pipeline Run ──
    try:
        latest = (
            db.query(ExecutionContext)
            .order_by(ExecutionContext.created_at.desc())
            .first()
        )
        if latest:
            checks.append({
                "name": "Last Pipeline Run",
                "status": "healthy",
                "detail": f"{latest.company_name} — {latest.system_command}",
                "timestamp": latest.created_at.isoformat() if latest.created_at else None,
            })
        else:
            checks.append({
                "name": "Last Pipeline Run",
                "status": "info",
                "detail": "No pipelines executed yet",
            })
    except Exception:
        pass

    overall = "healthy"
    if any(c["status"] == "error" for c in checks):
        overall = "error"
    elif any(c["status"] == "warning" for c in checks):
        overall = "warning"

    return {
        "overall": overall,
        "checks": checks,
        "timestamp": _now_iso(),
    }


# ─────────────────────────────────────────────────────────────
# AUDIT LOGS (Dashboard-facing — no admin session required)
# ─────────────────────────────────────────────────────────────

@router.get("/audit-logs")
def get_recent_audit_logs(
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """
    Fetch recent audit logs for the dashboard.
    Returns the latest N audit log entries.
    """
    from sqlalchemy import desc

    logs = (
        db.query(AuditLog)
        .order_by(desc(AuditLog.timestamp))
        .limit(min(limit, 100))
        .all()
    )

    return {
        "total": db.query(AuditLog).count(),
        "logs": [
            {
                "id": log.id,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                "actor_email": log.actor_email,
                "actor_ip": log.actor_ip,
                "action": log.action,
                "category": log.category,
                "severity": log.severity,
                "description": log.description,
                "success": log.success,
                "error_message": log.error_message,
                "endpoint": log.endpoint,
                "http_method": log.http_method,
                "response_status": log.response_status,
                "response_time_ms": round(log.response_time_ms, 2) if log.response_time_ms else None,
                "is_middleware": log.is_middleware,
            }
            for log in logs
        ],
    }
