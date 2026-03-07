from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ImapSyncJob(Base):
    __tablename__ = "imapsync_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), unique=True)
    source_host: Mapped[str] = mapped_column(String(255))
    source_user: Mapped[str] = mapped_column(String(255))
    source_password_enc: Mapped[str] = mapped_column(Text)
    destination_host: Mapped[str] = mapped_column(String(255))
    destination_user: Mapped[str] = mapped_column(String(255))
    destination_password_enc: Mapped[str] = mapped_column(Text)
    port: Mapped[int] = mapped_column(Integer, default=993)
    ssl_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    verify_cert: Mapped[bool] = mapped_column(Boolean, default=True)
    interval_minutes: Mapped[int] = mapped_column(Integer, default=60)
    mirror: Mapped[bool] = mapped_column(Boolean, default=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    last_status: Mapped[str | None] = mapped_column(String(64), nullable=True)
    last_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
