"""
工位终端升级：人脸特征模板、安灯联动字段、上岗资质、交接班记录。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "core_user_face_templates" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "user_id" INT NOT NULL REFERENCES "core_users" ("id") ON DELETE CASCADE,
            "descriptor" JSONB NOT NULL,
            "quality" DOUBLE PRECISION,
            "device_info" VARCHAR(255),
            "deleted_at" TIMESTAMPTZ,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100)
        );
        CREATE INDEX IF NOT EXISTS "idx_face_tpl_tenant" ON "core_user_face_templates" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_face_tpl_user" ON "core_user_face_templates" ("user_id");
        CREATE INDEX IF NOT EXISTS "idx_face_tpl_tenant_user" ON "core_user_face_templates" ("tenant_id", "user_id");
        COMMENT ON TABLE "core_user_face_templates" IS '用户人脸特征模板（工位终端生物识别）';

        ALTER TABLE "apps_kuaizhizao_station_andon_calls"
            ADD COLUMN IF NOT EXISTS "related_doc_type" VARCHAR(50),
            ADD COLUMN IF NOT EXISTS "related_doc_uuid" VARCHAR(36),
            ADD COLUMN IF NOT EXISTS "related_doc_code" VARCHAR(100),
            ADD COLUMN IF NOT EXISTS "equipment_uuid" VARCHAR(36),
            ADD COLUMN IF NOT EXISTS "fault_level" VARCHAR(50),
            ADD COLUMN IF NOT EXISTS "material_call_mode" VARCHAR(32),
            ADD COLUMN IF NOT EXISTS "supervisor_user_id" INT;

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_operator_skill_qualifications" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "user_id" INT NOT NULL,
            "user_name" VARCHAR(100),
            "operation_id" INT NOT NULL,
            "operation_code" VARCHAR(50),
            "operation_name" VARCHAR(100),
            "skill_level" VARCHAR(32) NOT NULL DEFAULT 'qualified',
            "valid_from" TIMESTAMPTZ,
            "valid_until" TIMESTAMPTZ,
            "is_active" BOOL NOT NULL DEFAULT TRUE,
            "remarks" TEXT,
            "deleted_at" TIMESTAMPTZ,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100)
        );
        CREATE INDEX IF NOT EXISTS "idx_op_skill_tenant" ON "apps_kuaizhizao_operator_skill_qualifications" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_op_skill_user" ON "apps_kuaizhizao_operator_skill_qualifications" ("user_id");
        CREATE INDEX IF NOT EXISTS "idx_op_skill_op" ON "apps_kuaizhizao_operator_skill_qualifications" ("operation_id");
        CREATE INDEX IF NOT EXISTS "idx_op_skill_tenant_user_op"
            ON "apps_kuaizhizao_operator_skill_qualifications" ("tenant_id", "user_id", "operation_id");
        COMMENT ON TABLE "apps_kuaizhizao_operator_skill_qualifications" IS '操作员工序技能资质';

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_station_shift_handovers" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "workstation_id" INT,
            "workstation_name" VARCHAR(100),
            "operator_id" INT NOT NULL,
            "operator_name" VARCHAR(100) NOT NULL,
            "shift_start" TIMESTAMPTZ NOT NULL,
            "shift_end" TIMESTAMPTZ NOT NULL,
            "planned_qty" DECIMAL(18,4) NOT NULL DEFAULT 0,
            "completed_qty" DECIMAL(18,4) NOT NULL DEFAULT 0,
            "unqualified_qty" DECIMAL(18,4) NOT NULL DEFAULT 0,
            "downtime_minutes" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "andon_count" INT NOT NULL DEFAULT 0,
            "summary_json" JSONB,
            "remarks" TEXT,
            "deleted_at" TIMESTAMPTZ,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100)
        );
        CREATE INDEX IF NOT EXISTS "idx_shift_ho_tenant" ON "apps_kuaizhizao_station_shift_handovers" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_shift_ho_ws" ON "apps_kuaizhizao_station_shift_handovers" ("workstation_id");
        CREATE INDEX IF NOT EXISTS "idx_shift_ho_created" ON "apps_kuaizhizao_station_shift_handovers" ("created_at");
        COMMENT ON TABLE "apps_kuaizhizao_station_shift_handovers" IS '工位交接班';
        """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_station_shift_handovers";
        DROP TABLE IF EXISTS "apps_kuaizhizao_operator_skill_qualifications";
        ALTER TABLE "apps_kuaizhizao_station_andon_calls"
            DROP COLUMN IF EXISTS "related_doc_type",
            DROP COLUMN IF EXISTS "related_doc_uuid",
            DROP COLUMN IF EXISTS "related_doc_code",
            DROP COLUMN IF EXISTS "equipment_uuid",
            DROP COLUMN IF EXISTS "fault_level",
            DROP COLUMN IF EXISTS "material_call_mode",
            DROP COLUMN IF EXISTS "supervisor_user_id";
        DROP TABLE IF EXISTS "core_user_face_templates";
        """
