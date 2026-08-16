"""
图纸密级、用户密级授权、图档借阅单。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "apps_master_data_engineering_drawings"
    ADD COLUMN IF NOT EXISTS "security_level" VARCHAR(20) NOT NULL DEFAULT 'internal';
CREATE INDEX IF NOT EXISTS "idx_eng_drawings_security"
    ON "apps_master_data_engineering_drawings" ("security_level");

CREATE TABLE IF NOT EXISTS "apps_master_data_drawing_user_clearances" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "user_id" INT NOT NULL,
    "user_name" VARCHAR(100) NOT NULL,
    "security_level" VARCHAR(20) NOT NULL,
    "updated_by" INT,
    "updated_by_name" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_drawing_clearance_user"
    ON "apps_master_data_drawing_user_clearances" ("tenant_id", "user_id");

CREATE TABLE IF NOT EXISTS "apps_master_data_drawing_loans" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "purpose" VARCHAR(500),
    "due_at" TIMESTAMPTZ NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'Draft',
    "returned_at" TIMESTAMPTZ,
    "returned_by" INT,
    "returned_by_name" VARCHAR(100),
    "deleted_at" TIMESTAMPTZ,
    "created_by" INT,
    "created_by_name" VARCHAR(100),
    "updated_by" INT,
    "updated_by_name" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "idx_drawing_loan_tenant" ON "apps_master_data_drawing_loans" ("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_drawing_loan_code"
    ON "apps_master_data_drawing_loans" ("tenant_id", "code")
    WHERE "deleted_at" IS NULL;

CREATE TABLE IF NOT EXISTS "apps_master_data_drawing_loan_lines" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "loan_id" INT NOT NULL,
    "drawing_id" INT NOT NULL,
    "drawing_uuid" VARCHAR(36) NOT NULL,
    "drawing_code" VARCHAR(50) NOT NULL,
    "drawing_name" VARCHAR(200) NOT NULL,
    "drawing_revision" VARCHAR(20) NOT NULL,
    "security_level" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "idx_drawing_loan_line_loan" ON "apps_master_data_drawing_loan_lines" ("loan_id");
CREATE INDEX IF NOT EXISTS "idx_drawing_loan_line_drawing" ON "apps_master_data_drawing_loan_lines" ("drawing_id");
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
DROP TABLE IF EXISTS "apps_master_data_drawing_loan_lines";
DROP TABLE IF EXISTS "apps_master_data_drawing_loans";
DROP TABLE IF EXISTS "apps_master_data_drawing_user_clearances";
ALTER TABLE "apps_master_data_engineering_drawings" DROP COLUMN IF EXISTS "security_level";
"""
