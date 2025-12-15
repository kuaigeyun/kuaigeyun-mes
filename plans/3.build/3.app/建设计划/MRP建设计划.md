# 快格轻MRP - 应用建设计划

## 📋 应用信息

- **应用代码**：kuaimrp
- **应用名称**：快格轻MRP
- **应用描述**：物料需求 - MRP/LRP双模式需求计算、需求追溯、计划优化
- **优先级**：核心业务
- **预计工期**：5-7周

## 🎯 建设目标

### 核心功能
1. **MRP需求计算（MTS模式）**：全局物料需求计算、供需平衡、计划生成
2. **LRP需求计算（MTO模式）**：订单分解、批次合并、需求跟踪
3. **需求追溯**：需求来源追溯、全阶供需关系
4. **计划优化**：批量优化、交期优化、成本优化
5. **缺料分析**：缺料预警、缺料分析、缺料处理

### 建设原则
- 遵循"小快轻准"设计原则
- 支持MRP和LRP双模式
- 数据与业务分离（BOM、物料从master-data获取）
- 算法优化，提升计算性能

## 📅 建设计划

### 阶段一：应用注册（1天）
- [x] 创建应用目录结构
- [x] 创建 `manifest.json` 文件
- [ ] 注册应用到系统
- [ ] 验证应用注册成功

### 阶段二：数据模型设计（5-7天）

#### 2.1 核心实体设计
1. **MRP需求（MRPDemand）**
   - 需求编号、物料ID（关联master-data）
   - 需求数量、需求日期、需求来源
   - 需求状态、计划状态

2. **LRP需求（LRPDemand）**
   - 需求编号、订单ID、物料ID（关联master-data）
   - 需求数量、需求日期、批次号
   - 需求层级、需求来源

3. **需求计划（DemandPlan）**
   - 计划编号、物料ID（关联master-data）
   - 计划类型（生产/采购）、计划数量
   - 计划日期、计划状态

4. **需求追溯（DemandTraceability）**
   - 需求ID、追溯路径、追溯层级
   - 需求来源、需求去向

5. **缺料分析（ShortageAnalysis）**
   - 物料ID（关联master-data）、缺料数量
   - 缺料时间、缺料原因、缺料等级

#### 2.2 数据验证模式（Schemas）
- `MRPDemandCreateSchema`：MRP需求创建验证
- `LRPDemandCreateSchema`：LRP需求创建验证
- `DemandPlanResponseSchema`：需求计划响应格式
- 其他实体的Schema定义

#### 2.3 数据库迁移
- 创建需求表、计划表等数据表
- 创建索引优化查询性能
- 创建外键关联（关联master-data的物料表、BOM表）

### 阶段三：业务逻辑实现（8-12天）

#### 3.1 MRP计算引擎（MRPCalculator）
- `calculate_mrp()`：MRP需求计算
- `aggregate_demand()`：需求汇总
- `calculate_net_requirement()`：净需求计算
- `generate_plan()`：计划生成

#### 3.2 LRP计算引擎（LRPCalculator）
- `calculate_lrp()`：LRP需求计算
- `breakdown_order()`：订单分解
- `merge_batches()`：批次合并
- `track_demand()`：需求跟踪

#### 3.3 需求追溯服务（TraceabilityService）
- `trace_demand_source()`：追溯需求来源
- `trace_demand_impact()`：追溯需求影响
- `get_full_level_supply_demand()`：获取全阶供需关系

#### 3.4 计划优化服务（OptimizationService）
- `optimize_batch()`：批量优化
- `optimize_delivery()`：交期优化
- `optimize_cost()`：成本优化

#### 3.5 缺料分析服务（ShortageAnalysisService）
- `detect_shortage()`：缺料检测
- `analyze_shortage()`：缺料分析
- `suggest_shortage_solution()`：缺料处理建议

### 阶段四：API接口开发（3-5天）

#### 4.1 MRP计算API
- `POST /api/v1/kuaimrp/mrp/calculate`：执行MRP计算
- `GET /api/v1/kuaimrp/mrp/demand-summary`：需求汇总
- `GET /api/v1/kuaimrp/mrp/plan`：计划查询

#### 4.2 LRP计算API
- `POST /api/v1/kuaimrp/lrp/calculate`：执行LRP计算
- `GET /api/v1/kuaimrp/lrp/order-breakdown`：订单分解
- `GET /api/v1/kuaimrp/lrp/batches`：批次管理

#### 4.3 需求追溯API
- `GET /api/v1/kuaimrp/traceability/source/{id}`：需求来源追溯
- `GET /api/v1/kuaimrp/traceability/supply-demand`：全阶供需关系

#### 4.4 计划优化API
- `POST /api/v1/kuaimrp/optimization/batch`：批量优化
- `POST /api/v1/kuaimrp/optimization/delivery`：交期优化
- `POST /api/v1/kuaimrp/optimization/cost`：成本优化

#### 4.5 缺料分析API
- `GET /api/v1/kuaimrp/shortage/alert`：缺料预警
- `GET /api/v1/kuaimrp/shortage/analysis`：缺料分析

