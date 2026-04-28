"""
将 core_print_templates 中 config 非 object 的 jsonb 写回为规范空对象 {}。

与审批流程脏数据同类：历史或脚本可能将 config 存为 []。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "core_print_templates"
        SET
            "config" = '{}'::jsonb,
            "updated_at" = CURRENT_TIMESTAMP
        WHERE "config" IS NOT NULL
          AND jsonb_typeof("config") <> 'object';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return ""
