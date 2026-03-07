from datetime import datetime

from pydantic import BaseModel, Field


class ImapSyncJobBase(BaseModel):
    name: str = Field(min_length=3, max_length=255)
    source_host: str
    source_user: str
    destination_host: str
    destination_user: str
    port: int = Field(default=993, ge=1, le=65535)
    ssl_enabled: bool = True
    verify_cert: bool = True
    interval_minutes: int = Field(default=60, ge=5, le=1440)
    mirror: bool = False
    enabled: bool = True


class ImapSyncJobCreate(ImapSyncJobBase):
    source_password: str = Field(min_length=1)
    destination_password: str = Field(min_length=1)


class ImapSyncJobUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=3, max_length=255)
    source_host: str | None = None
    source_user: str | None = None
    source_password: str | None = None
    destination_host: str | None = None
    destination_user: str | None = None
    destination_password: str | None = None
    port: int | None = Field(default=None, ge=1, le=65535)
    ssl_enabled: bool | None = None
    verify_cert: bool | None = None
    interval_minutes: int | None = Field(default=None, ge=5, le=1440)
    mirror: bool | None = None
    enabled: bool | None = None


class ImapSyncJobRead(ImapSyncJobBase):
    id: int
    last_status: str | None
    last_message: str | None
    last_run_at: datetime | None

    class Config:
        from_attributes = True
