from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "uid_apps_master_tenant__c20101";
        -- 先添加字段为可空
        ALTER TABLE "apps_master_data_materials" ADD COLUMN IF NOT EXISTS "main_code" VARCHAR(50);
        ALTER TABLE "apps_master_data_materials" ADD COLUMN IF NOT EXISTS "material_type" VARCHAR(20) DEFAULT 'RAW';
        -- 为现有数据生成主编码（从code字段复制，如果code为空则生成新编码）
        -- 使用子查询生成序列号
        WITH numbered_materials AS (
            SELECT "id", "tenant_id", "code",
                   ROW_NUMBER() OVER (PARTITION BY "tenant_id" ORDER BY "id") as seq
            FROM "apps_master_data_materials"
            WHERE "main_code" IS NULL
        )
        UPDATE "apps_master_data_materials" m
        SET "main_code" = COALESCE(
            m."code", 
            'MAT-RAW-' || LPAD(nm.seq::TEXT, 4, '0')
        )
        FROM numbered_materials nm
        WHERE m."id" = nm."id" AND m."main_code" IS NULL;
        -- 设置material_type默认值
        UPDATE "apps_master_data_materials" 
        SET "material_type" = 'RAW'
        WHERE "material_type" IS NULL;
        -- 现在设置为NOT NULL
        ALTER TABLE "apps_master_data_materials" ALTER COLUMN "main_code" SET NOT NULL;
        ALTER TABLE "apps_master_data_materials" ALTER COLUMN "material_type" SET NOT NULL;
        ALTER TABLE "apps_master_data_materials" ALTER COLUMN "code" DROP NOT NULL;
        ALTER TABLE "apps_master_data_materials" ALTER COLUMN "code" TYPE VARCHAR(50) USING "code"::VARCHAR(50);
        CREATE TABLE IF NOT EXISTS "apps_master_data_material_code_aliases" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "code_type" VARCHAR(20) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "department" VARCHAR(100),
    "description" TEXT,
    "is_primary" BOOL NOT NULL  DEFAULT False,
    "deleted_at" TIMESTAMPTZ,
    "material_id" INT NOT NULL REFERENCES "apps_master_data_materials" ("id") ON DELETE CASCADE,
    CONSTRAINT "uid_apps_master_tenant__2e2957" UNIQUE ("tenant_id", "code_type", "code")
);
CREATE INDEX IF NOT EXISTS "idx_apps_master_tenant__8bc983" ON "apps_master_data_material_code_aliases" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_master_materia_7173ad" ON "apps_master_data_material_code_aliases" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_master_code_ty_22d335" ON "apps_master_data_material_code_aliases" ("code_type");
CREATE INDEX IF NOT EXISTS "idx_apps_master_code_ee7b7a" ON "apps_master_data_material_code_aliases" ("code");
CREATE INDEX IF NOT EXISTS "idx_apps_master_uuid_6ad1b5" ON "apps_master_data_material_code_aliases" ("uuid");
COMMENT ON COLUMN "apps_master_data_materials"."main_code" IS '主编码（系统内部唯一标识，格式：MAT-{类型}-{序号}）';
COMMENT ON COLUMN "apps_master_data_materials"."material_type" IS '物料类型（FIN/SEMI/RAW/PACK/AUX）';
COMMENT ON COLUMN "apps_master_data_material_code_aliases"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_master_data_material_code_aliases"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_master_data_material_code_aliases"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_master_data_material_code_aliases"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_master_data_material_code_aliases"."id" IS '主键ID';
COMMENT ON COLUMN "apps_master_data_material_code_aliases"."code_type" IS '编码类型（SALE/DES/SUP/PUR/WH/PROD等）';
COMMENT ON COLUMN "apps_master_data_material_code_aliases"."code" IS '部门编码';
COMMENT ON COLUMN "apps_master_data_material_code_aliases"."department" IS '部门名称（可选）';
COMMENT ON COLUMN "apps_master_data_material_code_aliases"."description" IS '描述（可选）';
COMMENT ON COLUMN "apps_master_data_material_code_aliases"."is_primary" IS '是否为主要编码（同一类型中，只有一个可以是主要编码）';
COMMENT ON COLUMN "apps_master_data_material_code_aliases"."deleted_at" IS '删除时间（软删除）';
COMMENT ON COLUMN "apps_master_data_material_code_aliases"."material_id" IS '关联的物料';
COMMENT ON TABLE "apps_master_data_material_code_aliases" IS '物料编码别名模型';;
        CREATE UNIQUE INDEX "uid_apps_master_tenant__64e181" ON "apps_master_data_materials" ("tenant_id", "main_code");
        CREATE INDEX "idx_apps_master_main_co_78d131" ON "apps_master_data_materials" ("main_code");
        CREATE INDEX "idx_apps_master_materia_b25b1a" ON "apps_master_data_materials" ("material_type");"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX "idx_apps_master_materia_b25b1a";
        DROP INDEX "idx_apps_master_main_co_78d131";
        DROP INDEX "uid_apps_master_tenant__64e181";
        ALTER TABLE "apps_master_data_materials" DROP COLUMN "main_code";
        ALTER TABLE "apps_master_data_materials" DROP COLUMN "material_type";
        ALTER TABLE "apps_master_data_materials" ALTER COLUMN "code" SET NOT NULL;
        ALTER TABLE "apps_master_data_materials" ALTER COLUMN "code" TYPE VARCHAR(50) USING "code"::VARCHAR(50);
        DROP TABLE IF EXISTS "apps_master_data_material_code_aliases";
        CREATE UNIQUE INDEX "uid_apps_master_tenant__c20101" ON "apps_master_data_materials" ("tenant_id", "code");"""
