"""好力 GO — 隐患单上报字段 + 问题登记上报消息模板。"""

from tortoise import BaseDBAsyncClient

TEMPLATE_CODE = "HAOLIGO_PATROL_ISSUE_REGISTER_REPORT"

_CONTENT = """您好，

现场巡查问题已登记并上报，请您关注并处理。

登记单号：{hazard_ref}
车间：{workshop_name}
巡查区域：{workshop_area}
巡查时间：{reported_at}
问题类型：{issue_type_label}
登记人：{registrant_name}
责任人：{responsible_name}
关联设备：{equipment_label}

请登录系统查看「隐患治理」处理进度。"""

_VARIABLES = (
    '{"hazard_ref": "登记单号（业务单号或 ID）", "hazard_id": "隐患单 ID", '
    '"workshop_name": "车间名称", "workshop_area": "巡查区域", "reported_at": "巡查时间", '
    '"issue_type_label": "问题类型（字典显示名）", "issue_type_code": "问题类型编码", '
    '"registrant_name": "登记人", "responsible_name": "责任人", '
    '"equipment_label": "关联设备（编码+名称）"}'
)


async def upgrade(db: BaseDBAsyncClient) -> str:
    content_sql = _CONTENT.replace("'", "''")
    return f"""
        ALTER TABLE "haoligo_hazard_report"
            ADD COLUMN IF NOT EXISTS "report_enabled" BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE "haoligo_hazard_report"
            ADD COLUMN IF NOT EXISTS "report_notify_user_ids" JSONB NOT NULL DEFAULT '[]';

        INSERT INTO core_message_templates
            (uuid, tenant_id, name, code, type, description, subject, content, variables, is_active, created_at, updated_at)
        SELECT
            gen_random_uuid()::text,
            t.id,
            '现场巡查问题登记上报',
            '{TEMPLATE_CODE}',
            'internal',
            '问题登记保存并开启上报时，向所选接收人发送站内信',
            '【现场巡查上报】{{hazard_ref}}',
            '{content_sql}',
            '{_VARIABLES}'::jsonb,
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
        ALTER TABLE "haoligo_hazard_report" DROP COLUMN IF EXISTS "report_notify_user_ids";
        ALTER TABLE "haoligo_hazard_report" DROP COLUMN IF EXISTS "report_enabled";
    """
