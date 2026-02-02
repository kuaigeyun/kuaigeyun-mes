---
description: Sales Forecast Separation Plan
---

# 销售预测剥离计划 (Sales Forecast Separation Plan)

## 目标 (Objective)
将销售预测功能从统一需求管理系统中分离出来，创建独立的销售预测页面，使用专门的销售预测API、模型和服务。

## 当前状态分析 (Current State)

### ✅ 已完成 (Completed)
- 销售预测模型 (`SalesForecast`, `SalesForecastItem`) 已创建
- 前端服务接口 (`sales-forecast.ts`) 已定义
- 销售预测页面路由已创建

### ❌ 待实现 (To Be Implemented)
- 后端 Schemas (Pydantic models)
- 后端 Service 层
- 后端 API 端点
- 独立的前端页面实现
- 数据库迁移

## 实施步骤 (Implementation Steps)

### Phase 1: 后端基础设施 (Backend Infrastructure)

#### 1.1 创建 Schemas
创建 `riveredge-backend/src/apps/kuaizhizao/schemas/sales_forecast.py`
- SalesForecastCreate
- SalesForecastUpdate
- SalesForecastResponse
- SalesForecastItemCreate
- SalesForecastItemResponse
- SalesForecastListResponse

#### 1.2 创建 Service 层
创建 `riveredge-backend/src/apps/kuaizhizao/services/sales_forecast_service.py`
- list_sales_forecasts() - 列表查询
- get_sales_forecast() - 详情查询
- create_sales_forecast() - 创建预测
- update_sales_forecast() - 更新预测
- delete_sales_forecast() - 删除预测
- submit_sales_forecast() - 提交审核
- approve_sales_forecast() - 审核通过
- reject_sales_forecast() - 审核拒绝
- push_to_mrp() - 下推到MRP运算

#### 1.3 创建 API 端点
创建 `riveredge-backend/src/apps/kuaizhizao/api/sales_forecast.py`
- GET /apps/kuaizhizao/sales-forecasts - 列表
- POST /apps/kuaizhizao/sales-forecasts - 创建
- GET /apps/kuaizhizao/sales-forecasts/{id} - 详情
- PUT /apps/kuaizhizao/sales-forecasts/{id} - 更新
- DELETE /apps/kuaizhizao/sales-forecasts/{id} - 删除
- POST /apps/kuaizhizao/sales-forecasts/{id}/submit - 提交
- POST /apps/kuaizhizao/sales-forecasts/{id}/approve - 审核
- POST /apps/kuaizhizao/sales-forecasts/{id}/reject - 拒绝
- POST /apps/kuaizhizao/sales-forecasts/{id}/push-to-mrp - 下推MRP

#### 1.4 注册路由
在 `riveredge-backend/src/apps/kuaizhizao/api/router.py` 中注册销售预测路由

#### 1.5 数据库迁移
创建迁移文件以确保数据库表结构正确

### Phase 2: 前端实现 (Frontend Implementation)

#### 2.1 创建销售预测列表页面
创建 `riveredge-frontend/src/apps/kuaizhizao/pages/sales-management/sales-forecasts/index.tsx`
- 列表展示
- 搜索过滤
- 状态筛选
- 批量操作
- 导入导出

#### 2.2 创建销售预测详情/编辑页面
创建 `riveredge-frontend/src/apps/kuaizhizao/pages/sales-management/sales-forecasts/[id].tsx`
- 基本信息编辑
- 预测明细管理
- 状态流转（提交、审核）
- 下推到MRP

#### 2.3 创建组件
- SalesForecastForm - 预测表单
- SalesForecastItemsTable - 预测明细表格
- SalesForecastStatusBadge - 状态标签
- SalesForecastActions - 操作按钮组

### Phase 3: 测试与验证 (Testing & Validation)

#### 3.1 后端测试
- API端点测试
- Service层单元测试
- 数据库操作测试

#### 3.2 前端测试
- 页面渲染测试
- 用户交互测试
- API集成测试

#### 3.3 端到端测试
- 完整业务流程测试
- 与MRP系统集成测试

## 执行顺序 (Execution Order)
1. Phase 1.1 - 创建 Schemas
2. Phase 1.2 - 创建 Service 层
3. Phase 1.3 - 创建 API 端点
4. Phase 1.4 - 注册路由
5. Phase 1.5 - 数据库迁移
6. Phase 2.1 - 创建列表页面
7. Phase 2.2 - 创建详情页面
8. Phase 2.3 - 创建组件
9. Phase 3 - 测试与验证

## 注意事项 (Notes)
- 确保与现有需求管理系统解耦
- 保持API接口的一致性
- 遵循现有代码规范和架构模式
- 确保数据迁移的安全性
