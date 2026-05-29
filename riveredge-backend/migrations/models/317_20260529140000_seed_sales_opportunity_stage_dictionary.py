"""为各租户同步 SALES_OPPORTUNITY_STAGE 系统字典（客户阶段）"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

_ITEMS = [
    (1, "初步接洽", "INITIAL", "线索进入"),
    (2, "需求确认", "QUALIFIED", "意向明确"),
    (3, "方案报价", "PROPOSAL", "方案与报价"),
    (4, "商务谈判", "NEGOTIATION", "议价与合同"),
    (5, "赢单", "WON", "成交关闭"),
    (6, "丢单", "LOST", "丢单关闭"),
]


async def upgrade(db: BaseDBAsyncClient) -> str:
    dict_insert = """
        INSERT INTO core_data_dictionaries (
            uuid, tenant_id, name, code, description, is_system, is_active, created_at, updated_at
        )
        SELECT
            gen_random_uuid()::text,
            t.id,
            '销售商机阶段',
            'SALES_OPPORTUNITY_STAGE',
            '销售商机漏斗阶段（sort_order 为漏斗顺序）',
            TRUE,
            TRUE,
            NOW(),
            NOW()
        FROM infra_tenants t
        WHERE NOT EXISTS (
            SELECT 1 FROM core_data_dictionaries d
            WHERE d.tenant_id = t.id
              AND d.code = 'SALES_OPPORTUNITY_STAGE'
              AND d.deleted_at IS NULL
          );
    """

    item_inserts = []
    for sort_order, label, value, description in _ITEMS:
        item_inserts.append(
            f"""
        INSERT INTO core_dictionary_items (
            uuid, tenant_id, dictionary_id, label, value, description, sort_order, is_active, created_at, updated_at
        )
        SELECT
            gen_random_uuid()::text,
            d.tenant_id,
            d.id,
            '{label}',
            '{value}',
            '{description}',
            {sort_order},
            TRUE,
            NOW(),
            NOW()
        FROM core_data_dictionaries d
        WHERE d.code = 'SALES_OPPORTUNITY_STAGE'
          AND d.deleted_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM core_dictionary_items i
            WHERE i.tenant_id = d.tenant_id
              AND i.dictionary_id = d.id
              AND i.value = '{value}'
              AND i.deleted_at IS NULL
          );
        """
        )

    return dict_insert + "\n".join(item_inserts)


async def downgrade(db: BaseDBAsyncClient) -> str:
    values = ", ".join(f"'{v}'" for _, _, v, _ in _ITEMS)
    return f"""
        DELETE FROM core_dictionary_items i
        USING core_data_dictionaries d
        WHERE i.dictionary_id = d.id
          AND d.code = 'SALES_OPPORTUNITY_STAGE'
          AND i.value IN ({values});

        DELETE FROM core_data_dictionaries
        WHERE code = 'SALES_OPPORTUNITY_STAGE';
    """
