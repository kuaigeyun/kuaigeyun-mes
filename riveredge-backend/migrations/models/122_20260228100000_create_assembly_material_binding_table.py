from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_assembly_material_bindings" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "assembly_order_id" INT NOT NULL,
            "assembly_order_item_id" INT,
            "parent_material_id" INT NOT NULL,
            "parent_material_code" VARCHAR(50) NOT NULL,
            "parent_material_name" VARCHAR(200) NOT NULL,
            "parent_batch_no" VARCHAR(100),
            "child_material_id" INT NOT NULL,
            "child_material_code" VARCHAR(50) NOT NULL,
            "child_material_name" VARCHAR(200) NOT NULL,
            "child_batch_no" VARCHAR(100) NOT NULL,
            "quantity" DECIMAL(12,2) NOT NULL,
            "executed_by" INT NOT NULL,
            "executed_by_name" VARCHAR(100) NOT NULL,
            "executed_at" TIMESTAMPTZ NOT NULL,
            "remarks" TEXT,
            "deleted_at" TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS "idx_asm_binding_tenant_id" ON "apps_kuaizhizao_assembly_material_bindings" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_asm_binding_assembly_order_id" ON "apps_kuaizhizao_assembly_material_bindings" ("assembly_order_id");
        CREATE INDEX IF NOT EXISTS "idx_asm_binding_assembly_order_item_id" ON "apps_kuaizhizao_assembly_material_bindings" ("assembly_order_item_id");
        CREATE INDEX IF NOT EXISTS "idx_asm_binding_parent_material_id" ON "apps_kuaizhizao_assembly_material_bindings" ("parent_material_id");
        CREATE INDEX IF NOT EXISTS "idx_asm_binding_child_material_id" ON "apps_kuaizhizao_assembly_material_bindings" ("child_material_id");
        CREATE INDEX IF NOT EXISTS "idx_asm_binding_executed_at" ON "apps_kuaizhizao_assembly_material_bindings" ("executed_at");

        COMMENT ON TABLE "apps_kuaizhizao_assembly_material_bindings" IS '快格轻制造 - 装配物料绑定';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_assembly_material_bindings" CASCADE;
    """
