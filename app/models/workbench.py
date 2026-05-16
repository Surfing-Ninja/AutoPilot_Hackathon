# app/models/workbench.py
from sqlalchemy import JSON, Column, DateTime, Integer, String, func
from app.core.database import Base

class WorkbenchItem(Base):
    """
    Human workbench backend for exception lifecycle management.
    """
    __tablename__ = "workbench_items"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(String(255), nullable=False, index=True)
    status = Column(String(50), nullable=False, default="pending")  # pending, approved, rejected, retried
    data = Column(JSON, nullable=True, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def __repr__(self):
        return f"<WorkbenchItem {self.id} lead={self.lead_id} status={self.status}>"
