from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class AuthUser(BaseModel):
    id: int
    email: EmailStr
    is_admin: bool


class AuthResponse(BaseModel):
    user: AuthUser
    csrf_token: str
