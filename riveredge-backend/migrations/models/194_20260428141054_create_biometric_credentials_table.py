from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "core_webauthn_credentials" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "credential_id" BYTEA NOT NULL,
    "public_key" BYTEA NOT NULL,
    "sign_count" INT NOT NULL  DEFAULT 0,
    "transports" JSONB,
    "device_name" VARCHAR(255),
    "user_id" INT NOT NULL REFERENCES "core_users" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_core_webaut_tenant__543da5" ON "core_webauthn_credentials" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_webaut_user_id_40eded" ON "core_webauthn_credentials" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_core_webaut_credent_48b1b2" ON "core_webauthn_credentials" ("credential_id");
COMMENT ON COLUMN "core_webauthn_credentials"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_webauthn_credentials"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_webauthn_credentials"."created_at" IS '创建时间';
COMMENT ON COLUMN "core_webauthn_credentials"."updated_at" IS '更新时间';
COMMENT ON COLUMN "core_webauthn_credentials"."credential_id" IS '凭据 ID (Credential ID)';
COMMENT ON COLUMN "core_webauthn_credentials"."public_key" IS '公共密钥 (Public Key)';
COMMENT ON COLUMN "core_webauthn_credentials"."sign_count" IS '签名计数器 (Signature Count)';
COMMENT ON COLUMN "core_webauthn_credentials"."transports" IS '支持的传输方式 (Transports)';
COMMENT ON COLUMN "core_webauthn_credentials"."device_name" IS '设备名称';
COMMENT ON COLUMN "core_webauthn_credentials"."user_id" IS '关联用户';
COMMENT ON TABLE "core_webauthn_credentials" IS 'WebAuthn 凭据模型';;"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "core_webauthn_credentials";"""
