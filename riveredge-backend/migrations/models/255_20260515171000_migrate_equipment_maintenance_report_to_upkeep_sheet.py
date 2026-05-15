"""好力 GO — 将历史「设备维保单」行迁入「设备保养单」（幂等：按 uuid 对齐维保单）。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        INSERT INTO "haoligo_equipment_upkeep_sheet" (
            "uuid",
            "tenant_id",
            "created_at",
            "updated_at",
            "sheet_no",
            "applicant_user_id",
            "applicant_name",
            "department_uuid",
            "department_name",
            "header_attachment_file_uuids",
            "equipment_id",
            "description",
            "reporter_user_id",
            "deleted_at"
        )
        SELECT
            r."uuid",
            r."tenant_id",
            r."created_at",
            r."updated_at",
            r."sheet_no",
            r."reporter_user_id",
            LEFT(
                COALESCE(
                    NULLIF(TRIM(u."full_name"), ''),
                    u."username",
                    '用户#' || r."reporter_user_id"::text
                ),
                100
            ),
            LEFT(d."uuid"::text, 36),
            LEFT(d."name", 200),
            COALESCE(r."attachment_file_ids", '[]'::jsonb),
            r."equipment_id",
            r."description",
            r."reporter_user_id",
            r."deleted_at"
        FROM "haoligo_equipment_maintenance_report" r
        LEFT JOIN "core_users" u
            ON u."id" = r."reporter_user_id"
            AND u."deleted_at" IS NULL
            AND u."tenant_id" IS NOT DISTINCT FROM r."tenant_id"
        LEFT JOIN "core_departments" d
            ON d."id" = u."department_id"
            AND d."deleted_at" IS NULL
            AND d."tenant_id" IS NOT DISTINCT FROM r."tenant_id"
        WHERE NOT EXISTS (
            SELECT 1
            FROM "haoligo_equipment_upkeep_sheet" t
            WHERE t."uuid" = r."uuid"
        );
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DELETE FROM "haoligo_equipment_upkeep_sheet" t
        USING "haoligo_equipment_maintenance_report" r
        WHERE t."uuid" = r."uuid";
    """
