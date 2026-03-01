from pydantic import BaseModel, Field


class DkimGenerate(BaseModel):
    domain: str
    selector: str = Field(default="dkim", description="DKIM selector (e.g. 'dkim', 'mail')")
    bits: int = Field(default=2048, ge=1024, le=4096, description="RSA key size in bits")
