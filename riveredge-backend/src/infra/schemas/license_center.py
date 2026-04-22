"""
许可证中心 Schema。

用于平台级 License Key 管理（只保存摘要，不保存明文）。
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class PlatformLicenseCreateRequest(BaseModel):
    """创建平台许可证密钥请求。"""
    license_key: str = Field(..., min_length=8, max_length=256, description="许可证密钥")
    app_code: str = Field(default="*", min_length=1, max_length=64, description="适用应用 code，* 表示全局")
    alias: Optional[str] = Field(default=None, max_length=120, description="别名")
    remark: Optional[str] = Field(default=None, max_length=500, description="备注")
    max_activations: int = Field(default=1, ge=1, le=100000, description="最大激活租户数")


class PlatformLicenseResponse(BaseModel):
    """平台许可证密钥响应（脱敏）。"""
    uuid: str = Field(..., description="许可证记录 UUID")
    app_code: str = Field(..., description="适用应用 code")
    alias: Optional[str] = Field(default=None, description="别名")
    key_last4: str = Field(..., description="密钥后四位")
    is_active: bool = Field(..., description="是否有效")
    remark: Optional[str] = Field(default=None, description="备注")
    created_by: Optional[int] = Field(default=None, description="创建人（平台管理员 ID）")
    max_activations: int = Field(default=1, description="最大激活租户数")
    current_activations: int = Field(default=0, description="当前已激活租户数")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    revoked_at: Optional[datetime] = Field(default=None, description="撤销时间")


class PlatformLicenseGenerateResponse(BaseModel):
    """自动生成许可证密钥响应。"""
    license_key: str = Field(..., description="自动生成的 License Key")

