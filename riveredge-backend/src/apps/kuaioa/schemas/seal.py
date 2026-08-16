"""用章申请 schemas。"""

from typing import Optional

from pydantic import BaseModel, Field


class SealRequestCreate(BaseModel):
    title: str = Field(..., max_length=200)
    seal_type: str = Field(..., max_length=30)
    document_name: str = Field(..., max_length=200)
    copies: int = Field(default=1, ge=1)
    take_out: bool = False
    source_app: Optional[str] = Field(None, max_length=50)
    source_entity_type: Optional[str] = Field(None, max_length=50)
    source_entity_id: Optional[int] = None
    source_doc_no: Optional[str] = Field(None, max_length=100)
    department_name: Optional[str] = None
    notes: Optional[str] = None


class SealRequestUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    seal_type: Optional[str] = Field(None, max_length=30)
    document_name: Optional[str] = Field(None, max_length=200)
    copies: Optional[int] = Field(None, ge=1)
    take_out: Optional[bool] = None
    source_app: Optional[str] = Field(None, max_length=50)
    source_entity_type: Optional[str] = Field(None, max_length=50)
    source_entity_id: Optional[int] = None
    source_doc_no: Optional[str] = Field(None, max_length=100)
    department_name: Optional[str] = None
    notes: Optional[str] = None
