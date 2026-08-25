"""
辐条轮毂总装（spoke-wheel）— 行业免费版

1. 业务表
2. 各租户注册应用记录（未安装，应用中心可发现后手动安装）
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_spoke_wheel_assemblies" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(50) NOT NULL,
            "work_order_id" INT,
            "work_order_code" VARCHAR(50),
            "product_material_id" INT,
            "product_material_code" VARCHAR(50),
            "product_material_name" VARCHAR(200),
            "hub_assembled" BOOL NOT NULL DEFAULT FALSE,
            "hub_barrel_assembled" BOOL NOT NULL DEFAULT FALSE,
            "hub_assembled_at" TIMESTAMPTZ,
            "fixture_dial_count" INT NOT NULL DEFAULT 3,
            "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
            "assembler_id" INT,
            "assembler_name" VARCHAR(100),
            "debugger_id" INT,
            "debugger_name" VARCHAR(100),
            "inspector_id" INT,
            "inspector_name" VARCHAR(100),
            "fixed_at" TIMESTAMPTZ,
            "debug_started_at" TIMESTAMPTZ,
            "debug_completed_at" TIMESTAMPTZ,
            "completed_at" TIMESTAMPTZ,
            "remarks" TEXT,
            "extra" JSONB,
            "final_max_deviation_mm" DECIMAL(10,4),
            "final_qc_passed" BOOL,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "deleted_at" TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS "idx_spoke_wheel_assemblies_tenant_id" ON "apps_spoke_wheel_assemblies" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_spoke_wheel_assemblies_code" ON "apps_spoke_wheel_assemblies" ("code");
        CREATE INDEX IF NOT EXISTS "idx_spoke_wheel_assemblies_work_order_id" ON "apps_spoke_wheel_assemblies" ("work_order_id");
        CREATE INDEX IF NOT EXISTS "idx_spoke_wheel_assemblies_status" ON "apps_spoke_wheel_assemblies" ("status");
        CREATE INDEX IF NOT EXISTS "idx_spoke_wheel_assemblies_created_at" ON "apps_spoke_wheel_assemblies" ("created_at");

        COMMENT ON TABLE "apps_spoke_wheel_assemblies" IS '辐条轮毂总装记录';
        COMMENT ON COLUMN "apps_spoke_wheel_assemblies"."status" IS 'draft=待装配, fixed=已固定4等份, debugging=调试中, qc_passed=同心度合格, qc_failed=同心度不合格, completed=总装完成';
        COMMENT ON COLUMN "apps_spoke_wheel_assemblies"."fixture_dial_count" IS '百分表数量,默认 3';

        CREATE TABLE IF NOT EXISTS "apps_spoke_wheel_concentricity_checks" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "assembly_id" INT NOT NULL,
            "assembly_code" VARCHAR(50) NOT NULL,
            "dial_1_value" DECIMAL(10,4) NOT NULL,
            "dial_2_value" DECIMAL(10,4) NOT NULL,
            "dial_3_value" DECIMAL(10,4) NOT NULL,
            "max_deviation_mm" DECIMAL(10,4) NOT NULL,
            "tolerance_mm" DECIMAL(10,4) NOT NULL DEFAULT 0.8,
            "is_qualified" BOOL NOT NULL,
            "inspector_id" INT,
            "inspector_name" VARCHAR(100),
            "remarks" TEXT,
            "measured_at" TIMESTAMPTZ,
            "deleted_at" TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS "idx_spoke_wheel_checks_tenant_id" ON "apps_spoke_wheel_concentricity_checks" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_spoke_wheel_checks_assembly_id" ON "apps_spoke_wheel_concentricity_checks" ("assembly_id");
        CREATE INDEX IF NOT EXISTS "idx_spoke_wheel_checks_assembly_code" ON "apps_spoke_wheel_concentricity_checks" ("assembly_code");
        CREATE INDEX IF NOT EXISTS "idx_spoke_wheel_checks_is_qualified" ON "apps_spoke_wheel_concentricity_checks" ("is_qualified");

        COMMENT ON TABLE "apps_spoke_wheel_concentricity_checks" IS '同心度检测 - 3 个百分表读数,极差 ≤ tolerance 视为合格';
        COMMENT ON COLUMN "apps_spoke_wheel_concentricity_checks"."tolerance_mm" IS '允差阈值(mm),默认 0.8';

        INSERT INTO core_applications (
            uuid, tenant_id, code, name, description, version,
            entry_point, route_path, sort_order,
            is_system, is_active, is_installed,
            created_at, updated_at
        )
        SELECT
            gen_random_uuid(),
            t.id,
            'spoke-wheel',
            '辐条轮毂总装',
            '铝合金辐条轮毂 5 部件 + 总装调试业务模块(同心度 ≤ 0.8mm)',
            '0.1.0',
            '../apps/spoke-wheel/index.tsx',
            '/apps/spoke-wheel',
            300,
            FALSE, TRUE, FALSE,
            NOW(), NOW()
        FROM infra_tenants t
        WHERE NOT EXISTS (
            SELECT 1 FROM core_applications
            WHERE code = 'spoke-wheel' AND tenant_id = t.id AND deleted_at IS NULL
        );

        UPDATE core_applications
        SET sort_order = 300,
            name = '辐条轮毂总装',
            description = '铝合金辐条轮毂 5 部件 + 总装调试业务模块(同心度 ≤ 0.8mm)',
            entry_point = '../apps/spoke-wheel/index.tsx',
            route_path = '/apps/spoke-wheel',
            updated_at = NOW()
        WHERE code = 'spoke-wheel' AND deleted_at IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DELETE FROM core_applications
        WHERE code = 'spoke-wheel' AND is_installed = FALSE AND deleted_at IS NULL;
        DROP TABLE IF EXISTS "apps_spoke_wheel_concentricity_checks" CASCADE;
        DROP TABLE IF EXISTS "apps_spoke_wheel_assemblies" CASCADE;
    """
