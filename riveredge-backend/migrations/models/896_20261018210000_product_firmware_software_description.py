from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaiplm_product_firmwares"
            ADD COLUMN IF NOT EXISTS "software_description" VARCHAR(200);
        COMMENT ON COLUMN "apps_kuaiplm_product_firmwares"."software_description"
            IS '软件描述';
        COMMENT ON COLUMN "apps_kuaiplm_product_firmwares"."software_item_code"
            IS '软件12位编码（可含分隔符，最长50字符）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaiplm_product_firmwares"
            DROP COLUMN IF EXISTS "software_description";
        COMMENT ON COLUMN "apps_kuaiplm_product_firmwares"."software_item_code"
            IS '软件编码（可含分隔符，最长50字符）';
    """
