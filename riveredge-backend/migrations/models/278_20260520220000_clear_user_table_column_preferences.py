"""
列设置 columnPersistenceId 命名统一后，清空全部用户 ui.tables 列偏好（不保留旧 key 映射）。
用户需在各列表页重新配置列展示/固定/顺序。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE core_user_preferences
        SET preferences = jsonb_set(
                preferences,
                '{ui}',
                COALESCE(preferences->'ui', '{}'::jsonb) - 'tables',
                true
            ),
            updated_at = NOW()
        WHERE preferences->'ui' ? 'tables';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        SELECT 1;
    """
