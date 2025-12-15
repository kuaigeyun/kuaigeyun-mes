# 基础数据管理最佳实践总览

## 📋 概述

本文档汇总了基础数据管理应用所有菜单模块的开发最佳实践，结合 RiverEdge SaaS 框架规范和 DDD 应用层设计规范。

## 📚 最佳实践文档

### 1. 工厂数据最佳实践

**路径**：`1.工厂数据最佳实践.md`

**模块说明**：
- 车间（Workshop）
- 产线（Production Line）
- 工位（Workstation）

**特点**：
- 三级层级结构（车间 → 产线 → 工位）
- 外键关联关系
- 组织内编码唯一

**相关表**：
- `seed_master_data_workshops`
- `seed_master_data_production_lines`
- `seed_master_data_workstations`

---

### 2. 仓库数据最佳实践

**路径**：`2.仓库数据最佳实践.md`

**模块说明**：
- 仓库（Warehouse）
- 库区（Storage Area）
- 库位（Storage Location）

**特点**：
- 三级层级结构（仓库 → 库区 → 库位）
- 外键关联关系
- 组织内编码唯一

**相关表**：
- `seed_master_data_warehouses`
- `seed_master_data_storage_areas`
- `seed_master_data_storage_locations`

---

### 3. 物料数据最佳实践

**路径**：`3.物料数据最佳实践.md`

**模块说明**：
- 物料分组（Material Group）
- 物料（Material）
- BOM（Bill of Materials）

**特点**：
- 物料分组支持层级结构（parent_id）
- 物料支持多单位、批号、变体管理（JSON格式）
- BOM支持替代料管理
- 树形结构查询

**相关表**：
- `seed_master_data_material_groups`
- `seed_master_data_materials`
- `seed_master_data_bom`

---

### 4. 工艺数据最佳实践

**路径**：`4.工艺数据最佳实践.md`

**模块说明**：
- 不良品（Defect Type）
- 工序（Operation）
- 工艺路线（Process Route）
- 作业程序（SOP）

**特点**：
- 工艺路线支持工序序列（JSON格式）
- SOP支持富文本内容和附件（JSON格式）
- 分类管理

**相关表**：
- `seed_master_data_defect_types`
- `seed_master_data_operations`
- `seed_master_data_process_routes`
- `seed_master_data_sop`

---

### 5. 供应链数据最佳实践

**路径**：`5.供应链数据最佳实践.md`

**模块说明**：
- 客户（Customer）
- 供应商（Supplier）

**特点**：
- 客户和供应商结构相似
- 联系信息管理
- 分类管理

**相关表**：
- `seed_master_data_customers`
- `seed_master_data_suppliers`

---

### 6. 绩效数据最佳实践

**路径**：`6.绩效数据最佳实践.md`

**模块说明**：
- 假期（Holiday）
- 技能（Skill）

**特点**：
- 假期使用 DATE 类型存储日期
- 技能支持分类管理
- 假期不需要编码（使用日期作为唯一标识）

**相关表**：
- `seed_master_data_holidays`
- `seed_master_data_skills`

---

## 🎯 通用规范

### 数据库规范

所有表必须包含以下字段：

1. **组织隔离字段**
   - `tenant_id INTEGER NOT NULL` - 租户ID（必须）

2. **唯一标识字段**
   - `uuid VARCHAR(36) NOT NULL UNIQUE` - UUID（必须）
   - `id SERIAL PRIMARY KEY` - 自增主键（必须）

3. **编码字段**（除假期表外）
   - `code VARCHAR(50) NOT NULL` - 编码（必须，组织内唯一）
   - `UNIQUE(tenant_id, code)` - 组织内编码唯一约束（必须）

4. **标准时间字段**
   - `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP` - 创建时间（必须）
   - `updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP` - 更新时间（必须）
   - `deleted_at TIMESTAMP NULL` - 删除时间（软删除，可选）

5. **状态字段**
   - `is_active BOOLEAN DEFAULT TRUE` - 是否启用（必须）

### 命名规范

- ✅ **表名**：`snake_case`，包含模块前缀（如 `seed_master_data_workshops`）
- ✅ **字段名**：`snake_case`（如 `workshop_id`、`tenant_id`）
- ✅ **类名**：`PascalCase`（如 `Workshop`、`ProductionLine`）
- ✅ **函数名**：`snake_case`，动词开头（如 `create_workshop`、`get_workshop_by_id`）

### 开发规范

1. **所有查询必须包含 `tenant_id` 过滤**
2. **所有表必须包含标准字段**
3. **所有编码字段必须组织内唯一**
4. **编写完整的注释（中文）**
5. **编写单元测试（覆盖率 > 80%）**

## 📖 相关文档

- [主数据管理APP开发计划](../主数据管理APP开发计划.md)
- [DDD应用层设计规范](../DDD应用层设计规范.md)
- [Apps共享部分设计规范](../Apps共享部分设计规范.md)
- [AI助手开发规范](../../2.rules/AGENTS.md)

---

**最后更新**：2025-01-11

