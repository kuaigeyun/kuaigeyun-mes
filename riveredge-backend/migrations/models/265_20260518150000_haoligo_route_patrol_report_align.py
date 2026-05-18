"""好力 GO — 路线巡检单：上报字段对齐点检单 + 行级设备状态 + 巡检上报消息模板。"""

from tortoise import BaseDBAsyncClient

TEMPLATE_CODE = "HAOLIGO_EQUIPMENT_ROUTE_PATROL_REPORT"

_CONTENT = """您好，

路线巡检单 {sheet_no} 已上报，请您关注并处理。

巡检路线：{patrol_route_label}
巡检时间：{recorded_at}
填报人：{reporter_name}

【巡检异常设备】
{abnormal_items_summary}

【设备运行状态调整】
{equipment_status_changes_summary}

请登录系统查看巡检明细。"""

_VARIABLES = (
    '{"sheet_no": "巡检单号", "patrol_route_label": "巡检路线（编码+名称）", '
    '"patrol_route_code": "路线编码", "patrol_route_name": "路线名称", '
    '"recorded_at": "巡检时间", "reporter_name": "填报人", "route_patrol_id": "巡检单 ID", '
    '"abnormal_items_summary": "异常设备（正常→异常及说明）", '
    '"equipment_status_changes_summary": "各设备运行状态变更（调整前→调整后）"}'
)


async def upgrade(db: BaseDBAsyncClient) -> str:
    content_sql = _CONTENT.replace("'", "''")
    return f"""
        ALTER TABLE "haoligo_equipment_route_patrol"
            ADD COLUMN IF NOT EXISTS "report_enabled" BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE "haoligo_equipment_route_patrol"
            ADD COLUMN IF NOT EXISTS "report_notify_user_ids" JSONB NOT NULL DEFAULT '[]';

        UPDATE "haoligo_equipment_route_patrol"
        SET "report_enabled" = COALESCE("report_required", FALSE)
        WHERE "report_enabled" = FALSE AND COALESCE("report_required", FALSE) = TRUE;

        UPDATE "haoligo_equipment_route_patrol"
        SET "report_notify_user_ids" = jsonb_build_array("report_to_user_id")
        WHERE "report_to_user_id" IS NOT NULL
          AND ("report_notify_user_ids" IS NULL OR "report_notify_user_ids" = '[]'::jsonb);

        ALTER TABLE "haoligo_equipment_route_patrol" DROP COLUMN IF EXISTS "report_required";
        ALTER TABLE "haoligo_equipment_route_patrol" DROP COLUMN IF EXISTS "report_to_user_id";

        ALTER TABLE "haoligo_equipment_route_patrol_line"
            ADD COLUMN IF NOT EXISTS "applied_operational_status" VARCHAR(32);

        INSERT INTO core_message_templates
            (uuid, tenant_id, name, code, type, description, subject, content, variables, is_active, created_at, updated_at)
        SELECT
            gen_random_uuid()::text,
            t.id,
            '路线巡检异常上报',
            '{TEMPLATE_CODE}',
            'internal',
            '路线巡检单保存并开启上报时，向所选接收人发送站内信',
            '【路线巡检上报】{{sheet_no}}',
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
        ALTER TABLE "haoligo_equipment_route_patrol"
            ADD COLUMN IF NOT EXISTS "report_required" BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE "haoligo_equipment_route_patrol"
            ADD COLUMN IF NOT EXISTS "report_to_user_id" INT;

        UPDATE "haoligo_equipment_route_patrol"
        SET "report_required" = COALESCE("report_enabled", FALSE);

        UPDATE core_message_templates
        SET deleted_at = NOW()
        WHERE code = '{TEMPLATE_CODE}' AND deleted_at IS NULL;

        ALTER TABLE "haoligo_equipment_route_patrol" DROP COLUMN IF EXISTS "report_enabled";
        ALTER TABLE "haoligo_equipment_route_patrol" DROP COLUMN IF EXISTS "report_notify_user_ids";
        ALTER TABLE "haoligo_equipment_route_patrol_line" DROP COLUMN IF EXISTS "applied_operational_status";
    """
