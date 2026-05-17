# app/routers/ai.py
"""
AI Chat Assistant Router

Provides the /api/ai/chat endpoint which:
- Receives user messages, conversation history, and active page context.
- Directly queries the live PostgreSQL database for real-time metrics (activity logs, exceptions, stats).
- Dynamically responds with beautiful, premium-styled markdown tailored to the user's intent and page.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.orchestration import ExecutionContext, WorkbenchItem
from app.models.settings import Settings

log = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI Assistant"])

# =============================================================================
# Pydantic Schemas
# =============================================================================

class ChatHistoryMessage(BaseModel):
    role: str
    content: str

class ChatContext(BaseModel):
    page: Optional[str] = None

class ChatRequest(BaseModel):
    message: str
    history: List[ChatHistoryMessage] = []
    context: Optional[ChatContext] = None

class ToolCallResponse(BaseModel):
    id: str
    name: str
    args: Dict[str, Any]
    result: Optional[Any] = None

class ChatResponse(BaseModel):
    response: str
    tool_calls: Optional[List[ToolCallResponse]] = None

# =============================================================================
# Helpers
# =============================================================================

def format_relative_time(dt: datetime) -> str:
    """Format datetime as a relative age string."""
    now = datetime.utcnow()
    diff = now - dt
    
    seconds = diff.total_seconds()
    if seconds < 60:
        return "just now"
    minutes = seconds / 60
    if minutes < 60:
        return f"{int(minutes)}m ago"
    hours = minutes / 60
    if hours < 24:
        return f"{int(hours)}h ago"
    days = hours / 24
    return f"{int(days)}d ago"

# =============================================================================
# Endpoint Handler
# =============================================================================

@router.post("/chat", response_model=ChatResponse)
async def chat_assistant(
    req: ChatRequest,
    db: Session = Depends(get_db)
) -> ChatResponse:
    """
    Intelligent chatbot assistant that handles UI quick actions, page explanations,
    and runs real-time SQL aggregation to answer system activity queries.
    """
    msg = req.message.strip().lower()
    page_ctx = req.context.page if req.context else None
    
    log.info(f"AI Assistant received message: '{req.message}' [Page: {page_ctx}]")
    
    tool_calls = []

    # 1. INTENT: Capabilities / Help / What can you do
    if any(k in msg for k in ["help", "what can you", "capabilities", "features", "options"]):
        response_text = (
            "### 🤖 AutoPilot AI Command Center Assistant\n\n"
            "I am your central intelligent assistant, fully connected to the application ecosystem. "
            "I can query live database telemetry, summarize logs, and guide you through operations:\n\n"
            "* **📈 Live Activity & Logs**: Ask me to *\"show recent activity\"* or *\"show logs\"* to extract "
            "the latest multi-agent validation runs directly from the database.\n"
            "* **📋 Workbench Exception Status**: Ask *\"what's in the exception queue?\"* or *\"show workbench\"* "
            "to check active, pending reviews flagged by governance.\n"
            "* **📊 Analytics & Performance**: Ask me to *\"generate a report\"* to run direct SQL calculations on "
            "total volume, average risk scores, and automatic routing percentages.\n"
            "* **🛡️ Policy & Governance Guide**: Ask *\"how do I create a policy?\"* to get customized policy templates "
            "and instructions on setting up new system boundaries.\n"
            "* **🔍 Page Explanation**: Ask *\"explain this page\"* or *\"where am i?\"* and I will analyze the frontend "
            "location to describe key metrics cards, lists, and actionable features."
        )

    # 2. INTENT: Show recent activity / logs
    elif any(k in msg for k in ["activity", "logs", "recent pipeline", "executions", "runs"]):
        tool_calls.append(ToolCallResponse(
            id=str(uuid.uuid4())[:8],
            name="query_execution_logs",
            args={"limit": 5}
        ))
        
        try:
            recent_runs = db.query(ExecutionContext).order_by(ExecutionContext.created_at.desc()).limit(5).all()
            total_runs = db.query(ExecutionContext).count()
            
            if not recent_runs:
                response_text = (
                    "### 📈 Recent Pipeline Activity\n\n"
                    "No execution pipelines have run yet in this workspace. "
                    "To kick off operations, trigger a lead processing run via the backend or UI!"
                )
            else:
                table_rows = []
                for run in recent_runs:
                    score_str = f"**{run.unified_risk_score}**" if run.unified_risk_score is not None else "*N/A*"
                    cmd_badge = f"`{run.system_command}`"
                    time_str = run.created_at.strftime("%Y-%m-%d %H:%M")
                    table_rows.append(
                        f"| **{run.company_name}** | {score_str} | {cmd_badge} | {time_str} | `{run.id[:8]}` |"
                    )
                
                table_content = "\n".join(table_rows)
                response_text = (
                    f"### 📈 Recent Pipeline Activity (Live Telemetry)\n\n"
                    f"I found **{total_runs}** total validation run(s) in the database. "
                    f"Here are the last 5 executions:\n\n"
                    f"| Target Company | Risk Score | Routing Decision | Timestamp | Execution ID |\n"
                    f"| :--- | :---: | :--- | :--- | :--- |\n"
                    f"{table_content}\n\n"
                    f"💡 *Tip: If you see high risk scores routed to `ROUTE_TO_WORKBENCH`, they will appear in your exception queue.*"
                )
        except Exception as e:
            log.error(f"Error querying execution contexts: {e}")
            response_text = "I apologize, but I encountered a database connection issue when loading recent activity logs."

    # 3. INTENT: Generate Report / System Analytics
    elif any(k in msg for k in ["report", "analytics", "statistics", "stats", "summary"]):
        tool_calls.append(ToolCallResponse(
            id=str(uuid.uuid4())[:8],
            name="aggregate_db_analytics",
            args={}
        ))
        
        try:
            total_leads = db.query(ExecutionContext).count()
            avg_score_res = db.query(func.avg(ExecutionContext.unified_risk_score)).scalar()
            avg_score = round(avg_score_res, 1) if avg_score_res is not None else 0.0
            
            workbench_count = db.query(ExecutionContext).filter(ExecutionContext.system_command == 'ROUTE_TO_WORKBENCH').count()
            crm_count = db.query(ExecutionContext).filter(ExecutionContext.system_command == 'ROUTE_TO_CRM_AUTO').count()
            slack_count = db.query(ExecutionContext).filter(ExecutionContext.system_command == 'TRIGGER_SLACK_ESCALATION').count()
            pending_wb = db.query(WorkbenchItem).filter(WorkbenchItem.status == 'pending').count()
            
            # Percentages
            wb_pct = round((workbench_count / total_leads * 100), 1) if total_leads > 0 else 0.0
            crm_pct = round((crm_count / total_leads * 100), 1) if total_leads > 0 else 0.0
            slack_pct = round((slack_count / total_leads * 100), 1) if total_leads > 0 else 0.0
            
            response_text = (
                "### 📊 RevOps Pipeline Performance Report\n\n"
                "I have compiled an aggregated operational summary from the database:\n\n"
                f"* **Total Leads Validated**: `{total_leads}`\n"
                f"* **Average Unified Risk Score**: `{avg_score}`/100\n"
                f"* **Exception Rate (Workbench)**: `{workbench_count}` ({wb_pct}%)\n"
                f"* **Auto-Qualified (CRM Routing)**: `{crm_count}` ({crm_pct}%)\n"
                f"* **Management Escalations (Slack)**: `{slack_count}` ({slack_pct}%)\n"
                f"* **Active Pending Reviews**: `{pending_wb}` items awaiting manual approval.\n\n"
                "#### 🔍 Quick Executive Takeaway\n"
            )
            
            if total_leads == 0:
                response_text += "No records found. Run some test payloads to trigger analytical summaries!"
            elif avg_score > 60:
                response_text += (
                    "> [!WARNING]\n"
                    "> **System status is HIGH RISK.** The overall risk profile of leads is currently elevated, "
                    f"resulting in a high manual audit rate ({wb_pct}%). Ensure procurement checks the Workbench exception queue."
                )
            else:
                response_text += (
                    "> [!NOTE]\n"
                    "> **System status is STABLE.** Leads are flowing through healthy pathways, "
                    f"with {crm_pct}% qualifying for auto-CRM insertions and minor human-in-the-loop dependencies."
                )
                
        except Exception as e:
            log.error(f"Error computing report statistics: {e}")
            response_text = "I encountered an error analyzing system metrics. Let's make sure the database is up."

    # 4. INTENT: Workbench status / Pending exceptions
    elif any(k in msg for k in ["workbench", "exception queue", "exception", "pending", "queue", "flagged"]):
        tool_calls.append(ToolCallResponse(
            id=str(uuid.uuid4())[:8],
            name="query_workbench_items",
            args={"status": "pending"}
        ))
        
        try:
            pending_items = db.query(WorkbenchItem).filter(WorkbenchItem.status == 'pending').order_by(WorkbenchItem.created_at.desc()).all()
            
            if not pending_items:
                response_text = (
                    "### 📋 Workbench Exception Queue\n\n"
                    "Good news! **0 active reviews** are pending. The queue is clean."
                )
            else:
                rows = []
                for item in pending_items:
                    factors = ", ".join(item.risk_factors) if item.risk_factors else "None flagged"
                    fields = ", ".join(item.missing_fields) if item.missing_fields else "None"
                    age = format_relative_time(item.created_at)
                    rows.append(
                        f"| **{item.company_name}** | {factors} | *{fields}* | {age} |"
                    )
                
                table_body = "\n".join(rows)
                response_text = (
                    f"### 📋 Pending Exception Review Queue ({len(pending_items)} open ticket(s))\n\n"
                    f"Here is the list of active deals requiring manual operational approval:\n\n"
                    f"| Company Name | Risk Factors Identified | Missing Fields | Age |\n"
                    f"| :--- | :--- | :--- | :--- |\n"
                    f"{table_body}\n\n"
                    f"👉 *Action required: Go to the **Workbench** page to click 'Review' and manually approve or reject these items.*"
                )
        except Exception as e:
            log.error(f"Error loading workbench: {e}")
            response_text = "I was unable to load the exceptions queue from the database. Let's try again."

    # 5. INTENT: How to create a policy / Policy template
    elif any(k in msg for k in ["policy", "policies", "create policy", "governance rule", "rule"]):
        response_text = (
            "### 🛡️ Creating AI Policies & Governance Rules\n\n"
            "The system operates on **hybrid business rules** to govern risk assessment:\n"
            "1. **Structured Rules**: Condition-action pairs (e.g. `If risk_score > 70 → ROUTE_TO_WORKBENCH`).\n"
            "2. **Natural Language Rules**: Plain English directives interpreted by the AI.\n\n"
            "#### 💡 Recommended Policy Templates\n"
            "* **SLA Escalation Policy**:\n"
            "  > \"If a customer transaction has been pending for over 48 hours without signature, flag it and notify Slack.\"\n"
            "* **Deal-Value Threshold Guardrail**:\n"
            "  > \"Route any company deal valued above $150,000 for manual Workbench review, blocking automatic CRM updates.\"\n"
            "* **Risk Cap Guard**:\n"
            "  > \"If the OP-4 Risk Assessor score exceeds 80, dispatch an immediate Slack warning to management.\"\n\n"
            "#### 🚀 How to Implement This:\n"
            "1. Go to the **AI Policies** page from the sidebar.\n"
            "2. Click the **Create Policy** button or switch to the **Create with AI** tab.\n"
            "3. Paste one of the templates above and click **Generate**.\n"
            "4. Review the auto-compiled DSL, refine, and click **Save Policy** to deploy it instantly."
        )

    # 6. INTENT: Explain this page
    elif any(k in msg for k in ["explain", "explain this page", "where am i", "page context", "current page"]):
        if not page_ctx or page_ctx == "/" or "dashboard" in page_ctx:
            response_text = (
                "### 📊 Dashboard Page Guide\n\n"
                "You are currently viewing the **AutoPilot Command Center Dashboard**.\n\n"
                "* **Key Metrics**: View aggregate stats including total lead count, average pipeline processing latency, workbench exceptions, and security logs.\n"
                "* **Operational Graphs**: Hover over timelines to analyze daily throughput and risk trends.\n"
                "* **Main Task**: Trigger the multi-agent pipeline from the CLI or verify incoming telemetry in real-time."
            )
        elif "policies" in page_ctx:
            response_text = (
                "### 🛡️ AI Policies Page Guide\n\n"
                "You are viewing the **AI Policies & Governance Hub**.\n\n"
                "* **Policies Tab**: Lists all active and inactive rules that govern lead evaluations. You can toggle them instantly.\n"
                "* **Create with AI Tab**: Input business goals in simple text, and the system translates them into system DSL configurations.\n"
                "* **Structured Builder**: A drag-and-drop conditions builder for absolute logic.\n"
                "* **Permission Matrix Tab**: Maps security clearance, access limits, and geographical constraints for roles."
            )
        elif "insights" in page_ctx:
            response_text = (
                "### 💡 AI Insights Page Guide\n\n"
                "You are viewing the **AI Insights & Audit Center**.\n\n"
                "* **Compliance Audits**: Shows systemic anomalies, drift logs, and risk score clusters.\n"
                "* **Recommendations**: Lists algorithmic advice to adapt threshold limits based on historical lead volumes."
            )
        elif "workbench" in page_ctx:
            response_text = (
                "### 📋 Workbench Exception Queue Guide\n\n"
                "You are viewing the **Human-in-the-Loop exception queue**.\n\n"
                "* **The Queue**: Shows transactions that failed automatic corporate compliance checks (e.g. missing signatures, high-risk flags).\n"
                "* **Actions**: Click **Review** on any row to open the complete multi-agent validation trace. You can manually **Approve** or **Reject** to dispatch standard CRM updates."
            )
        elif "settings" in page_ctx:
            response_text = (
                "### ⚙️ Application Settings Guide\n\n"
                "You are viewing the **System Configuration screen**.\n\n"
                "* **Parameters**: Tweak whitelisted corporate email domains, bypass authentications, and adjust default timeout thresholds.\n"
                "* **Security & Audit Logs**: Direct links to view compliance events."
            )
        else:
            response_text = (
                f"### 🔍 Screen Guide\n\n"
                f"You are viewing `{page_ctx}`. This screen represents a modular component of the AutoPilot Command Center. "
                "You can inspect metrics, customize rules, or trigger background AI orchestration steps from this layout."
            )

    # 7. INTENT: Supervity agent pipelines / General AI Q&A
    elif any(k in msg for k in ["supervity", "agent", "orchestrat", "op-", "op1", "op2", "op3", "op4", "pipeline"]):
        response_text = (
            "### ⚙️ Multi-Agent Hub-and-Spoke Pipeline\n\n"
            "The RevOps pipeline utilizes 5 specialized **Supervity AI Agents** working in parallel and sequence:\n\n"
            "1. **OP-1 Web Intel**: Scrapes public LinkedIn, press releases, and filings for headcount trends and signals.\n"
            "2. **OP-2 Comms Intel**: Analyzes email threads for SLA breaches and sentiment shifts.\n"
            "3. **OP-3 OCR Doc Parse**: Ingests contracts to detect liability caps and missing signatures.\n"
            "4. **OP-4 Risk Assessor**: Performs weighted risk synthesis (0.2×Web + 0.35×Comms + 0.45×OCR).\n"
            "5. **ORCH-01 Governance**: Applies RAG policy evaluations to issue a routing command:\n"
            "   * `ROUTE_TO_CRM_AUTO` (Low risk)\n"
            "   * `ROUTE_TO_WORKBENCH` (Manual human override required)\n"
            "   * `TRIGGER_SLACK_ESCALATION` (High risk notify management)\n\n"
            "Every step is fully tracked, timed, and saved to the PostgreSQL database for high auditable compliance."
        )

    # 8. FALLBACK: Intelligent context-aware answers
    else:
        response_text = (
            f"I have received your message: *\"{req.message}\"*\n\n"
            "To assist you perfectly with the Autopilot Command Center, here are a few things you can ask me:\n\n"
            "* **\"Show recent activity\"** — Query the database for live logs of multi-agent pipeline executions.\n"
            "* **\"What's in the exception queue?\"** — Display the active pending review workbench tickets.\n"
            "* **\"Generate a report\"** — Extract performance statistics, volumes, and auto-approval rates.\n"
            "* **\"Explain this page\"** — Detail the features of your active dashboard screen.\n\n"
            "Feel free to click one of the quick actions below, or ask a specific question!"
        )

    return ChatResponse(
        response=response_text,
        tool_calls=tool_calls if tool_calls else None
    )
