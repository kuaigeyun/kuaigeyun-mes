"""
BOM 工程变更记录表迁移

创建 BOMChange 表，支持 BOM 工程变更（ECN）管理功能。

Author: AI Assistant
Date: 2026-03-16
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """升级：创建 BOM 工程变更记录表"""
    return """
        CREATE TABLE IF NOT EXISTS "apps_master_data_bom_changes" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "material_id" INT NOT NULL REFERENCES "apps_master_data_materials" ("id") ON DELETE CASCADE,
            "change_type" VARCHAR(50) NOT NULL,
            "change_content" JSONB,
            "change_reason" TEXT,
            "change_impact" JSONB,
            "bom_code" VARCHAR(100),
            "from_version" VARCHAR(50),
            "to_version" VARCHAR(50),
            "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
            "applicant_id" INT NOT NULL,
            "approver_id" INT,
            "approval_comment" TEXT,
            "applied_at" TIMESTAMPTZ,
            "deleted_at" TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS "idx_bom_change_tenant_id" ON "apps_master_data_bom_changes" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_bom_change_material_id" ON "apps_master_data_bom_changes" ("material_id");
        CREATE INDEX IF NOT EXISTS "idx_bom_change_status" ON "apps_master_data_bom_changes" ("status");
        CREATE INDEX IF NOT EXISTS "idx_bom_change_change_type" ON "apps_master_data_bom_changes" ("change_type");
        CREATE INDEX IF NOT EXISTS "idx_bom_change_applicant_id" ON "apps_master_data_bom_changes" ("applicant_id");
        CREATE INDEX IF NOT EXISTS "idx_bom_change_created_at" ON "apps_master_data_bom_changes" ("created_at");
        CREATE INDEX IF NOT EXISTS "idx_bom_change_uuid" ON "apps_master_data_bom_changes" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_bom_change_bom_code" ON "apps_master_data_bom_changes" ("bom_code");

        COMMENT ON TABLE "apps_master_data_bom_changes" IS 'BOM 工程变更记录表';
        COMMENT ON COLUMN "apps_master_data_bom_changes"."id" IS '变更记录ID（主键）';
        COMMENT ON COLUMN "apps_master_data_bom_changes"."uuid" IS '业务ID（UUID，对外暴露）';
        COMMENT ON COLUMN "apps_master_data_bom_changes"."tenant_id" IS '组织ID';
        COMMENT ON COLUMN "apps_master_data_bom_changes"."material_id" IS '关联主物料ID（BOM 父件）';
        COMMENT ON COLUMN "apps_master_data_bom_changes"."change_type" IS '变更类型（item_add/item_remove/item_modify/version_change/effective_change/other）';
        COMMENT ON COLUMN "apps_master_data_bom_changes"."change_content" IS '变更内容（JSON格式）';
        COMMENT ON COLUMN "apps_master_data_bom_changes"."change_reason" IS '变更原因';
        COMMENT ON COLUMN "apps_master_data_bom_changes"."change_impact" IS '变更影响分析（JSON格式）';
        COMMENT ON COLUMN "apps_master_data_bom_changes"."status" IS '变更状态（pending/approved/rejected/executed/cancelled）';
        COMMENT ON COLUMN "apps_master_data_bom_changes"."applicant_id" IS '申请人ID';
        COMMENT ON COLUMN "apps_master_data_bom_changes"."approver_id" IS '审批人ID';
        COMMENT ON COLUMN "apps_master_data_bom_changes"."applied_at" IS '应用时间';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """降级：删除 BOM 工程变更记录表"""
    return """
        DROP TABLE IF EXISTS "apps_master_data_bom_changes";
    """