### 阶段五：前端页面开发（5-10天）

#### 5.1 MRP计算页面
- MRP需求汇总页
- MRP计算执行页
- MRP计划查看页

#### 5.2 LRP计算页面
- 订单分解页
- LRP计算执行页
- 批次管理页

#### 5.3 需求追溯页面
- 需求来源追溯页
- 全阶供需关系页

#### 5.4 计划优化页面
- 批量优化页
- 交期优化页
- 成本优化页

#### 5.5 缺料分析页面
- 缺料预警页
- 缺料分析页

### 阶段六：集成测试（3-5天）
- 单元测试（计算引擎、服务）
- 集成测试（API接口、与其他模块集成）
- 端到端测试（完整计算流程）
- 性能测试（大数据量计算性能）

### 阶段七：移动端支持（3-5天）
- 移动端需求查看
- 移动端缺料预警
- 移动端需求追溯
- 移动端计划查看

## 📊 数据模型设计

### 核心实体

#### 1. MRP需求（MRPDemand）
```python
class MRPDemand(BaseModel):
    demand_no: str                   # 需求编号
    material_id: int                 # 物料ID（关联master-data）
    demand_qty: Decimal              # 需求数量
    demand_date: datetime            # 需求日期
    demand_source: str               # 需求来源（订单/预测/安全库存）
    status: str                      # 需求状态
    # ... 其他字段
```

#### 2. LRP需求（LRPDemand）
```python
class LRPDemand(BaseModel):
    demand_no: str                   # 需求编号
    order_id: int                    # 订单ID
    material_id: int                 # 物料ID（关联master-data）
    demand_qty: Decimal              # 需求数量
    demand_date: datetime            # 需求日期
    batch_no: str                   # 批次号
    demand_level: int                # 需求层级
    # ... 其他字段
```

### 数据关系
- MRP需求 → 物料（关联master-data）
- LRP需求 → 订单、物料（关联master-data）
- 需求计划 → 物料（关联master-data）

## 🔌 API接口设计

### 核心接口

#### 1. MRP计算
- **路径**：`POST /api/v1/kuaimrp/mrp/calculate`
- **参数**：计算参数（需求源、计算日期等）
- **响应**：计算结果、生成的计划

#### 2. LRP计算
- **路径**：`POST /api/v1/kuaimrp/lrp/calculate`
- **参数**：订单ID列表、计算参数
- **响应**：计算结果、生成的计划

#### 3. 需求追溯
- **路径**：`GET /api/v1/kuaimrp/traceability/source/{id}`
- **参数**：需求ID
- **响应**：需求来源追溯路径

## 🎨 前端页面设计

### 核心页面

#### 1. MRP计算页
- **功能**：MRP计算执行、计算结果查看
- **布局**：计算参数配置、计算结果展示
- **交互**：计算执行、结果导出、计划查看

#### 2. 需求追溯页
- **功能**：需求来源追溯、全阶供需关系查看
- **布局**：树形结构展示、关系图展示
- **交互**：追溯查询、关系可视化

## 🔗 集成方案

### 主数据集成
- 从 `master-data` 获取：BOM、物料信息、工艺路线
- 集成方式：通过API查询，实时获取最新数据

### 其他模块集成
- 与 **CRM** 集成：接收销售订单
- 与 **MES** 集成：接收生产计划、工单需求
- 与 **SRM** 集成：推送采购需求、委外需求
- 与 **SCM** 集成：推送需求计划、物料需求
- 与 **WMS** 集成：查询库存数据、库存预留

## 📱 移动端设计

### 移动端功能
- 需求查看
- 缺料预警推送
- 需求追溯查询
- 计划查看

## ✅ 验收标准

### 功能验收
- [ ] MRP计算功能完整实现
- [ ] LRP计算功能完整实现
- [ ] 需求追溯功能完整实现
- [ ] 计划优化功能完整实现
- [ ] 缺料分析功能完整实现

### 性能验收
- [ ] MRP计算时间 < 30秒（1000个物料）
- [ ] LRP计算时间 < 10秒（100个订单）
- [ ] API响应时间 < 500ms
- [ ] 支持大数据量计算

### 质量验收
- [ ] 计算准确性验证通过
- [ ] 代码覆盖率 >= 80%
- [ ] 无严重Bug

## 💡 技术要点

### 1. MRP计算算法
- 使用递归算法实现BOM层级计算
- 支持并行计算，提升计算效率
- 计算结果缓存，减少重复计算

### 2. 需求追溯算法
- 使用树形结构存储需求层级关系
- 支持快速追溯查询
- 支持需求变更影响分析

### 3. 计划优化算法
- 使用启发式算法进行计划优化
- 考虑多约束条件（交期、成本、产能等）
- 支持多目标优化

## 📝 备注

- MRP适用于MTS模式，LRP适用于MTO模式
- 计算引擎需要支持大数据量计算
- 需求追溯需要支持多层级追溯
- 计划优化需要考虑实际业务约束

---

**参考文档**：
- [MRP最佳实践](../最佳实践/MRP最佳实践.md)
- [应用目录结构规范](../应用目录结构规范.md)
