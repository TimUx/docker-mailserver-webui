from pydantic import BaseModel, EmailStr


class AccountCreate(BaseModel):
    email: EmailStr
    password: str


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
