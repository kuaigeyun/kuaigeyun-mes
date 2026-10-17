"""用户密码生命周期字段（加强模式到期与强制改密）。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_users"
            ADD COLUMN IF NOT EXISTS "password_changed_at" TIMESTAMPTZ;
        COMMENT ON COLUMN "core_users"."password_changed_at" IS '登录密码最近修改时间';
        ALTER TABLE "core_users"
            ADD COLUMN IF NOT EXISTS "must_change_password" BOOLEAN NOT NULL DEFAULT FALSE;
        COMMENT ON COLUMN "core_users"."must_change_password" IS '下次登录须修改密码';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_users" DROP COLUMN IF EXISTS "must_change_password";
        ALTER TABLE "core_users" DROP COLUMN IF EXISTS "password_changed_at";
    """
