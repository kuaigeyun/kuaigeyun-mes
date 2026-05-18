"""修复点检上报消息模板及历史站内信中的字面量 \\n。"""

from tortoise import BaseDBAsyncClient

TEMPLATE_CODE = "HAOLIGO_EQUIPMENT_SPOT_CHECK_REPORT"

_CORRECT_CONTENT = """您好，

设备点检单 {sheet_no} 已上报，请您关注并处理。

设备：{equipment_label}
点检时间：{recorded_at}
填报人：{reporter_name}

请登录系统查看点检明细。"""


async def upgrade(db: BaseDBAsyncClient) -> str:
    content_sql = _CORRECT_CONTENT.replace("'", "''")
    return f"""
        UPDATE core_message_templates
        SET content = '{content_sql}',
            updated_at = NOW()
        WHERE code = '{TEMPLATE_CODE}' AND deleted_at IS NULL;

        UPDATE core_message_logs
        SET content = REPLACE(content, CHR(92)::text || 'n', CHR(10)::text),
            updated_at = NOW()
        WHERE type = 'internal'
          AND deleted_at IS NULL
          AND POSITION(CHR(92)::text || 'n' IN content) > 0;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return ""
