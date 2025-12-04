-- 查询需要重命名的索引和约束
-- 用于生成重命名 SQL 语句

-- ============================================
-- 1. 查询需要重命名的索引
-- ============================================
SELECT 
    schemaname,
    tablename,
    indexname,
    CASE 
        WHEN indexname LIKE 'idx_soil_%' THEN REPLACE(indexname, 'idx_soil_', 'idx_platform_')
        WHEN indexname LIKE 'idx_root_%' THEN REPLACE(indexname, 'idx_root_', 'idx_core_')
        WHEN indexname LIKE 'idx_sys_%' THEN REPLACE(indexname, 'idx_sys_', 'idx_core_')
        WHEN indexname LIKE 'idx_tree_%' THEN REPLACE(indexname, 'idx_tree_', 'idx_platform_')
        WHEN indexname LIKE 'uk_soil_%' THEN REPLACE(indexname, 'uk_soil_', 'uk_platform_')
        WHEN indexname LIKE 'uk_root_%' THEN REPLACE(indexname, 'uk_root_', 'uk_core_')
        WHEN indexname LIKE 'uk_sys_%' THEN REPLACE(indexname, 'uk_sys_', 'uk_core_')
        WHEN indexname LIKE 'uk_tree_%' THEN REPLACE(indexname, 'uk_tree_', 'uk_platform_')
        WHEN indexname LIKE 'pk_soil_%' THEN REPLACE(indexname, 'pk_soil_', 'pk_platform_')
        WHEN indexname LIKE 'pk_root_%' THEN REPLACE(indexname, 'pk_root_', 'pk_core_')
        WHEN indexname LIKE 'pk_sys_%' THEN REPLACE(indexname, 'pk_sys_', 'pk_core_')
        WHEN indexname LIKE 'pk_tree_%' THEN REPLACE(indexname, 'pk_tree_', 'pk_platform_')
    END as new_indexname
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND (
    indexname LIKE 'idx_soil_%' OR 
    indexname LIKE 'idx_root_%' OR 
    indexname LIKE 'idx_sys_%' OR 
    indexname LIKE 'idx_tree_%' OR
    indexname LIKE 'uk_soil_%' OR 
    indexname LIKE 'uk_root_%' OR 
    indexname LIKE 'uk_sys_%' OR 
    indexname LIKE 'uk_tree_%' OR
    indexname LIKE 'pk_soil_%' OR 
    indexname LIKE 'pk_root_%' OR 
    indexname LIKE 'pk_sys_%' OR 
    indexname LIKE 'pk_tree_%'
  )
ORDER BY tablename, indexname;

-- ============================================
-- 2. 查询需要重命名的外键约束
-- ============================================
SELECT 
    conname as constraint_name,
    conrelid::regclass as table_name,
    CASE 
        WHEN conname LIKE '%_soil_%' THEN REPLACE(REPLACE(REPLACE(conname, '_soil_', '_platform_'), 'fk_soil_', 'fk_platform_'), 'uk_soil_', 'uk_platform_')
        WHEN conname LIKE '%_root_%' THEN REPLACE(REPLACE(REPLACE(conname, '_root_', '_core_'), 'fk_root_', 'fk_core_'), 'uk_root_', 'uk_core_')
        WHEN conname LIKE '%_sys_%' THEN REPLACE(REPLACE(REPLACE(conname, '_sys_', '_core_'), 'fk_sys_', 'fk_core_'), 'uk_sys_', 'uk_core_')
        WHEN conname LIKE '%_tree_%' THEN REPLACE(REPLACE(REPLACE(conname, '_tree_', '_platform_'), 'fk_tree_', 'fk_platform_'), 'uk_tree_', 'uk_platform_')
    END as new_constraint_name
FROM pg_constraint
WHERE contype = 'f'
  AND schemaname = 'public'
  AND (
    conname LIKE '%_soil_%' OR 
    conname LIKE '%_root_%' OR 
    conname LIKE '%_sys_%' OR 
    conname LIKE '%_tree_%'
  )
ORDER BY conrelid::regclass, conname;

-- ============================================
-- 3. 查询需要重命名的唯一约束
-- ============================================
SELECT 
    conname as constraint_name,
    conrelid::regclass as table_name,
    CASE 
        WHEN conname LIKE '%_soil_%' THEN REPLACE(conname, '_soil_', '_platform_')
        WHEN conname LIKE '%_root_%' THEN REPLACE(conname, '_root_', '_core_')
        WHEN conname LIKE '%_sys_%' THEN REPLACE(conname, '_sys_', '_core_')
        WHEN conname LIKE '%_tree_%' THEN REPLACE(conname, '_tree_', '_platform_')
    END as new_constraint_name
FROM pg_constraint
WHERE contype = 'u'
  AND schemaname = 'public'
  AND (
    conname LIKE '%_soil_%' OR 
    conname LIKE '%_root_%' OR 
    conname LIKE '%_sys_%' OR 
    conname LIKE '%_tree_%'
  )
ORDER BY conrelid::regclass, conname;

-- ============================================
-- 4. 查询需要重命名的检查约束
-- ============================================
SELECT 
    conname as constraint_name,
    conrelid::regclass as table_name,
    CASE 
        WHEN conname LIKE '%_soil_%' THEN REPLACE(conname, '_soil_', '_platform_')
        WHEN conname LIKE '%_root_%' THEN REPLACE(conname, '_root_', '_core_')
        WHEN conname LIKE '%_sys_%' THEN REPLACE(conname, '_sys_', '_core_')
        WHEN conname LIKE '%_tree_%' THEN REPLACE(conname, '_tree_', '_platform_')
    END as new_constraint_name
FROM pg_constraint
WHERE contype = 'c'
  AND schemaname = 'public'
  AND (
    conname LIKE '%_soil_%' OR 
    conname LIKE '%_root_%' OR 
    conname LIKE '%_sys_%' OR 
    conname LIKE '%_tree_%'
  )
ORDER BY conrelid::regclass, conname;

