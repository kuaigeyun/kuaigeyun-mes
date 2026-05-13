"""
好力 GO — 试模单表 haoligo_mold_trial_sheet。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "haoligo_mold_trial_sheet" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "purchase_order_no" VARCHAR(128) NOT NULL,
            "supplier_name" VARCHAR(200),
            "mold_code" VARCHAR(64),
            "mold_name" VARCHAR(200),
            "trial_times" INT,
            "result_attachment_file_uuids" JSONB,
            "inspection_attachment_file_uuids" JSONB,
            "trial_result" VARCHAR(16) NOT NULL,
            "sheet_status" VARCHAR(32) NOT NULL DEFAULT '草稿',
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_mts_tenant" ON "haoligo_mold_trial_sheet" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_mts_po" ON "haoligo_mold_trial_sheet" ("purchase_order_no");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_mts_status" ON "haoligo_mold_trial_sheet" ("sheet_status");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "haoligo_mold_trial_sheet" CASCADE;
    """
