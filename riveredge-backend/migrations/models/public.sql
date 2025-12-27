/*
 Navicat Premium Dump SQL

 Source Server         : 本地 Postgre
 Source Server Type    : PostgreSQL
 Source Server Version : 150014 (150014)
 Source Host           : localhost:5432
 Source Catalog        : riveredge
 Source Schema         : public

 Target Server Type    : PostgreSQL
 Target Server Version : 150014 (150014)
 File Encoding         : 65001

 Date: 27/12/2025 13:19:14
*/


-- ----------------------------
-- Sequence structure for aerich_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."aerich_id_seq";
CREATE SEQUENCE "public"."aerich_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for core_approval_histories_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."core_approval_histories_id_seq";
CREATE SEQUENCE "public"."core_approval_histories_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for core_permissions_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."core_permissions_id_seq";
CREATE SEQUENCE "public"."core_permissions_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for core_roles_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."core_roles_id_seq";
CREATE SEQUENCE "public"."core_roles_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for core_tenant_configs_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."core_tenant_configs_id_seq";
CREATE SEQUENCE "public"."core_tenant_configs_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for core_tenants_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."core_tenants_id_seq";
CREATE SEQUENCE "public"."core_tenants_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for core_users_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."core_users_id_seq";
CREATE SEQUENCE "public"."core_users_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for root_apis_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."root_apis_id_seq";
CREATE SEQUENCE "public"."root_apis_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for root_applications_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."root_applications_id_seq";
CREATE SEQUENCE "public"."root_applications_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for root_approval_instances_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."root_approval_instances_id_seq";
CREATE SEQUENCE "public"."root_approval_instances_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for root_approval_processes_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."root_approval_processes_id_seq";
CREATE SEQUENCE "public"."root_approval_processes_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for root_data_backups_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."root_data_backups_id_seq";
CREATE SEQUENCE "public"."root_data_backups_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for root_data_sources_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."root_data_sources_id_seq";
CREATE SEQUENCE "public"."root_data_sources_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for root_datasets_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."root_datasets_id_seq";
CREATE SEQUENCE "public"."root_datasets_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for root_departments_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."root_departments_id_seq";
CREATE SEQUENCE "public"."root_departments_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for root_electronic_records_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."root_electronic_records_id_seq";
CREATE SEQUENCE "public"."root_electronic_records_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for root_files_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."root_files_id_seq";
CREATE SEQUENCE "public"."root_files_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for root_integration_configs_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."root_integration_configs_id_seq";
CREATE SEQUENCE "public"."root_integration_configs_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for root_login_logs_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."root_login_logs_id_seq";
CREATE SEQUENCE "public"."root_login_logs_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for root_menus_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."root_menus_id_seq";
CREATE SEQUENCE "public"."root_menus_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for root_message_configs_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."root_message_configs_id_seq";
CREATE SEQUENCE "public"."root_message_configs_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for root_message_logs_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."root_message_logs_id_seq";
CREATE SEQUENCE "public"."root_message_logs_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for root_message_templates_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."root_message_templates_id_seq";
CREATE SEQUENCE "public"."root_message_templates_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for root_operation_logs_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."root_operation_logs_id_seq";
CREATE SEQUENCE "public"."root_operation_logs_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for root_positions_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."root_positions_id_seq";
CREATE SEQUENCE "public"."root_positions_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for root_print_devices_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."root_print_devices_id_seq";
CREATE SEQUENCE "public"."root_print_devices_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for root_print_templates_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."root_print_templates_id_seq";
CREATE SEQUENCE "public"."root_print_templates_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for root_role_permissions_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."root_role_permissions_id_seq";
CREATE SEQUENCE "public"."root_role_permissions_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for root_saved_searches_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."root_saved_searches_id_seq";
CREATE SEQUENCE "public"."root_saved_searches_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for root_scheduled_tasks_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."root_scheduled_tasks_id_seq";
CREATE SEQUENCE "public"."root_scheduled_tasks_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for root_scripts_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."root_scripts_id_seq";
CREATE SEQUENCE "public"."root_scripts_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for root_user_preferences_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."root_user_preferences_id_seq";
CREATE SEQUENCE "public"."root_user_preferences_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for root_user_roles_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."root_user_roles_id_seq";
CREATE SEQUENCE "public"."root_user_roles_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for seed_master_data_bom_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."seed_master_data_bom_id_seq";
CREATE SEQUENCE "public"."seed_master_data_bom_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for seed_master_data_customers_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."seed_master_data_customers_id_seq";
CREATE SEQUENCE "public"."seed_master_data_customers_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for seed_master_data_defect_types_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."seed_master_data_defect_types_id_seq";
CREATE SEQUENCE "public"."seed_master_data_defect_types_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for seed_master_data_holidays_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."seed_master_data_holidays_id_seq";
CREATE SEQUENCE "public"."seed_master_data_holidays_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for seed_master_data_material_groups_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."seed_master_data_material_groups_id_seq";
CREATE SEQUENCE "public"."seed_master_data_material_groups_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for seed_master_data_materials_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."seed_master_data_materials_id_seq";
CREATE SEQUENCE "public"."seed_master_data_materials_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for seed_master_data_operations_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."seed_master_data_operations_id_seq";
CREATE SEQUENCE "public"."seed_master_data_operations_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for seed_master_data_process_routes_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."seed_master_data_process_routes_id_seq";
CREATE SEQUENCE "public"."seed_master_data_process_routes_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for seed_master_data_production_lines_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."seed_master_data_production_lines_id_seq";
CREATE SEQUENCE "public"."seed_master_data_production_lines_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for seed_master_data_products_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."seed_master_data_products_id_seq";
CREATE SEQUENCE "public"."seed_master_data_products_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for seed_master_data_skills_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."seed_master_data_skills_id_seq";
CREATE SEQUENCE "public"."seed_master_data_skills_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for seed_master_data_sop_executions_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."seed_master_data_sop_executions_id_seq";
CREATE SEQUENCE "public"."seed_master_data_sop_executions_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for seed_master_data_sop_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."seed_master_data_sop_id_seq";
CREATE SEQUENCE "public"."seed_master_data_sop_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for seed_master_data_storage_areas_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."seed_master_data_storage_areas_id_seq";
CREATE SEQUENCE "public"."seed_master_data_storage_areas_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for seed_master_data_storage_locations_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."seed_master_data_storage_locations_id_seq";
CREATE SEQUENCE "public"."seed_master_data_storage_locations_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for seed_master_data_suppliers_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."seed_master_data_suppliers_id_seq";
CREATE SEQUENCE "public"."seed_master_data_suppliers_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for seed_master_data_warehouses_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."seed_master_data_warehouses_id_seq";
CREATE SEQUENCE "public"."seed_master_data_warehouses_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for seed_master_data_workshops_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."seed_master_data_workshops_id_seq";
CREATE SEQUENCE "public"."seed_master_data_workshops_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for seed_master_data_workstations_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."seed_master_data_workstations_id_seq";
CREATE SEQUENCE "public"."seed_master_data_workstations_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for soil_packages_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."soil_packages_id_seq";
CREATE SEQUENCE "public"."soil_packages_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for soil_platform_superadmin_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."soil_platform_superadmin_id_seq";
CREATE SEQUENCE "public"."soil_platform_superadmin_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for sys_code_rules_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."sys_code_rules_id_seq";
CREATE SEQUENCE "public"."sys_code_rules_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for sys_code_sequences_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."sys_code_sequences_id_seq";
CREATE SEQUENCE "public"."sys_code_sequences_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for sys_custom_field_values_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."sys_custom_field_values_id_seq";
CREATE SEQUENCE "public"."sys_custom_field_values_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for sys_custom_fields_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."sys_custom_fields_id_seq";
CREATE SEQUENCE "public"."sys_custom_fields_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for sys_data_dictionaries_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."sys_data_dictionaries_id_seq";
CREATE SEQUENCE "public"."sys_data_dictionaries_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for sys_dictionary_items_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."sys_dictionary_items_id_seq";
CREATE SEQUENCE "public"."sys_dictionary_items_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for sys_invitation_codes_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."sys_invitation_codes_id_seq";
CREATE SEQUENCE "public"."sys_invitation_codes_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for sys_languages_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."sys_languages_id_seq";
CREATE SEQUENCE "public"."sys_languages_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for sys_site_settings_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."sys_site_settings_id_seq";
CREATE SEQUENCE "public"."sys_site_settings_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for sys_system_parameters_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."sys_system_parameters_id_seq";
CREATE SEQUENCE "public"."sys_system_parameters_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Table structure for aerich
-- ----------------------------
DROP TABLE IF EXISTS "public"."aerich";
CREATE TABLE "public"."aerich" (
  "id" int4 NOT NULL DEFAULT nextval('aerich_id_seq'::regclass),
  "version" varchar(255) COLLATE "pg_catalog"."default" NOT NULL,
  "app" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,
  "content" jsonb NOT NULL
)
;
COMMENT ON TABLE "public"."aerich" IS 'Aerich 迁移工具表（用于跟踪数据库迁移历史）';

-- ----------------------------
-- Table structure for apps_master_data_bom
-- ----------------------------
DROP TABLE IF EXISTS "public"."apps_master_data_bom";
CREATE TABLE "public"."apps_master_data_bom" (
  "id" int4 NOT NULL DEFAULT nextval('seed_master_data_bom_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4 NOT NULL,
  "material_id" int4 NOT NULL,
  "component_id" int4 NOT NULL,
  "quantity" numeric(18,4) NOT NULL,
  "unit" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,
  "is_alternative" bool NOT NULL DEFAULT false,
  "alternative_group_id" int4,
  "priority" int4 NOT NULL DEFAULT 0,
  "description" text COLLATE "pg_catalog"."default",
  "is_active" bool NOT NULL DEFAULT true,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6),
  "version" varchar(50) COLLATE "pg_catalog"."default" NOT NULL DEFAULT '1.0'::character varying,
  "bom_code" varchar(100) COLLATE "pg_catalog"."default",
  "effective_date" timestamptz(6),
  "expiry_date" timestamptz(6),
  "approval_status" varchar(20) COLLATE "pg_catalog"."default" NOT NULL DEFAULT 'draft'::character varying,
  "approved_by" int4,
  "approved_at" timestamptz(6),
  "approval_comment" text COLLATE "pg_catalog"."default",
  "remark" text COLLATE "pg_catalog"."default"
)
;
COMMENT ON TABLE "public"."apps_master_data_bom" IS 'BOM（物料清单）表';

