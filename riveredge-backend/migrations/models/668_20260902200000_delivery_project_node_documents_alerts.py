"""交付项目：节点关联单据 + 预警去重表"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_delivery_project_node_documents" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "project_id" INT NOT NULL,
            "node_id" INT NOT NULL,
            "doc_type" VARCHAR(50) NOT NULL,
            "doc_id" INT NOT NULL,
            "doc_code" VARCHAR(100) NOT NULL,
            "title" VARCHAR(200),
            "linked_at" TIMESTAMPTZ NOT NULL,
            "linked_by" INT,
            "linked_by_name" VARCHAR(100),
            "deleted_at" TIMESTAMPTZ,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100)
        );
        CREATE INDEX IF NOT EXISTS "idx_dp_node_docs_tenant_project"
            ON "apps_kuaizhizao_delivery_project_node_documents" ("tenant_id", "project_id");
        CREATE INDEX IF NOT EXISTS "idx_dp_node_docs_tenant_node"
            ON "apps_kuaizhizao_delivery_project_node_documents" ("tenant_id", "node_id");
        CREATE INDEX IF NOT EXISTS "idx_dp_node_docs_tenant_doc"
            ON "apps_kuaizhizao_delivery_project_node_documents" ("tenant_id", "doc_type", "doc_id");
        CREATE INDEX IF NOT EXISTS "idx_dp_node_docs_uuid"
            ON "apps_kuaizhizao_delivery_project_node_documents" ("uuid");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_delivery_project_node_alert_sent" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "dedup_key" VARCHAR(200) NOT NULL,
            "sent_at" TIMESTAMPTZ NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            CONSTRAINT "uid_dp_node_alert_dedup" UNIQUE ("tenant_id", "dedup_key")
        );
        CREATE INDEX IF NOT EXISTS "idx_dp_node_alert_tenant_sent"
            ON "apps_kuaizhizao_delivery_project_node_alert_sent" ("tenant_id", "sent_at");
        CREATE INDEX IF NOT EXISTS "idx_dp_node_alert_uuid"
            ON "apps_kuaizhizao_delivery_project_node_alert_sent" ("uuid");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_delivery_project_node_alert_sent";
        DROP TABLE IF EXISTS "apps_kuaizhizao_delivery_project_node_documents";
    """
