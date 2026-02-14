"""
创建单据关联关系表

创建 apps_kuaizhizao_document_relations 表，用于存储需求计算、生产计划、工单等单据之间的关联关系。
迁移 74 已引用此表添加注释，但表从未被创建，导致下推生产计划时报 OperationalError。

Author: Debug fix
Date: 2026-02-14
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_document_relations" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "source_type" VARCHAR(50) NOT NULL,
            "source_id" INT NOT NULL,
            "source_code" VARCHAR(50),
            "source_name" VARCHAR(200),
            "target_type" VARCHAR(50) NOT NULL,
            "target_id" INT NOT NULL,
            "target_code" VARCHAR(50),
            "target_name" VARCHAR(200),
            "relation_type" VARCHAR(20) NOT NULL,
            "relation_mode" VARCHAR(20) NOT NULL DEFAULT 'push',
            "relation_desc" VARCHAR(200),
            "business_mode" VARCHAR(20),
            "demand_id" INT,
            "notes" TEXT,
            "created_by" INT,
            CONSTRAINT "uid_apps_kuaizhizao_doc_rel_tenant_src_tgt" UNIQUE ("tenant_id", "source_type", "source_id", "target_type", "target_id")
        );

        CREATE INDEX IF NOT EXISTS "idx_doc_rel_tenant_source" ON "apps_kuaizhizao_document_relations" ("tenant_id", "source_type", "source_id");
        CREATE INDEX IF NOT EXISTS "idx_doc_rel_tenant_target" ON "apps_kuaizhizao_document_relations" ("tenant_id", "target_type", "target_id");
        CREATE INDEX IF NOT EXISTS "idx_doc_rel_tenant_relation_type" ON "apps_kuaizhizao_document_relations" ("tenant_id", "relation_type");
        CREATE INDEX IF NOT EXISTS "idx_doc_rel_tenant_demand_id" ON "apps_kuaizhizao_document_relations" ("tenant_id", "demand_id");
        CREATE INDEX IF NOT EXISTS "idx_doc_rel_source" ON "apps_kuaizhizao_document_relations" ("source_type", "source_id");
        CREATE INDEX IF NOT EXISTS "idx_doc_rel_target" ON "apps_kuaizhizao_document_relations" ("target_type", "target_id");

        COMMENT ON TABLE "apps_kuaizhizao_document_relations" IS '快格轻制造 - 单据关联关系';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_document_relations" CASCADE;
    """
