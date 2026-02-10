"""
初始数据库结构迁移 - 从 public.sql 生成

此迁移文件包含完整的数据库结构定义，包括：
- 63 个序列
- 64 个表
- 324 个索引
- 78 个注释

生成时间: 2025-12-27 13:36:09
来源: public.sql
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：创建完整的数据库结构
    
    此迁移基于 public.sql 文件生成，包含所有表、序列、索引和注释。
    """
    return """
        -- 创建序列
        CREATE SEQUENCE IF NOT EXISTS "public"."core_approval_histories_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."core_permissions_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 9223372036854775807 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."core_roles_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 9223372036854775807 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."core_tenant_configs_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 9223372036854775807 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."core_tenants_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 9223372036854775807 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."core_users_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 9223372036854775807 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."root_apis_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."root_applications_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."root_approval_instances_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."root_approval_processes_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."root_data_backups_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."root_data_sources_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."root_datasets_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."root_departments_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."root_electronic_records_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."root_files_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."root_integration_configs_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."root_login_logs_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."root_menus_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."root_message_configs_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."root_message_logs_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."root_message_templates_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."root_operation_logs_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."root_positions_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."root_print_devices_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."root_print_templates_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."root_role_permissions_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 9223372036854775807 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."root_saved_searches_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 9223372036854775807 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."root_scheduled_tasks_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."root_scripts_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."root_user_preferences_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."root_user_roles_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 9223372036854775807 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."seed_master_data_bom_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."seed_master_data_customers_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."seed_master_data_defect_types_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."seed_master_data_holidays_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."seed_master_data_material_groups_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."seed_master_data_materials_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."seed_master_data_operations_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."seed_master_data_process_routes_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."seed_master_data_production_lines_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."seed_master_data_products_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."seed_master_data_skills_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."seed_master_data_sop_executions_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."seed_master_data_sop_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."seed_master_data_storage_areas_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."seed_master_data_storage_locations_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."seed_master_data_suppliers_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."seed_master_data_warehouses_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."seed_master_data_workshops_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."seed_master_data_workstations_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."soil_packages_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 9223372036854775807 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."soil_platform_superadmin_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 9223372036854775807 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."sys_code_rules_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."sys_code_sequences_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."sys_custom_field_values_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."sys_custom_fields_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."sys_data_dictionaries_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."sys_dictionary_items_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."sys_invitation_codes_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."sys_languages_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."sys_site_settings_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;
        CREATE SEQUENCE IF NOT EXISTS "public"."sys_system_parameters_id_seq"  INCREMENT 1 MINVALUE  1 MAXVALUE 2147483647 START 1 CACHE 1;

        -- 创建表
        CREATE TABLE IF NOT EXISTS "public"."aerich" (   "id" int4 NOT NULL DEFAULT nextval('aerich_id_seq'::regclass),   "version" varchar(255) COLLATE "pg_catalog"."default" NOT NULL,   "app" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,   "content" jsonb NOT NULL ) ;

        CREATE TABLE IF NOT EXISTS "public"."apps_master_data_bom" (   "id" int4 NOT NULL DEFAULT nextval('seed_master_data_bom_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4 NOT NULL,   "material_id" int4 NOT NULL,   "component_id" int4 NOT NULL,   "quantity" numeric(18,4) NOT NULL,   "unit" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,   "is_alternative" bool NOT NULL DEFAULT false,   "alternative_group_id" int4,   "priority" int4 NOT NULL DEFAULT 0,   "description" text COLLATE "pg_catalog"."default",   "is_active" bool NOT NULL DEFAULT true,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6),   "version" varchar(50) COLLATE "pg_catalog"."default" NOT NULL DEFAULT '1.0'::character varying,   "bom_code" varchar(100) COLLATE "pg_catalog"."default",   "effective_date" timestamptz(6),   "expiry_date" timestamptz(6),   "approval_status" varchar(20) COLLATE "pg_catalog"."default" NOT NULL DEFAULT 'draft'::character varying,   "approved_by" int4,   "approved_at" timestamptz(6),   "approval_comment" text COLLATE "pg_catalog"."default",   "remark" text COLLATE "pg_catalog"."default" ) ;

        CREATE TABLE IF NOT EXISTS "public"."apps_master_data_customers" (   "id" int4 NOT NULL DEFAULT nextval('seed_master_data_customers_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4 NOT NULL,   "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,   "short_name" varchar(100) COLLATE "pg_catalog"."default",   "contact_person" varchar(100) COLLATE "pg_catalog"."default",   "phone" varchar(20) COLLATE "pg_catalog"."default",   "email" varchar(100) COLLATE "pg_catalog"."default",   "address" text COLLATE "pg_catalog"."default",   "category" varchar(50) COLLATE "pg_catalog"."default",   "is_active" bool NOT NULL DEFAULT true,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."apps_master_data_defect_types" (   "id" int4 NOT NULL DEFAULT nextval('seed_master_data_defect_types_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4 NOT NULL,   "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,   "category" varchar(50) COLLATE "pg_catalog"."default",   "description" text COLLATE "pg_catalog"."default",   "is_active" bool NOT NULL DEFAULT true,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."apps_master_data_holidays" (   "id" int4 NOT NULL DEFAULT nextval('seed_master_data_holidays_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4 NOT NULL,   "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,   "holiday_date" date NOT NULL,   "holiday_type" varchar(50) COLLATE "pg_catalog"."default",   "description" text COLLATE "pg_catalog"."default",   "is_active" bool NOT NULL DEFAULT true,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."apps_master_data_material_groups" (   "id" int4 NOT NULL DEFAULT nextval('seed_master_data_material_groups_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4 NOT NULL,   "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,   "parent_id" int4,   "description" text COLLATE "pg_catalog"."default",   "is_active" bool NOT NULL DEFAULT true,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."apps_master_data_materials" (   "id" int4 NOT NULL DEFAULT nextval('seed_master_data_materials_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4 NOT NULL,   "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,   "group_id" int4,   "specification" varchar(500) COLLATE "pg_catalog"."default",   "base_unit" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,   "units" jsonb,   "batch_managed" bool NOT NULL DEFAULT false,   "variant_managed" bool NOT NULL DEFAULT false,   "variant_attributes" jsonb,   "description" text COLLATE "pg_catalog"."default",   "brand" varchar(100) COLLATE "pg_catalog"."default",   "model" varchar(100) COLLATE "pg_catalog"."default",   "is_active" bool NOT NULL DEFAULT true,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."apps_master_data_operations" (   "id" int4 NOT NULL DEFAULT nextval('seed_master_data_operations_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4 NOT NULL,   "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,   "description" text COLLATE "pg_catalog"."default",   "is_active" bool NOT NULL DEFAULT true,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."apps_master_data_process_routes" (   "id" int4 NOT NULL DEFAULT nextval('seed_master_data_process_routes_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4 NOT NULL,   "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,   "description" text COLLATE "pg_catalog"."default",   "operation_sequence" jsonb,   "is_active" bool NOT NULL DEFAULT true,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."apps_master_data_production_lines" (   "id" int4 NOT NULL DEFAULT nextval('seed_master_data_production_lines_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4 NOT NULL,   "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,   "workshop_id" int4 NOT NULL,   "description" text COLLATE "pg_catalog"."default",   "is_active" bool NOT NULL DEFAULT true,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."apps_master_data_products" (   "id" int4 NOT NULL DEFAULT nextval('seed_master_data_products_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4 NOT NULL,   "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,   "specification" varchar(500) COLLATE "pg_catalog"."default",   "unit" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,   "bom_data" jsonb,   "version" varchar(20) COLLATE "pg_catalog"."default",   "is_active" bool NOT NULL DEFAULT true,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."apps_master_data_skills" (   "id" int4 NOT NULL DEFAULT nextval('seed_master_data_skills_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4 NOT NULL,   "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,   "category" varchar(50) COLLATE "pg_catalog"."default",   "description" text COLLATE "pg_catalog"."default",   "is_active" bool NOT NULL DEFAULT true,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."apps_master_data_sop" (   "id" int4 NOT NULL DEFAULT nextval('seed_master_data_sop_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4 NOT NULL,   "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,   "operation_id" int4,   "version" varchar(20) COLLATE "pg_catalog"."default",   "content" text COLLATE "pg_catalog"."default",   "attachments" jsonb,   "is_active" bool NOT NULL DEFAULT true,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6),   "flow_config" jsonb,   "form_config" jsonb ) ;

        CREATE TABLE IF NOT EXISTS "public"."apps_master_data_sop_executions" (   "id" int4 NOT NULL DEFAULT nextval('seed_master_data_sop_executions_id_seq'::regclass),   "uuid" uuid NOT NULL,   "tenant_id" int4 NOT NULL,   "sop_id" int4 NOT NULL,   "title" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,   "description" text COLLATE "pg_catalog"."default",   "status" varchar(20) COLLATE "pg_catalog"."default" NOT NULL DEFAULT 'pending'::character varying,   "current_node_id" varchar(100) COLLATE "pg_catalog"."default",   "node_data" jsonb,   "inngest_run_id" varchar(100) COLLATE "pg_catalog"."default",   "executor_id" int4 NOT NULL,   "started_at" timestamptz(6) NOT NULL,   "completed_at" timestamptz(6),   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."apps_master_data_storage_areas" (   "id" int4 NOT NULL DEFAULT nextval('seed_master_data_storage_areas_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4 NOT NULL,   "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,   "warehouse_id" int4 NOT NULL,   "description" text COLLATE "pg_catalog"."default",   "is_active" bool NOT NULL DEFAULT true,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."apps_master_data_storage_locations" (   "id" int4 NOT NULL DEFAULT nextval('seed_master_data_storage_locations_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4 NOT NULL,   "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,   "storage_area_id" int4 NOT NULL,   "description" text COLLATE "pg_catalog"."default",   "is_active" bool NOT NULL DEFAULT true,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."apps_master_data_suppliers" (   "id" int4 NOT NULL DEFAULT nextval('seed_master_data_suppliers_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4 NOT NULL,   "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,   "short_name" varchar(100) COLLATE "pg_catalog"."default",   "contact_person" varchar(100) COLLATE "pg_catalog"."default",   "phone" varchar(20) COLLATE "pg_catalog"."default",   "email" varchar(100) COLLATE "pg_catalog"."default",   "address" text COLLATE "pg_catalog"."default",   "category" varchar(50) COLLATE "pg_catalog"."default",   "is_active" bool NOT NULL DEFAULT true,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."apps_master_data_warehouses" (   "id" int4 NOT NULL DEFAULT nextval('seed_master_data_warehouses_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4 NOT NULL,   "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,   "description" text COLLATE "pg_catalog"."default",   "is_active" bool NOT NULL DEFAULT true,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."apps_master_data_workshops" (   "id" int4 NOT NULL DEFAULT nextval('seed_master_data_workshops_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4 NOT NULL,   "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,   "description" text COLLATE "pg_catalog"."default",   "is_active" bool NOT NULL DEFAULT true,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."apps_master_data_workstations" (   "id" int4 NOT NULL DEFAULT nextval('seed_master_data_workstations_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4 NOT NULL,   "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,   "production_line_id" int4 NOT NULL,   "description" text COLLATE "pg_catalog"."default",   "is_active" bool NOT NULL DEFAULT true,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."core_apis" (   "id" int4 NOT NULL DEFAULT nextval('root_apis_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4 NOT NULL,   "name" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,   "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "description" text COLLATE "pg_catalog"."default",   "path" varchar(500) COLLATE "pg_catalog"."default" NOT NULL,   "method" varchar(10) COLLATE "pg_catalog"."default" NOT NULL,   "request_headers" jsonb,   "request_params" jsonb,   "request_body" jsonb,   "response_format" jsonb,   "response_example" jsonb,   "is_active" bool NOT NULL DEFAULT true,   "is_system" bool NOT NULL DEFAULT false,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."core_applications" (   "id" int4 NOT NULL DEFAULT nextval('root_applications_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4,   "name" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,   "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "description" text COLLATE "pg_catalog"."default",   "icon" varchar(200) COLLATE "pg_catalog"."default",   "version" varchar(20) COLLATE "pg_catalog"."default",   "route_path" varchar(200) COLLATE "pg_catalog"."default",   "entry_point" varchar(500) COLLATE "pg_catalog"."default",   "menu_config" jsonb,   "permission_code" varchar(100) COLLATE "pg_catalog"."default",   "is_system" bool NOT NULL DEFAULT false,   "is_active" bool NOT NULL DEFAULT true,   "is_installed" bool NOT NULL DEFAULT false,   "sort_order" int4 NOT NULL DEFAULT 0,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."core_approval_histories" (   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4,   "created_at" timestamptz(6) NOT NULL,   "updated_at" timestamptz(6) NOT NULL,   "id" int4 NOT NULL DEFAULT nextval('core_approval_histories_id_seq'::regclass),   "approval_instance_id" int4 NOT NULL,   "action" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,   "action_by" int4 NOT NULL,   "action_at" timestamptz(6) NOT NULL,   "comment" text COLLATE "pg_catalog"."default",   "from_node" varchar(100) COLLATE "pg_catalog"."default",   "to_node" varchar(100) COLLATE "pg_catalog"."default",   "from_approver_id" int4,   "to_approver_id" int4 ) ;

        CREATE TABLE IF NOT EXISTS "public"."core_approval_instances" (   "id" int4 NOT NULL DEFAULT nextval('root_approval_instances_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4 NOT NULL,   "process_id" int4 NOT NULL,   "title" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,   "content" text COLLATE "pg_catalog"."default",   "data" jsonb,   "status" varchar(20) COLLATE "pg_catalog"."default" NOT NULL DEFAULT 'pending'::character varying,   "current_node" varchar(100) COLLATE "pg_catalog"."default",   "current_approver_id" int4,   "inngest_run_id" varchar(100) COLLATE "pg_catalog"."default",   "submitter_id" int4 NOT NULL,   "submitted_at" timestamptz(6) NOT NULL,   "completed_at" timestamptz(6),   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."core_approval_processes" (   "id" int4 NOT NULL DEFAULT nextval('root_approval_processes_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4 NOT NULL,   "name" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,   "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "description" text COLLATE "pg_catalog"."default",   "nodes" jsonb NOT NULL,   "config" jsonb NOT NULL,   "inngest_workflow_id" varchar(100) COLLATE "pg_catalog"."default",   "is_active" bool NOT NULL DEFAULT true,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."core_code_rules" (   "id" int4 NOT NULL DEFAULT nextval('sys_code_rules_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4,   "name" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,   "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "expression" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,   "description" text COLLATE "pg_catalog"."default",   "seq_start" int4 NOT NULL DEFAULT 1,   "seq_step" int4 NOT NULL DEFAULT 1,   "seq_reset_rule" varchar(20) COLLATE "pg_catalog"."default",   "is_system" bool NOT NULL DEFAULT false,   "is_active" bool NOT NULL DEFAULT true,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."core_code_sequences" (   "id" int4 NOT NULL DEFAULT nextval('sys_code_sequences_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4,   "code_rule_id" int4 NOT NULL,   "current_seq" int4 NOT NULL DEFAULT 0,   "reset_date" date,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."core_custom_field_values" (   "id" int4 NOT NULL DEFAULT nextval('sys_custom_field_values_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4,   "custom_field_id" int4 NOT NULL,   "record_id" int4 NOT NULL,   "record_table" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "value_text" text COLLATE "pg_catalog"."default",   "value_number" numeric(20,4),   "value_date" date,   "value_json" jsonb,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."core_custom_fields" (   "id" int4 NOT NULL DEFAULT nextval('sys_custom_fields_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4,   "name" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,   "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "table_name" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "field_type" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,   "config" jsonb,   "label" varchar(100) COLLATE "pg_catalog"."default",   "placeholder" varchar(200) COLLATE "pg_catalog"."default",   "is_required" bool NOT NULL DEFAULT false,   "is_searchable" bool NOT NULL DEFAULT true,   "is_sortable" bool NOT NULL DEFAULT true,   "sort_order" int4 NOT NULL DEFAULT 0,   "is_active" bool NOT NULL DEFAULT true,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."core_data_backups" (   "id" int4 NOT NULL DEFAULT nextval('root_data_backups_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4 NOT NULL,   "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,   "backup_type" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,   "backup_scope" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,   "backup_tables" jsonb,   "file_path" varchar(500) COLLATE "pg_catalog"."default",   "file_uuid" varchar(36) COLLATE "pg_catalog"."default",   "file_size" int8,   "status" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,   "inngest_run_id" varchar(100) COLLATE "pg_catalog"."default",   "started_at" timestamptz(6),   "completed_at" timestamptz(6),   "error_message" text COLLATE "pg_catalog"."default",   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."core_data_dictionaries" (   "id" int4 NOT NULL DEFAULT nextval('sys_data_dictionaries_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4,   "name" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,   "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "description" text COLLATE "pg_catalog"."default",   "is_system" bool NOT NULL DEFAULT false,   "is_active" bool NOT NULL DEFAULT true,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."core_data_sources" (   "id" int4 NOT NULL DEFAULT nextval('root_data_sources_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4 NOT NULL,   "name" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,   "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "description" text COLLATE "pg_catalog"."default",   "type" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,   "config" jsonb NOT NULL,   "is_active" bool NOT NULL DEFAULT true,   "is_connected" bool NOT NULL DEFAULT false,   "last_connected_at" timestamptz(6),   "last_error" text COLLATE "pg_catalog"."default",   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."core_datasets" (   "id" int4 NOT NULL DEFAULT nextval('root_datasets_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4 NOT NULL,   "data_source_id" int4 NOT NULL,   "name" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,   "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "description" text COLLATE "pg_catalog"."default",   "query_type" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,   "query_config" jsonb NOT NULL,   "is_active" bool NOT NULL DEFAULT true,   "last_executed_at" timestamptz(6),   "last_error" text COLLATE "pg_catalog"."default",   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."core_departments" (   "id" int4 NOT NULL DEFAULT nextval('root_departments_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4,   "name" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,   "code" varchar(50) COLLATE "pg_catalog"."default",   "description" text COLLATE "pg_catalog"."default",   "manager_id" int4,   "parent_id" int4,   "sort_order" int4 DEFAULT 0,   "is_active" bool DEFAULT true,   "created_at" timestamp(6) DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamp(6) DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamp(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."core_dictionary_items" (   "id" int4 NOT NULL DEFAULT nextval('sys_dictionary_items_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4,   "dictionary_id" int4 NOT NULL,   "label" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,   "value" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,   "description" text COLLATE "pg_catalog"."default",   "color" varchar(20) COLLATE "pg_catalog"."default",   "icon" varchar(50) COLLATE "pg_catalog"."default",   "sort_order" int4 NOT NULL DEFAULT 0,   "is_active" bool NOT NULL DEFAULT true,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."core_electronic_records" (   "id" int4 NOT NULL DEFAULT nextval('root_electronic_records_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4 NOT NULL,   "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,   "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "type" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "description" text COLLATE "pg_catalog"."default",   "content" jsonb NOT NULL,   "file_uuid" varchar(36) COLLATE "pg_catalog"."default",   "inngest_workflow_id" varchar(100) COLLATE "pg_catalog"."default",   "inngest_run_id" varchar(100) COLLATE "pg_catalog"."default",   "status" varchar(20) COLLATE "pg_catalog"."default" NOT NULL DEFAULT 'draft'::character varying,   "lifecycle_stage" varchar(20) COLLATE "pg_catalog"."default",   "signer_id" int4,   "signed_at" timestamptz(6),   "signature_data" text COLLATE "pg_catalog"."default",   "archived_at" timestamptz(6),   "archive_location" varchar(200) COLLATE "pg_catalog"."default",   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."core_files" (   "id" int4 NOT NULL DEFAULT nextval('root_files_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4,   "name" varchar(255) COLLATE "pg_catalog"."default" NOT NULL,   "original_name" varchar(255) COLLATE "pg_catalog"."default" NOT NULL,   "file_path" varchar(500) COLLATE "pg_catalog"."default" NOT NULL,   "file_size" int8 NOT NULL,   "file_type" varchar(100) COLLATE "pg_catalog"."default",   "file_extension" varchar(20) COLLATE "pg_catalog"."default",   "preview_url" varchar(500) COLLATE "pg_catalog"."default",   "category" varchar(50) COLLATE "pg_catalog"."default",   "tags" jsonb,   "description" text COLLATE "pg_catalog"."default",   "is_active" bool NOT NULL DEFAULT true,   "upload_status" varchar(20) COLLATE "pg_catalog"."default" NOT NULL DEFAULT 'completed'::character varying,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."core_integration_configs" (   "id" int4 NOT NULL DEFAULT nextval('root_integration_configs_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4,   "name" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,   "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "type" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,   "description" text COLLATE "pg_catalog"."default",   "config" jsonb NOT NULL DEFAULT '{}'::jsonb,   "is_active" bool NOT NULL DEFAULT true,   "is_connected" bool NOT NULL DEFAULT false,   "last_connected_at" timestamptz(6),   "last_error" text COLLATE "pg_catalog"."default",   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."core_invitation_codes" (   "id" int4 NOT NULL DEFAULT nextval('sys_invitation_codes_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4,   "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "email" varchar(100) COLLATE "pg_catalog"."default",   "role_id" int4,   "max_uses" int4 NOT NULL DEFAULT 1,   "used_count" int4 NOT NULL DEFAULT 0,   "expires_at" timestamptz(6),   "is_active" bool NOT NULL DEFAULT true,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."core_languages" (   "id" int4 NOT NULL DEFAULT nextval('sys_languages_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4,   "code" varchar(10) COLLATE "pg_catalog"."default" NOT NULL,   "name" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "native_name" varchar(50) COLLATE "pg_catalog"."default",   "translations" jsonb NOT NULL DEFAULT '{}'::jsonb,   "is_default" bool NOT NULL DEFAULT false,   "is_active" bool NOT NULL DEFAULT true,   "sort_order" int4 NOT NULL DEFAULT 0,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."core_login_logs" (   "id" int4 NOT NULL DEFAULT nextval('root_login_logs_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4,   "user_id" int4,   "username" varchar(100) COLLATE "pg_catalog"."default",   "login_ip" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "login_location" varchar(200) COLLATE "pg_catalog"."default",   "login_device" varchar(50) COLLATE "pg_catalog"."default",   "login_browser" varchar(200) COLLATE "pg_catalog"."default",   "login_status" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,   "failure_reason" text COLLATE "pg_catalog"."default",   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP ) ;

        CREATE TABLE IF NOT EXISTS "public"."core_menus" (   "id" int4 NOT NULL DEFAULT nextval('root_menus_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4 NOT NULL,   "name" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,   "path" varchar(200) COLLATE "pg_catalog"."default",   "icon" varchar(100) COLLATE "pg_catalog"."default",   "component" varchar(500) COLLATE "pg_catalog"."default",   "permission_code" varchar(100) COLLATE "pg_catalog"."default",   "application_uuid" varchar(36) COLLATE "pg_catalog"."default",   "parent_id" int4,   "sort_order" int4 NOT NULL DEFAULT 0,   "is_active" bool NOT NULL DEFAULT true,   "is_external" bool NOT NULL DEFAULT false,   "external_url" varchar(500) COLLATE "pg_catalog"."default",   "meta" jsonb,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."core_message_configs" (   "id" int4 NOT NULL DEFAULT nextval('root_message_configs_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4 NOT NULL,   "name" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,   "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "type" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,   "description" text COLLATE "pg_catalog"."default",   "config" jsonb NOT NULL,   "is_active" bool NOT NULL DEFAULT true,   "is_default" bool NOT NULL DEFAULT false,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."core_message_logs" (   "id" int4 NOT NULL DEFAULT nextval('root_message_logs_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4 NOT NULL,   "template_uuid" varchar(36) COLLATE "pg_catalog"."default",   "config_uuid" varchar(36) COLLATE "pg_catalog"."default",   "type" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,   "recipient" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,   "subject" varchar(200) COLLATE "pg_catalog"."default",   "content" text COLLATE "pg_catalog"."default" NOT NULL,   "variables" jsonb,   "status" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,   "inngest_run_id" varchar(100) COLLATE "pg_catalog"."default",   "error_message" text COLLATE "pg_catalog"."default",   "sent_at" timestamptz(6),   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."core_message_templates" (   "id" int4 NOT NULL DEFAULT nextval('root_message_templates_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4 NOT NULL,   "name" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,   "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "type" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,   "description" text COLLATE "pg_catalog"."default",   "subject" varchar(200) COLLATE "pg_catalog"."default",   "content" text COLLATE "pg_catalog"."default" NOT NULL,   "variables" jsonb,   "is_active" bool NOT NULL DEFAULT true,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."core_operation_logs" (   "id" int4 NOT NULL DEFAULT nextval('root_operation_logs_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4 NOT NULL,   "user_id" int4 NOT NULL,   "operation_type" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "operation_module" varchar(100) COLLATE "pg_catalog"."default",   "operation_object_type" varchar(100) COLLATE "pg_catalog"."default",   "operation_object_id" int4,   "operation_object_uuid" varchar(36) COLLATE "pg_catalog"."default",   "operation_content" text COLLATE "pg_catalog"."default",   "ip_address" varchar(50) COLLATE "pg_catalog"."default",   "user_agent" text COLLATE "pg_catalog"."default",   "request_method" varchar(10) COLLATE "pg_catalog"."default",   "request_path" varchar(500) COLLATE "pg_catalog"."default",   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP ) ;

        CREATE TABLE IF NOT EXISTS "public"."core_permissions" (   "id" int4 NOT NULL DEFAULT nextval('core_permissions_id_seq'::regclass),   "uuid" varchar COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4,   "name" varchar COLLATE "pg_catalog"."default" NOT NULL,   "code" varchar COLLATE "pg_catalog"."default" NOT NULL,   "resource" varchar COLLATE "pg_catalog"."default" NOT NULL,   "action" varchar COLLATE "pg_catalog"."default" NOT NULL,   "description" text COLLATE "pg_catalog"."default",   "permission_type" varchar COLLATE "pg_catalog"."default" DEFAULT 'function'::character varying,   "created_at" timestamptz(6) DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."core_positions" (   "id" int4 NOT NULL DEFAULT nextval('root_positions_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4,   "name" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,   "code" varchar(50) COLLATE "pg_catalog"."default",   "description" text COLLATE "pg_catalog"."default",   "department_id" int4,   "sort_order" int4 DEFAULT 0,   "is_active" bool DEFAULT true,   "created_at" timestamp(6) DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamp(6) DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamp(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."core_print_devices" (   "id" int4 NOT NULL DEFAULT nextval('root_print_devices_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4 NOT NULL,   "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,   "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "type" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "description" text COLLATE "pg_catalog"."default",   "config" jsonb NOT NULL,   "inngest_function_id" varchar(100) COLLATE "pg_catalog"."default",   "is_active" bool NOT NULL DEFAULT true,   "is_default" bool NOT NULL DEFAULT false,   "is_online" bool NOT NULL DEFAULT false,   "last_connected_at" timestamptz(6),   "usage_count" int4 NOT NULL DEFAULT 0,   "last_used_at" timestamptz(6),   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."core_print_templates" (   "id" int4 NOT NULL DEFAULT nextval('root_print_templates_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4 NOT NULL,   "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,   "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "type" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "description" text COLLATE "pg_catalog"."default",   "content" text COLLATE "pg_catalog"."default" NOT NULL,   "config" jsonb,   "inngest_function_id" varchar(100) COLLATE "pg_catalog"."default",   "is_active" bool NOT NULL DEFAULT true,   "is_default" bool NOT NULL DEFAULT false,   "usage_count" int4 NOT NULL DEFAULT 0,   "last_used_at" timestamptz(6),   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."core_role_permissions" (   "id" int4 NOT NULL DEFAULT nextval('root_role_permissions_id_seq'::regclass),   "role_id" int4 NOT NULL,   "permission_id" int4 NOT NULL,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP ) ;

        CREATE TABLE IF NOT EXISTS "public"."core_roles" (   "id" int4 NOT NULL DEFAULT nextval('core_roles_id_seq'::regclass),   "uuid" varchar COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4,   "name" varchar COLLATE "pg_catalog"."default" NOT NULL,   "code" varchar COLLATE "pg_catalog"."default" NOT NULL,   "description" text COLLATE "pg_catalog"."default",   "is_system" bool NOT NULL DEFAULT false,   "is_active" bool NOT NULL DEFAULT true,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."core_saved_searches" (   "id" int4 NOT NULL DEFAULT nextval('root_saved_searches_id_seq'::regclass),   "uuid" varchar COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4,   "user_id" int4 NOT NULL,   "page_path" varchar COLLATE "pg_catalog"."default" NOT NULL,   "name" varchar COLLATE "pg_catalog"."default" NOT NULL,   "is_shared" bool NOT NULL DEFAULT false,   "is_pinned" bool NOT NULL DEFAULT false,   "search_params" jsonb NOT NULL,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP ) ;

        CREATE TABLE IF NOT EXISTS "public"."core_scheduled_tasks" (   "id" int4 NOT NULL DEFAULT nextval('root_scheduled_tasks_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4 NOT NULL,   "name" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,   "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "description" text COLLATE "pg_catalog"."default",   "type" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,   "trigger_type" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,   "trigger_config" jsonb NOT NULL,   "task_config" jsonb NOT NULL,   "inngest_function_id" varchar(100) COLLATE "pg_catalog"."default",   "is_active" bool NOT NULL DEFAULT true,   "is_running" bool NOT NULL DEFAULT false,   "last_run_at" timestamptz(6),   "last_run_status" varchar(20) COLLATE "pg_catalog"."default",   "last_error" text COLLATE "pg_catalog"."default",   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."core_scripts" (   "id" int4 NOT NULL DEFAULT nextval('root_scripts_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4 NOT NULL,   "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,   "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "type" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,   "description" text COLLATE "pg_catalog"."default",   "content" text COLLATE "pg_catalog"."default" NOT NULL,   "config" jsonb,   "inngest_function_id" varchar(100) COLLATE "pg_catalog"."default",   "is_active" bool NOT NULL DEFAULT true,   "is_running" bool NOT NULL DEFAULT false,   "last_run_at" timestamptz(6),   "last_run_status" varchar(20) COLLATE "pg_catalog"."default",   "last_error" text COLLATE "pg_catalog"."default",   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."core_site_settings" (   "id" int4 NOT NULL DEFAULT nextval('sys_site_settings_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4,   "settings" jsonb NOT NULL DEFAULT '{}'::jsonb,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."core_system_parameters" (   "id" int4 NOT NULL DEFAULT nextval('sys_system_parameters_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4,   "key" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,   "value" text COLLATE "pg_catalog"."default" NOT NULL,   "type" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,   "description" text COLLATE "pg_catalog"."default",   "is_system" bool NOT NULL DEFAULT false,   "is_active" bool NOT NULL DEFAULT true,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6) ) ;

        CREATE TABLE IF NOT EXISTS "public"."core_user_preferences" (   "id" int4 NOT NULL DEFAULT nextval('root_user_preferences_id_seq'::regclass),   "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4 NOT NULL,   "user_id" int4 NOT NULL,   "preferences" jsonb NOT NULL DEFAULT '{}'::jsonb,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP ) ;

        CREATE TABLE IF NOT EXISTS "public"."core_user_roles" (   "id" int4 NOT NULL DEFAULT nextval('root_user_roles_id_seq'::regclass),   "user_id" int4 NOT NULL,   "role_id" int4 NOT NULL,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP ) ;

        CREATE TABLE IF NOT EXISTS "public"."core_users" (   "id" int4 NOT NULL DEFAULT nextval('core_users_id_seq'::regclass),   "uuid" varchar COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4,   "username" varchar COLLATE "pg_catalog"."default" NOT NULL,   "email" varchar COLLATE "pg_catalog"."default",   "password_hash" varchar COLLATE "pg_catalog"."default" NOT NULL,   "full_name" varchar COLLATE "pg_catalog"."default",   "is_active" bool NOT NULL DEFAULT true,   "is_infra_admin" bool NOT NULL DEFAULT false,   "is_tenant_admin" bool NOT NULL DEFAULT false,   "source" varchar COLLATE "pg_catalog"."default",   "last_login" timestamptz(6),   "department_id" int4,   "position_id" int4,   "phone" varchar COLLATE "pg_catalog"."default",   "avatar" varchar COLLATE "pg_catalog"."default",   "remark" text COLLATE "pg_catalog"."default",   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "deleted_at" timestamptz(6),   "bio" text COLLATE "pg_catalog"."default",   "contact_info" jsonb,   "gender" varchar(10) COLLATE "pg_catalog"."default" ) ;

        CREATE TABLE IF NOT EXISTS "public"."infra_packages" (   "id" int4 NOT NULL DEFAULT nextval('soil_packages_id_seq'::regclass),   "uuid" varchar COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4,   "name" varchar COLLATE "pg_catalog"."default" NOT NULL,   "plan" varchar COLLATE "pg_catalog"."default" NOT NULL,   "max_users" int4 NOT NULL,   "max_storage_mb" int4 NOT NULL,   "allow_pro_apps" bool NOT NULL DEFAULT false,   "description" text COLLATE "pg_catalog"."default",   "price" float8,   "features" jsonb NOT NULL,   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP ) ;

        CREATE TABLE IF NOT EXISTS "public"."infra_superadmin" (   "id" int4 NOT NULL DEFAULT nextval('soil_platform_superadmin_id_seq'::regclass),   "uuid" varchar COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4,   "username" varchar COLLATE "pg_catalog"."default" NOT NULL,   "email" varchar COLLATE "pg_catalog"."default",   "password_hash" varchar COLLATE "pg_catalog"."default" NOT NULL,   "full_name" varchar COLLATE "pg_catalog"."default",   "is_active" bool NOT NULL DEFAULT true,   "last_login" timestamptz(6),   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "avatar" varchar(36) COLLATE "pg_catalog"."default",   "bio" text COLLATE "pg_catalog"."default",   "contact_info" jsonb,   "gender" varchar(10) COLLATE "pg_catalog"."default",   "phone" varchar(20) COLLATE "pg_catalog"."default" ) ;

        CREATE TABLE IF NOT EXISTS "public"."infra_tenant_configs" (   "id" int4 NOT NULL DEFAULT nextval('core_tenant_configs_id_seq'::regclass),   "uuid" varchar COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4 NOT NULL,   "config_key" varchar COLLATE "pg_catalog"."default" NOT NULL,   "config_value" jsonb NOT NULL,   "description" text COLLATE "pg_catalog"."default",   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP ) ;

        CREATE TABLE IF NOT EXISTS "public"."infra_tenants" (   "id" int4 NOT NULL DEFAULT nextval('core_tenants_id_seq'::regclass),   "uuid" varchar COLLATE "pg_catalog"."default" NOT NULL,   "tenant_id" int4,   "name" varchar COLLATE "pg_catalog"."default" NOT NULL,   "domain" varchar COLLATE "pg_catalog"."default" NOT NULL,   "status" varchar COLLATE "pg_catalog"."default" NOT NULL DEFAULT 'inactive'::character varying,   "plan" varchar COLLATE "pg_catalog"."default" NOT NULL DEFAULT 'basic'::character varying,   "settings" jsonb NOT NULL,   "max_users" int4 NOT NULL DEFAULT 10,   "max_storage" int4 NOT NULL DEFAULT 1024,   "expires_at" timestamptz(6),   "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,   "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP ) ;


        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_bom_alternative_group_id" ON "public"."apps_master_data_bom" USING btree (   "alternative_group_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_bom_approval_status" ON "public"."apps_master_data_bom" USING btree (   "approval_status" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_bom_bom_code" ON "public"."apps_master_data_bom" USING btree (   "bom_code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_bom_component_id" ON "public"."apps_master_data_bom" USING btree (   "component_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_bom_created_at" ON "public"."apps_master_data_bom" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_bom_effective_date" ON "public"."apps_master_data_bom" USING btree (   "effective_date" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_bom_expiry_date" ON "public"."apps_master_data_bom" USING btree (   "expiry_date" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_bom_material_id" ON "public"."apps_master_data_bom" USING btree (   "material_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_bom_tenant_id" ON "public"."apps_master_data_bom" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_bom_uuid" ON "public"."apps_master_data_bom" USING btree (   "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_bom_version" ON "public"."apps_master_data_bom" USING btree (   "version" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_customers_category" ON "public"."apps_master_data_customers" USING btree (   "category" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_customers_code" ON "public"."apps_master_data_customers" USING btree (   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_customers_created_at" ON "public"."apps_master_data_customers" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_customers_tenant_code" ON "public"."apps_master_data_customers" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_customers_tenant_id" ON "public"."apps_master_data_customers" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_customers_uuid" ON "public"."apps_master_data_customers" USING btree (   "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_defect_types_category" ON "public"."apps_master_data_defect_types" USING btree (   "category" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_defect_types_code" ON "public"."apps_master_data_defect_types" USING btree (   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_defect_types_created_at" ON "public"."apps_master_data_defect_types" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_defect_types_tenant_code" ON "public"."apps_master_data_defect_types" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_defect_types_tenant_id" ON "public"."apps_master_data_defect_types" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_defect_types_uuid" ON "public"."apps_master_data_defect_types" USING btree (   "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_holidays_created_at" ON "public"."apps_master_data_holidays" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_holidays_holiday_date" ON "public"."apps_master_data_holidays" USING btree (   "holiday_date" "pg_catalog"."date_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_holidays_holiday_type" ON "public"."apps_master_data_holidays" USING btree (   "holiday_type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_holidays_tenant_id" ON "public"."apps_master_data_holidays" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_holidays_uuid" ON "public"."apps_master_data_holidays" USING btree (   "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_material_groups_code" ON "public"."apps_master_data_material_groups" USING btree (   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_material_groups_created_at" ON "public"."apps_master_data_material_groups" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_material_groups_parent_id" ON "public"."apps_master_data_material_groups" USING btree (   "parent_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_material_groups_tenant_code" ON "public"."apps_master_data_material_groups" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_material_groups_tenant_id" ON "public"."apps_master_data_material_groups" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_material_groups_uuid" ON "public"."apps_master_data_material_groups" USING btree (   "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_materials_code" ON "public"."apps_master_data_materials" USING btree (   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_materials_created_at" ON "public"."apps_master_data_materials" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_materials_group_id" ON "public"."apps_master_data_materials" USING btree (   "group_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_materials_tenant_code" ON "public"."apps_master_data_materials" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_materials_tenant_id" ON "public"."apps_master_data_materials" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_materials_uuid" ON "public"."apps_master_data_materials" USING btree (   "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_operations_code" ON "public"."apps_master_data_operations" USING btree (   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_operations_created_at" ON "public"."apps_master_data_operations" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_operations_tenant_code" ON "public"."apps_master_data_operations" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_operations_tenant_id" ON "public"."apps_master_data_operations" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_operations_uuid" ON "public"."apps_master_data_operations" USING btree (   "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_process_routes_code" ON "public"."apps_master_data_process_routes" USING btree (   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_process_routes_created_at" ON "public"."apps_master_data_process_routes" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_process_routes_tenant_code" ON "public"."apps_master_data_process_routes" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_process_routes_tenant_id" ON "public"."apps_master_data_process_routes" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_process_routes_uuid" ON "public"."apps_master_data_process_routes" USING btree (   "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_production_lines_code" ON "public"."apps_master_data_production_lines" USING btree (   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_production_lines_created_at" ON "public"."apps_master_data_production_lines" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_production_lines_tenant_code" ON "public"."apps_master_data_production_lines" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_production_lines_tenant_id" ON "public"."apps_master_data_production_lines" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_production_lines_uuid" ON "public"."apps_master_data_production_lines" USING btree (   "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_production_lines_workshop_id" ON "public"."apps_master_data_production_lines" USING btree (   "workshop_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_products_code" ON "public"."apps_master_data_products" USING btree (   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_products_created_at" ON "public"."apps_master_data_products" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_products_tenant_code" ON "public"."apps_master_data_products" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_products_tenant_id" ON "public"."apps_master_data_products" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_products_uuid" ON "public"."apps_master_data_products" USING btree (   "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_products_version" ON "public"."apps_master_data_products" USING btree (   "version" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_skills_category" ON "public"."apps_master_data_skills" USING btree (   "category" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_skills_code" ON "public"."apps_master_data_skills" USING btree (   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_skills_created_at" ON "public"."apps_master_data_skills" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_skills_tenant_code" ON "public"."apps_master_data_skills" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_skills_tenant_id" ON "public"."apps_master_data_skills" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_skills_uuid" ON "public"."apps_master_data_skills" USING btree (   "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_sop_code" ON "public"."apps_master_data_sop" USING btree (   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_sop_created_at" ON "public"."apps_master_data_sop" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_sop_operation_id" ON "public"."apps_master_data_sop" USING btree (   "operation_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_sop_tenant_code" ON "public"."apps_master_data_sop" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_sop_tenant_id" ON "public"."apps_master_data_sop" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_sop_uuid" ON "public"."apps_master_data_sop" USING btree (   "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_sop_executions_created_at" ON "public"."apps_master_data_sop_executions" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_sop_executions_current_node_id" ON "public"."apps_master_data_sop_executions" USING btree (   "current_node_id" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_sop_executions_executor_id" ON "public"."apps_master_data_sop_executions" USING btree (   "executor_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_sop_executions_inngest_run_id" ON "public"."apps_master_data_sop_executions" USING btree (   "inngest_run_id" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_sop_executions_sop_id" ON "public"."apps_master_data_sop_executions" USING btree (   "sop_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_sop_executions_status" ON "public"."apps_master_data_sop_executions" USING btree (   "status" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_sop_executions_tenant_created_at" ON "public"."apps_master_data_sop_executions" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_sop_executions_tenant_executor_status" ON "public"."apps_master_data_sop_executions" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,   "executor_id" "pg_catalog"."int4_ops" ASC NULLS LAST,   "status" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_sop_executions_tenant_id" ON "public"."apps_master_data_sop_executions" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_sop_executions_tenant_status" ON "public"."apps_master_data_sop_executions" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,   "status" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_sop_executions_uuid" ON "public"."apps_master_data_sop_executions" USING btree (   "uuid" "pg_catalog"."uuid_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_storage_areas_code" ON "public"."apps_master_data_storage_areas" USING btree (   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_storage_areas_created_at" ON "public"."apps_master_data_storage_areas" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_storage_areas_tenant_code" ON "public"."apps_master_data_storage_areas" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_storage_areas_tenant_id" ON "public"."apps_master_data_storage_areas" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_storage_areas_uuid" ON "public"."apps_master_data_storage_areas" USING btree (   "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_storage_areas_warehouse_id" ON "public"."apps_master_data_storage_areas" USING btree (   "warehouse_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_storage_locations_code" ON "public"."apps_master_data_storage_locations" USING btree (   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_storage_locations_created_at" ON "public"."apps_master_data_storage_locations" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_storage_locations_storage_area_id" ON "public"."apps_master_data_storage_locations" USING btree (   "storage_area_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_storage_locations_tenant_code" ON "public"."apps_master_data_storage_locations" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_storage_locations_tenant_id" ON "public"."apps_master_data_storage_locations" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_storage_locations_uuid" ON "public"."apps_master_data_storage_locations" USING btree (   "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_suppliers_category" ON "public"."apps_master_data_suppliers" USING btree (   "category" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_suppliers_code" ON "public"."apps_master_data_suppliers" USING btree (   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_suppliers_created_at" ON "public"."apps_master_data_suppliers" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_suppliers_tenant_code" ON "public"."apps_master_data_suppliers" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_suppliers_tenant_id" ON "public"."apps_master_data_suppliers" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_suppliers_uuid" ON "public"."apps_master_data_suppliers" USING btree (   "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_warehouses_code" ON "public"."apps_master_data_warehouses" USING btree (   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_warehouses_created_at" ON "public"."apps_master_data_warehouses" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_warehouses_tenant_code" ON "public"."apps_master_data_warehouses" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_warehouses_tenant_id" ON "public"."apps_master_data_warehouses" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_warehouses_uuid" ON "public"."apps_master_data_warehouses" USING btree (   "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_workshops_code" ON "public"."apps_master_data_workshops" USING btree (   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_workshops_created_at" ON "public"."apps_master_data_workshops" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_workshops_tenant_code" ON "public"."apps_master_data_workshops" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_workshops_tenant_id" ON "public"."apps_master_data_workshops" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_workshops_uuid" ON "public"."apps_master_data_workshops" USING btree (   "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_workstations_code" ON "public"."apps_master_data_workstations" USING btree (   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_workstations_created_at" ON "public"."apps_master_data_workstations" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_workstations_production_line_id" ON "public"."apps_master_data_workstations" USING btree (   "production_line_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_workstations_tenant_code" ON "public"."apps_master_data_workstations" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_workstations_tenant_id" ON "public"."apps_master_data_workstations" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_workstations_uuid" ON "public"."apps_master_data_workstations" USING btree (   "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_apis_code" ON "public"."core_apis" USING btree (   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_apis_created_at" ON "public"."core_apis" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_apis_method" ON "public"."core_apis" USING btree (   "method" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_apis_tenant_id" ON "public"."core_apis" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_apis_uuid" ON "public"."core_apis" USING btree (   "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_core_apis_tenant_code" ON "public"."core_apis" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST ) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS "idx_core_applic_code_a1b2c4" ON "public"."core_applications" USING btree (   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_applic_created_a1b2c6" ON "public"."core_applications" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_applic_tenant__a1b2c3" ON "public"."core_applications" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_applic_uuid_a1b2c5" ON "public"."core_applications" USING btree (   "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_approv_action__0f4144" ON "public"."core_approval_histories" USING btree (   "action_by" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_approv_action__b16310" ON "public"."core_approval_histories" USING btree (   "action_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_approv_action_bd31f0" ON "public"."core_approval_histories" USING btree (   "action" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_approv_approva_a2dd10" ON "public"."core_approval_histories" USING btree (   "approval_instance_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_approv_tenant__89d1d6" ON "public"."core_approval_histories" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_approv_uuid_9a1b94" ON "public"."core_approval_histories" USING btree (   "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_approval_instances_created_at" ON "public"."core_approval_instances" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_approval_instances_current_approver_id" ON "public"."core_approval_instances" USING btree (   "current_approver_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_approval_instances_inngest_run_id" ON "public"."core_approval_instances" USING btree (   "inngest_run_id" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_approval_instances_process_id" ON "public"."core_approval_instances" USING btree (   "process_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_approval_instances_status" ON "public"."core_approval_instances" USING btree (   "status" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_approval_instances_submitter_id" ON "public"."core_approval_instances" USING btree (   "submitter_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_approval_instances_tenant_id" ON "public"."core_approval_instances" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_approval_instances_uuid" ON "public"."core_approval_instances" USING btree (   "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_approval_processes_code" ON "public"."core_approval_processes" USING btree (   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_approval_processes_created_at" ON "public"."core_approval_processes" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_approval_processes_is_active" ON "public"."core_approval_processes" USING btree (   "is_active" "pg_catalog"."bool_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_approval_processes_tenant_id" ON "public"."core_approval_processes" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_approval_processes_uuid" ON "public"."core_approval_processes" USING btree (   "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_core_approval_processes_tenant_code" ON "public"."core_approval_processes" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST ) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS "idx_core_code_r_code_e9f4g5" ON "public"."core_code_rules" USING btree (   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_code_r_created_f9g4h5" ON "public"."core_code_rules" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_code_r_tenant__d9e4f5" ON "public"."core_code_rules" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_code_s_code_ru_g9h4i5" ON "public"."core_code_sequences" USING btree (   "code_rule_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_code_s_tenant__h9i4j5" ON "public"."core_code_sequences" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_custom_v_created_o9p4q5" ON "public"."core_custom_field_values" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_custom_v_custom__l9m4n5" ON "public"."core_custom_field_values" USING btree (   "custom_field_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_custom_v_record_n9o4p5" ON "public"."core_custom_field_values" USING btree (   "record_table" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST,   "record_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_custom_v_tenant__m9n4o5" ON "public"."core_custom_field_values" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_custom_created_k9l4m5" ON "public"."core_custom_fields" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_custom_table__j9k4l5" ON "public"."core_custom_fields" USING btree (   "table_name" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_custom_tenant__i9j4k5" ON "public"."core_custom_fields" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_data_backups_backup_scope" ON "public"."core_data_backups" USING btree (   "backup_scope" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_data_backups_backup_type" ON "public"."core_data_backups" USING btree (   "backup_type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_data_backups_created_at" ON "public"."core_data_backups" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_data_backups_status" ON "public"."core_data_backups" USING btree (   "status" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_data_backups_tenant_id" ON "public"."core_data_backups" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_data_backups_uuid" ON "public"."core_data_backups" USING btree (   "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_data_di_code_c8d3e4" ON "public"."core_data_dictionaries" USING btree (   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_data_di_created_d8e3f4" ON "public"."core_data_dictionaries" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_data_di_tenant__a8b3c4" ON "public"."core_data_dictionaries" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_data_di_uuid_b8c3d4" ON "public"."core_data_dictionaries" USING btree (   "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_data_sources_code" ON "public"."core_data_sources" USING btree (   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_data_sources_created_at" ON "public"."core_data_sources" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_data_sources_tenant_id" ON "public"."core_data_sources" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_data_sources_type" ON "public"."core_data_sources" USING btree (   "type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_data_sources_uuid" ON "public"."core_data_sources" USING btree (   "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_core_data_sources_tenant_code" ON "public"."core_data_sources" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST ) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS "idx_core_datasets_code" ON "public"."core_datasets" USING btree (   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_datasets_created_at" ON "public"."core_datasets" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_datasets_data_source_id" ON "public"."core_datasets" USING btree (   "data_source_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_datasets_tenant_id" ON "public"."core_datasets" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_datasets_uuid" ON "public"."core_datasets" USING btree (   "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_core_datasets_tenant_code" ON "public"."core_datasets" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST ) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS "idx_core_departments_created_at" ON "public"."core_departments" USING btree (   "created_at" "pg_catalog"."timestamp_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_departments_manager_id" ON "public"."core_departments" USING btree (   "manager_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_departments_parent_id" ON "public"."core_departments" USING btree (   "parent_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_departments_sort_order" ON "public"."core_departments" USING btree (   "sort_order" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_departments_tenant_id" ON "public"."core_departments" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_dictio_created_e9f4g5" ON "public"."core_dictionary_items" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_dictio_diction_c9d4e5" ON "public"."core_dictionary_items" USING btree (   "dictionary_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_dictio_sort_or_d9e4f5" ON "public"."core_dictionary_items" USING btree (   "sort_order" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_dictio_tenant__b9c4d5" ON "public"."core_dictionary_items" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_electronic_records_code" ON "public"."core_electronic_records" USING btree (   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_electronic_records_created_at" ON "public"."core_electronic_records" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_electronic_records_lifecycle_stage" ON "public"."core_electronic_records" USING btree (   "lifecycle_stage" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_electronic_records_status" ON "public"."core_electronic_records" USING btree (   "status" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_electronic_records_tenant_id" ON "public"."core_electronic_records" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_electronic_records_type" ON "public"."core_electronic_records" USING btree (   "type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_electronic_records_uuid" ON "public"."core_electronic_records" USING btree (   "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_core_electronic_records_tenant_code" ON "public"."core_electronic_records" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST ) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS "idx_core_files_category" ON "public"."core_files" USING btree (   "category" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_files_created_at" ON "public"."core_files" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_files_file_type" ON "public"."core_files" USING btree (   "file_type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_files_tenant_id" ON "public"."core_files" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_files_upload_status" ON "public"."core_files" USING btree (   "upload_status" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_files_uuid" ON "public"."core_files" USING btree (   "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_integra_code_b1c2d4" ON "public"."core_integration_configs" USING btree (   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_integra_created_b1c2d7" ON "public"."core_integration_configs" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_integra_tenant__b1c2d3" ON "public"."core_integration_configs" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_integra_type_b1c2d6" ON "public"."core_integration_configs" USING btree (   "type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_integra_uuid_b1c2d5" ON "public"."core_integration_configs" USING btree (   "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_invita_code_s9t4u5" ON "public"."core_invitation_codes" USING btree (   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_invita_created_t9u4v5" ON "public"."core_invitation_codes" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_invita_tenant__r9s4t5" ON "public"."core_invitation_codes" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_languag_code_v9w4x5" ON "public"."core_languages" USING btree (   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_languag_created_w9x4y5" ON "public"."core_languages" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_languag_tenant__u9v4w5" ON "public"."core_languages" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_login_logs_created_at" ON "public"."core_login_logs" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_login_logs_login_ip" ON "public"."core_login_logs" USING btree (   "login_ip" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_login_logs_login_status" ON "public"."core_login_logs" USING btree (   "login_status" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_login_logs_tenant_id" ON "public"."core_login_logs" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_login_logs_user_id" ON "public"."core_login_logs" USING btree (   "user_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_login_logs_username" ON "public"."core_login_logs" USING btree (   "username" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_login_logs_uuid" ON "public"."core_login_logs" USING btree (   "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_menus_application_uuid" ON "public"."core_menus" USING btree (   "application_uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_menus_created_at" ON "public"."core_menus" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_menus_is_active" ON "public"."core_menus" USING btree (   "is_active" "pg_catalog"."bool_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_menus_parent_id" ON "public"."core_menus" USING btree (   "parent_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_menus_permission_code" ON "public"."core_menus" USING btree (   "permission_code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_menus_sort_order" ON "public"."core_menus" USING btree (   "sort_order" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_menus_tenant_id" ON "public"."core_menus" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_message_configs_code" ON "public"."core_message_configs" USING btree (   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_message_configs_created_at" ON "public"."core_message_configs" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_message_configs_tenant_id" ON "public"."core_message_configs" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_message_configs_type" ON "public"."core_message_configs" USING btree (   "type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_message_configs_uuid" ON "public"."core_message_configs" USING btree (   "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_core_message_configs_tenant_code" ON "public"."core_message_configs" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST ) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS "idx_core_message_logs_config_uuid" ON "public"."core_message_logs" USING btree (   "config_uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_message_logs_created_at" ON "public"."core_message_logs" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_message_logs_inngest_run_id" ON "public"."core_message_logs" USING btree (   "inngest_run_id" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_message_logs_status" ON "public"."core_message_logs" USING btree (   "status" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_message_logs_template_uuid" ON "public"."core_message_logs" USING btree (   "template_uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_message_logs_tenant_id" ON "public"."core_message_logs" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_message_logs_type" ON "public"."core_message_logs" USING btree (   "type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_message_logs_uuid" ON "public"."core_message_logs" USING btree (   "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_message_templates_code" ON "public"."core_message_templates" USING btree (   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_message_templates_created_at" ON "public"."core_message_templates" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_message_templates_tenant_id" ON "public"."core_message_templates" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_message_templates_type" ON "public"."core_message_templates" USING btree (   "type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_message_templates_uuid" ON "public"."core_message_templates" USING btree (   "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_core_message_templates_tenant_code" ON "public"."core_message_templates" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST ) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS "idx_core_operation_logs_created_at" ON "public"."core_operation_logs" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_operation_logs_operation_module" ON "public"."core_operation_logs" USING btree (   "operation_module" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_operation_logs_operation_object_type" ON "public"."core_operation_logs" USING btree (   "operation_object_type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_operation_logs_operation_type" ON "public"."core_operation_logs" USING btree (   "operation_type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_operation_logs_tenant_id" ON "public"."core_operation_logs" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_operation_logs_user_id" ON "public"."core_operation_logs" USING btree (   "user_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_operation_logs_uuid" ON "public"."core_operation_logs" USING btree (   "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_permiss_code_b35ea3" ON "public"."core_permissions" USING btree (   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_permiss_permiss_8e9b79" ON "public"."core_permissions" USING btree (   "permission_type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_permiss_resourc_941e0b" ON "public"."core_permissions" USING btree (   "resource" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_permiss_tenant__99f233" ON "public"."core_permissions" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_positions_code" ON "public"."core_positions" USING btree (   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_positions_created_at" ON "public"."core_positions" USING btree (   "created_at" "pg_catalog"."timestamp_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_positions_department_id" ON "public"."core_positions" USING btree (   "department_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_positions_sort_order" ON "public"."core_positions" USING btree (   "sort_order" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_positions_tenant_id" ON "public"."core_positions" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_print_devices_code" ON "public"."core_print_devices" USING btree (   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_print_devices_created_at" ON "public"."core_print_devices" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_print_devices_is_active" ON "public"."core_print_devices" USING btree (   "is_active" "pg_catalog"."bool_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_print_devices_is_default" ON "public"."core_print_devices" USING btree (   "is_default" "pg_catalog"."bool_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_print_devices_is_online" ON "public"."core_print_devices" USING btree (   "is_online" "pg_catalog"."bool_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_print_devices_tenant_id" ON "public"."core_print_devices" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_print_devices_type" ON "public"."core_print_devices" USING btree (   "type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_print_devices_uuid" ON "public"."core_print_devices" USING btree (   "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_core_print_devices_tenant_code" ON "public"."core_print_devices" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST ) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS "idx_core_print_templates_code" ON "public"."core_print_templates" USING btree (   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_print_templates_created_at" ON "public"."core_print_templates" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_print_templates_is_active" ON "public"."core_print_templates" USING btree (   "is_active" "pg_catalog"."bool_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_print_templates_is_default" ON "public"."core_print_templates" USING btree (   "is_default" "pg_catalog"."bool_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_print_templates_tenant_id" ON "public"."core_print_templates" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_print_templates_type" ON "public"."core_print_templates" USING btree (   "type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_print_templates_uuid" ON "public"."core_print_templates" USING btree (   "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_core_print_templates_tenant_code" ON "public"."core_print_templates" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST ) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS "idx_core_scheduled_tasks_code" ON "public"."core_scheduled_tasks" USING btree (   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_scheduled_tasks_created_at" ON "public"."core_scheduled_tasks" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_scheduled_tasks_is_active" ON "public"."core_scheduled_tasks" USING btree (   "is_active" "pg_catalog"."bool_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_scheduled_tasks_tenant_id" ON "public"."core_scheduled_tasks" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_scheduled_tasks_trigger_type" ON "public"."core_scheduled_tasks" USING btree (   "trigger_type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_scheduled_tasks_type" ON "public"."core_scheduled_tasks" USING btree (   "type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_scheduled_tasks_uuid" ON "public"."core_scheduled_tasks" USING btree (   "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_core_scheduled_tasks_tenant_code" ON "public"."core_scheduled_tasks" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST ) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS "idx_core_scripts_code" ON "public"."core_scripts" USING btree (   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_scripts_created_at" ON "public"."core_scripts" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_scripts_is_active" ON "public"."core_scripts" USING btree (   "is_active" "pg_catalog"."bool_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_scripts_tenant_id" ON "public"."core_scripts" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_scripts_type" ON "public"."core_scripts" USING btree (   "type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_scripts_uuid" ON "public"."core_scripts" USING btree (   "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_core_scripts_tenant_code" ON "public"."core_scripts" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,   "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST ) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS "idx_core_site_s_created_q9r4s5" ON "public"."core_site_settings" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_site_s_tenant__p9q4r5" ON "public"."core_site_settings" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_system_created_e9f4g5" ON "public"."core_system_parameters" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_system_key_d9e4f5" ON "public"."core_system_parameters" USING btree (   "key" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_system_tenant__c9d4e5" ON "public"."core_system_parameters" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_user_preferences_created_at" ON "public"."core_user_preferences" USING btree (   "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_user_preferences_tenant_id" ON "public"."core_user_preferences" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_user_preferences_user_id" ON "public"."core_user_preferences" USING btree (   "user_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_user_preferences_uuid" ON "public"."core_user_preferences" USING btree (   "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_core_user_preferences_user_id" ON "public"."core_user_preferences" USING btree (   "user_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_users_departm_7e45f0" ON "public"."core_users" USING btree (   "department_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_users_is_infra_admin" ON "public"."core_users" USING btree (   "is_infra_admin" "pg_catalog"."bool_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_users_phone_cc3c13" ON "public"."core_users" USING btree (   "phone" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_users_positio_b5fd30" ON "public"."core_users" USING btree (   "position_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_users_tenant__26aebd" ON "public"."core_users" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,   "username" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_users_tenant__9fa158" ON "public"."core_users" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_core_users_usernam_04037b" ON "public"."core_users" USING btree (   "username" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_infra_packag_plan_493a83" ON "public"."infra_packages" USING btree (   "plan" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_infra_packag_tenant__e2698a" ON "public"."infra_packages" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_infra_platfo_tenant__281c88" ON "public"."infra_superadmin" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_infra_platfo_usernam_84921b" ON "public"."infra_superadmin" USING btree (   "username" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_infra_tenant_domain_4aeb51" ON "public"."infra_tenants" USING btree (   "domain" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_infra_tenant_plan_b8d0f3" ON "public"."infra_tenants" USING btree (   "plan" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_infra_tenant_status_51be99" ON "public"."infra_tenants" USING btree (   "status" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST );
        CREATE INDEX IF NOT EXISTS "idx_infra_tenant_tenant__481a89" ON "public"."infra_tenants" USING btree (   "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST );

        -- 添加表注释和字段注释
        COMMENT ON TABLE "public"."aerich" IS 'Aerich 迁移工具表（用于跟踪数据库迁移历史）';
        COMMENT ON TABLE "public"."apps_master_data_bom" IS 'BOM（物料清单）表';
        COMMENT ON TABLE "public"."apps_master_data_customers" IS '客户表';
        COMMENT ON TABLE "public"."apps_master_data_defect_types" IS '缺陷类型表';
        COMMENT ON TABLE "public"."apps_master_data_holidays" IS '节假日表';
        COMMENT ON TABLE "public"."apps_master_data_material_groups" IS '物料组表';
        COMMENT ON TABLE "public"."apps_master_data_materials" IS '物料表';
        COMMENT ON TABLE "public"."apps_master_data_operations" IS '工序表';
        COMMENT ON TABLE "public"."apps_master_data_process_routes" IS '工艺路线表';
        COMMENT ON TABLE "public"."apps_master_data_production_lines" IS '生产线表';
        COMMENT ON TABLE "public"."apps_master_data_products" IS '产品表';
        COMMENT ON TABLE "public"."apps_master_data_skills" IS '技能表';
        COMMENT ON TABLE "public"."apps_master_data_sop" IS 'SOP（标准作业程序）表';
        COMMENT ON TABLE "public"."apps_master_data_sop_executions" IS 'SOP执行记录表';
        COMMENT ON TABLE "public"."apps_master_data_storage_areas" IS '存储区域表';
        COMMENT ON TABLE "public"."apps_master_data_storage_locations" IS '存储位置表';
        COMMENT ON TABLE "public"."apps_master_data_suppliers" IS '供应商表';
        COMMENT ON TABLE "public"."apps_master_data_warehouses" IS '仓库表';
        COMMENT ON TABLE "public"."apps_master_data_workshops" IS '车间表';
        COMMENT ON TABLE "public"."apps_master_data_workstations" IS '工作站表';
        COMMENT ON TABLE "public"."core_apis" IS '接口表';
        COMMENT ON TABLE "public"."core_applications" IS '应用表';
        COMMENT ON COLUMN "public"."core_approval_histories"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
        COMMENT ON COLUMN "public"."core_approval_histories"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
        COMMENT ON COLUMN "public"."core_approval_histories"."created_at" IS '创建时间（UTC）';
        COMMENT ON COLUMN "public"."core_approval_histories"."updated_at" IS '更新时间（UTC）';
        COMMENT ON COLUMN "public"."core_approval_histories"."id" IS '主键ID';
        COMMENT ON COLUMN "public"."core_approval_histories"."approval_instance_id" IS '审批实例ID（关联ApprovalInstance）';
        COMMENT ON COLUMN "public"."core_approval_histories"."action" IS '操作类型（approve、reject、cancel、transfer）';
        COMMENT ON COLUMN "public"."core_approval_histories"."action_by" IS '操作人ID（用户ID）';
        COMMENT ON COLUMN "public"."core_approval_histories"."action_at" IS '操作时间';
        COMMENT ON COLUMN "public"."core_approval_histories"."comment" IS '审批意见';
        COMMENT ON COLUMN "public"."core_approval_histories"."from_node" IS '来源节点';
        COMMENT ON COLUMN "public"."core_approval_histories"."to_node" IS '目标节点';
        COMMENT ON COLUMN "public"."core_approval_histories"."from_approver_id" IS '原审批人ID';
        COMMENT ON COLUMN "public"."core_approval_histories"."to_approver_id" IS '新审批人ID';
        COMMENT ON TABLE "public"."core_approval_histories" IS '审批历史记录模型';
        COMMENT ON TABLE "public"."core_approval_instances" IS '审批实例表';
        COMMENT ON TABLE "public"."core_approval_processes" IS '审批流程表';
        COMMENT ON TABLE "public"."core_code_rules" IS '编码规则表';
        COMMENT ON TABLE "public"."core_code_sequences" IS '编码序号表';
        COMMENT ON TABLE "public"."core_custom_field_values" IS '自定义字段值表';
        COMMENT ON TABLE "public"."core_custom_fields" IS '自定义字段表';
        COMMENT ON TABLE "public"."core_data_backups" IS '数据备份表';
        COMMENT ON TABLE "public"."core_data_dictionaries" IS '数据字典表';
        COMMENT ON TABLE "public"."core_data_sources" IS '数据源表';
        COMMENT ON TABLE "public"."core_datasets" IS '数据集表';
        COMMENT ON TABLE "public"."core_departments" IS '部门表';
        COMMENT ON TABLE "public"."core_dictionary_items" IS '数据字典项表';
        COMMENT ON TABLE "public"."core_electronic_records" IS '电子记录表';
        COMMENT ON TABLE "public"."core_files" IS '文件表';
        COMMENT ON TABLE "public"."core_integration_configs" IS '集成配置表';
        COMMENT ON TABLE "public"."core_invitation_codes" IS '邀请码表';
        COMMENT ON TABLE "public"."core_languages" IS '语言表';
        COMMENT ON TABLE "public"."core_login_logs" IS '登录日志表';
        COMMENT ON TABLE "public"."core_menus" IS '菜单表';
        COMMENT ON TABLE "public"."core_message_configs" IS '消息配置表';
        COMMENT ON TABLE "public"."core_message_logs" IS '消息日志表';
        COMMENT ON TABLE "public"."core_message_templates" IS '消息模板表';
        COMMENT ON TABLE "public"."core_operation_logs" IS '操作日志表';
        COMMENT ON TABLE "public"."core_permissions" IS '权限表';
        COMMENT ON TABLE "public"."core_positions" IS '职位表';
        COMMENT ON TABLE "public"."core_print_devices" IS '打印设备表';
        COMMENT ON TABLE "public"."core_print_templates" IS '打印模板表';
        COMMENT ON TABLE "public"."core_role_permissions" IS '角色权限关联表';
        COMMENT ON TABLE "public"."core_roles" IS '角色表';
        COMMENT ON TABLE "public"."core_saved_searches" IS '保存的搜索表';
        COMMENT ON TABLE "public"."core_scheduled_tasks" IS '定时任务表';
        COMMENT ON TABLE "public"."core_scripts" IS '脚本表';
        COMMENT ON TABLE "public"."core_site_settings" IS '站点设置表';
        COMMENT ON TABLE "public"."core_system_parameters" IS '系统参数表';
        COMMENT ON TABLE "public"."core_user_preferences" IS '用户偏好表';
        COMMENT ON TABLE "public"."core_user_roles" IS '用户角色关联表';
        COMMENT ON TABLE "public"."core_users" IS '用户表';
        COMMENT ON TABLE "public"."infra_packages" IS '套餐表';
        COMMENT ON TABLE "public"."infra_superadmin" IS '平台超级管理员表';
        COMMENT ON TABLE "public"."infra_tenant_configs" IS '租户配置表';
        COMMENT ON TABLE "public"."infra_tenants" IS '租户表';

    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除所有数据库结构
    
    警告：此操作会删除所有表和数据，请谨慎使用！
    """
    return """
    -- 降级操作：删除所有表
    -- 注意：此操作会删除所有数据，请谨慎使用！
    
    -- 由于表之间存在外键依赖，需要按顺序删除
    -- 这里只提供示例，实际使用时需要根据依赖关系调整顺序
    
    -- DROP TABLE IF EXISTS "table_name" CASCADE;
    """


MODELS_STATE = (
    "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"
)
