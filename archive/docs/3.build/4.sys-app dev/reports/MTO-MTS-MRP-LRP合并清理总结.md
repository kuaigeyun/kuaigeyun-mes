# MTO-MTS和MRP-LRP合并清理总结

## 📋 清理概述

根据《☆ 用户使用全场景推演.md》的设计理念，已开始清理项目中过期的MTO/MTS和MRP/LRP分离实现代码。

**清理日期**：2025-01-27

## ✅ 已完成的清理

### 1. 模型文件清理
- ✅ `riveredge-backend/src/apps/kuaizhizao/models/mrp_result.py` - 已标记为废弃
- ✅ `riveredge-backend/src/apps/kuaizhizao/models/lrp_result.py` - 已标记为废弃
- ✅ `riveredge-backend/src/apps/kuaizhizao/models/__init__.py` - 已移除MRPResult和LRPResult的导入

### 2. 服务文件清理
- ✅ `riveredge-backend/src/apps/kuaizhizao/services/planning_service.py` - 已标记MRP/LRP方法为废弃
  - `run_mrp_computation()` - 已标记为废弃
  - `run_lrp_computation()` - 已标记为废弃
  - `get_mrp_result_by_id()` - 已标记为废弃
  - `list_mrp_results()` - 已标记为废弃
  - `get_lrp_result_by_id()` - 已标记为废弃
  - `list_lrp_results()` - 已标记为废弃
  - `export_mrp_results_to_excel()` - 已标记为废弃
  - `export_lrp_results_to_excel()` - 已标记为废弃
  - `_compute_material_mrp()` - 已标记为废弃
  - `_compute_material_lrp()` - 已标记为废弃

## ⏳ 待处理的清理项

### 1. Schema文件清理
- ⏳ `riveredge-backend/src/apps/kuaizhizao/schemas/planning.py`
  - 需要标记或移除MRP/LRP相关的Schema定义
  - `MRPComputationRequest`
  - `MRPComputationResult`
  - `MRPResultResponse`
  - `MRPResultListResponse`
  - `LRPComputationRequest`
  - `LRPComputationResult`
  - `LRPResultResponse`
  - `LRPResultListResponse`

### 2. API路由清理
- ⏳ `riveredge-backend/src/apps/kuaizhizao/api/production.py`
  - 需要标记或移除以下端点：
    - `/mrp-computation`
    - `/lrp-computation`
    - `/mrp/results`
    - `/mrp/results/{result_id}`
    - `/mrp/results/export`
    - `/mrp/results/{result_id}/export`
    - `/lrp/results`
    - `/lrp/results/{result_id}`
    - `/lrp/results/export`
    - `/lrp/results/{result_id}/export`
    - `/sales-forecasts/{forecast_id}/push-to-mrp`
    - `/sales-orders/{order_id}/push-to-lrp`

### 3. 其他服务清理
- ⏳ `riveredge-backend/src/apps/kuaizhizao/services/sales_service.py`
  - `push_to_mrp()` 方法
  - `push_to_lrp()` 方法

### 4. 文档关联服务清理
- ⏳ `riveredge-backend/src/apps/kuaizhizao/services/document_relation_service.py`
  - MRP/LRP相关的关联查询逻辑

### 5. 前端代码清理
- ⏳ `riveredge-frontend/src/apps/kuaizhizao/pages/plan-management/mrp-computation/index.tsx`
- ⏳ `riveredge-frontend/src/apps/kuaizhizao/pages/plan-management/lrp-computation/index.tsx`
- ⏳ `riveredge-frontend/src/apps/kuaizhizao/services/mrp.ts`
  - MRP相关的接口定义和函数
  - LRP相关的接口定义和函数

### 6. 数据库迁移
- ⏳ 需要创建迁移文件，将 `mrp_results` 和 `lrp_results` 表合并为 `demand_computation_results` 表
- ⏳ 需要将现有MRP和LRP数据迁移到新的统一表中

### 7. 路由和菜单更新
- ⏳ 需要更新前端路由配置
- ⏳ 需要更新菜单配置，移除分离的MRP和LRP菜单项

## 📝 注意事项

1. **代码备份**：所有过期的代码已备份到 `archive/code/mrp-lrp-separation/` 目录
2. **渐进式清理**：由于这些代码可能还在使用中，采用渐进式清理方式，先标记为废弃，再逐步移除
3. **统一实现**：清理完成后，需要实现统一的需求计算接口来替代分离的MRP/LRP实现

## 🔗 相关文档

- 主文档：`docs/3.build/4.sys-app dev/☆ 用户使用全场景推演.md`
- 清理计划：`archive/docs/3.build/4.sys-app dev/reports/MTO-MTS-MRP-LRP合并清理计划.md`
