"""更新点检上报站内信模板：含异常项与设备状态变更说明。"""

from tortoise import BaseDBAsyncClient

TEMPLATE_CODE = "HAOLIGO_EQUIPMENT_SPOT_CHECK_REPORT"

_CONTENT = """您好，

设备点检单 {sheet_no} 已上报，请您关注并处理。

设备：{equipment_label}
点检时间：{recorded_at}
填报人：{reporter_name}

【点检异常项】
{abnormal_items_summary}

【设备运行状态】
{equipment_status_change}

请登录系统查看点检明细。"""

_VARIABLES = (
    '{"sheet_no": "点检单号", "equipment_label": "设备（编码+名称）", '
    '"equipment_asset_code": "设备编码", "equipment_name": "设备名称", '
    '"recorded_at": "点检时间", "reporter_name": "填报人", "spot_check_id": "点检单 ID", '
    '"abnormal_items_summary": "点检异常项（正常→异常及实测/说明）", '
    '"equipment_status_change": "设备运行状态变更（调整前→调整后）"}'
)


async def upgrade(db: BaseDBAsyncClient) -> str:
    content_sql = _CONTENT.replace("'", "''")
    return f"""
        UPDATE core_message_templates
        SET content = '{content_sql}',
            variables = '{_VARIABLES}'::jsonb,
            updated_at = NOW()
        WHERE code = '{TEMPLATE_CODE}' AND deleted_at IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return ""
