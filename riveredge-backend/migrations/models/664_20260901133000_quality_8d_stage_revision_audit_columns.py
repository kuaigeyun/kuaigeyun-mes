"""
8D 阶段修订历史表补齐 BaseModel 审计字段
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_quality_8d_stage_revisions"
            ADD COLUMN IF NOT EXISTS "created_by" INT NULL,
            ADD COLUMN IF NOT EXISTS "created_by_name" VARCHAR(100) NULL,
            ADD COLUMN IF NOT EXISTS "updated_by" INT NULL,
            ADD COLUMN IF NOT EXISTS "updated_by_name" VARCHAR(100) NULL;
        COMMENT ON COLUMN "apps_kuaizhizao_quality_8d_stage_revisions"."created_by" IS '创建人ID';
        COMMENT ON COLUMN "apps_kuaizhizao_quality_8d_stage_revisions"."created_by_name" IS '创建人姓名';
        COMMENT ON COLUMN "apps_kuaizhizao_quality_8d_stage_revisions"."updated_by" IS '更新人ID';
        COMMENT ON COLUMN "apps_kuaizhizao_quality_8d_stage_revisions"."updated_by_name" IS '更新人姓名';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_quality_8d_stage_revisions"
            DROP COLUMN IF EXISTS "updated_by_name",
            DROP COLUMN IF EXISTS "updated_by",
            DROP COLUMN IF EXISTS "created_by_name",
            DROP COLUMN IF EXISTS "created_by";
    """
