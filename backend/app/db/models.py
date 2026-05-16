from sqlalchemy import Column, String, Integer, Boolean, DateTime, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from .database import Base

class ExecutionContext(Base):
    __tablename__ = "execution_context"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    workflow_id = Column(String, nullable=False)
    lead_email = Column(String)
    company_name = Column(String)
    current_stage = Column(String)
    status = Column(String)
    shared_context_json = Column(JSONB)
    created_at = Column(DateTime, server_default=text("NOW()"))
    updated_at = Column(DateTime, server_default=text("NOW()"), onupdate=text("NOW()"))


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    workflow_id = Column(String)
    agent_name = Column(String)
    action = Column(String)
    status = Column(String)
    reasoning = Column(String)
    duration_ms = Column(Integer)
    exception = Column(String)
    created_at = Column(DateTime, server_default=text("NOW()"))


class WorkbenchItem(Base):
    __tablename__ = "workbench_items"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    workflow_id = Column(String)
    lead_email = Column(String)
    reason = Column(String)
    agent_name = Column(String)
    context_snapshot = Column(JSONB)
    status = Column(String, server_default="pending")
    reviewer_notes = Column(String)
    created_at = Column(DateTime, server_default=text("NOW()"))


class Policy(Base):
    __tablename__ = "policies"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name = Column(String)
    condition_field = Column(String)
    operator = Column(String)
    threshold = Column(String)
    action = Column(String)
    severity = Column(String)
    active = Column(Boolean, server_default="true")
