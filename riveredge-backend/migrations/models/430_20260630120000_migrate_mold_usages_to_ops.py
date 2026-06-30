"""
模具使用（mold_usages）迁移至领用/归还（mold_borrows / mold_returns），并下线旧菜单。

对齐工装 429 迁移逻辑：legacy_usage_no 幂等、已归还记录生成归还单。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_mold_borrows"
            ADD COLUMN IF NOT EXISTS "legacy_usage_no" VARCHAR(100) NULL;
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_mold_borrows_legacy_usage_no"
            ON "apps_kuaizhizao_mold_borrows" ("tenant_id", "legacy_usage_no");

        INSERT INTO "apps_kuaizhizao_mold_borrows" (
            "uuid", "tenant_id", "created_at", "updated_at", "document_no",
            "mold_id", "mold_uuid", "mold_code", "mold_name",
            "borrow_date", "borrower_id", "borrower_name",
            "source_type", "source_id", "source_no",
            "legacy_usage_no", "status", "remark", "deleted_at"
        )
        SELECT
            u."uuid", u."tenant_id", u."created_at", u."updated_at",
            COALESCE(u."usage_no", 'LEGACY-' || u."id"::text),
            u."mold_id", u."mold_uuid", COALESCE(u."mold_code", m."code"), u."mold_name",
            u."usage_date", u."operator_id", u."operator_name",
            u."source_type", u."source_id", u."source_no",
            u."usage_no",
            CASE WHEN u."status" = '使用中' THEN '领用中' ELSE '已归还' END,
            u."remark", u."deleted_at"
        FROM "apps_kuaizhizao_mold_usages" u
        LEFT JOIN "apps_kuaizhizao_molds" m ON m."id" = u."mold_id"
        WHERE NOT EXISTS (
            SELECT 1 FROM "apps_kuaizhizao_mold_borrows" b
            WHERE b."tenant_id" = u."tenant_id"
              AND b."legacy_usage_no" IS NOT DISTINCT FROM u."usage_no"
        );

        INSERT INTO "apps_kuaizhizao_mold_returns" (
            "uuid", "tenant_id", "created_at", "updated_at", "document_no",
            "mold_id", "mold_uuid", "mold_code", "mold_name", "borrow_id",
            "return_date", "usage_count", "operator_id", "operator_name",
            "source_type", "source_id", "source_no", "reporting_record_id",
            "status", "remark", "deleted_at"
        )
        SELECT
            gen_random_uuid()::text, u."tenant_id",
            COALESCE(u."return_date", u."updated_at"), u."updated_at",
            COALESCE(u."usage_no", 'LEGACY-R-' || u."id"::text) || '-R',
            u."mold_id", u."mold_uuid", COALESCE(u."mold_code", m."code"), u."mold_name", b."id",
            COALESCE(u."return_date", u."updated_at"), COALESCE(u."usage_count", 1),
            u."operator_id", u."operator_name",
            u."source_type", u."source_id", u."source_no", u."reporting_record_id",
            '已完成', u."remark", u."deleted_at"
        FROM "apps_kuaizhizao_mold_usages" u
        LEFT JOIN "apps_kuaizhizao_molds" m ON m."id" = u."mold_id"
        LEFT JOIN "apps_kuaizhizao_mold_borrows" b
            ON b."tenant_id" = u."tenant_id"
           AND b."legacy_usage_no" IS NOT DISTINCT FROM u."usage_no"
        WHERE u."status" IN ('已归还', '已报废')
          AND NOT EXISTS (
            SELECT 1 FROM "apps_kuaizhizao_mold_returns" r
            WHERE r."tenant_id" = u."tenant_id"
              AND r."document_no" = COALESCE(u."usage_no", 'LEGACY-R-' || u."id"::text) || '-R'
          );

        UPDATE "core_menus"
        SET "deleted_at" = NOW(),
            "updated_at" = NOW()
        WHERE "deleted_at" IS NULL
          AND (
            "path" = '/apps/kuaizhizao/equipment-management/mold-usages'
            OR "path" LIKE '/apps/kuaizhizao/equipment-management/mold-usages/%'
            OR "path" = '/apps/kuaimes/equipment-management/mold-usages'
            OR "path" LIKE '/apps/kuaimes/equipment-management/mold-usages/%'
            OR "name" = 'app.kuaizhizao.menu.equipment-management.mold-usages'
          );
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_mold_borrows"
            DROP COLUMN IF EXISTS "legacy_usage_no";
    """
