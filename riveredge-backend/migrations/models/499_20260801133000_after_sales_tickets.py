from tortoise import BaseDBAsyncClient


RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_after_sales_tickets" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "ticket_code" VARCHAR(50) NOT NULL,
            "customer_id" INT NOT NULL,
            "customer_name" VARCHAR(200) NOT NULL,
            "sales_order_id" INT,
            "sales_order_code" VARCHAR(50),
            "sales_delivery_id" INT,
            "sales_delivery_code" VARCHAR(50),
            "sales_return_id" INT,
            "sales_return_code" VARCHAR(50),
            "request_type" VARCHAR(20) NOT NULL,
            "status" VARCHAR(20) NOT NULL DEFAULT '待处理',
            "content" TEXT NOT NULL,
            "resolution" TEXT,
            "material_code" VARCHAR(100),
            "material_name" VARCHAR(200),
            "batch_no" VARCHAR(100),
            "quantity" DECIMAL(14,4),
            "claim_amount" DECIMAL(14,2),
            "registered_at" TIMESTAMPTZ NOT NULL,
            "closed_at" TIMESTAMPTZ,
            "deleted_at" TIMESTAMPTZ
        );
        COMMENT ON TABLE "apps_kuaizhizao_after_sales_tickets" IS '快格轻制造 - 售后服务工单';
        CREATE INDEX IF NOT EXISTS "idx_after_sales_ticket_code"
            ON "apps_kuaizhizao_after_sales_tickets" ("tenant_id", "ticket_code");
        CREATE INDEX IF NOT EXISTS "idx_after_sales_ticket_customer"
            ON "apps_kuaizhizao_after_sales_tickets" ("tenant_id", "customer_id");
        CREATE INDEX IF NOT EXISTS "idx_after_sales_ticket_status"
            ON "apps_kuaizhizao_after_sales_tickets" ("tenant_id", "status");
        CREATE INDEX IF NOT EXISTS "idx_after_sales_ticket_registered"
            ON "apps_kuaizhizao_after_sales_tickets" ("tenant_id", "registered_at");
        CREATE INDEX IF NOT EXISTS "idx_after_sales_ticket_sales_order"
            ON "apps_kuaizhizao_after_sales_tickets" ("tenant_id", "sales_order_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_after_sales_tickets";
    """
