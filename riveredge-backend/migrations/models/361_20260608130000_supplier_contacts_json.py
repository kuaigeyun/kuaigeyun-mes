"""供应商联系人明细：contacts JSONB，并从既有单联系人字段回填。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_suppliers"
            ADD COLUMN IF NOT EXISTS "contacts" JSONB NOT NULL DEFAULT '[]';
        COMMENT ON COLUMN "apps_master_data_suppliers"."contacts" IS '联系人明细 JSON 数组';

        UPDATE "apps_master_data_suppliers"
           SET "contacts" = jsonb_build_array(
                 jsonb_strip_nulls(
                   jsonb_build_object(
                     'contact_person', "contact_person",
                     'contact_title', "contact_title",
                     'phone', "phone",
                     'email', "email"
                   )
                 )
               )
         WHERE "deleted_at" IS NULL
           AND COALESCE(jsonb_array_length("contacts"), 0) = 0
           AND (
             NULLIF(TRIM(COALESCE("contact_person", '')), '') IS NOT NULL
             OR NULLIF(TRIM(COALESCE("contact_title", '')), '') IS NOT NULL
             OR NULLIF(TRIM(COALESCE("phone", '')), '') IS NOT NULL
             OR NULLIF(TRIM(COALESCE("email", '')), '') IS NOT NULL
           );
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_suppliers"
            DROP COLUMN IF EXISTS "contacts";
    """
