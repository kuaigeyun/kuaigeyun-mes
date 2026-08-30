"""将数据接口响应体规范化为同步可用的行字典列表（兼容 re-export）。"""

from core.services.data.sync_source_rows import normalize_api_body_to_rows
from core.services.integration.kingdee_field_keys import extract_kingdee_field_keys

__all__ = ["extract_kingdee_field_keys", "normalize_api_body_to_rows"]
