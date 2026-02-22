from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import AuthResponse, AuthUser, LoginRequest
from app.services.security import create_access_token, create_csrf_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email, User.is_active.is_(True)).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(user.email)
    csrf_token = create_csrf_token()
    response.set_cookie(settings.session_cookie_name, token, httponly=True, secure=settings.cookie_secure, samesite="strict")
    response.set_cookie(settings.csrf_cookie_name, csrf_token, httponly=False, secure=settings.cookie_secure, samesite="strict")
    return AuthResponse(user=AuthUser(id=user.id, email=user.email, is_admin=user.is_admin), csrf_token=csrf_token)


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(settings.session_cookie_name)
    response.delete_cookie(settings.csrf_cookie_name)
    return {"message": "Logged out"}


@router.get("/me", response_model=AuthUser)
def me(user: User = Depends(get_current_user)):
    return AuthUser(id=user.id, email=user.email, is_admin=user.is_admin)
