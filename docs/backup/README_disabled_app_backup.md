# 已停用APP数据表备份说明

## 📋 操作概览

在快速上线模式中，已停用以下应用并备份了其数据表：

- **客户关系管理系统** (kuaicrm) - 10个表
- **设备资产管理系统** (kuaieam) - 9个表
- **制造执行系统** (kuaimes) - 5个表
- **物料需求规划系统** (kuaimrp) - 5个表
- **产品数据管理系统** (kuaipdm) - 5个表
- **质量管理系统** (kuaiqms) - 9个表
- **供应商关系管理系统** (kuaisrm) - 4个表
- **仓库管理系统** (kuaiwms) - 6个表

**总计**: 53个数据表已备份

## 🗃️ 备份方式

使用 `ALTER TABLE RENAME` 安全备份：
- 原表名: `apps_{app}_{table}`
- 备份表名: `apps_{app}_{table}_backup_disabled`

## 📊 备份清单

### 客户关系管理 (kuaicrm)
- apps_kuaicrm_complaints_backup_disabled
- apps_kuaicrm_installations_backup_disabled
- apps_kuaicrm_lead_followups_backup_disabled
- apps_kuaicrm_leads_backup_disabled
- apps_kuaicrm_opportunities_backup_disabled
- apps_kuaicrm_opportunity_followups_backup_disabled
- apps_kuaicrm_sales_orders_backup_disabled
- apps_kuaicrm_service_contracts_backup_disabled
- apps_kuaicrm_service_workorders_backup_disabled
- apps_kuaicrm_warranties_backup_disabled

### 设备资产管理 (kuaieam)
- apps_kuaieam_failure_handlings_backup_disabled
- apps_kuaieam_failure_reports_backup_disabled
- apps_kuaieam_maintenance_executions_backup_disabled
- apps_kuaieam_maintenance_plans_backup_disabled
- apps_kuaieam_maintenance_workorders_backup_disabled
- apps_kuaieam_mold_usages_backup_disabled
- apps_kuaieam_spare_part_demands_backup_disabled
- apps_kuaieam_spare_part_purchases_backup_disabled
- apps_kuaieam_tooling_usages_backup_disabled

### 制造执行系统 (kuaimes)
- apps_kuaimes_orders_backup_disabled
- apps_kuaimes_production_reports_backup_disabled
- apps_kuaimes_rework_orders_backup_disabled
- apps_kuaimes_traceabilities_backup_disabled
- apps_kuaimes_work_orders_backup_disabled

### 物料需求规划 (kuaimrp)
- apps_kuaimrp_lrp_batches_backup_disabled
- apps_kuaimrp_material_requirements_backup_disabled
- apps_kuaimrp_mrp_plans_backup_disabled
- apps_kuaimrp_requirement_traceabilities_backup_disabled
- apps_kuaimrp_shortage_alerts_backup_disabled

### 产品数据管理 (kuaipdm)
- apps_kuaipdm_design_changes_backup_disabled
- apps_kuaipdm_design_reviews_backup_disabled
- apps_kuaipdm_engineering_changes_backup_disabled
- apps_kuaipdm_knowledges_backup_disabled
- apps_kuaipdm_research_processes_backup_disabled

### 质量管理系统 (kuaiqms)
- apps_kuaiqms_capas_backup_disabled
- apps_kuaiqms_continuous_improvements_backup_disabled
- apps_kuaiqms_inspection_records_backup_disabled
- apps_kuaiqms_inspection_tasks_backup_disabled
- apps_kuaiqms_iso_audits_backup_disabled
- apps_kuaiqms_nonconforming_handlings_backup_disabled
- apps_kuaiqms_nonconforming_products_backup_disabled
- apps_kuaiqms_quality_indicators_backup_disabled
- apps_kuaiqms_quality_objectives_backup_disabled
- apps_kuaiqms_quality_traceabilities_backup_disabled

### 供应商关系管理 (kuaisrm)
- apps_kuaisrm_outsourcing_orders_backup_disabled
- apps_kuaisrm_purchase_contracts_backup_disabled
- apps_kuaisrm_purchase_orders_backup_disabled
- apps_kuaisrm_supplier_evaluations_backup_disabled

### 仓库管理系统 (kuaiwms)
- apps_kuaiwms_inbound_orders_backup_disabled
- apps_kuaiwms_inventories_backup_disabled
- apps_kuaiwms_inventory_adjustments_backup_disabled
- apps_kuaiwms_outbound_orders_backup_disabled
- apps_kuaiwms_stocktakes_backup_disabled

## 🔄 数据恢复

如需恢复某个应用的数据，执行以下SQL：

```sql
-- 恢复示例（以客户关系管理为例）
ALTER TABLE apps_kuaicrm_complaints_backup_disabled RENAME TO apps_kuaicrm_complaints;
ALTER TABLE apps_kuaicrm_installations_backup_disabled RENAME TO apps_kuaicrm_installations;
-- ... 其他表类似
```

## 📈 当前状态

- **活跃应用**: 仅保留 `master_data` (基础数据管理) - 19个表
- **备份应用**: 8个已停用应用 - 53个表
- **系统表**: 核心功能表保持不变

## ⚠️ 注意事项

1. **数据完整性**: 备份表包含所有原始数据和约束
2. **外键关系**: 如有跨应用外键，可能需要同时恢复相关应用
3. **索引**: 所有索引和约束随表一起备份
4. **权限**: 表权限设置保持不变

## 🛠️ 相关脚本

- `scripts/backup_disabled_app_tables.py` - 执行备份操作的脚本
- 支持 `--force` 参数跳过确认提示

---

## 📋 更新说明 (2025-12-25)

**最终清理**: 根据用户要求，已将所有备份数据完全删除
- ✅ **数据表**: 53个备份表已删除
- ✅ **应用记录**: 22个应用记录已删除
- ✅ **备份表**: core_applications_backup_disabled 已删除

**最终状态**: 只保留 master-data 应用 (19个表 + 1个应用记录)

**备份时间**: 2025-12-25
**最终操作**: 完全删除 (不可逆)
**清理数量**: 53个表 + 22个应用记录 + 1个备份表
**操作状态**: ✅ 完成并清理完毕
