from fastapi import APIRouter

router = APIRouter()

@router.post("/")
def run_orchestration():
    return {"message": "Orchestration started"}
