from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "seed_kuaipdm_design_changes" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "change_no" VARCHAR(50) NOT NULL,
    "change_type" VARCHAR(50) NOT NULL,
    "change_reason" TEXT NOT NULL,
    "change_content" TEXT NOT NULL,
    "change_scope" TEXT,
    "priority" VARCHAR(20) NOT NULL  DEFAULT '普通',
    "status" VARCHAR(50) NOT NULL  DEFAULT '待审批',
    "product_id" INT,
    "bom_id" INT,
    "approval_instance_id" INT,
    "approval_status" VARCHAR(20),
    "executor_id" INT,
    "execution_start_date" TIMESTAMPTZ,
    "execution_end_date" TIMESTAMPTZ,
    "execution_result" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_seed_kuaipd_tenant__e0e991" UNIQUE ("tenant_id", "change_no")
);
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_tenant__4074c7" ON "seed_kuaipdm_design_changes" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_change__d3ffcb" ON "seed_kuaipdm_design_changes" ("change_no");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_uuid_bf0581" ON "seed_kuaipdm_design_changes" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_status_ed0ecd" ON "seed_kuaipdm_design_changes" ("status");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_change__9fe946" ON "seed_kuaipdm_design_changes" ("change_type");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_product_904ffe" ON "seed_kuaipdm_design_changes" ("product_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_approva_1b9eab" ON "seed_kuaipdm_design_changes" ("approval_instance_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_approva_84dafa" ON "seed_kuaipdm_design_changes" ("approval_status");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_created_25d79e" ON "seed_kuaipdm_design_changes" ("created_at");
COMMENT ON COLUMN "seed_kuaipdm_design_changes"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "seed_kuaipdm_design_changes"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "seed_kuaipdm_design_changes"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "seed_kuaipdm_design_changes"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "seed_kuaipdm_design_changes"."id" IS '主键ID';
COMMENT ON COLUMN "seed_kuaipdm_design_changes"."change_no" IS '变更编号（组织内唯一）';
COMMENT ON COLUMN "seed_kuaipdm_design_changes"."change_type" IS '变更类型（设计变更、工艺变更、材料变更等）';
COMMENT ON COLUMN "seed_kuaipdm_design_changes"."change_reason" IS '变更原因';
COMMENT ON COLUMN "seed_kuaipdm_design_changes"."change_content" IS '变更内容描述';
COMMENT ON COLUMN "seed_kuaipdm_design_changes"."change_scope" IS '变更影响范围';
COMMENT ON COLUMN "seed_kuaipdm_design_changes"."priority" IS '优先级（普通、紧急、加急）';
COMMENT ON COLUMN "seed_kuaipdm_design_changes"."status" IS '变更状态（待审批、审批中、已批准、执行中、已完成、已关闭）';
COMMENT ON COLUMN "seed_kuaipdm_design_changes"."product_id" IS '关联产品ID（关联master-data）';
COMMENT ON COLUMN "seed_kuaipdm_design_changes"."bom_id" IS '关联BOM ID（可选）';
COMMENT ON COLUMN "seed_kuaipdm_design_changes"."approval_instance_id" IS '审批实例ID（关联ApprovalInstance）';
COMMENT ON COLUMN "seed_kuaipdm_design_changes"."approval_status" IS '审批状态（pending、approved、rejected、cancelled）';
COMMENT ON COLUMN "seed_kuaipdm_design_changes"."executor_id" IS '执行人ID（用户ID）';
COMMENT ON COLUMN "seed_kuaipdm_design_changes"."execution_start_date" IS '执行开始日期';
COMMENT ON COLUMN "seed_kuaipdm_design_changes"."execution_end_date" IS '执行结束日期';
COMMENT ON COLUMN "seed_kuaipdm_design_changes"."execution_result" IS '执行结果';
COMMENT ON COLUMN "seed_kuaipdm_design_changes"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "seed_kuaipdm_design_changes" IS '设计变更模型';;
        CREATE TABLE IF NOT EXISTS "seed_kuaipdm_engineering_changes" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "change_no" VARCHAR(50) NOT NULL,
    "change_type" VARCHAR(50) NOT NULL,
    "change_reason" TEXT NOT NULL,
    "change_content" TEXT NOT NULL,
    "change_impact" TEXT,
    "priority" VARCHAR(20) NOT NULL  DEFAULT '普通',
    "status" VARCHAR(50) NOT NULL  DEFAULT '待审批',
    "product_id" INT,
    "approval_instance_id" INT,
    "approval_status" VARCHAR(20),
    "executor_id" INT,
    "execution_start_date" TIMESTAMPTZ,
    "execution_end_date" TIMESTAMPTZ,
    "execution_result" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_seed_kuaipd_tenant__b8d426" UNIQUE ("tenant_id", "change_no")
);
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_tenant__30ec2a" ON "seed_kuaipdm_engineering_changes" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_change__52952c" ON "seed_kuaipdm_engineering_changes" ("change_no");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_uuid_0275be" ON "seed_kuaipdm_engineering_changes" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_status_77049d" ON "seed_kuaipdm_engineering_changes" ("status");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_change__09f392" ON "seed_kuaipdm_engineering_changes" ("change_type");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_product_6c4b6e" ON "seed_kuaipdm_engineering_changes" ("product_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_approva_435057" ON "seed_kuaipdm_engineering_changes" ("approval_instance_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_approva_ee4f0c" ON "seed_kuaipdm_engineering_changes" ("approval_status");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_created_668597" ON "seed_kuaipdm_engineering_changes" ("created_at");
COMMENT ON COLUMN "seed_kuaipdm_engineering_changes"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "seed_kuaipdm_engineering_changes"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "seed_kuaipdm_engineering_changes"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "seed_kuaipdm_engineering_changes"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "seed_kuaipdm_engineering_changes"."id" IS '主键ID';
COMMENT ON COLUMN "seed_kuaipdm_engineering_changes"."change_no" IS '变更编号（组织内唯一）';
COMMENT ON COLUMN "seed_kuaipdm_engineering_changes"."change_type" IS '变更类型（设计变更、工艺变更、材料变更等）';
COMMENT ON COLUMN "seed_kuaipdm_engineering_changes"."change_reason" IS '变更原因';
COMMENT ON COLUMN "seed_kuaipdm_engineering_changes"."change_content" IS '变更内容描述';
COMMENT ON COLUMN "seed_kuaipdm_engineering_changes"."change_impact" IS '变更影响分析';
COMMENT ON COLUMN "seed_kuaipdm_engineering_changes"."priority" IS '优先级（普通、紧急、加急）';
COMMENT ON COLUMN "seed_kuaipdm_engineering_changes"."status" IS '变更状态（待审批、审批中、已批准、执行中、已完成、已关闭）';
COMMENT ON COLUMN "seed_kuaipdm_engineering_changes"."product_id" IS '关联产品ID（关联master-data）';
COMMENT ON COLUMN "seed_kuaipdm_engineering_changes"."approval_instance_id" IS '审批实例ID（关联ApprovalInstance）';
COMMENT ON COLUMN "seed_kuaipdm_engineering_changes"."approval_status" IS '审批状态（pending、approved、rejected、cancelled）';
COMMENT ON COLUMN "seed_kuaipdm_engineering_changes"."executor_id" IS '执行人ID（用户ID）';
COMMENT ON COLUMN "seed_kuaipdm_engineering_changes"."execution_start_date" IS '执行开始日期';
COMMENT ON COLUMN "seed_kuaipdm_engineering_changes"."execution_end_date" IS '执行结束日期';
COMMENT ON COLUMN "seed_kuaipdm_engineering_changes"."execution_result" IS '执行结果';
COMMENT ON COLUMN "seed_kuaipdm_engineering_changes"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "seed_kuaipdm_engineering_changes" IS '工程变更模型';;
        CREATE TABLE IF NOT EXISTS "seed_kuaipdm_design_reviews" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "review_no" VARCHAR(50) NOT NULL,
    "review_type" VARCHAR(50) NOT NULL,
    "review_stage" VARCHAR(50),
    "product_id" INT,
    "review_date" TIMESTAMPTZ,
    "status" VARCHAR(50) NOT NULL  DEFAULT '计划中',
    "conclusion" VARCHAR(50),
    "review_content" TEXT,
    "review_result" TEXT,
    "reviewers" JSONB,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_seed_kuaipd_tenant__a95341" UNIQUE ("tenant_id", "review_no")
);
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_tenant__ced277" ON "seed_kuaipdm_design_reviews" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_review__993268" ON "seed_kuaipdm_design_reviews" ("review_no");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_uuid_a1af19" ON "seed_kuaipdm_design_reviews" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_status_ab587f" ON "seed_kuaipdm_design_reviews" ("status");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_review__361303" ON "seed_kuaipdm_design_reviews" ("review_type");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_product_98c03c" ON "seed_kuaipdm_design_reviews" ("product_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_review__ac4ac7" ON "seed_kuaipdm_design_reviews" ("review_date");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_created_ad29ca" ON "seed_kuaipdm_design_reviews" ("created_at");
COMMENT ON COLUMN "seed_kuaipdm_design_reviews"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "seed_kuaipdm_design_reviews"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "seed_kuaipdm_design_reviews"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "seed_kuaipdm_design_reviews"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "seed_kuaipdm_design_reviews"."id" IS '主键ID';
COMMENT ON COLUMN "seed_kuaipdm_design_reviews"."review_no" IS '评审编号（组织内唯一）';
COMMENT ON COLUMN "seed_kuaipdm_design_reviews"."review_type" IS '评审类型（概念评审、设计评审、样机评审等）';
COMMENT ON COLUMN "seed_kuaipdm_design_reviews"."review_stage" IS '评审阶段';
COMMENT ON COLUMN "seed_kuaipdm_design_reviews"."product_id" IS '关联产品ID（关联master-data）';
COMMENT ON COLUMN "seed_kuaipdm_design_reviews"."review_date" IS '评审日期';
COMMENT ON COLUMN "seed_kuaipdm_design_reviews"."status" IS '评审状态（计划中、进行中、已完成、已关闭）';
COMMENT ON COLUMN "seed_kuaipdm_design_reviews"."conclusion" IS '评审结论（通过、有条件通过、不通过）';
COMMENT ON COLUMN "seed_kuaipdm_design_reviews"."review_content" IS '评审内容';
COMMENT ON COLUMN "seed_kuaipdm_design_reviews"."review_result" IS '评审结果';
COMMENT ON COLUMN "seed_kuaipdm_design_reviews"."reviewers" IS '评审人员列表（JSON格式）';
COMMENT ON COLUMN "seed_kuaipdm_design_reviews"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "seed_kuaipdm_design_reviews" IS '设计评审模型';;
        CREATE TABLE IF NOT EXISTS "seed_kuaipdm_research_processes" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "process_no" VARCHAR(50) NOT NULL,
    "process_name" VARCHAR(200) NOT NULL,
    "process_type" VARCHAR(50) NOT NULL,
    "process_template" JSONB,
    "current_stage" VARCHAR(100),
    "status" VARCHAR(50) NOT NULL  DEFAULT '进行中',
    "product_id" INT,
    "project_id" INT,
    "owner_id" INT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_seed_kuaipd_tenant__120f74" UNIQUE ("tenant_id", "process_no")
);
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_tenant__d11b58" ON "seed_kuaipdm_research_processes" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_process_c71c46" ON "seed_kuaipdm_research_processes" ("process_no");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_uuid_9600e7" ON "seed_kuaipdm_research_processes" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_status_640afe" ON "seed_kuaipdm_research_processes" ("status");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_process_65e77e" ON "seed_kuaipdm_research_processes" ("process_type");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_product_e35512" ON "seed_kuaipdm_research_processes" ("product_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_project_556cf9" ON "seed_kuaipdm_research_processes" ("project_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_current_e76c06" ON "seed_kuaipdm_research_processes" ("current_stage");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_created_8f02d3" ON "seed_kuaipdm_research_processes" ("created_at");
COMMENT ON COLUMN "seed_kuaipdm_research_processes"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "seed_kuaipdm_research_processes"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "seed_kuaipdm_research_processes"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "seed_kuaipdm_research_processes"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "seed_kuaipdm_research_processes"."id" IS '主键ID';
COMMENT ON COLUMN "seed_kuaipdm_research_processes"."process_no" IS '流程编号（组织内唯一）';
COMMENT ON COLUMN "seed_kuaipdm_research_processes"."process_name" IS '流程名称';
COMMENT ON COLUMN "seed_kuaipdm_research_processes"."process_type" IS '流程类型（IPD、CMMI、APQP等）';
COMMENT ON COLUMN "seed_kuaipdm_research_processes"."process_template" IS '流程模板（JSON格式）';
COMMENT ON COLUMN "seed_kuaipdm_research_processes"."current_stage" IS '当前阶段';
COMMENT ON COLUMN "seed_kuaipdm_research_processes"."status" IS '流程状态（进行中、已完成、已暂停、已关闭）';
COMMENT ON COLUMN "seed_kuaipdm_research_processes"."product_id" IS '关联产品ID（关联master-data）';
COMMENT ON COLUMN "seed_kuaipdm_research_processes"."project_id" IS '关联项目ID（可选，关联PM模块）';
COMMENT ON COLUMN "seed_kuaipdm_research_processes"."owner_id" IS '负责人ID（用户ID）';
COMMENT ON COLUMN "seed_kuaipdm_research_processes"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "seed_kuaipdm_research_processes" IS '研发流程模型';;
        CREATE TABLE IF NOT EXISTS "seed_kuaipdm_knowledges" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "knowledge_no" VARCHAR(50) NOT NULL,
    "knowledge_type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "category" VARCHAR(100),
    "tags" JSONB,
    "author_id" INT NOT NULL,
    "view_count" INT NOT NULL  DEFAULT 0,
    "like_count" INT NOT NULL  DEFAULT 0,
    "rating" DECIMAL(3,2),
    "is_public" BOOL NOT NULL  DEFAULT False,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_seed_kuaipd_tenant__40f18a" UNIQUE ("tenant_id", "knowledge_no")
);
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_tenant__ff8c59" ON "seed_kuaipdm_knowledges" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_knowled_07e394" ON "seed_kuaipdm_knowledges" ("knowledge_no");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_uuid_52668c" ON "seed_kuaipdm_knowledges" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_knowled_b4adc5" ON "seed_kuaipdm_knowledges" ("knowledge_type");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_categor_823d0e" ON "seed_kuaipdm_knowledges" ("category");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_author__2e73c8" ON "seed_kuaipdm_knowledges" ("author_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_is_publ_dd5a3c" ON "seed_kuaipdm_knowledges" ("is_public");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaipd_created_683e30" ON "seed_kuaipdm_knowledges" ("created_at");
COMMENT ON COLUMN "seed_kuaipdm_knowledges"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "seed_kuaipdm_knowledges"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "seed_kuaipdm_knowledges"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "seed_kuaipdm_knowledges"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "seed_kuaipdm_knowledges"."id" IS '主键ID';
COMMENT ON COLUMN "seed_kuaipdm_knowledges"."knowledge_no" IS '知识编号（组织内唯一）';
COMMENT ON COLUMN "seed_kuaipdm_knowledges"."knowledge_type" IS '知识类型（技术知识、设计经验、最佳实践、专利等）';
COMMENT ON COLUMN "seed_kuaipdm_knowledges"."title" IS '知识标题';
COMMENT ON COLUMN "seed_kuaipdm_knowledges"."content" IS '知识内容';
COMMENT ON COLUMN "seed_kuaipdm_knowledges"."category" IS '知识分类';
COMMENT ON COLUMN "seed_kuaipdm_knowledges"."tags" IS '知识标签（JSON格式）';
COMMENT ON COLUMN "seed_kuaipdm_knowledges"."author_id" IS '作者ID（用户ID）';
COMMENT ON COLUMN "seed_kuaipdm_knowledges"."view_count" IS '查看次数';
COMMENT ON COLUMN "seed_kuaipdm_knowledges"."like_count" IS '点赞次数';
COMMENT ON COLUMN "seed_kuaipdm_knowledges"."rating" IS '评分（0-5分）';
COMMENT ON COLUMN "seed_kuaipdm_knowledges"."is_public" IS '是否公开';
COMMENT ON COLUMN "seed_kuaipdm_knowledges"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "seed_kuaipdm_knowledges" IS '知识管理模型';;"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "seed_kuaipdm_design_changes";
        DROP TABLE IF EXISTS "seed_kuaipdm_engineering_changes";
        DROP TABLE IF EXISTS "seed_kuaipdm_design_reviews";
        DROP TABLE IF EXISTS "seed_kuaipdm_research_processes";
        DROP TABLE IF EXISTS "seed_kuaipdm_knowledges";"""
