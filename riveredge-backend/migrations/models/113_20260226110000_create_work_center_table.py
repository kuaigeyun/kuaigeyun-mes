"""
创建工作中心表

为工厂数据新增工作中心主数据表，作为与厂区、车间、产线、工位同级的独立实体。

Author: AI Assistant
Date: 2026-02-26
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：创建工作中心表
    """
    return """
        -- ============================================
        -- 创建工作中心表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_master_data_work_centers" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "description" TEXT,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "deleted_at" TIMESTAMPTZ
        );

        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_work_centers_tenant_id" ON "apps_master_data_work_centers" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_work_centers_code" ON "apps_master_data_work_centers" ("code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_work_centers_uuid" ON "apps_master_data_work_centers" ("uuid");

        -- 创建部分唯一索引（支持软删除后重用编码）
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_work_centers_tenant_code"
        ON "apps_master_data_work_centers" ("tenant_id", "code")
        WHERE "deleted_at" IS NULL;

        -- 添加表注释和字段注释
        COMMENT ON TABLE "apps_master_data_work_centers" IS '工作中心模型 - 计划/产能单位，顶层实体';
        COMMENT ON COLUMN "apps_master_data_work_centers"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
        COMMENT ON COLUMN "apps_master_data_work_centers"."tenant_id" IS '组织ID（用于多组织数据隔离）';
        COMMENT ON COLUMN "apps_master_data_work_centers"."created_at" IS '创建时间（UTC）';
        COMMENT ON COLUMN "apps_master_data_work_centers"."updated_at" IS '更新时间（UTC）';
        COMMENT ON COLUMN "apps_master_data_work_centers"."id" IS '主键ID';
        COMMENT ON COLUMN "apps_master_data_work_centers"."code" IS '工作中心编码（组织内唯一）';
        COMMENT ON COLUMN "apps_master_data_work_centers"."name" IS '工作中心名称';
        COMMENT ON COLUMN "apps_master_data_work_centers"."description" IS '描述';
        COMMENT ON COLUMN "apps_master_data_work_centers"."is_active" IS '是否启用';
        COMMENT ON COLUMN "apps_master_data_work_centers"."deleted_at" IS '删除时间（软删除）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除工作中心表
    """
    return """
        -- 删除索引
        DROP INDEX IF EXISTS "idx_apps_master_data_work_centers_tenant_code";
        DROP INDEX IF EXISTS "idx_apps_master_data_work_centers_uuid";
        DROP INDEX IF EXISTS "idx_apps_master_data_work_centers_code";
        DROP INDEX IF EXISTS "idx_apps_master_data_work_centers_tenant_id";

        -- 删除表
        DROP TABLE IF EXISTS "apps_master_data_work_centers";
    """
