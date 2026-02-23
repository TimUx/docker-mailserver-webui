import base64
import logging
import secrets
from datetime import datetime, timedelta, timezone

from cryptography.fernet import Fernet
from jose import jwt
from passlib.context import CryptContext

from app.core.config import get_settings

logger = logging.getLogger(__name__)
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
settings = get_settings()


def _get_fernet() -> Fernet:
    if settings.encryption_key:
        key = settings.encryption_key.encode()
    else:
        key = base64.urlsafe_b64encode(settings.secret_key.encode().ljust(32, b"0")[:32])
    try:
        return Fernet(key)
    except ValueError:
        logger.warning(
            "ENCRYPTION_KEY is not a valid Fernet key; deriving key from provided value. "
            "Set ENCRYPTION_KEY to a value produced by Fernet.generate_key() to suppress this warning."
        )
        return Fernet(base64.urlsafe_b64encode(key.ljust(32, b"0")[:32]))


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    return pwd_context.verify(password, hashed_password)


def create_access_token(subject: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_minutes)
    return jwt.encode({"sub": subject, "exp": exp}, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])


def create_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def encrypt_secret(secret: str) -> str:
    return _get_fernet().encrypt(secret.encode()).decode()


def decrypt_secret(secret_enc: str) -> str:
    return _get_fernet().decrypt(secret_enc.encode()).decode()
