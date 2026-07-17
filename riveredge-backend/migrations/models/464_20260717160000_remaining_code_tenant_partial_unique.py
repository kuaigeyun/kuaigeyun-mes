"""
剩余业务编码全局唯一 → 租户内 + 未删除部分唯一。

全局扫描后仅剩：报表看板 code、质检标准 standard_code。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

_REMAINING: list[tuple[str, list[str], str, list[str]]] = [
    (
        "apps_kuaireport_dashboards",
        ["apps_kuaireport_dashboards_code_key"],
        "uidx_kuaireport_dashboards_tenant_code_active",
        ["tenant_id", "code"],
    ),
    (
        "apps_kuaizhizao_quality_standards",
        ["apps_kuaizhizao_quality_standards_standard_code_key"],
        "uidx_quality_standards_tenant_standard_code_active",
        ["tenant_id", "standard_code"],
    ),
]


def _drop_old(table: str, names: list[str]) -> str:
    parts = []
    for name in names:
        parts.append(
            f"""
            IF EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = '{name}' AND conrelid = '{table}'::regclass
            ) THEN
                ALTER TABLE "{table}" DROP CONSTRAINT "{name}";
            END IF;
            DROP INDEX IF EXISTS "{name}";
            """
        )
    return "\n".join(parts)


async def upgrade(db: BaseDBAsyncClient) -> str:
    blocks: list[str] = []
    for table, old_names, new_name, cols in _REMAINING:
        col_list = ", ".join(f'"{c}"' for c in cols)
        blocks.append(
            f"""
            DO $$
            BEGIN
                IF to_regclass('public.{table}') IS NULL THEN
                    RETURN;
                END IF;
                {_drop_old(table, old_names)}
            END $$;

            CREATE UNIQUE INDEX IF NOT EXISTS "{new_name}"
            ON "{table}" ({col_list})
            WHERE "deleted_at" IS NULL;
            """
        )
    return "\n".join(blocks)


async def downgrade(db: BaseDBAsyncClient) -> str:
    return "\n".join(
        f'DROP INDEX IF EXISTS "{new_name}";' for _, _, new_name, _ in _REMAINING
    )
