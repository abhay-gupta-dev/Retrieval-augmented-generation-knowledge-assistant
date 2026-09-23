"""Protected agents API placeholder; implementation is deliberately deferred."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.database.models import User

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("")
def list_agents(_: User = Depends(get_current_user)) -> None:
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Agents are not implemented yet.")
