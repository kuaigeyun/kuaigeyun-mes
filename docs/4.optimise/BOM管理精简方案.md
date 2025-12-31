# BOM管理精简方案

## 📋 分析结果

### 当前BOM实现情况

#### 1. master_data APP中的BOM (`apps_master_data_bom`)
**定位：** 基础数据管理
- **表结构：** 简单的物料组成关系表
- **字段：** material_id, component_id, quantity, unit, is_alternative等
- **用途：** 定义物料的基础组成结构
- **特点：** 
  - 支持替代料管理
  - 支持版本控制
  - 支持审核流程
  - 是物料的基础属性

#### 2. kuaizhizao APP中的BillOfMaterials (`apps_kuaizhizao_bill_of_materials`)
**定位：** 业务单据
- **表结构：** 复杂的BOM业务单据表
- **字段：** 包含成品信息、成本信息、工艺信息、审核信息等
- **用途：** 用于生产计划和成本计算
- **特点：**
  - 有明细表 `BillOfMaterialsItem`
  - 有状态流转（草稿、审核等）
  - 有成本计算功能
  - 关联工艺路线

### 问题分析

**重复实现：**
- 两个APP都有BOM管理功能
- 功能有重叠（都有审核、版本控制等）

**架构不一致：**
- 根据开发计划："所有业务单据依赖基础数据管理APP的数据（物料、BOM、工艺路线等）"
- 但kuaizhizao中的BillOfMaterials更像业务单据，包含成本、工艺等业务信息

### 精简建议

#### 方案1：完全移除kuaizhizao中的BOM管理（推荐）

**理由：**
1. BOM是基础数据，应该在master_data中管理
2. kuaizhizao应该从master_data读取BOM数据用于业务单据
3. 成本计算、工艺信息等可以在业务单据中处理，不需要单独的BOM业务单据

**实施步骤：**
1. 移除 `apps/kuaizhizao/models/bill_of_materials.py`
2. 移除 `apps/kuaizhizao/models/bill_of_materials_item.py`
3. 移除 `apps/kuaizhizao/services/bom_service.py`
4. 移除 `apps/kuaizhizao/schemas/bom.py`
5. 移除 `apps/kuaizhizao/api/production.py` 中的BOM相关API
6. 修改 `warehouse_service.py` 中的BOM调用，改为调用master_data的BOM API
7. 创建数据库迁移脚本，删除 `apps_kuaizhizao_bill_of_materials` 和 `apps_kuaizhizao_bill_of_materials_item` 表

#### 方案2：保留kuaizhizao中的BOM，但重命名为"生产BOM"或"工单BOM"

**理由：**
1. 如果kuaizhizao中的BOM确实有独特的业务价值（如成本计算、工艺关联等）
2. 可以保留，但需要明确区分与master_data中BOM的差异

**实施步骤：**
1. 重命名模型为 `ProductionBOM` 或 `WorkOrderBOM`
2. 明确文档说明两种BOM的区别和用途
3. 统一服务类实现（继承AppBaseService）

### 推荐方案

**推荐方案1：完全移除kuaizhizao中的BOM管理**

**原因：**
1. 符合架构原则：基础数据在master_data，业务单据在kuaizhizao
2. 减少代码重复和维护成本
3. 统一数据源，避免数据不一致
4. 成本计算可以在工单、生产计划等业务单据中处理

---

**最后更新：** 2025-01-01  
**作者：** Auto (AI Assistant)

