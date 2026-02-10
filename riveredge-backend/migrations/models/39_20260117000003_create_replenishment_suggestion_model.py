"""
创建补货建议模型

根据功能点3.2.5：库存预警和自动补货建议

包含：
1. apps_kuaizhizao_replenishment_suggestions - 补货建议

Author: Auto (AI Assistant)
Date: 2026-01-17
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：创建补货建议模型
    """
    return """
        -- ============================================
        -- 1. 创建补货建议表（apps_kuaizhizao_replenishment_suggestions）
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_replenishment_suggestions" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "material_id" INT NOT NULL,
            "material_code" VARCHAR(50) NOT NULL,
            "material_name" VARCHAR(200) NOT NULL,
            "warehouse_id" INT NOT NULL,
            "warehouse_name" VARCHAR(200) NOT NULL,
            "current_quantity" DECIMAL(12,2) NOT NULL,
            "safety_stock" DECIMAL(12,2),
            "min_stock" DECIMAL(12,2),
            "max_stock" DECIMAL(12,2),
            "suggested_quantity" DECIMAL(12,2) NOT NULL,
            "priority" VARCHAR(20) NOT NULL DEFAULT 'medium',
            "suggestion_type" VARCHAR(20) NOT NULL DEFAULT 'low_stock',
            "estimated_delivery_days" INT,
            "suggested_order_date" TIMESTAMPTZ,
            "supplier_id" INT,
            "supplier_name" VARCHAR(200),
            "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
            "processed_by" INT,
            "processed_by_name" VARCHAR(100),
            "processed_at" TIMESTAMPTZ,
            "processing_notes" TEXT,
            "alert_id" INT,
            "related_demand_id" INT,
            "related_demand_code" VARCHAR(50),
            "remarks" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__sug_39a1b2" 
        ON "apps_kuaizhizao_replenishment_suggestions" ("tenant_id");
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_materia_39b1c3" 
        ON "apps_kuaizhizao_replenishment_suggestions" ("material_id");
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_warehou_39c1d4" 
        ON "apps_kuaizhizao_replenishment_suggestions" ("warehouse_id");
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status__39d1e5" 
        ON "apps_kuaizhizao_replenishment_suggestions" ("status");
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_priorit_39e1f6" 
        ON "apps_kuaizhizao_replenishment_suggestions" ("priority");
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_suggest_39f1g7" 
        ON "apps_kuaizhizao_replenishment_suggestions" ("suggestion_type");
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_created_39g1h8" 
        ON "apps_kuaizhizao_replenishment_suggestions" ("created_at");
        
        COMMENT ON TABLE "apps_kuaizhizao_replenishment_suggestions" IS '快格轻制造 - 补货建议';
        COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
        COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."tenant_id" IS '租户ID';
        COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."material_id" IS '物料ID';
        COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."material_code" IS '物料编码';
        COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."material_name" IS '物料名称';
        COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."warehouse_id" IS '仓库ID';
        COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."warehouse_name" IS '仓库名称';
        COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."current_quantity" IS '当前库存数量';
        COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."safety_stock" IS '安全库存';
        COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."min_stock" IS '最低库存';
        COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."max_stock" IS '最高库存';
        COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."suggested_quantity" IS '建议补货数量';
        COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."priority" IS '优先级（high/medium/low）';
        COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."suggestion_type" IS '建议类型（low_stock/demand_based/seasonal）';
        COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."estimated_delivery_days" IS '预计交货天数';
        COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."suggested_order_date" IS '建议下单日期';
        COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."supplier_id" IS '供应商ID';
        COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."supplier_name" IS '供应商名称';
        COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."status" IS '状态（pending/processed/ignored）';
        COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."processed_by" IS '处理人ID';
        COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."processed_by_name" IS '处理人姓名';
        COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."processed_at" IS '处理时间';
        COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."processing_notes" IS '处理备注';
        COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."alert_id" IS '关联的预警ID';
        COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."related_demand_id" IS '关联的需求ID';
        COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."related_demand_code" IS '关联的需求编码';
        COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."remarks" IS '备注';
        COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."deleted_at" IS '删除时间（软删除）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除补货建议模型
    """
    return """
        -- 删除索引
        DROP INDEX IF EXISTS "idx_apps_kuaizh_created_39g1h8";
        DROP INDEX IF EXISTS "idx_apps_kuaizh_suggest_39f1g7";
        DROP INDEX IF EXISTS "idx_apps_kuaizh_priorit_39e1f6";
        DROP INDEX IF EXISTS "idx_apps_kuaizh_status__39d1e5";
        DROP INDEX IF EXISTS "idx_apps_kuaizh_warehou_39c1d4";
        DROP INDEX IF EXISTS "idx_apps_kuaizh_materia_39b1c3";
        DROP INDEX IF EXISTS "idx_apps_kuaizh_tenant__sug_39a1b2";
        
        -- 删除表
        DROP TABLE IF EXISTS "apps_kuaizhizao_replenishment_suggestions";
    """
