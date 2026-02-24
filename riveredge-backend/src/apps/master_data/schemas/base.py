"""
基础资料 Schema 基类

统一配置：请求接受 camelCase（populate_by_name），响应输出 camelCase（by_alias）
"""

from pydantic import BaseModel, ConfigDict


class MasterDataBaseSchema(BaseModel):
    """基础资料 Schema 基类"""

    model_config = ConfigDict(
        populate_by_name=True,
        by_alias=True,
        from_attributes=True,
    )
