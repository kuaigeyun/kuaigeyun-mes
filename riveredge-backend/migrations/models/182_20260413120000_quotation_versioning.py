"""
报价单：系列/版本字段；quotation_code 改为租户内部分唯一（未删除记录唯一）

与工单等表一致：软删除后可重用编码空间由业务保证；活跃行 (tenant_id, quotation_code) 唯一。
同系列 (tenant_id, quotation_series_code, version_no) 唯一。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 1. 新列（先可空，回填后再设 NOT NULL）
        ALTER TABLE "apps_kuaizhizao_quotations"
            ADD COLUMN IF NOT EXISTS "quotation_series_code" VARCHAR(120) NULL;
        ALTER TABLE "apps_kuaizhizao_quotations"
            ADD COLUMN IF NOT EXISTS "root_quotation_id" INT NULL;
        ALTER TABLE "apps_kuaizhizao_quotations"
            ADD COLUMN IF NOT EXISTS "version_no" INT NOT NULL DEFAULT 1;
        ALTER TABLE "apps_kuaizhizao_quotations"
            ADD COLUMN IF NOT EXISTS "previous_quotation_id" INT NULL;
        ALTER TABLE "apps_kuaizhizao_quotations"
            ADD COLUMN IF NOT EXISTS "is_latest_in_series" BOOLEAN NOT NULL DEFAULT TRUE;
        ALTER TABLE "apps_kuaizhizao_quotations"
            ADD COLUMN IF NOT EXISTS "superseded_by_id" INT NULL;
        ALTER TABLE "apps_kuaizhizao_quotations"
            ADD COLUMN IF NOT EXISTS "formal_document_generated_at" TIMESTAMPTZ NULL;

        ALTER TABLE "apps_kuaizhizao_quotations"
            ALTER COLUMN "quotation_code" TYPE VARCHAR(120);

        -- 2. 回填历史数据：每行自成系列首版
        UPDATE "apps_kuaizhizao_quotations"
        SET
            "quotation_series_code" = "quotation_code",
            "root_quotation_id" = "id",
            "version_no" = 1,
            "is_latest_in_series" = TRUE
        WHERE "quotation_series_code" IS NULL;

        ALTER TABLE "apps_kuaizhizao_quotations"
            ALTER COLUMN "quotation_series_code" SET NOT NULL;

        -- 3. 删除 quotation_code 上的表级 UNIQUE（名称因库而异，动态查找）
        DO $$
        DECLARE
            cname text;
        BEGIN
            SELECT c.conname INTO cname
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            WHERE t.relname = 'apps_kuaizhizao_quotations'
              AND c.contype = 'u'
              AND pg_get_constraintdef(c.oid) LIKE '%quotation_code%';
            IF cname IS NOT NULL THEN
                EXECUTE format('ALTER TABLE apps_kuaizhizao_quotations DROP CONSTRAINT %I', cname);
            END IF;
        END $$;

        -- 4. 部分唯一索引（仅未删除）
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_quotations_tenant_quotation_code_active"
            ON "apps_kuaizhizao_quotations" ("tenant_id", "quotation_code")
            WHERE "deleted_at" IS NULL;

        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_quotations_tenant_series_version_active"
            ON "apps_kuaizhizao_quotations" ("tenant_id", "quotation_series_code", "version_no")
            WHERE "deleted_at" IS NULL;

        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_quotations_tenant_series_code"
            ON "apps_kuaizhizao_quotations" ("tenant_id", "quotation_series_code")
            WHERE "deleted_at" IS NULL;

        COMMENT ON COLUMN "apps_kuaizhizao_quotations"."quotation_series_code" IS '报价系列编码（首版与 quotation_code 相同，修订版共用）';
        COMMENT ON COLUMN "apps_kuaizhizao_quotations"."root_quotation_id" IS '系列根报价单 ID（首版）';
        COMMENT ON COLUMN "apps_kuaizhizao_quotations"."version_no" IS '系列内版本号，从 1 递增';
        COMMENT ON COLUMN "apps_kuaizhizao_quotations"."previous_quotation_id" IS '上一版本报价单 ID';
        COMMENT ON COLUMN "apps_kuaizhizao_quotations"."is_latest_in_series" IS '是否为当前系列最新版本';
        COMMENT ON COLUMN "apps_kuaizhizao_quotations"."superseded_by_id" IS '被哪条新版本替代';
        COMMENT ON COLUMN "apps_kuaizhizao_quotations"."formal_document_generated_at" IS '首次生成正式报价 PDF 的时间（审计）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_apps_kuaizhizao_quotations_tenant_series_code";
        DROP INDEX IF EXISTS "idx_apps_kuaizhizao_quotations_tenant_series_version_active";
        DROP INDEX IF EXISTS "idx_apps_kuaizhizao_quotations_tenant_quotation_code_active";

        ALTER TABLE "apps_kuaizhizao_quotations" DROP COLUMN IF EXISTS "formal_document_generated_at";
        ALTER TABLE "apps_kuaizhizao_quotations" DROP COLUMN IF EXISTS "superseded_by_id";
        ALTER TABLE "apps_kuaizhizao_quotations" DROP COLUMN IF EXISTS "is_latest_in_series";
        ALTER TABLE "apps_kuaizhizao_quotations" DROP COLUMN IF EXISTS "previous_quotation_id";
        ALTER TABLE "apps_kuaizhizao_quotations" DROP COLUMN IF EXISTS "version_no";
        ALTER TABLE "apps_kuaizhizao_quotations" DROP COLUMN IF EXISTS "root_quotation_id";
        ALTER TABLE "apps_kuaizhizao_quotations" DROP COLUMN IF EXISTS "quotation_series_code";

        ALTER TABLE "apps_kuaizhizao_quotations"
            ALTER COLUMN "quotation_code" TYPE VARCHAR(50);

        ALTER TABLE "apps_kuaizhizao_quotations"
            ADD CONSTRAINT "apps_kuaizhizao_quotations_quotation_code_key" UNIQUE ("quotation_code");
    """
