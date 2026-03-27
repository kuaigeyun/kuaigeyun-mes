from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_customer_follow_ups" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "customer_id" INT NOT NULL,
    "customer_name" VARCHAR(200) NOT NULL,
    "activity_type_code" VARCHAR(50) NOT NULL,
    "content" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL,
    "next_follow_up_at" TIMESTAMPTZ,
    "quotation_id" INT,
    "quotation_code" VARCHAR(50),
    "sales_order_id" INT,
    "sales_order_code" VARCHAR(50),
    "created_by" INT,
    "updated_by" INT,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__d515ba" ON "apps_kuaizhizao_customer_follow_ups" ("tenant_id", "customer_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__c83158" ON "apps_kuaizhizao_customer_follow_ups" ("tenant_id", "next_follow_up_at");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__613451" ON "apps_kuaizhizao_customer_follow_ups" ("tenant_id", "occurred_at");
COMMENT ON COLUMN "apps_kuaizhizao_customer_follow_ups"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_customer_follow_ups"."tenant_id" IS '租户ID';
COMMENT ON COLUMN "apps_kuaizhizao_customer_follow_ups"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_customer_follow_ups"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_customer_follow_ups"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_customer_follow_ups"."customer_id" IS '客户ID（主数据）';
COMMENT ON COLUMN "apps_kuaizhizao_customer_follow_ups"."customer_name" IS '客户名称快照';
COMMENT ON COLUMN "apps_kuaizhizao_customer_follow_ups"."activity_type_code" IS '跟进方式（字典 SALES_FOLLOW_UP_TYPE）';
COMMENT ON COLUMN "apps_kuaizhizao_customer_follow_ups"."content" IS '跟进内容';
COMMENT ON COLUMN "apps_kuaizhizao_customer_follow_ups"."occurred_at" IS '跟进发生时间';
COMMENT ON COLUMN "apps_kuaizhizao_customer_follow_ups"."next_follow_up_at" IS '计划下次跟进时间';
COMMENT ON COLUMN "apps_kuaizhizao_customer_follow_ups"."quotation_id" IS '关联报价单ID';
COMMENT ON COLUMN "apps_kuaizhizao_customer_follow_ups"."quotation_code" IS '关联报价单编码';
COMMENT ON COLUMN "apps_kuaizhizao_customer_follow_ups"."sales_order_id" IS '关联销售订单ID';
COMMENT ON COLUMN "apps_kuaizhizao_customer_follow_ups"."sales_order_code" IS '关联销售订单编码';
COMMENT ON COLUMN "apps_kuaizhizao_customer_follow_ups"."created_by" IS '创建人ID';
COMMENT ON COLUMN "apps_kuaizhizao_customer_follow_ups"."updated_by" IS '更新人ID';
COMMENT ON COLUMN "apps_kuaizhizao_customer_follow_ups"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaizhizao_customer_follow_ups" IS '快格轻制造 - 客户跟进记录';;"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_customer_follow_ups";"""
