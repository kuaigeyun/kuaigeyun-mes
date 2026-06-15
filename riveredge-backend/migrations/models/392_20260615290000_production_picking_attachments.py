from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_production_pickings"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_production_pickings"."attachments" IS '附件列表';
    """
