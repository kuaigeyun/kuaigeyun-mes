from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaipdm_design_changes" (
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
    CONSTRAINT "uid_apps_kuaipd_tenant__e0e991" UNIQUE ("tenant_id", "change_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_tenant__4074c7" ON "apps_kuaipdm_design_changes" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_change__d3ffcb" ON "apps_kuaipdm_design_changes" ("change_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_uuid_bf0581" ON "apps_kuaipdm_design_changes" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_status_ed0ecd" ON "apps_kuaipdm_design_changes" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_change__9fe946" ON "apps_kuaipdm_design_changes" ("change_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_product_904ffe" ON "apps_kuaipdm_design_changes" ("product_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_approva_1b9eab" ON "apps_kuaipdm_design_changes" ("approval_instance_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_approva_84dafa" ON "apps_kuaipdm_design_changes" ("approval_status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_created_25d79e" ON "apps_kuaipdm_design_changes" ("created_at");
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."change_no" IS '变更编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."change_type" IS '变更类型（设计变更、工艺变更、材料变更等）';
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."change_reason" IS '变更原因';
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."change_content" IS '变更内容描述';
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."change_scope" IS '变更影响范围';
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."priority" IS '优先级（普通、紧急、加急）';
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."status" IS '变更状态（待审批、审批中、已批准、执行中、已完成、已关闭）';
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."product_id" IS '关联产品ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."bom_id" IS '关联BOM ID（可选）';
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."approval_instance_id" IS '审批实例ID（关联ApprovalInstance）';
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."approval_status" IS '审批状态（pending、approved、rejected、cancelled）';
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."executor_id" IS '执行人ID（用户ID）';
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."execution_start_date" IS '执行开始日期';
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."execution_end_date" IS '执行结束日期';
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."execution_result" IS '执行结果';
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaipdm_design_changes" IS 'PDM设计变更表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaipdm_engineering_changes" (
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
    CONSTRAINT "uid_apps_kuaipd_tenant__b8d426" UNIQUE ("tenant_id", "change_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_tenant__30ec2a" ON "apps_kuaipdm_engineering_changes" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_change__52952c" ON "apps_kuaipdm_engineering_changes" ("change_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_uuid_0275be" ON "apps_kuaipdm_engineering_changes" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_status_77049d" ON "apps_kuaipdm_engineering_changes" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_change__09f392" ON "apps_kuaipdm_engineering_changes" ("change_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_product_6c4b6e" ON "apps_kuaipdm_engineering_changes" ("product_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_approva_435057" ON "apps_kuaipdm_engineering_changes" ("approval_instance_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_approva_ee4f0c" ON "apps_kuaipdm_engineering_changes" ("approval_status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_created_668597" ON "apps_kuaipdm_engineering_changes" ("created_at");
COMMENT ON COLUMN "apps_kuaipdm_engineering_changes"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaipdm_engineering_changes"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaipdm_engineering_changes"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaipdm_engineering_changes"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaipdm_engineering_changes"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaipdm_engineering_changes"."change_no" IS '变更编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaipdm_engineering_changes"."change_type" IS '变更类型（设计变更、工艺变更、材料变更等）';
COMMENT ON COLUMN "apps_kuaipdm_engineering_changes"."change_reason" IS '变更原因';
COMMENT ON COLUMN "apps_kuaipdm_engineering_changes"."change_content" IS '变更内容描述';
COMMENT ON COLUMN "apps_kuaipdm_engineering_changes"."change_impact" IS '变更影响分析';
COMMENT ON COLUMN "apps_kuaipdm_engineering_changes"."priority" IS '优先级（普通、紧急、加急）';
COMMENT ON COLUMN "apps_kuaipdm_engineering_changes"."status" IS '变更状态（待审批、审批中、已批准、执行中、已完成、已关闭）';
COMMENT ON COLUMN "apps_kuaipdm_engineering_changes"."product_id" IS '关联产品ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaipdm_engineering_changes"."approval_instance_id" IS '审批实例ID（关联ApprovalInstance）';
COMMENT ON COLUMN "apps_kuaipdm_engineering_changes"."approval_status" IS '审批状态（pending、approved、rejected、cancelled）';
COMMENT ON COLUMN "apps_kuaipdm_engineering_changes"."executor_id" IS '执行人ID（用户ID）';
COMMENT ON COLUMN "apps_kuaipdm_engineering_changes"."execution_start_date" IS '执行开始日期';
COMMENT ON COLUMN "apps_kuaipdm_engineering_changes"."execution_end_date" IS '执行结束日期';
COMMENT ON COLUMN "apps_kuaipdm_engineering_changes"."execution_result" IS '执行结果';
COMMENT ON COLUMN "apps_kuaipdm_engineering_changes"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaipdm_engineering_changes" IS 'PDM工程变更表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaipdm_design_reviews" (
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
    CONSTRAINT "uid_apps_kuaipd_tenant__a95341" UNIQUE ("tenant_id", "review_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_tenant__ced277" ON "apps_kuaipdm_design_reviews" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_review__993268" ON "apps_kuaipdm_design_reviews" ("review_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_uuid_a1af19" ON "apps_kuaipdm_design_reviews" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_status_ab587f" ON "apps_kuaipdm_design_reviews" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_review__361303" ON "apps_kuaipdm_design_reviews" ("review_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_product_98c03c" ON "apps_kuaipdm_design_reviews" ("product_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_review__ac4ac7" ON "apps_kuaipdm_design_reviews" ("review_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_created_ad29ca" ON "apps_kuaipdm_design_reviews" ("created_at");
COMMENT ON COLUMN "apps_kuaipdm_design_reviews"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaipdm_design_reviews"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaipdm_design_reviews"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaipdm_design_reviews"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaipdm_design_reviews"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaipdm_design_reviews"."review_no" IS '评审编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaipdm_design_reviews"."review_type" IS '评审类型（概念评审、设计评审、样机评审等）';
COMMENT ON COLUMN "apps_kuaipdm_design_reviews"."review_stage" IS '评审阶段';
COMMENT ON COLUMN "apps_kuaipdm_design_reviews"."product_id" IS '关联产品ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaipdm_design_reviews"."review_date" IS '评审日期';
COMMENT ON COLUMN "apps_kuaipdm_design_reviews"."status" IS '评审状态（计划中、进行中、已完成、已关闭）';
COMMENT ON COLUMN "apps_kuaipdm_design_reviews"."conclusion" IS '评审结论（通过、有条件通过、不通过）';
COMMENT ON COLUMN "apps_kuaipdm_design_reviews"."review_content" IS '评审内容';
COMMENT ON COLUMN "apps_kuaipdm_design_reviews"."review_result" IS '评审结果';
COMMENT ON COLUMN "apps_kuaipdm_design_reviews"."reviewers" IS '评审人员列表（JSON格式）';
COMMENT ON COLUMN "apps_kuaipdm_design_reviews"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaipdm_design_reviews" IS 'PDM设计评审表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaipdm_research_processes" (
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
    CONSTRAINT "uid_apps_kuaipd_tenant__120f74" UNIQUE ("tenant_id", "process_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_tenant__d11b58" ON "apps_kuaipdm_research_processes" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_process_c71c46" ON "apps_kuaipdm_research_processes" ("process_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_uuid_9600e7" ON "apps_kuaipdm_research_processes" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_status_640afe" ON "apps_kuaipdm_research_processes" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_process_65e77e" ON "apps_kuaipdm_research_processes" ("process_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_product_e35512" ON "apps_kuaipdm_research_processes" ("product_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_project_556cf9" ON "apps_kuaipdm_research_processes" ("project_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_current_e76c06" ON "apps_kuaipdm_research_processes" ("current_stage");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_created_8f02d3" ON "apps_kuaipdm_research_processes" ("created_at");
COMMENT ON COLUMN "apps_kuaipdm_research_processes"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaipdm_research_processes"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaipdm_research_processes"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaipdm_research_processes"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaipdm_research_processes"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaipdm_research_processes"."process_no" IS '流程编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaipdm_research_processes"."process_name" IS '流程名称';
COMMENT ON COLUMN "apps_kuaipdm_research_processes"."process_type" IS '流程类型（IPD、CMMI、APQP等）';
COMMENT ON COLUMN "apps_kuaipdm_research_processes"."process_template" IS '流程模板（JSON格式）';
COMMENT ON COLUMN "apps_kuaipdm_research_processes"."current_stage" IS '当前阶段';
COMMENT ON COLUMN "apps_kuaipdm_research_processes"."status" IS '流程状态（进行中、已完成、已暂停、已关闭）';
COMMENT ON COLUMN "apps_kuaipdm_research_processes"."product_id" IS '关联产品ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaipdm_research_processes"."project_id" IS '关联项目ID（可选，关联PM模块）';
COMMENT ON COLUMN "apps_kuaipdm_research_processes"."owner_id" IS '负责人ID（用户ID）';
COMMENT ON COLUMN "apps_kuaipdm_research_processes"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaipdm_research_processes" IS 'PDM研发流程表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaipdm_knowledges" (
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
    CONSTRAINT "uid_apps_kuaipd_tenant__40f18a" UNIQUE ("tenant_id", "knowledge_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_tenant__ff8c59" ON "apps_kuaipdm_knowledges" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_knowled_07e394" ON "apps_kuaipdm_knowledges" ("knowledge_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_uuid_52668c" ON "apps_kuaipdm_knowledges" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_knowled_b4adc5" ON "apps_kuaipdm_knowledges" ("knowledge_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_categor_823d0e" ON "apps_kuaipdm_knowledges" ("category");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_author__2e73c8" ON "apps_kuaipdm_knowledges" ("author_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_is_publ_dd5a3c" ON "apps_kuaipdm_knowledges" ("is_public");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_created_683e30" ON "apps_kuaipdm_knowledges" ("created_at");
COMMENT ON COLUMN "apps_kuaipdm_knowledges"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaipdm_knowledges"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaipdm_knowledges"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaipdm_knowledges"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaipdm_knowledges"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaipdm_knowledges"."knowledge_no" IS '知识编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaipdm_knowledges"."knowledge_type" IS '知识类型（技术知识、设计经验、最佳实践、专利等）';
COMMENT ON COLUMN "apps_kuaipdm_knowledges"."title" IS '知识标题';
COMMENT ON COLUMN "apps_kuaipdm_knowledges"."content" IS '知识内容';
COMMENT ON COLUMN "apps_kuaipdm_knowledges"."category" IS '知识分类';
COMMENT ON COLUMN "apps_kuaipdm_knowledges"."tags" IS '知识标签（JSON格式）';
COMMENT ON COLUMN "apps_kuaipdm_knowledges"."author_id" IS '作者ID（用户ID）';
COMMENT ON COLUMN "apps_kuaipdm_knowledges"."view_count" IS '查看次数';
COMMENT ON COLUMN "apps_kuaipdm_knowledges"."like_count" IS '点赞次数';
COMMENT ON COLUMN "apps_kuaipdm_knowledges"."rating" IS '评分（0-5分）';
COMMENT ON COLUMN "apps_kuaipdm_knowledges"."is_public" IS '是否公开';
COMMENT ON COLUMN "apps_kuaipdm_knowledges"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaipdm_knowledges" IS 'PDM知识管理表';;"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaipdm_design_changes";
        DROP TABLE IF EXISTS "apps_kuaipdm_engineering_changes";
        DROP TABLE IF EXISTS "apps_kuaipdm_design_reviews";
        DROP TABLE IF EXISTS "apps_kuaipdm_research_processes";
        DROP TABLE IF EXISTS "apps_kuaipdm_knowledges";"""


MODELS_STATE = (
    "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"
)
