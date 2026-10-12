"""
用户偏好管理服务模块

提供用户偏好的 CRUD。写入语义：请求体为 patch，与库内 preferences 深合并；
theme_config / uni_tabs_state 等整段替换。不经二级缓存——与业务同库，缓存只会引入陈旧读。

并发写真源：PostgreSQL `core_jsonb_merge_preferences(preferences, patch)` 单语句 UPDATE，
禁止应用层先读后写整包 JSON（否则主题与标签云端同步会互相冲掉）。
"""

from __future__ import annotations

import json
import uuid
from typing import Any, Dict, FrozenSet

from tortoise import Tortoise
from tortoise.exceptions import DoesNotExist, IntegrityError

from core.models.user_preference import UserPreference
from core.schemas.user_preference import UserPreferenceUpdate, UserPreferenceResponse
from core.utils.timezone_utils import now_utc
from infra.exceptions.exceptions import NotFoundError

# 出现在 patch 顶层时整段替换（不清空未提交的兄弟键，如 ui.tables）
_REPLACE_TOP_LEVEL_KEYS: FrozenSet[str] = frozenset({"theme_config", "uni_tabs_state"})

# 任意层级整段替换：表格列偏好是完整快照，深合并会导致隐藏列无法真正覆盖/重置
_REPLACE_DICT_KEYS: FrozenSet[str] = frozenset(
    {"theme_config", "columns", "columnsDetailTable", "columnsWidth"}
)


def merge_preferences_patch(
    existing: Dict[str, Any] | None,
    patch: Dict[str, Any] | None,
) -> Dict[str, Any]:
    """
    将客户端 patch 合并进已有 preferences（与 SQL core_jsonb_merge_preferences 语义一致）。

    - 普通对象：递归深合并（并发写不同子树互不覆盖）
    - theme_config / uni_tabs_state / columns*：整段替换
    - 标量：直接覆盖
    """
    out: Dict[str, Any] = dict(existing or {})
    if not patch:
        return out

    for key, value in patch.items():
        if key in _REPLACE_DICT_KEYS or key in _REPLACE_TOP_LEVEL_KEYS:
            out[key] = value
        elif isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = merge_preferences_patch(out.get(key), value)
        else:
            out[key] = value
    return out


class UserPreferenceService:
    """用户偏好 CRUD（直读直写数据库）。"""

    @staticmethod
    async def get_user_preference(
        tenant_id: int,
        user_id: int,
        use_cache: bool = True,
    ) -> UserPreferenceResponse:
        """
        获取用户偏好。

        use_cache 保留参数以兼容旧调用方，已无缓存实现，始终读库。
        """
        del use_cache  # 显式忽略：偏好不以缓存为真源

        try:
            user_preference = await UserPreference.get(
                tenant_id=tenant_id,
                user_id=user_id,
            )
        except DoesNotExist:
            try:
                user_preference = await UserPreference.create(
                    tenant_id=tenant_id,
                    user_id=user_id,
                    preferences={},
                )
            except IntegrityError:
                raise NotFoundError("当前用户无法创建偏好设置（可能非租户用户）")

        return UserPreferenceResponse.model_validate(user_preference)

    @staticmethod
    async def update_user_preference(
        tenant_id: int,
        user_id: int,
        data: UserPreferenceUpdate,
    ) -> UserPreferenceResponse:
        """
        更新用户偏好（patch 合并，非整包替换）。

        使用库内 jsonb 深合并单语句落库：并发 patch 不同顶层键时由行版本重读组合，
        不再应用层 read-modify-write 整包 preferences。
        """
        patch = data.preferences
        if patch is None:
            raise ValueError("preferences patch is required")
        if not isinstance(patch, dict) or not patch:
            raise ValueError("preferences patch is required")

        conn = Tortoise.get_connection("default")
        patch_json = json.dumps(patch, ensure_ascii=False)
        row_uuid = str(uuid.uuid4())
        ts = now_utc()

        rows = await conn.execute_query_dict(
            """
            INSERT INTO core_user_preferences (
                uuid, tenant_id, user_id, preferences, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4::jsonb, $5, $5)
            ON CONFLICT (tenant_id, user_id) DO UPDATE
            SET
                preferences = core_jsonb_merge_preferences(
                    core_user_preferences.preferences,
                    EXCLUDED.preferences
                ),
                updated_at = EXCLUDED.updated_at
            WHERE core_user_preferences.deleted_at IS NULL
            RETURNING
                id, uuid, tenant_id, user_id, preferences,
                created_at, updated_at,
                created_by, created_by_name, updated_by, updated_by_name,
                deleted_at, deleted_by, deleted_by_name
            """,
            [row_uuid, tenant_id, user_id, patch_json, ts],
        )

        if not rows:
            raise NotFoundError("当前用户无法创建偏好设置（可能非租户用户）")

        row = rows[0]
        prefs = row.get("preferences")
        if isinstance(prefs, str):
            prefs = json.loads(prefs)
        row = {**row, "preferences": prefs if isinstance(prefs, dict) else {}}
        return UserPreferenceResponse.model_validate(row)
