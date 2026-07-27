"""
系统级基础Schema模块

提供统一的BaseSchema基类，用于应用级schema继承。
"""

from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field, field_serializer

from core.utils.timezone_utils import to_api_isoformat


class BaseSchema(BaseModel):
    """
    应用级 schema 基础类。

    时区展示仅作用于 API JSON 输出，不得参与 ORM 写库：

    - **响应**：FastAPI 序列化走 ``mode='json'``，``field_serializer(when_used='json')`` 生效。
    - **写库**：服务层 ``model_dump(exclude_unset=True)`` 须保持 ``datetime`` 等 Python 原生类型；
      禁止将 ``when_used`` 改为 ``'always'``。
    - **口径**：与 ``to_api_isoformat`` / ``SiteTimezoneJSONResponse`` 同一真源。
    """
    model_config = ConfigDict(
        from_attributes=True,
        validate_assignment=True,
        arbitrary_types_allowed=True,
    )

    audit: Optional[Dict[str, Any]] = Field(
        default=None,
        description="审核相位（列表/详情由 derive_audit_phase 派生，供 uni-audit 渲染）",
    )

    @field_serializer('*', when_used='json')
    def serialize_datetime(self, value: Any, _info):
        """API JSON：UTC → 站点墙钟。不参与 model_dump 写库。"""
        if value is None:
            return None
        if not isinstance(value, datetime):
            return value
        return to_api_isoformat(value)





















