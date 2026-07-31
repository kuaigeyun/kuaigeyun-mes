"""
创建快财务往来核销表 apps_kuaicaiwu_settlements。

SettlementRecord 模型与核销 API 已存在，此前无 aerich 建表迁移；
463 仅在表已存在时补租户内部分唯一索引。fresh deploy / 缺表环境确认核销会报
relation "apps_kuaicaiwu_settlements" does not exist。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
CREATE TABLE IF NOT EXISTS "apps_kuaicaiwu_settlements" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settlement_code" VARCHAR(50) NOT NULL,
    "partner_id" INT NOT NULL,
    "partner_name" VARCHAR(200) NOT NULL,
    "debit_doc_type" VARCHAR(50) NOT NULL,
    "debit_doc_id" INT NOT NULL,
    "debit_doc_code" VARCHAR(50) NOT NULL,
    "credit_doc_type" VARCHAR(50) NOT NULL,
    "credit_doc_id" INT NOT NULL,
    "credit_doc_code" VARCHAR(50) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'CNY',
    "settlement_date" DATE NOT NULL,
    "operator_id" INT,
    "operator_name" VARCHAR(100),
    "notes" TEXT,
    "is_active" BOOL NOT NULL DEFAULT TRUE,
    "deleted_at" TIMESTAMPTZ,
    "created_by" INT,
    "created_by_name" VARCHAR(100),
    "updated_by" INT,
    "updated_by_name" VARCHAR(100),
    "deleted_by" INT,
    "deleted_by_name" VARCHAR(100)
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_settlements_tenant_partner"
    ON "apps_kuaicaiwu_settlements" ("tenant_id", "partner_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_settlements_debit_doc"
    ON "apps_kuaicaiwu_settlements" ("debit_doc_type", "debit_doc_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_settlements_credit_doc"
    ON "apps_kuaicaiwu_settlements" ("credit_doc_type", "credit_doc_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_settlements_settlement_date"
    ON "apps_kuaicaiwu_settlements" ("settlement_date");
CREATE UNIQUE INDEX IF NOT EXISTS "uidx_settlements_tenant_settlement_code_active"
    ON "apps_kuaicaiwu_settlements" ("tenant_id", "settlement_code")
    WHERE "deleted_at" IS NULL;
COMMENT ON TABLE "apps_kuaicaiwu_settlements" IS '管理会计 - 往来核销记录';
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
DROP TABLE IF EXISTS "apps_kuaicaiwu_settlements";
"""
