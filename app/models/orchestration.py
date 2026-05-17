from datetime import datetime
import uuid

from sqlalchemy import JSON, Boolean, Column, DateTime, Float, String, Text, ForeignKey, Integer
from sqlalchemy.orm import relationship

from ..core.database import Base


class ExecutionContext(Base):
    """
    Stores the full orchestration trace, capturing latency and the unified risk score.
    """
    __tablename__ = "execution_contexts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_name = Column(String(255), nullable=False)
    system_command = Column(String(100), nullable=False)
    unified_risk_score = Column(Float, nullable=True)
    
    # Store the full JSON trace representing the step-by-step latency/status
    trace = Column(JSON, nullable=True)
    # Store the full results from all agents
    agent_results = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class WorkbenchItem(Base):
    """
    Stores flagged leads/items that require human-in-the-loop review.
    """
    __tablename__ = "workbench_items"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    execution_context_id = Column(String(36), ForeignKey("execution_contexts.id", ondelete="CASCADE"), nullable=False)
    
    company_name = Column(String(255), nullable=False)
    status = Column(String(50), nullable=False, default="pending")  # pending, approved, rejected
    risk_factors = Column(JSON, nullable=True)  # List of strings
    missing_fields = Column(JSON, nullable=True)  # List of strings
    
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    execution_context = relationship("ExecutionContext", backref="workbench_items")


class Policy(Base):
    """
    Stores AI governance policies.
    """
    __tablename__ = "policies"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    natural_language = Column(Text, nullable=False)
    summary = Column(Text, nullable=True)
    policy_type = Column(String(50), nullable=False, default="logical")  # 'logical' or 'natural_language'
    
    dsl = Column(JSON, nullable=True)
    refined_instruction = Column(Text, nullable=True)
    ai_instruction = Column(Text, nullable=True)
    entity_name = Column(String(100), nullable=True)
    
    is_active = Column(Boolean, default=True, nullable=False)
    priority = Column(Integer, default=50, nullable=False)
    tags = Column(JSON, nullable=True)
    
    execution_count = Column(Integer, default=0, nullable=False)
    last_executed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
