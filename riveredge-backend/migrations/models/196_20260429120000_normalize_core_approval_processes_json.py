"""
将 core_approval_processes 中 nodes / config 的非法 JSON 形态（如 [] 或其它非 object）写回为 {}。

与 Schema 层 normalize 配合：线上历史数据曾把 ProFlow 顶层写成了 JSON 数组，导致 Pydantic
dict 校验失败。本迁移在库内一次性修正，避免长期依赖“读时修复”。

注意：被规范为 {} 的行的原值（如空数组）无法从 {} 反推，downgrade 不恢复具体旧值。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "core_approval_processes"
        SET
            "nodes" = '{}'::jsonb,
            "updated_at" = CURRENT_TIMESTAMP
        WHERE jsonb_typeof("nodes") <> 'object';

        UPDATE "core_approval_processes"
        SET
            "config" = '{}'::jsonb,
            "updated_at" = CURRENT_TIMESTAMP
        WHERE jsonb_typeof("config") <> 'object';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return ""
