from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AliasNote(Base):
    __tablename__ = "alias_notes"

    alias: Mapped[str] = mapped_column(String(255), primary_key=True, index=True)
    note: Mapped[str] = mapped_column(Text, default="")