-- ----------------------------
-- Table structure for apps_master_data_customers
-- ----------------------------
DROP TABLE IF EXISTS "public"."apps_master_data_customers";
CREATE TABLE "public"."apps_master_data_customers" (
  "id" int4 NOT NULL DEFAULT nextval('seed_master_data_customers_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4 NOT NULL,
  "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,
  "short_name" varchar(100) COLLATE "pg_catalog"."default",
  "contact_person" varchar(100) COLLATE "pg_catalog"."default",
  "phone" varchar(20) COLLATE "pg_catalog"."default",
  "email" varchar(100) COLLATE "pg_catalog"."default",
  "address" text COLLATE "pg_catalog"."default",
  "category" varchar(50) COLLATE "pg_catalog"."default",
  "is_active" bool NOT NULL DEFAULT true,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."apps_master_data_customers" IS '客户表';

-- ----------------------------
-- Table structure for apps_master_data_defect_types
-- ----------------------------
DROP TABLE IF EXISTS "public"."apps_master_data_defect_types";
CREATE TABLE "public"."apps_master_data_defect_types" (
  "id" int4 NOT NULL DEFAULT nextval('seed_master_data_defect_types_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4 NOT NULL,
  "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,
  "category" varchar(50) COLLATE "pg_catalog"."default",
  "description" text COLLATE "pg_catalog"."default",
  "is_active" bool NOT NULL DEFAULT true,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."apps_master_data_defect_types" IS '缺陷类型表';

-- ----------------------------
-- Table structure for apps_master_data_holidays
-- ----------------------------
DROP TABLE IF EXISTS "public"."apps_master_data_holidays";
CREATE TABLE "public"."apps_master_data_holidays" (
  "id" int4 NOT NULL DEFAULT nextval('seed_master_data_holidays_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4 NOT NULL,
  "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,
  "holiday_date" date NOT NULL,
  "holiday_type" varchar(50) COLLATE "pg_catalog"."default",
  "description" text COLLATE "pg_catalog"."default",
  "is_active" bool NOT NULL DEFAULT true,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."apps_master_data_holidays" IS '节假日表';

-- ----------------------------
-- Table structure for apps_master_data_material_groups
-- ----------------------------
DROP TABLE IF EXISTS "public"."apps_master_data_material_groups";
CREATE TABLE "public"."apps_master_data_material_groups" (
  "id" int4 NOT NULL DEFAULT nextval('seed_master_data_material_groups_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4 NOT NULL,
  "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,
  "parent_id" int4,
  "description" text COLLATE "pg_catalog"."default",
  "is_active" bool NOT NULL DEFAULT true,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."apps_master_data_material_groups" IS '物料组表';

-- ----------------------------
-- Table structure for apps_master_data_materials
-- ----------------------------
DROP TABLE IF EXISTS "public"."apps_master_data_materials";
CREATE TABLE "public"."apps_master_data_materials" (
  "id" int4 NOT NULL DEFAULT nextval('seed_master_data_materials_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4 NOT NULL,
  "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,
  "group_id" int4,
  "specification" varchar(500) COLLATE "pg_catalog"."default",
  "base_unit" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,
  "units" jsonb,
  "batch_managed" bool NOT NULL DEFAULT false,
  "variant_managed" bool NOT NULL DEFAULT false,
  "variant_attributes" jsonb,
  "description" text COLLATE "pg_catalog"."default",
  "brand" varchar(100) COLLATE "pg_catalog"."default",
  "model" varchar(100) COLLATE "pg_catalog"."default",
  "is_active" bool NOT NULL DEFAULT true,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."apps_master_data_materials" IS '物料表';

-- ----------------------------
-- Table structure for apps_master_data_operations
-- ----------------------------
DROP TABLE IF EXISTS "public"."apps_master_data_operations";
CREATE TABLE "public"."apps_master_data_operations" (
  "id" int4 NOT NULL DEFAULT nextval('seed_master_data_operations_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4 NOT NULL,
  "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,
  "description" text COLLATE "pg_catalog"."default",
  "is_active" bool NOT NULL DEFAULT true,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."apps_master_data_operations" IS '工序表';

-- ----------------------------
-- Table structure for apps_master_data_process_routes
-- ----------------------------
DROP TABLE IF EXISTS "public"."apps_master_data_process_routes";
CREATE TABLE "public"."apps_master_data_process_routes" (
  "id" int4 NOT NULL DEFAULT nextval('seed_master_data_process_routes_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4 NOT NULL,
  "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,
  "description" text COLLATE "pg_catalog"."default",
  "operation_sequence" jsonb,
  "is_active" bool NOT NULL DEFAULT true,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."apps_master_data_process_routes" IS '工艺路线表';

-- ----------------------------
-- Table structure for apps_master_data_production_lines
-- ----------------------------
DROP TABLE IF EXISTS "public"."apps_master_data_production_lines";
CREATE TABLE "public"."apps_master_data_production_lines" (
  "id" int4 NOT NULL DEFAULT nextval('seed_master_data_production_lines_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4 NOT NULL,
  "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,
  "workshop_id" int4 NOT NULL,
  "description" text COLLATE "pg_catalog"."default",
  "is_active" bool NOT NULL DEFAULT true,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."apps_master_data_production_lines" IS '生产线表';

-- ----------------------------
-- Table structure for apps_master_data_products
-- ----------------------------
DROP TABLE IF EXISTS "public"."apps_master_data_products";
CREATE TABLE "public"."apps_master_data_products" (
  "id" int4 NOT NULL DEFAULT nextval('seed_master_data_products_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4 NOT NULL,
  "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,
  "specification" varchar(500) COLLATE "pg_catalog"."default",
  "unit" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,
  "bom_data" jsonb,
  "version" varchar(20) COLLATE "pg_catalog"."default",
  "is_active" bool NOT NULL DEFAULT true,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."apps_master_data_products" IS '产品表';

-- ----------------------------
-- Table structure for apps_master_data_skills
-- ----------------------------
DROP TABLE IF EXISTS "public"."apps_master_data_skills";
CREATE TABLE "public"."apps_master_data_skills" (
  "id" int4 NOT NULL DEFAULT nextval('seed_master_data_skills_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4 NOT NULL,
  "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,
  "category" varchar(50) COLLATE "pg_catalog"."default",
  "description" text COLLATE "pg_catalog"."default",
  "is_active" bool NOT NULL DEFAULT true,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."apps_master_data_skills" IS '技能表';

-- ----------------------------
-- Table structure for apps_master_data_sop
-- ----------------------------
DROP TABLE IF EXISTS "public"."apps_master_data_sop";
CREATE TABLE "public"."apps_master_data_sop" (
  "id" int4 NOT NULL DEFAULT nextval('seed_master_data_sop_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4 NOT NULL,
  "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,
  "operation_id" int4,
  "version" varchar(20) COLLATE "pg_catalog"."default",
  "content" text COLLATE "pg_catalog"."default",
  "attachments" jsonb,
  "is_active" bool NOT NULL DEFAULT true,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6),
  "flow_config" jsonb,
  "form_config" jsonb
)
;
COMMENT ON TABLE "public"."apps_master_data_sop" IS 'SOP（标准作业程序）表';

-- ----------------------------
-- Table structure for apps_master_data_sop_executions
-- ----------------------------
DROP TABLE IF EXISTS "public"."apps_master_data_sop_executions";
CREATE TABLE "public"."apps_master_data_sop_executions" (
  "id" int4 NOT NULL DEFAULT nextval('seed_master_data_sop_executions_id_seq'::regclass),
  "uuid" uuid NOT NULL,
  "tenant_id" int4 NOT NULL,
  "sop_id" int4 NOT NULL,
  "title" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,
  "description" text COLLATE "pg_catalog"."default",
  "status" varchar(20) COLLATE "pg_catalog"."default" NOT NULL DEFAULT 'pending'::character varying,
  "current_node_id" varchar(100) COLLATE "pg_catalog"."default",
  "node_data" jsonb,
  "inngest_run_id" varchar(100) COLLATE "pg_catalog"."default",
  "executor_id" int4 NOT NULL,
  "started_at" timestamptz(6) NOT NULL,
  "completed_at" timestamptz(6),
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."apps_master_data_sop_executions" IS 'SOP执行记录表';

-- ----------------------------
-- Table structure for apps_master_data_storage_areas
-- ----------------------------
DROP TABLE IF EXISTS "public"."apps_master_data_storage_areas";
CREATE TABLE "public"."apps_master_data_storage_areas" (
  "id" int4 NOT NULL DEFAULT nextval('seed_master_data_storage_areas_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4 NOT NULL,
  "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,
  "warehouse_id" int4 NOT NULL,
  "description" text COLLATE "pg_catalog"."default",
  "is_active" bool NOT NULL DEFAULT true,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."apps_master_data_storage_areas" IS '存储区域表';

-- ----------------------------
-- Table structure for apps_master_data_storage_locations
-- ----------------------------
DROP TABLE IF EXISTS "public"."apps_master_data_storage_locations";
CREATE TABLE "public"."apps_master_data_storage_locations" (
  "id" int4 NOT NULL DEFAULT nextval('seed_master_data_storage_locations_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4 NOT NULL,
  "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,
  "storage_area_id" int4 NOT NULL,
  "description" text COLLATE "pg_catalog"."default",
  "is_active" bool NOT NULL DEFAULT true,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."apps_master_data_storage_locations" IS '存储位置表';

-- ----------------------------
-- Table structure for apps_master_data_suppliers
-- ----------------------------
DROP TABLE IF EXISTS "public"."apps_master_data_suppliers";
CREATE TABLE "public"."apps_master_data_suppliers" (
  "id" int4 NOT NULL DEFAULT nextval('seed_master_data_suppliers_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4 NOT NULL,
  "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,
  "short_name" varchar(100) COLLATE "pg_catalog"."default",
  "contact_person" varchar(100) COLLATE "pg_catalog"."default",
  "phone" varchar(20) COLLATE "pg_catalog"."default",
  "email" varchar(100) COLLATE "pg_catalog"."default",
  "address" text COLLATE "pg_catalog"."default",
  "category" varchar(50) COLLATE "pg_catalog"."default",
  "is_active" bool NOT NULL DEFAULT true,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."apps_master_data_suppliers" IS '供应商表';

-- ----------------------------
-- Table structure for apps_master_data_warehouses
-- ----------------------------
DROP TABLE IF EXISTS "public"."apps_master_data_warehouses";
CREATE TABLE "public"."apps_master_data_warehouses" (
  "id" int4 NOT NULL DEFAULT nextval('seed_master_data_warehouses_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4 NOT NULL,
  "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,
  "description" text COLLATE "pg_catalog"."default",
  "is_active" bool NOT NULL DEFAULT true,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."apps_master_data_warehouses" IS '仓库表';

-- ----------------------------
-- Table structure for apps_master_data_workshops
-- ----------------------------
DROP TABLE IF EXISTS "public"."apps_master_data_workshops";
CREATE TABLE "public"."apps_master_data_workshops" (
  "id" int4 NOT NULL DEFAULT nextval('seed_master_data_workshops_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4 NOT NULL,
  "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,
  "description" text COLLATE "pg_catalog"."default",
  "is_active" bool NOT NULL DEFAULT true,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."apps_master_data_workshops" IS '车间表';

-- ----------------------------
-- Table structure for apps_master_data_workstations
-- ----------------------------
DROP TABLE IF EXISTS "public"."apps_master_data_workstations";
CREATE TABLE "public"."apps_master_data_workstations" (
  "id" int4 NOT NULL DEFAULT nextval('seed_master_data_workstations_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4 NOT NULL,
  "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,
  "production_line_id" int4 NOT NULL,
  "description" text COLLATE "pg_catalog"."default",
  "is_active" bool NOT NULL DEFAULT true,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."apps_master_data_workstations" IS '工作站表';

-- ----------------------------
-- Table structure for core_apis
-- ----------------------------
DROP TABLE IF EXISTS "public"."core_apis";
CREATE TABLE "public"."core_apis" (
  "id" int4 NOT NULL DEFAULT nextval('root_apis_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4 NOT NULL,
  "name" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,
  "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "description" text COLLATE "pg_catalog"."default",
  "path" varchar(500) COLLATE "pg_catalog"."default" NOT NULL,
  "method" varchar(10) COLLATE "pg_catalog"."default" NOT NULL,
  "request_headers" jsonb,
  "request_params" jsonb,
  "request_body" jsonb,
  "response_format" jsonb,
  "response_example" jsonb,
  "is_active" bool NOT NULL DEFAULT true,
  "is_system" bool NOT NULL DEFAULT false,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."core_apis" IS '接口表';

-- ----------------------------
-- Table structure for core_applications
-- ----------------------------
DROP TABLE IF EXISTS "public"."core_applications";
CREATE TABLE "public"."core_applications" (
  "id" int4 NOT NULL DEFAULT nextval('root_applications_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4,
  "name" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,
  "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "description" text COLLATE "pg_catalog"."default",
  "icon" varchar(200) COLLATE "pg_catalog"."default",
  "version" varchar(20) COLLATE "pg_catalog"."default",
  "route_path" varchar(200) COLLATE "pg_catalog"."default",
  "entry_point" varchar(500) COLLATE "pg_catalog"."default",
  "menu_config" jsonb,
  "permission_code" varchar(100) COLLATE "pg_catalog"."default",
  "is_system" bool NOT NULL DEFAULT false,
  "is_active" bool NOT NULL DEFAULT true,
  "is_installed" bool NOT NULL DEFAULT false,
  "sort_order" int4 NOT NULL DEFAULT 0,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."core_applications" IS '应用表';

-- ----------------------------
-- Table structure for core_approval_histories
-- ----------------------------
DROP TABLE IF EXISTS "public"."core_approval_histories";
CREATE TABLE "public"."core_approval_histories" (
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4,
  "created_at" timestamptz(6) NOT NULL,
  "updated_at" timestamptz(6) NOT NULL,
  "id" int4 NOT NULL DEFAULT nextval('core_approval_histories_id_seq'::regclass),
  "approval_instance_id" int4 NOT NULL,
  "action" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,
  "action_by" int4 NOT NULL,
  "action_at" timestamptz(6) NOT NULL,
  "comment" text COLLATE "pg_catalog"."default",
  "from_node" varchar(100) COLLATE "pg_catalog"."default",
  "to_node" varchar(100) COLLATE "pg_catalog"."default",
  "from_approver_id" int4,
  "to_approver_id" int4
)
;
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

-- ----------------------------
-- Table structure for core_approval_instances
-- ----------------------------
DROP TABLE IF EXISTS "public"."core_approval_instances";
CREATE TABLE "public"."core_approval_instances" (
  "id" int4 NOT NULL DEFAULT nextval('root_approval_instances_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4 NOT NULL,
  "process_id" int4 NOT NULL,
  "title" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,
  "content" text COLLATE "pg_catalog"."default",
  "data" jsonb,
  "status" varchar(20) COLLATE "pg_catalog"."default" NOT NULL DEFAULT 'pending'::character varying,
  "current_node" varchar(100) COLLATE "pg_catalog"."default",
  "current_approver_id" int4,
  "inngest_run_id" varchar(100) COLLATE "pg_catalog"."default",
  "submitter_id" int4 NOT NULL,
  "submitted_at" timestamptz(6) NOT NULL,
  "completed_at" timestamptz(6),
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."core_approval_instances" IS '审批实例表';

-- ----------------------------
-- Table structure for core_approval_processes
-- ----------------------------
DROP TABLE IF EXISTS "public"."core_approval_processes";
CREATE TABLE "public"."core_approval_processes" (
  "id" int4 NOT NULL DEFAULT nextval('root_approval_processes_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4 NOT NULL,
  "name" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,
  "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "description" text COLLATE "pg_catalog"."default",
  "nodes" jsonb NOT NULL,
  "config" jsonb NOT NULL,
  "inngest_workflow_id" varchar(100) COLLATE "pg_catalog"."default",
  "is_active" bool NOT NULL DEFAULT true,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."core_approval_processes" IS '审批流程表';

-- ----------------------------
-- Table structure for core_code_rules
-- ----------------------------
DROP TABLE IF EXISTS "public"."core_code_rules";
CREATE TABLE "public"."core_code_rules" (
  "id" int4 NOT NULL DEFAULT nextval('sys_code_rules_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4,
  "name" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,
  "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "expression" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,
  "description" text COLLATE "pg_catalog"."default",
  "seq_start" int4 NOT NULL DEFAULT 1,
  "seq_step" int4 NOT NULL DEFAULT 1,
  "seq_reset_rule" varchar(20) COLLATE "pg_catalog"."default",
  "is_system" bool NOT NULL DEFAULT false,
  "is_active" bool NOT NULL DEFAULT true,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."core_code_rules" IS '编码规则表';

-- ----------------------------
-- Table structure for core_code_sequences
-- ----------------------------
DROP TABLE IF EXISTS "public"."core_code_sequences";
CREATE TABLE "public"."core_code_sequences" (
  "id" int4 NOT NULL DEFAULT nextval('sys_code_sequences_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4,
  "code_rule_id" int4 NOT NULL,
  "current_seq" int4 NOT NULL DEFAULT 0,
  "reset_date" date,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."core_code_sequences" IS '编码序号表';

-- ----------------------------
-- Table structure for core_custom_field_values
-- ----------------------------
DROP TABLE IF EXISTS "public"."core_custom_field_values";
CREATE TABLE "public"."core_custom_field_values" (
  "id" int4 NOT NULL DEFAULT nextval('sys_custom_field_values_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4,
  "custom_field_id" int4 NOT NULL,
  "record_id" int4 NOT NULL,
  "record_table" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "value_text" text COLLATE "pg_catalog"."default",
  "value_number" numeric(20,4),
  "value_date" date,
  "value_json" jsonb,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."core_custom_field_values" IS '自定义字段值表';

-- ----------------------------
-- Table structure for core_custom_fields
-- ----------------------------
DROP TABLE IF EXISTS "public"."core_custom_fields";
CREATE TABLE "public"."core_custom_fields" (
  "id" int4 NOT NULL DEFAULT nextval('sys_custom_fields_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4,
  "name" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,
  "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "table_name" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "field_type" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,
  "config" jsonb,
  "label" varchar(100) COLLATE "pg_catalog"."default",
  "placeholder" varchar(200) COLLATE "pg_catalog"."default",
  "is_required" bool NOT NULL DEFAULT false,
  "is_searchable" bool NOT NULL DEFAULT true,
  "is_sortable" bool NOT NULL DEFAULT true,
  "sort_order" int4 NOT NULL DEFAULT 0,
  "is_active" bool NOT NULL DEFAULT true,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."core_custom_fields" IS '自定义字段表';

-- ----------------------------
-- Table structure for core_data_backups
-- ----------------------------
DROP TABLE IF EXISTS "public"."core_data_backups";
CREATE TABLE "public"."core_data_backups" (
  "id" int4 NOT NULL DEFAULT nextval('root_data_backups_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4 NOT NULL,
  "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,
  "backup_type" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,
  "backup_scope" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,
  "backup_tables" jsonb,
  "file_path" varchar(500) COLLATE "pg_catalog"."default",
  "file_uuid" varchar(36) COLLATE "pg_catalog"."default",
  "file_size" int8,
  "status" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,
  "inngest_run_id" varchar(100) COLLATE "pg_catalog"."default",
  "started_at" timestamptz(6),
  "completed_at" timestamptz(6),
  "error_message" text COLLATE "pg_catalog"."default",
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."core_data_backups" IS '数据备份表';

-- ----------------------------
-- Table structure for core_data_dictionaries
-- ----------------------------
DROP TABLE IF EXISTS "public"."core_data_dictionaries";
CREATE TABLE "public"."core_data_dictionaries" (
  "id" int4 NOT NULL DEFAULT nextval('sys_data_dictionaries_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4,
  "name" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,
  "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "description" text COLLATE "pg_catalog"."default",
  "is_system" bool NOT NULL DEFAULT false,
  "is_active" bool NOT NULL DEFAULT true,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."core_data_dictionaries" IS '数据字典表';

-- ----------------------------
-- Table structure for core_data_sources
-- ----------------------------
DROP TABLE IF EXISTS "public"."core_data_sources";
CREATE TABLE "public"."core_data_sources" (
  "id" int4 NOT NULL DEFAULT nextval('root_data_sources_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4 NOT NULL,
  "name" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,
  "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "description" text COLLATE "pg_catalog"."default",
  "type" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,
  "config" jsonb NOT NULL,
  "is_active" bool NOT NULL DEFAULT true,
  "is_connected" bool NOT NULL DEFAULT false,
  "last_connected_at" timestamptz(6),
  "last_error" text COLLATE "pg_catalog"."default",
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."core_data_sources" IS '数据源表';

-- ----------------------------
-- Table structure for core_datasets
-- ----------------------------
DROP TABLE IF EXISTS "public"."core_datasets";
CREATE TABLE "public"."core_datasets" (
  "id" int4 NOT NULL DEFAULT nextval('root_datasets_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4 NOT NULL,
  "data_source_id" int4 NOT NULL,
  "name" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,
  "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "description" text COLLATE "pg_catalog"."default",
  "query_type" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,
  "query_config" jsonb NOT NULL,
  "is_active" bool NOT NULL DEFAULT true,
  "last_executed_at" timestamptz(6),
  "last_error" text COLLATE "pg_catalog"."default",
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."core_datasets" IS '数据集表';

-- ----------------------------
-- Table structure for core_departments
-- ----------------------------
DROP TABLE IF EXISTS "public"."core_departments";
CREATE TABLE "public"."core_departments" (
  "id" int4 NOT NULL DEFAULT nextval('root_departments_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4,
  "name" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,
  "code" varchar(50) COLLATE "pg_catalog"."default",
  "description" text COLLATE "pg_catalog"."default",
  "manager_id" int4,
  "parent_id" int4,
  "sort_order" int4 DEFAULT 0,
  "is_active" bool DEFAULT true,
  "created_at" timestamp(6) DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp(6) DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamp(6)
)
;
COMMENT ON TABLE "public"."core_departments" IS '部门表';

-- ----------------------------
-- Table structure for core_dictionary_items
-- ----------------------------
DROP TABLE IF EXISTS "public"."core_dictionary_items";
CREATE TABLE "public"."core_dictionary_items" (
  "id" int4 NOT NULL DEFAULT nextval('sys_dictionary_items_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4,
  "dictionary_id" int4 NOT NULL,
  "label" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,
  "value" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,
  "description" text COLLATE "pg_catalog"."default",
  "color" varchar(20) COLLATE "pg_catalog"."default",
  "icon" varchar(50) COLLATE "pg_catalog"."default",
  "sort_order" int4 NOT NULL DEFAULT 0,
  "is_active" bool NOT NULL DEFAULT true,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."core_dictionary_items" IS '数据字典项表';

-- ----------------------------
-- Table structure for core_electronic_records
-- ----------------------------
DROP TABLE IF EXISTS "public"."core_electronic_records";
CREATE TABLE "public"."core_electronic_records" (
  "id" int4 NOT NULL DEFAULT nextval('root_electronic_records_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4 NOT NULL,
  "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,
  "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "type" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "description" text COLLATE "pg_catalog"."default",
  "content" jsonb NOT NULL,
  "file_uuid" varchar(36) COLLATE "pg_catalog"."default",
  "inngest_workflow_id" varchar(100) COLLATE "pg_catalog"."default",
  "inngest_run_id" varchar(100) COLLATE "pg_catalog"."default",
  "status" varchar(20) COLLATE "pg_catalog"."default" NOT NULL DEFAULT 'draft'::character varying,
  "lifecycle_stage" varchar(20) COLLATE "pg_catalog"."default",
  "signer_id" int4,
  "signed_at" timestamptz(6),
  "signature_data" text COLLATE "pg_catalog"."default",
  "archived_at" timestamptz(6),
  "archive_location" varchar(200) COLLATE "pg_catalog"."default",
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."core_electronic_records" IS '电子记录表';

-- ----------------------------
-- Table structure for core_files
-- ----------------------------
DROP TABLE IF EXISTS "public"."core_files";
CREATE TABLE "public"."core_files" (
  "id" int4 NOT NULL DEFAULT nextval('root_files_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4,
  "name" varchar(255) COLLATE "pg_catalog"."default" NOT NULL,
  "original_name" varchar(255) COLLATE "pg_catalog"."default" NOT NULL,
  "file_path" varchar(500) COLLATE "pg_catalog"."default" NOT NULL,
  "file_size" int8 NOT NULL,
  "file_type" varchar(100) COLLATE "pg_catalog"."default",
  "file_extension" varchar(20) COLLATE "pg_catalog"."default",
  "preview_url" varchar(500) COLLATE "pg_catalog"."default",
  "category" varchar(50) COLLATE "pg_catalog"."default",
  "tags" jsonb,
  "description" text COLLATE "pg_catalog"."default",
  "is_active" bool NOT NULL DEFAULT true,
  "upload_status" varchar(20) COLLATE "pg_catalog"."default" NOT NULL DEFAULT 'completed'::character varying,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."core_files" IS '文件表';

-- ----------------------------
-- Table structure for core_integration_configs
-- ----------------------------
DROP TABLE IF EXISTS "public"."core_integration_configs";
CREATE TABLE "public"."core_integration_configs" (
  "id" int4 NOT NULL DEFAULT nextval('root_integration_configs_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4,
  "name" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,
  "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "type" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,
  "description" text COLLATE "pg_catalog"."default",
  "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "is_active" bool NOT NULL DEFAULT true,
  "is_connected" bool NOT NULL DEFAULT false,
  "last_connected_at" timestamptz(6),
  "last_error" text COLLATE "pg_catalog"."default",
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."core_integration_configs" IS '集成配置表';

-- ----------------------------
-- Table structure for core_invitation_codes
-- ----------------------------
DROP TABLE IF EXISTS "public"."core_invitation_codes";
CREATE TABLE "public"."core_invitation_codes" (
  "id" int4 NOT NULL DEFAULT nextval('sys_invitation_codes_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4,
  "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "email" varchar(100) COLLATE "pg_catalog"."default",
  "role_id" int4,
  "max_uses" int4 NOT NULL DEFAULT 1,
  "used_count" int4 NOT NULL DEFAULT 0,
  "expires_at" timestamptz(6),
  "is_active" bool NOT NULL DEFAULT true,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."core_invitation_codes" IS '邀请码表';

-- ----------------------------
-- Table structure for core_languages
-- ----------------------------
DROP TABLE IF EXISTS "public"."core_languages";
CREATE TABLE "public"."core_languages" (
  "id" int4 NOT NULL DEFAULT nextval('sys_languages_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4,
  "code" varchar(10) COLLATE "pg_catalog"."default" NOT NULL,
  "name" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "native_name" varchar(50) COLLATE "pg_catalog"."default",
  "translations" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "is_default" bool NOT NULL DEFAULT false,
  "is_active" bool NOT NULL DEFAULT true,
  "sort_order" int4 NOT NULL DEFAULT 0,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."core_languages" IS '语言表';

-- ----------------------------
-- Table structure for core_login_logs
-- ----------------------------
DROP TABLE IF EXISTS "public"."core_login_logs";
CREATE TABLE "public"."core_login_logs" (
  "id" int4 NOT NULL DEFAULT nextval('root_login_logs_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4,
  "user_id" int4,
  "username" varchar(100) COLLATE "pg_catalog"."default",
  "login_ip" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "login_location" varchar(200) COLLATE "pg_catalog"."default",
  "login_device" varchar(50) COLLATE "pg_catalog"."default",
  "login_browser" varchar(200) COLLATE "pg_catalog"."default",
  "login_status" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,
  "failure_reason" text COLLATE "pg_catalog"."default",
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
)
;
COMMENT ON TABLE "public"."core_login_logs" IS '登录日志表';

-- ----------------------------
-- Table structure for core_menus
-- ----------------------------
DROP TABLE IF EXISTS "public"."core_menus";
CREATE TABLE "public"."core_menus" (
  "id" int4 NOT NULL DEFAULT nextval('root_menus_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4 NOT NULL,
  "name" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,
  "path" varchar(200) COLLATE "pg_catalog"."default",
  "icon" varchar(100) COLLATE "pg_catalog"."default",
  "component" varchar(500) COLLATE "pg_catalog"."default",
  "permission_code" varchar(100) COLLATE "pg_catalog"."default",
  "application_uuid" varchar(36) COLLATE "pg_catalog"."default",
  "parent_id" int4,
  "sort_order" int4 NOT NULL DEFAULT 0,
  "is_active" bool NOT NULL DEFAULT true,
  "is_external" bool NOT NULL DEFAULT false,
  "external_url" varchar(500) COLLATE "pg_catalog"."default",
  "meta" jsonb,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."core_menus" IS '菜单表';

-- ----------------------------
-- Table structure for core_message_configs
-- ----------------------------
DROP TABLE IF EXISTS "public"."core_message_configs";
CREATE TABLE "public"."core_message_configs" (
  "id" int4 NOT NULL DEFAULT nextval('root_message_configs_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4 NOT NULL,
  "name" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,
  "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "type" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,
  "description" text COLLATE "pg_catalog"."default",
  "config" jsonb NOT NULL,
  "is_active" bool NOT NULL DEFAULT true,
  "is_default" bool NOT NULL DEFAULT false,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."core_message_configs" IS '消息配置表';

-- ----------------------------
-- Table structure for core_message_logs
-- ----------------------------
DROP TABLE IF EXISTS "public"."core_message_logs";
CREATE TABLE "public"."core_message_logs" (
  "id" int4 NOT NULL DEFAULT nextval('root_message_logs_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4 NOT NULL,
  "template_uuid" varchar(36) COLLATE "pg_catalog"."default",
  "config_uuid" varchar(36) COLLATE "pg_catalog"."default",
  "type" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,
  "recipient" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,
  "subject" varchar(200) COLLATE "pg_catalog"."default",
  "content" text COLLATE "pg_catalog"."default" NOT NULL,
  "variables" jsonb,
  "status" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,
  "inngest_run_id" varchar(100) COLLATE "pg_catalog"."default",
  "error_message" text COLLATE "pg_catalog"."default",
  "sent_at" timestamptz(6),
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."core_message_logs" IS '消息日志表';

-- ----------------------------
-- Table structure for core_message_templates
-- ----------------------------
DROP TABLE IF EXISTS "public"."core_message_templates";
CREATE TABLE "public"."core_message_templates" (
  "id" int4 NOT NULL DEFAULT nextval('root_message_templates_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4 NOT NULL,
  "name" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,
  "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "type" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,
  "description" text COLLATE "pg_catalog"."default",
  "subject" varchar(200) COLLATE "pg_catalog"."default",
  "content" text COLLATE "pg_catalog"."default" NOT NULL,
  "variables" jsonb,
  "is_active" bool NOT NULL DEFAULT true,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."core_message_templates" IS '消息模板表';

-- ----------------------------
-- Table structure for core_operation_logs
-- ----------------------------
DROP TABLE IF EXISTS "public"."core_operation_logs";
CREATE TABLE "public"."core_operation_logs" (
  "id" int4 NOT NULL DEFAULT nextval('root_operation_logs_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4 NOT NULL,
  "user_id" int4 NOT NULL,
  "operation_type" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "operation_module" varchar(100) COLLATE "pg_catalog"."default",
  "operation_object_type" varchar(100) COLLATE "pg_catalog"."default",
  "operation_object_id" int4,
  "operation_object_uuid" varchar(36) COLLATE "pg_catalog"."default",
  "operation_content" text COLLATE "pg_catalog"."default",
  "ip_address" varchar(50) COLLATE "pg_catalog"."default",
  "user_agent" text COLLATE "pg_catalog"."default",
  "request_method" varchar(10) COLLATE "pg_catalog"."default",
  "request_path" varchar(500) COLLATE "pg_catalog"."default",
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
)
;
COMMENT ON TABLE "public"."core_operation_logs" IS '操作日志表';

-- ----------------------------
-- Table structure for core_permissions
-- ----------------------------
DROP TABLE IF EXISTS "public"."core_permissions";
CREATE TABLE "public"."core_permissions" (
  "id" int4 NOT NULL DEFAULT nextval('core_permissions_id_seq'::regclass),
  "uuid" varchar COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4,
  "name" varchar COLLATE "pg_catalog"."default" NOT NULL,
  "code" varchar COLLATE "pg_catalog"."default" NOT NULL,
  "resource" varchar COLLATE "pg_catalog"."default" NOT NULL,
  "action" varchar COLLATE "pg_catalog"."default" NOT NULL,
  "description" text COLLATE "pg_catalog"."default",
  "permission_type" varchar COLLATE "pg_catalog"."default" DEFAULT 'function'::character varying,
  "created_at" timestamptz(6) DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."core_permissions" IS '权限表';

-- ----------------------------
-- Table structure for core_positions
-- ----------------------------
DROP TABLE IF EXISTS "public"."core_positions";
CREATE TABLE "public"."core_positions" (
  "id" int4 NOT NULL DEFAULT nextval('root_positions_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4,
  "name" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,
  "code" varchar(50) COLLATE "pg_catalog"."default",
  "description" text COLLATE "pg_catalog"."default",
  "department_id" int4,
  "sort_order" int4 DEFAULT 0,
  "is_active" bool DEFAULT true,
  "created_at" timestamp(6) DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp(6) DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamp(6)
)
;
COMMENT ON TABLE "public"."core_positions" IS '职位表';

-- ----------------------------
-- Table structure for core_print_devices
-- ----------------------------
DROP TABLE IF EXISTS "public"."core_print_devices";
CREATE TABLE "public"."core_print_devices" (
  "id" int4 NOT NULL DEFAULT nextval('root_print_devices_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4 NOT NULL,
  "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,
  "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "type" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "description" text COLLATE "pg_catalog"."default",
  "config" jsonb NOT NULL,
  "inngest_function_id" varchar(100) COLLATE "pg_catalog"."default",
  "is_active" bool NOT NULL DEFAULT true,
  "is_default" bool NOT NULL DEFAULT false,
  "is_online" bool NOT NULL DEFAULT false,
  "last_connected_at" timestamptz(6),
  "usage_count" int4 NOT NULL DEFAULT 0,
  "last_used_at" timestamptz(6),
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."core_print_devices" IS '打印设备表';

-- ----------------------------
-- Table structure for core_print_templates
-- ----------------------------
DROP TABLE IF EXISTS "public"."core_print_templates";
CREATE TABLE "public"."core_print_templates" (
  "id" int4 NOT NULL DEFAULT nextval('root_print_templates_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4 NOT NULL,
  "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,
  "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "type" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "description" text COLLATE "pg_catalog"."default",
  "content" text COLLATE "pg_catalog"."default" NOT NULL,
  "config" jsonb,
  "inngest_function_id" varchar(100) COLLATE "pg_catalog"."default",
  "is_active" bool NOT NULL DEFAULT true,
  "is_default" bool NOT NULL DEFAULT false,
  "usage_count" int4 NOT NULL DEFAULT 0,
  "last_used_at" timestamptz(6),
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."core_print_templates" IS '打印模板表';

-- ----------------------------
-- Table structure for core_role_permissions
-- ----------------------------
DROP TABLE IF EXISTS "public"."core_role_permissions";
CREATE TABLE "public"."core_role_permissions" (
  "id" int4 NOT NULL DEFAULT nextval('root_role_permissions_id_seq'::regclass),
  "role_id" int4 NOT NULL,
  "permission_id" int4 NOT NULL,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
)
;
COMMENT ON TABLE "public"."core_role_permissions" IS '角色权限关联表';

-- ----------------------------
-- Table structure for core_roles
-- ----------------------------
DROP TABLE IF EXISTS "public"."core_roles";
CREATE TABLE "public"."core_roles" (
  "id" int4 NOT NULL DEFAULT nextval('core_roles_id_seq'::regclass),
  "uuid" varchar COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4,
  "name" varchar COLLATE "pg_catalog"."default" NOT NULL,
  "code" varchar COLLATE "pg_catalog"."default" NOT NULL,
  "description" text COLLATE "pg_catalog"."default",
  "is_system" bool NOT NULL DEFAULT false,
  "is_active" bool NOT NULL DEFAULT true,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."core_roles" IS '角色表';

-- ----------------------------
-- Table structure for core_saved_searches
-- ----------------------------
DROP TABLE IF EXISTS "public"."core_saved_searches";
CREATE TABLE "public"."core_saved_searches" (
  "id" int4 NOT NULL DEFAULT nextval('root_saved_searches_id_seq'::regclass),
  "uuid" varchar COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4,
  "user_id" int4 NOT NULL,
  "page_path" varchar COLLATE "pg_catalog"."default" NOT NULL,
  "name" varchar COLLATE "pg_catalog"."default" NOT NULL,
  "is_shared" bool NOT NULL DEFAULT false,
  "is_pinned" bool NOT NULL DEFAULT false,
  "search_params" jsonb NOT NULL,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
)
;
COMMENT ON TABLE "public"."core_saved_searches" IS '保存的搜索表';

-- ----------------------------
-- Table structure for core_scheduled_tasks
-- ----------------------------
DROP TABLE IF EXISTS "public"."core_scheduled_tasks";
CREATE TABLE "public"."core_scheduled_tasks" (
  "id" int4 NOT NULL DEFAULT nextval('root_scheduled_tasks_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4 NOT NULL,
  "name" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,
  "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "description" text COLLATE "pg_catalog"."default",
  "type" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,
  "trigger_type" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,
  "trigger_config" jsonb NOT NULL,
  "task_config" jsonb NOT NULL,
  "inngest_function_id" varchar(100) COLLATE "pg_catalog"."default",
  "is_active" bool NOT NULL DEFAULT true,
  "is_running" bool NOT NULL DEFAULT false,
  "last_run_at" timestamptz(6),
  "last_run_status" varchar(20) COLLATE "pg_catalog"."default",
  "last_error" text COLLATE "pg_catalog"."default",
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."core_scheduled_tasks" IS '定时任务表';

-- ----------------------------
-- Table structure for core_scripts
-- ----------------------------
DROP TABLE IF EXISTS "public"."core_scripts";
CREATE TABLE "public"."core_scripts" (
  "id" int4 NOT NULL DEFAULT nextval('root_scripts_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4 NOT NULL,
  "name" varchar(200) COLLATE "pg_catalog"."default" NOT NULL,
  "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "type" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "description" text COLLATE "pg_catalog"."default",
  "content" text COLLATE "pg_catalog"."default" NOT NULL,
  "config" jsonb,
  "inngest_function_id" varchar(100) COLLATE "pg_catalog"."default",
  "is_active" bool NOT NULL DEFAULT true,
  "is_running" bool NOT NULL DEFAULT false,
  "last_run_at" timestamptz(6),
  "last_run_status" varchar(20) COLLATE "pg_catalog"."default",
  "last_error" text COLLATE "pg_catalog"."default",
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."core_scripts" IS '脚本表';

-- ----------------------------
-- Table structure for core_site_settings
-- ----------------------------
DROP TABLE IF EXISTS "public"."core_site_settings";
CREATE TABLE "public"."core_site_settings" (
  "id" int4 NOT NULL DEFAULT nextval('sys_site_settings_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4,
  "settings" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."core_site_settings" IS '站点设置表';

-- ----------------------------
-- Table structure for core_system_parameters
-- ----------------------------
DROP TABLE IF EXISTS "public"."core_system_parameters";
CREATE TABLE "public"."core_system_parameters" (
  "id" int4 NOT NULL DEFAULT nextval('sys_system_parameters_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4,
  "key" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,
  "value" text COLLATE "pg_catalog"."default" NOT NULL,
  "type" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,
  "description" text COLLATE "pg_catalog"."default",
  "is_system" bool NOT NULL DEFAULT false,
  "is_active" bool NOT NULL DEFAULT true,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6)
)
;
COMMENT ON TABLE "public"."core_system_parameters" IS '系统参数表';

-- ----------------------------
-- Table structure for core_user_preferences
-- ----------------------------
DROP TABLE IF EXISTS "public"."core_user_preferences";
CREATE TABLE "public"."core_user_preferences" (
  "id" int4 NOT NULL DEFAULT nextval('root_user_preferences_id_seq'::regclass),
  "uuid" varchar(36) COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4 NOT NULL,
  "user_id" int4 NOT NULL,
  "preferences" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
)
;
COMMENT ON TABLE "public"."core_user_preferences" IS '用户偏好表';

-- ----------------------------
-- Table structure for core_user_roles
-- ----------------------------
DROP TABLE IF EXISTS "public"."core_user_roles";
CREATE TABLE "public"."core_user_roles" (
  "id" int4 NOT NULL DEFAULT nextval('root_user_roles_id_seq'::regclass),
  "user_id" int4 NOT NULL,
  "role_id" int4 NOT NULL,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
)
;
COMMENT ON TABLE "public"."core_user_roles" IS '用户角色关联表';

-- ----------------------------
-- Table structure for core_users
-- ----------------------------
DROP TABLE IF EXISTS "public"."core_users";
CREATE TABLE "public"."core_users" (
  "id" int4 NOT NULL DEFAULT nextval('core_users_id_seq'::regclass),
  "uuid" varchar COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4,
  "username" varchar COLLATE "pg_catalog"."default" NOT NULL,
  "email" varchar COLLATE "pg_catalog"."default",
  "password_hash" varchar COLLATE "pg_catalog"."default" NOT NULL,
  "full_name" varchar COLLATE "pg_catalog"."default",
  "is_active" bool NOT NULL DEFAULT true,
  "is_infra_admin" bool NOT NULL DEFAULT false,
  "is_tenant_admin" bool NOT NULL DEFAULT false,
  "source" varchar COLLATE "pg_catalog"."default",
  "last_login" timestamptz(6),
  "department_id" int4,
  "position_id" int4,
  "phone" varchar COLLATE "pg_catalog"."default",
  "avatar" varchar COLLATE "pg_catalog"."default",
  "remark" text COLLATE "pg_catalog"."default",
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz(6),
  "bio" text COLLATE "pg_catalog"."default",
  "contact_info" jsonb,
  "gender" varchar(10) COLLATE "pg_catalog"."default"
)
;
COMMENT ON TABLE "public"."core_users" IS '用户表';

-- ----------------------------
-- Table structure for infra_packages
-- ----------------------------
DROP TABLE IF EXISTS "public"."infra_packages";
CREATE TABLE "public"."infra_packages" (
  "id" int4 NOT NULL DEFAULT nextval('soil_packages_id_seq'::regclass),
  "uuid" varchar COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4,
  "name" varchar COLLATE "pg_catalog"."default" NOT NULL,
  "plan" varchar COLLATE "pg_catalog"."default" NOT NULL,
  "max_users" int4 NOT NULL,
  "max_storage_mb" int4 NOT NULL,
  "allow_pro_apps" bool NOT NULL DEFAULT false,
  "description" text COLLATE "pg_catalog"."default",
  "price" float8,
  "features" jsonb NOT NULL,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
)
;
COMMENT ON TABLE "public"."infra_packages" IS '套餐表';

-- ----------------------------
-- Table structure for infra_superadmin
-- ----------------------------
DROP TABLE IF EXISTS "public"."infra_superadmin";
CREATE TABLE "public"."infra_superadmin" (
  "id" int4 NOT NULL DEFAULT nextval('soil_platform_superadmin_id_seq'::regclass),
  "uuid" varchar COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4,
  "username" varchar COLLATE "pg_catalog"."default" NOT NULL,
  "email" varchar COLLATE "pg_catalog"."default",
  "password_hash" varchar COLLATE "pg_catalog"."default" NOT NULL,
  "full_name" varchar COLLATE "pg_catalog"."default",
  "is_active" bool NOT NULL DEFAULT true,
  "last_login" timestamptz(6),
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "avatar" varchar(36) COLLATE "pg_catalog"."default",
  "bio" text COLLATE "pg_catalog"."default",
  "contact_info" jsonb,
  "gender" varchar(10) COLLATE "pg_catalog"."default",
  "phone" varchar(20) COLLATE "pg_catalog"."default"
)
;
COMMENT ON TABLE "public"."infra_superadmin" IS '平台超级管理员表';

-- ----------------------------
-- Table structure for infra_tenant_configs
-- ----------------------------
DROP TABLE IF EXISTS "public"."infra_tenant_configs";
CREATE TABLE "public"."infra_tenant_configs" (
  "id" int4 NOT NULL DEFAULT nextval('core_tenant_configs_id_seq'::regclass),
  "uuid" varchar COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4 NOT NULL,
  "config_key" varchar COLLATE "pg_catalog"."default" NOT NULL,
  "config_value" jsonb NOT NULL,
  "description" text COLLATE "pg_catalog"."default",
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
)
;
COMMENT ON TABLE "public"."infra_tenant_configs" IS '租户配置表';

-- ----------------------------
-- Table structure for infra_tenants
-- ----------------------------
DROP TABLE IF EXISTS "public"."infra_tenants";
CREATE TABLE "public"."infra_tenants" (
  "id" int4 NOT NULL DEFAULT nextval('core_tenants_id_seq'::regclass),
  "uuid" varchar COLLATE "pg_catalog"."default" NOT NULL,
  "tenant_id" int4,
  "name" varchar COLLATE "pg_catalog"."default" NOT NULL,
  "domain" varchar COLLATE "pg_catalog"."default" NOT NULL,
  "status" varchar COLLATE "pg_catalog"."default" NOT NULL DEFAULT 'inactive'::character varying,
  "plan" varchar COLLATE "pg_catalog"."default" NOT NULL DEFAULT 'basic'::character varying,
  "settings" jsonb NOT NULL,
  "max_users" int4 NOT NULL DEFAULT 10,
  "max_storage" int4 NOT NULL DEFAULT 1024,
  "expires_at" timestamptz(6),
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
)
;
COMMENT ON TABLE "public"."infra_tenants" IS '租户表';

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."aerich_id_seq"
OWNED BY "public"."aerich"."id";
SELECT setval('"public"."aerich_id_seq"', 58, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."core_approval_histories_id_seq"
OWNED BY "public"."core_approval_histories"."id";
SELECT setval('"public"."core_approval_histories_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
SELECT setval('"public"."core_permissions_id_seq"', 49, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
SELECT setval('"public"."core_roles_id_seq"', 38, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
SELECT setval('"public"."core_tenant_configs_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
SELECT setval('"public"."core_tenants_id_seq"', 4, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
SELECT setval('"public"."core_users_id_seq"', 135, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."root_apis_id_seq"
OWNED BY "public"."core_apis"."id";
SELECT setval('"public"."root_apis_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."root_applications_id_seq"
OWNED BY "public"."core_applications"."id";
SELECT setval('"public"."root_applications_id_seq"', 92, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."root_approval_instances_id_seq"
OWNED BY "public"."core_approval_instances"."id";
SELECT setval('"public"."root_approval_instances_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."root_approval_processes_id_seq"
OWNED BY "public"."core_approval_processes"."id";
SELECT setval('"public"."root_approval_processes_id_seq"', 1, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."root_data_backups_id_seq"
OWNED BY "public"."core_data_backups"."id";
SELECT setval('"public"."root_data_backups_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."root_data_sources_id_seq"
OWNED BY "public"."core_data_sources"."id";
SELECT setval('"public"."root_data_sources_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."root_datasets_id_seq"
OWNED BY "public"."core_datasets"."id";
SELECT setval('"public"."root_datasets_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."root_departments_id_seq"
OWNED BY "public"."core_departments"."id";
SELECT setval('"public"."root_departments_id_seq"', 50, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."root_electronic_records_id_seq"
OWNED BY "public"."core_electronic_records"."id";
SELECT setval('"public"."root_electronic_records_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."root_files_id_seq"
OWNED BY "public"."core_files"."id";
SELECT setval('"public"."root_files_id_seq"', 13, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."root_integration_configs_id_seq"
OWNED BY "public"."core_integration_configs"."id";
SELECT setval('"public"."root_integration_configs_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."root_login_logs_id_seq"
OWNED BY "public"."core_login_logs"."id";
SELECT setval('"public"."root_login_logs_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."root_menus_id_seq"
OWNED BY "public"."core_menus"."id";
SELECT setval('"public"."root_menus_id_seq"', 705, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."root_message_configs_id_seq"
OWNED BY "public"."core_message_configs"."id";
SELECT setval('"public"."root_message_configs_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."root_message_logs_id_seq"
OWNED BY "public"."core_message_logs"."id";
SELECT setval('"public"."root_message_logs_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."root_message_templates_id_seq"
OWNED BY "public"."core_message_templates"."id";
SELECT setval('"public"."root_message_templates_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."root_operation_logs_id_seq"
OWNED BY "public"."core_operation_logs"."id";
SELECT setval('"public"."root_operation_logs_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."root_positions_id_seq"
OWNED BY "public"."core_positions"."id";
SELECT setval('"public"."root_positions_id_seq"', 71, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."root_print_devices_id_seq"
OWNED BY "public"."core_print_devices"."id";
SELECT setval('"public"."root_print_devices_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."root_print_templates_id_seq"
OWNED BY "public"."core_print_templates"."id";
SELECT setval('"public"."root_print_templates_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
SELECT setval('"public"."root_role_permissions_id_seq"', 121, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
SELECT setval('"public"."root_saved_searches_id_seq"', 6, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."root_scheduled_tasks_id_seq"
OWNED BY "public"."core_scheduled_tasks"."id";
SELECT setval('"public"."root_scheduled_tasks_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."root_scripts_id_seq"
OWNED BY "public"."core_scripts"."id";
SELECT setval('"public"."root_scripts_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."root_user_preferences_id_seq"
OWNED BY "public"."core_user_preferences"."id";
SELECT setval('"public"."root_user_preferences_id_seq"', 20, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
SELECT setval('"public"."root_user_roles_id_seq"', 95, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."seed_master_data_bom_id_seq"
OWNED BY "public"."apps_master_data_bom"."id";
SELECT setval('"public"."seed_master_data_bom_id_seq"', 12, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."seed_master_data_customers_id_seq"
OWNED BY "public"."apps_master_data_customers"."id";
SELECT setval('"public"."seed_master_data_customers_id_seq"', 4, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."seed_master_data_defect_types_id_seq"
OWNED BY "public"."apps_master_data_defect_types"."id";
SELECT setval('"public"."seed_master_data_defect_types_id_seq"', 4, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."seed_master_data_holidays_id_seq"
OWNED BY "public"."apps_master_data_holidays"."id";
SELECT setval('"public"."seed_master_data_holidays_id_seq"', 8, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."seed_master_data_material_groups_id_seq"
OWNED BY "public"."apps_master_data_material_groups"."id";
SELECT setval('"public"."seed_master_data_material_groups_id_seq"', 18, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."seed_master_data_materials_id_seq"
OWNED BY "public"."apps_master_data_materials"."id";
SELECT setval('"public"."seed_master_data_materials_id_seq"', 29, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."seed_master_data_operations_id_seq"
OWNED BY "public"."apps_master_data_operations"."id";
SELECT setval('"public"."seed_master_data_operations_id_seq"', 9, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."seed_master_data_process_routes_id_seq"
OWNED BY "public"."apps_master_data_process_routes"."id";
SELECT setval('"public"."seed_master_data_process_routes_id_seq"', 3, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."seed_master_data_production_lines_id_seq"
OWNED BY "public"."apps_master_data_production_lines"."id";
SELECT setval('"public"."seed_master_data_production_lines_id_seq"', 5, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."seed_master_data_products_id_seq"
OWNED BY "public"."apps_master_data_products"."id";
SELECT setval('"public"."seed_master_data_products_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."seed_master_data_skills_id_seq"
OWNED BY "public"."apps_master_data_skills"."id";
SELECT setval('"public"."seed_master_data_skills_id_seq"', 6, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."seed_master_data_sop_executions_id_seq"
OWNED BY "public"."apps_master_data_sop_executions"."id";
SELECT setval('"public"."seed_master_data_sop_executions_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."seed_master_data_sop_id_seq"
OWNED BY "public"."apps_master_data_sop"."id";
SELECT setval('"public"."seed_master_data_sop_id_seq"', 2, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."seed_master_data_storage_areas_id_seq"
OWNED BY "public"."apps_master_data_storage_areas"."id";
SELECT setval('"public"."seed_master_data_storage_areas_id_seq"', 6, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."seed_master_data_storage_locations_id_seq"
OWNED BY "public"."apps_master_data_storage_locations"."id";
SELECT setval('"public"."seed_master_data_storage_locations_id_seq"', 5, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."seed_master_data_suppliers_id_seq"
OWNED BY "public"."apps_master_data_suppliers"."id";
SELECT setval('"public"."seed_master_data_suppliers_id_seq"', 4, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."seed_master_data_warehouses_id_seq"
OWNED BY "public"."apps_master_data_warehouses"."id";
SELECT setval('"public"."seed_master_data_warehouses_id_seq"', 4, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."seed_master_data_workshops_id_seq"
OWNED BY "public"."apps_master_data_workshops"."id";
SELECT setval('"public"."seed_master_data_workshops_id_seq"', 4, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."seed_master_data_workstations_id_seq"
OWNED BY "public"."apps_master_data_workstations"."id";
SELECT setval('"public"."seed_master_data_workstations_id_seq"', 8, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
SELECT setval('"public"."soil_packages_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
SELECT setval('"public"."soil_platform_superadmin_id_seq"', 3, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."sys_code_rules_id_seq"
OWNED BY "public"."core_code_rules"."id";
SELECT setval('"public"."sys_code_rules_id_seq"', 6, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."sys_code_sequences_id_seq"
OWNED BY "public"."core_code_sequences"."id";
SELECT setval('"public"."sys_code_sequences_id_seq"', 1, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."sys_custom_field_values_id_seq"
OWNED BY "public"."core_custom_field_values"."id";
SELECT setval('"public"."sys_custom_field_values_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."sys_custom_fields_id_seq"
OWNED BY "public"."core_custom_fields"."id";
SELECT setval('"public"."sys_custom_fields_id_seq"', 1, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."sys_data_dictionaries_id_seq"
OWNED BY "public"."core_data_dictionaries"."id";
SELECT setval('"public"."sys_data_dictionaries_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."sys_dictionary_items_id_seq"
OWNED BY "public"."core_dictionary_items"."id";
SELECT setval('"public"."sys_dictionary_items_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."sys_invitation_codes_id_seq"
OWNED BY "public"."core_invitation_codes"."id";
SELECT setval('"public"."sys_invitation_codes_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."sys_languages_id_seq"
OWNED BY "public"."core_languages"."id";
SELECT setval('"public"."sys_languages_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."sys_site_settings_id_seq"
OWNED BY "public"."core_site_settings"."id";
SELECT setval('"public"."sys_site_settings_id_seq"', 3, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."sys_system_parameters_id_seq"
OWNED BY "public"."core_system_parameters"."id";
SELECT setval('"public"."sys_system_parameters_id_seq"', 1, false);

-- ----------------------------
-- Primary Key structure for table aerich
-- ----------------------------
ALTER TABLE "public"."aerich" ADD CONSTRAINT "aerich_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table apps_master_data_bom
-- ----------------------------
CREATE INDEX "idx_apps_master_data_bom_alternative_group_id" ON "public"."apps_master_data_bom" USING btree (
  "alternative_group_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_bom_approval_status" ON "public"."apps_master_data_bom" USING btree (
  "approval_status" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_bom_bom_code" ON "public"."apps_master_data_bom" USING btree (
  "bom_code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_bom_component_id" ON "public"."apps_master_data_bom" USING btree (
  "component_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_bom_created_at" ON "public"."apps_master_data_bom" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_bom_effective_date" ON "public"."apps_master_data_bom" USING btree (
  "effective_date" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_bom_expiry_date" ON "public"."apps_master_data_bom" USING btree (
  "expiry_date" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_bom_material_id" ON "public"."apps_master_data_bom" USING btree (
  "material_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_bom_tenant_id" ON "public"."apps_master_data_bom" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_bom_uuid" ON "public"."apps_master_data_bom" USING btree (
  "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_bom_version" ON "public"."apps_master_data_bom" USING btree (
  "version" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table apps_master_data_bom
-- ----------------------------
ALTER TABLE "public"."apps_master_data_bom" ADD CONSTRAINT "seed_master_data_bom_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table apps_master_data_bom
-- ----------------------------
ALTER TABLE "public"."apps_master_data_bom" ADD CONSTRAINT "seed_master_data_bom_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table apps_master_data_customers
-- ----------------------------
CREATE INDEX "idx_apps_master_data_customers_category" ON "public"."apps_master_data_customers" USING btree (
  "category" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_customers_code" ON "public"."apps_master_data_customers" USING btree (
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_customers_created_at" ON "public"."apps_master_data_customers" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE UNIQUE INDEX "idx_apps_master_data_customers_tenant_code" ON "public"."apps_master_data_customers" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_customers_tenant_id" ON "public"."apps_master_data_customers" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_customers_uuid" ON "public"."apps_master_data_customers" USING btree (
  "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table apps_master_data_customers
-- ----------------------------
ALTER TABLE "public"."apps_master_data_customers" ADD CONSTRAINT "seed_master_data_customers_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table apps_master_data_customers
-- ----------------------------
ALTER TABLE "public"."apps_master_data_customers" ADD CONSTRAINT "seed_master_data_customers_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table apps_master_data_defect_types
-- ----------------------------
CREATE INDEX "idx_apps_master_data_defect_types_category" ON "public"."apps_master_data_defect_types" USING btree (
  "category" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_defect_types_code" ON "public"."apps_master_data_defect_types" USING btree (
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_defect_types_created_at" ON "public"."apps_master_data_defect_types" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE UNIQUE INDEX "idx_apps_master_data_defect_types_tenant_code" ON "public"."apps_master_data_defect_types" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_defect_types_tenant_id" ON "public"."apps_master_data_defect_types" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_defect_types_uuid" ON "public"."apps_master_data_defect_types" USING btree (
  "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table apps_master_data_defect_types
-- ----------------------------
ALTER TABLE "public"."apps_master_data_defect_types" ADD CONSTRAINT "seed_master_data_defect_types_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table apps_master_data_defect_types
-- ----------------------------
ALTER TABLE "public"."apps_master_data_defect_types" ADD CONSTRAINT "seed_master_data_defect_types_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table apps_master_data_holidays
-- ----------------------------
CREATE INDEX "idx_apps_master_data_holidays_created_at" ON "public"."apps_master_data_holidays" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_holidays_holiday_date" ON "public"."apps_master_data_holidays" USING btree (
  "holiday_date" "pg_catalog"."date_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_holidays_holiday_type" ON "public"."apps_master_data_holidays" USING btree (
  "holiday_type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_holidays_tenant_id" ON "public"."apps_master_data_holidays" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_holidays_uuid" ON "public"."apps_master_data_holidays" USING btree (
  "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table apps_master_data_holidays
-- ----------------------------
ALTER TABLE "public"."apps_master_data_holidays" ADD CONSTRAINT "seed_master_data_holidays_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table apps_master_data_holidays
-- ----------------------------
ALTER TABLE "public"."apps_master_data_holidays" ADD CONSTRAINT "seed_master_data_holidays_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table apps_master_data_material_groups
-- ----------------------------
CREATE INDEX "idx_apps_master_data_material_groups_code" ON "public"."apps_master_data_material_groups" USING btree (
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_material_groups_created_at" ON "public"."apps_master_data_material_groups" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_material_groups_parent_id" ON "public"."apps_master_data_material_groups" USING btree (
  "parent_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE UNIQUE INDEX "idx_apps_master_data_material_groups_tenant_code" ON "public"."apps_master_data_material_groups" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_material_groups_tenant_id" ON "public"."apps_master_data_material_groups" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_material_groups_uuid" ON "public"."apps_master_data_material_groups" USING btree (
  "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table apps_master_data_material_groups
-- ----------------------------
ALTER TABLE "public"."apps_master_data_material_groups" ADD CONSTRAINT "seed_master_data_material_groups_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table apps_master_data_material_groups
-- ----------------------------
ALTER TABLE "public"."apps_master_data_material_groups" ADD CONSTRAINT "seed_master_data_material_groups_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table apps_master_data_materials
-- ----------------------------
CREATE INDEX "idx_apps_master_data_materials_code" ON "public"."apps_master_data_materials" USING btree (
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_materials_created_at" ON "public"."apps_master_data_materials" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_materials_group_id" ON "public"."apps_master_data_materials" USING btree (
  "group_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE UNIQUE INDEX "idx_apps_master_data_materials_tenant_code" ON "public"."apps_master_data_materials" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_materials_tenant_id" ON "public"."apps_master_data_materials" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_materials_uuid" ON "public"."apps_master_data_materials" USING btree (
  "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table apps_master_data_materials
-- ----------------------------
ALTER TABLE "public"."apps_master_data_materials" ADD CONSTRAINT "seed_master_data_materials_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table apps_master_data_materials
-- ----------------------------
ALTER TABLE "public"."apps_master_data_materials" ADD CONSTRAINT "seed_master_data_materials_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table apps_master_data_operations
-- ----------------------------
CREATE INDEX "idx_apps_master_data_operations_code" ON "public"."apps_master_data_operations" USING btree (
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_operations_created_at" ON "public"."apps_master_data_operations" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE UNIQUE INDEX "idx_apps_master_data_operations_tenant_code" ON "public"."apps_master_data_operations" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_operations_tenant_id" ON "public"."apps_master_data_operations" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_operations_uuid" ON "public"."apps_master_data_operations" USING btree (
  "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table apps_master_data_operations
-- ----------------------------
ALTER TABLE "public"."apps_master_data_operations" ADD CONSTRAINT "seed_master_data_operations_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table apps_master_data_operations
-- ----------------------------
ALTER TABLE "public"."apps_master_data_operations" ADD CONSTRAINT "seed_master_data_operations_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table apps_master_data_process_routes
-- ----------------------------
CREATE INDEX "idx_apps_master_data_process_routes_code" ON "public"."apps_master_data_process_routes" USING btree (
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_process_routes_created_at" ON "public"."apps_master_data_process_routes" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE UNIQUE INDEX "idx_apps_master_data_process_routes_tenant_code" ON "public"."apps_master_data_process_routes" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_process_routes_tenant_id" ON "public"."apps_master_data_process_routes" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_process_routes_uuid" ON "public"."apps_master_data_process_routes" USING btree (
  "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table apps_master_data_process_routes
-- ----------------------------
ALTER TABLE "public"."apps_master_data_process_routes" ADD CONSTRAINT "seed_master_data_process_routes_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table apps_master_data_process_routes
-- ----------------------------
ALTER TABLE "public"."apps_master_data_process_routes" ADD CONSTRAINT "seed_master_data_process_routes_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table apps_master_data_production_lines
-- ----------------------------
CREATE INDEX "idx_apps_master_data_production_lines_code" ON "public"."apps_master_data_production_lines" USING btree (
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_production_lines_created_at" ON "public"."apps_master_data_production_lines" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE UNIQUE INDEX "idx_apps_master_data_production_lines_tenant_code" ON "public"."apps_master_data_production_lines" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_production_lines_tenant_id" ON "public"."apps_master_data_production_lines" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_production_lines_uuid" ON "public"."apps_master_data_production_lines" USING btree (
  "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_production_lines_workshop_id" ON "public"."apps_master_data_production_lines" USING btree (
  "workshop_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table apps_master_data_production_lines
-- ----------------------------
ALTER TABLE "public"."apps_master_data_production_lines" ADD CONSTRAINT "seed_master_data_production_lines_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table apps_master_data_production_lines
-- ----------------------------
ALTER TABLE "public"."apps_master_data_production_lines" ADD CONSTRAINT "seed_master_data_production_lines_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table apps_master_data_products
-- ----------------------------
CREATE INDEX "idx_apps_master_data_products_code" ON "public"."apps_master_data_products" USING btree (
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_products_created_at" ON "public"."apps_master_data_products" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE UNIQUE INDEX "idx_apps_master_data_products_tenant_code" ON "public"."apps_master_data_products" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_products_tenant_id" ON "public"."apps_master_data_products" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_products_uuid" ON "public"."apps_master_data_products" USING btree (
  "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_products_version" ON "public"."apps_master_data_products" USING btree (
  "version" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table apps_master_data_products
-- ----------------------------
ALTER TABLE "public"."apps_master_data_products" ADD CONSTRAINT "seed_master_data_products_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table apps_master_data_products
-- ----------------------------
ALTER TABLE "public"."apps_master_data_products" ADD CONSTRAINT "seed_master_data_products_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table apps_master_data_skills
-- ----------------------------
CREATE INDEX "idx_apps_master_data_skills_category" ON "public"."apps_master_data_skills" USING btree (
  "category" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_skills_code" ON "public"."apps_master_data_skills" USING btree (
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_skills_created_at" ON "public"."apps_master_data_skills" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE UNIQUE INDEX "idx_apps_master_data_skills_tenant_code" ON "public"."apps_master_data_skills" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_skills_tenant_id" ON "public"."apps_master_data_skills" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_skills_uuid" ON "public"."apps_master_data_skills" USING btree (
  "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table apps_master_data_skills
-- ----------------------------
ALTER TABLE "public"."apps_master_data_skills" ADD CONSTRAINT "seed_master_data_skills_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table apps_master_data_skills
-- ----------------------------
ALTER TABLE "public"."apps_master_data_skills" ADD CONSTRAINT "seed_master_data_skills_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table apps_master_data_sop
-- ----------------------------
CREATE INDEX "idx_apps_master_data_sop_code" ON "public"."apps_master_data_sop" USING btree (
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_sop_created_at" ON "public"."apps_master_data_sop" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_sop_operation_id" ON "public"."apps_master_data_sop" USING btree (
  "operation_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE UNIQUE INDEX "idx_apps_master_data_sop_tenant_code" ON "public"."apps_master_data_sop" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_sop_tenant_id" ON "public"."apps_master_data_sop" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_sop_uuid" ON "public"."apps_master_data_sop" USING btree (
  "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table apps_master_data_sop
-- ----------------------------
ALTER TABLE "public"."apps_master_data_sop" ADD CONSTRAINT "seed_master_data_sop_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table apps_master_data_sop
-- ----------------------------
ALTER TABLE "public"."apps_master_data_sop" ADD CONSTRAINT "seed_master_data_sop_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table apps_master_data_sop_executions
-- ----------------------------
CREATE INDEX "idx_apps_master_data_sop_executions_created_at" ON "public"."apps_master_data_sop_executions" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_sop_executions_current_node_id" ON "public"."apps_master_data_sop_executions" USING btree (
  "current_node_id" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_sop_executions_executor_id" ON "public"."apps_master_data_sop_executions" USING btree (
  "executor_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_sop_executions_inngest_run_id" ON "public"."apps_master_data_sop_executions" USING btree (
  "inngest_run_id" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_sop_executions_sop_id" ON "public"."apps_master_data_sop_executions" USING btree (
  "sop_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_sop_executions_status" ON "public"."apps_master_data_sop_executions" USING btree (
  "status" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_sop_executions_tenant_created_at" ON "public"."apps_master_data_sop_executions" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_sop_executions_tenant_executor_status" ON "public"."apps_master_data_sop_executions" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,
  "executor_id" "pg_catalog"."int4_ops" ASC NULLS LAST,
  "status" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_sop_executions_tenant_id" ON "public"."apps_master_data_sop_executions" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_sop_executions_tenant_status" ON "public"."apps_master_data_sop_executions" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,
  "status" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_sop_executions_uuid" ON "public"."apps_master_data_sop_executions" USING btree (
  "uuid" "pg_catalog"."uuid_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table apps_master_data_sop_executions
-- ----------------------------
ALTER TABLE "public"."apps_master_data_sop_executions" ADD CONSTRAINT "seed_master_data_sop_executions_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table apps_master_data_sop_executions
-- ----------------------------
ALTER TABLE "public"."apps_master_data_sop_executions" ADD CONSTRAINT "seed_master_data_sop_executions_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table apps_master_data_storage_areas
-- ----------------------------
CREATE INDEX "idx_apps_master_data_storage_areas_code" ON "public"."apps_master_data_storage_areas" USING btree (
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_storage_areas_created_at" ON "public"."apps_master_data_storage_areas" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE UNIQUE INDEX "idx_apps_master_data_storage_areas_tenant_code" ON "public"."apps_master_data_storage_areas" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_storage_areas_tenant_id" ON "public"."apps_master_data_storage_areas" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_storage_areas_uuid" ON "public"."apps_master_data_storage_areas" USING btree (
  "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_storage_areas_warehouse_id" ON "public"."apps_master_data_storage_areas" USING btree (
  "warehouse_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table apps_master_data_storage_areas
-- ----------------------------
ALTER TABLE "public"."apps_master_data_storage_areas" ADD CONSTRAINT "seed_master_data_storage_areas_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table apps_master_data_storage_areas
-- ----------------------------
ALTER TABLE "public"."apps_master_data_storage_areas" ADD CONSTRAINT "seed_master_data_storage_areas_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table apps_master_data_storage_locations
-- ----------------------------
CREATE INDEX "idx_apps_master_data_storage_locations_code" ON "public"."apps_master_data_storage_locations" USING btree (
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_storage_locations_created_at" ON "public"."apps_master_data_storage_locations" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_storage_locations_storage_area_id" ON "public"."apps_master_data_storage_locations" USING btree (
  "storage_area_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE UNIQUE INDEX "idx_apps_master_data_storage_locations_tenant_code" ON "public"."apps_master_data_storage_locations" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_storage_locations_tenant_id" ON "public"."apps_master_data_storage_locations" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_storage_locations_uuid" ON "public"."apps_master_data_storage_locations" USING btree (
  "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table apps_master_data_storage_locations
-- ----------------------------
ALTER TABLE "public"."apps_master_data_storage_locations" ADD CONSTRAINT "seed_master_data_storage_locations_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table apps_master_data_storage_locations
-- ----------------------------
ALTER TABLE "public"."apps_master_data_storage_locations" ADD CONSTRAINT "seed_master_data_storage_locations_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table apps_master_data_suppliers
-- ----------------------------
CREATE INDEX "idx_apps_master_data_suppliers_category" ON "public"."apps_master_data_suppliers" USING btree (
  "category" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_suppliers_code" ON "public"."apps_master_data_suppliers" USING btree (
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_suppliers_created_at" ON "public"."apps_master_data_suppliers" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE UNIQUE INDEX "idx_apps_master_data_suppliers_tenant_code" ON "public"."apps_master_data_suppliers" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_suppliers_tenant_id" ON "public"."apps_master_data_suppliers" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_suppliers_uuid" ON "public"."apps_master_data_suppliers" USING btree (
  "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table apps_master_data_suppliers
-- ----------------------------
ALTER TABLE "public"."apps_master_data_suppliers" ADD CONSTRAINT "seed_master_data_suppliers_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table apps_master_data_suppliers
-- ----------------------------
ALTER TABLE "public"."apps_master_data_suppliers" ADD CONSTRAINT "seed_master_data_suppliers_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table apps_master_data_warehouses
-- ----------------------------
CREATE INDEX "idx_apps_master_data_warehouses_code" ON "public"."apps_master_data_warehouses" USING btree (
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_warehouses_created_at" ON "public"."apps_master_data_warehouses" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE UNIQUE INDEX "idx_apps_master_data_warehouses_tenant_code" ON "public"."apps_master_data_warehouses" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_warehouses_tenant_id" ON "public"."apps_master_data_warehouses" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_warehouses_uuid" ON "public"."apps_master_data_warehouses" USING btree (
  "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table apps_master_data_warehouses
-- ----------------------------
ALTER TABLE "public"."apps_master_data_warehouses" ADD CONSTRAINT "seed_master_data_warehouses_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table apps_master_data_warehouses
-- ----------------------------
ALTER TABLE "public"."apps_master_data_warehouses" ADD CONSTRAINT "seed_master_data_warehouses_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table apps_master_data_workshops
-- ----------------------------
CREATE INDEX "idx_apps_master_data_workshops_code" ON "public"."apps_master_data_workshops" USING btree (
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_workshops_created_at" ON "public"."apps_master_data_workshops" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE UNIQUE INDEX "idx_apps_master_data_workshops_tenant_code" ON "public"."apps_master_data_workshops" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_workshops_tenant_id" ON "public"."apps_master_data_workshops" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_workshops_uuid" ON "public"."apps_master_data_workshops" USING btree (
  "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table apps_master_data_workshops
-- ----------------------------
ALTER TABLE "public"."apps_master_data_workshops" ADD CONSTRAINT "seed_master_data_workshops_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table apps_master_data_workshops
-- ----------------------------
ALTER TABLE "public"."apps_master_data_workshops" ADD CONSTRAINT "seed_master_data_workshops_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table apps_master_data_workstations
-- ----------------------------
CREATE INDEX "idx_apps_master_data_workstations_code" ON "public"."apps_master_data_workstations" USING btree (
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_workstations_created_at" ON "public"."apps_master_data_workstations" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_workstations_production_line_id" ON "public"."apps_master_data_workstations" USING btree (
  "production_line_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE UNIQUE INDEX "idx_apps_master_data_workstations_tenant_code" ON "public"."apps_master_data_workstations" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_workstations_tenant_id" ON "public"."apps_master_data_workstations" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_apps_master_data_workstations_uuid" ON "public"."apps_master_data_workstations" USING btree (
  "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table apps_master_data_workstations
-- ----------------------------
ALTER TABLE "public"."apps_master_data_workstations" ADD CONSTRAINT "seed_master_data_workstations_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table apps_master_data_workstations
-- ----------------------------
ALTER TABLE "public"."apps_master_data_workstations" ADD CONSTRAINT "seed_master_data_workstations_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table core_apis
-- ----------------------------
CREATE INDEX "idx_core_apis_code" ON "public"."core_apis" USING btree (
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_apis_created_at" ON "public"."core_apis" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_apis_method" ON "public"."core_apis" USING btree (
  "method" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_apis_tenant_id" ON "public"."core_apis" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_apis_uuid" ON "public"."core_apis" USING btree (
  "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE UNIQUE INDEX "uk_core_apis_tenant_code" ON "public"."core_apis" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
) WHERE deleted_at IS NULL;

-- ----------------------------
-- Uniques structure for table core_apis
-- ----------------------------
ALTER TABLE "public"."core_apis" ADD CONSTRAINT "root_apis_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table core_apis
-- ----------------------------
ALTER TABLE "public"."core_apis" ADD CONSTRAINT "root_apis_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table core_applications
-- ----------------------------
CREATE INDEX "idx_core_applic_code_a1b2c4" ON "public"."core_applications" USING btree (
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_applic_created_a1b2c6" ON "public"."core_applications" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_applic_tenant__a1b2c3" ON "public"."core_applications" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_applic_uuid_a1b2c5" ON "public"."core_applications" USING btree (
  "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table core_applications
-- ----------------------------
ALTER TABLE "public"."core_applications" ADD CONSTRAINT "root_applications_uuid_key" UNIQUE ("uuid");
ALTER TABLE "public"."core_applications" ADD CONSTRAINT "uk_core_applic_tenant__a1b2c3" UNIQUE ("tenant_id", "code");

-- ----------------------------
-- Primary Key structure for table core_applications
-- ----------------------------
ALTER TABLE "public"."core_applications" ADD CONSTRAINT "root_applications_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table core_approval_histories
-- ----------------------------
CREATE INDEX "idx_core_approv_action__0f4144" ON "public"."core_approval_histories" USING btree (
  "action_by" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_approv_action__b16310" ON "public"."core_approval_histories" USING btree (
  "action_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_approv_action_bd31f0" ON "public"."core_approval_histories" USING btree (
  "action" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_approv_approva_a2dd10" ON "public"."core_approval_histories" USING btree (
  "approval_instance_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_approv_tenant__89d1d6" ON "public"."core_approval_histories" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_approv_uuid_9a1b94" ON "public"."core_approval_histories" USING btree (
  "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table core_approval_histories
-- ----------------------------
ALTER TABLE "public"."core_approval_histories" ADD CONSTRAINT "core_approval_histories_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table core_approval_instances
-- ----------------------------
CREATE INDEX "idx_core_approval_instances_created_at" ON "public"."core_approval_instances" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_approval_instances_current_approver_id" ON "public"."core_approval_instances" USING btree (
  "current_approver_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_approval_instances_inngest_run_id" ON "public"."core_approval_instances" USING btree (
  "inngest_run_id" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_approval_instances_process_id" ON "public"."core_approval_instances" USING btree (
  "process_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_approval_instances_status" ON "public"."core_approval_instances" USING btree (
  "status" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_approval_instances_submitter_id" ON "public"."core_approval_instances" USING btree (
  "submitter_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_approval_instances_tenant_id" ON "public"."core_approval_instances" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_approval_instances_uuid" ON "public"."core_approval_instances" USING btree (
  "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table core_approval_instances
-- ----------------------------
ALTER TABLE "public"."core_approval_instances" ADD CONSTRAINT "root_approval_instances_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table core_approval_instances
-- ----------------------------
ALTER TABLE "public"."core_approval_instances" ADD CONSTRAINT "root_approval_instances_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table core_approval_processes
-- ----------------------------
CREATE INDEX "idx_core_approval_processes_code" ON "public"."core_approval_processes" USING btree (
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_approval_processes_created_at" ON "public"."core_approval_processes" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_approval_processes_is_active" ON "public"."core_approval_processes" USING btree (
  "is_active" "pg_catalog"."bool_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_approval_processes_tenant_id" ON "public"."core_approval_processes" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_approval_processes_uuid" ON "public"."core_approval_processes" USING btree (
  "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE UNIQUE INDEX "uk_core_approval_processes_tenant_code" ON "public"."core_approval_processes" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
) WHERE deleted_at IS NULL;

-- ----------------------------
-- Uniques structure for table core_approval_processes
-- ----------------------------
ALTER TABLE "public"."core_approval_processes" ADD CONSTRAINT "root_approval_processes_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table core_approval_processes
-- ----------------------------
ALTER TABLE "public"."core_approval_processes" ADD CONSTRAINT "root_approval_processes_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table core_code_rules
-- ----------------------------
CREATE INDEX "idx_core_code_r_code_e9f4g5" ON "public"."core_code_rules" USING btree (
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_code_r_created_f9g4h5" ON "public"."core_code_rules" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_code_r_tenant__d9e4f5" ON "public"."core_code_rules" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table core_code_rules
-- ----------------------------
ALTER TABLE "public"."core_code_rules" ADD CONSTRAINT "sys_code_rules_uuid_key" UNIQUE ("uuid");
ALTER TABLE "public"."core_code_rules" ADD CONSTRAINT "uk_core_code_r_tenant__d9e4f5" UNIQUE ("tenant_id", "code");

-- ----------------------------
-- Primary Key structure for table core_code_rules
-- ----------------------------
ALTER TABLE "public"."core_code_rules" ADD CONSTRAINT "sys_code_rules_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table core_code_sequences
-- ----------------------------
CREATE INDEX "idx_core_code_s_code_ru_g9h4i5" ON "public"."core_code_sequences" USING btree (
  "code_rule_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_code_s_tenant__h9i4j5" ON "public"."core_code_sequences" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table core_code_sequences
-- ----------------------------
ALTER TABLE "public"."core_code_sequences" ADD CONSTRAINT "sys_code_sequences_uuid_key" UNIQUE ("uuid");
ALTER TABLE "public"."core_code_sequences" ADD CONSTRAINT "uk_core_code_s_code_ru_g9h4i5" UNIQUE ("code_rule_id", "tenant_id");

-- ----------------------------
-- Primary Key structure for table core_code_sequences
-- ----------------------------
ALTER TABLE "public"."core_code_sequences" ADD CONSTRAINT "sys_code_sequences_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table core_custom_field_values
-- ----------------------------
CREATE INDEX "idx_core_custom_v_created_o9p4q5" ON "public"."core_custom_field_values" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_custom_v_custom__l9m4n5" ON "public"."core_custom_field_values" USING btree (
  "custom_field_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_custom_v_record_n9o4p5" ON "public"."core_custom_field_values" USING btree (
  "record_table" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST,
  "record_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_custom_v_tenant__m9n4o5" ON "public"."core_custom_field_values" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table core_custom_field_values
-- ----------------------------
ALTER TABLE "public"."core_custom_field_values" ADD CONSTRAINT "sys_custom_field_values_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table core_custom_field_values
-- ----------------------------
ALTER TABLE "public"."core_custom_field_values" ADD CONSTRAINT "sys_custom_field_values_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table core_custom_fields
-- ----------------------------
CREATE INDEX "idx_core_custom_created_k9l4m5" ON "public"."core_custom_fields" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_custom_table__j9k4l5" ON "public"."core_custom_fields" USING btree (
  "table_name" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_custom_tenant__i9j4k5" ON "public"."core_custom_fields" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table core_custom_fields
-- ----------------------------
ALTER TABLE "public"."core_custom_fields" ADD CONSTRAINT "sys_custom_fields_uuid_key" UNIQUE ("uuid");
ALTER TABLE "public"."core_custom_fields" ADD CONSTRAINT "uk_core_custom_tenant__i9j4k5" UNIQUE ("tenant_id", "table_name", "code");

-- ----------------------------
-- Primary Key structure for table core_custom_fields
-- ----------------------------
ALTER TABLE "public"."core_custom_fields" ADD CONSTRAINT "sys_custom_fields_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table core_data_backups
-- ----------------------------
CREATE INDEX "idx_core_data_backups_backup_scope" ON "public"."core_data_backups" USING btree (
  "backup_scope" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_data_backups_backup_type" ON "public"."core_data_backups" USING btree (
  "backup_type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_data_backups_created_at" ON "public"."core_data_backups" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_data_backups_status" ON "public"."core_data_backups" USING btree (
  "status" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_data_backups_tenant_id" ON "public"."core_data_backups" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_data_backups_uuid" ON "public"."core_data_backups" USING btree (
  "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table core_data_backups
-- ----------------------------
ALTER TABLE "public"."core_data_backups" ADD CONSTRAINT "root_data_backups_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table core_data_backups
-- ----------------------------
ALTER TABLE "public"."core_data_backups" ADD CONSTRAINT "root_data_backups_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table core_data_dictionaries
-- ----------------------------
CREATE INDEX "idx_core_data_di_code_c8d3e4" ON "public"."core_data_dictionaries" USING btree (
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_data_di_created_d8e3f4" ON "public"."core_data_dictionaries" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_data_di_tenant__a8b3c4" ON "public"."core_data_dictionaries" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_data_di_uuid_b8c3d4" ON "public"."core_data_dictionaries" USING btree (
  "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table core_data_dictionaries
-- ----------------------------
ALTER TABLE "public"."core_data_dictionaries" ADD CONSTRAINT "sys_data_dictionaries_uuid_key" UNIQUE ("uuid");
ALTER TABLE "public"."core_data_dictionaries" ADD CONSTRAINT "uk_core_data_di_tenant__a8b3c4" UNIQUE ("tenant_id", "code");

-- ----------------------------
-- Primary Key structure for table core_data_dictionaries
-- ----------------------------
ALTER TABLE "public"."core_data_dictionaries" ADD CONSTRAINT "sys_data_dictionaries_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table core_data_sources
-- ----------------------------
CREATE INDEX "idx_core_data_sources_code" ON "public"."core_data_sources" USING btree (
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_data_sources_created_at" ON "public"."core_data_sources" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_data_sources_tenant_id" ON "public"."core_data_sources" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_data_sources_type" ON "public"."core_data_sources" USING btree (
  "type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_data_sources_uuid" ON "public"."core_data_sources" USING btree (
  "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE UNIQUE INDEX "uk_core_data_sources_tenant_code" ON "public"."core_data_sources" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
) WHERE deleted_at IS NULL;

-- ----------------------------
-- Uniques structure for table core_data_sources
-- ----------------------------
ALTER TABLE "public"."core_data_sources" ADD CONSTRAINT "root_data_sources_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table core_data_sources
-- ----------------------------
ALTER TABLE "public"."core_data_sources" ADD CONSTRAINT "root_data_sources_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table core_datasets
-- ----------------------------
CREATE INDEX "idx_core_datasets_code" ON "public"."core_datasets" USING btree (
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_datasets_created_at" ON "public"."core_datasets" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_datasets_data_source_id" ON "public"."core_datasets" USING btree (
  "data_source_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_datasets_tenant_id" ON "public"."core_datasets" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_datasets_uuid" ON "public"."core_datasets" USING btree (
  "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE UNIQUE INDEX "uk_core_datasets_tenant_code" ON "public"."core_datasets" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
) WHERE deleted_at IS NULL;

-- ----------------------------
-- Uniques structure for table core_datasets
-- ----------------------------
ALTER TABLE "public"."core_datasets" ADD CONSTRAINT "root_datasets_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table core_datasets
-- ----------------------------
ALTER TABLE "public"."core_datasets" ADD CONSTRAINT "root_datasets_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table core_departments
-- ----------------------------
CREATE INDEX "idx_core_departments_created_at" ON "public"."core_departments" USING btree (
  "created_at" "pg_catalog"."timestamp_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_departments_manager_id" ON "public"."core_departments" USING btree (
  "manager_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_departments_parent_id" ON "public"."core_departments" USING btree (
  "parent_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_departments_sort_order" ON "public"."core_departments" USING btree (
  "sort_order" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_departments_tenant_id" ON "public"."core_departments" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table core_departments
-- ----------------------------
ALTER TABLE "public"."core_departments" ADD CONSTRAINT "root_departments_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table core_departments
-- ----------------------------
ALTER TABLE "public"."core_departments" ADD CONSTRAINT "root_departments_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table core_dictionary_items
-- ----------------------------
CREATE INDEX "idx_core_dictio_created_e9f4g5" ON "public"."core_dictionary_items" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_dictio_diction_c9d4e5" ON "public"."core_dictionary_items" USING btree (
  "dictionary_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_dictio_sort_or_d9e4f5" ON "public"."core_dictionary_items" USING btree (
  "sort_order" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_dictio_tenant__b9c4d5" ON "public"."core_dictionary_items" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table core_dictionary_items
-- ----------------------------
ALTER TABLE "public"."core_dictionary_items" ADD CONSTRAINT "sys_dictionary_items_uuid_key" UNIQUE ("uuid");
ALTER TABLE "public"."core_dictionary_items" ADD CONSTRAINT "uk_core_dictio_tenant__b9c4d5" UNIQUE ("tenant_id", "dictionary_id", "value");

-- ----------------------------
-- Primary Key structure for table core_dictionary_items
-- ----------------------------
ALTER TABLE "public"."core_dictionary_items" ADD CONSTRAINT "sys_dictionary_items_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table core_electronic_records
-- ----------------------------
CREATE INDEX "idx_core_electronic_records_code" ON "public"."core_electronic_records" USING btree (
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_electronic_records_created_at" ON "public"."core_electronic_records" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_electronic_records_lifecycle_stage" ON "public"."core_electronic_records" USING btree (
  "lifecycle_stage" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_electronic_records_status" ON "public"."core_electronic_records" USING btree (
  "status" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_electronic_records_tenant_id" ON "public"."core_electronic_records" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_electronic_records_type" ON "public"."core_electronic_records" USING btree (
  "type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_electronic_records_uuid" ON "public"."core_electronic_records" USING btree (
  "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE UNIQUE INDEX "uk_core_electronic_records_tenant_code" ON "public"."core_electronic_records" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
) WHERE deleted_at IS NULL;

-- ----------------------------
-- Uniques structure for table core_electronic_records
-- ----------------------------
ALTER TABLE "public"."core_electronic_records" ADD CONSTRAINT "root_electronic_records_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table core_electronic_records
-- ----------------------------
ALTER TABLE "public"."core_electronic_records" ADD CONSTRAINT "root_electronic_records_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table core_files
-- ----------------------------
CREATE INDEX "idx_core_files_category" ON "public"."core_files" USING btree (
  "category" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_files_created_at" ON "public"."core_files" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_files_file_type" ON "public"."core_files" USING btree (
  "file_type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_files_tenant_id" ON "public"."core_files" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_files_upload_status" ON "public"."core_files" USING btree (
  "upload_status" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_files_uuid" ON "public"."core_files" USING btree (
  "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table core_files
-- ----------------------------
ALTER TABLE "public"."core_files" ADD CONSTRAINT "root_files_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table core_files
-- ----------------------------
ALTER TABLE "public"."core_files" ADD CONSTRAINT "root_files_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table core_integration_configs
-- ----------------------------
CREATE INDEX "idx_core_integra_code_b1c2d4" ON "public"."core_integration_configs" USING btree (
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_integra_created_b1c2d7" ON "public"."core_integration_configs" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_integra_tenant__b1c2d3" ON "public"."core_integration_configs" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_integra_type_b1c2d6" ON "public"."core_integration_configs" USING btree (
  "type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_integra_uuid_b1c2d5" ON "public"."core_integration_configs" USING btree (
  "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table core_integration_configs
-- ----------------------------
ALTER TABLE "public"."core_integration_configs" ADD CONSTRAINT "root_integration_configs_uuid_key" UNIQUE ("uuid");
ALTER TABLE "public"."core_integration_configs" ADD CONSTRAINT "uk_core_integra_tenant__b1c2d3" UNIQUE ("tenant_id", "code");

-- ----------------------------
-- Primary Key structure for table core_integration_configs
-- ----------------------------
ALTER TABLE "public"."core_integration_configs" ADD CONSTRAINT "root_integration_configs_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table core_invitation_codes
-- ----------------------------
CREATE INDEX "idx_core_invita_code_s9t4u5" ON "public"."core_invitation_codes" USING btree (
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_invita_created_t9u4v5" ON "public"."core_invitation_codes" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_invita_tenant__r9s4t5" ON "public"."core_invitation_codes" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table core_invitation_codes
-- ----------------------------
ALTER TABLE "public"."core_invitation_codes" ADD CONSTRAINT "sys_invitation_codes_uuid_key" UNIQUE ("uuid");
ALTER TABLE "public"."core_invitation_codes" ADD CONSTRAINT "sys_invitation_codes_code_key" UNIQUE ("code");

-- ----------------------------
-- Primary Key structure for table core_invitation_codes
-- ----------------------------
ALTER TABLE "public"."core_invitation_codes" ADD CONSTRAINT "sys_invitation_codes_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table core_languages
-- ----------------------------
CREATE INDEX "idx_core_languag_code_v9w4x5" ON "public"."core_languages" USING btree (
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_languag_created_w9x4y5" ON "public"."core_languages" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_languag_tenant__u9v4w5" ON "public"."core_languages" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table core_languages
-- ----------------------------
ALTER TABLE "public"."core_languages" ADD CONSTRAINT "sys_languages_uuid_key" UNIQUE ("uuid");
ALTER TABLE "public"."core_languages" ADD CONSTRAINT "uk_core_languag_tenant__u9v4w5" UNIQUE ("tenant_id", "code");

-- ----------------------------
-- Primary Key structure for table core_languages
-- ----------------------------
ALTER TABLE "public"."core_languages" ADD CONSTRAINT "sys_languages_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table core_login_logs
-- ----------------------------
CREATE INDEX "idx_core_login_logs_created_at" ON "public"."core_login_logs" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_login_logs_login_ip" ON "public"."core_login_logs" USING btree (
  "login_ip" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_login_logs_login_status" ON "public"."core_login_logs" USING btree (
  "login_status" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_login_logs_tenant_id" ON "public"."core_login_logs" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_login_logs_user_id" ON "public"."core_login_logs" USING btree (
  "user_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_login_logs_username" ON "public"."core_login_logs" USING btree (
  "username" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_login_logs_uuid" ON "public"."core_login_logs" USING btree (
  "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table core_login_logs
-- ----------------------------
ALTER TABLE "public"."core_login_logs" ADD CONSTRAINT "root_login_logs_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table core_login_logs
-- ----------------------------
ALTER TABLE "public"."core_login_logs" ADD CONSTRAINT "root_login_logs_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table core_menus
-- ----------------------------
CREATE INDEX "idx_core_menus_application_uuid" ON "public"."core_menus" USING btree (
  "application_uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_menus_created_at" ON "public"."core_menus" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_menus_is_active" ON "public"."core_menus" USING btree (
  "is_active" "pg_catalog"."bool_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_menus_parent_id" ON "public"."core_menus" USING btree (
  "parent_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_menus_permission_code" ON "public"."core_menus" USING btree (
  "permission_code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_menus_sort_order" ON "public"."core_menus" USING btree (
  "sort_order" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_menus_tenant_id" ON "public"."core_menus" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table core_menus
-- ----------------------------
ALTER TABLE "public"."core_menus" ADD CONSTRAINT "root_menus_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table core_menus
-- ----------------------------
ALTER TABLE "public"."core_menus" ADD CONSTRAINT "root_menus_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table core_message_configs
-- ----------------------------
CREATE INDEX "idx_core_message_configs_code" ON "public"."core_message_configs" USING btree (
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_message_configs_created_at" ON "public"."core_message_configs" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_message_configs_tenant_id" ON "public"."core_message_configs" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_message_configs_type" ON "public"."core_message_configs" USING btree (
  "type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_message_configs_uuid" ON "public"."core_message_configs" USING btree (
  "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE UNIQUE INDEX "uk_core_message_configs_tenant_code" ON "public"."core_message_configs" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
) WHERE deleted_at IS NULL;

-- ----------------------------
-- Uniques structure for table core_message_configs
-- ----------------------------
ALTER TABLE "public"."core_message_configs" ADD CONSTRAINT "root_message_configs_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table core_message_configs
-- ----------------------------
ALTER TABLE "public"."core_message_configs" ADD CONSTRAINT "root_message_configs_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table core_message_logs
-- ----------------------------
CREATE INDEX "idx_core_message_logs_config_uuid" ON "public"."core_message_logs" USING btree (
  "config_uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_message_logs_created_at" ON "public"."core_message_logs" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_message_logs_inngest_run_id" ON "public"."core_message_logs" USING btree (
  "inngest_run_id" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_message_logs_status" ON "public"."core_message_logs" USING btree (
  "status" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_message_logs_template_uuid" ON "public"."core_message_logs" USING btree (
  "template_uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_message_logs_tenant_id" ON "public"."core_message_logs" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_message_logs_type" ON "public"."core_message_logs" USING btree (
  "type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_message_logs_uuid" ON "public"."core_message_logs" USING btree (
  "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table core_message_logs
-- ----------------------------
ALTER TABLE "public"."core_message_logs" ADD CONSTRAINT "root_message_logs_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table core_message_logs
-- ----------------------------
ALTER TABLE "public"."core_message_logs" ADD CONSTRAINT "root_message_logs_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table core_message_templates
-- ----------------------------
CREATE INDEX "idx_core_message_templates_code" ON "public"."core_message_templates" USING btree (
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_message_templates_created_at" ON "public"."core_message_templates" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_message_templates_tenant_id" ON "public"."core_message_templates" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_message_templates_type" ON "public"."core_message_templates" USING btree (
  "type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_message_templates_uuid" ON "public"."core_message_templates" USING btree (
  "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE UNIQUE INDEX "uk_core_message_templates_tenant_code" ON "public"."core_message_templates" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
) WHERE deleted_at IS NULL;

-- ----------------------------
-- Uniques structure for table core_message_templates
-- ----------------------------
ALTER TABLE "public"."core_message_templates" ADD CONSTRAINT "root_message_templates_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table core_message_templates
-- ----------------------------
ALTER TABLE "public"."core_message_templates" ADD CONSTRAINT "root_message_templates_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table core_operation_logs
-- ----------------------------
CREATE INDEX "idx_core_operation_logs_created_at" ON "public"."core_operation_logs" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_operation_logs_operation_module" ON "public"."core_operation_logs" USING btree (
  "operation_module" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_operation_logs_operation_object_type" ON "public"."core_operation_logs" USING btree (
  "operation_object_type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_operation_logs_operation_type" ON "public"."core_operation_logs" USING btree (
  "operation_type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_operation_logs_tenant_id" ON "public"."core_operation_logs" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_operation_logs_user_id" ON "public"."core_operation_logs" USING btree (
  "user_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_operation_logs_uuid" ON "public"."core_operation_logs" USING btree (
  "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table core_operation_logs
-- ----------------------------
ALTER TABLE "public"."core_operation_logs" ADD CONSTRAINT "root_operation_logs_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table core_operation_logs
-- ----------------------------
ALTER TABLE "public"."core_operation_logs" ADD CONSTRAINT "root_operation_logs_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table core_permissions
-- ----------------------------
CREATE INDEX "idx_core_permiss_code_b35ea3" ON "public"."core_permissions" USING btree (
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_permiss_permiss_8e9b79" ON "public"."core_permissions" USING btree (
  "permission_type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_permiss_resourc_941e0b" ON "public"."core_permissions" USING btree (
  "resource" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_permiss_tenant__99f233" ON "public"."core_permissions" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table core_permissions
-- ----------------------------
ALTER TABLE "public"."core_permissions" ADD CONSTRAINT "uk_core_permissions_uuid" UNIQUE ("uuid");
ALTER TABLE "public"."core_permissions" ADD CONSTRAINT "uk_core_permiss_tenant__a6de52" UNIQUE ("tenant_id", "code");

-- ----------------------------
-- Indexes structure for table core_positions
-- ----------------------------
CREATE INDEX "idx_core_positions_code" ON "public"."core_positions" USING btree (
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_positions_created_at" ON "public"."core_positions" USING btree (
  "created_at" "pg_catalog"."timestamp_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_positions_department_id" ON "public"."core_positions" USING btree (
  "department_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_positions_sort_order" ON "public"."core_positions" USING btree (
  "sort_order" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_positions_tenant_id" ON "public"."core_positions" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table core_positions
-- ----------------------------
ALTER TABLE "public"."core_positions" ADD CONSTRAINT "root_positions_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table core_positions
-- ----------------------------
ALTER TABLE "public"."core_positions" ADD CONSTRAINT "root_positions_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table core_print_devices
-- ----------------------------
CREATE INDEX "idx_core_print_devices_code" ON "public"."core_print_devices" USING btree (
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_print_devices_created_at" ON "public"."core_print_devices" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_print_devices_is_active" ON "public"."core_print_devices" USING btree (
  "is_active" "pg_catalog"."bool_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_print_devices_is_default" ON "public"."core_print_devices" USING btree (
  "is_default" "pg_catalog"."bool_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_print_devices_is_online" ON "public"."core_print_devices" USING btree (
  "is_online" "pg_catalog"."bool_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_print_devices_tenant_id" ON "public"."core_print_devices" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_print_devices_type" ON "public"."core_print_devices" USING btree (
  "type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_print_devices_uuid" ON "public"."core_print_devices" USING btree (
  "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE UNIQUE INDEX "uk_core_print_devices_tenant_code" ON "public"."core_print_devices" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
) WHERE deleted_at IS NULL;

-- ----------------------------
-- Uniques structure for table core_print_devices
-- ----------------------------
ALTER TABLE "public"."core_print_devices" ADD CONSTRAINT "root_print_devices_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table core_print_devices
-- ----------------------------
ALTER TABLE "public"."core_print_devices" ADD CONSTRAINT "root_print_devices_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table core_print_templates
-- ----------------------------
CREATE INDEX "idx_core_print_templates_code" ON "public"."core_print_templates" USING btree (
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_print_templates_created_at" ON "public"."core_print_templates" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_print_templates_is_active" ON "public"."core_print_templates" USING btree (
  "is_active" "pg_catalog"."bool_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_print_templates_is_default" ON "public"."core_print_templates" USING btree (
  "is_default" "pg_catalog"."bool_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_print_templates_tenant_id" ON "public"."core_print_templates" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_print_templates_type" ON "public"."core_print_templates" USING btree (
  "type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_print_templates_uuid" ON "public"."core_print_templates" USING btree (
  "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE UNIQUE INDEX "uk_core_print_templates_tenant_code" ON "public"."core_print_templates" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
) WHERE deleted_at IS NULL;

-- ----------------------------
-- Uniques structure for table core_print_templates
-- ----------------------------
ALTER TABLE "public"."core_print_templates" ADD CONSTRAINT "root_print_templates_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table core_print_templates
-- ----------------------------
ALTER TABLE "public"."core_print_templates" ADD CONSTRAINT "root_print_templates_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Uniques structure for table core_roles
-- ----------------------------
ALTER TABLE "public"."core_roles" ADD CONSTRAINT "uk_core_roles_uuid" UNIQUE ("uuid");

-- ----------------------------
-- Uniques structure for table core_saved_searches
-- ----------------------------
ALTER TABLE "public"."core_saved_searches" ADD CONSTRAINT "uk_core_saved_searches_uuid" UNIQUE ("uuid");

-- ----------------------------
-- Indexes structure for table core_scheduled_tasks
-- ----------------------------
CREATE INDEX "idx_core_scheduled_tasks_code" ON "public"."core_scheduled_tasks" USING btree (
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_scheduled_tasks_created_at" ON "public"."core_scheduled_tasks" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_scheduled_tasks_is_active" ON "public"."core_scheduled_tasks" USING btree (
  "is_active" "pg_catalog"."bool_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_scheduled_tasks_tenant_id" ON "public"."core_scheduled_tasks" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_scheduled_tasks_trigger_type" ON "public"."core_scheduled_tasks" USING btree (
  "trigger_type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_scheduled_tasks_type" ON "public"."core_scheduled_tasks" USING btree (
  "type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_scheduled_tasks_uuid" ON "public"."core_scheduled_tasks" USING btree (
  "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE UNIQUE INDEX "uk_core_scheduled_tasks_tenant_code" ON "public"."core_scheduled_tasks" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
) WHERE deleted_at IS NULL;

-- ----------------------------
-- Uniques structure for table core_scheduled_tasks
-- ----------------------------
ALTER TABLE "public"."core_scheduled_tasks" ADD CONSTRAINT "root_scheduled_tasks_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table core_scheduled_tasks
-- ----------------------------
ALTER TABLE "public"."core_scheduled_tasks" ADD CONSTRAINT "root_scheduled_tasks_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table core_scripts
-- ----------------------------
CREATE INDEX "idx_core_scripts_code" ON "public"."core_scripts" USING btree (
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_scripts_created_at" ON "public"."core_scripts" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_scripts_is_active" ON "public"."core_scripts" USING btree (
  "is_active" "pg_catalog"."bool_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_scripts_tenant_id" ON "public"."core_scripts" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_scripts_type" ON "public"."core_scripts" USING btree (
  "type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_scripts_uuid" ON "public"."core_scripts" USING btree (
  "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE UNIQUE INDEX "uk_core_scripts_tenant_code" ON "public"."core_scripts" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,
  "code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
) WHERE deleted_at IS NULL;

-- ----------------------------
-- Uniques structure for table core_scripts
-- ----------------------------
ALTER TABLE "public"."core_scripts" ADD CONSTRAINT "root_scripts_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table core_scripts
-- ----------------------------
ALTER TABLE "public"."core_scripts" ADD CONSTRAINT "root_scripts_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table core_site_settings
-- ----------------------------
CREATE INDEX "idx_core_site_s_created_q9r4s5" ON "public"."core_site_settings" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_site_s_tenant__p9q4r5" ON "public"."core_site_settings" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table core_site_settings
-- ----------------------------
ALTER TABLE "public"."core_site_settings" ADD CONSTRAINT "sys_site_settings_uuid_key" UNIQUE ("uuid");
ALTER TABLE "public"."core_site_settings" ADD CONSTRAINT "uk_core_site_s_tenant__p9q4r5" UNIQUE ("tenant_id");

-- ----------------------------
-- Primary Key structure for table core_site_settings
-- ----------------------------
ALTER TABLE "public"."core_site_settings" ADD CONSTRAINT "sys_site_settings_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table core_system_parameters
-- ----------------------------
CREATE INDEX "idx_core_system_created_e9f4g5" ON "public"."core_system_parameters" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_system_key_d9e4f5" ON "public"."core_system_parameters" USING btree (
  "key" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_system_tenant__c9d4e5" ON "public"."core_system_parameters" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table core_system_parameters
-- ----------------------------
ALTER TABLE "public"."core_system_parameters" ADD CONSTRAINT "sys_system_parameters_uuid_key" UNIQUE ("uuid");
ALTER TABLE "public"."core_system_parameters" ADD CONSTRAINT "uk_core_system_tenant__c9d4e5" UNIQUE ("tenant_id", "key");

-- ----------------------------
-- Primary Key structure for table core_system_parameters
-- ----------------------------
ALTER TABLE "public"."core_system_parameters" ADD CONSTRAINT "sys_system_parameters_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table core_user_preferences
-- ----------------------------
CREATE INDEX "idx_core_user_preferences_created_at" ON "public"."core_user_preferences" USING btree (
  "created_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_user_preferences_tenant_id" ON "public"."core_user_preferences" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_user_preferences_user_id" ON "public"."core_user_preferences" USING btree (
  "user_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_user_preferences_uuid" ON "public"."core_user_preferences" USING btree (
  "uuid" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE UNIQUE INDEX "uk_core_user_preferences_user_id" ON "public"."core_user_preferences" USING btree (
  "user_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table core_user_preferences
-- ----------------------------
ALTER TABLE "public"."core_user_preferences" ADD CONSTRAINT "root_user_preferences_uuid_key" UNIQUE ("uuid");

-- ----------------------------
-- Primary Key structure for table core_user_preferences
-- ----------------------------
ALTER TABLE "public"."core_user_preferences" ADD CONSTRAINT "root_user_preferences_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table core_users
-- ----------------------------
CREATE INDEX "idx_core_users_departm_7e45f0" ON "public"."core_users" USING btree (
  "department_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_users_is_infra_admin" ON "public"."core_users" USING btree (
  "is_infra_admin" "pg_catalog"."bool_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_users_phone_cc3c13" ON "public"."core_users" USING btree (
  "phone" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_users_positio_b5fd30" ON "public"."core_users" USING btree (
  "position_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_users_tenant__26aebd" ON "public"."core_users" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST,
  "username" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_users_tenant__9fa158" ON "public"."core_users" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_core_users_usernam_04037b" ON "public"."core_users" USING btree (
  "username" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table core_users
-- ----------------------------
ALTER TABLE "public"."core_users" ADD CONSTRAINT "uk_core_users_uuid" UNIQUE ("uuid");
ALTER TABLE "public"."core_users" ADD CONSTRAINT "uk_core_users_tenant__26aebd" UNIQUE ("tenant_id", "username");

-- ----------------------------
-- Indexes structure for table infra_packages
-- ----------------------------
CREATE INDEX "idx_infra_packag_plan_493a83" ON "public"."infra_packages" USING btree (
  "plan" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_infra_packag_tenant__e2698a" ON "public"."infra_packages" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table infra_packages
-- ----------------------------
ALTER TABLE "public"."infra_packages" ADD CONSTRAINT "uk_infra_packages_uuid" UNIQUE ("uuid");

-- ----------------------------
-- Indexes structure for table infra_superadmin
-- ----------------------------
CREATE INDEX "idx_infra_platfo_tenant__281c88" ON "public"."infra_superadmin" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_infra_platfo_usernam_84921b" ON "public"."infra_superadmin" USING btree (
  "username" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table infra_superadmin
-- ----------------------------
ALTER TABLE "public"."infra_superadmin" ADD CONSTRAINT "uk_infra_infra_superadmin_uuid" UNIQUE ("uuid");
ALTER TABLE "public"."infra_superadmin" ADD CONSTRAINT "uk_infra_infra_superadmin_username" UNIQUE ("username");

-- ----------------------------
-- Uniques structure for table infra_tenant_configs
-- ----------------------------
ALTER TABLE "public"."infra_tenant_configs" ADD CONSTRAINT "uk_infra_tenant_configs_uuid" UNIQUE ("uuid");

-- ----------------------------
-- Indexes structure for table infra_tenants
-- ----------------------------
CREATE INDEX "idx_infra_tenant_domain_4aeb51" ON "public"."infra_tenants" USING btree (
  "domain" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_infra_tenant_plan_b8d0f3" ON "public"."infra_tenants" USING btree (
  "plan" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_infra_tenant_status_51be99" ON "public"."infra_tenants" USING btree (
  "status" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_infra_tenant_tenant__481a89" ON "public"."infra_tenants" USING btree (
  "tenant_id" "pg_catalog"."int4_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table infra_tenants
-- ----------------------------
ALTER TABLE "public"."infra_tenants" ADD CONSTRAINT "uk_infra_tenants_uuid" UNIQUE ("uuid");
ALTER TABLE "public"."infra_tenants" ADD CONSTRAINT "uk_infra_tenants_domain" UNIQUE ("domain");

-- ----------------------------
-- Foreign Keys structure for table apps_master_data_bom
-- ----------------------------
ALTER TABLE "public"."apps_master_data_bom" ADD CONSTRAINT "fk_apps_master_data_bom_component_id" FOREIGN KEY ("component_id") REFERENCES "public"."apps_master_data_materials" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "public"."apps_master_data_bom" ADD CONSTRAINT "fk_apps_master_data_bom_material_id" FOREIGN KEY ("material_id") REFERENCES "public"."apps_master_data_materials" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- ----------------------------
-- Foreign Keys structure for table apps_master_data_material_groups
-- ----------------------------
ALTER TABLE "public"."apps_master_data_material_groups" ADD CONSTRAINT "fk_apps_master_data_material_groups_parent_id" FOREIGN KEY ("parent_id") REFERENCES "public"."apps_master_data_material_groups" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- ----------------------------
-- Foreign Keys structure for table apps_master_data_materials
-- ----------------------------
ALTER TABLE "public"."apps_master_data_materials" ADD CONSTRAINT "fk_apps_master_data_materials_group_id" FOREIGN KEY ("group_id") REFERENCES "public"."apps_master_data_material_groups" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- ----------------------------
-- Foreign Keys structure for table apps_master_data_production_lines
-- ----------------------------
ALTER TABLE "public"."apps_master_data_production_lines" ADD CONSTRAINT "fk_apps_master_data_production_lines_workshop_id" FOREIGN KEY ("workshop_id") REFERENCES "public"."apps_master_data_workshops" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- ----------------------------
-- Foreign Keys structure for table apps_master_data_sop
-- ----------------------------
ALTER TABLE "public"."apps_master_data_sop" ADD CONSTRAINT "fk_apps_master_data_sop_operation_id" FOREIGN KEY ("operation_id") REFERENCES "public"."apps_master_data_operations" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- ----------------------------
-- Foreign Keys structure for table apps_master_data_sop_executions
-- ----------------------------
ALTER TABLE "public"."apps_master_data_sop_executions" ADD CONSTRAINT "fk_apps_master_data_sop_executions_sop_id" FOREIGN KEY ("sop_id") REFERENCES "public"."apps_master_data_sop" ("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- ----------------------------
-- Foreign Keys structure for table apps_master_data_storage_areas
-- ----------------------------
ALTER TABLE "public"."apps_master_data_storage_areas" ADD CONSTRAINT "fk_apps_master_data_storage_areas_warehouse_id" FOREIGN KEY ("warehouse_id") REFERENCES "public"."apps_master_data_warehouses" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- ----------------------------
-- Foreign Keys structure for table apps_master_data_storage_locations
-- ----------------------------
ALTER TABLE "public"."apps_master_data_storage_locations" ADD CONSTRAINT "fk_apps_master_data_storage_locations_storage_area_id" FOREIGN KEY ("storage_area_id") REFERENCES "public"."apps_master_data_storage_areas" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- ----------------------------
-- Foreign Keys structure for table apps_master_data_workstations
-- ----------------------------
ALTER TABLE "public"."apps_master_data_workstations" ADD CONSTRAINT "fk_apps_master_data_workstations_production_line_id" FOREIGN KEY ("production_line_id") REFERENCES "public"."apps_master_data_production_lines" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- ----------------------------
-- Foreign Keys structure for table core_approval_instances
-- ----------------------------
ALTER TABLE "public"."core_approval_instances" ADD CONSTRAINT "root_approval_instances_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "public"."core_approval_processes" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- ----------------------------
-- Foreign Keys structure for table core_code_sequences
-- ----------------------------
ALTER TABLE "public"."core_code_sequences" ADD CONSTRAINT "fk_core_code_s_code_ru_g9h4i5" FOREIGN KEY ("code_rule_id") REFERENCES "public"."core_code_rules" ("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- ----------------------------
-- Foreign Keys structure for table core_custom_field_values
-- ----------------------------
ALTER TABLE "public"."core_custom_field_values" ADD CONSTRAINT "fk_core_custom_v_custom__l9m4n5" FOREIGN KEY ("custom_field_id") REFERENCES "public"."core_custom_fields" ("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- ----------------------------
-- Foreign Keys structure for table core_datasets
-- ----------------------------
ALTER TABLE "public"."core_datasets" ADD CONSTRAINT "fk_core_datasets_data_source" FOREIGN KEY ("data_source_id") REFERENCES "public"."core_data_sources" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- ----------------------------
-- Foreign Keys structure for table core_dictionary_items
-- ----------------------------
ALTER TABLE "public"."core_dictionary_items" ADD CONSTRAINT "fk_core_dictio_diction_c9d4e5" FOREIGN KEY ("dictionary_id") REFERENCES "public"."core_data_dictionaries" ("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- ----------------------------
-- Foreign Keys structure for table core_menus
-- ----------------------------
ALTER TABLE "public"."core_menus" ADD CONSTRAINT "fk_core_menus_parent" FOREIGN KEY ("parent_id") REFERENCES "public"."core_menus" ("id") ON DELETE SET NULL ON UPDATE NO ACTION;
