from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def get_workbench_items():
    return []
