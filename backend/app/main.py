from fastapi import FastAPI
from .routes import orchestrate, workbench, audit, policies
from .db.database import engine, Base

# Create tables based on UUID models
Base.metadata.create_all(bind=engine)

app = FastAPI(title="RevOps AI Backend")

app.include_router(orchestrate.router, prefix="/api/orchestrate", tags=["Orchestrate"])
app.include_router(workbench.router, prefix="/api/workbench", tags=["Workbench"])
app.include_router(audit.router, prefix="/api/audit", tags=["Audit"])
app.include_router(policies.router, prefix="/api/policies", tags=["Policies"])

@app.get("/")
def read_root():
    return {"status": "ok", "service": "RevOps AI API"}
