from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "seed_kuaicrm_lead_followups" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "lead_id" INT NOT NULL,
    "followup_type" VARCHAR(50) NOT NULL,
    "followup_content" TEXT NOT NULL,
    "followup_result" VARCHAR(200),
    "next_followup_date" TIMESTAMPTZ,
    "followup_by" INT NOT NULL,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_seed_kuaicr_tenant__98d39f" ON "seed_kuaicrm_lead_followups" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaicr_lead_id_61e23c" ON "seed_kuaicrm_lead_followups" ("lead_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaicr_uuid_ff212c" ON "seed_kuaicrm_lead_followups" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaicr_followu_d40199" ON "seed_kuaicrm_lead_followups" ("followup_type");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaicr_next_fo_879b88" ON "seed_kuaicrm_lead_followups" ("next_followup_date");
COMMENT ON COLUMN "seed_kuaicrm_lead_followups"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "seed_kuaicrm_lead_followups"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "seed_kuaicrm_lead_followups"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "seed_kuaicrm_lead_followups"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "seed_kuaicrm_lead_followups"."id" IS '主键ID';
COMMENT ON COLUMN "seed_kuaicrm_lead_followups"."lead_id" IS '线索ID（关联Lead）';
COMMENT ON COLUMN "seed_kuaicrm_lead_followups"."followup_type" IS '跟进类型（电话、邮件、拜访、会议等）';
COMMENT ON COLUMN "seed_kuaicrm_lead_followups"."followup_content" IS '跟进内容';
COMMENT ON COLUMN "seed_kuaicrm_lead_followups"."followup_result" IS '跟进结果';
COMMENT ON COLUMN "seed_kuaicrm_lead_followups"."next_followup_date" IS '下次跟进日期';
COMMENT ON COLUMN "seed_kuaicrm_lead_followups"."followup_by" IS '跟进人（用户ID）';
COMMENT ON COLUMN "seed_kuaicrm_lead_followups"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "seed_kuaicrm_lead_followups" IS '线索跟进记录模型';;
        CREATE TABLE IF NOT EXISTS "seed_kuaicrm_opportunity_followups" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "opportunity_id" INT NOT NULL,
    "followup_type" VARCHAR(50) NOT NULL,
    "followup_content" TEXT NOT NULL,
    "followup_result" VARCHAR(200),
    "next_followup_date" TIMESTAMPTZ,
    "followup_by" INT NOT NULL,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_seed_kuaicr_tenant__5c1a64" ON "seed_kuaicrm_opportunity_followups" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaicr_opportu_f7daf4" ON "seed_kuaicrm_opportunity_followups" ("opportunity_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaicr_uuid_a282c4" ON "seed_kuaicrm_opportunity_followups" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaicr_followu_654c34" ON "seed_kuaicrm_opportunity_followups" ("followup_type");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaicr_next_fo_0ebc3f" ON "seed_kuaicrm_opportunity_followups" ("next_followup_date");
COMMENT ON COLUMN "seed_kuaicrm_opportunity_followups"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "seed_kuaicrm_opportunity_followups"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "seed_kuaicrm_opportunity_followups"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "seed_kuaicrm_opportunity_followups"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "seed_kuaicrm_opportunity_followups"."id" IS '主键ID';
COMMENT ON COLUMN "seed_kuaicrm_opportunity_followups"."opportunity_id" IS '商机ID（关联Opportunity）';
COMMENT ON COLUMN "seed_kuaicrm_opportunity_followups"."followup_type" IS '跟进类型（电话、邮件、拜访、会议、演示等）';
COMMENT ON COLUMN "seed_kuaicrm_opportunity_followups"."followup_content" IS '跟进内容';
COMMENT ON COLUMN "seed_kuaicrm_opportunity_followups"."followup_result" IS '跟进结果';
COMMENT ON COLUMN "seed_kuaicrm_opportunity_followups"."next_followup_date" IS '下次跟进日期';
COMMENT ON COLUMN "seed_kuaicrm_opportunity_followups"."followup_by" IS '跟进人（用户ID）';
COMMENT ON COLUMN "seed_kuaicrm_opportunity_followups"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "seed_kuaicrm_opportunity_followups" IS '商机跟进记录模型';;"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "seed_kuaicrm_lead_followups";
        DROP TABLE IF EXISTS "seed_kuaicrm_opportunity_followups";"""
