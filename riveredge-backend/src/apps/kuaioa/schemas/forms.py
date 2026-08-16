"""审批表单 schemas。"""

from typing import Any, List, Optional

from pydantic import BaseModel, Field


class FormTemplateCreate(BaseModel):
    template_code: str = Field(..., max_length=50)
    template_name: str = Field(..., max_length=200)
    category: str = Field(default="general", max_length=50)
    description: Optional[str] = None
    fields_schema: List[Any] = Field(default_factory=list)
    is_active: bool = True
    show_in_menu: bool = False


class FormTemplateUpdate(BaseModel):
    template_name: Optional[str] = Field(None, max_length=200)
    category: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    fields_schema: Optional[List[Any]] = None
    is_active: Optional[bool] = None
    show_in_menu: Optional[bool] = None


class FormRequestCreate(BaseModel):
    template_id: Optional[int] = None
    template_code: Optional[str] = None
    title: str = Field(..., max_length=200)
    form_data: dict[str, Any] = Field(default_factory=dict)
    department_name: Optional[str] = None
    notes: Optional[str] = None


class FormRequestUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    form_data: Optional[dict[str, Any]] = None
    department_name: Optional[str] = None
    notes: Optional[str] = None
