"""
数据库迁移：创建线边仓库存表和物料倒冲记录表

创建 apps_kuaizhizao_line_side_inventory 和 apps_kuaizhizao_backflush_records，
支持线边仓管理和物料倒冲功能。

Author: RiverEdge Team
Date: 2026-02-02
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    执行迁移：创建线边仓库存表和物料倒冲记录表。
    """
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_line_side_inventory" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "warehouse_id" INT NOT NULL,
            "warehouse_name" VARCHAR(200),
            "material_id" INT NOT NULL,
            "material_code" VARCHAR(50) NOT NULL,
            "material_name" VARCHAR(200) NOT NULL,
            "material_spec" VARCHAR(500),
            "material_unit" VARCHAR(20),
            "batch_no" VARCHAR(100),
            "production_date" DATE,
            "expiry_date" DATE,
            "quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
            "reserved_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
            "work_order_id" INT,
            "work_order_code" VARCHAR(50),
            "source_type" VARCHAR(20),
            "source_doc_id" INT,
            "source_doc_code" VARCHAR(50),
            "status" VARCHAR(20) NOT NULL DEFAULT 'available',
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_lsi_tenant" ON "apps_kuaizhizao_line_side_inventory" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_lsi_warehouse" ON "apps_kuaizhizao_line_side_inventory" ("warehouse_id");
        CREATE INDEX IF NOT EXISTS "idx_lsi_material" ON "apps_kuaizhizao_line_side_inventory" ("material_id");
        CREATE INDEX IF NOT EXISTS "idx_lsi_batch" ON "apps_kuaizhizao_line_side_inventory" ("batch_no");
        CREATE INDEX IF NOT EXISTS "idx_lsi_work_order" ON "apps_kuaizhizao_line_side_inventory" ("work_order_id");
        COMMENT ON TABLE "apps_kuaizhizao_line_side_inventory" IS '快格轻制造 - 线边仓库存';

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_backflush_records" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "work_order_id" INT NOT NULL,
            "work_order_code" VARCHAR(50) NOT NULL,
            "operation_id" INT,
            "operation_code" VARCHAR(50),
            "report_id" INT NOT NULL,
            "report_quantity" DECIMAL(18,4) NOT NULL,
            "material_id" INT NOT NULL,
            "material_code" VARCHAR(50) NOT NULL,
            "material_name" VARCHAR(200) NOT NULL,
            "material_unit" VARCHAR(20),
            "batch_no" VARCHAR(100),
            "warehouse_id" INT NOT NULL,
            "warehouse_name" VARCHAR(200),
            "warehouse_type" VARCHAR(20),
            "bom_quantity" DECIMAL(18,4) NOT NULL,
            "backflush_quantity" DECIMAL(18,4) NOT NULL,
            "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
            "error_message" TEXT,
            "processed_at" TIMESTAMPTZ,
            "processed_by" INT,
            "processed_by_name" VARCHAR(100),
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_bfr_tenant" ON "apps_kuaizhizao_backflush_records" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_bfr_work_order" ON "apps_kuaizhizao_backflush_records" ("work_order_id");
        CREATE INDEX IF NOT EXISTS "idx_bfr_operation" ON "apps_kuaizhizao_backflush_records" ("operation_id");
        CREATE INDEX IF NOT EXISTS "idx_bfr_report" ON "apps_kuaizhizao_backflush_records" ("report_id");
        CREATE INDEX IF NOT EXISTS "idx_bfr_material" ON "apps_kuaizhizao_backflush_records" ("material_id");
        CREATE INDEX IF NOT EXISTS "idx_bfr_status" ON "apps_kuaizhizao_backflush_records" ("status");
        COMMENT ON TABLE "apps_kuaizhizao_backflush_records" IS '快格轻制造 - 物料倒冲记录';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    回滚迁移：删除线边仓库存表和物料倒冲记录表。
    """
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_backflush_records";
        DROP TABLE IF EXISTS "apps_kuaizhizao_line_side_inventory";
    """
