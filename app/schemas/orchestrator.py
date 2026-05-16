# app/schemas/orchestrator.py
"""
Orchestrator Pipeline Schemas

Pydantic models for the multi-agent hub-and-spoke orchestration pipeline.
Covers inbound request validation, per-agent response typing, and the
consolidated response envelope returned to the Next.js frontend.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────
# Inbound Request
# ─────────────────────────────────────────────────────────────

class LeadProcessRequest(BaseModel):
    """Payload accepted by POST /api/process_lead."""

    company_name: str = Field(
        ...,
        min_length=1,
        max_length=256,
        description="Target company name for web intelligence gathering.",
        examples=["Acme Corp"],
    )
    email_thread: str = Field(
        ...,
        min_length=1,
        description="Raw email thread text for communications analysis.",
        examples=["From: john@acme.com\nSubject: Partnership ..."],
    )
    contract_text: str = Field(
        ...,
        min_length=1,
        description="Contract / document text for OCR-based extraction.",
        examples=["AGREEMENT dated 2026-01-01 between ..."],
    )


# ─────────────────────────────────────────────────────────────
# Individual Agent Responses
# ─────────────────────────────────────────────────────────────

class AgentResult(BaseModel):
    """Normalised wrapper for a single Supervity agent response."""

    agent_id: str
    agent_alias: str
    status: str = "success"
    latency_ms: float = 0.0
    payload: dict[str, Any] = Field(default_factory=dict)


# ─────────────────────────────────────────────────────────────
# System Command Enum
# ─────────────────────────────────────────────────────────────

class SystemCommand(str, Enum):
    """Routing commands emitted by the Governance Orchestrator."""

    ROUTE_TO_WORKBENCH = "ROUTE_TO_WORKBENCH"
    TRIGGER_SLACK_ESCALATION = "TRIGGER_SLACK_ESCALATION"
    ROUTE_TO_CRM_AUTO = "ROUTE_TO_CRM_AUTO"


# ─────────────────────────────────────────────────────────────
# Execution Trace (Observability)
# ─────────────────────────────────────────────────────────────

class ExecutionStep(BaseModel):
    """One step in the orchestration trace."""

    step: str
    agent: str
    status: str
    latency_ms: float
    timestamp: str


class ExecutionTrace(BaseModel):
    """Full trace of the orchestration pipeline."""

    total_latency_ms: float
    steps: list[ExecutionStep]


# ─────────────────────────────────────────────────────────────
# Routing Action Result
# ─────────────────────────────────────────────────────────────

class RoutingResult(BaseModel):
    """Outcome of the post-orchestration routing action."""

    command: str
    action_taken: str
    detail: str


# ─────────────────────────────────────────────────────────────
# Consolidated Response Envelope
# ─────────────────────────────────────────────────────────────

class LeadProcessResponse(BaseModel):
    """Consolidated response returned to the Next.js frontend."""

    success: bool = True
    orchestrator_decision: dict[str, Any] = Field(
        ...,
        description="Full output from the Governance Orchestrator (ORCH-01).",
    )
    unified_risk_score: Optional[float] = Field(
        None,
        description="Aggregated risk score from OP4 Risk Assessor (0-100).",
    )
    system_command: str = Field(
        ...,
        description="Routing directive issued by the Governance Orchestrator.",
    )
    routing_result: RoutingResult
    agent_results: dict[str, AgentResult] = Field(
        ...,
        description="Per-agent results keyed by alias (web_intel, comms_intel, etc.).",
    )
    trace: ExecutionTrace
    processed_at: str = Field(
        default_factory=lambda: datetime.utcnow().isoformat() + "Z",
    )
