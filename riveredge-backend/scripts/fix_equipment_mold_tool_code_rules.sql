-- 修复设备、模具、工装编码规则为正确格式
-- 将「日期+4位流水」改为「前缀+4位流水」：EQ0001、MOLD0001、TOOL0001
-- 执行方式: psql -U postgres -d riveredge -f scripts/fix_equipment_mold_tool_code_rules.sql

UPDATE "core_code_rules"
SET 
    "rule_components" = '[{"type":"fixed_text","order":0,"text":"EQ"},{"type":"auto_counter","order":1,"digits":4,"fixed_width":true,"reset_cycle":"never","initial_value":1}]'::jsonb,
    "seq_reset_rule" = 'never',
    "description" = '设备管理编码规则，格式：EQ + 4位序号'
WHERE "code" = 'EQUIPMENT_CODE' AND "deleted_at" IS NULL;

UPDATE "core_code_rules"
SET 
    "rule_components" = '[{"type":"fixed_text","order":0,"text":"MOLD"},{"type":"auto_counter","order":1,"digits":4,"fixed_width":true,"reset_cycle":"never","initial_value":1}]'::jsonb,
    "seq_reset_rule" = 'never',
    "description" = '模具管理编码规则，格式：MOLD + 4位序号'
WHERE "code" = 'MOLD_CODE' AND "deleted_at" IS NULL;

UPDATE "core_code_rules"
SET 
    "rule_components" = '[{"type":"fixed_text","order":0,"text":"TOOL"},{"type":"auto_counter","order":1,"digits":4,"fixed_width":true,"reset_cycle":"never","initial_value":1}]'::jsonb,
    "seq_reset_rule" = 'never',
    "description" = '工装台账编码规则，格式：TOOL + 4位序号'
WHERE "code" = 'TOOL_CODE' AND "deleted_at" IS NULL;
