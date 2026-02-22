from pydantic import BaseModel


class SettingsUpdate(BaseModel):
    settings: dict[str, str]


class DmsEnvUpdate(BaseModel):
    settings: dict[str, str]
