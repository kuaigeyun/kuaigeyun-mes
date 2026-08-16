"""轻办公表单模板：挂菜单开关。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaioa_form_templates"
        ADD COLUMN IF NOT EXISTS "show_in_menu" BOOLEAN NOT NULL DEFAULT FALSE;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaioa_form_templates"
        DROP COLUMN IF EXISTS "show_in_menu";
    """
