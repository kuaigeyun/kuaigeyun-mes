from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "seed_kuaiwms_inventories" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "material_id" INT NOT NULL,
    "warehouse_id" INT NOT NULL,
    "location_id" INT,
    "quantity" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "available_quantity" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "reserved_quantity" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "in_transit_quantity" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "unit" VARCHAR(20),
    "batch_no" VARCHAR(50),
    "lot_no" VARCHAR(50),
    "expiry_date" TIMESTAMPTZ,
    "cost_price" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "total_cost" DECIMAL(18,2) NOT NULL  DEFAULT 0,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_seed_kuaiwm_tenant__d7fdf1" UNIQUE ("tenant_id", "material_id", "warehouse_id", "location_id", "batch_no")
);
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_tenant__a81c54" ON "seed_kuaiwms_inventories" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_materia_15c639" ON "seed_kuaiwms_inventories" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_warehou_e446e0" ON "seed_kuaiwms_inventories" ("warehouse_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_locatio_addedf" ON "seed_kuaiwms_inventories" ("location_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_uuid_b7903d" ON "seed_kuaiwms_inventories" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_batch_n_3b2cd8" ON "seed_kuaiwms_inventories" ("batch_no");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_lot_no_b3479f" ON "seed_kuaiwms_inventories" ("lot_no");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_created_137cbf" ON "seed_kuaiwms_inventories" ("created_at");
COMMENT ON COLUMN "seed_kuaiwms_inventories"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "seed_kuaiwms_inventories"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "seed_kuaiwms_inventories"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "seed_kuaiwms_inventories"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "seed_kuaiwms_inventories"."id" IS '主键ID';
COMMENT ON COLUMN "seed_kuaiwms_inventories"."material_id" IS '物料ID（关联master-data）';
COMMENT ON COLUMN "seed_kuaiwms_inventories"."warehouse_id" IS '仓库ID（关联master-data）';
COMMENT ON COLUMN "seed_kuaiwms_inventories"."location_id" IS '库位ID（关联master-data，可选）';
COMMENT ON COLUMN "seed_kuaiwms_inventories"."quantity" IS '库存数量';
COMMENT ON COLUMN "seed_kuaiwms_inventories"."available_quantity" IS '可用数量';
COMMENT ON COLUMN "seed_kuaiwms_inventories"."reserved_quantity" IS '预留数量';
COMMENT ON COLUMN "seed_kuaiwms_inventories"."in_transit_quantity" IS '在途数量';
COMMENT ON COLUMN "seed_kuaiwms_inventories"."unit" IS '单位';
COMMENT ON COLUMN "seed_kuaiwms_inventories"."batch_no" IS '批次号（可选）';
COMMENT ON COLUMN "seed_kuaiwms_inventories"."lot_no" IS '批次号（可选）';
COMMENT ON COLUMN "seed_kuaiwms_inventories"."expiry_date" IS '有效期（可选）';
COMMENT ON COLUMN "seed_kuaiwms_inventories"."cost_price" IS '成本单价';
COMMENT ON COLUMN "seed_kuaiwms_inventories"."total_cost" IS '总成本';
COMMENT ON COLUMN "seed_kuaiwms_inventories"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "seed_kuaiwms_inventories" IS '库存模型';;
        CREATE TABLE IF NOT EXISTS "seed_kuaiwms_inbound_orders" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "order_no" VARCHAR(50) NOT NULL,
    "order_date" TIMESTAMPTZ NOT NULL,
    "order_type" VARCHAR(50) NOT NULL,
    "warehouse_id" INT NOT NULL,
    "status" VARCHAR(50) NOT NULL  DEFAULT '草稿',
    "total_amount" DECIMAL(18,2) NOT NULL  DEFAULT 0,
    "source_order_id" INT,
    "source_order_no" VARCHAR(50),
    "order_items" JSONB,
    "remark" TEXT,
    "owner_id" INT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_seed_kuaiwm_tenant__d9b441" UNIQUE ("tenant_id", "order_no")
);
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_tenant__503cb7" ON "seed_kuaiwms_inbound_orders" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_order_n_367a1c" ON "seed_kuaiwms_inbound_orders" ("order_no");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_uuid_bab51e" ON "seed_kuaiwms_inbound_orders" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_status_221cc2" ON "seed_kuaiwms_inbound_orders" ("status");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_order_t_4a2973" ON "seed_kuaiwms_inbound_orders" ("order_type");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_warehou_e5ef8b" ON "seed_kuaiwms_inbound_orders" ("warehouse_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_order_d_862fe5" ON "seed_kuaiwms_inbound_orders" ("order_date");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_source__a271c5" ON "seed_kuaiwms_inbound_orders" ("source_order_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_created_b62c4c" ON "seed_kuaiwms_inbound_orders" ("created_at");
COMMENT ON COLUMN "seed_kuaiwms_inbound_orders"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "seed_kuaiwms_inbound_orders"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "seed_kuaiwms_inbound_orders"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "seed_kuaiwms_inbound_orders"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "seed_kuaiwms_inbound_orders"."id" IS '主键ID';
COMMENT ON COLUMN "seed_kuaiwms_inbound_orders"."order_no" IS '入库单编号（组织内唯一）';
COMMENT ON COLUMN "seed_kuaiwms_inbound_orders"."order_date" IS '入库日期';
COMMENT ON COLUMN "seed_kuaiwms_inbound_orders"."order_type" IS '入库类型（采购入库、生产入库、退货入库、委外入库、调拨入库）';
COMMENT ON COLUMN "seed_kuaiwms_inbound_orders"."warehouse_id" IS '仓库ID（关联master-data）';
COMMENT ON COLUMN "seed_kuaiwms_inbound_orders"."status" IS '入库状态（草稿、待质检、质检中、已质检、执行中、部分入库、已完成、已关闭、已取消）';
COMMENT ON COLUMN "seed_kuaiwms_inbound_orders"."total_amount" IS '入库总金额';
COMMENT ON COLUMN "seed_kuaiwms_inbound_orders"."source_order_id" IS '来源订单ID（采购订单、生产订单等）';
COMMENT ON COLUMN "seed_kuaiwms_inbound_orders"."source_order_no" IS '来源订单编号';
COMMENT ON COLUMN "seed_kuaiwms_inbound_orders"."order_items" IS '入库明细（JSON格式）';
COMMENT ON COLUMN "seed_kuaiwms_inbound_orders"."remark" IS '备注';
COMMENT ON COLUMN "seed_kuaiwms_inbound_orders"."owner_id" IS '负责人ID（用户ID）';
COMMENT ON COLUMN "seed_kuaiwms_inbound_orders"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "seed_kuaiwms_inbound_orders" IS '入库单模型';;
        CREATE TABLE IF NOT EXISTS "seed_kuaiwms_outbound_orders" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "order_no" VARCHAR(50) NOT NULL,
    "order_date" TIMESTAMPTZ NOT NULL,
    "order_type" VARCHAR(50) NOT NULL,
    "warehouse_id" INT NOT NULL,
    "status" VARCHAR(50) NOT NULL  DEFAULT '草稿',
    "total_amount" DECIMAL(18,2) NOT NULL  DEFAULT 0,
    "source_order_id" INT,
    "source_order_no" VARCHAR(50),
    "picking_status" VARCHAR(50),
    "order_items" JSONB,
    "remark" TEXT,
    "owner_id" INT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_seed_kuaiwm_tenant__8d7f52" UNIQUE ("tenant_id", "order_no")
);
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_tenant__22a0dc" ON "seed_kuaiwms_outbound_orders" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_order_n_6f86a9" ON "seed_kuaiwms_outbound_orders" ("order_no");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_uuid_7063c4" ON "seed_kuaiwms_outbound_orders" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_status_2d2059" ON "seed_kuaiwms_outbound_orders" ("status");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_order_t_b2befe" ON "seed_kuaiwms_outbound_orders" ("order_type");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_warehou_6f5dae" ON "seed_kuaiwms_outbound_orders" ("warehouse_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_order_d_8c34dd" ON "seed_kuaiwms_outbound_orders" ("order_date");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_source__48bc2b" ON "seed_kuaiwms_outbound_orders" ("source_order_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_picking_cca730" ON "seed_kuaiwms_outbound_orders" ("picking_status");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_created_f1d942" ON "seed_kuaiwms_outbound_orders" ("created_at");
COMMENT ON COLUMN "seed_kuaiwms_outbound_orders"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "seed_kuaiwms_outbound_orders"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "seed_kuaiwms_outbound_orders"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "seed_kuaiwms_outbound_orders"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "seed_kuaiwms_outbound_orders"."id" IS '主键ID';
COMMENT ON COLUMN "seed_kuaiwms_outbound_orders"."order_no" IS '出库单编号（组织内唯一）';
COMMENT ON COLUMN "seed_kuaiwms_outbound_orders"."order_date" IS '出库日期';
COMMENT ON COLUMN "seed_kuaiwms_outbound_orders"."order_type" IS '出库类型（销售出库、生产领料、调拨出库、委外发料、其他出库）';
COMMENT ON COLUMN "seed_kuaiwms_outbound_orders"."warehouse_id" IS '仓库ID（关联master-data）';
COMMENT ON COLUMN "seed_kuaiwms_outbound_orders"."status" IS '出库状态（草稿、待拣货、拣货中、已拣货、执行中、部分出库、已完成、已关闭、已取消）';
COMMENT ON COLUMN "seed_kuaiwms_outbound_orders"."total_amount" IS '出库总金额';
COMMENT ON COLUMN "seed_kuaiwms_outbound_orders"."source_order_id" IS '来源订单ID（销售订单、生产订单等）';
COMMENT ON COLUMN "seed_kuaiwms_outbound_orders"."source_order_no" IS '来源订单编号';
COMMENT ON COLUMN "seed_kuaiwms_outbound_orders"."picking_status" IS '拣货状态（待拣货、拣货中、已拣货）';
COMMENT ON COLUMN "seed_kuaiwms_outbound_orders"."order_items" IS '出库明细（JSON格式）';
COMMENT ON COLUMN "seed_kuaiwms_outbound_orders"."remark" IS '备注';
COMMENT ON COLUMN "seed_kuaiwms_outbound_orders"."owner_id" IS '负责人ID（用户ID）';
COMMENT ON COLUMN "seed_kuaiwms_outbound_orders"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "seed_kuaiwms_outbound_orders" IS '出库单模型';;
        CREATE TABLE IF NOT EXISTS "seed_kuaiwms_stocktakes" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "stocktake_no" VARCHAR(50) NOT NULL,
    "stocktake_date" TIMESTAMPTZ NOT NULL,
    "warehouse_id" INT NOT NULL,
    "location_id" INT,
    "status" VARCHAR(50) NOT NULL  DEFAULT '草稿',
    "stocktake_type" VARCHAR(50) NOT NULL  DEFAULT '全盘',
    "stocktake_items" JSONB,
    "difference_amount" DECIMAL(18,2) NOT NULL  DEFAULT 0,
    "remark" TEXT,
    "owner_id" INT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_seed_kuaiwm_tenant__820d42" UNIQUE ("tenant_id", "stocktake_no")
);
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_tenant__7a3e02" ON "seed_kuaiwms_stocktakes" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_stockta_62977c" ON "seed_kuaiwms_stocktakes" ("stocktake_no");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_uuid_284743" ON "seed_kuaiwms_stocktakes" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_status_6c3939" ON "seed_kuaiwms_stocktakes" ("status");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_warehou_155629" ON "seed_kuaiwms_stocktakes" ("warehouse_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_locatio_9c081c" ON "seed_kuaiwms_stocktakes" ("location_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_stockta_a41e6c" ON "seed_kuaiwms_stocktakes" ("stocktake_date");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_created_09bfdc" ON "seed_kuaiwms_stocktakes" ("created_at");
COMMENT ON COLUMN "seed_kuaiwms_stocktakes"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "seed_kuaiwms_stocktakes"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "seed_kuaiwms_stocktakes"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "seed_kuaiwms_stocktakes"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "seed_kuaiwms_stocktakes"."id" IS '主键ID';
COMMENT ON COLUMN "seed_kuaiwms_stocktakes"."stocktake_no" IS '盘点单编号（组织内唯一）';
COMMENT ON COLUMN "seed_kuaiwms_stocktakes"."stocktake_date" IS '盘点日期';
COMMENT ON COLUMN "seed_kuaiwms_stocktakes"."warehouse_id" IS '仓库ID（关联master-data）';
COMMENT ON COLUMN "seed_kuaiwms_stocktakes"."location_id" IS '库位ID（关联master-data，可选，为空表示全库盘点）';
COMMENT ON COLUMN "seed_kuaiwms_stocktakes"."status" IS '盘点状态（草稿、进行中、已完成、已关闭）';
COMMENT ON COLUMN "seed_kuaiwms_stocktakes"."stocktake_type" IS '盘点类型（全盘、抽盘、循环盘点）';
COMMENT ON COLUMN "seed_kuaiwms_stocktakes"."stocktake_items" IS '盘点明细（JSON格式）';
COMMENT ON COLUMN "seed_kuaiwms_stocktakes"."difference_amount" IS '差异金额';
COMMENT ON COLUMN "seed_kuaiwms_stocktakes"."remark" IS '备注';
COMMENT ON COLUMN "seed_kuaiwms_stocktakes"."owner_id" IS '负责人ID（用户ID）';
COMMENT ON COLUMN "seed_kuaiwms_stocktakes"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "seed_kuaiwms_stocktakes" IS '盘点单模型';;
        CREATE TABLE IF NOT EXISTS "seed_kuaiwms_inventory_adjustments" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "adjustment_no" VARCHAR(50) NOT NULL,
    "adjustment_date" TIMESTAMPTZ NOT NULL,
    "warehouse_id" INT NOT NULL,
    "adjustment_type" VARCHAR(50) NOT NULL,
    "adjustment_reason" TEXT NOT NULL,
    "status" VARCHAR(50) NOT NULL  DEFAULT '草稿',
    "approval_instance_id" INT,
    "approval_status" VARCHAR(20),
    "adjustment_items" JSONB,
    "total_amount" DECIMAL(18,2) NOT NULL  DEFAULT 0,
    "owner_id" INT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_seed_kuaiwm_tenant__f1dd34" UNIQUE ("tenant_id", "adjustment_no")
);
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_tenant__97a6b1" ON "seed_kuaiwms_inventory_adjustments" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_adjustm_b47e7a" ON "seed_kuaiwms_inventory_adjustments" ("adjustment_no");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_uuid_f760a2" ON "seed_kuaiwms_inventory_adjustments" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_status_57513b" ON "seed_kuaiwms_inventory_adjustments" ("status");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_warehou_357083" ON "seed_kuaiwms_inventory_adjustments" ("warehouse_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_adjustm_e51c1c" ON "seed_kuaiwms_inventory_adjustments" ("adjustment_date");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_approva_9ee3c9" ON "seed_kuaiwms_inventory_adjustments" ("approval_instance_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_approva_9446fd" ON "seed_kuaiwms_inventory_adjustments" ("approval_status");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiwm_created_c83b69" ON "seed_kuaiwms_inventory_adjustments" ("created_at");
COMMENT ON COLUMN "seed_kuaiwms_inventory_adjustments"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "seed_kuaiwms_inventory_adjustments"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "seed_kuaiwms_inventory_adjustments"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "seed_kuaiwms_inventory_adjustments"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "seed_kuaiwms_inventory_adjustments"."id" IS '主键ID';
COMMENT ON COLUMN "seed_kuaiwms_inventory_adjustments"."adjustment_no" IS '调整单编号（组织内唯一）';
COMMENT ON COLUMN "seed_kuaiwms_inventory_adjustments"."adjustment_date" IS '调整日期';
COMMENT ON COLUMN "seed_kuaiwms_inventory_adjustments"."warehouse_id" IS '仓库ID（关联master-data）';
COMMENT ON COLUMN "seed_kuaiwms_inventory_adjustments"."adjustment_type" IS '调整类型（盘盈、盘亏、其他调整）';
COMMENT ON COLUMN "seed_kuaiwms_inventory_adjustments"."adjustment_reason" IS '调整原因';
COMMENT ON COLUMN "seed_kuaiwms_inventory_adjustments"."status" IS '调整状态（草稿、待审批、已审批、已执行、已关闭）';
COMMENT ON COLUMN "seed_kuaiwms_inventory_adjustments"."approval_instance_id" IS '审批实例ID（关联ApprovalInstance）';
COMMENT ON COLUMN "seed_kuaiwms_inventory_adjustments"."approval_status" IS '审批状态（pending、approved、rejected、cancelled）';
COMMENT ON COLUMN "seed_kuaiwms_inventory_adjustments"."adjustment_items" IS '调整明细（JSON格式）';
COMMENT ON COLUMN "seed_kuaiwms_inventory_adjustments"."total_amount" IS '调整总金额';
COMMENT ON COLUMN "seed_kuaiwms_inventory_adjustments"."owner_id" IS '负责人ID（用户ID）';
COMMENT ON COLUMN "seed_kuaiwms_inventory_adjustments"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "seed_kuaiwms_inventory_adjustments" IS '库存调整模型';;"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "seed_kuaiwms_inventories";
        DROP TABLE IF EXISTS "seed_kuaiwms_inbound_orders";
        DROP TABLE IF EXISTS "seed_kuaiwms_outbound_orders";
        DROP TABLE IF EXISTS "seed_kuaiwms_stocktakes";
        DROP TABLE IF EXISTS "seed_kuaiwms_inventory_adjustments";"""
