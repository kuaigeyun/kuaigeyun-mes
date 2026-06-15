from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_rework_orders"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_rework_orders"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaizhizao_outsource_work_orders"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_outsource_work_orders"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaizhizao_outsource_orders"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_outsource_orders"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaizhizao_packing_bindings"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_packing_bindings"."attachments" IS '附件列表';
    """
