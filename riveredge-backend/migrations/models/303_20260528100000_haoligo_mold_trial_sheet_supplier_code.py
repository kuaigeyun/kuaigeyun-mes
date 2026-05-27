"""好力 GO — 试模单供应商编码（数据范围按供应商隔离）"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold_trial_sheet"
        ADD COLUMN IF NOT EXISTS "supplier_code" VARCHAR(64);
        UPDATE "haoligo_mold_trial_sheet" AS t
        SET "supplier_code" = s."code"
        FROM "apps_master_data_suppliers" AS s
        WHERE t."tenant_id" = s."tenant_id"
          AND t."supplier_name" IS NOT NULL
          AND TRIM(t."supplier_name") <> ''
          AND TRIM(s."name") = TRIM(t."supplier_name")
          AND s."deleted_at" IS NULL
          AND (t."supplier_code" IS NULL OR TRIM(t."supplier_code") = '');
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold_trial_sheet" DROP COLUMN IF EXISTS "supplier_code";
    """
