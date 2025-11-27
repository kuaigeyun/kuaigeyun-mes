-- ============================================
-- 数据库重命名回滚脚本
-- RiverEdge SaaS 多组织框架
-- 
-- 用于回滚数据库重命名操作
-- ============================================

BEGIN;

-- ============================================
-- 1. 回滚系统级表（root_ → core_）
-- ============================================

ALTER TABLE root_users RENAME TO core_users;
ALTER TABLE root_roles RENAME TO core_roles;
ALTER TABLE root_permissions RENAME TO core_permissions;

-- ============================================
-- 2. 回滚租户管理表（tree_ → core_）
-- ============================================

ALTER TABLE tree_tenants RENAME TO core_tenants;
ALTER TABLE tree_tenant_configs RENAME TO core_tenant_configs;
ALTER TABLE tree_tenant_activity_logs RENAME TO core_tenant_activity_logs;

-- ============================================
-- 3. 回滚索引
-- ============================================

-- 用户表索引
ALTER INDEX IF EXISTS idx_root_users_tenant_id RENAME TO idx_core_users_tenant_id;
ALTER INDEX IF EXISTS idx_root_users_username RENAME TO idx_core_users_username;
ALTER INDEX IF EXISTS idx_root_users_tenant_id_username RENAME TO idx_core_users_tenant_id_username;
ALTER INDEX IF EXISTS idx_root_users_is_platform_admin RENAME TO idx_core_users_is_platform_admin;

-- 角色表索引
ALTER INDEX IF EXISTS idx_root_roles_tenant_id RENAME TO idx_core_roles_tenant_id;
ALTER INDEX IF EXISTS idx_root_roles_name RENAME TO idx_core_roles_name;

-- 权限表索引
ALTER INDEX IF EXISTS idx_root_permissions_tenant_id RENAME TO idx_core_permissions_tenant_id;
ALTER INDEX IF EXISTS idx_root_permissions_code RENAME TO idx_core_permissions_code;

-- 租户表索引
ALTER INDEX IF EXISTS idx_tree_tenants_tenant_id RENAME TO idx_core_tenant_tenant__e55d73;
ALTER INDEX IF EXISTS idx_tree_tenants_domain RENAME TO idx_core_tenant_domain_22c064;
ALTER INDEX IF EXISTS idx_tree_tenants_status RENAME TO idx_core_tenant_status_195cc5;
ALTER INDEX IF EXISTS idx_tree_tenants_plan RENAME TO idx_core_tenant_plan_fda057;

-- 租户配置表索引
ALTER INDEX IF EXISTS idx_tree_tenant_configs_tenant_id RENAME TO idx_core_tenant_config_tenant__993185;
ALTER INDEX IF EXISTS idx_tree_tenant_configs_config_key RENAME TO idx_core_tenant_config_config__3f2216;
ALTER INDEX IF EXISTS idx_tree_tenant_configs_tenant_id_config_key RENAME TO idx_core_tenant_config_tenant__622b22;

-- 租户活动日志表索引
ALTER INDEX IF EXISTS idx_tree_tenant_activity_logs_tenant_id RENAME TO idx_core_tenant_activity_tenant__993185;
ALTER INDEX IF EXISTS idx_tree_tenant_activity_logs_created_at RENAME TO idx_core_tenant_activity_created__3f2216;

COMMIT;

