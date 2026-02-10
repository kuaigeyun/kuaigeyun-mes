"""
数据库迁移：创建采购申请表及明细表

创建 apps_kuaizhizao_purchase_requisitions 和 apps_kuaizhizao_purchase_requisition_items，
作为需求计算与采购订单之间的可选中间层。

Author: RiverEdge Team
Date: 2025-02-01
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    执行迁移：创建采购申请表及明细表。
    """
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_purchase_requisitions" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "requisition_code" VARCHAR(50) NOT NULL UNIQUE,
            "requisition_name" VARCHAR(200),
            "status" VARCHAR(20) NOT NULL DEFAULT '草稿',
            "applicant_id" INT,
            "applicant_name" VARCHAR(100),
            "requisition_date" DATE,
            "required_date" DATE,
            "source_type" VARCHAR(50),
            "source_id" INT,
            "source_code" VARCHAR(50),
            "is_urgent" BOOLEAN NOT NULL DEFAULT false,
            "urgent_reason" TEXT,
            "urgent_operator_id" INT,
            "urgent_operated_at" TIMESTAMPTZ,
            "reviewer_id" INT,
            "reviewer_name" VARCHAR(100),
            "review_time" TIMESTAMPTZ,
            "review_status" VARCHAR(20) NOT NULL DEFAULT '待审核',
            "review_remarks" TEXT,
            "notes" TEXT,
            "created_by" INT,
            "updated_by" INT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_pr_tenant_status" ON "apps_kuaizhizao_purchase_requisitions" ("tenant_id", "status");
        CREATE INDEX IF NOT EXISTS "idx_pr_source" ON "apps_kuaizhizao_purchase_requisitions" ("source_type", "source_id");
        CREATE INDEX IF NOT EXISTS "idx_pr_code" ON "apps_kuaizhizao_purchase_requisitions" ("requisition_code");
        COMMENT ON TABLE "apps_kuaizhizao_purchase_requisitions" IS '快格轻制造 - 采购申请';

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_purchase_requisition_items" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "requisition_id" INT NOT NULL,
            "material_id" INT NOT NULL,
            "material_code" VARCHAR(50) NOT NULL,
            "material_name" VARCHAR(200) NOT NULL,
            "material_spec" VARCHAR(200),
            "unit" VARCHAR(20) NOT NULL DEFAULT '件',
            "quantity" DECIMAL(10,2) NOT NULL,
            "suggested_unit_price" DECIMAL(10,4) NOT NULL DEFAULT 0,
            "required_date" DATE,
            "demand_computation_item_id" INT,
            "purchase_order_id" INT,
            "purchase_order_item_id" INT,
            "supplier_id" INT,
            "notes" TEXT
        );
        CREATE INDEX IF NOT EXISTS "idx_pri_tenant_requisition" ON "apps_kuaizhizao_purchase_requisition_items" ("tenant_id", "requisition_id");
        CREATE INDEX IF NOT EXISTS "idx_pri_supplier" ON "apps_kuaizhizao_purchase_requisition_items" ("tenant_id", "supplier_id");
        CREATE INDEX IF NOT EXISTS "idx_pri_po" ON "apps_kuaizhizao_purchase_requisition_items" ("purchase_order_id");
        COMMENT ON TABLE "apps_kuaizhizao_purchase_requisition_items" IS '快格轻制造 - 采购申请明细';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """降级：删除采购申请表"""
    return """
        DROP INDEX IF EXISTS "idx_pri_po";
        DROP INDEX IF EXISTS "idx_pri_supplier";
        DROP INDEX IF EXISTS "idx_pri_tenant_requisition";
        DROP TABLE IF EXISTS "apps_kuaizhizao_purchase_requisition_items";
        DROP INDEX IF EXISTS "idx_pr_code";
        DROP INDEX IF EXISTS "idx_pr_source";
        DROP INDEX IF EXISTS "idx_pr_tenant_status";
        DROP TABLE IF EXISTS "apps_kuaizhizao_purchase_requisitions";
    """
