from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 创建站点设置表
        CREATE TABLE IF NOT EXISTS "sys_site_settings" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "settings" JSONB NOT NULL DEFAULT '{}',
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_sys_site_s_tenant__p9q4r5" UNIQUE ("tenant_id")
        );
COMMENT ON TABLE "sys_site_settings" IS '站点设置表';
        
        -- 创建站点设置表索引
        CREATE INDEX IF NOT EXISTS "idx_sys_site_s_tenant__p9q4r5" ON "sys_site_settings" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_site_s_created_q9r4s5" ON "sys_site_settings" ("created_at");
        
        -- 创建邀请码表
        CREATE TABLE IF NOT EXISTS "sys_invitation_codes" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "code" VARCHAR(50) NOT NULL UNIQUE,
            "email" VARCHAR(100),
            "role_id" INT,
            "max_uses" INT NOT NULL DEFAULT 1,
            "used_count" INT NOT NULL DEFAULT 0,
            "expires_at" TIMESTAMPTZ,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "sys_invitation_codes" IS '邀请码表';
        
        -- 创建邀请码表索引
        CREATE INDEX IF NOT EXISTS "idx_sys_invita_tenant__r9s4t5" ON "sys_invitation_codes" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_invita_code_s9t4u5" ON "sys_invitation_codes" ("code");
        CREATE INDEX IF NOT EXISTS "idx_sys_invita_created_t9u4v5" ON "sys_invitation_codes" ("created_at");"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除邀请码表索引
        DROP INDEX IF EXISTS "idx_sys_invita_created_t9u4v5";
        DROP INDEX IF EXISTS "idx_sys_invita_code_s9t4u5";
        DROP INDEX IF EXISTS "idx_sys_invita_tenant__r9s4t5";
        
        -- 删除邀请码表
        DROP TABLE IF EXISTS "sys_invitation_codes";
        
        -- 删除站点设置表索引
        DROP INDEX IF EXISTS "idx_sys_site_s_created_q9r4s5";
        DROP INDEX IF EXISTS "idx_sys_site_s_tenant__p9q4r5";
        
        -- 删除站点设置表
        DROP TABLE IF EXISTS "sys_site_settings";"""


MODELS_STATE = (
    "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"
    "X/AQWNlCI="
)
