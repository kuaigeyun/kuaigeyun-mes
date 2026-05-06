"""
创建快财务会计事件表 apps_kuaicaiwu_accounting_events。

InvoiceService 等在创建发票时会写入 accounting_events；此前仅有模型无迁移，会导致表不存在。

Author: Auto
Date: 2026-05-06
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
CREATE TABLE IF NOT EXISTS "apps_kuaicaiwu_accounting_events" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event_code" VARCHAR(50) NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "business_type" VARCHAR(50) NOT NULL,
    "source_doc_type" VARCHAR(50),
    "source_doc_id" INT,
    "source_doc_code" VARCHAR(50),
    "target_doc_type" VARCHAR(50),
    "target_doc_id" INT,
    "target_doc_code" VARCHAR(50),
    "amount" DECIMAL(14,2),
    "currency" VARCHAR(10) NOT NULL DEFAULT 'CNY',
    "event_date" DATE NOT NULL,
    "operator_id" INT,
    "operator_name" VARCHAR(100),
    "payload" JSONB,
    "notes" TEXT,
    CONSTRAINT "uq_apps_kuaicaiwu_accounting_events_event_code" UNIQUE ("event_code")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_ae_tenant_event_type"
    ON "apps_kuaicaiwu_accounting_events" ("tenant_id", "event_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_ae_tenant_source_doc"
    ON "apps_kuaicaiwu_accounting_events" ("tenant_id", "source_doc_type", "source_doc_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_ae_tenant_target_doc"
    ON "apps_kuaicaiwu_accounting_events" ("tenant_id", "target_doc_type", "target_doc_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_ae_event_date"
    ON "apps_kuaicaiwu_accounting_events" ("event_date");
COMMENT ON TABLE "apps_kuaicaiwu_accounting_events" IS '管理会计 - 会计事件链路记录';
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
DROP TABLE IF EXISTS "apps_kuaicaiwu_accounting_events";
"""
