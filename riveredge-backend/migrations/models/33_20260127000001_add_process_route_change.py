"""
添加工艺路线变更记录表迁移

创建ProcessRouteChange表，支持工艺路线变更管理功能。

变更内容：
- 创建apps_master_data_process_route_changes表（工艺路线变更记录表）
- 添加必要的索引和约束

根据《05-详细开发计划-第四阶段.md》的功能点4.3.5设计。

Author: Luigi Lu
Date: 2026-01-27
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：创建工艺路线变更记录表
    """
    return """
        -- ============================================
        -- 创建工艺路线变更记录表（apps_master_data_process_route_changes）
        -- ============================================
        
        CREATE TABLE IF NOT EXISTS "apps_master_data_process_route_changes" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "process_route_id" INT NOT NULL REFERENCES "apps_master_data_process_routes" ("id") ON DELETE CASCADE,
            "change_type" VARCHAR(50) NOT NULL,
            "change_content" JSONB,
            "change_reason" TEXT,
            "change_impact" JSONB,
            "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
            "applicant_id" INT NOT NULL,
            "approver_id" INT,
            "approval_comment" TEXT,
            "applied_at" TIMESTAMPTZ,
            "deleted_at" TIMESTAMPTZ
        );
        
        -- 添加索引
        CREATE INDEX IF NOT EXISTS "idx_apps_master_change_tenant_id" ON "apps_master_data_process_route_changes" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_change_process_route_id" ON "apps_master_data_process_route_changes" ("process_route_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_change_status" ON "apps_master_data_process_route_changes" ("status");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_change_change_type" ON "apps_master_data_process_route_changes" ("change_type");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_change_applicant_id" ON "apps_master_data_process_route_changes" ("applicant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_change_created_at" ON "apps_master_data_process_route_changes" ("created_at");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_change_uuid" ON "apps_master_data_process_route_changes" ("uuid");
        
        -- 添加表注释和字段注释
        COMMENT ON TABLE "apps_master_data_process_route_changes" IS '工艺路线变更记录表';
        COMMENT ON COLUMN "apps_master_data_process_route_changes"."id" IS '变更记录ID（主键，自增ID，内部使用）';
        COMMENT ON COLUMN "apps_master_data_process_route_changes"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
        COMMENT ON COLUMN "apps_master_data_process_route_changes"."tenant_id" IS '组织ID（用于多组织数据隔离）';
        COMMENT ON COLUMN "apps_master_data_process_route_changes"."created_at" IS '创建时间（UTC）';
        COMMENT ON COLUMN "apps_master_data_process_route_changes"."updated_at" IS '更新时间（UTC）';
        COMMENT ON COLUMN "apps_master_data_process_route_changes"."process_route_id" IS '关联工艺路线ID（外键）';
        COMMENT ON COLUMN "apps_master_data_process_route_changes"."change_type" IS '变更类型（operation_change:工序变更, time_change:标准工时变更, sop_change:SOP变更, other:其他）';
        COMMENT ON COLUMN "apps_master_data_process_route_changes"."change_content" IS '变更内容（JSON格式，详细记录变更内容）';
        COMMENT ON COLUMN "apps_master_data_process_route_changes"."change_reason" IS '变更原因';
        COMMENT ON COLUMN "apps_master_data_process_route_changes"."change_impact" IS '变更影响分析（JSON格式，记录影响的工单、影响程度等）';
        COMMENT ON COLUMN "apps_master_data_process_route_changes"."status" IS '变更状态（pending:待审批, approved:已审批, rejected:已拒绝, executed:已执行, cancelled:已取消）';
        COMMENT ON COLUMN "apps_master_data_process_route_changes"."applicant_id" IS '申请人ID';
        COMMENT ON COLUMN "apps_master_data_process_route_changes"."approver_id" IS '审批人ID（可选）';
        COMMENT ON COLUMN "apps_master_data_process_route_changes"."approval_comment" IS '审批意见（可选）';
        COMMENT ON COLUMN "apps_master_data_process_route_changes"."applied_at" IS '应用时间（变更执行时间）';
        COMMENT ON COLUMN "apps_master_data_process_route_changes"."deleted_at" IS '删除时间（软删除）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除工艺路线变更记录表
    """
    return """
        -- 删除变更记录表
        DROP TABLE IF EXISTS "apps_master_data_process_route_changes";
    """
