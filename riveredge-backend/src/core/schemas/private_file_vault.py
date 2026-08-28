"""保密文件库 API 模型。"""

from typing import List

from pydantic import BaseModel, Field


class PrivateFileVaultStatusResponse(BaseModel):
    configured: bool
    categories: List[str]


class PrivateFileVaultSetPasswordRequest(BaseModel):
    password: str = Field(..., min_length=4, description="保密文件二次密码")


class PrivateFileVaultChangePasswordRequest(BaseModel):
    old_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=4)


class PrivateFileVaultUnlockRequest(BaseModel):
    password: str = Field(..., min_length=1)


class PrivateFileVaultUnlockResponse(BaseModel):
    token: str
    expires_in: int
