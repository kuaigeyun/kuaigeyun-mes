"""
数据库表重命名迁移

根据新的命名哲学重命名数据库表：
- core_users → root_users (系统级后端)
- core_roles → root_roles (系统级后端)
- core_permissions → root_permissions (系统级后端)
- core_tenants → tree_tenants (租户管理)
- core_tenant_configs → tree_tenant_configs (租户管理)
- core_tenant_activity_logs → tree_tenant_activity_logs (租户管理)

同时重命名相关索引和约束。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- ============================================
        -- 重命名系统级表（root_ 前缀）
        -- ============================================
        
        -- 重命名用户表
        ALTER TABLE IF EXISTS "core_users" RENAME TO "root_users";
        COMMENT ON TABLE "root_users" IS '系统级用户表（root - 系统级后端）';
        
        -- 重命名角色表
        ALTER TABLE IF EXISTS "core_roles" RENAME TO "root_roles";
        COMMENT ON TABLE "root_roles" IS '系统级角色表（root - 系统级后端）';
        
        -- 重命名权限表
        ALTER TABLE IF EXISTS "core_permissions" RENAME TO "root_permissions";
        COMMENT ON TABLE "root_permissions" IS '系统级权限表（root - 系统级后端）';
        
        -- ============================================
        -- 重命名租户管理表（tree_ 前缀）
        -- ============================================
        
        -- 重命名租户表
        ALTER TABLE IF EXISTS "core_tenants" RENAME TO "tree_tenants";
        COMMENT ON TABLE "tree_tenants" IS '租户表（tree - 每个租户单独管理）';
        
        -- 重命名租户配置表
        ALTER TABLE IF EXISTS "core_tenant_configs" RENAME TO "tree_tenant_configs";
        COMMENT ON TABLE "tree_tenant_configs" IS '租户配置表（tree - 每个租户单独管理）';
        
        -- 重命名租户活动日志表
        ALTER TABLE IF EXISTS "core_tenant_activity_logs" RENAME TO "tree_tenant_activity_logs";
        COMMENT ON TABLE "tree_tenant_activity_logs" IS '租户活动日志表（tree - 每个租户单独管理）';
        
        -- ============================================
        -- 重命名用户表索引
        -- ============================================
        
        ALTER INDEX IF EXISTS "idx_core_users_tenant__7bf229" RENAME TO "idx_root_users_tenant_id";
        ALTER INDEX IF EXISTS "idx_core_users_usernam_b84f0b" RENAME TO "idx_root_users_username";
        ALTER INDEX IF EXISTS "idx_core_users_email_438fe9" RENAME TO "idx_root_users_email";
        ALTER INDEX IF EXISTS "idx_core_users_tenant__8d51a4" RENAME TO "idx_root_users_tenant_id_username";
        ALTER INDEX IF EXISTS "idx_core_users_is_platform_admin" RENAME TO "idx_root_users_is_platform_admin";
        
        -- ============================================
        -- 重命名角色表索引
        -- ============================================
        
        ALTER INDEX IF EXISTS "idx_core_roles_tenant__82fa42" RENAME TO "idx_root_roles_tenant_id";
        ALTER INDEX IF EXISTS "idx_core_roles_name_b2ea14" RENAME TO "idx_root_roles_name";
        ALTER INDEX IF EXISTS "idx_core_roles_code_4053fd" RENAME TO "idx_root_roles_code";
        ALTER INDEX IF EXISTS "idx_core_roles_tenant__c64518" RENAME TO "idx_root_roles_tenant_id_name";
        ALTER INDEX IF EXISTS "idx_core_roles_tenant__f765ef" RENAME TO "idx_root_roles_tenant_id_code";
        
        -- ============================================
        -- 重命名权限表索引
        -- ============================================
        
        ALTER INDEX IF EXISTS "idx_core_permis_tenant__d00b13" RENAME TO "idx_root_permissions_tenant_id";
        ALTER INDEX IF EXISTS "idx_core_permis_name_cd30b2" RENAME TO "idx_root_permissions_name";
        ALTER INDEX IF EXISTS "idx_core_permis_code_d0d5b4" RENAME TO "idx_root_permissions_code";
        ALTER INDEX IF EXISTS "idx_core_permis_resourc_2f2a9a" RENAME TO "idx_root_permissions_resource";
        ALTER INDEX IF EXISTS "idx_core_permis_action_b49dc9" RENAME TO "idx_root_permissions_action";
        ALTER INDEX IF EXISTS "idx_core_permis_tenant__44d640" RENAME TO "idx_root_permissions_tenant_id_code";
        
        -- ============================================
        -- 重命名租户表索引
        -- ============================================
        
        ALTER INDEX IF EXISTS "idx_core_tenant_tenant__e55d73" RENAME TO "idx_tree_tenants_tenant_id";
        ALTER INDEX IF EXISTS "idx_core_tenant_domain_22c064" RENAME TO "idx_tree_tenants_domain";
        ALTER INDEX IF EXISTS "idx_core_tenant_status_195cc5" RENAME TO "idx_tree_tenants_status";
        ALTER INDEX IF EXISTS "idx_core_tenant_plan_fda057" RENAME TO "idx_tree_tenants_plan";
        
        -- ============================================
        -- 重命名租户配置表索引
        -- ============================================
        
        ALTER INDEX IF EXISTS "idx_core_tenant_tenant__993185" RENAME TO "idx_tree_tenant_configs_tenant_id";
        ALTER INDEX IF EXISTS "idx_core_tenant_config__3f2216" RENAME TO "idx_tree_tenant_configs_config_key";
        ALTER INDEX IF EXISTS "idx_core_tenant_tenant__622b22" RENAME TO "idx_tree_tenant_configs_tenant_id_config_key";
        
        -- ============================================
        -- 重命名租户活动日志表索引
        -- ============================================
        
        ALTER INDEX IF EXISTS "idx_core_tenant_activity_tenant__993185" RENAME TO "idx_tree_tenant_activity_logs_tenant_id";
        ALTER INDEX IF EXISTS "idx_core_tenant_activity_created__3f2216" RENAME TO "idx_tree_tenant_activity_logs_created_at";
        
        -- ============================================
        -- 重命名多对多关系表
        -- ============================================
        
        ALTER TABLE IF EXISTS "core_users_core_roles" RENAME TO "root_users_root_roles";
        COMMENT ON TABLE "root_users_root_roles" IS '用户角色（多对多关系）';
        
        ALTER TABLE IF EXISTS "core_roles_core_permissions" RENAME TO "root_roles_root_permissions";
        COMMENT ON TABLE "root_roles_root_permissions" IS '角色权限（多对多关系）';
        
        -- ============================================
        -- 更新外键约束（PostgreSQL 会自动更新，但需要更新引用）
        -- ============================================
        
        -- 注意：PostgreSQL 会自动更新外键约束名称
        -- 如果需要手动更新，可以使用以下格式：
        -- ALTER TABLE table_name RENAME CONSTRAINT old_name TO new_name;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- ============================================
        -- 回滚：重命名回原表名
        -- ============================================
        
        -- 回滚系统级表
        ALTER TABLE IF EXISTS "root_users" RENAME TO "core_users";
        ALTER TABLE IF EXISTS "root_roles" RENAME TO "core_roles";
        ALTER TABLE IF EXISTS "root_permissions" RENAME TO "core_permissions";
        
        -- 回滚租户管理表
        ALTER TABLE IF EXISTS "tree_tenants" RENAME TO "core_tenants";
        ALTER TABLE IF EXISTS "tree_tenant_configs" RENAME TO "core_tenant_configs";
        ALTER TABLE IF EXISTS "tree_tenant_activity_logs" RENAME TO "core_tenant_activity_logs";
        
        -- 回滚多对多关系表
        ALTER TABLE IF EXISTS "root_users_root_roles" RENAME TO "core_users_core_roles";
        ALTER TABLE IF EXISTS "root_roles_root_permissions" RENAME TO "core_roles_core_permissions";
        
        -- 注意：索引回滚需要手动执行，因为索引名称可能已改变
    """


MODELS_STATE = (
    "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"
)

