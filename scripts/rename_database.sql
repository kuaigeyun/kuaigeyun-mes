-- ============================================
-- 数据库重命名脚本
-- RiverEdge SaaS 多组织框架
-- 
-- 执行前请先备份数据库！
-- 建议在测试环境先执行验证
-- ============================================

BEGIN;

-- ============================================
-- 1. 重命名系统级表（root_ 前缀）
-- ============================================

-- 用户表
ALTER TABLE IF EXISTS core_users RENAME TO root_users;
COMMENT ON TABLE root_users IS '系统级用户表（root - 系统级后端）';

-- 角色表
ALTER TABLE IF EXISTS core_roles RENAME TO root_roles;
COMMENT ON TABLE root_roles IS '系统级角色表（root - 系统级后端）';

-- 权限表
ALTER TABLE IF EXISTS core_permissions RENAME TO root_permissions;
COMMENT ON TABLE root_permissions IS '系统级权限表（root - 系统级后端）';

-- ============================================
-- 2. 重命名租户管理表（tree_ 前缀）
-- ============================================

-- 租户表
ALTER TABLE IF EXISTS core_tenants RENAME TO tree_tenants;
COMMENT ON TABLE tree_tenants IS '租户表（tree - 每个租户单独管理）';

-- 租户配置表
ALTER TABLE IF EXISTS core_tenant_configs RENAME TO tree_tenant_configs;
COMMENT ON TABLE tree_tenant_configs IS '租户配置表（tree - 每个租户单独管理）';

-- 租户活动日志表（如果存在）
ALTER TABLE IF EXISTS core_tenant_activity_logs RENAME TO tree_tenant_activity_logs;
COMMENT ON TABLE IF EXISTS tree_tenant_activity_logs IS '租户活动日志表（tree - 每个租户单独管理）';

-- ============================================
-- 3. 重命名索引
-- ============================================

-- 用户表索引
ALTER INDEX IF EXISTS idx_core_users_tenant_id RENAME TO idx_root_users_tenant_id;
ALTER INDEX IF EXISTS idx_core_users_username RENAME TO idx_root_users_username;
ALTER INDEX IF EXISTS idx_core_users_tenant_id_username RENAME TO idx_root_users_tenant_id_username;
ALTER INDEX IF EXISTS idx_core_users_is_platform_admin RENAME TO idx_root_users_is_platform_admin;

-- 角色表索引
ALTER INDEX IF EXISTS idx_core_roles_tenant_id RENAME TO idx_root_roles_tenant_id;
ALTER INDEX IF EXISTS idx_core_roles_name RENAME TO idx_root_roles_name;

-- 权限表索引
ALTER INDEX IF EXISTS idx_core_permissions_tenant_id RENAME TO idx_root_permissions_tenant_id;
ALTER INDEX IF EXISTS idx_core_permissions_code RENAME TO idx_root_permissions_code;

-- 租户表索引
ALTER INDEX IF EXISTS idx_core_tenant_tenant__e55d73 RENAME TO idx_tree_tenants_tenant_id;
ALTER INDEX IF EXISTS idx_core_tenant_domain_22c064 RENAME TO idx_tree_tenants_domain;
ALTER INDEX IF EXISTS idx_core_tenant_status_195cc5 RENAME TO idx_tree_tenants_status;
ALTER INDEX IF EXISTS idx_core_tenant_plan_fda057 RENAME TO idx_tree_tenants_plan;

-- 租户配置表索引
ALTER INDEX IF EXISTS idx_core_tenant_config_tenant__993185 RENAME TO idx_tree_tenant_configs_tenant_id;
ALTER INDEX IF EXISTS idx_core_tenant_config_config__3f2216 RENAME TO idx_tree_tenant_configs_config_key;
ALTER INDEX IF EXISTS idx_core_tenant_config_tenant__622b22 RENAME TO idx_tree_tenant_configs_tenant_id_config_key;

-- 租户活动日志表索引
ALTER INDEX IF EXISTS idx_core_tenant_activity_tenant__993185 RENAME TO idx_tree_tenant_activity_logs_tenant_id;
ALTER INDEX IF EXISTS idx_core_tenant_activity_created__3f2216 RENAME TO idx_tree_tenant_activity_logs_created_at;

-- ============================================
-- 4. 重命名外键约束（如果需要）
-- ============================================

-- 注意：PostgreSQL 会自动更新外键约束名称
-- 如果需要手动重命名，使用以下格式：
-- ALTER TABLE table_name RENAME CONSTRAINT old_name TO new_name;

COMMIT;

-- ============================================
-- 验证脚本
-- ============================================

-- 检查表是否存在
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'root_users', 'root_roles', 'root_permissions',
    'tree_tenants', 'tree_tenant_configs', 'tree_tenant_activity_logs'
  )
ORDER BY table_name;

-- 检查索引是否存在
SELECT indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND indexname LIKE 'idx_root_%' 
  OR indexname LIKE 'idx_tree_%'
ORDER BY indexname;

