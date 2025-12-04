"""
数据库表重命名迁移 - 从植物系命名重构为常规B端命名

此迁移将表名从植物系命名（soil_, root_, sys_, tree_）重构为常规B端命名（platform_, core_）

重命名规则：
- soil_ → platform_ (平台级基础设施)
- root_ → core_ (系统级核心功能)
- sys_ → core_ (系统级核心功能，统一为 core_)
- tree_ → platform_ (租户管理，归到平台级)

执行时间: 2025-01-04
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：重命名所有表
    """
    return """
        -- 数据库表重命名迁移
        -- 从植物系命名重构为常规B端命名
        
        -- ============================================
        -- 平台级表重命名 (soil_ → platform_)
        -- ============================================
        ALTER TABLE IF EXISTS "soil_platform_superadmin" RENAME TO "platform_superadmin";
        ALTER TABLE IF EXISTS "soil_packages" RENAME TO "platform_packages";
        
        -- ============================================
        -- 租户管理表重命名 (tree_ → platform_)
        -- ============================================
        ALTER TABLE IF EXISTS "tree_tenants" RENAME TO "platform_tenants";
        ALTER TABLE IF EXISTS "tree_tenant_configs" RENAME TO "platform_tenant_configs";
        ALTER TABLE IF EXISTS "tree_tenant_activity_logs" RENAME TO "platform_tenant_activity_logs";
        
        -- ============================================
        -- 系统级表重命名 (root_ → core_)
        -- ============================================
        ALTER TABLE IF EXISTS "root_menus" RENAME TO "core_menus";
        ALTER TABLE IF EXISTS "root_approval_instances" RENAME TO "core_approval_instances";
        ALTER TABLE IF EXISTS "root_login_logs" RENAME TO "core_login_logs";
        ALTER TABLE IF EXISTS "root_operation_logs" RENAME TO "core_operation_logs";
        ALTER TABLE IF EXISTS "root_message_logs" RENAME TO "core_message_logs";
        ALTER TABLE IF EXISTS "root_data_backups" RENAME TO "core_data_backups";
        ALTER TABLE IF EXISTS "root_user_preferences" RENAME TO "core_user_preferences";
        ALTER TABLE IF EXISTS "root_print_devices" RENAME TO "core_print_devices";
        ALTER TABLE IF EXISTS "root_print_templates" RENAME TO "core_print_templates";
        ALTER TABLE IF EXISTS "root_scripts" RENAME TO "core_scripts";
        ALTER TABLE IF EXISTS "root_electronic_records" RENAME TO "core_electronic_records";
        ALTER TABLE IF EXISTS "root_approval_processes" RENAME TO "core_approval_processes";
        ALTER TABLE IF EXISTS "root_scheduled_tasks" RENAME TO "core_scheduled_tasks";
        ALTER TABLE IF EXISTS "root_message_configs" RENAME TO "core_message_configs";
        ALTER TABLE IF EXISTS "root_message_templates" RENAME TO "core_message_templates";
        ALTER TABLE IF EXISTS "root_datasets" RENAME TO "core_datasets";
        ALTER TABLE IF EXISTS "root_data_sources" RENAME TO "core_data_sources";
        ALTER TABLE IF EXISTS "root_apis" RENAME TO "core_apis";
        ALTER TABLE IF EXISTS "root_files" RENAME TO "core_files";
        ALTER TABLE IF EXISTS "root_integration_configs" RENAME TO "core_integration_configs";
        ALTER TABLE IF EXISTS "root_applications" RENAME TO "core_applications";
        
        -- ============================================
        -- 系统级表重命名 (sys_ → core_)
        -- ============================================
        ALTER TABLE IF EXISTS "sys_users" RENAME TO "core_users";
        ALTER TABLE IF EXISTS "sys_saved_searches" RENAME TO "core_saved_searches";
        ALTER TABLE IF EXISTS "sys_data_dictionaries" RENAME TO "core_data_dictionaries";
        ALTER TABLE IF EXISTS "sys_languages" RENAME TO "core_languages";
        ALTER TABLE IF EXISTS "sys_site_settings" RENAME TO "core_site_settings";
        ALTER TABLE IF EXISTS "sys_invitation_codes" RENAME TO "core_invitation_codes";
        ALTER TABLE IF EXISTS "sys_custom_field_values" RENAME TO "core_custom_field_values";
        ALTER TABLE IF EXISTS "sys_custom_fields" RENAME TO "core_custom_fields";
        ALTER TABLE IF EXISTS "sys_code_rules" RENAME TO "core_code_rules";
        ALTER TABLE IF EXISTS "sys_code_sequences" RENAME TO "core_code_sequences";
        ALTER TABLE IF EXISTS "sys_system_parameters" RENAME TO "core_system_parameters";
        ALTER TABLE IF EXISTS "sys_dictionary_items" RENAME TO "core_dictionary_items";
        ALTER TABLE IF EXISTS "sys_departments" RENAME TO "core_departments";
        ALTER TABLE IF EXISTS "sys_roles" RENAME TO "core_roles";
        ALTER TABLE IF EXISTS "sys_positions" RENAME TO "core_positions";
        ALTER TABLE IF EXISTS "sys_permissions" RENAME TO "core_permissions";
        ALTER TABLE IF EXISTS "sys_role_permissions" RENAME TO "core_role_permissions";
        ALTER TABLE IF EXISTS "sys_user_roles" RENAME TO "core_user_roles";
        
        -- ============================================
        -- 索引重命名（需要根据实际索引名调整）
        -- ============================================
        -- 注意：索引重命名需要手动执行，因为索引名可能不同
        -- 可以使用以下 SQL 查询所有需要重命名的索引：
        -- 
        -- SELECT 
        --     indexname,
        --     REPLACE(indexname, 'soil_', 'platform_') as new_name
        -- FROM pg_indexes 
        -- WHERE schemaname = 'public' AND indexname LIKE 'idx_soil_%'
        -- UNION ALL
        -- SELECT 
        --     indexname,
        --     REPLACE(REPLACE(indexname, 'root_', 'core_'), 'sys_', 'core_') as new_name
        -- FROM pg_indexes 
        -- WHERE schemaname = 'public' AND (indexname LIKE 'idx_root_%' OR indexname LIKE 'idx_sys_%')
        -- UNION ALL
        -- SELECT 
        --     indexname,
        --     REPLACE(indexname, 'tree_', 'platform_') as new_name
        -- FROM pg_indexes 
        -- WHERE schemaname = 'public' AND indexname LIKE 'idx_tree_%';
        --
        -- 然后根据查询结果生成 ALTER INDEX 语句
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：反向重命名（回滚）
    """
    return """
        -- 反向重命名（回滚）
        
        -- 系统级表 (core_ → sys_)
        ALTER TABLE IF EXISTS "core_users" RENAME TO "sys_users";
        ALTER TABLE IF EXISTS "core_saved_searches" RENAME TO "sys_saved_searches";
        ALTER TABLE IF EXISTS "core_data_dictionaries" RENAME TO "sys_data_dictionaries";
        ALTER TABLE IF EXISTS "core_languages" RENAME TO "sys_languages";
        ALTER TABLE IF EXISTS "core_site_settings" RENAME TO "sys_site_settings";
        ALTER TABLE IF EXISTS "core_invitation_codes" RENAME TO "sys_invitation_codes";
        ALTER TABLE IF EXISTS "core_custom_field_values" RENAME TO "sys_custom_field_values";
        ALTER TABLE IF EXISTS "core_custom_fields" RENAME TO "sys_custom_fields";
        ALTER TABLE IF EXISTS "core_code_rules" RENAME TO "sys_code_rules";
        ALTER TABLE IF EXISTS "core_code_sequences" RENAME TO "sys_code_sequences";
        ALTER TABLE IF EXISTS "core_system_parameters" RENAME TO "sys_system_parameters";
        ALTER TABLE IF EXISTS "core_dictionary_items" RENAME TO "sys_dictionary_items";
        ALTER TABLE IF EXISTS "core_departments" RENAME TO "sys_departments";
        ALTER TABLE IF EXISTS "core_roles" RENAME TO "sys_roles";
        ALTER TABLE IF EXISTS "core_positions" RENAME TO "sys_positions";
        ALTER TABLE IF EXISTS "core_permissions" RENAME TO "sys_permissions";
        ALTER TABLE IF EXISTS "core_role_permissions" RENAME TO "sys_role_permissions";
        ALTER TABLE IF EXISTS "core_user_roles" RENAME TO "sys_user_roles";
        
        -- 系统级表 (core_ → root_)
        ALTER TABLE IF EXISTS "core_menus" RENAME TO "root_menus";
        ALTER TABLE IF EXISTS "core_approval_instances" RENAME TO "root_approval_instances";
        ALTER TABLE IF EXISTS "core_login_logs" RENAME TO "root_login_logs";
        ALTER TABLE IF EXISTS "core_operation_logs" RENAME TO "root_operation_logs";
        ALTER TABLE IF EXISTS "core_message_logs" RENAME TO "root_message_logs";
        ALTER TABLE IF EXISTS "core_data_backups" RENAME TO "root_data_backups";
        ALTER TABLE IF EXISTS "core_user_preferences" RENAME TO "root_user_preferences";
        ALTER TABLE IF EXISTS "core_print_devices" RENAME TO "root_print_devices";
        ALTER TABLE IF EXISTS "core_print_templates" RENAME TO "root_print_templates";
        ALTER TABLE IF EXISTS "core_scripts" RENAME TO "root_scripts";
        ALTER TABLE IF EXISTS "core_electronic_records" RENAME TO "root_electronic_records";
        ALTER TABLE IF EXISTS "core_approval_processes" RENAME TO "root_approval_processes";
        ALTER TABLE IF EXISTS "core_scheduled_tasks" RENAME TO "root_scheduled_tasks";
        ALTER TABLE IF EXISTS "core_message_configs" RENAME TO "root_message_configs";
        ALTER TABLE IF EXISTS "core_message_templates" RENAME TO "root_message_templates";
        ALTER TABLE IF EXISTS "core_datasets" RENAME TO "root_datasets";
        ALTER TABLE IF EXISTS "core_data_sources" RENAME TO "root_data_sources";
        ALTER TABLE IF EXISTS "core_apis" RENAME TO "root_apis";
        ALTER TABLE IF EXISTS "core_files" RENAME TO "root_files";
        ALTER TABLE IF EXISTS "core_integration_configs" RENAME TO "root_integration_configs";
        ALTER TABLE IF EXISTS "core_applications" RENAME TO "root_applications";
        
        -- 租户管理表 (platform_ → tree_)
        ALTER TABLE IF EXISTS "platform_tenants" RENAME TO "tree_tenants";
        ALTER TABLE IF EXISTS "platform_tenant_configs" RENAME TO "tree_tenant_configs";
        ALTER TABLE IF EXISTS "platform_tenant_activity_logs" RENAME TO "tree_tenant_activity_logs";
        
        -- 平台级表 (platform_ → soil_)
        ALTER TABLE IF EXISTS "platform_superadmin" RENAME TO "soil_platform_superadmin";
        ALTER TABLE IF EXISTS "platform_packages" RENAME TO "soil_packages";
    """

