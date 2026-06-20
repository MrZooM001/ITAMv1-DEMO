from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.database import get_db
from app.core.dependencies import get_current_user, oauth2_scheme
from app.models.user import User
from app.schemas.user import (
    LoginRequest,
    TokenResponse,
    RefreshTokenRequest,
    ChangePasswordRequest,
    UserResponse,
)
from app.services import auth as auth_service
from app.services import user as user_service

router = APIRouter(prefix="/auth", tags=["Auth"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")  # max 10 محاولات في الدقيقة من نفس الـ IP
def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    return auth_service.login(body, db)


@router.post("/logout")
def logout(
    request: RefreshTokenRequest,
    current_user: User = Depends(get_current_user),
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    auth_service.logout(
        access_token=token,
        refresh_token=request.refresh_token,
        db=db,
    )
    return {"message": "Logged out successfully"}


@router.post("/refresh", response_model=TokenResponse)
def refresh(request: RefreshTokenRequest, db: Session = Depends(get_db)):
    return auth_service.refresh_access_token(request, db)


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return user_service.to_response(current_user, db)


@router.put("/change-password")
def change_password(
    request: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    auth_service.change_password(request, current_user, db)
    return {"message": "Password changed successfully"}
