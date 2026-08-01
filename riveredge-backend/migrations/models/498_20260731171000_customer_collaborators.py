from tortoise import BaseDBAsyncClient


RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_customer_collaborators" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" UUID NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "customer_id" INT NOT NULL,
            "user_id" INT NOT NULL,
            "user_name" VARCHAR(100) NOT NULL,
            "added_by" INT NOT NULL,
            "added_by_name" VARCHAR(100),
            "deleted_at" TIMESTAMPTZ
        );
        COMMENT ON TABLE "apps_kuaizhizao_customer_collaborators" IS '快格轻制造 - 客户池协作人';
        CREATE INDEX IF NOT EXISTS "idx_customer_collaborator_customer"
            ON "apps_kuaizhizao_customer_collaborators" ("tenant_id", "customer_id");
        CREATE INDEX IF NOT EXISTS "idx_customer_collaborator_user"
            ON "apps_kuaizhizao_customer_collaborators" ("tenant_id", "user_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_customer_collaborators";
    """
