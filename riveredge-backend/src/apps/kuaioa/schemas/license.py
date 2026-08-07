"""证照 schemas。"""

from typing import Optional

from pydantic import BaseModel, Field


class LicenseCreate(BaseModel):
    license_name: str = Field(..., max_length=200)
    license_type: str = Field(default="business", max_length=50)
    issuing_authority: Optional[str] = None
    holder_name: Optional[str] = None
    issue_date: Optional[str] = None
    expiry_date: Optional[str] = None
    reminder_days: int = 30
    file_uuid: Optional[str] = None
    notes: Optional[str] = None


class LicenseUpdate(BaseModel):
    license_name: Optional[str] = Field(None, max_length=200)
    license_type: Optional[str] = Field(None, max_length=50)
    issuing_authority: Optional[str] = None
    holder_name: Optional[str] = None
    issue_date: Optional[str] = None
    expiry_date: Optional[str] = None
    status: Optional[str] = None
    reminder_days: Optional[int] = None
    file_uuid: Optional[str] = None
    notes: Optional[str] = None
