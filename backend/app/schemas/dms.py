from pydantic import BaseModel, EmailStr, Field


class AccountCreate(BaseModel):
    email: EmailStr
    password: str
    quota: str = Field(default="", description="Optional mailbox quota, e.g. '1G', '500M', '0' to remove limit")


class QuotaSet(BaseModel):
    email: EmailStr
    quota: str = Field(..., description="Mailbox quota, e.g. '1G', '500M', '0' to remove limit")


class AccountDelete(BaseModel):
    email: EmailStr


class PasswordChange(BaseModel):
    email: EmailStr
    password: str


class AccountNoteUpdate(BaseModel):
    email: EmailStr
    note: str


class AliasCreate(BaseModel):
    alias: EmailStr
    destination: EmailStr


class AliasDelete(BaseModel):
    alias: EmailStr
    destination: EmailStr


class DomainCreate(BaseModel):
    domain: str
    description: str = ""


class DomainDelete(BaseModel):
    domain: str
