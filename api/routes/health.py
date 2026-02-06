from fastapi import APIRouter

router = APIRouter()

@router.get("", tags=["system"])
async def health_check():
    return {
        "status": "ok",
        "message": "FastAPI backend is running ✅"
    }
