# MTO-MTS和MRP-LRP合并清理计划

## 📋 清理概述

根据《☆ 用户使用全场景推演.md》的设计理念，系统应采用统一业务流程主线，而非强制割裂MTO/MTS和MRP/LRP。

**设计理念：**
- 🎯 **统一主线**：系统采用一条统一的业务流程主线，通过需求来源和关联关系自然区分MTS/MTO模式
- 🎯 **需求驱动**：销售预测和销售订单都作为"需求"统一管理，通过需求类型区分
- 🎯 **统一运算**：需求计算统一处理所有需求来源，通过参数配置实现不同业务场景，而非分别实现MRP和LRP

## 🗑️ 需要清理的过期代码

### 后端代码

#### 1. 模型文件（需要合并）
- `riveredge-backend/src/apps/kuaizhizao/models/mrp_result.py` - MRPResult模型
- `riveredge-backend/src/apps/kuaizhizao/models/lrp_result.py` - LRPResult模型
- **清理方式**：合并为统一的 `demand_computation_result.py` 模型

#### 2. 服务文件（需要统一）
- `riveredge-backend/src/apps/kuaizhizao/services/planning_service.py`
  - `run_mrp_computation()` 方法
  - `run_lrp_computation()` 方法
  - `list_mrp_results()` 方法
  - `list_lrp_results()` 方法
  - `get_mrp_result_by_id()` 方法
  - `get_lrp_result_by_id()` 方法
  - `export_mrp_results_to_excel()` 方法
  - `export_lrp_results_to_excel()` 方法
  - `_compute_material_mrp()` 方法
  - `_compute_material_lrp()` 方法
- **清理方式**：统一为 `run_demand_computation()` 方法，通过需求类型参数区分

#### 3. Schema文件（需要统一）
- `riveredge-backend/src/apps/kuaizhizao/schemas/planning.py`
  - `MRPComputationRequest`
  - `MRPComputationResult`
  - `MRPResultResponse`
  - `MRPResultListResponse`
  - `LRPComputationRequest`
  - `LRPComputationResult`
  - `LRPResultResponse`
  - `LRPResultListResponse`
- **清理方式**：统一为 `DemandComputationRequest` 和 `DemandComputationResult`

#### 4. API路由（需要统一）
- `riveredge-backend/src/apps/kuaizhizao/api/production.py`
  - `/mrp-computation` 端点
  - `/lrp-computation` 端点
  - `/mrp/results` 端点
  - `/mrp/results/{result_id}` 端点
  - `/mrp/results/export` 端点
  - `/mrp/results/{result_id}/export` 端点
  - `/lrp/results` 端点
  - `/lrp/results/{result_id}` 端点
  - `/lrp/results/export` 端点
  - `/lrp/results/{result_id}/export` 端点
  - `/sales-forecasts/{forecast_id}/push-to-mrp` 端点
  - `/sales-orders/{order_id}/push-to-lrp` 端点
- **清理方式**：统一为 `/demand-computation` 和相关端点

#### 5. 其他服务引用
- `riveredge-backend/src/apps/kuaizhizao/services/sales_service.py`
  - `push_to_mrp()` 方法
  - `push_to_lrp()` 方法
- `riveredge-backend/src/apps/kuaizhizao/services/document_relation_service.py`
  - MRP/LRP相关的关联查询逻辑

### 前端代码

#### 1. 页面文件（需要合并）
- `riveredge-frontend/src/apps/kuaizhizao/pages/plan-management/mrp-computation/index.tsx`
- `riveredge-frontend/src/apps/kuaizhizao/pages/plan-management/lrp-computation/index.tsx`
- **清理方式**：合并为统一的 `demand-computation/index.tsx` 页面

#### 2. 服务文件（需要统一）
- `riveredge-frontend/src/apps/kuaizhizao/services/mrp.ts`
  - MRP相关的接口定义和函数
  - LRP相关的接口定义和函数
- **清理方式**：统一为 `demand-computation.ts` 服务文件

## ⚠️ 注意事项

1. **数据库迁移**：需要创建迁移文件，将 `mrp_results` 和 `lrp_results` 表合并为 `demand_computation_results` 表
2. **数据迁移**：需要将现有MRP和LRP数据迁移到新的统一表中
3. **路由更新**：需要更新前端路由配置
4. **菜单更新**：需要更新菜单配置，移除分离的MRP和LRP菜单项

## 📝 清理步骤

1. ✅ 创建清理计划文档
2. ⏳ 备份现有代码到archive目录
3. ⏳ 创建统一的需求计算模型
4. ⏳ 创建统一的需求计算服务
5. ⏳ 创建统一的需求计算API
6. ⏳ 创建统一的前端页面和服务
7. ⏳ 创建数据库迁移文件
8. ⏳ 更新所有引用
9. ⏳ 删除过期代码
10. ⏳ 测试验证

## 📅 清理日期

**开始日期**：2025-01-27  
**预计完成日期**：待定
