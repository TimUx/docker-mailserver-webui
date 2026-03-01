from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DkimKey(Base):
    __tablename__ = "dkim_keys"

    domain: Mapped[str] = mapped_column(String(255), primary_key=True)
    selector: Mapped[str] = mapped_column(String(64), primary_key=True)
    dns_record: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
