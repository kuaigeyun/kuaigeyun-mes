from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaiplm_product_firmwares"
            ALTER COLUMN "software_item_code" TYPE VARCHAR(50);
        COMMENT ON COLUMN "apps_kuaiplm_product_firmwares"."software_item_code"
            IS '软件编码（可含分隔符，最长50字符）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaiplm_product_firmwares"
            ALTER COLUMN "software_item_code" TYPE VARCHAR(12);
        COMMENT ON COLUMN "apps_kuaiplm_product_firmwares"."software_item_code"
            IS '软件料号/12位编码（定制页展示）';
    """
