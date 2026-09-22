"""报工记录幂等键字段（可空 + 租户内部分唯一）。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "apps_kuaizhizao_reporting_records"
    ADD COLUMN IF NOT EXISTS "idempotency_key" VARCHAR(200);

CREATE UNIQUE INDEX IF NOT EXISTS "uid_reporting_tenant_idempotency"
    ON "apps_kuaizhizao_reporting_records" ("tenant_id", "idempotency_key")
    WHERE "idempotency_key" IS NOT NULL AND "deleted_at" IS NULL;
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    # 部署红线：禁止「只 down 795、保留 P0-2 写 idempotency_key 的代码」。
    # 回滚顺序：① 先还原 reporting_service / ReportingRecord 模型与 schema ② 再执行本 downgrade。
    # 否则 create_reporting_record 写入不存在列 → 500。详见 D:\\pytest\\d-kuaigeyun\\P2B_795_回滚红线.md
    return """
-- P2-08：若应用仍引用 idempotency_key，请先还原代码再执行本脚本
DO $$
BEGIN
  RAISE NOTICE 'P2-08 rollback redline: restore P0-2 reporting idempotency_key code BEFORE dropping column';
END $$;
DROP INDEX IF EXISTS "uid_reporting_tenant_idempotency";
ALTER TABLE "apps_kuaizhizao_reporting_records"
    DROP COLUMN IF EXISTS "idempotency_key";
"""
