"""
物料单位字典：去除同值重复项，软删除内置精简后不再保留的预设单位，并统一备注与排序。

- 重复来源：历史英文码迁移与新版预设并存时，同一 value（如「个」）可能有多行。
- 不删除租户自行新增的单位（仅处理迁移中列出的内置淘汰项）。

不可逆：downgrade 为空。

Author: Auto
Date: 2026-05-03
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE core_dictionary_items di
        SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE di.deleted_at IS NULL
          AND di.id IN (
              SELECT id
              FROM (
                  SELECT id,
                         ROW_NUMBER() OVER (
                             PARTITION BY tenant_id, dictionary_id, value
                             ORDER BY id ASC
                         ) AS rn
                  FROM core_dictionary_items
                  WHERE deleted_at IS NULL
                    AND dictionary_id IN (
                        SELECT id FROM core_data_dictionaries
                        WHERE code = 'MATERIAL_UNIT' AND deleted_at IS NULL
                    )
              ) x
              WHERE x.rn > 1
          );

        UPDATE core_dictionary_items di
        SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE di.deleted_at IS NULL
          AND di.dictionary_id IN (
              SELECT id FROM core_data_dictionaries
              WHERE code = 'MATERIAL_UNIT' AND deleted_at IS NULL
          )
          AND di.value IN (
              '盒', '袋', '瓶', '桶', '片', '卷',
              '厘米', '千米', '平方厘米', '毫升'
          );

        UPDATE core_dictionary_items AS di
        SET
            label = v.label,
            description = v.description,
            sort_order = v.sort_order,
            updated_at = CURRENT_TIMESTAMP
        FROM (
            VALUES
                ('个', '个', '件数', 1),
                ('件', '件', '件数', 2),
                ('台', '台', '设备/整机', 3),
                ('套', '套', '成套', 4),
                ('箱', '箱', '包装', 5),
                ('包', '包', '包装', 6),
                ('千克', '千克', '重量', 7),
                ('克', '克', '重量', 8),
                ('吨', '吨', '重量', 9),
                ('米', '米', '长度', 10),
                ('毫米', '毫米', '长度', 11),
                ('平方米', '平方米', '面积', 12),
                ('升', '升', '容积', 13),
                ('立方米', '立方米', '容积', 14)
        ) AS v(value, label, description, sort_order)
        WHERE di.deleted_at IS NULL
          AND di.dictionary_id IN (
              SELECT id FROM core_data_dictionaries
              WHERE code = 'MATERIAL_UNIT' AND deleted_at IS NULL
          )
          AND di.value = v.value;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return ""
