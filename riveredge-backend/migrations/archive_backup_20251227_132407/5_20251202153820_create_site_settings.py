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
)
