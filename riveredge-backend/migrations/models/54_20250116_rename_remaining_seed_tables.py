"""
数据库表重命名迁移 - 重命名剩余的 seed_ 表

此迁移将剩余的 seed_ 前缀表重命名为 apps_ 前缀，统一为最新命名规范。

执行时间: 2025-01-16
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：重命名所有剩余的 seed_ 表到 apps_ 前缀
    """
    return """
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
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：反向重命名（回滚）
    """
    return """
        -- 反向重命名（回滚）
        
        -- 主数据管理表 (apps_master_data_ → seed_master_data_)
        ALTER TABLE IF EXISTS "apps_master_data_workstations" RENAME TO "seed_master_data_workstations";
        ALTER TABLE IF EXISTS "apps_master_data_workshops" RENAME TO "seed_master_data_workshops";
        ALTER TABLE IF EXISTS "apps_master_data_warehouses" RENAME TO "seed_master_data_warehouses";
        ALTER TABLE IF EXISTS "apps_master_data_suppliers" RENAME TO "seed_master_data_suppliers";
        ALTER TABLE IF EXISTS "apps_master_data_storage_locations" RENAME TO "seed_master_data_storage_locations";
        ALTER TABLE IF EXISTS "apps_master_data_storage_areas" RENAME TO "seed_master_data_storage_areas";
        ALTER TABLE IF EXISTS "apps_master_data_sop_executions" RENAME TO "seed_master_data_sop_executions";
        ALTER TABLE IF EXISTS "apps_master_data_sop" RENAME TO "seed_master_data_sop";
        ALTER TABLE IF EXISTS "apps_master_data_skills" RENAME TO "seed_master_data_skills";
        ALTER TABLE IF EXISTS "apps_master_data_products" RENAME TO "seed_master_data_products";
        ALTER TABLE IF EXISTS "apps_master_data_production_lines" RENAME TO "seed_master_data_production_lines";
        ALTER TABLE IF EXISTS "apps_master_data_process_routes" RENAME TO "seed_master_data_process_routes";
        ALTER TABLE IF EXISTS "apps_master_data_operations" RENAME TO "seed_master_data_operations";
        ALTER TABLE IF EXISTS "apps_master_data_materials" RENAME TO "seed_master_data_materials";
        ALTER TABLE IF EXISTS "apps_master_data_material_groups" RENAME TO "seed_master_data_material_groups";
        ALTER TABLE IF EXISTS "apps_master_data_holidays" RENAME TO "seed_master_data_holidays";
        ALTER TABLE IF EXISTS "apps_master_data_defect_types" RENAME TO "seed_master_data_defect_types";
        ALTER TABLE IF EXISTS "apps_master_data_customers" RENAME TO "seed_master_data_customers";
        ALTER TABLE IF EXISTS "apps_master_data_bom" RENAME TO "seed_master_data_bom";
        
        -- WMS 相关表 (apps_kuaiwms_ → seed_kuaiwms_)
        ALTER TABLE IF EXISTS "apps_kuaiwms_stocktakes" RENAME TO "seed_kuaiwms_stocktakes";
        ALTER TABLE IF EXISTS "apps_kuaiwms_outbound_orders" RENAME TO "seed_kuaiwms_outbound_orders";
        ALTER TABLE IF EXISTS "apps_kuaiwms_inventory_adjustments" RENAME TO "seed_kuaiwms_inventory_adjustments";
        ALTER TABLE IF EXISTS "apps_kuaiwms_inventories" RENAME TO "seed_kuaiwms_inventories";
        ALTER TABLE IF EXISTS "apps_kuaiwms_inbound_orders" RENAME TO "seed_kuaiwms_inbound_orders";
        
        -- SRM 相关表 (apps_kuaisrm_ → seed_kuaisrm_)
        ALTER TABLE IF EXISTS "apps_kuaisrm_supplier_evaluations" RENAME TO "seed_kuaisrm_supplier_evaluations";
        ALTER TABLE IF EXISTS "apps_kuaisrm_purchase_orders" RENAME TO "seed_kuaisrm_purchase_orders";
        ALTER TABLE IF EXISTS "apps_kuaisrm_purchase_contracts" RENAME TO "seed_kuaisrm_purchase_contracts";
        ALTER TABLE IF EXISTS "apps_kuaisrm_outsourcing_orders" RENAME TO "seed_kuaisrm_outsourcing_orders";
        
        -- PDM 相关表 (apps_kuaipdm_ → seed_kuaipdm_)
        ALTER TABLE IF EXISTS "apps_kuaipdm_research_processes" RENAME TO "seed_kuaipdm_research_processes";
        ALTER TABLE IF EXISTS "apps_kuaipdm_knowledges" RENAME TO "seed_kuaipdm_knowledges";
        ALTER TABLE IF EXISTS "apps_kuaipdm_engineering_changes" RENAME TO "seed_kuaipdm_engineering_changes";
        ALTER TABLE IF EXISTS "apps_kuaipdm_design_reviews" RENAME TO "seed_kuaipdm_design_reviews";
        ALTER TABLE IF EXISTS "apps_kuaipdm_design_changes" RENAME TO "seed_kuaipdm_design_changes";
        
        -- MRP 相关表 (apps_kuaimrp_ → seed_kuaimrp_)
        ALTER TABLE IF EXISTS "apps_kuaimrp_shortage_alerts" RENAME TO "seed_kuaimrp_shortage_alerts";
        ALTER TABLE IF EXISTS "apps_kuaimrp_requirement_traceabilities" RENAME TO "seed_kuaimrp_requirement_traceabilities";
        ALTER TABLE IF EXISTS "apps_kuaimrp_mrp_plans" RENAME TO "seed_kuaimrp_mrp_plans";
        ALTER TABLE IF EXISTS "apps_kuaimrp_material_requirements" RENAME TO "seed_kuaimrp_material_requirements";
        ALTER TABLE IF EXISTS "apps_kuaimrp_lrp_batches" RENAME TO "seed_kuaimrp_lrp_batches";
        
        -- CRM 相关表 (apps_kuaicrm_ → seed_kuaicrm_)
        ALTER TABLE IF EXISTS "apps_kuaicrm_warranties" RENAME TO "seed_kuaicrm_warranties";
        ALTER TABLE IF EXISTS "apps_kuaicrm_service_workorders" RENAME TO "seed_kuaicrm_service_workorders";
        ALTER TABLE IF EXISTS "apps_kuaicrm_service_contracts" RENAME TO "seed_kuaicrm_service_contracts";
        ALTER TABLE IF EXISTS "apps_kuaicrm_sales_orders" RENAME TO "seed_kuaicrm_sales_orders";
        ALTER TABLE IF EXISTS "apps_kuaicrm_opportunity_followups" RENAME TO "seed_kuaicrm_opportunity_followups";
        ALTER TABLE IF EXISTS "apps_kuaicrm_opportunities" RENAME TO "seed_kuaicrm_opportunities";
        ALTER TABLE IF EXISTS "apps_kuaicrm_leads" RENAME TO "seed_kuaicrm_leads";
        ALTER TABLE IF EXISTS "apps_kuaicrm_lead_followups" RENAME TO "seed_kuaicrm_lead_followups";
        ALTER TABLE IF EXISTS "apps_kuaicrm_installations" RENAME TO "seed_kuaicrm_installations";
        ALTER TABLE IF EXISTS "apps_kuaicrm_complaints" RENAME TO "seed_kuaicrm_complaints";
    """

