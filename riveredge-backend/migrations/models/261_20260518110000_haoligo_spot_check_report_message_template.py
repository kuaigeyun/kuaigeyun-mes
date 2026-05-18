"""好力 GO — 为各租户创建设备点检异常上报站内信模板。"""

from tortoise import BaseDBAsyncClient

TEMPLATE_CODE = "HAOLIGO_EQUIPMENT_SPOT_CHECK_REPORT"


async def upgrade(db: BaseDBAsyncClient) -> str:
    subject = "【设备点检上报】{sheet_no}"
    content = (
        "您好，\\n\\n"
        "设备点检单 {sheet_no} 已上报，请您关注并处理。\\n\\n"
        "设备：{equipment_label}\\n"
        "点检时间：{recorded_at}\\n"
        "填报人：{reporter_name}\\n\\n"
        "请登录系统查看点检明细。"
    )
    variables = (
        '{"sheet_no": "点检单号", "equipment_label": "设备（编码+名称）", '
        '"equipment_asset_code": "设备编码", "equipment_name": "设备名称", '
        '"recorded_at": "点检时间", "reporter_name": "填报人", "spot_check_id": "点检单 ID"}'
    )
    return f"""
        INSERT INTO core_message_templates
            (uuid, tenant_id, name, code, type, description, subject, content, variables, is_active, created_at, updated_at)
        SELECT
            gen_random_uuid()::text,
            t.id,
            '设备点检异常上报',
            '{TEMPLATE_CODE}',
            'internal',
            '设备点检单保存并开启上报时，向所选接收人发送站内信',
            '{subject}',
            '{content}',
            '{variables}'::jsonb,
            TRUE,
            NOW(),
            NOW()
        FROM infra_tenants t
        WHERE NOT EXISTS (
            SELECT 1 FROM core_message_templates m
            WHERE m.tenant_id = t.id
              AND m.code = '{TEMPLATE_CODE}'
              AND m.deleted_at IS NULL
        );
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return f"""
        UPDATE core_message_templates
        SET deleted_at = NOW()
        WHERE code = '{TEMPLATE_CODE}' AND deleted_at IS NULL;
    """
