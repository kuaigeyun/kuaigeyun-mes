"""数据字典引用展示鉴权（统一走 reference_display_access）。"""

from __future__ import annotations

from core.api.deps.reference_display_access import require_reference_display_access


require_data_dictionary_reference_access = require_reference_display_access(
    "system:data-dictionary",
    "缺少数据字典读或引用展示权限",
)
