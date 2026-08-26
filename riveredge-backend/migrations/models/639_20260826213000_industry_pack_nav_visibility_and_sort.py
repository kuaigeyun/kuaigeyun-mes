"""
行业包侧栏：补齐 application_uuid / sort_order，无已启用行业模块时隐藏容器。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

_INDUSTRY_MODULE_CODES = (
    "spoke-wheel",
    "kuaimachinery",
    "kuaimolding",
    "kuaielectronics",
    "kuaiautoparts",
    "kuaimedical",
    "kuaifood",
    "kuaipackaging",
    "kuaihardware",
    "kuaidiecasting",
    "kuaiwiring",
    "kuaimotor",
    "kuaibattery",
    "kuainewequipment",
    "kuaisheetmetal",
    "kuaimold",
    "kuaisemiconductor",
)


async def upgrade(db: BaseDBAsyncClient) -> str:
    codes_sql = ", ".join(f"'{code}'" for code in _INDUSTRY_MODULE_CODES)
    return f"""
        UPDATE core_menus m
        SET application_uuid = a.uuid, updated_at = NOW()
        FROM core_applications a
        WHERE m.tenant_id = a.tenant_id
          AND a.code = 'industry-pack'
          AND m.path = '/apps/industry-pack'
          AND m.deleted_at IS NULL
          AND a.deleted_at IS NULL
          AND (
            m.application_uuid IS NULL
            OR m.application_uuid::text <> a.uuid::text
          );

        UPDATE core_applications
        SET sort_order = 290, updated_at = NOW()
        WHERE code = 'industry-pack'
          AND deleted_at IS NULL
          AND COALESCE(sort_order, 0) <> 290;

        UPDATE core_applications ip
        SET is_active = FALSE, updated_at = NOW()
        WHERE ip.code = 'industry-pack'
          AND ip.deleted_at IS NULL
          AND ip.is_installed = TRUE
          AND ip.is_active = TRUE
          AND NOT EXISTS (
            SELECT 1
            FROM core_applications mod
            WHERE mod.tenant_id = ip.tenant_id
              AND mod.deleted_at IS NULL
              AND mod.is_installed = TRUE
              AND mod.is_active = TRUE
              AND mod.code IN ({codes_sql})
          );

        UPDATE core_menus m
        SET is_active = FALSE, updated_at = NOW()
        FROM core_applications a
        WHERE m.application_uuid = a.uuid
          AND a.code = 'industry-pack'
          AND a.is_active = FALSE
          AND m.deleted_at IS NULL
          AND a.deleted_at IS NULL
          AND m.is_active = TRUE;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        SELECT 1;
    """
