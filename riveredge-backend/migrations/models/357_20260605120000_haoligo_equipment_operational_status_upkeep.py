"""为各租户 HAOLIGO_EQUIPMENT_OPERATIONAL_STATUS 字典补充「保养」(upkeep) 项。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        INSERT INTO core_dictionary_items (
            uuid, tenant_id, dictionary_id, label, value, description, sort_order, is_active, created_at, updated_at
        )
        SELECT
            gen_random_uuid()::text,
            d.tenant_id,
            d.id,
            '保养',
            'upkeep',
            '设备保养中（手动调整）',
            3,
            TRUE,
            NOW(),
            NOW()
        FROM core_data_dictionaries d
        WHERE d.code = 'HAOLIGO_EQUIPMENT_OPERATIONAL_STATUS'
          AND d.deleted_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM core_dictionary_items i
            WHERE i.tenant_id = d.tenant_id
              AND i.dictionary_id = d.id
              AND i.value = 'upkeep'
              AND i.deleted_at IS NULL
          );
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DELETE FROM core_dictionary_items i
        USING core_data_dictionaries d
        WHERE i.dictionary_id = d.id
          AND d.code = 'HAOLIGO_EQUIPMENT_OPERATIONAL_STATUS'
          AND i.value = 'upkeep';
    """
