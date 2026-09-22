"""P2-04：统一单据 status/review_status ORM 默认值与 DB DEFAULT（DocumentStatus/ReviewStatus）。

不改销售出库业务态「待出库」（非草稿域）。
存量：仅回填明显旧默认值（草稿/draft/待审核），不触碰业务已写入的其它状态。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
-- 工单
ALTER TABLE "apps_kuaizhizao_work_orders"
    ALTER COLUMN "status" SET DEFAULT 'DRAFT';
UPDATE "apps_kuaizhizao_work_orders"
    SET "status" = 'DRAFT'
    WHERE "status" IN ('draft', '草稿') AND "deleted_at" IS NULL;

-- 库存调拨
ALTER TABLE "apps_kuaizhizao_inventory_transfers"
    ALTER COLUMN "status" SET DEFAULT 'DRAFT';
UPDATE "apps_kuaizhizao_inventory_transfers"
    SET "status" = 'DRAFT'
    WHERE "status" IN ('draft', '草稿') AND "deleted_at" IS NULL;

-- 生产计划
ALTER TABLE "apps_kuaizhizao_production_plans"
    ALTER COLUMN "status" SET DEFAULT 'DRAFT';
ALTER TABLE "apps_kuaizhizao_production_plans"
    ALTER COLUMN "review_status" SET DEFAULT 'PENDING';
UPDATE "apps_kuaizhizao_production_plans"
    SET "status" = 'DRAFT'
    WHERE "status" IN ('草稿', 'draft') AND "deleted_at" IS NULL;
UPDATE "apps_kuaizhizao_production_plans"
    SET "review_status" = 'PENDING'
    WHERE "review_status" IN ('待审核', 'pending', 'PENDING_REVIEW') AND "deleted_at" IS NULL;

-- 销售出库：仅统一 review_status；出库 status 仍默认「待出库」
ALTER TABLE "apps_kuaizhizao_sales_deliveries"
    ALTER COLUMN "review_status" SET DEFAULT 'PENDING';
ALTER TABLE "apps_kuaizhizao_sales_deliveries"
    ALTER COLUMN "status" SET DEFAULT '待出库';
UPDATE "apps_kuaizhizao_sales_deliveries"
    SET "review_status" = 'PENDING'
    WHERE "review_status" IN ('待审核', 'pending', 'PENDING_REVIEW') AND "deleted_at" IS NULL;

-- 工单工序：确保 ORM/DB 默认均为 pending
ALTER TABLE "apps_kuaizhizao_work_order_operations"
    ALTER COLUMN "status" SET DEFAULT 'pending';
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "apps_kuaizhizao_work_orders"
    ALTER COLUMN "status" SET DEFAULT 'draft';
ALTER TABLE "apps_kuaizhizao_inventory_transfers"
    ALTER COLUMN "status" SET DEFAULT 'draft';
ALTER TABLE "apps_kuaizhizao_production_plans"
    ALTER COLUMN "status" SET DEFAULT '草稿';
ALTER TABLE "apps_kuaizhizao_production_plans"
    ALTER COLUMN "review_status" SET DEFAULT '待审核';
ALTER TABLE "apps_kuaizhizao_sales_deliveries"
    ALTER COLUMN "review_status" SET DEFAULT '待审核';
"""
