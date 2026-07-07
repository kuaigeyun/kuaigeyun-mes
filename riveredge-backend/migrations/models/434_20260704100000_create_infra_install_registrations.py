"""
创建实例安装登记表

可选遥测登记：记录构建来源元数据（不含业务数据），tenant_id 恒为 NULL。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "infra_install_registrations" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "install_instance_id" VARCHAR(36) NOT NULL,
            "git_commit" VARCHAR(40) NULL,
            "build_time" VARCHAR(40) NULL,
            "provenance_status" VARCHAR(50) NOT NULL,
            "app_version" VARCHAR(50) NULL,
            "build_git_remote" VARCHAR(500) NULL,
            "build_git_branch" VARCHAR(200) NULL,
            "build_git_remote_is_official" BOOLEAN NOT NULL DEFAULT false,
            "host_hint" VARCHAR(200) NULL,
            "first_seen_at" TIMESTAMPTZ NOT NULL,
            "last_seen_at" TIMESTAMPTZ NOT NULL,
            "register_count" INT NOT NULL DEFAULT 1,
            "last_register_ip" VARCHAR(64) NULL
        );

        CREATE UNIQUE INDEX IF NOT EXISTS "idx_infra_install_registrations_instance_id"
            ON "infra_install_registrations" ("install_instance_id");
        CREATE INDEX IF NOT EXISTS "idx_infra_install_registrations_build_git_remote"
            ON "infra_install_registrations" ("build_git_remote");
        CREATE INDEX IF NOT EXISTS "idx_infra_install_registrations_remote_is_official"
            ON "infra_install_registrations" ("build_git_remote_is_official");
        CREATE INDEX IF NOT EXISTS "idx_infra_install_registrations_last_seen_at"
            ON "infra_install_registrations" ("last_seen_at");

        COMMENT ON TABLE "infra_install_registrations" IS '可选实例安装登记（构建来源元数据）';
        COMMENT ON COLUMN "infra_install_registrations"."install_instance_id" IS '部署实例 UUID';
        COMMENT ON COLUMN "infra_install_registrations"."build_git_remote" IS '自述来源 git remote';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_infra_install_registrations_last_seen_at";
        DROP INDEX IF EXISTS "idx_infra_install_registrations_remote_is_official";
        DROP INDEX IF EXISTS "idx_infra_install_registrations_build_git_remote";
        DROP INDEX IF EXISTS "idx_infra_install_registrations_instance_id";
        DROP TABLE IF EXISTS "infra_install_registrations";
    """
