from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AccountNote(Base):
    __tablename__ = "account_notes"

    email: Mapped[str] = mapped_column(String(255), primary_key=True, index=True)
    note: Mapped[str] = mapped_column(Text, default="")
