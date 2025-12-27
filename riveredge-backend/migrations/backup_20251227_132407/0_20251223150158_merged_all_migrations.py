"""
合并所有迁移文件

此文件合并了所有历史迁移文件
生成时间: 2025-12-23 15:01:58
合并文件数: 61
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    执行所有合并的迁移
    """
    return """
-- 合并后的初始迁移文件
-- 生成时间: 2025-12-23 15:01:58
-- 合并了 61 个迁移文件

-- 注意: 此文件合并了所有历史迁移
-- 使用 IF NOT EXISTS 确保表已存在时不会报错

-- 来自: 0_20251201_init_clean_schema.py
-- 创建所有表（按正确的字段顺序）

        -- 1. 平台超级管理员表
        CREATE TABLE IF NOT EXISTS "soil_platform_superadmin" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "username" VARCHAR(50) NOT NULL UNIQUE,
            "email" VARCHAR(255),
            "password_hash" VARCHAR(255) NOT NULL,
            "full_name" VARCHAR(100),
            "is_active" BOOL NOT NULL DEFAULT True,
            "last_login" TIMESTAMPTZ,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        COMMENT ON TABLE "soil_platform_superadmin" IS '平台超级管理员表';
        CREATE INDEX IF NOT EXISTS "idx_soil_platfo_tenant__281c88" ON "soil_platform_superadmin" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_soil_platfo_usernam_84921b" ON "soil_platform_superadmin" ("username");

        -- 2. 套餐表
        CREATE TABLE IF NOT EXISTS "soil_packages" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "name" VARCHAR(100) NOT NULL,
            "plan" VARCHAR(12) NOT NULL,
            "max_users" INT NOT NULL,
            "max_storage_mb" INT NOT NULL,
            "allow_pro_apps" BOOL NOT NULL DEFAULT False,
            "description" TEXT,
            "price" DOUBLE PRECISION,
            "features" JSONB NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
COMMENT ON TABLE "soil_packages" IS '套餐表';
        CREATE INDEX IF NOT EXISTS "idx_soil_packag_tenant__e2698a" ON "soil_packages" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_soil_packag_plan_493a83" ON "soil_packages" ("plan");

        -- 3. 租户表
        CREATE TABLE IF NOT EXISTS "tree_tenants" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "name" VARCHAR(100) NOT NULL,
            "domain" VARCHAR(100) NOT NULL UNIQUE,
            "status" VARCHAR(9) NOT NULL DEFAULT 'inactive',
            "plan" VARCHAR(12) NOT NULL DEFAULT 'basic',
            "settings" JSONB NOT NULL,
            "max_users" INT NOT NULL DEFAULT 10,
            "max_storage" INT NOT NULL DEFAULT 1024,
            "expires_at" TIMESTAMPTZ,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
COMMENT ON TABLE "tree_tenants" IS '租户表';
        CREATE INDEX IF NOT EXISTS "idx_tree_tenant_tenant__481a89" ON "tree_tenants" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_tree_tenant_domain_4aeb51" ON "tree_tenants" ("domain");
        CREATE INDEX IF NOT EXISTS "idx_tree_tenant_status_51be99" ON "tree_tenants" ("status");
        CREATE INDEX IF NOT EXISTS "idx_tree_tenant_plan_b8d0f3" ON "tree_tenants" ("plan");

        -- 4. 租户配置表
        CREATE TABLE IF NOT EXISTS "tree_tenant_configs" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "config_key" VARCHAR(100) NOT NULL,
            "config_value" JSONB NOT NULL,
            "description" TEXT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "uid_tree_tenant_tenant__547f3d" UNIQUE ("tenant_id", "config_key")
        );
COMMENT ON TABLE "tree_tenant_configs" IS '租户配置表';
        CREATE INDEX IF NOT EXISTS "idx_tree_tenant_tenant__77fa49" ON "tree_tenant_configs" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_tree_tenant_config__a223f6" ON "tree_tenant_configs" ("config_key");
        CREATE INDEX IF NOT EXISTS "idx_tree_tenant_tenant__547f3d" ON "tree_tenant_configs" ("tenant_id", "config_key");

        -- 5. 用户表
        CREATE TABLE IF NOT EXISTS "sys_users" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "username" VARCHAR(50) NOT NULL,
            "email" VARCHAR(255),
            "password_hash" VARCHAR(255) NOT NULL,
            "full_name" VARCHAR(100),
            "is_active" BOOL NOT NULL DEFAULT True,
            "is_platform_admin" BOOL NOT NULL DEFAULT False,
            "is_tenant_admin" BOOL NOT NULL DEFAULT False,
            "source" VARCHAR(50),
            "last_login" TIMESTAMPTZ,
            "department_id" INT,
            "position_id" INT,
            "phone" VARCHAR(20),
            "avatar" VARCHAR(255),
            "remark" TEXT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "uid_sys_users_tenant__26aebd" UNIQUE ("tenant_id", "username")
        );
COMMENT ON TABLE "sys_users" IS '用户表';
        CREATE INDEX IF NOT EXISTS "idx_sys_users_tenant__9fa158" ON "sys_users" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_users_usernam_04037b" ON "sys_users" ("username");
        CREATE INDEX IF NOT EXISTS "idx_sys_users_tenant__26aebd" ON "sys_users" ("tenant_id", "username");
        CREATE INDEX IF NOT EXISTS "idx_sys_users_is_plat_e57f1c" ON "sys_users" ("is_platform_admin");
        CREATE INDEX IF NOT EXISTS "idx_sys_users_departm_7e45f0" ON "sys_users" ("department_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_users_positio_b5fd30" ON "sys_users" ("position_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_users_phone_cc3c13" ON "sys_users" ("phone");

        -- 6. 部门表
        CREATE TABLE IF NOT EXISTS "sys_departments" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "name" VARCHAR(100) NOT NULL,
            "code" VARCHAR(50),
            "description" TEXT,
            "manager_id" INT,
            "parent_id" INT,
            "sort_order" INT NOT NULL DEFAULT 0,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "sys_departments" IS '部门表';
        CREATE INDEX IF NOT EXISTS "idx_sys_departm_tenant__b7794b" ON "sys_departments" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_departm_parent__1ec8f4" ON "sys_departments" ("parent_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_departm_manager_1b2230" ON "sys_departments" ("manager_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_departm_sort_or_317fa8" ON "sys_departments" ("sort_order");
        CREATE INDEX IF NOT EXISTS "idx_sys_departm_created_ea16c0" ON "sys_departments" ("created_at");

        -- 7. 职位表
        CREATE TABLE IF NOT EXISTS "sys_positions" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "name" VARCHAR(100) NOT NULL,
            "code" VARCHAR(50),
            "description" TEXT,
            "department_id" INT,
            "sort_order" INT NOT NULL DEFAULT 0,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "sys_positions" IS '职位表';
        CREATE INDEX IF NOT EXISTS "idx_sys_positio_tenant__057e59" ON "sys_positions" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_positio_departm_89df25" ON "sys_positions" ("department_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_positio_code_a7df81" ON "sys_positions" ("code");
        CREATE INDEX IF NOT EXISTS "idx_sys_positio_sort_or_c51506" ON "sys_positions" ("sort_order");
        CREATE INDEX IF NOT EXISTS "idx_sys_positio_created_fcdf4d" ON "sys_positions" ("created_at");

        -- 8. 角色表
        CREATE TABLE IF NOT EXISTS "sys_roles" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "name" VARCHAR(100) NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "description" TEXT,
            "is_system" BOOL NOT NULL DEFAULT False,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_sys_roles_tenant__bbcd54" UNIQUE ("tenant_id", "code")
        );
COMMENT ON TABLE "sys_roles" IS '角色表';
        CREATE INDEX IF NOT EXISTS "idx_sys_roles_tenant__45a7bd" ON "sys_roles" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_roles_code_903f2f" ON "sys_roles" ("code");
        CREATE INDEX IF NOT EXISTS "idx_sys_roles_created_e0843d" ON "sys_roles" ("created_at");

        -- 9. 权限表
        CREATE TABLE IF NOT EXISTS "sys_permissions" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "name" VARCHAR(100) NOT NULL,
            "code" VARCHAR(100) NOT NULL,
            "resource" VARCHAR(50) NOT NULL,
            "action" VARCHAR(50) NOT NULL,
            "description" TEXT,
            "permission_type" VARCHAR(20) NOT NULL DEFAULT 'function',
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_sys_permiss_tenant__a6de52" UNIQUE ("tenant_id", "code")
        );
COMMENT ON TABLE "sys_permissions" IS '权限表';
        CREATE INDEX IF NOT EXISTS "idx_sys_permiss_tenant__99f233" ON "sys_permissions" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_permiss_code_b35ea3" ON "sys_permissions" ("code");
        CREATE INDEX IF NOT EXISTS "idx_sys_permiss_resourc_941e0b" ON "sys_permissions" ("resource");
        CREATE INDEX IF NOT EXISTS "idx_sys_permiss_permiss_8e9b79" ON "sys_permissions" ("permission_type");

        -- 10. 角色-权限关联表
        -- 注意：关联表（中间表）不需要 uuid 字段，只需要主键和外键即可
        CREATE TABLE IF NOT EXISTS "sys_role_permissions" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "role_id" INT NOT NULL,
            "permission_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "uid_sys_role_pe_role_id_97b31f" UNIQUE ("role_id", "permission_id")
        );
COMMENT ON TABLE "sys_role_permissions" IS '角色权限关联表';
        CREATE INDEX IF NOT EXISTS "idx_sys_role_pe_role_id_fbd949" ON "sys_role_permissions" ("role_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_role_pe_permiss_fa70a0" ON "sys_role_permissions" ("permission_id");

        -- 11. 用户-角色关联表
        -- 注意：关联表（中间表）不需要 uuid 字段，只需要主键和外键即可
        CREATE TABLE IF NOT EXISTS "sys_user_roles" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "user_id" INT NOT NULL,
            "role_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "uid_sys_user_ro_user_id_472051" UNIQUE ("user_id", "role_id")
        );
COMMENT ON TABLE "sys_user_roles" IS '用户角色关联表';
        CREATE INDEX IF NOT EXISTS "idx_sys_user_ro_user_id_50e65a" ON "sys_user_roles" ("user_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_user_ro_role_id_d8cc81" ON "sys_user_roles" ("role_id");

        -- 12. 保存搜索条件表
        CREATE TABLE IF NOT EXISTS "sys_saved_searches" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "user_id" INT NOT NULL,
            "page_path" VARCHAR(255) NOT NULL,
            "name" VARCHAR(100) NOT NULL,
            "is_shared" BOOL NOT NULL DEFAULT False,
            "is_pinned" BOOL NOT NULL DEFAULT False,
            "search_params" JSONB NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
COMMENT ON TABLE "sys_saved_searches" IS '保存的搜索表';
        CREATE INDEX IF NOT EXISTS "idx_sys_saved_s_tenant__4d209f" ON "sys_saved_searches" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_saved_s_user_id_cf97e5" ON "sys_saved_searches" ("user_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_saved_s_page_pa_5ab101" ON "sys_saved_searches" ("page_path");
        CREATE INDEX IF NOT EXISTS "idx_sys_saved_s_tenant__fe93a6" ON "sys_saved_searches" ("tenant_id", "user_id", "page_path");
        CREATE INDEX IF NOT EXISTS "idx_sys_saved_s_is_pinn_3cecd6" ON "sys_saved_searches" ("is_pinned");
        CREATE INDEX IF NOT EXISTS "idx_sys_saved_s_is_shar_cb957c" ON "sys_saved_searches" ("is_shared");

        -- 添加外键约束
        ALTER TABLE "sys_users" ADD CONSTRAINT "fk_sys_users_departm_7e45f0" FOREIGN KEY ("department_id") REFERENCES "sys_departments" ("id");
        ALTER TABLE "sys_users" ADD CONSTRAINT "fk_sys_users_positio_b5fd30" FOREIGN KEY ("position_id") REFERENCES "sys_positions" ("id");
        ALTER TABLE "sys_positions" ADD CONSTRAINT "fk_sys_positio_departm_89df25" FOREIGN KEY ("department_id") REFERENCES "sys_departments" ("id");
        ALTER TABLE "sys_departments" ADD CONSTRAINT "fk_sys_departm_manager_1b2230" FOREIGN KEY ("manager_id") REFERENCES "sys_users" ("id");
        ALTER TABLE "sys_departments" ADD CONSTRAINT "fk_sys_departm_parent__1ec8f4" FOREIGN KEY ("parent_id") REFERENCES "sys_departments" ("id");
        ALTER TABLE "sys_role_permissions" ADD CONSTRAINT "fk_sys_role_pe_role_id_fbd949" FOREIGN KEY ("role_id") REFERENCES "sys_roles" ("id") ON DELETE CASCADE;
        ALTER TABLE "sys_role_permissions" ADD CONSTRAINT "fk_sys_role_pe_permiss_fa70a0" FOREIGN KEY ("permission_id") REFERENCES "sys_permissions" ("id") ON DELETE CASCADE;
        ALTER TABLE "sys_user_roles" ADD CONSTRAINT "fk_sys_user_ro_user_id_50e65a" FOREIGN KEY ("user_id") REFERENCES "sys_users" ("id") ON DELETE CASCADE;
        ALTER TABLE "sys_user_roles" ADD CONSTRAINT "fk_sys_user_ro_role_id_d8cc81" FOREIGN KEY ("role_id") REFERENCES "sys_roles" ("id") ON DELETE CASCADE;
        ALTER TABLE "sys_saved_searches" ADD CONSTRAINT "fk_sys_saved_s_user_id_cf97e5" FOREIGN KEY ("user_id") REFERENCES "sys_users" ("id") ON DELETE CASCADE;
        ALTER TABLE "sys_saved_searches" ADD CONSTRAINT "fk_sys_saved_s_tenant__4d209f" FOREIGN KEY ("tenant_id") REFERENCES "tree_tenants" ("id");
        ALTER TABLE "tree_tenant_configs" ADD CONSTRAINT "fk_tree_tenant_tenant__77fa49" FOREIGN KEY ("tenant_id") REFERENCES "tree_tenants" ("id") ON DELETE CASCADE;

-- 来自: 1_20251202134403_create_data_dictionaries.py
-- 创建数据字典表
        CREATE TABLE IF NOT EXISTS "sys_data_dictionaries" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "name" VARCHAR(100) NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "description" TEXT,
            "is_system" BOOL NOT NULL DEFAULT False,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_sys_data_di_tenant__a8b3c4" UNIQUE ("tenant_id", "code")
        );
COMMENT ON TABLE "sys_data_dictionaries" IS '数据字典表';
        
        -- 创建数据字典表索引
        CREATE INDEX IF NOT EXISTS "idx_sys_data_di_tenant__a8b3c4" ON "sys_data_dictionaries" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_data_di_uuid_b8c3d4" ON "sys_data_dictionaries" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_sys_data_di_code_c8d3e4" ON "sys_data_dictionaries" ("code");
        CREATE INDEX IF NOT EXISTS "idx_sys_data_di_created_d8e3f4" ON "sys_data_dictionaries" ("created_at");
        
        -- 创建字典项表
        CREATE TABLE IF NOT EXISTS "sys_dictionary_items" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "dictionary_id" INT NOT NULL,
            "label" VARCHAR(100) NOT NULL,
            "value" VARCHAR(100) NOT NULL,
            "description" TEXT,
            "color" VARCHAR(20),
            "icon" VARCHAR(50),
            "sort_order" INT NOT NULL DEFAULT 0,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_sys_dictio_tenant__b9c4d5" UNIQUE ("tenant_id", "dictionary_id", "value")
        );
        
        -- 创建字典项表索引
        CREATE INDEX IF NOT EXISTS "idx_sys_dictio_tenant__b9c4d5" ON "sys_dictionary_items" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_dictio_diction_c9d4e5" ON "sys_dictionary_items" ("dictionary_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_dictio_sort_or_d9e4f5" ON "sys_dictionary_items" ("sort_order");
        CREATE INDEX IF NOT EXISTS "idx_sys_dictio_created_e9f4g5" ON "sys_dictionary_items" ("created_at");
        COMMENT ON TABLE "sys_dictionary_items" IS '数据字典项表';
        
        -- 添加外键约束
        ALTER TABLE "sys_dictionary_items" ADD CONSTRAINT "fk_sys_dictio_diction_c9d4e5" FOREIGN KEY ("dictionary_id") REFERENCES "sys_data_dictionaries" ("id") ON DELETE CASCADE;

-- 来自: 2_20251202142016_create_system_parameters.py
-- 创建系统参数表
        CREATE TABLE IF NOT EXISTS "sys_system_parameters" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "key" VARCHAR(100) NOT NULL,
            "value" TEXT NOT NULL,
            "type" VARCHAR(20) NOT NULL,
            "description" TEXT,
            "is_system" BOOL NOT NULL DEFAULT False,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_sys_system_tenant__c9d4e5" UNIQUE ("tenant_id", "key")
        );
        COMMENT ON TABLE "sys_system_parameters" IS '系统参数表';
        
        -- 创建系统参数表索引
        CREATE INDEX IF NOT EXISTS "idx_sys_system_tenant__c9d4e5" ON "sys_system_parameters" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_system_key_d9e4f5" ON "sys_system_parameters" ("key");
        CREATE INDEX IF NOT EXISTS "idx_sys_system_created_e9f4g5" ON "sys_system_parameters" ("created_at");

-- 来自: 3_20251202144357_create_code_rules.py
-- 创建编码规则表
        CREATE TABLE IF NOT EXISTS "sys_code_rules" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "name" VARCHAR(100) NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "expression" VARCHAR(200) NOT NULL,
            "description" TEXT,
            "seq_start" INT NOT NULL DEFAULT 1,
            "seq_step" INT NOT NULL DEFAULT 1,
            "seq_reset_rule" VARCHAR(20),
            "is_system" BOOL NOT NULL DEFAULT False,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_sys_code_r_tenant__d9e4f5" UNIQUE ("tenant_id", "code")
        );
COMMENT ON TABLE "sys_code_rules" IS '编码规则表';
        
        -- 创建编码规则表索引
        CREATE INDEX IF NOT EXISTS "idx_sys_code_r_tenant__d9e4f5" ON "sys_code_rules" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_code_r_code_e9f4g5" ON "sys_code_rules" ("code");
        CREATE INDEX IF NOT EXISTS "idx_sys_code_r_created_f9g4h5" ON "sys_code_rules" ("created_at");
        
        
        -- 创建编码序号表
        CREATE TABLE IF NOT EXISTS "sys_code_sequences" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "code_rule_id" INT NOT NULL,
            "current_seq" INT NOT NULL DEFAULT 0,
            "reset_date" DATE,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_sys_code_s_code_ru_g9h4i5" UNIQUE ("code_rule_id", "tenant_id")
        );
COMMENT ON TABLE "sys_code_sequences" IS '编码序号表';
        
        -- 创建编码序号表索引
        CREATE INDEX IF NOT EXISTS "idx_sys_code_s_code_ru_g9h4i5" ON "sys_code_sequences" ("code_rule_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_code_s_tenant__h9i4j5" ON "sys_code_sequences" ("tenant_id");
        
        
        -- 添加外键约束
        ALTER TABLE "sys_code_sequences" ADD CONSTRAINT "fk_sys_code_s_code_ru_g9h4i5" FOREIGN KEY ("code_rule_id") REFERENCES "sys_code_rules" ("id") ON DELETE CASCADE;

-- 来自: 4_20251202150000_create_custom_fields.py
-- 创建自定义字段表
        CREATE TABLE IF NOT EXISTS "sys_custom_fields" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "name" VARCHAR(100) NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "table_name" VARCHAR(50) NOT NULL,
            "field_type" VARCHAR(20) NOT NULL,
            "config" JSONB,
            "label" VARCHAR(100),
            "placeholder" VARCHAR(200),
            "is_required" BOOL NOT NULL DEFAULT False,
            "is_searchable" BOOL NOT NULL DEFAULT True,
            "is_sortable" BOOL NOT NULL DEFAULT True,
            "sort_order" INT NOT NULL DEFAULT 0,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_sys_custom_tenant__i9j4k5" UNIQUE ("tenant_id", "table_name", "code")
        );
COMMENT ON TABLE "sys_custom_fields" IS '自定义字段表';
        
        -- 创建自定义字段表索引
        CREATE INDEX IF NOT EXISTS "idx_sys_custom_tenant__i9j4k5" ON "sys_custom_fields" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_custom_table__j9k4l5" ON "sys_custom_fields" ("table_name");
        CREATE INDEX IF NOT EXISTS "idx_sys_custom_created_k9l4m5" ON "sys_custom_fields" ("created_at");
        
        -- 创建自定义字段值表
        CREATE TABLE IF NOT EXISTS "sys_custom_field_values" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "custom_field_id" INT NOT NULL,
            "record_id" INT NOT NULL,
            "record_table" VARCHAR(50) NOT NULL,
            "value_text" TEXT,
            "value_number" NUMERIC(20,4),
            "value_date" DATE,
            "value_json" JSONB,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "sys_custom_field_values" IS '自定义字段值表';
        
        -- 创建自定义字段值表索引
        CREATE INDEX IF NOT EXISTS "idx_sys_custom_v_custom__l9m4n5" ON "sys_custom_field_values" ("custom_field_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_custom_v_tenant__m9n4o5" ON "sys_custom_field_values" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_custom_v_record_n9o4p5" ON "sys_custom_field_values" ("record_table", "record_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_custom_v_created_o9p4q5" ON "sys_custom_field_values" ("created_at");
        
        -- 添加外键约束
        ALTER TABLE "sys_custom_field_values" ADD CONSTRAINT "fk_sys_custom_v_custom__l9m4n5" FOREIGN KEY ("custom_field_id") REFERENCES "sys_custom_fields" ("id") ON DELETE CASCADE;

-- 来自: 5_20251202152000_create_site_settings.py
-- 创建站点设置表
        CREATE TABLE IF NOT EXISTS "sys_site_settings" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "settings" JSONB NOT NULL DEFAULT '{}',
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_sys_site_s_tenant__p9q4r5" UNIQUE ("tenant_id")
        );
COMMENT ON TABLE "sys_site_settings" IS '站点设置表';
        
        -- 创建站点设置表索引
        CREATE INDEX IF NOT EXISTS "idx_sys_site_s_tenant__p9q4r5" ON "sys_site_settings" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_site_s_created_q9r4s5" ON "sys_site_settings" ("created_at");
        
        -- 创建邀请码表
        CREATE TABLE IF NOT EXISTS "sys_invitation_codes" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "code" VARCHAR(50) NOT NULL UNIQUE,
            "email" VARCHAR(100),
            "role_id" INT,
            "max_uses" INT NOT NULL DEFAULT 1,
            "used_count" INT NOT NULL DEFAULT 0,
            "expires_at" TIMESTAMPTZ,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "sys_invitation_codes" IS '邀请码表';
        
        -- 创建邀请码表索引
        CREATE INDEX IF NOT EXISTS "idx_sys_invita_tenant__r9s4t5" ON "sys_invitation_codes" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_invita_code_s9t4u5" ON "sys_invitation_codes" ("code");
        CREATE INDEX IF NOT EXISTS "idx_sys_invita_created_t9u4v5" ON "sys_invitation_codes" ("created_at");

-- 来自: 5_20251202153820_create_site_settings.py
-- 创建站点设置表
        CREATE TABLE IF NOT EXISTS "sys_site_settings" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "settings" JSONB NOT NULL DEFAULT '{}',
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_sys_site_s_tenant__p9q4r5" UNIQUE ("tenant_id")
        );
COMMENT ON TABLE "sys_site_settings" IS '站点设置表';
        
        -- 创建站点设置表索引
        CREATE INDEX IF NOT EXISTS "idx_sys_site_s_tenant__p9q4r5" ON "sys_site_settings" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_site_s_created_q9r4s5" ON "sys_site_settings" ("created_at");
        
        -- 创建邀请码表
        CREATE TABLE IF NOT EXISTS "sys_invitation_codes" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "code" VARCHAR(50) NOT NULL UNIQUE,
            "email" VARCHAR(100),
            "role_id" INT,
            "max_uses" INT NOT NULL DEFAULT 1,
            "used_count" INT NOT NULL DEFAULT 0,
            "expires_at" TIMESTAMPTZ,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "sys_invitation_codes" IS '邀请码表';
        
        -- 创建邀请码表索引
        CREATE INDEX IF NOT EXISTS "idx_sys_invita_tenant__r9s4t5" ON "sys_invitation_codes" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_invita_code_s9t4u5" ON "sys_invitation_codes" ("code");
        CREATE INDEX IF NOT EXISTS "idx_sys_invita_created_t9u4v5" ON "sys_invitation_codes" ("created_at");

-- 来自: 6_20251202155000_create_languages.py
-- 创建语言表
        CREATE TABLE IF NOT EXISTS "sys_languages" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "code" VARCHAR(10) NOT NULL,
            "name" VARCHAR(50) NOT NULL,
            "native_name" VARCHAR(50),
            "translations" JSONB NOT NULL DEFAULT '{}',
            "is_default" BOOL NOT NULL DEFAULT False,
            "is_active" BOOL NOT NULL DEFAULT True,
            "sort_order" INT NOT NULL DEFAULT 0,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_sys_languag_tenant__u9v4w5" UNIQUE ("tenant_id", "code")
        );
COMMENT ON TABLE "sys_languages" IS '语言表';
        
        -- 创建语言表索引
        CREATE INDEX IF NOT EXISTS "idx_sys_languag_tenant__u9v4w5" ON "sys_languages" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_languag_code_v9w4x5" ON "sys_languages" ("code");
        CREATE INDEX IF NOT EXISTS "idx_sys_languag_created_w9x4y5" ON "sys_languages" ("created_at");

-- 来自: 6_20251202155251_create_languages.py
-- 创建语言表
        CREATE TABLE IF NOT EXISTS "sys_languages" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "code" VARCHAR(10) NOT NULL,
            "name" VARCHAR(50) NOT NULL,
            "native_name" VARCHAR(50),
            "translations" JSONB NOT NULL DEFAULT '{}',
            "is_default" BOOL NOT NULL DEFAULT False,
            "is_active" BOOL NOT NULL DEFAULT True,
            "sort_order" INT NOT NULL DEFAULT 0,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_sys_languag_tenant__u9v4w5" UNIQUE ("tenant_id", "code")
        );
COMMENT ON TABLE "sys_languages" IS '语言表';
        
        -- 创建语言表索引
        CREATE INDEX IF NOT EXISTS "idx_sys_languag_tenant__u9v4w5" ON "sys_languages" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_languag_code_v9w4x5" ON "sys_languages" ("code");
        CREATE INDEX IF NOT EXISTS "idx_sys_languag_created_w9x4y5" ON "sys_languages" ("created_at");

-- 来自: 7_20251202161933_create_applications.py
-- 创建应用表
        CREATE TABLE IF NOT EXISTS "root_applications" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "name" VARCHAR(100) NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "description" TEXT,
            "icon" VARCHAR(200),
            "version" VARCHAR(20),
            "route_path" VARCHAR(200),
            "entry_point" VARCHAR(500),
            "menu_config" JSONB,
            "permission_code" VARCHAR(100),
            "is_system" BOOL NOT NULL DEFAULT False,
            "is_active" BOOL NOT NULL DEFAULT True,
            "is_installed" BOOL NOT NULL DEFAULT False,
            "sort_order" INT NOT NULL DEFAULT 0,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_root_applic_tenant__a1b2c3" UNIQUE ("tenant_id", "code")
        );
COMMENT ON TABLE "root_applications" IS '应用表';
        
        -- 创建应用表索引
        CREATE INDEX IF NOT EXISTS "idx_root_applic_tenant__a1b2c3" ON "root_applications" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_applic_code_a1b2c4" ON "root_applications" ("code");
        CREATE INDEX IF NOT EXISTS "idx_root_applic_uuid_a1b2c5" ON "root_applications" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_applic_created_a1b2c6" ON "root_applications" ("created_at");

-- 来自: 8_20251202170206_create_integration_configs.py
-- 创建集成配置表
        CREATE TABLE IF NOT EXISTS "root_integration_configs" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "name" VARCHAR(100) NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "type" VARCHAR(20) NOT NULL,
            "description" TEXT,
            "config" JSONB NOT NULL DEFAULT '{}',
            "is_active" BOOL NOT NULL DEFAULT True,
            "is_connected" BOOL NOT NULL DEFAULT False,
            "last_connected_at" TIMESTAMPTZ,
            "last_error" TEXT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_root_integra_tenant__b1c2d3" UNIQUE ("tenant_id", "code")
        );
COMMENT ON TABLE "root_integration_configs" IS '集成配置表';
        
        -- 创建集成配置表索引
        CREATE INDEX IF NOT EXISTS "idx_root_integra_tenant__b1c2d3" ON "root_integration_configs" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_integra_code_b1c2d4" ON "root_integration_configs" ("code");
        CREATE INDEX IF NOT EXISTS "idx_root_integra_uuid_b1c2d5" ON "root_integration_configs" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_integra_type_b1c2d6" ON "root_integration_configs" ("type");
        CREATE INDEX IF NOT EXISTS "idx_root_integra_created_b1c2d7" ON "root_integration_configs" ("created_at");

-- 来自: 9_20250102120000_create_files.py
-- 创建文件表
        CREATE TABLE IF NOT EXISTS "root_files" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "name" VARCHAR(255) NOT NULL,
            "original_name" VARCHAR(255) NOT NULL,
            "file_path" VARCHAR(500) NOT NULL,
            "file_size" BIGINT NOT NULL,
            "file_type" VARCHAR(100),
            "file_extension" VARCHAR(20),
            "preview_url" VARCHAR(500),
            "category" VARCHAR(50),
            "tags" JSONB,
            "description" TEXT,
            "is_active" BOOL NOT NULL DEFAULT True,
            "upload_status" VARCHAR(20) NOT NULL DEFAULT 'completed',
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "root_files" IS '文件表';
        
        -- 创建文件表索引
        CREATE INDEX IF NOT EXISTS "idx_root_files_tenant_id" ON "root_files" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_files_uuid" ON "root_files" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_files_category" ON "root_files" ("category");
        CREATE INDEX IF NOT EXISTS "idx_root_files_file_type" ON "root_files" ("file_type");
        CREATE INDEX IF NOT EXISTS "idx_root_files_upload_status" ON "root_files" ("upload_status");
        CREATE INDEX IF NOT EXISTS "idx_root_files_created_at" ON "root_files" ("created_at");

-- 来自: 10_20250102130000_create_apis.py
-- 创建接口表
        CREATE TABLE IF NOT EXISTS "root_apis" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "name" VARCHAR(100) NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "description" TEXT,
            "path" VARCHAR(500) NOT NULL,
            "method" VARCHAR(10) NOT NULL,
            "request_headers" JSONB,
            "request_params" JSONB,
            "request_body" JSONB,
            "response_format" JSONB,
            "response_example" JSONB,
            "is_active" BOOL NOT NULL DEFAULT True,
            "is_system" BOOL NOT NULL DEFAULT False,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "root_apis" IS '接口表';
        
        -- 创建接口表索引
        CREATE INDEX IF NOT EXISTS "idx_root_apis_tenant_id" ON "root_apis" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_apis_uuid" ON "root_apis" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_apis_code" ON "root_apis" ("code");
        CREATE INDEX IF NOT EXISTS "idx_root_apis_method" ON "root_apis" ("method");
        CREATE INDEX IF NOT EXISTS "idx_root_apis_created_at" ON "root_apis" ("created_at");
        
        -- 创建唯一约束（tenant_id + code）
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_root_apis_tenant_code" ON "root_apis" ("tenant_id", "code") WHERE "deleted_at" IS NULL;

-- 来自: 11_20250102140000_create_data_sources.py
-- 创建数据源表
        CREATE TABLE IF NOT EXISTS "root_data_sources" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "name" VARCHAR(100) NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "description" TEXT,
            "type" VARCHAR(20) NOT NULL,
            "config" JSONB NOT NULL,
            "is_active" BOOL NOT NULL DEFAULT True,
            "is_connected" BOOL NOT NULL DEFAULT False,
            "last_connected_at" TIMESTAMPTZ,
            "last_error" TEXT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "root_data_sources" IS '数据源表';
        
        -- 创建数据源表索引
        CREATE INDEX IF NOT EXISTS "idx_root_data_sources_tenant_id" ON "root_data_sources" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_data_sources_uuid" ON "root_data_sources" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_data_sources_code" ON "root_data_sources" ("code");
        CREATE INDEX IF NOT EXISTS "idx_root_data_sources_type" ON "root_data_sources" ("type");
        CREATE INDEX IF NOT EXISTS "idx_root_data_sources_created_at" ON "root_data_sources" ("created_at");
        
        -- 创建唯一约束（tenant_id + code）
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_root_data_sources_tenant_code" ON "root_data_sources" ("tenant_id", "code") WHERE "deleted_at" IS NULL;

-- 来自: 12_20250102150000_create_datasets.py
-- 创建数据集表
        CREATE TABLE IF NOT EXISTS "root_datasets" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "data_source_id" INT NOT NULL,
            "name" VARCHAR(100) NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "description" TEXT,
            "query_type" VARCHAR(20) NOT NULL,
            "query_config" JSONB NOT NULL,
            "is_active" BOOL NOT NULL DEFAULT True,
            "last_executed_at" TIMESTAMPTZ,
            "last_error" TEXT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "root_datasets" IS '数据集表';
        
        -- 创建数据集表索引
        CREATE INDEX IF NOT EXISTS "idx_root_datasets_tenant_id" ON "root_datasets" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_datasets_uuid" ON "root_datasets" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_datasets_code" ON "root_datasets" ("code");
        CREATE INDEX IF NOT EXISTS "idx_root_datasets_data_source_id" ON "root_datasets" ("data_source_id");
        CREATE INDEX IF NOT EXISTS "idx_root_datasets_created_at" ON "root_datasets" ("created_at");
        
        -- 创建唯一约束（tenant_id + code）
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_root_datasets_tenant_code" ON "root_datasets" ("tenant_id", "code") WHERE "deleted_at" IS NULL;
        
        -- 创建外键约束（关联数据源表）
        ALTER TABLE "root_datasets" ADD CONSTRAINT "fk_root_datasets_data_source" 
        FOREIGN KEY ("data_source_id") REFERENCES "root_data_sources" ("id") ON DELETE RESTRICT;

-- 来自: 13_20250102160000_create_message_configs.py
-- 创建消息配置表
        CREATE TABLE IF NOT EXISTS "root_message_configs" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "name" VARCHAR(100) NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "type" VARCHAR(20) NOT NULL,
            "description" TEXT,
            "config" JSONB NOT NULL,
            "is_active" BOOL NOT NULL DEFAULT True,
            "is_default" BOOL NOT NULL DEFAULT False,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "root_message_configs" IS '消息配置表';
        
        -- 创建消息配置表索引
        CREATE INDEX IF NOT EXISTS "idx_root_message_configs_tenant_id" ON "root_message_configs" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_message_configs_uuid" ON "root_message_configs" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_message_configs_code" ON "root_message_configs" ("code");
        CREATE INDEX IF NOT EXISTS "idx_root_message_configs_type" ON "root_message_configs" ("type");
        CREATE INDEX IF NOT EXISTS "idx_root_message_configs_created_at" ON "root_message_configs" ("created_at");
        
        -- 创建唯一约束（tenant_id + code）
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_root_message_configs_tenant_code" ON "root_message_configs" ("tenant_id", "code") WHERE "deleted_at" IS NULL;

-- 来自: 14_20250102161000_create_message_templates.py
-- 创建消息模板表
        CREATE TABLE IF NOT EXISTS "root_message_templates" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "name" VARCHAR(100) NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "type" VARCHAR(20) NOT NULL,
            "description" TEXT,
            "subject" VARCHAR(200),
            "content" TEXT NOT NULL,
            "variables" JSONB,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "root_message_templates" IS '消息模板表';
        
        -- 创建消息模板表索引
        CREATE INDEX IF NOT EXISTS "idx_root_message_templates_tenant_id" ON "root_message_templates" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_message_templates_uuid" ON "root_message_templates" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_message_templates_code" ON "root_message_templates" ("code");
        CREATE INDEX IF NOT EXISTS "idx_root_message_templates_type" ON "root_message_templates" ("type");
        CREATE INDEX IF NOT EXISTS "idx_root_message_templates_created_at" ON "root_message_templates" ("created_at");
        
        -- 创建唯一约束（tenant_id + code）
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_root_message_templates_tenant_code" ON "root_message_templates" ("tenant_id", "code") WHERE "deleted_at" IS NULL;

-- 来自: 15_20250102162000_create_message_logs.py
-- 创建消息发送记录表
        CREATE TABLE IF NOT EXISTS "root_message_logs" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "template_uuid" VARCHAR(36),
            "config_uuid" VARCHAR(36),
            "type" VARCHAR(20) NOT NULL,
            "recipient" VARCHAR(200) NOT NULL,
            "subject" VARCHAR(200),
            "content" TEXT NOT NULL,
            "variables" JSONB,
            "status" VARCHAR(20) NOT NULL,
            "inngest_run_id" VARCHAR(100),
            "error_message" TEXT,
            "sent_at" TIMESTAMPTZ,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "root_message_logs" IS '消息日志表';
        
        -- 创建消息发送记录表索引
        CREATE INDEX IF NOT EXISTS "idx_root_message_logs_tenant_id" ON "root_message_logs" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_message_logs_uuid" ON "root_message_logs" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_message_logs_template_uuid" ON "root_message_logs" ("template_uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_message_logs_config_uuid" ON "root_message_logs" ("config_uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_message_logs_type" ON "root_message_logs" ("type");
        CREATE INDEX IF NOT EXISTS "idx_root_message_logs_status" ON "root_message_logs" ("status");
        CREATE INDEX IF NOT EXISTS "idx_root_message_logs_inngest_run_id" ON "root_message_logs" ("inngest_run_id");
        CREATE INDEX IF NOT EXISTS "idx_root_message_logs_created_at" ON "root_message_logs" ("created_at");

-- 来自: 16_20250102170000_create_scheduled_tasks.py
-- 创建定时任务表
        CREATE TABLE IF NOT EXISTS "root_scheduled_tasks" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "name" VARCHAR(100) NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "description" TEXT,
            "type" VARCHAR(20) NOT NULL,
            "trigger_type" VARCHAR(20) NOT NULL,
            "trigger_config" JSONB NOT NULL,
            "task_config" JSONB NOT NULL,
            "inngest_function_id" VARCHAR(100),
            "is_active" BOOL NOT NULL DEFAULT True,
            "is_running" BOOL NOT NULL DEFAULT False,
            "last_run_at" TIMESTAMPTZ,
            "last_run_status" VARCHAR(20),
            "last_error" TEXT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "root_scheduled_tasks" IS '定时任务表';
        
        -- 创建定时任务表索引
        CREATE INDEX IF NOT EXISTS "idx_root_scheduled_tasks_tenant_id" ON "root_scheduled_tasks" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_scheduled_tasks_uuid" ON "root_scheduled_tasks" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_scheduled_tasks_code" ON "root_scheduled_tasks" ("code");
        CREATE INDEX IF NOT EXISTS "idx_root_scheduled_tasks_type" ON "root_scheduled_tasks" ("type");
        CREATE INDEX IF NOT EXISTS "idx_root_scheduled_tasks_trigger_type" ON "root_scheduled_tasks" ("trigger_type");
        CREATE INDEX IF NOT EXISTS "idx_root_scheduled_tasks_is_active" ON "root_scheduled_tasks" ("is_active");
        CREATE INDEX IF NOT EXISTS "idx_root_scheduled_tasks_created_at" ON "root_scheduled_tasks" ("created_at");
        
        -- 创建唯一约束（tenant_id + code）
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_root_scheduled_tasks_tenant_code" ON "root_scheduled_tasks" ("tenant_id", "code") WHERE "deleted_at" IS NULL;

-- 来自: 17_20250102180000_create_approval_processes.py
-- 创建审批流程表
        CREATE TABLE IF NOT EXISTS "root_approval_processes" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "name" VARCHAR(100) NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "description" TEXT,
            "nodes" JSONB NOT NULL,
            "config" JSONB NOT NULL,
            "inngest_workflow_id" VARCHAR(100),
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "root_approval_processes" IS '审批流程表';
        
        -- 创建审批流程表索引
        CREATE INDEX IF NOT EXISTS "idx_root_approval_processes_tenant_id" ON "root_approval_processes" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_approval_processes_uuid" ON "root_approval_processes" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_approval_processes_code" ON "root_approval_processes" ("code");
        CREATE INDEX IF NOT EXISTS "idx_root_approval_processes_is_active" ON "root_approval_processes" ("is_active");
        CREATE INDEX IF NOT EXISTS "idx_root_approval_processes_created_at" ON "root_approval_processes" ("created_at");
        
        -- 创建唯一约束（tenant_id + code）
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_root_approval_processes_tenant_code" ON "root_approval_processes" ("tenant_id", "code") WHERE "deleted_at" IS NULL;

-- 来自: 18_20250102181000_create_approval_instances.py
-- 创建审批实例表
        CREATE TABLE IF NOT EXISTS "root_approval_instances" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "process_id" INT NOT NULL,
            "title" VARCHAR(200) NOT NULL,
            "content" TEXT,
            "data" JSONB,
            "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
            "current_node" VARCHAR(100),
            "current_approver_id" INT,
            "inngest_run_id" VARCHAR(100),
            "submitter_id" INT NOT NULL,
            "submitted_at" TIMESTAMPTZ NOT NULL,
            "completed_at" TIMESTAMPTZ,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            FOREIGN KEY ("process_id") REFERENCES "root_approval_processes" ("id") ON DELETE RESTRICT
        );
COMMENT ON TABLE "root_approval_instances" IS '审批实例表';
        
        -- 创建审批实例表索引
        CREATE INDEX IF NOT EXISTS "idx_root_approval_instances_tenant_id" ON "root_approval_instances" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_approval_instances_uuid" ON "root_approval_instances" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_approval_instances_process_id" ON "root_approval_instances" ("process_id");
        CREATE INDEX IF NOT EXISTS "idx_root_approval_instances_status" ON "root_approval_instances" ("status");
        CREATE INDEX IF NOT EXISTS "idx_root_approval_instances_current_approver_id" ON "root_approval_instances" ("current_approver_id");
        CREATE INDEX IF NOT EXISTS "idx_root_approval_instances_submitter_id" ON "root_approval_instances" ("submitter_id");
        CREATE INDEX IF NOT EXISTS "idx_root_approval_instances_inngest_run_id" ON "root_approval_instances" ("inngest_run_id");
        CREATE INDEX IF NOT EXISTS "idx_root_approval_instances_created_at" ON "root_approval_instances" ("created_at");

-- 来自: 19_20250102190000_create_electronic_records.py
-- 创建电子记录表
        CREATE TABLE IF NOT EXISTS "root_electronic_records" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "type" VARCHAR(50) NOT NULL,
            "description" TEXT,
            "content" JSONB NOT NULL,
            "file_uuid" VARCHAR(36),
            "inngest_workflow_id" VARCHAR(100),
            "inngest_run_id" VARCHAR(100),
            "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
            "lifecycle_stage" VARCHAR(20),
            "signer_id" INT,
            "signed_at" TIMESTAMPTZ,
            "signature_data" TEXT,
            "archived_at" TIMESTAMPTZ,
            "archive_location" VARCHAR(200),
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "root_electronic_records" IS '电子记录表';
        
        -- 创建电子记录表索引
        CREATE INDEX IF NOT EXISTS "idx_root_electronic_records_tenant_id" ON "root_electronic_records" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_electronic_records_uuid" ON "root_electronic_records" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_electronic_records_code" ON "root_electronic_records" ("code");
        CREATE INDEX IF NOT EXISTS "idx_root_electronic_records_type" ON "root_electronic_records" ("type");
        CREATE INDEX IF NOT EXISTS "idx_root_electronic_records_status" ON "root_electronic_records" ("status");
        CREATE INDEX IF NOT EXISTS "idx_root_electronic_records_lifecycle_stage" ON "root_electronic_records" ("lifecycle_stage");
        CREATE INDEX IF NOT EXISTS "idx_root_electronic_records_created_at" ON "root_electronic_records" ("created_at");
        
        -- 创建唯一约束（tenant_id + code）
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_root_electronic_records_tenant_code" ON "root_electronic_records" ("tenant_id", "code") WHERE "deleted_at" IS NULL;

-- 来自: 20_20250102200000_create_scripts.py
-- 创建脚本表
        CREATE TABLE IF NOT EXISTS "root_scripts" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "type" VARCHAR(50) NOT NULL,
            "description" TEXT,
            "content" TEXT NOT NULL,
            "config" JSONB,
            "inngest_function_id" VARCHAR(100),
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "is_running" BOOLEAN NOT NULL DEFAULT FALSE,
            "last_run_at" TIMESTAMPTZ,
            "last_run_status" VARCHAR(20),
            "last_error" TEXT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "root_scripts" IS '脚本表';
        
        -- 创建脚本表索引
        CREATE INDEX IF NOT EXISTS "idx_root_scripts_tenant_id" ON "root_scripts" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_scripts_uuid" ON "root_scripts" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_scripts_code" ON "root_scripts" ("code");
        CREATE INDEX IF NOT EXISTS "idx_root_scripts_type" ON "root_scripts" ("type");
        CREATE INDEX IF NOT EXISTS "idx_root_scripts_is_active" ON "root_scripts" ("is_active");
        CREATE INDEX IF NOT EXISTS "idx_root_scripts_created_at" ON "root_scripts" ("created_at");
        
        -- 创建唯一约束（tenant_id + code）
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_root_scripts_tenant_code" ON "root_scripts" ("tenant_id", "code") WHERE "deleted_at" IS NULL;

-- 来自: 21_20250102210000_create_print_templates.py
-- 创建打印模板表
        CREATE TABLE IF NOT EXISTS "root_print_templates" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "type" VARCHAR(50) NOT NULL,
            "description" TEXT,
            "content" TEXT NOT NULL,
            "config" JSONB,
            "inngest_function_id" VARCHAR(100),
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "is_default" BOOLEAN NOT NULL DEFAULT FALSE,
            "usage_count" INT NOT NULL DEFAULT 0,
            "last_used_at" TIMESTAMPTZ,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "root_print_templates" IS '打印模板表';
        
        -- 创建打印模板表索引
        CREATE INDEX IF NOT EXISTS "idx_root_print_templates_tenant_id" ON "root_print_templates" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_print_templates_uuid" ON "root_print_templates" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_print_templates_code" ON "root_print_templates" ("code");
        CREATE INDEX IF NOT EXISTS "idx_root_print_templates_type" ON "root_print_templates" ("type");
        CREATE INDEX IF NOT EXISTS "idx_root_print_templates_is_active" ON "root_print_templates" ("is_active");
        CREATE INDEX IF NOT EXISTS "idx_root_print_templates_is_default" ON "root_print_templates" ("is_default");
        CREATE INDEX IF NOT EXISTS "idx_root_print_templates_created_at" ON "root_print_templates" ("created_at");
        
        -- 创建唯一约束（tenant_id + code）
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_root_print_templates_tenant_code" ON "root_print_templates" ("tenant_id", "code") WHERE "deleted_at" IS NULL;

-- 来自: 22_20250102211000_create_print_devices.py
-- 创建打印设备表
        CREATE TABLE IF NOT EXISTS "root_print_devices" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "type" VARCHAR(50) NOT NULL,
            "description" TEXT,
            "config" JSONB NOT NULL,
            "inngest_function_id" VARCHAR(100),
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "is_default" BOOLEAN NOT NULL DEFAULT FALSE,
            "is_online" BOOLEAN NOT NULL DEFAULT FALSE,
            "last_connected_at" TIMESTAMPTZ,
            "usage_count" INT NOT NULL DEFAULT 0,
            "last_used_at" TIMESTAMPTZ,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "root_print_devices" IS '打印设备表';
        
        -- 创建打印设备表索引
        CREATE INDEX IF NOT EXISTS "idx_root_print_devices_tenant_id" ON "root_print_devices" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_print_devices_uuid" ON "root_print_devices" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_print_devices_code" ON "root_print_devices" ("code");
        CREATE INDEX IF NOT EXISTS "idx_root_print_devices_type" ON "root_print_devices" ("type");
        CREATE INDEX IF NOT EXISTS "idx_root_print_devices_is_active" ON "root_print_devices" ("is_active");
        CREATE INDEX IF NOT EXISTS "idx_root_print_devices_is_default" ON "root_print_devices" ("is_default");
        CREATE INDEX IF NOT EXISTS "idx_root_print_devices_is_online" ON "root_print_devices" ("is_online");
        CREATE INDEX IF NOT EXISTS "idx_root_print_devices_created_at" ON "root_print_devices" ("created_at");
        
        -- 创建唯一约束（tenant_id + code）
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_root_print_devices_tenant_code" ON "root_print_devices" ("tenant_id", "code") WHERE "deleted_at" IS NULL;

-- 来自: 23_20250102220000_add_user_profile_fields.py
-- 添加个人资料字段（如果不存在）
        -- 注意：用户表名是 sys_users（根据 User 模型的 Meta.table 定义）
        DO $$ 
        BEGIN
            -- 检查并添加 avatar 字段
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'sys_users' AND column_name = 'avatar'
            ) THEN
                ALTER TABLE sys_users ADD COLUMN avatar VARCHAR(36);
            END IF;
            
            -- 检查并添加 bio 字段
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'sys_users' AND column_name = 'bio'
            ) THEN
                ALTER TABLE sys_users ADD COLUMN bio TEXT;
            END IF;
            
            -- 检查并添加 contact_info 字段
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'sys_users' AND column_name = 'contact_info'
            ) THEN
                ALTER TABLE sys_users ADD COLUMN contact_info JSONB;
            END IF;
        END $$;

-- 来自: 24_20250102230000_create_user_preferences.py
CREATE TABLE IF NOT EXISTS "root_user_preferences" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "user_id" INT NOT NULL,
            "preferences" JSONB NOT NULL DEFAULT '{}',
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
COMMENT ON TABLE "root_user_preferences" IS '用户偏好表';
        
        -- 创建唯一约束（user_id）
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_root_user_preferences_user_id" ON "root_user_preferences" ("user_id");
        
        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_root_user_preferences_tenant_id" ON "root_user_preferences" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_user_preferences_uuid" ON "root_user_preferences" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_user_preferences_user_id" ON "root_user_preferences" ("user_id");
        CREATE INDEX IF NOT EXISTS "idx_root_user_preferences_created_at" ON "root_user_preferences" ("created_at");

-- 来自: 25_20250103000000_create_operation_logs.py
CREATE TABLE IF NOT EXISTS "root_operation_logs" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "user_id" INT NOT NULL,
            "operation_type" VARCHAR(50) NOT NULL,
            "operation_module" VARCHAR(100),
            "operation_object_type" VARCHAR(100),
            "operation_object_id" INT,
            "operation_object_uuid" VARCHAR(36),
            "operation_content" TEXT,
            "ip_address" VARCHAR(50),
            "user_agent" TEXT,
            "request_method" VARCHAR(10),
            "request_path" VARCHAR(500),
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
COMMENT ON TABLE "root_operation_logs" IS '操作日志表';
        CREATE INDEX IF NOT EXISTS "idx_root_operation_logs_tenant_id" ON "root_operation_logs" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_operation_logs_uuid" ON "root_operation_logs" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_operation_logs_user_id" ON "root_operation_logs" ("user_id");
        CREATE INDEX IF NOT EXISTS "idx_root_operation_logs_operation_type" ON "root_operation_logs" ("operation_type");
        CREATE INDEX IF NOT EXISTS "idx_root_operation_logs_operation_module" ON "root_operation_logs" ("operation_module");
        CREATE INDEX IF NOT EXISTS "idx_root_operation_logs_operation_object_type" ON "root_operation_logs" ("operation_object_type");
        CREATE INDEX IF NOT EXISTS "idx_root_operation_logs_created_at" ON "root_operation_logs" ("created_at");

-- 来自: 26_20251203145903_create_login_logs.py
CREATE TABLE IF NOT EXISTS "root_login_logs" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "user_id" INT,
            "username" VARCHAR(100),
            "login_ip" VARCHAR(50) NOT NULL,
            "login_location" VARCHAR(200),
            "login_device" VARCHAR(50),
            "login_browser" VARCHAR(200),
            "login_status" VARCHAR(20) NOT NULL,
            "failure_reason" TEXT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
COMMENT ON TABLE "root_login_logs" IS '登录日志表';
        CREATE INDEX IF NOT EXISTS "idx_root_login_logs_tenant_id" ON "root_login_logs" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_login_logs_user_id" ON "root_login_logs" ("user_id");
        CREATE INDEX IF NOT EXISTS "idx_root_login_logs_uuid" ON "root_login_logs" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_login_logs_username" ON "root_login_logs" ("username");
        CREATE INDEX IF NOT EXISTS "idx_root_login_logs_login_ip" ON "root_login_logs" ("login_ip");
        CREATE INDEX IF NOT EXISTS "idx_root_login_logs_login_status" ON "root_login_logs" ("login_status");
        CREATE INDEX IF NOT EXISTS "idx_root_login_logs_created_at" ON "root_login_logs" ("created_at");

-- 来自: 27_20250103010000_create_data_backups.py
CREATE TABLE IF NOT EXISTS "root_data_backups" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "backup_type" VARCHAR(20) NOT NULL,
            "backup_scope" VARCHAR(20) NOT NULL,
            "backup_tables" JSONB,
            "file_path" VARCHAR(500),
            "file_uuid" VARCHAR(36),
            "file_size" BIGINT,
            "status" VARCHAR(20) NOT NULL,
            "inngest_run_id" VARCHAR(100),
            "started_at" TIMESTAMPTZ,
            "completed_at" TIMESTAMPTZ,
            "error_message" TEXT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "root_data_backups" IS '数据备份表';
        CREATE INDEX IF NOT EXISTS "idx_root_data_backups_tenant_id" ON "root_data_backups" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_data_backups_uuid" ON "root_data_backups" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_data_backups_backup_type" ON "root_data_backups" ("backup_type");
        CREATE INDEX IF NOT EXISTS "idx_root_data_backups_backup_scope" ON "root_data_backups" ("backup_scope");
        CREATE INDEX IF NOT EXISTS "idx_root_data_backups_status" ON "root_data_backups" ("status");
        CREATE INDEX IF NOT EXISTS "idx_root_data_backups_created_at" ON "root_data_backups" ("created_at");

-- 来自: 28_20250103020000_create_menus.py
CREATE TABLE IF NOT EXISTS "root_menus" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "name" VARCHAR(100) NOT NULL,
            "path" VARCHAR(200),
            "icon" VARCHAR(100),
            "component" VARCHAR(500),
            "permission_code" VARCHAR(100),
            "application_uuid" VARCHAR(36),
            "parent_id" INT,
            "sort_order" INT NOT NULL DEFAULT 0,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "is_external" BOOLEAN NOT NULL DEFAULT FALSE,
            "external_url" VARCHAR(500),
            "meta" JSONB,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "fk_root_menus_parent" FOREIGN KEY ("parent_id") REFERENCES "root_menus" ("id") ON DELETE SET NULL
        );
COMMENT ON TABLE "root_menus" IS '菜单表';
        CREATE INDEX IF NOT EXISTS "idx_root_menus_tenant_id" ON "root_menus" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_menus_parent_id" ON "root_menus" ("parent_id");
        CREATE INDEX IF NOT EXISTS "idx_root_menus_application_uuid" ON "root_menus" ("application_uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_menus_permission_code" ON "root_menus" ("permission_code");
        CREATE INDEX IF NOT EXISTS "idx_root_menus_sort_order" ON "root_menus" ("sort_order");
        CREATE INDEX IF NOT EXISTS "idx_root_menus_is_active" ON "root_menus" ("is_active");
        CREATE INDEX IF NOT EXISTS "idx_root_menus_created_at" ON "root_menus" ("created_at");

-- 来自: 29_20250104_rename_tables_to_new_naming.py
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

-- 来自: 30_20250104_rename_indexes_and_constraints.py
-- 数据库索引和约束重命名迁移
        -- 从植物系命名重构为常规B端命名
        
        -- ============================================
        -- 重命名索引
        -- ============================================
        -- 注意：索引名需要根据实际数据库中的索引名进行调整
        -- 以下是一些常见的索引重命名模式
        
        -- 平台级表索引 (soil_ → platform_)
        DO $$
        DECLARE
            idx_record RECORD;
            new_name TEXT;
        BEGIN
            FOR idx_record IN 
                SELECT indexname, tablename
                FROM pg_indexes 
                WHERE schemaname = 'public' 
                  AND indexname LIKE 'idx_soil_%'
            LOOP
                new_name := REPLACE(idx_record.indexname, 'idx_soil_', 'idx_platform_');
                -- 检查新名称是否已存在
                IF NOT EXISTS (
                    SELECT 1 FROM pg_indexes 
                    WHERE schemaname = 'public' AND indexname = new_name
                ) THEN
                    EXECUTE format('ALTER INDEX IF EXISTS %I RENAME TO %I', 
                        idx_record.indexname,
                        new_name
                    );
                END IF;
            END LOOP;
        END $$;
        
        -- 租户管理表索引 (tree_ → platform_)
        DO $$
        DECLARE
            idx_record RECORD;
            new_name TEXT;
        BEGIN
            FOR idx_record IN 
                SELECT indexname, tablename
                FROM pg_indexes 
                WHERE schemaname = 'public' 
                  AND indexname LIKE 'idx_tree_%'
            LOOP
                new_name := REPLACE(idx_record.indexname, 'idx_tree_', 'idx_platform_');
                -- 检查新名称是否已存在
                IF NOT EXISTS (
                    SELECT 1 FROM pg_indexes 
                    WHERE schemaname = 'public' AND indexname = new_name
                ) THEN
                    EXECUTE format('ALTER INDEX IF EXISTS %I RENAME TO %I', 
                        idx_record.indexname,
                        new_name
                    );
                END IF;
            END LOOP;
        END $$;
        
        -- 系统级表索引 (root_ → core_)
        DO $$
        DECLARE
            idx_record RECORD;
            new_name TEXT;
        BEGIN
            FOR idx_record IN 
                SELECT indexname, tablename
                FROM pg_indexes 
                WHERE schemaname = 'public' 
                  AND indexname LIKE 'idx_root_%'
            LOOP
                new_name := REPLACE(idx_record.indexname, 'idx_root_', 'idx_core_');
                -- 检查新名称是否已存在
                IF NOT EXISTS (
                    SELECT 1 FROM pg_indexes 
                    WHERE schemaname = 'public' AND indexname = new_name
                ) THEN
                    EXECUTE format('ALTER INDEX IF EXISTS %I RENAME TO %I', 
                        idx_record.indexname,
                        new_name
                    );
                END IF;
            END LOOP;
        END $$;
        
        -- 系统级表索引 (sys_ → core_)
        DO $$
        DECLARE
            idx_record RECORD;
            new_name TEXT;
        BEGIN
            FOR idx_record IN 
                SELECT indexname, tablename
                FROM pg_indexes 
                WHERE schemaname = 'public' 
                  AND indexname LIKE 'idx_sys_%'
            LOOP
                new_name := REPLACE(idx_record.indexname, 'idx_sys_', 'idx_core_');
                -- 检查新名称是否已存在
                IF NOT EXISTS (
                    SELECT 1 FROM pg_indexes 
                    WHERE schemaname = 'public' AND indexname = new_name
                ) THEN
                    EXECUTE format('ALTER INDEX IF EXISTS %I RENAME TO %I', 
                        idx_record.indexname,
                        new_name
                    );
                END IF;
            END LOOP;
        END $$;
        
        -- 唯一索引 (uk_ 前缀)
        DO $$
        DECLARE
            idx_record RECORD;
            new_name TEXT;
        BEGIN
            FOR idx_record IN 
                SELECT indexname, tablename
                FROM pg_indexes 
                WHERE schemaname = 'public' 
                  AND (
                    indexname LIKE 'uk_soil_%' OR 
                    indexname LIKE 'uk_root_%' OR 
                    indexname LIKE 'uk_sys_%' OR 
                    indexname LIKE 'uk_tree_%'
                  )
            LOOP
                new_name := CASE 
                    WHEN idx_record.indexname LIKE 'uk_soil_%' THEN REPLACE(idx_record.indexname, 'uk_soil_', 'uk_platform_')
                    WHEN idx_record.indexname LIKE 'uk_root_%' THEN REPLACE(idx_record.indexname, 'uk_root_', 'uk_core_')
                    WHEN idx_record.indexname LIKE 'uk_sys_%' THEN REPLACE(idx_record.indexname, 'uk_sys_', 'uk_core_')
                    WHEN idx_record.indexname LIKE 'uk_tree_%' THEN REPLACE(idx_record.indexname, 'uk_tree_', 'uk_platform_')
                END;
                -- 检查新名称是否已存在
                IF NOT EXISTS (
                    SELECT 1 FROM pg_indexes 
                    WHERE schemaname = 'public' AND indexname = new_name
                ) THEN
                    EXECUTE format('ALTER INDEX IF EXISTS %I RENAME TO %I', 
                        idx_record.indexname,
                        new_name
                    );
                END IF;
            END LOOP;
        END $$;
        
        -- ============================================
        -- 重命名外键约束
        -- ============================================
        DO $$
        DECLARE
            con_record RECORD;
            new_name TEXT;
        BEGIN
            FOR con_record IN 
                SELECT 
                    conname,
                    conrelid::regclass::text as table_name
                FROM pg_constraint
                WHERE contype = 'f'
                  AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                  AND (
                    conname LIKE '%_soil_%' OR 
                    conname LIKE '%_root_%' OR 
                    conname LIKE '%_sys_%' OR 
                    conname LIKE '%_tree_%'
                  )
            LOOP
                new_name := CASE 
                    WHEN con_record.conname LIKE '%_soil_%' THEN REPLACE(REPLACE(REPLACE(con_record.conname, '_soil_', '_platform_'), 'fk_soil_', 'fk_platform_'), 'uk_soil_', 'uk_platform_')
                    WHEN con_record.conname LIKE '%_root_%' THEN REPLACE(REPLACE(REPLACE(con_record.conname, '_root_', '_core_'), 'fk_root_', 'fk_core_'), 'uk_root_', 'uk_core_')
                    WHEN con_record.conname LIKE '%_sys_%' THEN REPLACE(REPLACE(REPLACE(con_record.conname, '_sys_', '_core_'), 'fk_sys_', 'fk_core_'), 'uk_sys_', 'uk_core_')
                    WHEN con_record.conname LIKE '%_tree_%' THEN REPLACE(REPLACE(REPLACE(con_record.conname, '_tree_', '_platform_'), 'fk_tree_', 'fk_platform_'), 'uk_tree_', 'uk_platform_')
                END;
                -- 检查新名称是否已存在
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                      AND conname = new_name
                ) THEN
                    EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I', 
                        con_record.table_name,
                        con_record.conname,
                        new_name
                    );
                END IF;
            END LOOP;
        END $$;
        
        -- ============================================
        -- 重命名唯一约束
        -- ============================================
        DO $$
        DECLARE
            con_record RECORD;
            new_name TEXT;
        BEGIN
            FOR con_record IN 
                SELECT 
                    conname,
                    conrelid::regclass::text as table_name
                FROM pg_constraint
                WHERE contype = 'u'
                  AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                  AND (
                    conname LIKE '%_soil_%' OR 
                    conname LIKE '%_root_%' OR 
                    conname LIKE '%_sys_%' OR 
                    conname LIKE '%_tree_%'
                  )
            LOOP
                new_name := CASE 
                    WHEN con_record.conname LIKE '%_soil_%' THEN REPLACE(con_record.conname, '_soil_', '_platform_')
                    WHEN con_record.conname LIKE '%_root_%' THEN REPLACE(con_record.conname, '_root_', '_core_')
                    WHEN con_record.conname LIKE '%_sys_%' THEN REPLACE(con_record.conname, '_sys_', '_core_')
                    WHEN con_record.conname LIKE '%_tree_%' THEN REPLACE(con_record.conname, '_tree_', '_platform_')
                END;
                -- 检查新名称是否已存在
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                      AND conname = new_name
                ) THEN
                    EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I', 
                        con_record.table_name,
                        con_record.conname,
                        new_name
                    );
                END IF;
            END LOOP;
        END $$;
        
        -- ============================================
        -- 重命名检查约束
        -- ============================================
        DO $$
        DECLARE
            con_record RECORD;
            new_name TEXT;
        BEGIN
            FOR con_record IN 
                SELECT 
                    conname,
                    conrelid::regclass::text as table_name
                FROM pg_constraint
                WHERE contype = 'c'
                  AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                  AND (
                    conname LIKE '%_soil_%' OR 
                    conname LIKE '%_root_%' OR 
                    conname LIKE '%_sys_%' OR 
                    conname LIKE '%_tree_%'
                  )
            LOOP
                new_name := CASE 
                    WHEN con_record.conname LIKE '%_soil_%' THEN REPLACE(con_record.conname, '_soil_', '_platform_')
                    WHEN con_record.conname LIKE '%_root_%' THEN REPLACE(con_record.conname, '_root_', '_core_')
                    WHEN con_record.conname LIKE '%_sys_%' THEN REPLACE(con_record.conname, '_sys_', '_core_')
                    WHEN con_record.conname LIKE '%_tree_%' THEN REPLACE(con_record.conname, '_tree_', '_platform_')
                END;
                -- 检查新名称是否已存在
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                      AND conname = new_name
                ) THEN
                    EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I', 
                        con_record.table_name,
                        con_record.conname,
                        new_name
                    );
                END IF;
            END LOOP;
        END $$;

-- 来自: 31_20251208134520_remove_uuid_from_association_tables.py
-- 移除关联表的 uuid 字段
        -- 关联表（中间表）不需要业务ID（UUID），只需要主键和外键即可
        
        DO $$ 
        BEGIN
            -- 删除 core_user_roles 表的 uuid 字段
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'core_user_roles' AND column_name = 'uuid'
            ) THEN
                -- 先删除唯一约束（如果存在）
                ALTER TABLE core_user_roles DROP CONSTRAINT IF EXISTS core_user_roles_uuid_key;
                -- 删除 uuid 字段
                ALTER TABLE core_user_roles DROP COLUMN uuid;
            END IF;
            
            -- 删除 core_role_permissions 表的 uuid 字段
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'core_role_permissions' AND column_name = 'uuid'
            ) THEN
                -- 先删除唯一约束（如果存在）
                ALTER TABLE core_role_permissions DROP CONSTRAINT IF EXISTS core_role_permissions_uuid_key;
                -- 删除 uuid 字段
                ALTER TABLE core_role_permissions DROP COLUMN uuid;
            END IF;
            
            -- 兼容旧表名（如果存在）
            -- 删除 sys_user_roles 表的 uuid 字段（如果表还未重命名）
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'sys_user_roles' AND column_name = 'uuid'
            ) THEN
                ALTER TABLE sys_user_roles DROP CONSTRAINT IF EXISTS sys_user_roles_uuid_key;
                ALTER TABLE sys_user_roles DROP COLUMN uuid;
            END IF;
            
            -- 删除 sys_role_permissions 表的 uuid 字段（如果表还未重命名）
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'sys_role_permissions' AND column_name = 'uuid'
            ) THEN
                ALTER TABLE sys_role_permissions DROP CONSTRAINT IF EXISTS sys_role_permissions_uuid_key;
                ALTER TABLE sys_role_permissions DROP COLUMN uuid;
            END IF;
        END $$;

-- 来自: 32_20251211000000_add_phone_to_platform_superadmin.py
-- 为 infra_superadmin 表添加 phone 字段（如果不存在）
        -- 兼容旧表名 platform_superadmin
        DO $$ 
        BEGIN
            -- 检查并添加 phone 字段（优先检查新表名）
            IF EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = 'infra_superadmin'
            ) THEN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'infra_superadmin' AND column_name = 'phone'
                ) THEN
                    ALTER TABLE infra_superadmin ADD COLUMN phone VARCHAR(20);
                END IF;
            ELSIF EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = 'platform_superadmin'
            ) THEN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'platform_superadmin' AND column_name = 'phone'
                ) THEN
                    ALTER TABLE platform_superadmin ADD COLUMN phone VARCHAR(20);
                END IF;
            END IF;
        END $$;

-- 来自: 33_20250111_add_master_data_models.py
-- 创建物料表
        CREATE TABLE IF NOT EXISTS "apps_master_data_materials" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "specification" VARCHAR(500),
            "unit" VARCHAR(20) NOT NULL,
            "category" VARCHAR(50),
            "description" TEXT,
            "brand" VARCHAR(100),
            "model" VARCHAR(100),
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "apps_master_data_materials" IS '物料表';
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_materials_tenant_code" ON "apps_master_data_materials" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_materials_tenant_id" ON "apps_master_data_materials" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_materials_code" ON "apps_master_data_materials" ("code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_materials_uuid" ON "apps_master_data_materials" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_materials_category" ON "apps_master_data_materials" ("category");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_materials_created_at" ON "apps_master_data_materials" ("created_at");

        -- 创建客户表
        CREATE TABLE IF NOT EXISTS "apps_master_data_customers" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "short_name" VARCHAR(100),
            "contact_person" VARCHAR(100),
            "phone" VARCHAR(20),
            "email" VARCHAR(100),
            "address" TEXT,
            "category" VARCHAR(50),
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "apps_master_data_customers" IS '客户表';
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_customers_tenant_code" ON "apps_master_data_customers" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_customers_tenant_id" ON "apps_master_data_customers" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_customers_code" ON "apps_master_data_customers" ("code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_customers_uuid" ON "apps_master_data_customers" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_customers_category" ON "apps_master_data_customers" ("category");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_customers_created_at" ON "apps_master_data_customers" ("created_at");

        -- 创建供应商表
        CREATE TABLE IF NOT EXISTS "apps_master_data_suppliers" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "short_name" VARCHAR(100),
            "contact_person" VARCHAR(100),
            "phone" VARCHAR(20),
            "email" VARCHAR(100),
            "address" TEXT,
            "category" VARCHAR(50),
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "apps_master_data_suppliers" IS '供应商表';
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_suppliers_tenant_code" ON "apps_master_data_suppliers" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_suppliers_tenant_id" ON "apps_master_data_suppliers" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_suppliers_code" ON "apps_master_data_suppliers" ("code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_suppliers_uuid" ON "apps_master_data_suppliers" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_suppliers_category" ON "apps_master_data_suppliers" ("category");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_suppliers_created_at" ON "apps_master_data_suppliers" ("created_at");

        -- 创建产品表
        CREATE TABLE IF NOT EXISTS "apps_master_data_products" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "specification" VARCHAR(500),
            "unit" VARCHAR(20) NOT NULL,
            "bom_data" JSONB,
            "version" VARCHAR(20),
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "apps_master_data_products" IS '产品表';
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_products_tenant_code" ON "apps_master_data_products" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_products_tenant_id" ON "apps_master_data_products" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_products_code" ON "apps_master_data_products" ("code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_products_uuid" ON "apps_master_data_products" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_products_version" ON "apps_master_data_products" ("version");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_products_created_at" ON "apps_master_data_products" ("created_at");

-- 来自: 34_20250111_add_factory_models.py
-- 创建车间表
        CREATE TABLE IF NOT EXISTS "apps_master_data_workshops" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "description" TEXT,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "apps_master_data_workshops" IS '车间表';
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_workshops_tenant_code" ON "apps_master_data_workshops" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_workshops_tenant_id" ON "apps_master_data_workshops" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_workshops_code" ON "apps_master_data_workshops" ("code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_workshops_uuid" ON "apps_master_data_workshops" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_workshops_created_at" ON "apps_master_data_workshops" ("created_at");

        -- 创建产线表
        CREATE TABLE IF NOT EXISTS "apps_master_data_production_lines" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "workshop_id" INT NOT NULL,
            "description" TEXT,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "apps_master_data_production_lines" IS '生产线表';
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_production_lines_tenant_code" ON "apps_master_data_production_lines" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_production_lines_tenant_id" ON "apps_master_data_production_lines" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_production_lines_code" ON "apps_master_data_production_lines" ("code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_production_lines_uuid" ON "apps_master_data_production_lines" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_production_lines_workshop_id" ON "apps_master_data_production_lines" ("workshop_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_production_lines_created_at" ON "apps_master_data_production_lines" ("created_at");
        -- 添加外键约束
        ALTER TABLE "apps_master_data_production_lines" ADD CONSTRAINT "fk_apps_master_data_production_lines_workshop_id" FOREIGN KEY ("workshop_id") REFERENCES "apps_master_data_workshops" ("id") ON DELETE RESTRICT;

        -- 创建工位表
        CREATE TABLE IF NOT EXISTS "apps_master_data_workstations" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "production_line_id" INT NOT NULL,
            "description" TEXT,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "apps_master_data_workstations" IS '工作站表';
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_workstations_tenant_code" ON "apps_master_data_workstations" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_workstations_tenant_id" ON "apps_master_data_workstations" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_workstations_code" ON "apps_master_data_workstations" ("code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_workstations_uuid" ON "apps_master_data_workstations" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_workstations_production_line_id" ON "apps_master_data_workstations" ("production_line_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_workstations_created_at" ON "apps_master_data_workstations" ("created_at");
        -- 添加外键约束
        ALTER TABLE "apps_master_data_workstations" ADD CONSTRAINT "fk_apps_master_data_workstations_production_line_id" FOREIGN KEY ("production_line_id") REFERENCES "apps_master_data_production_lines" ("id") ON DELETE RESTRICT;

-- 来自: 35_20250111_add_warehouse_models.py
-- 创建仓库表
        CREATE TABLE IF NOT EXISTS "apps_master_data_warehouses" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "description" TEXT,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "apps_master_data_warehouses" IS '仓库表';
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_warehouses_tenant_code" ON "apps_master_data_warehouses" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_warehouses_tenant_id" ON "apps_master_data_warehouses" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_warehouses_code" ON "apps_master_data_warehouses" ("code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_warehouses_uuid" ON "apps_master_data_warehouses" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_warehouses_created_at" ON "apps_master_data_warehouses" ("created_at");

        -- 创建库区表
        CREATE TABLE IF NOT EXISTS "apps_master_data_storage_areas" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "warehouse_id" INT NOT NULL,
            "description" TEXT,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "apps_master_data_storage_areas" IS '存储区域表';
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_storage_areas_tenant_code" ON "apps_master_data_storage_areas" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_storage_areas_tenant_id" ON "apps_master_data_storage_areas" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_storage_areas_code" ON "apps_master_data_storage_areas" ("code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_storage_areas_uuid" ON "apps_master_data_storage_areas" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_storage_areas_warehouse_id" ON "apps_master_data_storage_areas" ("warehouse_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_storage_areas_created_at" ON "apps_master_data_storage_areas" ("created_at");
        -- 添加外键约束
        ALTER TABLE "apps_master_data_storage_areas" ADD CONSTRAINT "fk_apps_master_data_storage_areas_warehouse_id" FOREIGN KEY ("warehouse_id") REFERENCES "apps_master_data_warehouses" ("id") ON DELETE RESTRICT;

        -- 创建库位表
        CREATE TABLE IF NOT EXISTS "apps_master_data_storage_locations" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "storage_area_id" INT NOT NULL,
            "description" TEXT,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "apps_master_data_storage_locations" IS '存储位置表';
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_storage_locations_tenant_code" ON "apps_master_data_storage_locations" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_storage_locations_tenant_id" ON "apps_master_data_storage_locations" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_storage_locations_code" ON "apps_master_data_storage_locations" ("code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_storage_locations_uuid" ON "apps_master_data_storage_locations" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_storage_locations_storage_area_id" ON "apps_master_data_storage_locations" ("storage_area_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_storage_locations_created_at" ON "apps_master_data_storage_locations" ("created_at");
        -- 添加外键约束
        ALTER TABLE "apps_master_data_storage_locations" ADD CONSTRAINT "fk_apps_master_data_storage_locations_storage_area_id" FOREIGN KEY ("storage_area_id") REFERENCES "apps_master_data_storage_areas" ("id") ON DELETE RESTRICT;

-- 来自: 36_20250111_add_material_models.py
-- 创建物料分组表
        CREATE TABLE IF NOT EXISTS "apps_master_data_material_groups" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "parent_id" INT,
            "description" TEXT,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "apps_master_data_material_groups" IS '物料组表';
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_material_groups_tenant_code" ON "apps_master_data_material_groups" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_material_groups_tenant_id" ON "apps_master_data_material_groups" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_material_groups_code" ON "apps_master_data_material_groups" ("code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_material_groups_uuid" ON "apps_master_data_material_groups" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_material_groups_parent_id" ON "apps_master_data_material_groups" ("parent_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_material_groups_created_at" ON "apps_master_data_material_groups" ("created_at");
        -- 添加外键约束
        ALTER TABLE "apps_master_data_material_groups" ADD CONSTRAINT "fk_apps_master_data_material_groups_parent_id" FOREIGN KEY ("parent_id") REFERENCES "apps_master_data_material_groups" ("id") ON DELETE RESTRICT;

        -- 删除旧的物料表（如果存在）
        DROP TABLE IF EXISTS "apps_master_data_materials" CASCADE;

        -- 创建物料表
        CREATE TABLE IF NOT EXISTS "apps_master_data_materials" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "group_id" INT,
            "specification" VARCHAR(500),
            "base_unit" VARCHAR(20) NOT NULL,
            "units" JSONB,
            "batch_managed" BOOL NOT NULL DEFAULT False,
            "variant_managed" BOOL NOT NULL DEFAULT False,
            "variant_attributes" JSONB,
            "description" TEXT,
            "brand" VARCHAR(100),
            "model" VARCHAR(100),
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "apps_master_data_materials" IS '物料表';
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_materials_tenant_code" ON "apps_master_data_materials" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_materials_tenant_id" ON "apps_master_data_materials" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_materials_code" ON "apps_master_data_materials" ("code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_materials_uuid" ON "apps_master_data_materials" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_materials_group_id" ON "apps_master_data_materials" ("group_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_materials_created_at" ON "apps_master_data_materials" ("created_at");
        -- 添加外键约束
        ALTER TABLE "apps_master_data_materials" ADD CONSTRAINT "fk_apps_master_data_materials_group_id" FOREIGN KEY ("group_id") REFERENCES "apps_master_data_material_groups" ("id") ON DELETE RESTRICT;

        -- 创建BOM表
        CREATE TABLE IF NOT EXISTS "apps_master_data_bom" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "material_id" INT NOT NULL,
            "component_id" INT NOT NULL,
            "quantity" DECIMAL(18, 4) NOT NULL,
            "unit" VARCHAR(20) NOT NULL,
            "is_alternative" BOOL NOT NULL DEFAULT False,
            "alternative_group_id" INT,
            "priority" INT NOT NULL DEFAULT 0,
            "description" TEXT,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "apps_master_data_bom" IS 'BOM（物料清单）表';
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_bom_tenant_id" ON "apps_master_data_bom" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_bom_material_id" ON "apps_master_data_bom" ("material_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_bom_component_id" ON "apps_master_data_bom" ("component_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_bom_uuid" ON "apps_master_data_bom" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_bom_alternative_group_id" ON "apps_master_data_bom" ("alternative_group_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_bom_created_at" ON "apps_master_data_bom" ("created_at");
        -- 添加外键约束
        ALTER TABLE "apps_master_data_bom" ADD CONSTRAINT "fk_apps_master_data_bom_material_id" FOREIGN KEY ("material_id") REFERENCES "apps_master_data_materials" ("id") ON DELETE RESTRICT;
        ALTER TABLE "apps_master_data_bom" ADD CONSTRAINT "fk_apps_master_data_bom_component_id" FOREIGN KEY ("component_id") REFERENCES "apps_master_data_materials" ("id") ON DELETE RESTRICT;

-- 来自: 37_20250111_add_process_models.py
-- 创建不良品表
        CREATE TABLE IF NOT EXISTS "apps_master_data_defect_types" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "category" VARCHAR(50),
            "description" TEXT,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "apps_master_data_defect_types" IS '缺陷类型表';
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_defect_types_tenant_code" ON "apps_master_data_defect_types" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_defect_types_tenant_id" ON "apps_master_data_defect_types" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_defect_types_code" ON "apps_master_data_defect_types" ("code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_defect_types_uuid" ON "apps_master_data_defect_types" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_defect_types_category" ON "apps_master_data_defect_types" ("category");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_defect_types_created_at" ON "apps_master_data_defect_types" ("created_at");

        -- 创建工序表
        CREATE TABLE IF NOT EXISTS "apps_master_data_operations" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "description" TEXT,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "apps_master_data_operations" IS '工序表';
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_operations_tenant_code" ON "apps_master_data_operations" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_operations_tenant_id" ON "apps_master_data_operations" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_operations_code" ON "apps_master_data_operations" ("code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_operations_uuid" ON "apps_master_data_operations" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_operations_created_at" ON "apps_master_data_operations" ("created_at");

        -- 创建工艺路线表
        CREATE TABLE IF NOT EXISTS "apps_master_data_process_routes" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "description" TEXT,
            "operation_sequence" JSONB,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "apps_master_data_process_routes" IS '工艺路线表';
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_process_routes_tenant_code" ON "apps_master_data_process_routes" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_process_routes_tenant_id" ON "apps_master_data_process_routes" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_process_routes_code" ON "apps_master_data_process_routes" ("code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_process_routes_uuid" ON "apps_master_data_process_routes" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_process_routes_created_at" ON "apps_master_data_process_routes" ("created_at");

        -- 创建作业程序（SOP）表
        CREATE TABLE IF NOT EXISTS "apps_master_data_sop" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "operation_id" INT,
            "version" VARCHAR(20),
            "content" TEXT,
            "attachments" JSONB,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "apps_master_data_sop" IS 'SOP（标准作业程序）表';
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_sop_tenant_code" ON "apps_master_data_sop" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_sop_tenant_id" ON "apps_master_data_sop" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_sop_code" ON "apps_master_data_sop" ("code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_sop_uuid" ON "apps_master_data_sop" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_sop_operation_id" ON "apps_master_data_sop" ("operation_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_sop_created_at" ON "apps_master_data_sop" ("created_at");
        -- 添加外键约束
        ALTER TABLE "apps_master_data_sop" ADD CONSTRAINT "fk_apps_master_data_sop_operation_id" FOREIGN KEY ("operation_id") REFERENCES "apps_master_data_operations" ("id") ON DELETE RESTRICT;

-- 来自: 38_20250111_add_performance_models.py
-- 创建假期表
        CREATE TABLE IF NOT EXISTS "apps_master_data_holidays" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "holiday_date" DATE NOT NULL,
            "holiday_type" VARCHAR(50),
            "description" TEXT,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "apps_master_data_holidays" IS '节假日表';
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_holidays_tenant_id" ON "apps_master_data_holidays" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_holidays_uuid" ON "apps_master_data_holidays" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_holidays_holiday_date" ON "apps_master_data_holidays" ("holiday_date");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_holidays_holiday_type" ON "apps_master_data_holidays" ("holiday_type");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_holidays_created_at" ON "apps_master_data_holidays" ("created_at");

        -- 创建技能表
        CREATE TABLE IF NOT EXISTS "apps_master_data_skills" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "category" VARCHAR(50),
            "description" TEXT,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "apps_master_data_skills" IS '技能表';
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_skills_tenant_code" ON "apps_master_data_skills" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_skills_tenant_id" ON "apps_master_data_skills" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_skills_code" ON "apps_master_data_skills" ("code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_skills_uuid" ON "apps_master_data_skills" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_skills_category" ON "apps_master_data_skills" ("category");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_skills_created_at" ON "apps_master_data_skills" ("created_at");

-- 来自: 39_20250114_add_sop_flow_and_form_config.py
-- 为 SOP 表添加 flow_config 字段（ProFlow 流程配置）
        ALTER TABLE "apps_master_data_sop" ADD COLUMN IF NOT EXISTS "flow_config" JSONB;
        
        -- 为 SOP 表添加 form_config 字段（Formily 表单配置）
        ALTER TABLE "apps_master_data_sop" ADD COLUMN IF NOT EXISTS "form_config" JSONB;

-- 来自: 40_20250114_create_sop_executions.py
-- 创建 SOP 执行实例表
        CREATE TABLE IF NOT EXISTS "apps_master_data_sop_executions" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" UUID NOT NULL UNIQUE,
            "tenant_id" INTEGER NOT NULL,
            "sop_id" INTEGER NOT NULL,
            "title" VARCHAR(200) NOT NULL,
            "description" TEXT,
            "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
            "current_node_id" VARCHAR(100),
            "node_data" JSONB,
            "inngest_run_id" VARCHAR(100),
            "executor_id" INTEGER NOT NULL,
            "started_at" TIMESTAMPTZ NOT NULL,
            "completed_at" TIMESTAMPTZ,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "fk_apps_master_data_sop_executions_sop_id" FOREIGN KEY ("sop_id") REFERENCES "apps_master_data_sop" ("id") ON DELETE CASCADE
        );
COMMENT ON TABLE "apps_master_data_sop_executions" IS 'SOP执行记录表';
        
        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_sop_executions_tenant_id" ON "apps_master_data_sop_executions" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_sop_executions_uuid" ON "apps_master_data_sop_executions" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_sop_executions_sop_id" ON "apps_master_data_sop_executions" ("sop_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_sop_executions_status" ON "apps_master_data_sop_executions" ("status");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_sop_executions_executor_id" ON "apps_master_data_sop_executions" ("executor_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_sop_executions_current_node_id" ON "apps_master_data_sop_executions" ("current_node_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_sop_executions_inngest_run_id" ON "apps_master_data_sop_executions" ("inngest_run_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_sop_executions_created_at" ON "apps_master_data_sop_executions" ("created_at");
        
        -- 创建复合索引
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_sop_executions_tenant_status" ON "apps_master_data_sop_executions" ("tenant_id", "status");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_sop_executions_tenant_executor_status" ON "apps_master_data_sop_executions" ("tenant_id", "executor_id", "status");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_sop_executions_tenant_created_at" ON "apps_master_data_sop_executions" ("tenant_id", "created_at");

-- 来自: 41_20250115_enhance_bom_management.py
-- 为BOM表添加新字段
        ALTER TABLE "apps_master_data_bom" 
        ADD COLUMN IF NOT EXISTS "version" VARCHAR(50) NOT NULL DEFAULT '1.0',
        ADD COLUMN IF NOT EXISTS "bom_code" VARCHAR(100),
        ADD COLUMN IF NOT EXISTS "effective_date" TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "expiry_date" TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "approval_status" VARCHAR(20) NOT NULL DEFAULT 'draft',
        ADD COLUMN IF NOT EXISTS "approved_by" INT,
        ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "approval_comment" TEXT,
        ADD COLUMN IF NOT EXISTS "remark" TEXT;

        -- 创建新索引
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_bom_bom_code" ON "apps_master_data_bom" ("bom_code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_bom_version" ON "apps_master_data_bom" ("version");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_bom_approval_status" ON "apps_master_data_bom" ("approval_status");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_bom_effective_date" ON "apps_master_data_bom" ("effective_date");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_bom_expiry_date" ON "apps_master_data_bom" ("expiry_date");
        
        -- 为现有BOM数据设置默认值（如果需要）
        UPDATE "apps_master_data_bom" 
        SET "version" = '1.0' 
        WHERE "version" IS NULL OR "version" = '';
        
        -- 为现有BOM数据生成bom_code（如果为空）
        UPDATE "apps_master_data_bom" 
        SET "bom_code" = 'BOM-' || "material_id"::text || '-' || "id"::text
        WHERE "bom_code" IS NULL OR "bom_code" = '';

-- 来自: 42_20251215112102_create_crm_models.py
CREATE TABLE IF NOT EXISTS "apps_kuaicrm_leads" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "lead_no" VARCHAR(50) NOT NULL,
    "lead_source" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL  DEFAULT '新线索',
    "customer_name" VARCHAR(200) NOT NULL,
    "contact_name" VARCHAR(100),
    "contact_phone" VARCHAR(20),
    "contact_email" VARCHAR(100),
    "address" TEXT,
    "score" INT NOT NULL  DEFAULT 0,
    "assigned_to" INT,
    "convert_status" VARCHAR(20),
    "convert_time" TIMESTAMPTZ,
    "convert_reason" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaicr_tenant__810b7c" UNIQUE ("tenant_id", "lead_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_tenant__bbfa20" ON "apps_kuaicrm_leads" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_lead_no_5a0035" ON "apps_kuaicrm_leads" ("lead_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_uuid_611138" ON "apps_kuaicrm_leads" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_status_45f2b7" ON "apps_kuaicrm_leads" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_assigne_e29feb" ON "apps_kuaicrm_leads" ("assigned_to");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_lead_so_110b67" ON "apps_kuaicrm_leads" ("lead_source");
COMMENT ON COLUMN "apps_kuaicrm_leads"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaicrm_leads"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaicrm_leads"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaicrm_leads"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaicrm_leads"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaicrm_leads"."lead_no" IS '线索编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaicrm_leads"."lead_source" IS '线索来源（展会、网站、转介绍、电话营销等）';
COMMENT ON COLUMN "apps_kuaicrm_leads"."status" IS '线索状态（新线索、跟进中、已转化、已关闭）';
COMMENT ON COLUMN "apps_kuaicrm_leads"."customer_name" IS '客户名称';
COMMENT ON COLUMN "apps_kuaicrm_leads"."contact_name" IS '联系人';
COMMENT ON COLUMN "apps_kuaicrm_leads"."contact_phone" IS '联系电话';
COMMENT ON COLUMN "apps_kuaicrm_leads"."contact_email" IS '联系邮箱';
COMMENT ON COLUMN "apps_kuaicrm_leads"."address" IS '地址';
COMMENT ON COLUMN "apps_kuaicrm_leads"."score" IS '线索评分';
COMMENT ON COLUMN "apps_kuaicrm_leads"."assigned_to" IS '分配给（用户ID）';
COMMENT ON COLUMN "apps_kuaicrm_leads"."convert_status" IS '转化状态（未转化、已转化为商机、已转化为客户）';
COMMENT ON COLUMN "apps_kuaicrm_leads"."convert_time" IS '转化时间';
COMMENT ON COLUMN "apps_kuaicrm_leads"."convert_reason" IS '转化原因';
COMMENT ON COLUMN "apps_kuaicrm_leads"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaicrm_leads" IS 'KUAICRM Lead表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaicrm_opportunities" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "oppo_no" VARCHAR(50) NOT NULL,
    "oppo_name" VARCHAR(200) NOT NULL,
    "customer_id" INT,
    "stage" VARCHAR(50) NOT NULL  DEFAULT '初步接触',
    "amount" DECIMAL(18,2),
    "expected_close_date" TIMESTAMPTZ,
    "source" VARCHAR(50),
    "lead_id" INT,
    "owner_id" INT,
    "probability" DECIMAL(5,2) NOT NULL  DEFAULT 0,
    "status" VARCHAR(20) NOT NULL  DEFAULT '进行中',
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaicr_tenant__8af6b9" UNIQUE ("tenant_id", "oppo_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_tenant__09a4dc" ON "apps_kuaicrm_opportunities" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_oppo_no_c0b7cd" ON "apps_kuaicrm_opportunities" ("oppo_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_uuid_2036b9" ON "apps_kuaicrm_opportunities" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_stage_ec4731" ON "apps_kuaicrm_opportunities" ("stage");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_status_eb743c" ON "apps_kuaicrm_opportunities" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_owner_i_de8230" ON "apps_kuaicrm_opportunities" ("owner_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_custome_289235" ON "apps_kuaicrm_opportunities" ("customer_id");
COMMENT ON COLUMN "apps_kuaicrm_opportunities"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaicrm_opportunities"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaicrm_opportunities"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaicrm_opportunities"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaicrm_opportunities"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaicrm_opportunities"."oppo_no" IS '商机编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaicrm_opportunities"."oppo_name" IS '商机名称';
COMMENT ON COLUMN "apps_kuaicrm_opportunities"."customer_id" IS '客户ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaicrm_opportunities"."stage" IS '商机阶段（初步接触、需求确认、方案报价、商务谈判、成交）';
COMMENT ON COLUMN "apps_kuaicrm_opportunities"."amount" IS '商机金额';
COMMENT ON COLUMN "apps_kuaicrm_opportunities"."expected_close_date" IS '预计成交日期';
COMMENT ON COLUMN "apps_kuaicrm_opportunities"."source" IS '商机来源（线索转化、直接创建）';
COMMENT ON COLUMN "apps_kuaicrm_opportunities"."lead_id" IS '关联线索ID（如果来自线索转化）';
COMMENT ON COLUMN "apps_kuaicrm_opportunities"."owner_id" IS '负责人（用户ID）';
COMMENT ON COLUMN "apps_kuaicrm_opportunities"."probability" IS '成交概率（0-100）';
COMMENT ON COLUMN "apps_kuaicrm_opportunities"."status" IS '商机状态（进行中、已成交、已关闭）';
COMMENT ON COLUMN "apps_kuaicrm_opportunities"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaicrm_opportunities" IS 'CRM商机表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaicrm_sales_orders" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "order_no" VARCHAR(50) NOT NULL,
    "order_date" TIMESTAMPTZ NOT NULL,
    "customer_id" INT NOT NULL,
    "opportunity_id" INT,
    "status" VARCHAR(50) NOT NULL  DEFAULT '待审批',
    "total_amount" DECIMAL(18,2) NOT NULL,
    "delivery_date" TIMESTAMPTZ,
    "priority" VARCHAR(20) NOT NULL  DEFAULT '普通',
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaicr_tenant__64f939" UNIQUE ("tenant_id", "order_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_tenant__0b7650" ON "apps_kuaicrm_sales_orders" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_order_n_a914f5" ON "apps_kuaicrm_sales_orders" ("order_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_uuid_3b8d8a" ON "apps_kuaicrm_sales_orders" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_status_625f7d" ON "apps_kuaicrm_sales_orders" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_custome_89cfbe" ON "apps_kuaicrm_sales_orders" ("customer_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_opportu_4fc920" ON "apps_kuaicrm_sales_orders" ("opportunity_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_order_d_c15239" ON "apps_kuaicrm_sales_orders" ("order_date");
COMMENT ON COLUMN "apps_kuaicrm_sales_orders"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaicrm_sales_orders"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaicrm_sales_orders"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaicrm_sales_orders"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaicrm_sales_orders"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaicrm_sales_orders"."order_no" IS '订单编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaicrm_sales_orders"."order_date" IS '订单日期';
COMMENT ON COLUMN "apps_kuaicrm_sales_orders"."customer_id" IS '客户ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaicrm_sales_orders"."opportunity_id" IS '关联商机ID（可选，从商机转化）';
COMMENT ON COLUMN "apps_kuaicrm_sales_orders"."status" IS '订单状态（待审批、已审批、生产中、已交付、已关闭）';
COMMENT ON COLUMN "apps_kuaicrm_sales_orders"."total_amount" IS '订单金额';
COMMENT ON COLUMN "apps_kuaicrm_sales_orders"."delivery_date" IS '交期要求';
COMMENT ON COLUMN "apps_kuaicrm_sales_orders"."priority" IS '优先级（普通、紧急、加急）';
COMMENT ON COLUMN "apps_kuaicrm_sales_orders"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaicrm_sales_orders" IS 'CRM销售订单表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaicrm_service_workorders" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "workorder_no" VARCHAR(50) NOT NULL,
    "workorder_type" VARCHAR(50) NOT NULL,
    "customer_id" INT NOT NULL,
    "status" VARCHAR(50) NOT NULL  DEFAULT '待分配',
    "priority" VARCHAR(20) NOT NULL  DEFAULT '普通',
    "service_content" TEXT NOT NULL,
    "assigned_to" INT,
    "start_time" TIMESTAMPTZ,
    "end_time" TIMESTAMPTZ,
    "execution_result" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaicr_tenant__135aaf" UNIQUE ("tenant_id", "workorder_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_tenant__d09ed0" ON "apps_kuaicrm_service_workorders" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_workord_0364f9" ON "apps_kuaicrm_service_workorders" ("workorder_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_uuid_ca6a58" ON "apps_kuaicrm_service_workorders" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_status_c2f734" ON "apps_kuaicrm_service_workorders" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_workord_f66e4d" ON "apps_kuaicrm_service_workorders" ("workorder_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_custome_6d6f22" ON "apps_kuaicrm_service_workorders" ("customer_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_assigne_1ea323" ON "apps_kuaicrm_service_workorders" ("assigned_to");
COMMENT ON COLUMN "apps_kuaicrm_service_workorders"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaicrm_service_workorders"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaicrm_service_workorders"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaicrm_service_workorders"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaicrm_service_workorders"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaicrm_service_workorders"."workorder_no" IS '工单编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaicrm_service_workorders"."workorder_type" IS '工单类型（安装、维修、保养、咨询等）';
COMMENT ON COLUMN "apps_kuaicrm_service_workorders"."customer_id" IS '客户ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaicrm_service_workorders"."status" IS '工单状态（待分配、已分配、执行中、已完成、已关闭）';
COMMENT ON COLUMN "apps_kuaicrm_service_workorders"."priority" IS '优先级（普通、紧急、加急）';
COMMENT ON COLUMN "apps_kuaicrm_service_workorders"."service_content" IS '服务内容';
COMMENT ON COLUMN "apps_kuaicrm_service_workorders"."assigned_to" IS '分配给（用户ID）';
COMMENT ON COLUMN "apps_kuaicrm_service_workorders"."start_time" IS '开始时间';
COMMENT ON COLUMN "apps_kuaicrm_service_workorders"."end_time" IS '结束时间';
COMMENT ON COLUMN "apps_kuaicrm_service_workorders"."execution_result" IS '执行结果';
COMMENT ON COLUMN "apps_kuaicrm_service_workorders"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaicrm_service_workorders" IS 'KUAICRM Ervice workorder表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaicrm_warranties" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "warranty_no" VARCHAR(50) NOT NULL,
    "customer_id" INT NOT NULL,
    "product_info" TEXT NOT NULL,
    "warranty_type" VARCHAR(50) NOT NULL,
    "warranty_period" INT NOT NULL,
    "warranty_start_date" TIMESTAMPTZ,
    "warranty_end_date" TIMESTAMPTZ,
    "warranty_status" VARCHAR(20) NOT NULL  DEFAULT '有效',
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaicr_tenant__08f18a" UNIQUE ("tenant_id", "warranty_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_tenant__9cd195" ON "apps_kuaicrm_warranties" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_warrant_6d554e" ON "apps_kuaicrm_warranties" ("warranty_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_uuid_588cb4" ON "apps_kuaicrm_warranties" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_warrant_658f2a" ON "apps_kuaicrm_warranties" ("warranty_status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_custome_2c264e" ON "apps_kuaicrm_warranties" ("customer_id");
COMMENT ON COLUMN "apps_kuaicrm_warranties"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaicrm_warranties"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaicrm_warranties"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaicrm_warranties"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaicrm_warranties"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaicrm_warranties"."warranty_no" IS '保修编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaicrm_warranties"."customer_id" IS '客户ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaicrm_warranties"."product_info" IS '产品信息';
COMMENT ON COLUMN "apps_kuaicrm_warranties"."warranty_type" IS '保修类型';
COMMENT ON COLUMN "apps_kuaicrm_warranties"."warranty_period" IS '保修期限（月）';
COMMENT ON COLUMN "apps_kuaicrm_warranties"."warranty_start_date" IS '保修开始日期';
COMMENT ON COLUMN "apps_kuaicrm_warranties"."warranty_end_date" IS '保修结束日期';
COMMENT ON COLUMN "apps_kuaicrm_warranties"."warranty_status" IS '保修状态（有效、已过期、已取消）';
COMMENT ON COLUMN "apps_kuaicrm_warranties"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaicrm_warranties" IS 'KUAICRM Warrantie表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaicrm_complaints" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "complaint_no" VARCHAR(50) NOT NULL,
    "customer_id" INT NOT NULL,
    "complaint_type" VARCHAR(50) NOT NULL,
    "complaint_content" TEXT NOT NULL,
    "handle_status" VARCHAR(20) NOT NULL  DEFAULT '待处理',
    "handle_result" TEXT,
    "handle_time" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaicr_tenant__93b042" UNIQUE ("tenant_id", "complaint_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_tenant__4d3564" ON "apps_kuaicrm_complaints" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_complai_98074f" ON "apps_kuaicrm_complaints" ("complaint_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_uuid_aaf9c3" ON "apps_kuaicrm_complaints" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_handle__959af9" ON "apps_kuaicrm_complaints" ("handle_status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_custome_26dbad" ON "apps_kuaicrm_complaints" ("customer_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_complai_cb239e" ON "apps_kuaicrm_complaints" ("complaint_type");
COMMENT ON COLUMN "apps_kuaicrm_complaints"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaicrm_complaints"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaicrm_complaints"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaicrm_complaints"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaicrm_complaints"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaicrm_complaints"."complaint_no" IS '投诉编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaicrm_complaints"."customer_id" IS '客户ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaicrm_complaints"."complaint_type" IS '投诉类型';
COMMENT ON COLUMN "apps_kuaicrm_complaints"."complaint_content" IS '投诉内容';
COMMENT ON COLUMN "apps_kuaicrm_complaints"."handle_status" IS '处理状态（待处理、处理中、已处理、已关闭）';
COMMENT ON COLUMN "apps_kuaicrm_complaints"."handle_result" IS '处理结果';
COMMENT ON COLUMN "apps_kuaicrm_complaints"."handle_time" IS '处理时间';
COMMENT ON COLUMN "apps_kuaicrm_complaints"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaicrm_complaints" IS 'KUAICRM Complaint表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaicrm_installations" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "installation_no" VARCHAR(50) NOT NULL,
    "customer_id" INT NOT NULL,
    "installation_date" TIMESTAMPTZ NOT NULL,
    "installation_address" TEXT NOT NULL,
    "installation_status" VARCHAR(20) NOT NULL  DEFAULT '待安装',
    "installation_result" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaicr_tenant__fc1f12" UNIQUE ("tenant_id", "installation_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_tenant__28aac5" ON "apps_kuaicrm_installations" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_install_f87483" ON "apps_kuaicrm_installations" ("installation_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_uuid_7785cc" ON "apps_kuaicrm_installations" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_install_34513c" ON "apps_kuaicrm_installations" ("installation_status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_custome_d820a1" ON "apps_kuaicrm_installations" ("customer_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_install_a0d798" ON "apps_kuaicrm_installations" ("installation_date");
COMMENT ON COLUMN "apps_kuaicrm_installations"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaicrm_installations"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaicrm_installations"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaicrm_installations"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaicrm_installations"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaicrm_installations"."installation_no" IS '安装编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaicrm_installations"."customer_id" IS '客户ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaicrm_installations"."installation_date" IS '安装日期';
COMMENT ON COLUMN "apps_kuaicrm_installations"."installation_address" IS '安装地址';
COMMENT ON COLUMN "apps_kuaicrm_installations"."installation_status" IS '安装状态（待安装、安装中、已完成、已取消）';
COMMENT ON COLUMN "apps_kuaicrm_installations"."installation_result" IS '安装结果';
COMMENT ON COLUMN "apps_kuaicrm_installations"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaicrm_installations" IS 'KUAICRM Intallation表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaicrm_service_contracts" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "contract_no" VARCHAR(50) NOT NULL,
    "customer_id" INT NOT NULL,
    "contract_type" VARCHAR(50) NOT NULL,
    "contract_start_date" TIMESTAMPTZ NOT NULL,
    "contract_end_date" TIMESTAMPTZ NOT NULL,
    "contract_status" VARCHAR(20) NOT NULL  DEFAULT '有效',
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaicr_tenant__b8c3ab" UNIQUE ("tenant_id", "contract_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_tenant__469669" ON "apps_kuaicrm_service_contracts" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_contrac_2a9f4b" ON "apps_kuaicrm_service_contracts" ("contract_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_uuid_03b543" ON "apps_kuaicrm_service_contracts" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_contrac_96e538" ON "apps_kuaicrm_service_contracts" ("contract_status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_custome_8b6627" ON "apps_kuaicrm_service_contracts" ("customer_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_contrac_a7223e" ON "apps_kuaicrm_service_contracts" ("contract_type");
COMMENT ON COLUMN "apps_kuaicrm_service_contracts"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaicrm_service_contracts"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaicrm_service_contracts"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaicrm_service_contracts"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaicrm_service_contracts"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaicrm_service_contracts"."contract_no" IS '合同编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaicrm_service_contracts"."customer_id" IS '客户ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaicrm_service_contracts"."contract_type" IS '合同类型';
COMMENT ON COLUMN "apps_kuaicrm_service_contracts"."contract_start_date" IS '合同开始日期';
COMMENT ON COLUMN "apps_kuaicrm_service_contracts"."contract_end_date" IS '合同结束日期';
COMMENT ON COLUMN "apps_kuaicrm_service_contracts"."contract_status" IS '合同状态（有效、已到期、已终止）';
COMMENT ON COLUMN "apps_kuaicrm_service_contracts"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaicrm_service_contracts" IS 'CRM服务合同表';;

-- 来自: 43_20251215113624_create_crm_models.py
CREATE TABLE IF NOT EXISTS "apps_kuaicrm_lead_followups" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "lead_id" INT NOT NULL,
    "followup_type" VARCHAR(50) NOT NULL,
    "followup_content" TEXT NOT NULL,
    "followup_result" VARCHAR(200),
    "next_followup_date" TIMESTAMPTZ,
    "followup_by" INT NOT NULL,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_tenant__98d39f" ON "apps_kuaicrm_lead_followups" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_lead_id_61e23c" ON "apps_kuaicrm_lead_followups" ("lead_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_uuid_ff212c" ON "apps_kuaicrm_lead_followups" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_followu_d40199" ON "apps_kuaicrm_lead_followups" ("followup_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_next_fo_879b88" ON "apps_kuaicrm_lead_followups" ("next_followup_date");
COMMENT ON COLUMN "apps_kuaicrm_lead_followups"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaicrm_lead_followups"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaicrm_lead_followups"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaicrm_lead_followups"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaicrm_lead_followups"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaicrm_lead_followups"."lead_id" IS '线索ID（关联Lead）';
COMMENT ON COLUMN "apps_kuaicrm_lead_followups"."followup_type" IS '跟进类型（电话、邮件、拜访、会议等）';
COMMENT ON COLUMN "apps_kuaicrm_lead_followups"."followup_content" IS '跟进内容';
COMMENT ON COLUMN "apps_kuaicrm_lead_followups"."followup_result" IS '跟进结果';
COMMENT ON COLUMN "apps_kuaicrm_lead_followups"."next_followup_date" IS '下次跟进日期';
COMMENT ON COLUMN "apps_kuaicrm_lead_followups"."followup_by" IS '跟进人（用户ID）';
COMMENT ON COLUMN "apps_kuaicrm_lead_followups"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaicrm_lead_followups" IS 'KUAICRM Lead followup表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaicrm_opportunity_followups" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "opportunity_id" INT NOT NULL,
    "followup_type" VARCHAR(50) NOT NULL,
    "followup_content" TEXT NOT NULL,
    "followup_result" VARCHAR(200),
    "next_followup_date" TIMESTAMPTZ,
    "followup_by" INT NOT NULL,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_tenant__5c1a64" ON "apps_kuaicrm_opportunity_followups" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_opportu_f7daf4" ON "apps_kuaicrm_opportunity_followups" ("opportunity_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_uuid_a282c4" ON "apps_kuaicrm_opportunity_followups" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_followu_654c34" ON "apps_kuaicrm_opportunity_followups" ("followup_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_next_fo_0ebc3f" ON "apps_kuaicrm_opportunity_followups" ("next_followup_date");
COMMENT ON COLUMN "apps_kuaicrm_opportunity_followups"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaicrm_opportunity_followups"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaicrm_opportunity_followups"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaicrm_opportunity_followups"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaicrm_opportunity_followups"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaicrm_opportunity_followups"."opportunity_id" IS '商机ID（关联Opportunity）';
COMMENT ON COLUMN "apps_kuaicrm_opportunity_followups"."followup_type" IS '跟进类型（电话、邮件、拜访、会议、演示等）';
COMMENT ON COLUMN "apps_kuaicrm_opportunity_followups"."followup_content" IS '跟进内容';
COMMENT ON COLUMN "apps_kuaicrm_opportunity_followups"."followup_result" IS '跟进结果';
COMMENT ON COLUMN "apps_kuaicrm_opportunity_followups"."next_followup_date" IS '下次跟进日期';
COMMENT ON COLUMN "apps_kuaicrm_opportunity_followups"."followup_by" IS '跟进人（用户ID）';
COMMENT ON COLUMN "apps_kuaicrm_opportunity_followups"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaicrm_opportunity_followups" IS 'CRM商机跟进记录表';;

-- 来自: 44_20251215114247_create_crm_models.py
CREATE TABLE IF NOT EXISTS "core_approval_histories" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "approval_instance_id" INT NOT NULL,
    "action" VARCHAR(20) NOT NULL,
    "action_by" INT NOT NULL,
    "action_at" TIMESTAMPTZ NOT NULL,
    "comment" TEXT,
    "from_node" VARCHAR(100),
    "to_node" VARCHAR(100),
    "from_approver_id" INT,
    "to_approver_id" INT
);
CREATE INDEX IF NOT EXISTS "idx_core_approv_tenant__89d1d6" ON "core_approval_histories" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_approv_approva_a2dd10" ON "core_approval_histories" ("approval_instance_id");
CREATE INDEX IF NOT EXISTS "idx_core_approv_uuid_9a1b94" ON "core_approval_histories" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_core_approv_action_bd31f0" ON "core_approval_histories" ("action");
CREATE INDEX IF NOT EXISTS "idx_core_approv_action__0f4144" ON "core_approval_histories" ("action_by");
CREATE INDEX IF NOT EXISTS "idx_core_approv_action__b16310" ON "core_approval_histories" ("action_at");
COMMENT ON COLUMN "core_approval_histories"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_approval_histories"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_approval_histories"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "core_approval_histories"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "core_approval_histories"."id" IS '主键ID';
COMMENT ON COLUMN "core_approval_histories"."approval_instance_id" IS '审批实例ID（关联ApprovalInstance）';
COMMENT ON COLUMN "core_approval_histories"."action" IS '操作类型（approve、reject、cancel、transfer）';
COMMENT ON COLUMN "core_approval_histories"."action_by" IS '操作人ID（用户ID）';
COMMENT ON COLUMN "core_approval_histories"."action_at" IS '操作时间';
COMMENT ON COLUMN "core_approval_histories"."comment" IS '审批意见';
COMMENT ON COLUMN "core_approval_histories"."from_node" IS '来源节点';
COMMENT ON COLUMN "core_approval_histories"."to_node" IS '目标节点';
COMMENT ON COLUMN "core_approval_histories"."from_approver_id" IS '原审批人ID';
COMMENT ON COLUMN "core_approval_histories"."to_approver_id" IS '新审批人ID';
COMMENT ON TABLE "core_approval_histories" IS '核心 Approval_hitorie表';;
        ALTER TABLE "apps_kuaicrm_sales_orders" ADD "approval_status" VARCHAR(20);
        ALTER TABLE "apps_kuaicrm_sales_orders" ADD "approval_instance_id" INT;
        CREATE INDEX "idx_apps_kuaicr_approva_5fc27f" ON "apps_kuaicrm_sales_orders" ("approval_status");
        CREATE INDEX "idx_apps_kuaicr_approva_c5f1a0" ON "apps_kuaicrm_sales_orders" ("approval_instance_id");

-- 来自: 45_20251215121124_create_crm_models.py
CREATE TABLE IF NOT EXISTS "apps_kuaipdm_design_changes" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "change_no" VARCHAR(50) NOT NULL,
    "change_type" VARCHAR(50) NOT NULL,
    "change_reason" TEXT NOT NULL,
    "change_content" TEXT NOT NULL,
    "change_scope" TEXT,
    "priority" VARCHAR(20) NOT NULL  DEFAULT '普通',
    "status" VARCHAR(50) NOT NULL  DEFAULT '待审批',
    "product_id" INT,
    "bom_id" INT,
    "approval_instance_id" INT,
    "approval_status" VARCHAR(20),
    "executor_id" INT,
    "execution_start_date" TIMESTAMPTZ,
    "execution_end_date" TIMESTAMPTZ,
    "execution_result" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaipd_tenant__e0e991" UNIQUE ("tenant_id", "change_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_tenant__4074c7" ON "apps_kuaipdm_design_changes" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_change__d3ffcb" ON "apps_kuaipdm_design_changes" ("change_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_uuid_bf0581" ON "apps_kuaipdm_design_changes" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_status_ed0ecd" ON "apps_kuaipdm_design_changes" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_change__9fe946" ON "apps_kuaipdm_design_changes" ("change_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_product_904ffe" ON "apps_kuaipdm_design_changes" ("product_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_approva_1b9eab" ON "apps_kuaipdm_design_changes" ("approval_instance_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_approva_84dafa" ON "apps_kuaipdm_design_changes" ("approval_status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_created_25d79e" ON "apps_kuaipdm_design_changes" ("created_at");
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."change_no" IS '变更编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."change_type" IS '变更类型（设计变更、工艺变更、材料变更等）';
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."change_reason" IS '变更原因';
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."change_content" IS '变更内容描述';
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."change_scope" IS '变更影响范围';
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."priority" IS '优先级（普通、紧急、加急）';
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."status" IS '变更状态（待审批、审批中、已批准、执行中、已完成、已关闭）';
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."product_id" IS '关联产品ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."bom_id" IS '关联BOM ID（可选）';
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."approval_instance_id" IS '审批实例ID（关联ApprovalInstance）';
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."approval_status" IS '审批状态（pending、approved、rejected、cancelled）';
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."executor_id" IS '执行人ID（用户ID）';
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."execution_start_date" IS '执行开始日期';
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."execution_end_date" IS '执行结束日期';
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."execution_result" IS '执行结果';
COMMENT ON COLUMN "apps_kuaipdm_design_changes"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaipdm_design_changes" IS 'PDM设计变更表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaipdm_engineering_changes" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "change_no" VARCHAR(50) NOT NULL,
    "change_type" VARCHAR(50) NOT NULL,
    "change_reason" TEXT NOT NULL,
    "change_content" TEXT NOT NULL,
    "change_impact" TEXT,
    "priority" VARCHAR(20) NOT NULL  DEFAULT '普通',
    "status" VARCHAR(50) NOT NULL  DEFAULT '待审批',
    "product_id" INT,
    "approval_instance_id" INT,
    "approval_status" VARCHAR(20),
    "executor_id" INT,
    "execution_start_date" TIMESTAMPTZ,
    "execution_end_date" TIMESTAMPTZ,
    "execution_result" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaipd_tenant__b8d426" UNIQUE ("tenant_id", "change_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_tenant__30ec2a" ON "apps_kuaipdm_engineering_changes" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_change__52952c" ON "apps_kuaipdm_engineering_changes" ("change_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_uuid_0275be" ON "apps_kuaipdm_engineering_changes" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_status_77049d" ON "apps_kuaipdm_engineering_changes" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_change__09f392" ON "apps_kuaipdm_engineering_changes" ("change_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_product_6c4b6e" ON "apps_kuaipdm_engineering_changes" ("product_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_approva_435057" ON "apps_kuaipdm_engineering_changes" ("approval_instance_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_approva_ee4f0c" ON "apps_kuaipdm_engineering_changes" ("approval_status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_created_668597" ON "apps_kuaipdm_engineering_changes" ("created_at");
COMMENT ON COLUMN "apps_kuaipdm_engineering_changes"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaipdm_engineering_changes"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaipdm_engineering_changes"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaipdm_engineering_changes"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaipdm_engineering_changes"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaipdm_engineering_changes"."change_no" IS '变更编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaipdm_engineering_changes"."change_type" IS '变更类型（设计变更、工艺变更、材料变更等）';
COMMENT ON COLUMN "apps_kuaipdm_engineering_changes"."change_reason" IS '变更原因';
COMMENT ON COLUMN "apps_kuaipdm_engineering_changes"."change_content" IS '变更内容描述';
COMMENT ON COLUMN "apps_kuaipdm_engineering_changes"."change_impact" IS '变更影响分析';
COMMENT ON COLUMN "apps_kuaipdm_engineering_changes"."priority" IS '优先级（普通、紧急、加急）';
COMMENT ON COLUMN "apps_kuaipdm_engineering_changes"."status" IS '变更状态（待审批、审批中、已批准、执行中、已完成、已关闭）';
COMMENT ON COLUMN "apps_kuaipdm_engineering_changes"."product_id" IS '关联产品ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaipdm_engineering_changes"."approval_instance_id" IS '审批实例ID（关联ApprovalInstance）';
COMMENT ON COLUMN "apps_kuaipdm_engineering_changes"."approval_status" IS '审批状态（pending、approved、rejected、cancelled）';
COMMENT ON COLUMN "apps_kuaipdm_engineering_changes"."executor_id" IS '执行人ID（用户ID）';
COMMENT ON COLUMN "apps_kuaipdm_engineering_changes"."execution_start_date" IS '执行开始日期';
COMMENT ON COLUMN "apps_kuaipdm_engineering_changes"."execution_end_date" IS '执行结束日期';
COMMENT ON COLUMN "apps_kuaipdm_engineering_changes"."execution_result" IS '执行结果';
COMMENT ON COLUMN "apps_kuaipdm_engineering_changes"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaipdm_engineering_changes" IS 'PDM工程变更表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaipdm_design_reviews" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "review_no" VARCHAR(50) NOT NULL,
    "review_type" VARCHAR(50) NOT NULL,
    "review_stage" VARCHAR(50),
    "product_id" INT,
    "review_date" TIMESTAMPTZ,
    "status" VARCHAR(50) NOT NULL  DEFAULT '计划中',
    "conclusion" VARCHAR(50),
    "review_content" TEXT,
    "review_result" TEXT,
    "reviewers" JSONB,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaipd_tenant__a95341" UNIQUE ("tenant_id", "review_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_tenant__ced277" ON "apps_kuaipdm_design_reviews" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_review__993268" ON "apps_kuaipdm_design_reviews" ("review_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_uuid_a1af19" ON "apps_kuaipdm_design_reviews" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_status_ab587f" ON "apps_kuaipdm_design_reviews" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_review__361303" ON "apps_kuaipdm_design_reviews" ("review_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_product_98c03c" ON "apps_kuaipdm_design_reviews" ("product_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_review__ac4ac7" ON "apps_kuaipdm_design_reviews" ("review_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_created_ad29ca" ON "apps_kuaipdm_design_reviews" ("created_at");
COMMENT ON COLUMN "apps_kuaipdm_design_reviews"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaipdm_design_reviews"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaipdm_design_reviews"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaipdm_design_reviews"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaipdm_design_reviews"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaipdm_design_reviews"."review_no" IS '评审编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaipdm_design_reviews"."review_type" IS '评审类型（概念评审、设计评审、样机评审等）';
COMMENT ON COLUMN "apps_kuaipdm_design_reviews"."review_stage" IS '评审阶段';
COMMENT ON COLUMN "apps_kuaipdm_design_reviews"."product_id" IS '关联产品ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaipdm_design_reviews"."review_date" IS '评审日期';
COMMENT ON COLUMN "apps_kuaipdm_design_reviews"."status" IS '评审状态（计划中、进行中、已完成、已关闭）';
COMMENT ON COLUMN "apps_kuaipdm_design_reviews"."conclusion" IS '评审结论（通过、有条件通过、不通过）';
COMMENT ON COLUMN "apps_kuaipdm_design_reviews"."review_content" IS '评审内容';
COMMENT ON COLUMN "apps_kuaipdm_design_reviews"."review_result" IS '评审结果';
COMMENT ON COLUMN "apps_kuaipdm_design_reviews"."reviewers" IS '评审人员列表（JSON格式）';
COMMENT ON COLUMN "apps_kuaipdm_design_reviews"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaipdm_design_reviews" IS 'PDM设计评审表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaipdm_research_processes" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "process_no" VARCHAR(50) NOT NULL,
    "process_name" VARCHAR(200) NOT NULL,
    "process_type" VARCHAR(50) NOT NULL,
    "process_template" JSONB,
    "current_stage" VARCHAR(100),
    "status" VARCHAR(50) NOT NULL  DEFAULT '进行中',
    "product_id" INT,
    "project_id" INT,
    "owner_id" INT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaipd_tenant__120f74" UNIQUE ("tenant_id", "process_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_tenant__d11b58" ON "apps_kuaipdm_research_processes" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_process_c71c46" ON "apps_kuaipdm_research_processes" ("process_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_uuid_9600e7" ON "apps_kuaipdm_research_processes" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_status_640afe" ON "apps_kuaipdm_research_processes" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_process_65e77e" ON "apps_kuaipdm_research_processes" ("process_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_product_e35512" ON "apps_kuaipdm_research_processes" ("product_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_project_556cf9" ON "apps_kuaipdm_research_processes" ("project_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_current_e76c06" ON "apps_kuaipdm_research_processes" ("current_stage");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_created_8f02d3" ON "apps_kuaipdm_research_processes" ("created_at");
COMMENT ON COLUMN "apps_kuaipdm_research_processes"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaipdm_research_processes"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaipdm_research_processes"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaipdm_research_processes"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaipdm_research_processes"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaipdm_research_processes"."process_no" IS '流程编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaipdm_research_processes"."process_name" IS '流程名称';
COMMENT ON COLUMN "apps_kuaipdm_research_processes"."process_type" IS '流程类型（IPD、CMMI、APQP等）';
COMMENT ON COLUMN "apps_kuaipdm_research_processes"."process_template" IS '流程模板（JSON格式）';
COMMENT ON COLUMN "apps_kuaipdm_research_processes"."current_stage" IS '当前阶段';
COMMENT ON COLUMN "apps_kuaipdm_research_processes"."status" IS '流程状态（进行中、已完成、已暂停、已关闭）';
COMMENT ON COLUMN "apps_kuaipdm_research_processes"."product_id" IS '关联产品ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaipdm_research_processes"."project_id" IS '关联项目ID（可选，关联PM模块）';
COMMENT ON COLUMN "apps_kuaipdm_research_processes"."owner_id" IS '负责人ID（用户ID）';
COMMENT ON COLUMN "apps_kuaipdm_research_processes"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaipdm_research_processes" IS 'PDM研发流程表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaipdm_knowledges" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "knowledge_no" VARCHAR(50) NOT NULL,
    "knowledge_type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "category" VARCHAR(100),
    "tags" JSONB,
    "author_id" INT NOT NULL,
    "view_count" INT NOT NULL  DEFAULT 0,
    "like_count" INT NOT NULL  DEFAULT 0,
    "rating" DECIMAL(3,2),
    "is_public" BOOL NOT NULL  DEFAULT False,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaipd_tenant__40f18a" UNIQUE ("tenant_id", "knowledge_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_tenant__ff8c59" ON "apps_kuaipdm_knowledges" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_knowled_07e394" ON "apps_kuaipdm_knowledges" ("knowledge_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_uuid_52668c" ON "apps_kuaipdm_knowledges" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_knowled_b4adc5" ON "apps_kuaipdm_knowledges" ("knowledge_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_categor_823d0e" ON "apps_kuaipdm_knowledges" ("category");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_author__2e73c8" ON "apps_kuaipdm_knowledges" ("author_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_is_publ_dd5a3c" ON "apps_kuaipdm_knowledges" ("is_public");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaipd_created_683e30" ON "apps_kuaipdm_knowledges" ("created_at");
COMMENT ON COLUMN "apps_kuaipdm_knowledges"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaipdm_knowledges"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaipdm_knowledges"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaipdm_knowledges"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaipdm_knowledges"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaipdm_knowledges"."knowledge_no" IS '知识编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaipdm_knowledges"."knowledge_type" IS '知识类型（技术知识、设计经验、最佳实践、专利等）';
COMMENT ON COLUMN "apps_kuaipdm_knowledges"."title" IS '知识标题';
COMMENT ON COLUMN "apps_kuaipdm_knowledges"."content" IS '知识内容';
COMMENT ON COLUMN "apps_kuaipdm_knowledges"."category" IS '知识分类';
COMMENT ON COLUMN "apps_kuaipdm_knowledges"."tags" IS '知识标签（JSON格式）';
COMMENT ON COLUMN "apps_kuaipdm_knowledges"."author_id" IS '作者ID（用户ID）';
COMMENT ON COLUMN "apps_kuaipdm_knowledges"."view_count" IS '查看次数';
COMMENT ON COLUMN "apps_kuaipdm_knowledges"."like_count" IS '点赞次数';
COMMENT ON COLUMN "apps_kuaipdm_knowledges"."rating" IS '评分（0-5分）';
COMMENT ON COLUMN "apps_kuaipdm_knowledges"."is_public" IS '是否公开';
COMMENT ON COLUMN "apps_kuaipdm_knowledges"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaipdm_knowledges" IS 'PDM知识管理表';;

-- 来自: 46_20251215122733_create_crm_models.py
CREATE TABLE IF NOT EXISTS "apps_kuaimrp_mrp_plans" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "plan_no" VARCHAR(50) NOT NULL,
    "plan_name" VARCHAR(200) NOT NULL,
    "plan_type" VARCHAR(20) NOT NULL  DEFAULT 'MRP',
    "plan_date" TIMESTAMPTZ NOT NULL,
    "status" VARCHAR(50) NOT NULL  DEFAULT '草稿',
    "start_date" TIMESTAMPTZ,
    "end_date" TIMESTAMPTZ,
    "calculation_params" JSONB,
    "calculation_result" JSONB,
    "owner_id" INT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaimr_tenant__31d4b7" UNIQUE ("tenant_id", "plan_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_tenant__51de7e" ON "apps_kuaimrp_mrp_plans" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_plan_no_8bb07d" ON "apps_kuaimrp_mrp_plans" ("plan_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_uuid_e6975b" ON "apps_kuaimrp_mrp_plans" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_status_b95ab0" ON "apps_kuaimrp_mrp_plans" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_plan_ty_3c61d9" ON "apps_kuaimrp_mrp_plans" ("plan_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_plan_da_a05f07" ON "apps_kuaimrp_mrp_plans" ("plan_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_created_e752ec" ON "apps_kuaimrp_mrp_plans" ("created_at");
COMMENT ON COLUMN "apps_kuaimrp_mrp_plans"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaimrp_mrp_plans"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaimrp_mrp_plans"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaimrp_mrp_plans"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaimrp_mrp_plans"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaimrp_mrp_plans"."plan_no" IS '计划编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaimrp_mrp_plans"."plan_name" IS '计划名称';
COMMENT ON COLUMN "apps_kuaimrp_mrp_plans"."plan_type" IS '计划类型（MRP、LRP）';
COMMENT ON COLUMN "apps_kuaimrp_mrp_plans"."plan_date" IS '计划日期';
COMMENT ON COLUMN "apps_kuaimrp_mrp_plans"."status" IS '计划状态（草稿、计算中、已完成、已关闭）';
COMMENT ON COLUMN "apps_kuaimrp_mrp_plans"."start_date" IS '计划开始日期';
COMMENT ON COLUMN "apps_kuaimrp_mrp_plans"."end_date" IS '计划结束日期';
COMMENT ON COLUMN "apps_kuaimrp_mrp_plans"."calculation_params" IS '计算参数（JSON格式）';
COMMENT ON COLUMN "apps_kuaimrp_mrp_plans"."calculation_result" IS '计算结果统计（JSON格式）';
COMMENT ON COLUMN "apps_kuaimrp_mrp_plans"."owner_id" IS '负责人ID（用户ID）';
COMMENT ON COLUMN "apps_kuaimrp_mrp_plans"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaimrp_mrp_plans" IS 'KUAIMRP Mrp plan表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaimrp_lrp_batches" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "batch_no" VARCHAR(50) NOT NULL,
    "batch_name" VARCHAR(200) NOT NULL,
    "order_ids" JSONB,
    "status" VARCHAR(50) NOT NULL  DEFAULT '草稿',
    "planned_date" TIMESTAMPTZ,
    "delivery_date" TIMESTAMPTZ,
    "batch_params" JSONB,
    "owner_id" INT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaimr_tenant__aad8bd" UNIQUE ("tenant_id", "batch_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_tenant__705961" ON "apps_kuaimrp_lrp_batches" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_batch_n_4a88d9" ON "apps_kuaimrp_lrp_batches" ("batch_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_uuid_d9d8e2" ON "apps_kuaimrp_lrp_batches" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_status_bf7d49" ON "apps_kuaimrp_lrp_batches" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_planned_dba0a5" ON "apps_kuaimrp_lrp_batches" ("planned_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_deliver_b1dbf4" ON "apps_kuaimrp_lrp_batches" ("delivery_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_created_1e136f" ON "apps_kuaimrp_lrp_batches" ("created_at");
COMMENT ON COLUMN "apps_kuaimrp_lrp_batches"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaimrp_lrp_batches"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaimrp_lrp_batches"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaimrp_lrp_batches"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaimrp_lrp_batches"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaimrp_lrp_batches"."batch_no" IS '批次编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaimrp_lrp_batches"."batch_name" IS '批次名称';
COMMENT ON COLUMN "apps_kuaimrp_lrp_batches"."order_ids" IS '关联订单ID列表（JSON格式）';
COMMENT ON COLUMN "apps_kuaimrp_lrp_batches"."status" IS '批次状态（草稿、计算中、已完成、已关闭）';
COMMENT ON COLUMN "apps_kuaimrp_lrp_batches"."planned_date" IS '计划日期';
COMMENT ON COLUMN "apps_kuaimrp_lrp_batches"."delivery_date" IS '交期要求';
COMMENT ON COLUMN "apps_kuaimrp_lrp_batches"."batch_params" IS '批次参数（JSON格式）';
COMMENT ON COLUMN "apps_kuaimrp_lrp_batches"."owner_id" IS '负责人ID（用户ID）';
COMMENT ON COLUMN "apps_kuaimrp_lrp_batches"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaimrp_lrp_batches" IS 'KUAIMRP Lrp batche表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaimrp_material_requirements" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "requirement_no" VARCHAR(50) NOT NULL,
    "material_id" INT NOT NULL,
    "requirement_type" VARCHAR(20) NOT NULL,
    "plan_id" INT,
    "requirement_date" TIMESTAMPTZ NOT NULL,
    "gross_requirement" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "available_stock" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "in_transit_stock" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "safety_stock" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "net_requirement" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "suggested_order_qty" DECIMAL(18,4),
    "suggested_order_date" TIMESTAMPTZ,
    "suggested_type" VARCHAR(20),
    "status" VARCHAR(50) NOT NULL  DEFAULT '待处理',
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaimr_tenant__a5553d" UNIQUE ("tenant_id", "requirement_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_tenant__c53ddc" ON "apps_kuaimrp_material_requirements" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_require_78b6a9" ON "apps_kuaimrp_material_requirements" ("requirement_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_uuid_f64b28" ON "apps_kuaimrp_material_requirements" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_materia_ddf4a9" ON "apps_kuaimrp_material_requirements" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_require_d100aa" ON "apps_kuaimrp_material_requirements" ("requirement_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_plan_id_2c004d" ON "apps_kuaimrp_material_requirements" ("plan_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_require_33144f" ON "apps_kuaimrp_material_requirements" ("requirement_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_status_77151b" ON "apps_kuaimrp_material_requirements" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_created_d2e499" ON "apps_kuaimrp_material_requirements" ("created_at");
COMMENT ON COLUMN "apps_kuaimrp_material_requirements"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaimrp_material_requirements"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaimrp_material_requirements"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaimrp_material_requirements"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaimrp_material_requirements"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaimrp_material_requirements"."requirement_no" IS '需求编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaimrp_material_requirements"."material_id" IS '物料ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaimrp_material_requirements"."requirement_type" IS '需求类型（MRP、LRP）';
COMMENT ON COLUMN "apps_kuaimrp_material_requirements"."plan_id" IS '关联计划ID（MRPPlan或LRPBatch）';
COMMENT ON COLUMN "apps_kuaimrp_material_requirements"."requirement_date" IS '需求日期';
COMMENT ON COLUMN "apps_kuaimrp_material_requirements"."gross_requirement" IS '毛需求数量';
COMMENT ON COLUMN "apps_kuaimrp_material_requirements"."available_stock" IS '可用库存';
COMMENT ON COLUMN "apps_kuaimrp_material_requirements"."in_transit_stock" IS '在途库存';
COMMENT ON COLUMN "apps_kuaimrp_material_requirements"."safety_stock" IS '安全库存';
COMMENT ON COLUMN "apps_kuaimrp_material_requirements"."net_requirement" IS '净需求数量';
COMMENT ON COLUMN "apps_kuaimrp_material_requirements"."suggested_order_qty" IS '建议采购/生产数量';
COMMENT ON COLUMN "apps_kuaimrp_material_requirements"."suggested_order_date" IS '建议采购/生产日期';
COMMENT ON COLUMN "apps_kuaimrp_material_requirements"."suggested_type" IS '建议类型（采购、生产、委外）';
COMMENT ON COLUMN "apps_kuaimrp_material_requirements"."status" IS '需求状态（待处理、已生成计划、已完成）';
COMMENT ON COLUMN "apps_kuaimrp_material_requirements"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaimrp_material_requirements" IS 'MRP物料需求表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaimrp_requirement_traceabilities" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "requirement_id" INT NOT NULL,
    "source_type" VARCHAR(50) NOT NULL,
    "source_id" INT,
    "source_no" VARCHAR(100),
    "parent_requirement_id" INT,
    "level" INT NOT NULL  DEFAULT 0,
    "requirement_qty" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_tenant__6c5407" ON "apps_kuaimrp_requirement_traceabilities" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_require_38b634" ON "apps_kuaimrp_requirement_traceabilities" ("requirement_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_uuid_d14357" ON "apps_kuaimrp_requirement_traceabilities" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_source__9c5e03" ON "apps_kuaimrp_requirement_traceabilities" ("source_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_source__287c18" ON "apps_kuaimrp_requirement_traceabilities" ("source_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_parent__8838cf" ON "apps_kuaimrp_requirement_traceabilities" ("parent_requirement_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_level_365db5" ON "apps_kuaimrp_requirement_traceabilities" ("level");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_created_30d879" ON "apps_kuaimrp_requirement_traceabilities" ("created_at");
COMMENT ON COLUMN "apps_kuaimrp_requirement_traceabilities"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaimrp_requirement_traceabilities"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaimrp_requirement_traceabilities"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaimrp_requirement_traceabilities"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaimrp_requirement_traceabilities"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaimrp_requirement_traceabilities"."requirement_id" IS '需求ID（关联MaterialRequirement）';
COMMENT ON COLUMN "apps_kuaimrp_requirement_traceabilities"."source_type" IS '需求来源类型（销售订单、销售预测、安全库存、独立需求等）';
COMMENT ON COLUMN "apps_kuaimrp_requirement_traceabilities"."source_id" IS '需求来源ID';
COMMENT ON COLUMN "apps_kuaimrp_requirement_traceabilities"."source_no" IS '需求来源编号';
COMMENT ON COLUMN "apps_kuaimrp_requirement_traceabilities"."parent_requirement_id" IS '父需求ID（用于需求层级关系）';
COMMENT ON COLUMN "apps_kuaimrp_requirement_traceabilities"."level" IS '需求层级（0为最顶层）';
COMMENT ON COLUMN "apps_kuaimrp_requirement_traceabilities"."requirement_qty" IS '需求数量';
COMMENT ON COLUMN "apps_kuaimrp_requirement_traceabilities"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaimrp_requirement_traceabilities" IS 'KUAIMRP Requirement traceabilitie表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaimrp_shortage_alerts" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "alert_no" VARCHAR(50) NOT NULL,
    "material_id" INT NOT NULL,
    "requirement_id" INT,
    "shortage_qty" DECIMAL(18,4) NOT NULL,
    "shortage_date" TIMESTAMPTZ NOT NULL,
    "alert_level" VARCHAR(20) NOT NULL  DEFAULT '一般',
    "alert_reason" TEXT,
    "alert_status" VARCHAR(50) NOT NULL  DEFAULT '待处理',
    "suggested_action" TEXT,
    "handler_id" INT,
    "handled_at" TIMESTAMPTZ,
    "handle_result" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaimr_tenant__047e85" UNIQUE ("tenant_id", "alert_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_tenant__477817" ON "apps_kuaimrp_shortage_alerts" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_alert_n_326937" ON "apps_kuaimrp_shortage_alerts" ("alert_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_uuid_25421f" ON "apps_kuaimrp_shortage_alerts" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_materia_f37800" ON "apps_kuaimrp_shortage_alerts" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_require_95ecf1" ON "apps_kuaimrp_shortage_alerts" ("requirement_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_shortag_a31dda" ON "apps_kuaimrp_shortage_alerts" ("shortage_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_alert_l_e2a89a" ON "apps_kuaimrp_shortage_alerts" ("alert_level");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_alert_s_cc6890" ON "apps_kuaimrp_shortage_alerts" ("alert_status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_created_878a0c" ON "apps_kuaimrp_shortage_alerts" ("created_at");
COMMENT ON COLUMN "apps_kuaimrp_shortage_alerts"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaimrp_shortage_alerts"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaimrp_shortage_alerts"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaimrp_shortage_alerts"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaimrp_shortage_alerts"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaimrp_shortage_alerts"."alert_no" IS '预警编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaimrp_shortage_alerts"."material_id" IS '物料ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaimrp_shortage_alerts"."requirement_id" IS '关联需求ID（MaterialRequirement）';
COMMENT ON COLUMN "apps_kuaimrp_shortage_alerts"."shortage_qty" IS '缺料数量';
COMMENT ON COLUMN "apps_kuaimrp_shortage_alerts"."shortage_date" IS '缺料日期';
COMMENT ON COLUMN "apps_kuaimrp_shortage_alerts"."alert_level" IS '预警等级（紧急、重要、一般）';
COMMENT ON COLUMN "apps_kuaimrp_shortage_alerts"."alert_reason" IS '缺料原因';
COMMENT ON COLUMN "apps_kuaimrp_shortage_alerts"."alert_status" IS '预警状态（待处理、处理中、已解决、已关闭）';
COMMENT ON COLUMN "apps_kuaimrp_shortage_alerts"."suggested_action" IS '处理建议';
COMMENT ON COLUMN "apps_kuaimrp_shortage_alerts"."handler_id" IS '处理人ID（用户ID）';
COMMENT ON COLUMN "apps_kuaimrp_shortage_alerts"."handled_at" IS '处理时间';
COMMENT ON COLUMN "apps_kuaimrp_shortage_alerts"."handle_result" IS '处理结果';
COMMENT ON COLUMN "apps_kuaimrp_shortage_alerts"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaimrp_shortage_alerts" IS 'MRP缺料预警表';;

-- 来自: 47_20251215123836_create_crm_models.py
CREATE TABLE IF NOT EXISTS "apps_kuaisrm_purchase_orders" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "order_no" VARCHAR(50) NOT NULL,
    "order_date" TIMESTAMPTZ NOT NULL,
    "supplier_id" INT NOT NULL,
    "status" VARCHAR(50) NOT NULL  DEFAULT '草稿',
    "total_amount" DECIMAL(18,2) NOT NULL  DEFAULT 0,
    "currency" VARCHAR(10) NOT NULL  DEFAULT 'CNY',
    "delivery_date" TIMESTAMPTZ,
    "approval_instance_id" INT,
    "approval_status" VARCHAR(20),
    "requirement_id" INT,
    "order_items" JSONB,
    "remark" TEXT,
    "owner_id" INT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaisr_tenant__ad48ea" UNIQUE ("tenant_id", "order_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_tenant__64dc0a" ON "apps_kuaisrm_purchase_orders" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_order_n_60b070" ON "apps_kuaisrm_purchase_orders" ("order_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_uuid_49b5d7" ON "apps_kuaisrm_purchase_orders" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_status_919f50" ON "apps_kuaisrm_purchase_orders" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_supplie_2850b7" ON "apps_kuaisrm_purchase_orders" ("supplier_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_order_d_41403b" ON "apps_kuaisrm_purchase_orders" ("order_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_approva_c31584" ON "apps_kuaisrm_purchase_orders" ("approval_instance_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_approva_9faa08" ON "apps_kuaisrm_purchase_orders" ("approval_status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_deliver_3edf6d" ON "apps_kuaisrm_purchase_orders" ("delivery_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_created_2cefe8" ON "apps_kuaisrm_purchase_orders" ("created_at");
COMMENT ON COLUMN "apps_kuaisrm_purchase_orders"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaisrm_purchase_orders"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaisrm_purchase_orders"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaisrm_purchase_orders"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaisrm_purchase_orders"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaisrm_purchase_orders"."order_no" IS '订单编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaisrm_purchase_orders"."order_date" IS '订单日期';
COMMENT ON COLUMN "apps_kuaisrm_purchase_orders"."supplier_id" IS '供应商ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaisrm_purchase_orders"."status" IS '订单状态（草稿、待审批、已审批、执行中、部分到货、已完成、已关闭、已取消）';
COMMENT ON COLUMN "apps_kuaisrm_purchase_orders"."total_amount" IS '订单总金额';
COMMENT ON COLUMN "apps_kuaisrm_purchase_orders"."currency" IS '币种';
COMMENT ON COLUMN "apps_kuaisrm_purchase_orders"."delivery_date" IS '交期要求';
COMMENT ON COLUMN "apps_kuaisrm_purchase_orders"."approval_instance_id" IS '审批实例ID（关联ApprovalInstance）';
COMMENT ON COLUMN "apps_kuaisrm_purchase_orders"."approval_status" IS '审批状态（pending、approved、rejected、cancelled）';
COMMENT ON COLUMN "apps_kuaisrm_purchase_orders"."requirement_id" IS '关联需求ID（MaterialRequirement，可选）';
COMMENT ON COLUMN "apps_kuaisrm_purchase_orders"."order_items" IS '订单明细（JSON格式）';
COMMENT ON COLUMN "apps_kuaisrm_purchase_orders"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaisrm_purchase_orders"."owner_id" IS '负责人ID（用户ID）';
COMMENT ON COLUMN "apps_kuaisrm_purchase_orders"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaisrm_purchase_orders" IS 'SRM采购订单表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaisrm_outsourcing_orders" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "order_no" VARCHAR(50) NOT NULL,
    "order_date" TIMESTAMPTZ NOT NULL,
    "supplier_id" INT NOT NULL,
    "status" VARCHAR(50) NOT NULL  DEFAULT '草稿',
    "total_amount" DECIMAL(18,2) NOT NULL  DEFAULT 0,
    "currency" VARCHAR(10) NOT NULL  DEFAULT 'CNY',
    "delivery_date" TIMESTAMPTZ,
    "progress" INT NOT NULL  DEFAULT 0,
    "approval_instance_id" INT,
    "approval_status" VARCHAR(20),
    "requirement_id" INT,
    "order_items" JSONB,
    "remark" TEXT,
    "owner_id" INT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaisr_tenant__0dd7d5" UNIQUE ("tenant_id", "order_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_tenant__9c063c" ON "apps_kuaisrm_outsourcing_orders" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_order_n_bd87dd" ON "apps_kuaisrm_outsourcing_orders" ("order_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_uuid_8c0903" ON "apps_kuaisrm_outsourcing_orders" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_status_dbeb15" ON "apps_kuaisrm_outsourcing_orders" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_supplie_c65214" ON "apps_kuaisrm_outsourcing_orders" ("supplier_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_order_d_6bfbb7" ON "apps_kuaisrm_outsourcing_orders" ("order_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_approva_4d6a7d" ON "apps_kuaisrm_outsourcing_orders" ("approval_instance_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_approva_663f3f" ON "apps_kuaisrm_outsourcing_orders" ("approval_status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_deliver_c95eff" ON "apps_kuaisrm_outsourcing_orders" ("delivery_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_progres_e648eb" ON "apps_kuaisrm_outsourcing_orders" ("progress");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_created_552b59" ON "apps_kuaisrm_outsourcing_orders" ("created_at");
COMMENT ON COLUMN "apps_kuaisrm_outsourcing_orders"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaisrm_outsourcing_orders"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaisrm_outsourcing_orders"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaisrm_outsourcing_orders"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaisrm_outsourcing_orders"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaisrm_outsourcing_orders"."order_no" IS '订单编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaisrm_outsourcing_orders"."order_date" IS '订单日期';
COMMENT ON COLUMN "apps_kuaisrm_outsourcing_orders"."supplier_id" IS '委外供应商ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaisrm_outsourcing_orders"."status" IS '订单状态（草稿、待审批、已审批、执行中、部分完成、已完成、已关闭、已取消）';
COMMENT ON COLUMN "apps_kuaisrm_outsourcing_orders"."total_amount" IS '订单总金额';
COMMENT ON COLUMN "apps_kuaisrm_outsourcing_orders"."currency" IS '币种';
COMMENT ON COLUMN "apps_kuaisrm_outsourcing_orders"."delivery_date" IS '交期要求';
COMMENT ON COLUMN "apps_kuaisrm_outsourcing_orders"."progress" IS '完成进度（百分比，0-100）';
COMMENT ON COLUMN "apps_kuaisrm_outsourcing_orders"."approval_instance_id" IS '审批实例ID（关联ApprovalInstance）';
COMMENT ON COLUMN "apps_kuaisrm_outsourcing_orders"."approval_status" IS '审批状态（pending、approved、rejected、cancelled）';
COMMENT ON COLUMN "apps_kuaisrm_outsourcing_orders"."requirement_id" IS '关联需求ID（MaterialRequirement，可选）';
COMMENT ON COLUMN "apps_kuaisrm_outsourcing_orders"."order_items" IS '订单明细（JSON格式）';
COMMENT ON COLUMN "apps_kuaisrm_outsourcing_orders"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaisrm_outsourcing_orders"."owner_id" IS '负责人ID（用户ID）';
COMMENT ON COLUMN "apps_kuaisrm_outsourcing_orders"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaisrm_outsourcing_orders" IS 'KUAISRM Outourcing order表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaisrm_supplier_evaluations" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "evaluation_no" VARCHAR(50) NOT NULL,
    "supplier_id" INT NOT NULL,
    "evaluation_period" VARCHAR(20) NOT NULL,
    "evaluation_date" TIMESTAMPTZ NOT NULL,
    "quality_score" DECIMAL(5,2) NOT NULL  DEFAULT 0,
    "delivery_score" DECIMAL(5,2) NOT NULL  DEFAULT 0,
    "price_score" DECIMAL(5,2) NOT NULL  DEFAULT 0,
    "service_score" DECIMAL(5,2) NOT NULL  DEFAULT 0,
    "total_score" DECIMAL(5,2) NOT NULL  DEFAULT 0,
    "evaluation_level" VARCHAR(10),
    "evaluation_result" JSONB,
    "evaluator_id" INT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaisr_tenant__8a0de1" UNIQUE ("tenant_id", "evaluation_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_tenant__5a7708" ON "apps_kuaisrm_supplier_evaluations" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_evaluat_bb53e4" ON "apps_kuaisrm_supplier_evaluations" ("evaluation_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_uuid_b9dc97" ON "apps_kuaisrm_supplier_evaluations" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_supplie_ed91af" ON "apps_kuaisrm_supplier_evaluations" ("supplier_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_evaluat_2e65c5" ON "apps_kuaisrm_supplier_evaluations" ("evaluation_period");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_evaluat_34c02a" ON "apps_kuaisrm_supplier_evaluations" ("evaluation_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_evaluat_900546" ON "apps_kuaisrm_supplier_evaluations" ("evaluation_level");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_total_s_7e439c" ON "apps_kuaisrm_supplier_evaluations" ("total_score");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_created_5b1f74" ON "apps_kuaisrm_supplier_evaluations" ("created_at");
COMMENT ON COLUMN "apps_kuaisrm_supplier_evaluations"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaisrm_supplier_evaluations"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaisrm_supplier_evaluations"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaisrm_supplier_evaluations"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaisrm_supplier_evaluations"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaisrm_supplier_evaluations"."evaluation_no" IS '评估编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaisrm_supplier_evaluations"."supplier_id" IS '供应商ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaisrm_supplier_evaluations"."evaluation_period" IS '评估周期（月度、季度、年度）';
COMMENT ON COLUMN "apps_kuaisrm_supplier_evaluations"."evaluation_date" IS '评估日期';
COMMENT ON COLUMN "apps_kuaisrm_supplier_evaluations"."quality_score" IS '质量评分（0-100）';
COMMENT ON COLUMN "apps_kuaisrm_supplier_evaluations"."delivery_score" IS '交期评分（0-100）';
COMMENT ON COLUMN "apps_kuaisrm_supplier_evaluations"."price_score" IS '价格评分（0-100）';
COMMENT ON COLUMN "apps_kuaisrm_supplier_evaluations"."service_score" IS '服务评分（0-100）';
COMMENT ON COLUMN "apps_kuaisrm_supplier_evaluations"."total_score" IS '综合评分（0-100）';
COMMENT ON COLUMN "apps_kuaisrm_supplier_evaluations"."evaluation_level" IS '评估等级（A、B、C、D）';
COMMENT ON COLUMN "apps_kuaisrm_supplier_evaluations"."evaluation_result" IS '评估结果（JSON格式）';
COMMENT ON COLUMN "apps_kuaisrm_supplier_evaluations"."evaluator_id" IS '评估人ID（用户ID）';
COMMENT ON COLUMN "apps_kuaisrm_supplier_evaluations"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaisrm_supplier_evaluations" IS 'SRM供应商评估表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaisrm_purchase_contracts" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "contract_no" VARCHAR(50) NOT NULL,
    "contract_name" VARCHAR(200) NOT NULL,
    "supplier_id" INT NOT NULL,
    "contract_date" TIMESTAMPTZ NOT NULL,
    "start_date" TIMESTAMPTZ,
    "end_date" TIMESTAMPTZ,
    "status" VARCHAR(50) NOT NULL  DEFAULT '草稿',
    "total_amount" DECIMAL(18,2) NOT NULL  DEFAULT 0,
    "currency" VARCHAR(10) NOT NULL  DEFAULT 'CNY',
    "approval_instance_id" INT,
    "approval_status" VARCHAR(20),
    "contract_content" JSONB,
    "remark" TEXT,
    "owner_id" INT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaisr_tenant__065dd1" UNIQUE ("tenant_id", "contract_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_tenant__3c2845" ON "apps_kuaisrm_purchase_contracts" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_contrac_a91edd" ON "apps_kuaisrm_purchase_contracts" ("contract_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_uuid_422d72" ON "apps_kuaisrm_purchase_contracts" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_status_f5dd22" ON "apps_kuaisrm_purchase_contracts" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_supplie_5b0370" ON "apps_kuaisrm_purchase_contracts" ("supplier_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_contrac_e891ac" ON "apps_kuaisrm_purchase_contracts" ("contract_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_start_d_a165ad" ON "apps_kuaisrm_purchase_contracts" ("start_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_end_dat_07f536" ON "apps_kuaisrm_purchase_contracts" ("end_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_approva_062efb" ON "apps_kuaisrm_purchase_contracts" ("approval_instance_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_approva_cc91c1" ON "apps_kuaisrm_purchase_contracts" ("approval_status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaisr_created_017ea6" ON "apps_kuaisrm_purchase_contracts" ("created_at");
COMMENT ON COLUMN "apps_kuaisrm_purchase_contracts"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaisrm_purchase_contracts"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaisrm_purchase_contracts"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaisrm_purchase_contracts"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaisrm_purchase_contracts"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaisrm_purchase_contracts"."contract_no" IS '合同编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaisrm_purchase_contracts"."contract_name" IS '合同名称';
COMMENT ON COLUMN "apps_kuaisrm_purchase_contracts"."supplier_id" IS '供应商ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaisrm_purchase_contracts"."contract_date" IS '合同签订日期';
COMMENT ON COLUMN "apps_kuaisrm_purchase_contracts"."start_date" IS '合同开始日期';
COMMENT ON COLUMN "apps_kuaisrm_purchase_contracts"."end_date" IS '合同结束日期';
COMMENT ON COLUMN "apps_kuaisrm_purchase_contracts"."status" IS '合同状态（草稿、待审批、已审批、执行中、已完成、已终止）';
COMMENT ON COLUMN "apps_kuaisrm_purchase_contracts"."total_amount" IS '合同总金额';
COMMENT ON COLUMN "apps_kuaisrm_purchase_contracts"."currency" IS '币种';
COMMENT ON COLUMN "apps_kuaisrm_purchase_contracts"."approval_instance_id" IS '审批实例ID（关联ApprovalInstance）';
COMMENT ON COLUMN "apps_kuaisrm_purchase_contracts"."approval_status" IS '审批状态（pending、approved、rejected、cancelled）';
COMMENT ON COLUMN "apps_kuaisrm_purchase_contracts"."contract_content" IS '合同内容（JSON格式）';
COMMENT ON COLUMN "apps_kuaisrm_purchase_contracts"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaisrm_purchase_contracts"."owner_id" IS '负责人ID（用户ID）';
COMMENT ON COLUMN "apps_kuaisrm_purchase_contracts"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaisrm_purchase_contracts" IS 'SRM采购合同表';;

-- 来自: 48_20251215125044_create_crm_models.py
CREATE TABLE IF NOT EXISTS "apps_kuaiwms_inventories" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "material_id" INT NOT NULL,
    "warehouse_id" INT NOT NULL,
    "location_id" INT,
    "quantity" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "available_quantity" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "reserved_quantity" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "in_transit_quantity" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "unit" VARCHAR(20),
    "batch_no" VARCHAR(50),
    "lot_no" VARCHAR(50),
    "expiry_date" TIMESTAMPTZ,
    "cost_price" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "total_cost" DECIMAL(18,2) NOT NULL  DEFAULT 0,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaiwm_tenant__d7fdf1" UNIQUE ("tenant_id", "material_id", "warehouse_id", "location_id", "batch_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_tenant__a81c54" ON "apps_kuaiwms_inventories" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_materia_15c639" ON "apps_kuaiwms_inventories" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_warehou_e446e0" ON "apps_kuaiwms_inventories" ("warehouse_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_locatio_addedf" ON "apps_kuaiwms_inventories" ("location_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_uuid_b7903d" ON "apps_kuaiwms_inventories" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_batch_n_3b2cd8" ON "apps_kuaiwms_inventories" ("batch_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_lot_no_b3479f" ON "apps_kuaiwms_inventories" ("lot_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_created_137cbf" ON "apps_kuaiwms_inventories" ("created_at");
COMMENT ON COLUMN "apps_kuaiwms_inventories"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaiwms_inventories"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaiwms_inventories"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaiwms_inventories"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaiwms_inventories"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaiwms_inventories"."material_id" IS '物料ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaiwms_inventories"."warehouse_id" IS '仓库ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaiwms_inventories"."location_id" IS '库位ID（关联master-data，可选）';
COMMENT ON COLUMN "apps_kuaiwms_inventories"."quantity" IS '库存数量';
COMMENT ON COLUMN "apps_kuaiwms_inventories"."available_quantity" IS '可用数量';
COMMENT ON COLUMN "apps_kuaiwms_inventories"."reserved_quantity" IS '预留数量';
COMMENT ON COLUMN "apps_kuaiwms_inventories"."in_transit_quantity" IS '在途数量';
COMMENT ON COLUMN "apps_kuaiwms_inventories"."unit" IS '单位';
COMMENT ON COLUMN "apps_kuaiwms_inventories"."batch_no" IS '批次号（可选）';
COMMENT ON COLUMN "apps_kuaiwms_inventories"."lot_no" IS '批次号（可选）';
COMMENT ON COLUMN "apps_kuaiwms_inventories"."expiry_date" IS '有效期（可选）';
COMMENT ON COLUMN "apps_kuaiwms_inventories"."cost_price" IS '成本单价';
COMMENT ON COLUMN "apps_kuaiwms_inventories"."total_cost" IS '总成本';
COMMENT ON COLUMN "apps_kuaiwms_inventories"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaiwms_inventories" IS 'KUAIWMS Inventorie表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaiwms_inbound_orders" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "order_no" VARCHAR(50) NOT NULL,
    "order_date" TIMESTAMPTZ NOT NULL,
    "order_type" VARCHAR(50) NOT NULL,
    "warehouse_id" INT NOT NULL,
    "status" VARCHAR(50) NOT NULL  DEFAULT '草稿',
    "total_amount" DECIMAL(18,2) NOT NULL  DEFAULT 0,
    "source_order_id" INT,
    "source_order_no" VARCHAR(50),
    "order_items" JSONB,
    "remark" TEXT,
    "owner_id" INT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaiwm_tenant__d9b441" UNIQUE ("tenant_id", "order_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_tenant__503cb7" ON "apps_kuaiwms_inbound_orders" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_order_n_367a1c" ON "apps_kuaiwms_inbound_orders" ("order_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_uuid_bab51e" ON "apps_kuaiwms_inbound_orders" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_status_221cc2" ON "apps_kuaiwms_inbound_orders" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_order_t_4a2973" ON "apps_kuaiwms_inbound_orders" ("order_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_warehou_e5ef8b" ON "apps_kuaiwms_inbound_orders" ("warehouse_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_order_d_862fe5" ON "apps_kuaiwms_inbound_orders" ("order_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_source__a271c5" ON "apps_kuaiwms_inbound_orders" ("source_order_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_created_b62c4c" ON "apps_kuaiwms_inbound_orders" ("created_at");
COMMENT ON COLUMN "apps_kuaiwms_inbound_orders"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaiwms_inbound_orders"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaiwms_inbound_orders"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaiwms_inbound_orders"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaiwms_inbound_orders"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaiwms_inbound_orders"."order_no" IS '入库单编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaiwms_inbound_orders"."order_date" IS '入库日期';
COMMENT ON COLUMN "apps_kuaiwms_inbound_orders"."order_type" IS '入库类型（采购入库、生产入库、退货入库、委外入库、调拨入库）';
COMMENT ON COLUMN "apps_kuaiwms_inbound_orders"."warehouse_id" IS '仓库ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaiwms_inbound_orders"."status" IS '入库状态（草稿、待质检、质检中、已质检、执行中、部分入库、已完成、已关闭、已取消）';
COMMENT ON COLUMN "apps_kuaiwms_inbound_orders"."total_amount" IS '入库总金额';
COMMENT ON COLUMN "apps_kuaiwms_inbound_orders"."source_order_id" IS '来源订单ID（采购订单、生产订单等）';
COMMENT ON COLUMN "apps_kuaiwms_inbound_orders"."source_order_no" IS '来源订单编号';
COMMENT ON COLUMN "apps_kuaiwms_inbound_orders"."order_items" IS '入库明细（JSON格式）';
COMMENT ON COLUMN "apps_kuaiwms_inbound_orders"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaiwms_inbound_orders"."owner_id" IS '负责人ID（用户ID）';
COMMENT ON COLUMN "apps_kuaiwms_inbound_orders"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaiwms_inbound_orders" IS 'WMS入库单表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaiwms_outbound_orders" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "order_no" VARCHAR(50) NOT NULL,
    "order_date" TIMESTAMPTZ NOT NULL,
    "order_type" VARCHAR(50) NOT NULL,
    "warehouse_id" INT NOT NULL,
    "status" VARCHAR(50) NOT NULL  DEFAULT '草稿',
    "total_amount" DECIMAL(18,2) NOT NULL  DEFAULT 0,
    "source_order_id" INT,
    "source_order_no" VARCHAR(50),
    "picking_status" VARCHAR(50),
    "order_items" JSONB,
    "remark" TEXT,
    "owner_id" INT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaiwm_tenant__8d7f52" UNIQUE ("tenant_id", "order_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_tenant__22a0dc" ON "apps_kuaiwms_outbound_orders" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_order_n_6f86a9" ON "apps_kuaiwms_outbound_orders" ("order_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_uuid_7063c4" ON "apps_kuaiwms_outbound_orders" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_status_2d2059" ON "apps_kuaiwms_outbound_orders" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_order_t_b2befe" ON "apps_kuaiwms_outbound_orders" ("order_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_warehou_6f5dae" ON "apps_kuaiwms_outbound_orders" ("warehouse_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_order_d_8c34dd" ON "apps_kuaiwms_outbound_orders" ("order_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_source__48bc2b" ON "apps_kuaiwms_outbound_orders" ("source_order_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_picking_cca730" ON "apps_kuaiwms_outbound_orders" ("picking_status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_created_f1d942" ON "apps_kuaiwms_outbound_orders" ("created_at");
COMMENT ON COLUMN "apps_kuaiwms_outbound_orders"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaiwms_outbound_orders"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaiwms_outbound_orders"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaiwms_outbound_orders"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaiwms_outbound_orders"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaiwms_outbound_orders"."order_no" IS '出库单编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaiwms_outbound_orders"."order_date" IS '出库日期';
COMMENT ON COLUMN "apps_kuaiwms_outbound_orders"."order_type" IS '出库类型（销售出库、生产领料、调拨出库、委外发料、其他出库）';
COMMENT ON COLUMN "apps_kuaiwms_outbound_orders"."warehouse_id" IS '仓库ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaiwms_outbound_orders"."status" IS '出库状态（草稿、待拣货、拣货中、已拣货、执行中、部分出库、已完成、已关闭、已取消）';
COMMENT ON COLUMN "apps_kuaiwms_outbound_orders"."total_amount" IS '出库总金额';
COMMENT ON COLUMN "apps_kuaiwms_outbound_orders"."source_order_id" IS '来源订单ID（销售订单、生产订单等）';
COMMENT ON COLUMN "apps_kuaiwms_outbound_orders"."source_order_no" IS '来源订单编号';
COMMENT ON COLUMN "apps_kuaiwms_outbound_orders"."picking_status" IS '拣货状态（待拣货、拣货中、已拣货）';
COMMENT ON COLUMN "apps_kuaiwms_outbound_orders"."order_items" IS '出库明细（JSON格式）';
COMMENT ON COLUMN "apps_kuaiwms_outbound_orders"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaiwms_outbound_orders"."owner_id" IS '负责人ID（用户ID）';
COMMENT ON COLUMN "apps_kuaiwms_outbound_orders"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaiwms_outbound_orders" IS 'WMS出库单表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaiwms_stocktakes" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "stocktake_no" VARCHAR(50) NOT NULL,
    "stocktake_date" TIMESTAMPTZ NOT NULL,
    "warehouse_id" INT NOT NULL,
    "location_id" INT,
    "status" VARCHAR(50) NOT NULL  DEFAULT '草稿',
    "stocktake_type" VARCHAR(50) NOT NULL  DEFAULT '全盘',
    "stocktake_items" JSONB,
    "difference_amount" DECIMAL(18,2) NOT NULL  DEFAULT 0,
    "remark" TEXT,
    "owner_id" INT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaiwm_tenant__820d42" UNIQUE ("tenant_id", "stocktake_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_tenant__7a3e02" ON "apps_kuaiwms_stocktakes" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_stockta_62977c" ON "apps_kuaiwms_stocktakes" ("stocktake_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_uuid_284743" ON "apps_kuaiwms_stocktakes" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_status_6c3939" ON "apps_kuaiwms_stocktakes" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_warehou_155629" ON "apps_kuaiwms_stocktakes" ("warehouse_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_locatio_9c081c" ON "apps_kuaiwms_stocktakes" ("location_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_stockta_a41e6c" ON "apps_kuaiwms_stocktakes" ("stocktake_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_created_09bfdc" ON "apps_kuaiwms_stocktakes" ("created_at");
COMMENT ON COLUMN "apps_kuaiwms_stocktakes"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaiwms_stocktakes"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaiwms_stocktakes"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaiwms_stocktakes"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaiwms_stocktakes"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaiwms_stocktakes"."stocktake_no" IS '盘点单编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaiwms_stocktakes"."stocktake_date" IS '盘点日期';
COMMENT ON COLUMN "apps_kuaiwms_stocktakes"."warehouse_id" IS '仓库ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaiwms_stocktakes"."location_id" IS '库位ID（关联master-data，可选，为空表示全库盘点）';
COMMENT ON COLUMN "apps_kuaiwms_stocktakes"."status" IS '盘点状态（草稿、进行中、已完成、已关闭）';
COMMENT ON COLUMN "apps_kuaiwms_stocktakes"."stocktake_type" IS '盘点类型（全盘、抽盘、循环盘点）';
COMMENT ON COLUMN "apps_kuaiwms_stocktakes"."stocktake_items" IS '盘点明细（JSON格式）';
COMMENT ON COLUMN "apps_kuaiwms_stocktakes"."difference_amount" IS '差异金额';
COMMENT ON COLUMN "apps_kuaiwms_stocktakes"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaiwms_stocktakes"."owner_id" IS '负责人ID（用户ID）';
COMMENT ON COLUMN "apps_kuaiwms_stocktakes"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaiwms_stocktakes" IS 'KUAIWMS Tocktake表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaiwms_inventory_adjustments" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "adjustment_no" VARCHAR(50) NOT NULL,
    "adjustment_date" TIMESTAMPTZ NOT NULL,
    "warehouse_id" INT NOT NULL,
    "adjustment_type" VARCHAR(50) NOT NULL,
    "adjustment_reason" TEXT NOT NULL,
    "status" VARCHAR(50) NOT NULL  DEFAULT '草稿',
    "approval_instance_id" INT,
    "approval_status" VARCHAR(20),
    "adjustment_items" JSONB,
    "total_amount" DECIMAL(18,2) NOT NULL  DEFAULT 0,
    "owner_id" INT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaiwm_tenant__f1dd34" UNIQUE ("tenant_id", "adjustment_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_tenant__97a6b1" ON "apps_kuaiwms_inventory_adjustments" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_adjustm_b47e7a" ON "apps_kuaiwms_inventory_adjustments" ("adjustment_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_uuid_f760a2" ON "apps_kuaiwms_inventory_adjustments" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_status_57513b" ON "apps_kuaiwms_inventory_adjustments" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_warehou_357083" ON "apps_kuaiwms_inventory_adjustments" ("warehouse_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_adjustm_e51c1c" ON "apps_kuaiwms_inventory_adjustments" ("adjustment_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_approva_9ee3c9" ON "apps_kuaiwms_inventory_adjustments" ("approval_instance_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_approva_9446fd" ON "apps_kuaiwms_inventory_adjustments" ("approval_status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiwm_created_c83b69" ON "apps_kuaiwms_inventory_adjustments" ("created_at");
COMMENT ON COLUMN "apps_kuaiwms_inventory_adjustments"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaiwms_inventory_adjustments"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaiwms_inventory_adjustments"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaiwms_inventory_adjustments"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaiwms_inventory_adjustments"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaiwms_inventory_adjustments"."adjustment_no" IS '调整单编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaiwms_inventory_adjustments"."adjustment_date" IS '调整日期';
COMMENT ON COLUMN "apps_kuaiwms_inventory_adjustments"."warehouse_id" IS '仓库ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaiwms_inventory_adjustments"."adjustment_type" IS '调整类型（盘盈、盘亏、其他调整）';
COMMENT ON COLUMN "apps_kuaiwms_inventory_adjustments"."adjustment_reason" IS '调整原因';
COMMENT ON COLUMN "apps_kuaiwms_inventory_adjustments"."status" IS '调整状态（草稿、待审批、已审批、已执行、已关闭）';
COMMENT ON COLUMN "apps_kuaiwms_inventory_adjustments"."approval_instance_id" IS '审批实例ID（关联ApprovalInstance）';
COMMENT ON COLUMN "apps_kuaiwms_inventory_adjustments"."approval_status" IS '审批状态（pending、approved、rejected、cancelled）';
COMMENT ON COLUMN "apps_kuaiwms_inventory_adjustments"."adjustment_items" IS '调整明细（JSON格式）';
COMMENT ON COLUMN "apps_kuaiwms_inventory_adjustments"."total_amount" IS '调整总金额';
COMMENT ON COLUMN "apps_kuaiwms_inventory_adjustments"."owner_id" IS '负责人ID（用户ID）';
COMMENT ON COLUMN "apps_kuaiwms_inventory_adjustments"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaiwms_inventory_adjustments" IS 'WMS库存调整表';;

-- 来自: 49_20251215130712_create_crm_models.py
CREATE TABLE IF NOT EXISTS "apps_kuaimes_orders" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "order_no" VARCHAR(50) NOT NULL,
    "order_type" VARCHAR(50) NOT NULL  DEFAULT '计划订单',
    "product_id" INT NOT NULL,
    "product_name" VARCHAR(200) NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "completed_quantity" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "status" VARCHAR(50) NOT NULL  DEFAULT '草稿',
    "planned_start_date" TIMESTAMPTZ,
    "planned_end_date" TIMESTAMPTZ,
    "actual_start_date" TIMESTAMPTZ,
    "actual_end_date" TIMESTAMPTZ,
    "source_order_id" INT,
    "source_order_no" VARCHAR(50),
    "route_id" INT,
    "route_name" VARCHAR(200),
    "priority" VARCHAR(20) NOT NULL  DEFAULT '中',
    "owner_id" INT,
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaime_tenant__a1b2c3" UNIQUE ("tenant_id", "order_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_tenant__d4e5f6" ON "apps_kuaimes_orders" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_order_no_g7h8i9" ON "apps_kuaimes_orders" ("order_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_uuid_j0k1l2" ON "apps_kuaimes_orders" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_status_m3n4o5" ON "apps_kuaimes_orders" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_order_t_p6q7r8" ON "apps_kuaimes_orders" ("order_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_product_s9t0u1" ON "apps_kuaimes_orders" ("product_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_planned_v2w3x4" ON "apps_kuaimes_orders" ("planned_start_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_planned_y5z6a7" ON "apps_kuaimes_orders" ("planned_end_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_source__b8c9d0" ON "apps_kuaimes_orders" ("source_order_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_created_e1f2g3" ON "apps_kuaimes_orders" ("created_at");
COMMENT ON TABLE "apps_kuaimes_orders" IS 'MES生产订单表';
COMMENT ON COLUMN "apps_kuaimes_orders"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaimes_orders"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaimes_orders"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaimes_orders"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaimes_orders"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaimes_orders"."order_no" IS '订单编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaimes_orders"."order_type" IS '订单类型（计划订单、紧急订单、返工订单）';
COMMENT ON COLUMN "apps_kuaimes_orders"."product_id" IS '产品ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaimes_orders"."product_name" IS '产品名称';
COMMENT ON COLUMN "apps_kuaimes_orders"."quantity" IS '计划数量';
COMMENT ON COLUMN "apps_kuaimes_orders"."completed_quantity" IS '完成数量';
COMMENT ON COLUMN "apps_kuaimes_orders"."status" IS '订单状态（草稿、已确认、已下发、执行中、已完成、已关闭、已取消）';
COMMENT ON COLUMN "apps_kuaimes_orders"."planned_start_date" IS '计划开始日期';
COMMENT ON COLUMN "apps_kuaimes_orders"."planned_end_date" IS '计划结束日期';
COMMENT ON COLUMN "apps_kuaimes_orders"."actual_start_date" IS '实际开始日期';
COMMENT ON COLUMN "apps_kuaimes_orders"."actual_end_date" IS '实际结束日期';
COMMENT ON COLUMN "apps_kuaimes_orders"."source_order_id" IS '来源订单ID（销售订单、计划订单等）';
COMMENT ON COLUMN "apps_kuaimes_orders"."source_order_no" IS '来源订单编号';
COMMENT ON COLUMN "apps_kuaimes_orders"."route_id" IS '工艺路线ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaimes_orders"."route_name" IS '工艺路线名称';
COMMENT ON COLUMN "apps_kuaimes_orders"."priority" IS '优先级（高、中、低）';
COMMENT ON COLUMN "apps_kuaimes_orders"."owner_id" IS '负责人ID（用户ID）';
COMMENT ON COLUMN "apps_kuaimes_orders"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaimes_orders"."deleted_at" IS '删除时间（软删除）';
        CREATE TABLE IF NOT EXISTS "apps_kuaimes_work_orders" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "work_order_no" VARCHAR(50) NOT NULL,
    "order_id" INT,
    "order_uuid" VARCHAR(36),
    "product_id" INT NOT NULL,
    "product_name" VARCHAR(200) NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "completed_quantity" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "defective_quantity" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "route_id" INT,
    "route_name" VARCHAR(200),
    "current_operation" VARCHAR(100),
    "status" VARCHAR(50) NOT NULL  DEFAULT '草稿',
    "planned_start_date" TIMESTAMPTZ,
    "planned_end_date" TIMESTAMPTZ,
    "actual_start_date" TIMESTAMPTZ,
    "actual_end_date" TIMESTAMPTZ,
    "work_center_id" INT,
    "work_center_name" VARCHAR(200),
    "operator_id" INT,
    "operator_name" VARCHAR(100),
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaime_tenant__53bf79" UNIQUE ("tenant_id", "work_order_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_tenant__6b31b7" ON "apps_kuaimes_work_orders" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_work_or_10c61a" ON "apps_kuaimes_work_orders" ("work_order_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_uuid_e26a5f" ON "apps_kuaimes_work_orders" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_order_i_b112f5" ON "apps_kuaimes_work_orders" ("order_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_order_u_e52e7c" ON "apps_kuaimes_work_orders" ("order_uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_status_f304a2" ON "apps_kuaimes_work_orders" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_product_156097" ON "apps_kuaimes_work_orders" ("product_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_work_ce_df641a" ON "apps_kuaimes_work_orders" ("work_center_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_planned_fdc9d6" ON "apps_kuaimes_work_orders" ("planned_start_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_planned_0a61f4" ON "apps_kuaimes_work_orders" ("planned_end_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_created_ba9cfe" ON "apps_kuaimes_work_orders" ("created_at");
COMMENT ON COLUMN "apps_kuaimes_orders"."planned_end_date" IS '计划结束日期';
COMMENT ON COLUMN "apps_kuaimes_orders"."source_order_id" IS '来源订单ID（销售订单、计划订单等）';
COMMENT ON COLUMN "apps_kuaimes_orders"."owner_id" IS '负责人ID（用户ID）';
COMMENT ON COLUMN "apps_kuaimes_orders"."product_id" IS '产品ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaimes_orders"."planned_start_date" IS '计划开始日期';
COMMENT ON COLUMN "apps_kuaimes_orders"."actual_start_date" IS '实际开始日期';
COMMENT ON COLUMN "apps_kuaimes_orders"."order_type" IS '订单类型（计划订单、紧急订单、返工订单）';
COMMENT ON COLUMN "apps_kuaimes_orders"."actual_end_date" IS '实际结束日期';
COMMENT ON COLUMN "apps_kuaimes_orders"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaimes_orders"."route_id" IS '工艺路线ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaimes_orders"."completed_quantity" IS '完成数量';
COMMENT ON COLUMN "apps_kuaimes_orders"."priority" IS '优先级（高、中、低）';
COMMENT ON COLUMN "apps_kuaimes_orders"."source_order_no" IS '来源订单编号';
COMMENT ON COLUMN "apps_kuaimes_orders"."route_name" IS '工艺路线名称';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."work_order_no" IS '工单编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."order_id" IS '生产订单ID（关联Order）';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."order_uuid" IS '生产订单UUID';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."product_id" IS '产品ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."product_name" IS '产品名称';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."quantity" IS '计划数量';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."completed_quantity" IS '完成数量';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."defective_quantity" IS '不良品数量';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."route_id" IS '工艺路线ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."route_name" IS '工艺路线名称';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."current_operation" IS '当前工序';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."status" IS '工单状态（草稿、已下发、执行中、暂停、已完成、已关闭、已取消）';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."planned_start_date" IS '计划开始日期';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."planned_end_date" IS '计划结束日期';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."actual_start_date" IS '实际开始日期';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."actual_end_date" IS '实际结束日期';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."work_center_id" IS '工作中心ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."work_center_name" IS '工作中心名称';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."operator_id" IS '操作员ID（用户ID）';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."operator_name" IS '操作员姓名';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaimes_work_orders" IS 'MES工单表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaimes_production_reports" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "report_no" VARCHAR(50) NOT NULL,
    "work_order_id" INT,
    "work_order_uuid" VARCHAR(36),
    "operation_id" INT,
    "operation_name" VARCHAR(200),
    "report_date" TIMESTAMPTZ NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "qualified_quantity" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "defective_quantity" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "defective_reason" TEXT,
    "work_hours" DECIMAL(10,2) NOT NULL  DEFAULT 0,
    "operator_id" INT,
    "operator_name" VARCHAR(100),
    "work_center_id" INT,
    "work_center_name" VARCHAR(200),
    "batch_no" VARCHAR(50),
    "serial_no" VARCHAR(50),
    "status" VARCHAR(50) NOT NULL  DEFAULT '草稿',
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaime_tenant__185a1e" UNIQUE ("tenant_id", "report_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_tenant__5417c8" ON "apps_kuaimes_production_reports" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_report__d03568" ON "apps_kuaimes_production_reports" ("report_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_uuid_207d5a" ON "apps_kuaimes_production_reports" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_work_or_1f08a6" ON "apps_kuaimes_production_reports" ("work_order_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_work_or_8f1d1c" ON "apps_kuaimes_production_reports" ("work_order_uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_operati_b4415a" ON "apps_kuaimes_production_reports" ("operation_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_report__fd31a3" ON "apps_kuaimes_production_reports" ("report_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_operato_9b89a4" ON "apps_kuaimes_production_reports" ("operator_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_work_ce_9796d7" ON "apps_kuaimes_production_reports" ("work_center_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_batch_n_801c61" ON "apps_kuaimes_production_reports" ("batch_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_serial__c23b9e" ON "apps_kuaimes_production_reports" ("serial_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_status_db851a" ON "apps_kuaimes_production_reports" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_created_a2bc82" ON "apps_kuaimes_production_reports" ("created_at");
COMMENT ON COLUMN "apps_kuaimes_production_reports"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."report_no" IS '报工单编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."work_order_id" IS '工单ID（关联WorkOrder）';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."work_order_uuid" IS '工单UUID';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."operation_id" IS '工序ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."operation_name" IS '工序名称';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."report_date" IS '报工日期';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."quantity" IS '报工数量';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."qualified_quantity" IS '合格数量';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."defective_quantity" IS '不良品数量';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."defective_reason" IS '不良品原因';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."work_hours" IS '工时（小时）';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."operator_id" IS '操作员ID（用户ID）';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."operator_name" IS '操作员姓名';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."work_center_id" IS '工作中心ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."work_center_name" IS '工作中心名称';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."batch_no" IS '批次号（可选）';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."serial_no" IS '序列号（可选）';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."status" IS '报工状态（草稿、已确认、已审核）';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaimes_production_reports" IS 'MES生产报工表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaimes_traceabilities" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "trace_no" VARCHAR(50) NOT NULL,
    "trace_type" VARCHAR(50) NOT NULL,
    "batch_no" VARCHAR(50),
    "serial_no" VARCHAR(50),
    "product_id" INT NOT NULL,
    "product_name" VARCHAR(200) NOT NULL,
    "work_order_id" INT,
    "work_order_uuid" VARCHAR(36),
    "operation_id" INT,
    "operation_name" VARCHAR(200),
    "material_id" INT,
    "material_name" VARCHAR(200),
    "material_batch_no" VARCHAR(50),
    "quantity" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "trace_data" JSONB,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaime_tenant__b05410" UNIQUE ("tenant_id", "trace_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_tenant__cb87a3" ON "apps_kuaimes_traceabilities" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_trace_n_8a8e02" ON "apps_kuaimes_traceabilities" ("trace_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_uuid_71a4fa" ON "apps_kuaimes_traceabilities" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_trace_t_6f8c8b" ON "apps_kuaimes_traceabilities" ("trace_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_batch_n_ee4a90" ON "apps_kuaimes_traceabilities" ("batch_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_serial__54b66a" ON "apps_kuaimes_traceabilities" ("serial_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_product_79c0e0" ON "apps_kuaimes_traceabilities" ("product_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_work_or_d59c3b" ON "apps_kuaimes_traceabilities" ("work_order_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_work_or_bd29a4" ON "apps_kuaimes_traceabilities" ("work_order_uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_operati_26682e" ON "apps_kuaimes_traceabilities" ("operation_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_materia_7aeadd" ON "apps_kuaimes_traceabilities" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_materia_ba13b9" ON "apps_kuaimes_traceabilities" ("material_batch_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_created_e7c547" ON "apps_kuaimes_traceabilities" ("created_at");
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."trace_no" IS '追溯编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."trace_type" IS '追溯类型（批次追溯、序列号追溯）';
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."batch_no" IS '批次号';
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."serial_no" IS '序列号';
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."product_id" IS '产品ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."product_name" IS '产品名称';
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."work_order_id" IS '工单ID（关联WorkOrder）';
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."work_order_uuid" IS '工单UUID';
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."operation_id" IS '工序ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."operation_name" IS '工序名称';
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."material_id" IS '原材料ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."material_name" IS '原材料名称';
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."material_batch_no" IS '原材料批次号';
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."quantity" IS '数量';
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."trace_data" IS '追溯数据（JSON格式）';
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaimes_traceabilities" IS 'MES生产追溯表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaimes_rework_orders" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "rework_order_no" VARCHAR(50) NOT NULL,
    "original_work_order_id" INT,
    "original_work_order_uuid" VARCHAR(36),
    "product_id" INT NOT NULL,
    "product_name" VARCHAR(200) NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "rework_reason" TEXT NOT NULL,
    "rework_type" VARCHAR(50) NOT NULL,
    "route_id" INT,
    "route_name" VARCHAR(200),
    "status" VARCHAR(50) NOT NULL  DEFAULT '草稿',
    "planned_start_date" TIMESTAMPTZ,
    "planned_end_date" TIMESTAMPTZ,
    "actual_start_date" TIMESTAMPTZ,
    "actual_end_date" TIMESTAMPTZ,
    "work_center_id" INT,
    "work_center_name" VARCHAR(200),
    "operator_id" INT,
    "operator_name" VARCHAR(100),
    "cost" DECIMAL(18,2) NOT NULL  DEFAULT 0,
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaime_tenant__f9033b" UNIQUE ("tenant_id", "rework_order_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_tenant__3fdc94" ON "apps_kuaimes_rework_orders" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_rework__ab8bc5" ON "apps_kuaimes_rework_orders" ("rework_order_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_uuid_2d2d79" ON "apps_kuaimes_rework_orders" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_origina_f2cb27" ON "apps_kuaimes_rework_orders" ("original_work_order_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_origina_127c47" ON "apps_kuaimes_rework_orders" ("original_work_order_uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_status_0d9d4c" ON "apps_kuaimes_rework_orders" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_product_c05af5" ON "apps_kuaimes_rework_orders" ("product_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_work_ce_cac766" ON "apps_kuaimes_rework_orders" ("work_center_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_planned_75cc0b" ON "apps_kuaimes_rework_orders" ("planned_start_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_created_a1b2de" ON "apps_kuaimes_rework_orders" ("created_at");
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."rework_order_no" IS '返修工单编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."original_work_order_id" IS '原工单ID（关联WorkOrder）';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."original_work_order_uuid" IS '原工单UUID';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."product_id" IS '产品ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."product_name" IS '产品名称';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."quantity" IS '返修数量';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."rework_reason" IS '返修原因';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."rework_type" IS '返修类型（返工、返修、报废）';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."route_id" IS '返修工艺路线ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."route_name" IS '返修工艺路线名称';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."status" IS '返修状态（草稿、执行中、已完成、已关闭）';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."planned_start_date" IS '计划开始日期';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."planned_end_date" IS '计划结束日期';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."actual_start_date" IS '实际开始日期';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."actual_end_date" IS '实际结束日期';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."work_center_id" IS '工作中心ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."work_center_name" IS '工作中心名称';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."operator_id" IS '操作员ID（用户ID）';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."operator_name" IS '操作员姓名';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."cost" IS '返修成本';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaimes_rework_orders" IS 'MES返修工单表';;

-- 来自: 50_20251215133417_create_crm_models.py
CREATE TABLE IF NOT EXISTS "apps_kuaiqms_inspection_tasks" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "task_no" VARCHAR(50) NOT NULL,
    "inspection_type" VARCHAR(50) NOT NULL,
    "source_type" VARCHAR(50),
    "source_id" INT,
    "source_no" VARCHAR(50),
    "material_id" INT NOT NULL,
    "material_name" VARCHAR(200) NOT NULL,
    "batch_no" VARCHAR(50),
    "serial_no" VARCHAR(50),
    "quantity" DECIMAL(18,4) NOT NULL,
    "inspector_id" INT,
    "inspector_name" VARCHAR(100),
    "inspection_standard_id" INT,
    "inspection_standard_name" VARCHAR(200),
    "planned_inspection_date" TIMESTAMPTZ,
    "status" VARCHAR(50) NOT NULL  DEFAULT '待检验',
    "priority" VARCHAR(20) NOT NULL  DEFAULT '中',
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaiqm_tenant__567c4b" UNIQUE ("tenant_id", "task_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_tenant__7fb104" ON "apps_kuaiqms_inspection_tasks" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_task_no_9b988a" ON "apps_kuaiqms_inspection_tasks" ("task_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_uuid_d7a06d" ON "apps_kuaiqms_inspection_tasks" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_inspect_b11fca" ON "apps_kuaiqms_inspection_tasks" ("inspection_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_source__b5ef36" ON "apps_kuaiqms_inspection_tasks" ("source_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_source__e9b27d" ON "apps_kuaiqms_inspection_tasks" ("source_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_source__7af79e" ON "apps_kuaiqms_inspection_tasks" ("source_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_materia_4b9b17" ON "apps_kuaiqms_inspection_tasks" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_batch_n_d6fce7" ON "apps_kuaiqms_inspection_tasks" ("batch_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_serial__c2697f" ON "apps_kuaiqms_inspection_tasks" ("serial_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_inspect_688673" ON "apps_kuaiqms_inspection_tasks" ("inspector_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_status_b84a45" ON "apps_kuaiqms_inspection_tasks" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_planned_373c15" ON "apps_kuaiqms_inspection_tasks" ("planned_inspection_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_created_04ad84" ON "apps_kuaiqms_inspection_tasks" ("created_at");
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."task_no" IS '检验任务编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."inspection_type" IS '检验类型（来料检验、过程检验、成品检验、委外来料检验）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."source_type" IS '来源类型（采购订单、生产订单、工单、委外订单）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."source_id" IS '来源ID';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."source_no" IS '来源编号';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."material_id" IS '物料ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."material_name" IS '物料名称';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."batch_no" IS '批次号（可选）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."serial_no" IS '序列号（可选）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."quantity" IS '检验数量';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."inspector_id" IS '检验员ID（用户ID）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."inspector_name" IS '检验员姓名';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."inspection_standard_id" IS '检验标准ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."inspection_standard_name" IS '检验标准名称';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."planned_inspection_date" IS '计划检验日期';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."status" IS '任务状态（待检验、检验中、已完成、已取消）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."priority" IS '优先级（高、中、低）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaiqms_inspection_tasks" IS 'QMS质量检验任务表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaiqms_inspection_records" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "record_no" VARCHAR(50) NOT NULL,
    "task_id" INT,
    "task_uuid" VARCHAR(36),
    "inspection_type" VARCHAR(50) NOT NULL,
    "material_id" INT NOT NULL,
    "material_name" VARCHAR(200) NOT NULL,
    "batch_no" VARCHAR(50),
    "serial_no" VARCHAR(50),
    "quantity" DECIMAL(18,4) NOT NULL,
    "qualified_quantity" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "defective_quantity" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "inspection_result" VARCHAR(50) NOT NULL,
    "inspection_date" TIMESTAMPTZ NOT NULL,
    "inspector_id" INT,
    "inspector_name" VARCHAR(100),
    "inspection_standard_id" INT,
    "inspection_standard_name" VARCHAR(200),
    "inspection_data" JSONB,
    "status" VARCHAR(50) NOT NULL  DEFAULT '草稿',
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaiqm_tenant__3613a7" UNIQUE ("tenant_id", "record_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_tenant__5fb064" ON "apps_kuaiqms_inspection_records" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_record__57d5c2" ON "apps_kuaiqms_inspection_records" ("record_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_uuid_fbeef6" ON "apps_kuaiqms_inspection_records" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_task_id_5c52e3" ON "apps_kuaiqms_inspection_records" ("task_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_task_uu_433f86" ON "apps_kuaiqms_inspection_records" ("task_uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_inspect_4c812d" ON "apps_kuaiqms_inspection_records" ("inspection_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_materia_4e9623" ON "apps_kuaiqms_inspection_records" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_batch_n_e09059" ON "apps_kuaiqms_inspection_records" ("batch_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_serial__113176" ON "apps_kuaiqms_inspection_records" ("serial_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_inspect_203529" ON "apps_kuaiqms_inspection_records" ("inspector_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_inspect_0200f5" ON "apps_kuaiqms_inspection_records" ("inspection_result");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_inspect_366ed9" ON "apps_kuaiqms_inspection_records" ("inspection_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_status_6de90b" ON "apps_kuaiqms_inspection_records" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_created_f86152" ON "apps_kuaiqms_inspection_records" ("created_at");
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."record_no" IS '检验记录编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."task_id" IS '检验任务ID（关联InspectionTask）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."task_uuid" IS '检验任务UUID';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."inspection_type" IS '检验类型（来料检验、过程检验、成品检验、委外来料检验）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."material_id" IS '物料ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."material_name" IS '物料名称';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."batch_no" IS '批次号（可选）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."serial_no" IS '序列号（可选）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."quantity" IS '检验数量';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."qualified_quantity" IS '合格数量';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."defective_quantity" IS '不合格数量';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."inspection_result" IS '检验结果（合格、不合格、让步接收）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."inspection_date" IS '检验日期';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."inspector_id" IS '检验员ID（用户ID）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."inspector_name" IS '检验员姓名';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."inspection_standard_id" IS '检验标准ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."inspection_standard_name" IS '检验标准名称';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."inspection_data" IS '检验数据（JSON格式，存储检验项和检验值）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."status" IS '记录状态（草稿、已确认、已审核）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaiqms_inspection_records" IS 'QMS质量检验记录表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaiqms_nonconforming_products" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "record_no" VARCHAR(50) NOT NULL,
    "source_type" VARCHAR(50),
    "source_id" INT,
    "source_no" VARCHAR(50),
    "material_id" INT NOT NULL,
    "material_name" VARCHAR(200) NOT NULL,
    "batch_no" VARCHAR(50),
    "serial_no" VARCHAR(50),
    "quantity" DECIMAL(18,4) NOT NULL,
    "defect_type" INT,
    "defect_type_name" VARCHAR(200),
    "defect_description" TEXT NOT NULL,
    "defect_cause" TEXT,
    "impact_assessment" VARCHAR(20),
    "impact_scope" TEXT,
    "status" VARCHAR(50) NOT NULL  DEFAULT '待处理',
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaiqm_tenant__7f3e44" UNIQUE ("tenant_id", "record_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_tenant__5376ce" ON "apps_kuaiqms_nonconforming_products" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_record__41394a" ON "apps_kuaiqms_nonconforming_products" ("record_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_uuid_738737" ON "apps_kuaiqms_nonconforming_products" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_source__2c0844" ON "apps_kuaiqms_nonconforming_products" ("source_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_source__dd225d" ON "apps_kuaiqms_nonconforming_products" ("source_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_source__606e2b" ON "apps_kuaiqms_nonconforming_products" ("source_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_materia_1e08e0" ON "apps_kuaiqms_nonconforming_products" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_batch_n_fd8fd9" ON "apps_kuaiqms_nonconforming_products" ("batch_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_serial__a8c300" ON "apps_kuaiqms_nonconforming_products" ("serial_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_defect__80eefe" ON "apps_kuaiqms_nonconforming_products" ("defect_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_status_5279c0" ON "apps_kuaiqms_nonconforming_products" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_created_c34853" ON "apps_kuaiqms_nonconforming_products" ("created_at");
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."record_no" IS '不合格品记录编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."source_type" IS '来源类型（检验记录、生产报工、客户投诉等）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."source_id" IS '来源ID';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."source_no" IS '来源编号';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."material_id" IS '物料ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."material_name" IS '物料名称';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."batch_no" IS '批次号（可选）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."serial_no" IS '序列号（可选）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."quantity" IS '不合格数量';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."defect_type" IS '缺陷类型（关联master-data）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."defect_type_name" IS '缺陷类型名称';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."defect_description" IS '缺陷描述';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."defect_cause" IS '缺陷原因';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."impact_assessment" IS '影响评估（高、中、低）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."impact_scope" IS '影响范围描述';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."status" IS '记录状态（待处理、处理中、已处理、已关闭）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaiqms_nonconforming_products" IS 'QMS不合格品记录表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaiqms_nonconforming_handlings" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "handling_no" VARCHAR(50) NOT NULL,
    "nonconforming_product_id" INT,
    "nonconforming_product_uuid" VARCHAR(36),
    "handling_type" VARCHAR(50) NOT NULL,
    "handling_plan" TEXT NOT NULL,
    "handling_executor_id" INT,
    "handling_executor_name" VARCHAR(100),
    "handling_date" TIMESTAMPTZ,
    "handling_result" VARCHAR(50),
    "handling_quantity" DECIMAL(18,4),
    "status" VARCHAR(50) NOT NULL  DEFAULT '待处理',
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaiqm_tenant__c30ed4" UNIQUE ("tenant_id", "handling_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_tenant__4cfa71" ON "apps_kuaiqms_nonconforming_handlings" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_handlin_85244c" ON "apps_kuaiqms_nonconforming_handlings" ("handling_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_uuid_5334be" ON "apps_kuaiqms_nonconforming_handlings" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_nonconf_6a41a3" ON "apps_kuaiqms_nonconforming_handlings" ("nonconforming_product_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_nonconf_58d33f" ON "apps_kuaiqms_nonconforming_handlings" ("nonconforming_product_uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_handlin_710107" ON "apps_kuaiqms_nonconforming_handlings" ("handling_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_handlin_42dca5" ON "apps_kuaiqms_nonconforming_handlings" ("handling_executor_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_status_fe9f4d" ON "apps_kuaiqms_nonconforming_handlings" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_handlin_ce328d" ON "apps_kuaiqms_nonconforming_handlings" ("handling_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_created_72046f" ON "apps_kuaiqms_nonconforming_handlings" ("created_at");
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_handlings"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_handlings"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_handlings"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_handlings"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_handlings"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_handlings"."handling_no" IS '处理单编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_handlings"."nonconforming_product_id" IS '不合格品记录ID（关联NonconformingProduct）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_handlings"."nonconforming_product_uuid" IS '不合格品记录UUID';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_handlings"."handling_type" IS '处理类型（返工、返修、报废、让步接收）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_handlings"."handling_plan" IS '处理方案';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_handlings"."handling_executor_id" IS '处理执行人ID（用户ID）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_handlings"."handling_executor_name" IS '处理执行人姓名';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_handlings"."handling_date" IS '处理日期';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_handlings"."handling_result" IS '处理结果（成功、失败、部分成功）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_handlings"."handling_quantity" IS '处理数量';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_handlings"."status" IS '处理状态（待处理、处理中、已完成、已关闭）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_handlings"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_handlings"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaiqms_nonconforming_handlings" IS 'QMS不合格品处理表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaiqms_quality_traceabilities" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "trace_no" VARCHAR(50) NOT NULL,
    "trace_type" VARCHAR(50) NOT NULL,
    "batch_no" VARCHAR(50),
    "serial_no" VARCHAR(50),
    "material_id" INT NOT NULL,
    "material_name" VARCHAR(200) NOT NULL,
    "trace_data" JSONB,
    "status" VARCHAR(50) NOT NULL  DEFAULT '有效',
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaiqm_tenant__148943" UNIQUE ("tenant_id", "trace_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_tenant__f5692e" ON "apps_kuaiqms_quality_traceabilities" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_trace_n_635177" ON "apps_kuaiqms_quality_traceabilities" ("trace_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_uuid_ad4797" ON "apps_kuaiqms_quality_traceabilities" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_trace_t_9b1d35" ON "apps_kuaiqms_quality_traceabilities" ("trace_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_batch_n_dbb189" ON "apps_kuaiqms_quality_traceabilities" ("batch_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_serial__6ca36e" ON "apps_kuaiqms_quality_traceabilities" ("serial_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_materia_a802d1" ON "apps_kuaiqms_quality_traceabilities" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_status_283437" ON "apps_kuaiqms_quality_traceabilities" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_created_d70d9f" ON "apps_kuaiqms_quality_traceabilities" ("created_at");
COMMENT ON COLUMN "apps_kuaiqms_quality_traceabilities"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaiqms_quality_traceabilities"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaiqms_quality_traceabilities"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaiqms_quality_traceabilities"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaiqms_quality_traceabilities"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaiqms_quality_traceabilities"."trace_no" IS '追溯编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaiqms_quality_traceabilities"."trace_type" IS '追溯类型（批次追溯、序列号追溯、质量档案）';
COMMENT ON COLUMN "apps_kuaiqms_quality_traceabilities"."batch_no" IS '批次号（可选）';
COMMENT ON COLUMN "apps_kuaiqms_quality_traceabilities"."serial_no" IS '序列号（可选）';
COMMENT ON COLUMN "apps_kuaiqms_quality_traceabilities"."material_id" IS '物料ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaiqms_quality_traceabilities"."material_name" IS '物料名称';
COMMENT ON COLUMN "apps_kuaiqms_quality_traceabilities"."trace_data" IS '追溯数据（JSON格式，存储追溯路径和相关信息）';
COMMENT ON COLUMN "apps_kuaiqms_quality_traceabilities"."status" IS '追溯状态（有效、已关闭）';
COMMENT ON COLUMN "apps_kuaiqms_quality_traceabilities"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaiqms_quality_traceabilities"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaiqms_quality_traceabilities" IS 'QMS质量追溯表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaiqms_iso_audits" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "audit_no" VARCHAR(50) NOT NULL,
    "audit_type" VARCHAR(50) NOT NULL,
    "iso_standard" VARCHAR(100),
    "audit_scope" TEXT,
    "audit_date" TIMESTAMPTZ,
    "auditor_id" INT,
    "auditor_name" VARCHAR(100),
    "audit_result" VARCHAR(50),
    "findings" JSONB,
    "status" VARCHAR(50) NOT NULL  DEFAULT '计划中',
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaiqm_tenant__2d5085" UNIQUE ("tenant_id", "audit_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_tenant__24b3ac" ON "apps_kuaiqms_iso_audits" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_audit_n_8d7a23" ON "apps_kuaiqms_iso_audits" ("audit_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_uuid_4199f5" ON "apps_kuaiqms_iso_audits" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_audit_t_03712e" ON "apps_kuaiqms_iso_audits" ("audit_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_iso_sta_19f59e" ON "apps_kuaiqms_iso_audits" ("iso_standard");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_auditor_6ce518" ON "apps_kuaiqms_iso_audits" ("auditor_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_audit_r_22eb8d" ON "apps_kuaiqms_iso_audits" ("audit_result");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_status_28f0c4" ON "apps_kuaiqms_iso_audits" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_audit_d_bf87c1" ON "apps_kuaiqms_iso_audits" ("audit_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_created_4d5edc" ON "apps_kuaiqms_iso_audits" ("created_at");
COMMENT ON COLUMN "apps_kuaiqms_iso_audits"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaiqms_iso_audits"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaiqms_iso_audits"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaiqms_iso_audits"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaiqms_iso_audits"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaiqms_iso_audits"."audit_no" IS '审核编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaiqms_iso_audits"."audit_type" IS '审核类型（内审、外审）';
COMMENT ON COLUMN "apps_kuaiqms_iso_audits"."iso_standard" IS 'ISO标准（ISO 9001、ISO 14001、ISO 45001、IATF 16949等）';
COMMENT ON COLUMN "apps_kuaiqms_iso_audits"."audit_scope" IS '审核范围';
COMMENT ON COLUMN "apps_kuaiqms_iso_audits"."audit_date" IS '审核日期';
COMMENT ON COLUMN "apps_kuaiqms_iso_audits"."auditor_id" IS '审核员ID（用户ID）';
COMMENT ON COLUMN "apps_kuaiqms_iso_audits"."auditor_name" IS '审核员姓名';
COMMENT ON COLUMN "apps_kuaiqms_iso_audits"."audit_result" IS '审核结果（通过、不通过、待整改）';
COMMENT ON COLUMN "apps_kuaiqms_iso_audits"."findings" IS '审核发现（JSON格式，存储审核问题和整改项）';
COMMENT ON COLUMN "apps_kuaiqms_iso_audits"."status" IS '审核状态（计划中、执行中、已完成、已关闭）';
COMMENT ON COLUMN "apps_kuaiqms_iso_audits"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaiqms_iso_audits"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaiqms_iso_audits" IS 'QMS ISO质量审核表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaiqms_capas" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "capa_no" VARCHAR(50) NOT NULL,
    "capa_type" VARCHAR(50) NOT NULL,
    "source_type" VARCHAR(50),
    "source_id" INT,
    "source_no" VARCHAR(50),
    "problem_description" TEXT NOT NULL,
    "root_cause" TEXT,
    "corrective_action" TEXT,
    "preventive_action" TEXT,
    "responsible_person_id" INT,
    "responsible_person_name" VARCHAR(100),
    "planned_completion_date" TIMESTAMPTZ,
    "actual_completion_date" TIMESTAMPTZ,
    "effectiveness_evaluation" TEXT,
    "status" VARCHAR(50) NOT NULL  DEFAULT '待执行',
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaiqm_tenant__15922a" UNIQUE ("tenant_id", "capa_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_tenant__1e7ef8" ON "apps_kuaiqms_capas" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_capa_no_f096fc" ON "apps_kuaiqms_capas" ("capa_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_uuid_9755ef" ON "apps_kuaiqms_capas" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_capa_ty_30a9c8" ON "apps_kuaiqms_capas" ("capa_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_source__1aad88" ON "apps_kuaiqms_capas" ("source_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_source__772e18" ON "apps_kuaiqms_capas" ("source_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_source__7412d9" ON "apps_kuaiqms_capas" ("source_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_respons_8d59c5" ON "apps_kuaiqms_capas" ("responsible_person_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_status_e3d17d" ON "apps_kuaiqms_capas" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_planned_39421b" ON "apps_kuaiqms_capas" ("planned_completion_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_created_7fd426" ON "apps_kuaiqms_capas" ("created_at");
COMMENT ON COLUMN "apps_kuaiqms_capas"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaiqms_capas"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaiqms_capas"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaiqms_capas"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaiqms_capas"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaiqms_capas"."capa_no" IS 'CAPA编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaiqms_capas"."capa_type" IS 'CAPA类型（纠正措施、预防措施）';
COMMENT ON COLUMN "apps_kuaiqms_capas"."source_type" IS '来源类型（审核发现、不合格品、客户投诉等）';
COMMENT ON COLUMN "apps_kuaiqms_capas"."source_id" IS '来源ID';
COMMENT ON COLUMN "apps_kuaiqms_capas"."source_no" IS '来源编号';
COMMENT ON COLUMN "apps_kuaiqms_capas"."problem_description" IS '问题描述';
COMMENT ON COLUMN "apps_kuaiqms_capas"."root_cause" IS '根本原因';
COMMENT ON COLUMN "apps_kuaiqms_capas"."corrective_action" IS '纠正措施';
COMMENT ON COLUMN "apps_kuaiqms_capas"."preventive_action" IS '预防措施';
COMMENT ON COLUMN "apps_kuaiqms_capas"."responsible_person_id" IS '负责人ID（用户ID）';
COMMENT ON COLUMN "apps_kuaiqms_capas"."responsible_person_name" IS '负责人姓名';
COMMENT ON COLUMN "apps_kuaiqms_capas"."planned_completion_date" IS '计划完成日期';
COMMENT ON COLUMN "apps_kuaiqms_capas"."actual_completion_date" IS '实际完成日期';
COMMENT ON COLUMN "apps_kuaiqms_capas"."effectiveness_evaluation" IS '有效性评估';
COMMENT ON COLUMN "apps_kuaiqms_capas"."status" IS 'CAPA状态（待执行、执行中、已完成、已关闭）';
COMMENT ON COLUMN "apps_kuaiqms_capas"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaiqms_capas"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaiqms_capas" IS 'QMS CAPA（纠正预防措施）表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaiqms_continuous_improvements" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "improvement_no" VARCHAR(50) NOT NULL,
    "improvement_type" VARCHAR(50) NOT NULL,
    "improvement_title" VARCHAR(200) NOT NULL,
    "improvement_description" TEXT NOT NULL,
    "improvement_plan" TEXT,
    "responsible_person_id" INT,
    "responsible_person_name" VARCHAR(100),
    "planned_start_date" TIMESTAMPTZ,
    "planned_end_date" TIMESTAMPTZ,
    "actual_start_date" TIMESTAMPTZ,
    "actual_end_date" TIMESTAMPTZ,
    "improvement_result" TEXT,
    "effectiveness_evaluation" TEXT,
    "status" VARCHAR(50) NOT NULL  DEFAULT '计划中',
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaiqm_tenant__1c44cc" UNIQUE ("tenant_id", "improvement_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_tenant__562fdc" ON "apps_kuaiqms_continuous_improvements" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_improve_2ee34d" ON "apps_kuaiqms_continuous_improvements" ("improvement_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_uuid_41d553" ON "apps_kuaiqms_continuous_improvements" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_improve_dfc703" ON "apps_kuaiqms_continuous_improvements" ("improvement_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_respons_6ca32f" ON "apps_kuaiqms_continuous_improvements" ("responsible_person_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_status_e40e4a" ON "apps_kuaiqms_continuous_improvements" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_planned_2cd73c" ON "apps_kuaiqms_continuous_improvements" ("planned_start_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_planned_815550" ON "apps_kuaiqms_continuous_improvements" ("planned_end_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_created_859e47" ON "apps_kuaiqms_continuous_improvements" ("created_at");
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."improvement_no" IS '改进编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."improvement_type" IS '改进类型（流程改进、质量改进、效率改进等）';
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."improvement_title" IS '改进标题';
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."improvement_description" IS '改进描述';
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."improvement_plan" IS '改进计划';
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."responsible_person_id" IS '负责人ID（用户ID）';
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."responsible_person_name" IS '负责人姓名';
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."planned_start_date" IS '计划开始日期';
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."planned_end_date" IS '计划结束日期';
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."actual_start_date" IS '实际开始日期';
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."actual_end_date" IS '实际结束日期';
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."improvement_result" IS '改进结果';
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."effectiveness_evaluation" IS '有效性评估';
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."status" IS '改进状态（计划中、执行中、已完成、已关闭）';
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaiqms_continuous_improvements" IS 'QMS持续改进表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaiqms_quality_objectives" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "objective_no" VARCHAR(50) NOT NULL,
    "objective_name" VARCHAR(200) NOT NULL,
    "objective_description" TEXT,
    "target_value" DECIMAL(18,4) NOT NULL,
    "current_value" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "unit" VARCHAR(50),
    "period" VARCHAR(50) NOT NULL,
    "period_start_date" TIMESTAMPTZ,
    "period_end_date" TIMESTAMPTZ,
    "responsible_person_id" INT,
    "responsible_person_name" VARCHAR(100),
    "achievement_rate" DECIMAL(5,2) NOT NULL  DEFAULT 0,
    "status" VARCHAR(50) NOT NULL  DEFAULT '进行中',
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaiqm_tenant__b9b190" UNIQUE ("tenant_id", "objective_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_tenant__589b0b" ON "apps_kuaiqms_quality_objectives" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_objecti_3a18b8" ON "apps_kuaiqms_quality_objectives" ("objective_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_uuid_d07c00" ON "apps_kuaiqms_quality_objectives" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_period_9de87e" ON "apps_kuaiqms_quality_objectives" ("period");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_respons_06eab9" ON "apps_kuaiqms_quality_objectives" ("responsible_person_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_status_7f5654" ON "apps_kuaiqms_quality_objectives" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_period__4be7b4" ON "apps_kuaiqms_quality_objectives" ("period_start_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_period__51c399" ON "apps_kuaiqms_quality_objectives" ("period_end_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_created_6ef8dd" ON "apps_kuaiqms_quality_objectives" ("created_at");
COMMENT ON COLUMN "apps_kuaiqms_quality_objectives"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaiqms_quality_objectives"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaiqms_quality_objectives"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaiqms_quality_objectives"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaiqms_quality_objectives"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaiqms_quality_objectives"."objective_no" IS '目标编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaiqms_quality_objectives"."objective_name" IS '目标名称';
COMMENT ON COLUMN "apps_kuaiqms_quality_objectives"."objective_description" IS '目标描述';
COMMENT ON COLUMN "apps_kuaiqms_quality_objectives"."target_value" IS '目标值';
COMMENT ON COLUMN "apps_kuaiqms_quality_objectives"."current_value" IS '当前值';
COMMENT ON COLUMN "apps_kuaiqms_quality_objectives"."unit" IS '单位';
COMMENT ON COLUMN "apps_kuaiqms_quality_objectives"."period" IS '周期（年度、季度、月度）';
COMMENT ON COLUMN "apps_kuaiqms_quality_objectives"."period_start_date" IS '周期开始日期';
COMMENT ON COLUMN "apps_kuaiqms_quality_objectives"."period_end_date" IS '周期结束日期';
COMMENT ON COLUMN "apps_kuaiqms_quality_objectives"."responsible_person_id" IS '负责人ID（用户ID）';
COMMENT ON COLUMN "apps_kuaiqms_quality_objectives"."responsible_person_name" IS '负责人姓名';
COMMENT ON COLUMN "apps_kuaiqms_quality_objectives"."achievement_rate" IS '达成率（百分比）';
COMMENT ON COLUMN "apps_kuaiqms_quality_objectives"."status" IS '目标状态（进行中、已完成、未达成、已关闭）';
COMMENT ON COLUMN "apps_kuaiqms_quality_objectives"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaiqms_quality_objectives"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaiqms_quality_objectives" IS 'QMS质量目标表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaiqms_quality_indicators" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "indicator_no" VARCHAR(50) NOT NULL,
    "indicator_name" VARCHAR(200) NOT NULL,
    "indicator_description" TEXT,
    "indicator_type" VARCHAR(100) NOT NULL,
    "target_value" DECIMAL(18,4),
    "current_value" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "unit" VARCHAR(50),
    "calculation_method" TEXT,
    "data_source" VARCHAR(200),
    "monitoring_frequency" VARCHAR(50),
    "alert_threshold" DECIMAL(18,4),
    "status" VARCHAR(50) NOT NULL  DEFAULT '启用',
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaiqm_tenant__2840f6" UNIQUE ("tenant_id", "indicator_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_tenant__8de2fd" ON "apps_kuaiqms_quality_indicators" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_indicat_e5f3a9" ON "apps_kuaiqms_quality_indicators" ("indicator_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_uuid_3b07ed" ON "apps_kuaiqms_quality_indicators" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_indicat_4baca0" ON "apps_kuaiqms_quality_indicators" ("indicator_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_status_2da102" ON "apps_kuaiqms_quality_indicators" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_created_3a906b" ON "apps_kuaiqms_quality_indicators" ("created_at");
COMMENT ON COLUMN "apps_kuaiqms_quality_indicators"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaiqms_quality_indicators"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaiqms_quality_indicators"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaiqms_quality_indicators"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaiqms_quality_indicators"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaiqms_quality_indicators"."indicator_no" IS '指标编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaiqms_quality_indicators"."indicator_name" IS '指标名称';
COMMENT ON COLUMN "apps_kuaiqms_quality_indicators"."indicator_description" IS '指标描述';
COMMENT ON COLUMN "apps_kuaiqms_quality_indicators"."indicator_type" IS '指标类型（来料合格率、过程合格率、成品合格率等）';
COMMENT ON COLUMN "apps_kuaiqms_quality_indicators"."target_value" IS '目标值';
COMMENT ON COLUMN "apps_kuaiqms_quality_indicators"."current_value" IS '当前值';
COMMENT ON COLUMN "apps_kuaiqms_quality_indicators"."unit" IS '单位';
COMMENT ON COLUMN "apps_kuaiqms_quality_indicators"."calculation_method" IS '计算方法';
COMMENT ON COLUMN "apps_kuaiqms_quality_indicators"."data_source" IS '数据来源';
COMMENT ON COLUMN "apps_kuaiqms_quality_indicators"."monitoring_frequency" IS '监控频率（每日、每周、每月）';
COMMENT ON COLUMN "apps_kuaiqms_quality_indicators"."alert_threshold" IS '预警阈值';
COMMENT ON COLUMN "apps_kuaiqms_quality_indicators"."status" IS '指标状态（启用、停用）';
COMMENT ON COLUMN "apps_kuaiqms_quality_indicators"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaiqms_quality_indicators"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaiqms_quality_indicators" IS 'QMS质量指标表';;

-- 来自: 51_20251215142238_create_eam_models.py
CREATE TABLE IF NOT EXISTS "apps_kuaieam_maintenance_plans" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "plan_no" VARCHAR(100) NOT NULL,
    "plan_name" VARCHAR(200) NOT NULL,
    "equipment_id" INT NOT NULL,
    "equipment_name" VARCHAR(200) NOT NULL,
    "plan_type" VARCHAR(50) NOT NULL,
    "maintenance_type" VARCHAR(50) NOT NULL,
    "cycle_type" VARCHAR(50) NOT NULL,
    "cycle_value" INT,
    "cycle_unit" VARCHAR(20),
    "planned_start_date" TIMESTAMPTZ,
    "planned_end_date" TIMESTAMPTZ,
    "responsible_person_id" INT,
    "responsible_person_name" VARCHAR(100),
    "status" VARCHAR(50) NOT NULL  DEFAULT '草稿',
    "remark" TEXT,
    CONSTRAINT "uid_apps_kuaiea_tenant__427961" UNIQUE ("tenant_id", "plan_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_tenant__166777" ON "apps_kuaieam_maintenance_plans" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_plan_no_8fd146" ON "apps_kuaieam_maintenance_plans" ("plan_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_equipme_266a82" ON "apps_kuaieam_maintenance_plans" ("equipment_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_status_afe02b" ON "apps_kuaieam_maintenance_plans" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_planned_3f8ded" ON "apps_kuaieam_maintenance_plans" ("planned_start_date");
COMMENT ON COLUMN "apps_kuaieam_maintenance_plans"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_plans"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_plans"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_plans"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_plans"."plan_no" IS '维护计划编号';
COMMENT ON COLUMN "apps_kuaieam_maintenance_plans"."plan_name" IS '计划名称';
COMMENT ON COLUMN "apps_kuaieam_maintenance_plans"."equipment_id" IS '设备ID';
COMMENT ON COLUMN "apps_kuaieam_maintenance_plans"."equipment_name" IS '设备名称';
COMMENT ON COLUMN "apps_kuaieam_maintenance_plans"."plan_type" IS '计划类型（预防性维护、定期维护、临时维护）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_plans"."maintenance_type" IS '维护类型（日常保养、小修、中修、大修）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_plans"."cycle_type" IS '周期类型（按时间、按运行时长、按使用次数）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_plans"."cycle_value" IS '周期值';
COMMENT ON COLUMN "apps_kuaieam_maintenance_plans"."cycle_unit" IS '周期单位（天、小时、次）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_plans"."planned_start_date" IS '计划开始日期';
COMMENT ON COLUMN "apps_kuaieam_maintenance_plans"."planned_end_date" IS '计划结束日期';
COMMENT ON COLUMN "apps_kuaieam_maintenance_plans"."responsible_person_id" IS '负责人ID';
COMMENT ON COLUMN "apps_kuaieam_maintenance_plans"."responsible_person_name" IS '负责人姓名';
COMMENT ON COLUMN "apps_kuaieam_maintenance_plans"."status" IS '计划状态';
COMMENT ON COLUMN "apps_kuaieam_maintenance_plans"."remark" IS '备注';
COMMENT ON TABLE "apps_kuaieam_maintenance_plans" IS 'EAM维护计划表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaieam_maintenance_workorders" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "workorder_no" VARCHAR(100) NOT NULL,
    "plan_id" INT,
    "plan_uuid" VARCHAR(36),
    "equipment_id" INT NOT NULL,
    "equipment_name" VARCHAR(200) NOT NULL,
    "workorder_type" VARCHAR(50) NOT NULL,
    "maintenance_type" VARCHAR(50) NOT NULL,
    "priority" VARCHAR(20) NOT NULL  DEFAULT '中',
    "planned_start_date" TIMESTAMPTZ,
    "planned_end_date" TIMESTAMPTZ,
    "actual_start_date" TIMESTAMPTZ,
    "actual_end_date" TIMESTAMPTZ,
    "assigned_person_id" INT,
    "assigned_person_name" VARCHAR(100),
    "executor_id" INT,
    "executor_name" VARCHAR(100),
    "status" VARCHAR(50) NOT NULL  DEFAULT '待分配',
    "remark" TEXT,
    CONSTRAINT "uid_apps_kuaiea_tenant__1cde53" UNIQUE ("tenant_id", "workorder_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_tenant__651cf7" ON "apps_kuaieam_maintenance_workorders" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_workord_0c8506" ON "apps_kuaieam_maintenance_workorders" ("workorder_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_plan_id_29153c" ON "apps_kuaieam_maintenance_workorders" ("plan_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_equipme_af9d18" ON "apps_kuaieam_maintenance_workorders" ("equipment_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_status_e1cf16" ON "apps_kuaieam_maintenance_workorders" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_planned_b7c060" ON "apps_kuaieam_maintenance_workorders" ("planned_start_date");
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."workorder_no" IS '工单编号';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."plan_id" IS '维护计划ID';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."plan_uuid" IS '维护计划UUID';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."equipment_id" IS '设备ID';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."equipment_name" IS '设备名称';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."workorder_type" IS '工单类型（计划维护、故障维修、临时维护）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."maintenance_type" IS '维护类型（日常保养、小修、中修、大修）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."priority" IS '优先级（高、中、低）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."planned_start_date" IS '计划开始时间';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."planned_end_date" IS '计划结束时间';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."actual_start_date" IS '实际开始时间';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."actual_end_date" IS '实际结束时间';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."assigned_person_id" IS '分配人员ID';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."assigned_person_name" IS '分配人员姓名';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."executor_id" IS '执行人员ID';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."executor_name" IS '执行人员姓名';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."status" IS '工单状态';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."remark" IS '备注';
COMMENT ON TABLE "apps_kuaieam_maintenance_workorders" IS 'EAM维护工单表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaieam_maintenance_executions" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "execution_no" VARCHAR(100) NOT NULL,
    "workorder_id" INT,
    "workorder_uuid" VARCHAR(36),
    "equipment_id" INT NOT NULL,
    "equipment_name" VARCHAR(200) NOT NULL,
    "execution_date" TIMESTAMPTZ NOT NULL,
    "executor_id" INT,
    "executor_name" VARCHAR(100),
    "execution_content" TEXT,
    "execution_result" VARCHAR(50),
    "maintenance_cost" DECIMAL(10,2),
    "spare_parts_used" JSONB,
    "status" VARCHAR(50) NOT NULL  DEFAULT '草稿',
    "acceptance_person_id" INT,
    "acceptance_person_name" VARCHAR(100),
    "acceptance_date" TIMESTAMPTZ,
    "acceptance_result" VARCHAR(50),
    "remark" TEXT,
    CONSTRAINT "uid_apps_kuaiea_tenant__a895ca" UNIQUE ("tenant_id", "execution_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_tenant__018412" ON "apps_kuaieam_maintenance_executions" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_executi_26c787" ON "apps_kuaieam_maintenance_executions" ("execution_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_workord_885717" ON "apps_kuaieam_maintenance_executions" ("workorder_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_equipme_1cabe7" ON "apps_kuaieam_maintenance_executions" ("equipment_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_executi_8ae746" ON "apps_kuaieam_maintenance_executions" ("execution_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_status_eadcca" ON "apps_kuaieam_maintenance_executions" ("status");
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."execution_no" IS '执行记录编号';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."workorder_id" IS '维护工单ID';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."workorder_uuid" IS '维护工单UUID';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."equipment_id" IS '设备ID';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."equipment_name" IS '设备名称';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."execution_date" IS '执行日期';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."executor_id" IS '执行人员ID';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."executor_name" IS '执行人员姓名';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."execution_content" IS '执行内容';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."execution_result" IS '执行结果（正常、异常、待处理）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."maintenance_cost" IS '维护成本';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."spare_parts_used" IS '使用备件（JSON格式）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."status" IS '记录状态';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."acceptance_person_id" IS '验收人员ID';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."acceptance_person_name" IS '验收人员姓名';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."acceptance_date" IS '验收日期';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."acceptance_result" IS '验收结果（合格、不合格）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."remark" IS '备注';
COMMENT ON TABLE "apps_kuaieam_maintenance_executions" IS 'EAM维护执行记录表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaieam_failure_reports" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "report_no" VARCHAR(100) NOT NULL,
    "equipment_id" INT NOT NULL,
    "equipment_name" VARCHAR(200) NOT NULL,
    "failure_type" VARCHAR(50) NOT NULL,
    "failure_level" VARCHAR(20) NOT NULL  DEFAULT '一般',
    "failure_description" TEXT NOT NULL,
    "reporter_id" INT,
    "reporter_name" VARCHAR(100),
    "report_date" TIMESTAMPTZ NOT NULL,
    "assigned_person_id" INT,
    "assigned_person_name" VARCHAR(100),
    "assigned_date" TIMESTAMPTZ,
    "status" VARCHAR(50) NOT NULL  DEFAULT '待分配',
    "remark" TEXT,
    CONSTRAINT "uid_apps_kuaiea_tenant__e64673" UNIQUE ("tenant_id", "report_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_tenant__18edd7" ON "apps_kuaieam_failure_reports" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_report__5c5e90" ON "apps_kuaieam_failure_reports" ("report_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_equipme_f33727" ON "apps_kuaieam_failure_reports" ("equipment_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_failure_3cc66e" ON "apps_kuaieam_failure_reports" ("failure_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_failure_39a18a" ON "apps_kuaieam_failure_reports" ("failure_level");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_status_50934b" ON "apps_kuaieam_failure_reports" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_report__d92a20" ON "apps_kuaieam_failure_reports" ("report_date");
COMMENT ON COLUMN "apps_kuaieam_failure_reports"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaieam_failure_reports"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaieam_failure_reports"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaieam_failure_reports"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaieam_failure_reports"."report_no" IS '报修单编号';
COMMENT ON COLUMN "apps_kuaieam_failure_reports"."equipment_id" IS '设备ID';
COMMENT ON COLUMN "apps_kuaieam_failure_reports"."equipment_name" IS '设备名称';
COMMENT ON COLUMN "apps_kuaieam_failure_reports"."failure_type" IS '故障类型（机械故障、电气故障、软件故障、其他）';
COMMENT ON COLUMN "apps_kuaieam_failure_reports"."failure_level" IS '故障等级（一般、严重、紧急）';
COMMENT ON COLUMN "apps_kuaieam_failure_reports"."failure_description" IS '故障描述';
COMMENT ON COLUMN "apps_kuaieam_failure_reports"."reporter_id" IS '报修人ID';
COMMENT ON COLUMN "apps_kuaieam_failure_reports"."reporter_name" IS '报修人姓名';
COMMENT ON COLUMN "apps_kuaieam_failure_reports"."report_date" IS '报修日期';
COMMENT ON COLUMN "apps_kuaieam_failure_reports"."assigned_person_id" IS '分配人员ID';
COMMENT ON COLUMN "apps_kuaieam_failure_reports"."assigned_person_name" IS '分配人员姓名';
COMMENT ON COLUMN "apps_kuaieam_failure_reports"."assigned_date" IS '分配日期';
COMMENT ON COLUMN "apps_kuaieam_failure_reports"."status" IS '报修状态';
COMMENT ON COLUMN "apps_kuaieam_failure_reports"."remark" IS '备注';
COMMENT ON TABLE "apps_kuaieam_failure_reports" IS 'EAM故障报修表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaieam_failure_handlings" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "handling_no" VARCHAR(100) NOT NULL,
    "report_id" INT,
    "report_uuid" VARCHAR(36),
    "equipment_id" INT NOT NULL,
    "equipment_name" VARCHAR(200) NOT NULL,
    "handling_start_date" TIMESTAMPTZ,
    "handling_end_date" TIMESTAMPTZ,
    "handler_id" INT,
    "handler_name" VARCHAR(100),
    "handling_method" TEXT,
    "handling_result" VARCHAR(50),
    "root_cause" TEXT,
    "handling_cost" DECIMAL(10,2),
    "spare_parts_used" JSONB,
    "status" VARCHAR(50) NOT NULL  DEFAULT '处理中',
    "acceptance_person_id" INT,
    "acceptance_person_name" VARCHAR(100),
    "acceptance_date" TIMESTAMPTZ,
    "acceptance_result" VARCHAR(50),
    "remark" TEXT,
    CONSTRAINT "uid_apps_kuaiea_tenant__31d606" UNIQUE ("tenant_id", "handling_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_tenant__d6043c" ON "apps_kuaieam_failure_handlings" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_handlin_0cb962" ON "apps_kuaieam_failure_handlings" ("handling_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_report__1230ca" ON "apps_kuaieam_failure_handlings" ("report_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_equipme_aee458" ON "apps_kuaieam_failure_handlings" ("equipment_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_status_f885be" ON "apps_kuaieam_failure_handlings" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_handlin_b102bd" ON "apps_kuaieam_failure_handlings" ("handling_start_date");
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."handling_no" IS '处理单编号';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."report_id" IS '故障报修ID';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."report_uuid" IS '故障报修UUID';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."equipment_id" IS '设备ID';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."equipment_name" IS '设备名称';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."handling_start_date" IS '处理开始时间';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."handling_end_date" IS '处理结束时间';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."handler_id" IS '处理人员ID';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."handler_name" IS '处理人员姓名';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."handling_method" IS '处理方法';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."handling_result" IS '处理结果（已修复、部分修复、无法修复、待确认）';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."root_cause" IS '根本原因';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."handling_cost" IS '处理成本';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."spare_parts_used" IS '使用备件（JSON格式）';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."status" IS '处理状态';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."acceptance_person_id" IS '验收人员ID';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."acceptance_person_name" IS '验收人员姓名';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."acceptance_date" IS '验收日期';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."acceptance_result" IS '验收结果（合格、不合格）';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."remark" IS '备注';
COMMENT ON TABLE "apps_kuaieam_failure_handlings" IS 'EAM故障处理表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaieam_spare_part_demands" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "demand_no" VARCHAR(100) NOT NULL,
    "source_type" VARCHAR(50),
    "source_id" INT,
    "source_no" VARCHAR(100),
    "material_id" INT NOT NULL,
    "material_name" VARCHAR(200) NOT NULL,
    "material_code" VARCHAR(100),
    "demand_quantity" INT NOT NULL,
    "demand_date" TIMESTAMPTZ NOT NULL,
    "required_date" TIMESTAMPTZ,
    "applicant_id" INT,
    "applicant_name" VARCHAR(100),
    "status" VARCHAR(50) NOT NULL  DEFAULT '草稿',
    "remark" TEXT,
    CONSTRAINT "uid_apps_kuaiea_tenant__dd52a6" UNIQUE ("tenant_id", "demand_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_tenant__764329" ON "apps_kuaieam_spare_part_demands" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_demand__2dd577" ON "apps_kuaieam_spare_part_demands" ("demand_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_source__9d294b" ON "apps_kuaieam_spare_part_demands" ("source_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_materia_5e26ad" ON "apps_kuaieam_spare_part_demands" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_status_1efd1f" ON "apps_kuaieam_spare_part_demands" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_demand__afc00d" ON "apps_kuaieam_spare_part_demands" ("demand_date");
COMMENT ON COLUMN "apps_kuaieam_spare_part_demands"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaieam_spare_part_demands"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaieam_spare_part_demands"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaieam_spare_part_demands"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaieam_spare_part_demands"."demand_no" IS '需求单编号';
COMMENT ON COLUMN "apps_kuaieam_spare_part_demands"."source_type" IS '来源类型（维护计划、故障维修、库存预警）';
COMMENT ON COLUMN "apps_kuaieam_spare_part_demands"."source_id" IS '来源ID';
COMMENT ON COLUMN "apps_kuaieam_spare_part_demands"."source_no" IS '来源编号';
COMMENT ON COLUMN "apps_kuaieam_spare_part_demands"."material_id" IS '物料ID';
COMMENT ON COLUMN "apps_kuaieam_spare_part_demands"."material_name" IS '物料名称';
COMMENT ON COLUMN "apps_kuaieam_spare_part_demands"."material_code" IS '物料编码';
COMMENT ON COLUMN "apps_kuaieam_spare_part_demands"."demand_quantity" IS '需求数量';
COMMENT ON COLUMN "apps_kuaieam_spare_part_demands"."demand_date" IS '需求日期';
COMMENT ON COLUMN "apps_kuaieam_spare_part_demands"."required_date" IS '要求到货日期';
COMMENT ON COLUMN "apps_kuaieam_spare_part_demands"."applicant_id" IS '申请人ID';
COMMENT ON COLUMN "apps_kuaieam_spare_part_demands"."applicant_name" IS '申请人姓名';
COMMENT ON COLUMN "apps_kuaieam_spare_part_demands"."status" IS '需求状态';
COMMENT ON COLUMN "apps_kuaieam_spare_part_demands"."remark" IS '备注';
COMMENT ON TABLE "apps_kuaieam_spare_part_demands" IS 'EAM备件需求表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaieam_spare_part_purchases" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "purchase_no" VARCHAR(100) NOT NULL,
    "demand_id" INT,
    "demand_uuid" VARCHAR(36),
    "material_id" INT NOT NULL,
    "material_name" VARCHAR(200) NOT NULL,
    "material_code" VARCHAR(100),
    "purchase_quantity" INT NOT NULL,
    "unit_price" DECIMAL(10,2),
    "total_amount" DECIMAL(10,2),
    "supplier_id" INT,
    "supplier_name" VARCHAR(200),
    "purchase_date" TIMESTAMPTZ NOT NULL,
    "expected_delivery_date" TIMESTAMPTZ,
    "actual_delivery_date" TIMESTAMPTZ,
    "purchaser_id" INT,
    "purchaser_name" VARCHAR(100),
    "status" VARCHAR(50) NOT NULL  DEFAULT '草稿',
    "remark" TEXT,
    CONSTRAINT "uid_apps_kuaiea_tenant__5e8bf2" UNIQUE ("tenant_id", "purchase_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_tenant__349ac3" ON "apps_kuaieam_spare_part_purchases" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_purchas_7a8ae0" ON "apps_kuaieam_spare_part_purchases" ("purchase_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_demand__9f19fe" ON "apps_kuaieam_spare_part_purchases" ("demand_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_materia_0c075f" ON "apps_kuaieam_spare_part_purchases" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_supplie_a73dbe" ON "apps_kuaieam_spare_part_purchases" ("supplier_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_status_0d321a" ON "apps_kuaieam_spare_part_purchases" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_purchas_544913" ON "apps_kuaieam_spare_part_purchases" ("purchase_date");
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."purchase_no" IS '采购单编号';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."demand_id" IS '备件需求ID';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."demand_uuid" IS '备件需求UUID';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."material_id" IS '物料ID';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."material_name" IS '物料名称';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."material_code" IS '物料编码';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."purchase_quantity" IS '采购数量';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."unit_price" IS '单价';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."total_amount" IS '总金额';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."supplier_id" IS '供应商ID';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."supplier_name" IS '供应商名称';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."purchase_date" IS '采购日期';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."expected_delivery_date" IS '预计到货日期';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."actual_delivery_date" IS '实际到货日期';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."purchaser_id" IS '采购人员ID';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."purchaser_name" IS '采购人员姓名';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."status" IS '采购状态';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."remark" IS '备注';
COMMENT ON TABLE "apps_kuaieam_spare_part_purchases" IS 'EAM备件采购表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaieam_tooling_usages" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "usage_no" VARCHAR(100) NOT NULL,
    "tooling_id" INT NOT NULL,
    "tooling_name" VARCHAR(200) NOT NULL,
    "tooling_code" VARCHAR(100),
    "source_type" VARCHAR(50),
    "source_id" INT,
    "source_no" VARCHAR(100),
    "usage_date" TIMESTAMPTZ NOT NULL,
    "usage_count" INT NOT NULL  DEFAULT 1,
    "total_usage_count" INT,
    "operator_id" INT,
    "operator_name" VARCHAR(100),
    "status" VARCHAR(50) NOT NULL  DEFAULT '使用中',
    "return_date" TIMESTAMPTZ,
    "remark" TEXT,
    CONSTRAINT "uid_apps_kuaiea_tenant__736d96" UNIQUE ("tenant_id", "usage_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_tenant__c7ed54" ON "apps_kuaieam_tooling_usages" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_usage_n_35c97b" ON "apps_kuaieam_tooling_usages" ("usage_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_tooling_ce7c40" ON "apps_kuaieam_tooling_usages" ("tooling_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_source__275318" ON "apps_kuaieam_tooling_usages" ("source_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_usage_d_6d2382" ON "apps_kuaieam_tooling_usages" ("usage_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_status_3c7646" ON "apps_kuaieam_tooling_usages" ("status");
COMMENT ON COLUMN "apps_kuaieam_tooling_usages"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaieam_tooling_usages"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaieam_tooling_usages"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaieam_tooling_usages"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaieam_tooling_usages"."usage_no" IS '使用记录编号';
COMMENT ON COLUMN "apps_kuaieam_tooling_usages"."tooling_id" IS '工装夹具ID';
COMMENT ON COLUMN "apps_kuaieam_tooling_usages"."tooling_name" IS '工装夹具名称';
COMMENT ON COLUMN "apps_kuaieam_tooling_usages"."tooling_code" IS '工装夹具编码';
COMMENT ON COLUMN "apps_kuaieam_tooling_usages"."source_type" IS '来源类型（生产订单、工单）';
COMMENT ON COLUMN "apps_kuaieam_tooling_usages"."source_id" IS '来源ID';
COMMENT ON COLUMN "apps_kuaieam_tooling_usages"."source_no" IS '来源编号';
COMMENT ON COLUMN "apps_kuaieam_tooling_usages"."usage_date" IS '使用日期';
COMMENT ON COLUMN "apps_kuaieam_tooling_usages"."usage_count" IS '使用次数';
COMMENT ON COLUMN "apps_kuaieam_tooling_usages"."total_usage_count" IS '累计使用次数';
COMMENT ON COLUMN "apps_kuaieam_tooling_usages"."operator_id" IS '操作人员ID';
COMMENT ON COLUMN "apps_kuaieam_tooling_usages"."operator_name" IS '操作人员姓名';
COMMENT ON COLUMN "apps_kuaieam_tooling_usages"."status" IS '使用状态';
COMMENT ON COLUMN "apps_kuaieam_tooling_usages"."return_date" IS '归还日期';
COMMENT ON COLUMN "apps_kuaieam_tooling_usages"."remark" IS '备注';
COMMENT ON TABLE "apps_kuaieam_tooling_usages" IS 'EAM工装夹具使用记录表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaieam_mold_usages" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "usage_no" VARCHAR(100) NOT NULL,
    "mold_id" INT NOT NULL,
    "mold_name" VARCHAR(200) NOT NULL,
    "mold_code" VARCHAR(100),
    "source_type" VARCHAR(50),
    "source_id" INT,
    "source_no" VARCHAR(100),
    "usage_date" TIMESTAMPTZ NOT NULL,
    "usage_count" INT NOT NULL  DEFAULT 1,
    "total_usage_count" INT,
    "operator_id" INT,
    "operator_name" VARCHAR(100),
    "status" VARCHAR(50) NOT NULL  DEFAULT '使用中',
    "return_date" TIMESTAMPTZ,
    "remark" TEXT,
    CONSTRAINT "uid_apps_kuaiea_tenant__5c7fe8" UNIQUE ("tenant_id", "usage_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_tenant__f9677f" ON "apps_kuaieam_mold_usages" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_usage_n_4f961f" ON "apps_kuaieam_mold_usages" ("usage_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_mold_id_1db37e" ON "apps_kuaieam_mold_usages" ("mold_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_source__913959" ON "apps_kuaieam_mold_usages" ("source_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_usage_d_873ac6" ON "apps_kuaieam_mold_usages" ("usage_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_status_9aa224" ON "apps_kuaieam_mold_usages" ("status");
COMMENT ON COLUMN "apps_kuaieam_mold_usages"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaieam_mold_usages"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaieam_mold_usages"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaieam_mold_usages"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaieam_mold_usages"."usage_no" IS '使用记录编号';
COMMENT ON COLUMN "apps_kuaieam_mold_usages"."mold_id" IS '模具ID';
COMMENT ON COLUMN "apps_kuaieam_mold_usages"."mold_name" IS '模具名称';
COMMENT ON COLUMN "apps_kuaieam_mold_usages"."mold_code" IS '模具编码';
COMMENT ON COLUMN "apps_kuaieam_mold_usages"."source_type" IS '来源类型（生产订单、工单）';
COMMENT ON COLUMN "apps_kuaieam_mold_usages"."source_id" IS '来源ID';
COMMENT ON COLUMN "apps_kuaieam_mold_usages"."source_no" IS '来源编号';
COMMENT ON COLUMN "apps_kuaieam_mold_usages"."usage_date" IS '使用日期';
COMMENT ON COLUMN "apps_kuaieam_mold_usages"."usage_count" IS '使用次数';
COMMENT ON COLUMN "apps_kuaieam_mold_usages"."total_usage_count" IS '累计使用次数';
COMMENT ON COLUMN "apps_kuaieam_mold_usages"."operator_id" IS '操作人员ID';
COMMENT ON COLUMN "apps_kuaieam_mold_usages"."operator_name" IS '操作人员姓名';
COMMENT ON COLUMN "apps_kuaieam_mold_usages"."status" IS '使用状态';
COMMENT ON COLUMN "apps_kuaieam_mold_usages"."return_date" IS '归还日期';
COMMENT ON COLUMN "apps_kuaieam_mold_usages"."remark" IS '备注';
COMMENT ON TABLE "apps_kuaieam_mold_usages" IS 'EAM模具使用记录表';;

-- 来自: 52_20250116_rename_tables_to_infra_naming.py
-- 数据库表重命名迁移
        -- 统一为最新命名规范（platform_ → infra_, seed_ → apps_）
        
        -- ============================================
        -- 平台级表重命名 (platform_ → infra_)
        -- ============================================
        ALTER TABLE IF EXISTS "platform_superadmin" RENAME TO "infra_superadmin";
        ALTER TABLE IF EXISTS "platform_tenants" RENAME TO "infra_tenants";
        ALTER TABLE IF EXISTS "platform_tenant_configs" RENAME TO "infra_tenant_configs";
        ALTER TABLE IF EXISTS "platform_tenant_activity_logs" RENAME TO "infra_tenant_activity_logs";
        ALTER TABLE IF EXISTS "platform_packages" RENAME TO "infra_packages";
        
        -- ============================================
        -- 应用级表重命名 (seed_ → apps_)
        -- ============================================
        -- MES 相关表
        ALTER TABLE IF EXISTS "seed_kuaimes_orders" RENAME TO "apps_kuaimes_orders";
        ALTER TABLE IF EXISTS "seed_kuaimes_work_orders" RENAME TO "apps_kuaimes_work_orders";
        ALTER TABLE IF EXISTS "seed_kuaimes_production_reports" RENAME TO "apps_kuaimes_production_reports";
        ALTER TABLE IF EXISTS "seed_kuaimes_traceabilities" RENAME TO "apps_kuaimes_traceabilities";
        ALTER TABLE IF EXISTS "seed_kuaimes_rework_orders" RENAME TO "apps_kuaimes_rework_orders";
        
        -- QMS 相关表
        ALTER TABLE IF EXISTS "seed_kuaiqms_inspection_tasks" RENAME TO "apps_kuaiqms_inspection_tasks";
        ALTER TABLE IF EXISTS "seed_kuaiqms_inspection_records" RENAME TO "apps_kuaiqms_inspection_records";
        ALTER TABLE IF EXISTS "seed_kuaiqms_nonconforming_products" RENAME TO "apps_kuaiqms_nonconforming_products";
        ALTER TABLE IF EXISTS "seed_kuaiqms_nonconforming_handlings" RENAME TO "apps_kuaiqms_nonconforming_handlings";
        ALTER TABLE IF EXISTS "seed_kuaiqms_quality_traceabilities" RENAME TO "apps_kuaiqms_quality_traceabilities";
        ALTER TABLE IF EXISTS "seed_kuaiqms_iso_audits" RENAME TO "apps_kuaiqms_iso_audits";
        ALTER TABLE IF EXISTS "seed_kuaiqms_capas" RENAME TO "apps_kuaiqms_capas";
        ALTER TABLE IF EXISTS "seed_kuaiqms_continuous_improvements" RENAME TO "apps_kuaiqms_continuous_improvements";
        ALTER TABLE IF EXISTS "seed_kuaiqms_quality_objectives" RENAME TO "apps_kuaiqms_quality_objectives";
        ALTER TABLE IF EXISTS "seed_kuaiqms_quality_indicators" RENAME TO "apps_kuaiqms_quality_indicators";
        
        -- EAM 相关表
        ALTER TABLE IF EXISTS "seed_kuaieam_maintenance_plans" RENAME TO "apps_kuaieam_maintenance_plans";
        ALTER TABLE IF EXISTS "seed_kuaieam_maintenance_workorders" RENAME TO "apps_kuaieam_maintenance_workorders";
        ALTER TABLE IF EXISTS "seed_kuaieam_maintenance_executions" RENAME TO "apps_kuaieam_maintenance_executions";
        ALTER TABLE IF EXISTS "seed_kuaieam_failure_reports" RENAME TO "apps_kuaieam_failure_reports";
        ALTER TABLE IF EXISTS "seed_kuaieam_failure_handlings" RENAME TO "apps_kuaieam_failure_handlings";
        ALTER TABLE IF EXISTS "seed_kuaieam_spare_part_demands" RENAME TO "apps_kuaieam_spare_part_demands";
        ALTER TABLE IF EXISTS "seed_kuaieam_spare_part_purchases" RENAME TO "apps_kuaieam_spare_part_purchases";
        ALTER TABLE IF EXISTS "seed_kuaieam_tooling_usages" RENAME TO "apps_kuaieam_tooling_usages";
        ALTER TABLE IF EXISTS "seed_kuaieam_mold_usages" RENAME TO "apps_kuaieam_mold_usages";
        
        -- ============================================
        -- 系统级表重命名 (sys_ → core_，兼容别名)
        -- ============================================
        -- 注意：如果表已经是 core_ 前缀，则跳过
        -- 以下只处理可能存在的 sys_ 前缀表（兼容旧数据）
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

-- 来自: 53_20250116_rename_indexes_to_infra_naming.py
-- 数据库索引和约束重命名迁移
        -- 统一为最新命名规范（platform_ → infra_, seed_ → apps_）
        
        -- ============================================
        -- 重命名索引（平台级：platform_ → infra_）
        -- ============================================
        DO $$
        DECLARE
            idx_record RECORD;
            new_name TEXT;
        BEGIN
            FOR idx_record IN 
                SELECT indexname, tablename
                FROM pg_indexes 
                WHERE schemaname = 'public' 
                  AND indexname LIKE 'idx_platform_%'
            LOOP
                new_name := REPLACE(idx_record.indexname, 'idx_platform_', 'idx_infra_');
                -- 检查新名称是否已存在
                IF NOT EXISTS (
                    SELECT 1 FROM pg_indexes 
                    WHERE schemaname = 'public' AND indexname = new_name
                ) THEN
                    EXECUTE format('ALTER INDEX IF EXISTS %I RENAME TO %I', 
                        idx_record.indexname,
                        new_name
                    );
                END IF;
            END LOOP;
        END $$;
        
        -- ============================================
        -- 重命名索引（应用级：seed_ → apps_）
        -- ============================================
        DO $$
        DECLARE
            idx_record RECORD;
            new_name TEXT;
        BEGIN
            FOR idx_record IN 
                SELECT indexname, tablename
                FROM pg_indexes 
                WHERE schemaname = 'public' 
                  AND indexname LIKE 'idx_seed_%'
            LOOP
                new_name := REPLACE(idx_record.indexname, 'idx_seed_', 'idx_apps_');
                -- 检查新名称是否已存在
                IF NOT EXISTS (
                    SELECT 1 FROM pg_indexes 
                    WHERE schemaname = 'public' AND indexname = new_name
                ) THEN
                    EXECUTE format('ALTER INDEX IF EXISTS %I RENAME TO %I', 
                        idx_record.indexname,
                        new_name
                    );
                END IF;
            END LOOP;
        END $$;
        
        -- ============================================
        -- 重命名唯一索引（平台级：platform_ → infra_）
        -- ============================================
        DO $$
        DECLARE
            idx_record RECORD;
            new_name TEXT;
        BEGIN
            FOR idx_record IN 
                SELECT indexname, tablename
                FROM pg_indexes 
                WHERE schemaname = 'public' 
                  AND indexname LIKE 'uk_platform_%'
            LOOP
                new_name := REPLACE(idx_record.indexname, 'uk_platform_', 'uk_infra_');
                -- 检查新名称是否已存在
                IF NOT EXISTS (
                    SELECT 1 FROM pg_indexes 
                    WHERE schemaname = 'public' AND indexname = new_name
                ) THEN
                    EXECUTE format('ALTER INDEX IF EXISTS %I RENAME TO %I', 
                        idx_record.indexname,
                        new_name
                    );
                END IF;
            END LOOP;
        END $$;
        
        -- ============================================
        -- 重命名唯一索引（应用级：seed_ → apps_）
        -- ============================================
        DO $$
        DECLARE
            idx_record RECORD;
            new_name TEXT;
        BEGIN
            FOR idx_record IN 
                SELECT indexname, tablename
                FROM pg_indexes 
                WHERE schemaname = 'public' 
                  AND indexname LIKE 'uk_seed_%'
            LOOP
                new_name := REPLACE(idx_record.indexname, 'uk_seed_', 'uk_apps_');
                -- 检查新名称是否已存在
                IF NOT EXISTS (
                    SELECT 1 FROM pg_indexes 
                    WHERE schemaname = 'public' AND indexname = new_name
                ) THEN
                    EXECUTE format('ALTER INDEX IF EXISTS %I RENAME TO %I', 
                        idx_record.indexname,
                        new_name
                    );
                END IF;
            END LOOP;
        END $$;
        
        -- ============================================
        -- 重命名外键约束（平台级：platform_ → infra_）
        -- ============================================
        DO $$
        DECLARE
            con_record RECORD;
            new_name TEXT;
        BEGIN
            FOR con_record IN 
                SELECT 
                    conname,
                    conrelid::regclass::text as table_name
                FROM pg_constraint
                WHERE contype = 'f'
                  AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                  AND (
                    conname LIKE '%_platform_%' OR 
                    conname LIKE 'fk_platform_%'
                  )
            LOOP
                new_name := REPLACE(REPLACE(con_record.conname, '_platform_', '_infra_'), 'fk_platform_', 'fk_infra_');
                -- 检查新名称是否已存在
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                      AND conname = new_name
                ) THEN
                    EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I', 
                        con_record.table_name,
                        con_record.conname,
                        new_name
                    );
                END IF;
            END LOOP;
        END $$;
        
        -- ============================================
        -- 重命名外键约束（应用级：seed_ → apps_）
        -- ============================================
        DO $$
        DECLARE
            con_record RECORD;
            new_name TEXT;
        BEGIN
            FOR con_record IN 
                SELECT 
                    conname,
                    conrelid::regclass::text as table_name
                FROM pg_constraint
                WHERE contype = 'f'
                  AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                  AND (
                    conname LIKE '%_seed_%' OR 
                    conname LIKE 'fk_seed_%'
                  )
            LOOP
                new_name := REPLACE(REPLACE(con_record.conname, '_seed_', '_apps_'), 'fk_seed_', 'fk_apps_');
                -- 检查新名称是否已存在
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                      AND conname = new_name
                ) THEN
                    EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I', 
                        con_record.table_name,
                        con_record.conname,
                        new_name
                    );
                END IF;
            END LOOP;
        END $$;
        
        -- ============================================
        -- 重命名唯一约束（平台级：platform_ → infra_）
        -- ============================================
        DO $$
        DECLARE
            con_record RECORD;
            new_name TEXT;
        BEGIN
            FOR con_record IN 
                SELECT 
                    conname,
                    conrelid::regclass::text as table_name
                FROM pg_constraint
                WHERE contype = 'u'
                  AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                  AND (
                    conname LIKE '%_platform_%' OR 
                    conname LIKE 'uk_platform_%'
                  )
            LOOP
                new_name := REPLACE(REPLACE(con_record.conname, '_platform_', '_infra_'), 'uk_platform_', 'uk_infra_');
                -- 检查新名称是否已存在
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                      AND conname = new_name
                ) THEN
                    EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I', 
                        con_record.table_name,
                        con_record.conname,
                        new_name
                    );
                END IF;
            END LOOP;
        END $$;
        
        -- ============================================
        -- 重命名唯一约束（应用级：seed_ → apps_）
        -- ============================================
        DO $$
        DECLARE
            con_record RECORD;
            new_name TEXT;
        BEGIN
            FOR con_record IN 
                SELECT 
                    conname,
                    conrelid::regclass::text as table_name
                FROM pg_constraint
                WHERE contype = 'u'
                  AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                  AND (
                    conname LIKE '%_seed_%' OR 
                    conname LIKE 'uk_seed_%'
                  )
            LOOP
                new_name := REPLACE(REPLACE(con_record.conname, '_seed_', '_apps_'), 'uk_seed_', 'uk_apps_');
                -- 检查新名称是否已存在
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                      AND conname = new_name
                ) THEN
                    EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I', 
                        con_record.table_name,
                        con_record.conname,
                        new_name
                    );
                END IF;
            END LOOP;
        END $$;
        
        -- ============================================
        -- 重命名检查约束（平台级：platform_ → infra_）
        -- ============================================
        DO $$
        DECLARE
            con_record RECORD;
            new_name TEXT;
        BEGIN
            FOR con_record IN 
                SELECT 
                    conname,
                    conrelid::regclass::text as table_name
                FROM pg_constraint
                WHERE contype = 'c'
                  AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                  AND (
                    conname LIKE '%_platform_%' OR 
                    conname LIKE 'ck_platform_%'
                  )
            LOOP
                new_name := REPLACE(REPLACE(con_record.conname, '_platform_', '_infra_'), 'ck_platform_', 'ck_infra_');
                -- 检查新名称是否已存在
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                      AND conname = new_name
                ) THEN
                    EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I', 
                        con_record.table_name,
                        con_record.conname,
                        new_name
                    );
                END IF;
            END LOOP;
        END $$;
        
        -- ============================================
        -- 重命名检查约束（应用级：seed_ → apps_）
        -- ============================================
        DO $$
        DECLARE
            con_record RECORD;
            new_name TEXT;
        BEGIN
            FOR con_record IN 
                SELECT 
                    conname,
                    conrelid::regclass::text as table_name
                FROM pg_constraint
                WHERE contype = 'c'
                  AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                  AND (
                    conname LIKE '%_seed_%' OR 
                    conname LIKE 'ck_seed_%'
                  )
            LOOP
                new_name := REPLACE(REPLACE(con_record.conname, '_seed_', '_apps_'), 'ck_seed_', 'ck_apps_');
                -- 检查新名称是否已存在
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                      AND conname = new_name
                ) THEN
                    EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I', 
                        con_record.table_name,
                        con_record.conname,
                        new_name
                    );
                END IF;
            END LOOP;
        END $$;

-- 来自: 54_20250116_rename_remaining_seed_tables.py
-- 数据库表重命名迁移
        -- 重命名剩余的 seed_ 前缀表为 apps_ 前缀
        
        -- ============================================
        -- CRM 相关表重命名 (seed_kuaicrm_ → apps_kuaicrm_)
        -- ============================================
        ALTER TABLE IF EXISTS "seed_kuaicrm_complaints" RENAME TO "apps_kuaicrm_complaints";
        ALTER TABLE IF EXISTS "seed_kuaicrm_installations" RENAME TO "apps_kuaicrm_installations";
        ALTER TABLE IF EXISTS "seed_kuaicrm_lead_followups" RENAME TO "apps_kuaicrm_lead_followups";
        ALTER TABLE IF EXISTS "seed_kuaicrm_leads" RENAME TO "apps_kuaicrm_leads";
        ALTER TABLE IF EXISTS "seed_kuaicrm_opportunities" RENAME TO "apps_kuaicrm_opportunities";
        ALTER TABLE IF EXISTS "seed_kuaicrm_opportunity_followups" RENAME TO "apps_kuaicrm_opportunity_followups";
        ALTER TABLE IF EXISTS "seed_kuaicrm_sales_orders" RENAME TO "apps_kuaicrm_sales_orders";
        ALTER TABLE IF EXISTS "seed_kuaicrm_service_contracts" RENAME TO "apps_kuaicrm_service_contracts";
        ALTER TABLE IF EXISTS "seed_kuaicrm_service_workorders" RENAME TO "apps_kuaicrm_service_workorders";
        ALTER TABLE IF EXISTS "seed_kuaicrm_warranties" RENAME TO "apps_kuaicrm_warranties";
        
        -- ============================================
        -- MRP 相关表重命名 (seed_kuaimrp_ → apps_kuaimrp_)
        -- ============================================
        ALTER TABLE IF EXISTS "seed_kuaimrp_lrp_batches" RENAME TO "apps_kuaimrp_lrp_batches";
        ALTER TABLE IF EXISTS "seed_kuaimrp_material_requirements" RENAME TO "apps_kuaimrp_material_requirements";
        ALTER TABLE IF EXISTS "seed_kuaimrp_mrp_plans" RENAME TO "apps_kuaimrp_mrp_plans";
        ALTER TABLE IF EXISTS "seed_kuaimrp_requirement_traceabilities" RENAME TO "apps_kuaimrp_requirement_traceabilities";
        ALTER TABLE IF EXISTS "seed_kuaimrp_shortage_alerts" RENAME TO "apps_kuaimrp_shortage_alerts";
        
        -- ============================================
        -- PDM 相关表重命名 (seed_kuaipdm_ → apps_kuaipdm_)
        -- ============================================
        ALTER TABLE IF EXISTS "seed_kuaipdm_design_changes" RENAME TO "apps_kuaipdm_design_changes";
        ALTER TABLE IF EXISTS "seed_kuaipdm_design_reviews" RENAME TO "apps_kuaipdm_design_reviews";
        ALTER TABLE IF EXISTS "seed_kuaipdm_engineering_changes" RENAME TO "apps_kuaipdm_engineering_changes";
        ALTER TABLE IF EXISTS "seed_kuaipdm_knowledges" RENAME TO "apps_kuaipdm_knowledges";
        ALTER TABLE IF EXISTS "seed_kuaipdm_research_processes" RENAME TO "apps_kuaipdm_research_processes";
        
        -- ============================================
        -- SRM 相关表重命名 (seed_kuaisrm_ → apps_kuaisrm_)
        -- ============================================
        ALTER TABLE IF EXISTS "seed_kuaisrm_outsourcing_orders" RENAME TO "apps_kuaisrm_outsourcing_orders";
        ALTER TABLE IF EXISTS "seed_kuaisrm_purchase_contracts" RENAME TO "apps_kuaisrm_purchase_contracts";
        ALTER TABLE IF EXISTS "seed_kuaisrm_purchase_orders" RENAME TO "apps_kuaisrm_purchase_orders";
        ALTER TABLE IF EXISTS "seed_kuaisrm_supplier_evaluations" RENAME TO "apps_kuaisrm_supplier_evaluations";
        
        -- ============================================
        -- WMS 相关表重命名 (seed_kuaiwms_ → apps_kuaiwms_)
        -- ============================================
        ALTER TABLE IF EXISTS "seed_kuaiwms_inbound_orders" RENAME TO "apps_kuaiwms_inbound_orders";
        ALTER TABLE IF EXISTS "seed_kuaiwms_inventories" RENAME TO "apps_kuaiwms_inventories";
        ALTER TABLE IF EXISTS "seed_kuaiwms_inventory_adjustments" RENAME TO "apps_kuaiwms_inventory_adjustments";
        ALTER TABLE IF EXISTS "seed_kuaiwms_outbound_orders" RENAME TO "apps_kuaiwms_outbound_orders";
        ALTER TABLE IF EXISTS "seed_kuaiwms_stocktakes" RENAME TO "apps_kuaiwms_stocktakes";
        
        -- ============================================
        -- 主数据管理表重命名 (seed_master_data_ → apps_master_data_)
        -- ============================================
        ALTER TABLE IF EXISTS "seed_master_data_bom" RENAME TO "apps_master_data_bom";
        ALTER TABLE IF EXISTS "seed_master_data_customers" RENAME TO "apps_master_data_customers";
        ALTER TABLE IF EXISTS "seed_master_data_defect_types" RENAME TO "apps_master_data_defect_types";
        ALTER TABLE IF EXISTS "seed_master_data_holidays" RENAME TO "apps_master_data_holidays";
        ALTER TABLE IF EXISTS "seed_master_data_material_groups" RENAME TO "apps_master_data_material_groups";
        ALTER TABLE IF EXISTS "seed_master_data_materials" RENAME TO "apps_master_data_materials";
        ALTER TABLE IF EXISTS "seed_master_data_operations" RENAME TO "apps_master_data_operations";
        ALTER TABLE IF EXISTS "seed_master_data_process_routes" RENAME TO "apps_master_data_process_routes";
        ALTER TABLE IF EXISTS "seed_master_data_production_lines" RENAME TO "apps_master_data_production_lines";
        ALTER TABLE IF EXISTS "seed_master_data_products" RENAME TO "apps_master_data_products";
        ALTER TABLE IF EXISTS "seed_master_data_skills" RENAME TO "apps_master_data_skills";
        ALTER TABLE IF EXISTS "seed_master_data_sop" RENAME TO "apps_master_data_sop";
        ALTER TABLE IF EXISTS "seed_master_data_sop_executions" RENAME TO "apps_master_data_sop_executions";
        ALTER TABLE IF EXISTS "seed_master_data_storage_areas" RENAME TO "apps_master_data_storage_areas";
        ALTER TABLE IF EXISTS "seed_master_data_storage_locations" RENAME TO "apps_master_data_storage_locations";
        ALTER TABLE IF EXISTS "seed_master_data_suppliers" RENAME TO "apps_master_data_suppliers";
        ALTER TABLE IF EXISTS "seed_master_data_warehouses" RENAME TO "apps_master_data_warehouses";
        ALTER TABLE IF EXISTS "seed_master_data_workshops" RENAME TO "apps_master_data_workshops";
        ALTER TABLE IF EXISTS "seed_master_data_workstations" RENAME TO "apps_master_data_workstations";

-- 来自: 55_20250116_add_missing_table_comments.py
-- 为缺少注释的表添加 COMMENT ON TABLE
        
        -- ============================================
        -- 平台级表注释 (infra_)
        -- ============================================
        COMMENT ON TABLE "infra_superadmin" IS '平台超级管理员表';
        COMMENT ON TABLE "infra_tenants" IS '租户表';
        COMMENT ON TABLE "infra_tenant_configs" IS '租户配置表';
        COMMENT ON TABLE "infra_packages" IS '套餐表';
        
        -- ============================================
        -- 系统级表注释 (core_)
        -- ============================================
        COMMENT ON TABLE "core_users" IS '用户表';
        COMMENT ON TABLE "core_departments" IS '部门表';
        COMMENT ON TABLE "core_positions" IS '职位表';
        COMMENT ON TABLE "core_roles" IS '角色表';
        COMMENT ON TABLE "core_permissions" IS '权限表';
        COMMENT ON TABLE "core_role_permissions" IS '角色权限关联表';
        COMMENT ON TABLE "core_user_roles" IS '用户角色关联表';
        COMMENT ON TABLE "core_saved_searches" IS '保存的搜索表';
        COMMENT ON TABLE "core_data_dictionaries" IS '数据字典表';
        COMMENT ON TABLE "core_dictionary_items" IS '数据字典项表';
        COMMENT ON TABLE "core_system_parameters" IS '系统参数表';
        COMMENT ON TABLE "core_code_rules" IS '编码规则表';
        COMMENT ON TABLE "core_code_sequences" IS '编码序号表';
        COMMENT ON TABLE "core_languages" IS '语言表';
        COMMENT ON TABLE "core_site_settings" IS '站点设置表';
        COMMENT ON TABLE "core_invitation_codes" IS '邀请码表';
        COMMENT ON TABLE "core_custom_fields" IS '自定义字段表';
        COMMENT ON TABLE "core_custom_field_values" IS '自定义字段值表';
        COMMENT ON TABLE "core_applications" IS '应用表';
        COMMENT ON TABLE "core_integration_configs" IS '集成配置表';
        COMMENT ON TABLE "core_files" IS '文件表';
        COMMENT ON TABLE "core_apis" IS '接口表';
        COMMENT ON TABLE "core_data_sources" IS '数据源表';
        COMMENT ON TABLE "core_datasets" IS '数据集表';
        COMMENT ON TABLE "core_message_configs" IS '消息配置表';
        COMMENT ON TABLE "core_message_templates" IS '消息模板表';
        COMMENT ON TABLE "core_message_logs" IS '消息日志表';
        COMMENT ON TABLE "core_scheduled_tasks" IS '定时任务表';
        COMMENT ON TABLE "core_approval_processes" IS '审批流程表';
        COMMENT ON TABLE "core_approval_instances" IS '审批实例表';
        COMMENT ON TABLE "core_electronic_records" IS '电子记录表';
        COMMENT ON TABLE "core_scripts" IS '脚本表';
        COMMENT ON TABLE "core_print_templates" IS '打印模板表';
        COMMENT ON TABLE "core_print_devices" IS '打印设备表';
        COMMENT ON TABLE "core_user_preferences" IS '用户偏好表';
        COMMENT ON TABLE "core_operation_logs" IS '操作日志表';
        COMMENT ON TABLE "core_login_logs" IS '登录日志表';
        COMMENT ON TABLE "core_data_backups" IS '数据备份表';
        COMMENT ON TABLE "core_menus" IS '菜单表';
        
        -- ============================================
        -- 主数据管理表注释 (apps_master_data_)
        -- ============================================
        COMMENT ON TABLE "apps_master_data_materials" IS '物料表';
        COMMENT ON TABLE "apps_master_data_customers" IS '客户表';
        COMMENT ON TABLE "apps_master_data_suppliers" IS '供应商表';
        COMMENT ON TABLE "apps_master_data_products" IS '产品表';
        COMMENT ON TABLE "apps_master_data_workshops" IS '车间表';
        COMMENT ON TABLE "apps_master_data_production_lines" IS '生产线表';
        COMMENT ON TABLE "apps_master_data_workstations" IS '工作站表';
        COMMENT ON TABLE "apps_master_data_warehouses" IS '仓库表';
        COMMENT ON TABLE "apps_master_data_storage_areas" IS '存储区域表';
        COMMENT ON TABLE "apps_master_data_storage_locations" IS '存储位置表';
        COMMENT ON TABLE "apps_master_data_material_groups" IS '物料组表';
        COMMENT ON TABLE "apps_master_data_bom" IS 'BOM（物料清单）表';
        COMMENT ON TABLE "apps_master_data_defect_types" IS '缺陷类型表';
        COMMENT ON TABLE "apps_master_data_operations" IS '工序表';
        COMMENT ON TABLE "apps_master_data_process_routes" IS '工艺路线表';
        COMMENT ON TABLE "apps_master_data_sop" IS 'SOP（标准作业程序）表';
        COMMENT ON TABLE "apps_master_data_holidays" IS '节假日表';
        COMMENT ON TABLE "apps_master_data_skills" IS '技能表';
        COMMENT ON TABLE "apps_master_data_sop_executions" IS 'SOP执行记录表';
        
        -- ============================================
        -- 系统工具表注释
        -- ============================================
        COMMENT ON TABLE "aerich" IS 'Aerich 迁移工具表（用于跟踪数据库迁移历史）';

-- 来自: 56_20251216110926_rename_indexes_uid_to_uk.py
-- 数据库索引重命名迁移
-- 统一为最新命名规范（uid_ → uk_）

-- ============================================
-- 重命名唯一索引（uid_ → uk_）
-- ============================================
ALTER INDEX IF EXISTS "uid_apps_kuaicr_tenant__93b042" RENAME TO "uk_apps_kuaicr_tenant__93b042";
ALTER INDEX IF EXISTS "uid_apps_kuaicr_tenant__fc1f12" RENAME TO "uk_apps_kuaicr_tenant__fc1f12";
ALTER INDEX IF EXISTS "uid_apps_kuaicr_tenant__810b7c" RENAME TO "uk_apps_kuaicr_tenant__810b7c";
ALTER INDEX IF EXISTS "uid_apps_kuaicr_tenant__8af6b9" RENAME TO "uk_apps_kuaicr_tenant__8af6b9";
ALTER INDEX IF EXISTS "uid_apps_kuaicr_tenant__64f939" RENAME TO "uk_apps_kuaicr_tenant__64f939";
ALTER INDEX IF EXISTS "uid_apps_kuaicr_tenant__b8c3ab" RENAME TO "uk_apps_kuaicr_tenant__b8c3ab";
ALTER INDEX IF EXISTS "uid_apps_kuaicr_tenant__135aaf" RENAME TO "uk_apps_kuaicr_tenant__135aaf";
ALTER INDEX IF EXISTS "uid_apps_kuaicr_tenant__08f18a" RENAME TO "uk_apps_kuaicr_tenant__08f18a";
ALTER INDEX IF EXISTS "uid_apps_kuaiea_tenant__31d606" RENAME TO "uk_apps_kuaiea_tenant__31d606";
ALTER INDEX IF EXISTS "uid_apps_kuaiea_tenant__e64673" RENAME TO "uk_apps_kuaiea_tenant__e64673";
ALTER INDEX IF EXISTS "uid_apps_kuaiea_tenant__a895ca" RENAME TO "uk_apps_kuaiea_tenant__a895ca";
ALTER INDEX IF EXISTS "uid_apps_kuaiea_tenant__427961" RENAME TO "uk_apps_kuaiea_tenant__427961";
ALTER INDEX IF EXISTS "uid_apps_kuaiea_tenant__1cde53" RENAME TO "uk_apps_kuaiea_tenant__1cde53";
ALTER INDEX IF EXISTS "uid_apps_kuaiea_tenant__5c7fe8" RENAME TO "uk_apps_kuaiea_tenant__5c7fe8";
ALTER INDEX IF EXISTS "uid_apps_kuaiea_tenant__dd52a6" RENAME TO "uk_apps_kuaiea_tenant__dd52a6";
ALTER INDEX IF EXISTS "uid_apps_kuaiea_tenant__5e8bf2" RENAME TO "uk_apps_kuaiea_tenant__5e8bf2";
ALTER INDEX IF EXISTS "uid_apps_kuaiea_tenant__736d96" RENAME TO "uk_apps_kuaiea_tenant__736d96";
ALTER INDEX IF EXISTS "uid_apps_kuaime_tenant__a1b2c3" RENAME TO "uk_apps_kuaime_tenant__a1b2c3";
ALTER INDEX IF EXISTS "uid_apps_kuaime_tenant__185a1e" RENAME TO "uk_apps_kuaime_tenant__185a1e";
ALTER INDEX IF EXISTS "uid_apps_kuaime_tenant__f9033b" RENAME TO "uk_apps_kuaime_tenant__f9033b";
ALTER INDEX IF EXISTS "uid_apps_kuaime_tenant__b05410" RENAME TO "uk_apps_kuaime_tenant__b05410";
ALTER INDEX IF EXISTS "uid_apps_kuaime_tenant__53bf79" RENAME TO "uk_apps_kuaime_tenant__53bf79";
ALTER INDEX IF EXISTS "uid_apps_kuaimr_tenant__aad8bd" RENAME TO "uk_apps_kuaimr_tenant__aad8bd";
ALTER INDEX IF EXISTS "uid_apps_kuaimr_tenant__a5553d" RENAME TO "uk_apps_kuaimr_tenant__a5553d";
ALTER INDEX IF EXISTS "uid_apps_kuaimr_tenant__31d4b7" RENAME TO "uk_apps_kuaimr_tenant__31d4b7";
ALTER INDEX IF EXISTS "uid_apps_kuaimr_tenant__047e85" RENAME TO "uk_apps_kuaimr_tenant__047e85";
ALTER INDEX IF EXISTS "uid_apps_kuaipd_tenant__e0e991" RENAME TO "uk_apps_kuaipd_tenant__e0e991";
ALTER INDEX IF EXISTS "uid_apps_kuaipd_tenant__a95341" RENAME TO "uk_apps_kuaipd_tenant__a95341";
ALTER INDEX IF EXISTS "uid_apps_kuaipd_tenant__b8d426" RENAME TO "uk_apps_kuaipd_tenant__b8d426";
ALTER INDEX IF EXISTS "uid_apps_kuaipd_tenant__40f18a" RENAME TO "uk_apps_kuaipd_tenant__40f18a";
ALTER INDEX IF EXISTS "uid_apps_kuaipd_tenant__120f74" RENAME TO "uk_apps_kuaipd_tenant__120f74";
ALTER INDEX IF EXISTS "uid_apps_kuaiqm_tenant__15922a" RENAME TO "uk_apps_kuaiqm_tenant__15922a";
ALTER INDEX IF EXISTS "uid_apps_kuaiqm_tenant__1c44cc" RENAME TO "uk_apps_kuaiqm_tenant__1c44cc";
ALTER INDEX IF EXISTS "uid_apps_kuaiqm_tenant__3613a7" RENAME TO "uk_apps_kuaiqm_tenant__3613a7";
ALTER INDEX IF EXISTS "uid_apps_kuaiqm_tenant__567c4b" RENAME TO "uk_apps_kuaiqm_tenant__567c4b";
ALTER INDEX IF EXISTS "uid_apps_kuaiqm_tenant__2d5085" RENAME TO "uk_apps_kuaiqm_tenant__2d5085";
ALTER INDEX IF EXISTS "uid_apps_kuaiqm_tenant__c30ed4" RENAME TO "uk_apps_kuaiqm_tenant__c30ed4";
ALTER INDEX IF EXISTS "uid_apps_kuaiqm_tenant__7f3e44" RENAME TO "uk_apps_kuaiqm_tenant__7f3e44";
ALTER INDEX IF EXISTS "uid_apps_kuaiqm_tenant__2840f6" RENAME TO "uk_apps_kuaiqm_tenant__2840f6";
ALTER INDEX IF EXISTS "uid_apps_kuaiqm_tenant__b9b190" RENAME TO "uk_apps_kuaiqm_tenant__b9b190";
ALTER INDEX IF EXISTS "uid_apps_kuaiqm_tenant__148943" RENAME TO "uk_apps_kuaiqm_tenant__148943";
ALTER INDEX IF EXISTS "uid_apps_kuaisr_tenant__0dd7d5" RENAME TO "uk_apps_kuaisr_tenant__0dd7d5";
ALTER INDEX IF EXISTS "uid_apps_kuaisr_tenant__065dd1" RENAME TO "uk_apps_kuaisr_tenant__065dd1";
ALTER INDEX IF EXISTS "uid_apps_kuaisr_tenant__ad48ea" RENAME TO "uk_apps_kuaisr_tenant__ad48ea";
ALTER INDEX IF EXISTS "uid_apps_kuaisr_tenant__8a0de1" RENAME TO "uk_apps_kuaisr_tenant__8a0de1";
ALTER INDEX IF EXISTS "uid_apps_kuaiwm_tenant__d9b441" RENAME TO "uk_apps_kuaiwm_tenant__d9b441";
ALTER INDEX IF EXISTS "uid_apps_kuaiwm_tenant__d7fdf1" RENAME TO "uk_apps_kuaiwm_tenant__d7fdf1";
ALTER INDEX IF EXISTS "uid_apps_kuaiwm_tenant__f1dd34" RENAME TO "uk_apps_kuaiwm_tenant__f1dd34";
ALTER INDEX IF EXISTS "uid_apps_kuaiwm_tenant__8d7f52" RENAME TO "uk_apps_kuaiwm_tenant__8d7f52";
ALTER INDEX IF EXISTS "uid_apps_kuaiwm_tenant__820d42" RENAME TO "uk_apps_kuaiwm_tenant__820d42";
ALTER INDEX IF EXISTS "uid_core_applic_tenant__a1b2c3" RENAME TO "uk_core_applic_tenant__a1b2c3";
ALTER INDEX IF EXISTS "uid_core_code_r_tenant__d9e4f5" RENAME TO "uk_core_code_r_tenant__d9e4f5";
ALTER INDEX IF EXISTS "uid_core_code_s_code_ru_g9h4i5" RENAME TO "uk_core_code_s_code_ru_g9h4i5";
ALTER INDEX IF EXISTS "uid_core_custom_tenant__i9j4k5" RENAME TO "uk_core_custom_tenant__i9j4k5";
ALTER INDEX IF EXISTS "uid_core_data_di_tenant__a8b3c4" RENAME TO "uk_core_data_di_tenant__a8b3c4";
ALTER INDEX IF EXISTS "uid_core_dictio_tenant__b9c4d5" RENAME TO "uk_core_dictio_tenant__b9c4d5";
ALTER INDEX IF EXISTS "uid_core_integra_tenant__b1c2d3" RENAME TO "uk_core_integra_tenant__b1c2d3";
ALTER INDEX IF EXISTS "uid_core_languag_tenant__u9v4w5" RENAME TO "uk_core_languag_tenant__u9v4w5";
ALTER INDEX IF EXISTS "uid_core_permiss_tenant__a6de52" RENAME TO "uk_core_permiss_tenant__a6de52";
ALTER INDEX IF EXISTS "uid_core_site_s_tenant__p9q4r5" RENAME TO "uk_core_site_s_tenant__p9q4r5";
ALTER INDEX IF EXISTS "uid_core_system_tenant__c9d4e5" RENAME TO "uk_core_system_tenant__c9d4e5";
ALTER INDEX IF EXISTS "uid_core_users_tenant__26aebd" RENAME TO "uk_core_users_tenant__26aebd";

-- 来自: 57_20251216_rename_is_platform_admin_to_is_infra_admin.py
-- 数据库字段重命名迁移
        -- 将 core_users 表中的 is_platform_admin 字段重命名为 is_infra_admin
        
        -- 1. 重命名字段
        ALTER TABLE IF EXISTS "core_users" 
        RENAME COLUMN "is_platform_admin" TO "is_infra_admin";
        
        -- 2. 重命名相关索引
        -- 删除旧索引（如果存在）
        DROP INDEX IF EXISTS "idx_core_users_is_plat_e57f1c";
        DROP INDEX IF EXISTS "idx_sys_users_is_plat_e57f1c";
        
        -- 创建新索引
        CREATE INDEX IF NOT EXISTS "idx_core_users_is_infra_admin" 
        ON "core_users" ("is_infra_admin");

"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    回滚操作（谨慎使用）
    """
    return """
-- 注意: 此操作会回滚所有变更，请谨慎使用
-- 如需回滚，请手动执行相应的 DROP 语句
"""
