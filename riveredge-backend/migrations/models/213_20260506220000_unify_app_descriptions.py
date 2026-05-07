"""
统一更新各应用的 description 字段，使风格一致：
  [业务范畴] + [核心价值定位]，约 12~18 字，专业简练。

快客户 / 快研发 / 快协同 为纯前端占位应用，无数据库行，不在此迁移中处理。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE core_applications SET description = '企业基础数据的统一管理与维护平台',    updated_at = NOW() WHERE code = 'master-data'  AND deleted_at IS NULL;
        UPDATE core_applications SET description = '制造业全流程一体化管控与协同平台',    updated_at = NOW() WHERE code = 'kuaizhizao'   AND deleted_at IS NULL;
        UPDATE core_applications SET description = '采购、销售、库存全链路协同管理平台',  updated_at = NOW() WHERE code = 'kuaierp'      AND deleted_at IS NULL;
        UPDATE core_applications SET description = '精益车间执行与生产计划实时协同平台',  updated_at = NOW() WHERE code = 'kuaimes'      AND deleted_at IS NULL;
        UPDATE core_applications SET description = '聚焦管理会计与经营分析协同平台（不含总账）', updated_at = NOW() WHERE code = 'kuaicaiwu' AND deleted_at IS NULL;
        UPDATE core_applications SET description = '工业物联网设备数采、互联与集成平台',  updated_at = NOW() WHERE code = 'kuaiiot'      AND deleted_at IS NULL;
        UPDATE core_applications SET description = '多源数据聚合与经营分析决策中心',      updated_at = NOW() WHERE code = 'kuaireport'   AND deleted_at IS NULL;
        UPDATE core_applications SET description = '嵌入业务场景的 AI 智能辅助引擎',     updated_at = NOW() WHERE code = 'kuaiai'       AND deleted_at IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    # 保留旧值备忘（可选恢复）
    return """
        UPDATE core_applications SET description = '系统的唯一数据源',                     updated_at = NOW() WHERE code = 'master-data'  AND deleted_at IS NULL;
        UPDATE core_applications SET description = '车间执行与协同核心',                   updated_at = NOW() WHERE code = 'kuaizhizao'   AND deleted_at IS NULL;
        UPDATE core_applications SET description = '标准进销存管理（由快制造虚拟拆分）',   updated_at = NOW() WHERE code = 'kuaierp'      AND deleted_at IS NULL;
        UPDATE core_applications SET description = '车间生产执行与计划协同（由快制造虚拟拆分）', updated_at = NOW() WHERE code = 'kuaimes' AND deleted_at IS NULL;
        UPDATE core_applications SET description = '业务驱动的管理会计',                   updated_at = NOW() WHERE code = 'kuaicaiwu'    AND deleted_at IS NULL;
        UPDATE core_applications SET description = '工业物联网数据采集与集成平台',         updated_at = NOW() WHERE code = 'kuaiiot'      AND deleted_at IS NULL;
        UPDATE core_applications SET description = '统一的数据决策中心',                   updated_at = NOW() WHERE code = 'kuaireport'   AND deleted_at IS NULL;
        UPDATE core_applications SET description = '在相关业务单据提供智能建议',            updated_at = NOW() WHERE code = 'kuaiai'       AND deleted_at IS NULL;
    """
