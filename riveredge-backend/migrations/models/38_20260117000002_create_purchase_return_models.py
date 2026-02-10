"""
创建采购退货模型

根据功能点3.2.4：采购退货流程

包含：
1. apps_kuaizhizao_purchase_returns - 采购退货单
2. apps_kuaizhizao_purchase_return_items - 采购退货单明细

Author: Auto (AI Assistant)
Date: 2026-01-17
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：创建采购退货模型
    """
    return """
        -- ============================================
        -- 1. 创建采购退货单表（apps_kuaizhizao_purchase_returns）
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_purchase_returns" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "return_code" VARCHAR(50) NOT NULL UNIQUE,
            "purchase_receipt_id" INT,
            "purchase_receipt_code" VARCHAR(50),
            "purchase_order_id" INT,
            "purchase_order_code" VARCHAR(50),
            "supplier_id" INT NOT NULL,
            "supplier_name" VARCHAR(200) NOT NULL,
            "warehouse_id" INT NOT NULL,
            "warehouse_name" VARCHAR(100) NOT NULL,
            "return_time" TIMESTAMPTZ,
            "returner_id" INT,
            "returner_name" VARCHAR(100),
            "reviewer_id" INT,
            "reviewer_name" VARCHAR(100),
            "review_time" TIMESTAMPTZ,
            "review_status" VARCHAR(20) NOT NULL DEFAULT '待审核',
            "review_remarks" TEXT,
            "return_reason" VARCHAR(200),
            "return_type" VARCHAR(20) NOT NULL DEFAULT '质量问题',
            "status" VARCHAR(20) NOT NULL DEFAULT '待退货',
            "total_quantity" DECIMAL(10,2) NOT NULL DEFAULT 0,
            "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "shipping_method" VARCHAR(50),
            "tracking_number" VARCHAR(100),
            "shipping_address" TEXT,
            "notes" TEXT,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "created_by" INT,
            "updated_by" INT,
            "deleted_at" TIMESTAMPTZ
        );
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant_p_return_38a1b2" 
        ON "apps_kuaizhizao_purchase_returns" ("tenant_id");
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_return_c_38b1c3" 
        ON "apps_kuaizhizao_purchase_returns" ("return_code");
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_purchas_r_38c1d4" 
        ON "apps_kuaizhizao_purchase_returns" ("purchase_receipt_id");
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_purchas_o_38d1e5" 
        ON "apps_kuaizhizao_purchase_returns" ("purchase_order_id");
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_supplie_38e1f6" 
        ON "apps_kuaizhizao_purchase_returns" ("supplier_id");
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_warehou_38f1g7" 
        ON "apps_kuaizhizao_purchase_returns" ("warehouse_id");
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status__38g1h8" 
        ON "apps_kuaizhizao_purchase_returns" ("status");
        
        COMMENT ON TABLE "apps_kuaizhizao_purchase_returns" IS '快格轻制造 - 采购退货单';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_returns"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_returns"."tenant_id" IS '租户ID';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_returns"."return_code" IS '退货单编码';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_returns"."purchase_receipt_id" IS '采购入库单ID';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_returns"."purchase_receipt_code" IS '采购入库单编码';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_returns"."purchase_order_id" IS '采购订单ID';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_returns"."purchase_order_code" IS '采购订单编码';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_returns"."supplier_id" IS '供应商ID';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_returns"."supplier_name" IS '供应商名称';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_returns"."warehouse_id" IS '退货出库仓库ID';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_returns"."warehouse_name" IS '退货出库仓库名称';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_returns"."return_time" IS '实际退货时间';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_returns"."returner_id" IS '退货人ID';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_returns"."returner_name" IS '退货人姓名';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_returns"."reviewer_id" IS '审核人ID';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_returns"."reviewer_name" IS '审核人姓名';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_returns"."review_time" IS '审核时间';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_returns"."review_status" IS '审核状态';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_returns"."review_remarks" IS '审核备注';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_returns"."return_reason" IS '退货原因';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_returns"."return_type" IS '退货类型（质量问题/供应商取消/其他）';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_returns"."status" IS '退货状态';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_returns"."total_quantity" IS '总退货数量';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_returns"."total_amount" IS '总金额';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_returns"."shipping_method" IS '退货方式';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_returns"."tracking_number" IS '物流单号';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_returns"."shipping_address" IS '退货地址';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_returns"."notes" IS '备注';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_returns"."is_active" IS '是否有效';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_returns"."created_by" IS '创建人ID';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_returns"."updated_by" IS '更新人ID';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_returns"."deleted_at" IS '删除时间';
        
        -- ============================================
        -- 2. 创建采购退货单明细表（apps_kuaizhizao_purchase_return_items）
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_purchase_return_items" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "return_id" INT NOT NULL,
            "purchase_receipt_item_id" INT,
            "material_id" INT NOT NULL,
            "material_code" VARCHAR(50) NOT NULL,
            "material_name" VARCHAR(200) NOT NULL,
            "material_spec" VARCHAR(200),
            "material_unit" VARCHAR(20) NOT NULL,
            "return_quantity" DECIMAL(10,2) NOT NULL,
            "unit_price" DECIMAL(10,2) NOT NULL,
            "total_amount" DECIMAL(12,2) NOT NULL,
            "location_id" INT,
            "location_code" VARCHAR(50),
            "batch_number" VARCHAR(50),
            "expiry_date" DATE,
            "serial_numbers" JSONB,
            "status" VARCHAR(20) NOT NULL DEFAULT '待退货',
            "return_time" TIMESTAMPTZ,
            "notes" TEXT
        );
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant_r_38h1i9" 
        ON "apps_kuaizhizao_purchase_return_items" ("tenant_id", "return_id");
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_purchas_r_38i1j0" 
        ON "apps_kuaizhizao_purchase_return_items" ("purchase_receipt_item_id");
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_materia_38j1k1" 
        ON "apps_kuaizhizao_purchase_return_items" ("material_id");
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_locatio_38k1l2" 
        ON "apps_kuaizhizao_purchase_return_items" ("location_id");
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_batch_n_38l1m3" 
        ON "apps_kuaizhizao_purchase_return_items" ("batch_number");
        
        COMMENT ON TABLE "apps_kuaizhizao_purchase_return_items" IS '快格轻制造 - 采购退货单明细';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_return_items"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_return_items"."tenant_id" IS '租户ID';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_return_items"."return_id" IS '退货单ID';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_return_items"."purchase_receipt_item_id" IS '采购入库单明细ID';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_return_items"."material_id" IS '物料ID';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_return_items"."material_code" IS '物料编码';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_return_items"."material_name" IS '物料名称';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_return_items"."material_spec" IS '物料规格';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_return_items"."material_unit" IS '物料单位';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_return_items"."return_quantity" IS '退货数量';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_return_items"."unit_price" IS '单价';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_return_items"."total_amount" IS '金额';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_return_items"."location_id" IS '库位ID';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_return_items"."location_code" IS '库位编码';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_return_items"."batch_number" IS '批次号';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_return_items"."expiry_date" IS '到期日期';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_return_items"."serial_numbers" IS '序列号列表（JSON格式，存储多个序列号）';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_return_items"."status" IS '退货状态';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_return_items"."return_time" IS '实际退货时间';
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_return_items"."notes" IS '备注';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除采购退货模型
    """
    return """
        -- 删除索引
        DROP INDEX IF EXISTS "idx_apps_kuaizh_batch_n_38l1m3";
        DROP INDEX IF EXISTS "idx_apps_kuaizh_locatio_38k1l2";
        DROP INDEX IF EXISTS "idx_apps_kuaizh_materia_38j1k1";
        DROP INDEX IF EXISTS "idx_apps_kuaizh_purchas_r_38i1j0";
        DROP INDEX IF EXISTS "idx_apps_kuaizh_tenant_r_38h1i9";
        
        DROP INDEX IF EXISTS "idx_apps_kuaizh_status__38g1h8";
        DROP INDEX IF EXISTS "idx_apps_kuaizh_warehou_38f1g7";
        DROP INDEX IF EXISTS "idx_apps_kuaizh_supplie_38e1f6";
        DROP INDEX IF EXISTS "idx_apps_kuaizh_purchas_o_38d1e5";
        DROP INDEX IF EXISTS "idx_apps_kuaizh_purchas_r_38c1d4";
        DROP INDEX IF EXISTS "idx_apps_kuaizh_return_c_38b1c3";
        DROP INDEX IF EXISTS "idx_apps_kuaizh_tenant_p_return_38a1b2";
        
        -- 删除表
        DROP TABLE IF EXISTS "apps_kuaizhizao_purchase_return_items";
        DROP TABLE IF EXISTS "apps_kuaizhizao_purchase_returns";
    """
