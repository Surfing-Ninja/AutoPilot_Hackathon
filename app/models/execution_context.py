# app/models/execution_context.py
from sqlalchemy import JSON, Column, Integer, String
from app.core.database import Base

class ExecutionContext(Base):
    """
    Stateful execution memory for Orchestration Layer.
    Stores workflow state and shared context for Supervity runs.
    """
    __tablename__ = "execution_context"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(String(255), nullable=False, index=True)
    lead_id = Column(String(255), nullable=False, index=True)
    current_stage = Column(String(100), nullable=False)
    shared_context_json = Column(JSON, nullable=True, default={})
    status = Column(String(50), nullable=False, default="pending")

    def __repr__(self):
        return f"<ExecutionContext {self.workflow_id} lead={self.lead_id} status={self.status}>"
