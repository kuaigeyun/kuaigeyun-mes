"""用户数据范围绑定 API 模型。"""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class UserDataScopeBindingItem(BaseModel):
    dimension: str = Field(description="数据维度，如 outsourced_unit")
    scope_code: str = Field(description="主体编码")
    scope_name: Optional[str] = Field(None, description="主体名称（展示）")


class UserDataScopeBindingReplace(BaseModel):
    dimension: str = Field(description="要替换的维度")
    items: List[UserDataScopeBindingItem] = Field(default_factory=list, description="该维度下全部绑定（覆盖式）")
