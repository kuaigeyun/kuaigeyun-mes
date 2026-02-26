"""
修复设备、模具、工装编码规则为正确格式

将 EQUIPMENT_CODE、MOLD_CODE、TOOL_CODE 的规则从「日期+4位流水」改为「前缀+4位流水」：
- 设备：EQ + 4位流水（如 EQ0001）
- 模具：MOLD + 4位流水（如 MOLD0001）
- 工装：TOOL + 4位流水（如 TOOL0001）

Author: AI Assistant
Date: 2026-02-26
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

# 正确的规则组件（无日期，前缀+4位流水）
EQUIPMENT_RULE_COMPONENTS = '[{"type":"fixed_text","order":0,"text":"EQ"},{"type":"auto_counter","order":1,"digits":4,"fixed_width":true,"reset_cycle":"never","initial_value":1}]'
MOLD_RULE_COMPONENTS = '[{"type":"fixed_text","order":0,"text":"MOLD"},{"type":"auto_counter","order":1,"digits":4,"fixed_width":true,"reset_cycle":"never","initial_value":1}]'
TOOL_RULE_COMPONENTS = '[{"type":"fixed_text","order":0,"text":"TOOL"},{"type":"auto_counter","order":1,"digits":4,"fixed_width":true,"reset_cycle":"never","initial_value":1}]'


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：将设备、模具、工装编码规则更新为正确格式
    """
    return f"""
        -- ============================================
        -- 修复设备、模具、工装编码规则
        -- ============================================
        
        UPDATE "core_code_rules"
        SET 
            "rule_components" = '{EQUIPMENT_RULE_COMPONENTS.replace("'", "''")}'::jsonb,
            "seq_reset_rule" = 'never',
            "description" = '设备管理编码规则，格式：EQ + 4位序号'
        WHERE "code" = 'EQUIPMENT_CODE' AND "deleted_at" IS NULL;
        
        UPDATE "core_code_rules"
        SET 
            "rule_components" = '{MOLD_RULE_COMPONENTS.replace("'", "''")}'::jsonb,
            "seq_reset_rule" = 'never',
            "description" = '模具管理编码规则，格式：MOLD + 4位序号'
        WHERE "code" = 'MOLD_CODE' AND "deleted_at" IS NULL;
        
        UPDATE "core_code_rules"
        SET 
            "rule_components" = '{TOOL_RULE_COMPONENTS.replace("'", "''")}'::jsonb,
            "seq_reset_rule" = 'never',
            "description" = '工装台账编码规则，格式：TOOL + 4位序号'
        WHERE "code" = 'TOOL_CODE' AND "deleted_at" IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：不执行回滚（无法恢复为旧格式的日期+流水）
    """
    return "-- 不执行回滚，设备/模具/工装规则保持当前格式"
