"""部门管理 — 数据集关联表 core_department_dataset_binding。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "core_department_dataset_binding" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "dataset_uuid" VARCHAR(36),
            "department_name_column" VARCHAR(128),
            "department_code_column" VARCHAR(128),
            "parent_ref_column" VARCHAR(128),
            "description_column" VARCHAR(128),
            "sort_order_column" VARCHAR(128),
            "is_active_column" VARCHAR(128)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "ux_core_dept_ds_bind_tenant"
            ON "core_department_dataset_binding" ("tenant_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "core_department_dataset_binding" CASCADE;
    """
