from tortoise import BaseDBAsyncClient


RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    # BaseModel.uuid 为 CharField(36)；PG UUID 类型经 asyncpg 读出为 uuid.UUID，
    # 导致 AfterSalesTicket*Response.model_validate 失败。统一为 VARCHAR(36)。
    return """
        ALTER TABLE "apps_kuaizhizao_after_sales_tickets"
            ALTER COLUMN "uuid" TYPE VARCHAR(36) USING "uuid"::text;
        ALTER TABLE "apps_kuaizhizao_after_sales_ticket_items"
            ALTER COLUMN "uuid" TYPE VARCHAR(36) USING "uuid"::text;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_after_sales_ticket_items"
            ALTER COLUMN "uuid" TYPE UUID USING "uuid"::uuid;
        ALTER TABLE "apps_kuaizhizao_after_sales_tickets"
            ALTER COLUMN "uuid" TYPE UUID USING "uuid"::uuid;
    """
