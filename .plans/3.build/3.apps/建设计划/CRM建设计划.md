# 快格轻CRM - 应用建设计划

## 📋 应用信息

- **应用代码**：kuaicrm
- **应用名称**：快格轻CRM
- **应用描述**：销售管理 - 线索管理、商机管理、销售漏斗、销售订单、客户服务
- **优先级**：核心业务
- **预计工期**：6-8周（增加线索和商机管理后工期延长）

## 🎯 建设目标

### 核心功能
1. **线索管理**：线索创建、线索分配、线索跟进、线索转化
2. **商机管理**：商机创建、商机跟进、商机阶段管理、商机转化
3. **销售漏斗**：漏斗视图、阶段分析、转化分析、销售预测
4. **销售订单管理**：订单创建、订单跟踪、订单变更、订单交付
5. **客户服务管理**：服务工单、保修管理、投诉处理、安装记录、服务合同
6. **销售分析**：销售报表、客户分析、订单分析、服务分析

### 建设原则
- 遵循"小快轻准"设计原则
- 数据与业务分离（客户数据从master-data获取）
- 模块化开发
- 标准化接口

## 📅 建设计划

### 阶段一：应用注册（1天）
- [x] 创建应用目录结构
- [x] 创建 `manifest.json` 文件
- [ ] 注册应用到系统（系统启动时自动扫描注册）
- [ ] 验证应用注册成功

### 阶段二：数据模型设计（3-5天）

#### 2.1 核心实体设计
1. **线索（Lead）**
   - 线索编号、线索来源、线索状态
   - 客户名称、联系人、联系方式（关联master-data或新建）
   - 线索评分、线索分配、线索跟进记录
   - 线索转化状态、转化时间

2. **商机（Opportunity）**
   - 商机编号、商机名称、客户ID（关联master-data）
   - 商机阶段、商机金额、预计成交日期
   - 商机来源（线索转化或直接创建）、商机负责人
   - 商机跟进记录、商机活动记录
   - 商机状态、成交概率

3. **销售漏斗（SalesFunnel）**
   - 漏斗阶段定义、阶段顺序、阶段转化率
   - 阶段金额、阶段数量、阶段停留时间
   - 漏斗配置、漏斗分析

4. **销售订单（SalesOrder）**
   - 订单编号、订单日期、客户ID（关联master-data）
   - 订单状态、订单金额、交期要求
   - 订单明细（订单行项目）
   - 关联商机ID（从商机转化）

5. **服务工单（ServiceWorkOrder）**
   - 工单编号、工单类型、客户ID（关联master-data）
   - 工单状态、工单优先级、服务内容
   - 工单执行记录

3. **保修管理（Warranty）**
   - 保修编号、产品信息、客户ID（关联master-data）
   - 保修类型、保修期限、保修状态

4. **投诉处理（Complaint）**
   - 投诉编号、客户ID（关联master-data）
   - 投诉类型、投诉内容、处理状态

5. **安装记录（Installation）**
   - 安装编号、客户ID（关联master-data）
   - 安装日期、安装地址、安装状态

6. **服务合同（ServiceContract）**
   - 合同编号、客户ID（关联master-data）
   - 合同类型、合同期限、合同状态

#### 2.2 数据验证模式（Schemas）
- `LeadCreateSchema`：线索创建验证
- `LeadUpdateSchema`：线索更新验证
- `LeadResponseSchema`：线索响应格式
- `OpportunityCreateSchema`：商机创建验证
- `OpportunityUpdateSchema`：商机更新验证
- `OpportunityResponseSchema`：商机响应格式
- `SalesFunnelStageSchema`：销售漏斗阶段定义
- `SalesOrderCreateSchema`：订单创建验证
- `SalesOrderUpdateSchema`：订单更新验证
- `SalesOrderResponseSchema`：订单响应格式
- `ServiceWorkOrderCreateSchema`：服务工单创建验证
- 其他实体的Schema定义

#### 2.3 数据库迁移
- 创建订单表、工单表等数据表
- 创建索引优化查询性能
- 创建外键关联（关联master-data的客户表）

### 阶段三：业务逻辑实现（5-10天）

#### 3.1 线索服务（LeadService）
- `create_lead()`：创建线索
- `update_lead()`：更新线索
- `assign_lead()`：分配线索
- `followup_lead()`：跟进线索
- `score_lead()`：线索评分
- `convert_lead()`：线索转化（转化为商机或客户）

#### 3.2 商机服务（OpportunityService）
- `create_opportunity()`：创建商机
- `update_opportunity()`：更新商机
- `followup_opportunity()`：跟进商机
- `change_stage()`：变更商机阶段
- `convert_opportunity()`：商机转化（转化为订单）
- `calculate_probability()`：计算成交概率

#### 3.3 销售漏斗服务（SalesFunnelService）
- `get_funnel_view()`：获取漏斗视图
- `analyze_stage()`：分析阶段数据
- `calculate_conversion_rate()`：计算转化率
- `forecast_sales()`：销售预测
- `analyze_bottleneck()`：分析瓶颈阶段

#### 3.4 订单服务（OrderService）
- `create_order()`：创建订单
- `update_order()`：更新订单
- `track_order()`：订单跟踪
- `change_order()`：订单变更
- `deliver_order()`：订单交付

#### 3.2 服务工单服务（ServiceWorkOrderService）
- `create_workorder()`：创建服务工单
- `assign_workorder()`：分配工单
- `execute_workorder()`：执行工单
- `close_workorder()`：关闭工单

#### 3.3 保修服务（WarrantyService）
- `create_warranty()`：创建保修申请
- `process_warranty()`：处理保修
- `track_warranty()`：保修跟踪

#### 3.4 投诉服务（ComplaintService）
- `create_complaint()`：创建投诉
- `process_complaint()`：处理投诉
- `track_complaint()`：投诉跟踪

### 阶段四：API接口开发（3-5天）

#### 4.1 线索API
- `GET /api/v1/kuaicrm/leads`：线索列表
- `POST /api/v1/kuaicrm/leads`：创建线索
- `GET /api/v1/kuaicrm/leads/{id}`：线索详情
- `PUT /api/v1/kuaicrm/leads/{id}`：更新线索
- `POST /api/v1/kuaicrm/leads/{id}/assign`：分配线索
- `POST /api/v1/kuaicrm/leads/{id}/convert`：转化线索
- `POST /api/v1/kuaicrm/leads/{id}/followup`：跟进线索

#### 4.2 商机API
- `GET /api/v1/kuaicrm/opportunities`：商机列表
- `POST /api/v1/kuaicrm/opportunities`：创建商机
- `GET /api/v1/kuaicrm/opportunities/{id}`：商机详情
- `PUT /api/v1/kuaicrm/opportunities/{id}`：更新商机
- `POST /api/v1/kuaicrm/opportunities/{id}/followup`：跟进商机
- `POST /api/v1/kuaicrm/opportunities/{id}/change-stage`：变更阶段
- `POST /api/v1/kuaicrm/opportunities/{id}/convert`：转化商机

#### 4.3 销售漏斗API
- `GET /api/v1/kuaicrm/funnel/view`：获取漏斗视图
- `GET /api/v1/kuaicrm/funnel/stages`：阶段分析
- `GET /api/v1/kuaicrm/funnel/conversion`：转化分析
- `GET /api/v1/kuaicrm/funnel/forecast`：销售预测
- `GET /api/v1/kuaicrm/funnel/bottleneck`：瓶颈分析

#### 4.4 订单API
- `GET /api/v1/kuaicrm/orders`：订单列表
- `POST /api/v1/kuaicrm/orders`：创建订单
- `GET /api/v1/kuaicrm/orders/{id}`：订单详情
- `PUT /api/v1/kuaicrm/orders/{id}`：更新订单
- `POST /api/v1/kuaicrm/orders/{id}/change`：订单变更
- `POST /api/v1/kuaicrm/orders/{id}/deliver`：订单交付

#### 4.2 服务工单API
- `GET /api/v1/kuaicrm/service/workorders`：工单列表
- `POST /api/v1/kuaicrm/service/workorders`：创建工单
- `PUT /api/v1/kuaicrm/service/workorders/{id}/assign`：分配工单
- `POST /api/v1/kuaicrm/service/workorders/{id}/execute`：执行工单
- `POST /api/v1/kuaicrm/service/workorders/{id}/close`：关闭工单

#### 4.3 其他API
- 保修管理API
- 投诉处理API
- 安装记录API
- 服务合同API
- 销售分析API

### 阶段五：前端页面开发（5-10天）

#### 5.1 线索管理页面
- 线索列表页（`/apps/kuaicrm/leads/list`）
- 线索创建页（`/apps/kuaicrm/leads/create`）
- 线索详情页（`/apps/kuaicrm/leads/detail/{id}`）
- 线索分配页（`/apps/kuaicrm/leads/assign`）
- 线索转化页（`/apps/kuaicrm/leads/convert`）

#### 5.2 商机管理页面
- 商机列表页（`/apps/kuaicrm/opportunities/list`）
- 商机创建页（`/apps/kuaicrm/opportunities/create`）
- 商机详情页（`/apps/kuaicrm/opportunities/detail/{id}`）
- 商机跟进页（`/apps/kuaicrm/opportunities/followup`）
- 商机转化页（`/apps/kuaicrm/opportunities/convert`）

#### 5.3 销售漏斗页面
- 漏斗视图页（`/apps/kuaicrm/funnel/view`）
- 阶段分析页（`/apps/kuaicrm/funnel/stages`）
- 转化分析页（`/apps/kuaicrm/funnel/conversion`）
- 销售预测页（`/apps/kuaicrm/funnel/forecast`）

#### 5.4 订单管理页面
- 订单列表页（`/apps/kuaicrm/orders/list`）
- 订单创建页（`/apps/kuaicrm/orders/create`）
- 订单详情页（`/apps/kuaicrm/orders/detail/{id}`）
- 订单跟踪页（`/apps/kuaicrm/orders/tracking`）

#### 5.2 客户服务页面
- 服务工单列表页
- 服务工单创建页
- 保修管理页
- 投诉处理页
- 安装记录页
- 服务合同页

#### 5.3 销售分析页面
- 销售报表页
- 客户分析页
- 订单分析页

### 阶段六：集成测试（3-5天）
- 单元测试（Services、Models）
- 集成测试（API接口）
- 端到端测试（完整业务流程）
- 性能测试（并发、响应时间）

### 阶段七：移动端支持（5-7天）
- 移动端客户拜访页面
- 移动端服务工单页面
- 移动端现场服务页面
- 移动端签收确认页面

## 📊 数据模型设计

### 核心实体

#### 1. 线索（Lead）
```python
class Lead(BaseModel):
    lead_no: str                      # 线索编号
    lead_source: str                  # 线索来源（展会、网站、转介绍等）
    status: str                       # 线索状态（新线索、跟进中、已转化、已关闭）
    customer_name: str                # 客户名称（可能还未在master-data中）
    contact_name: str                 # 联系人
    contact_phone: str                # 联系电话
    contact_email: str                # 联系邮箱
    score: int                        # 线索评分
    assigned_to: int                  # 分配给（用户ID）
    followup_records: List            # 跟进记录
    convert_status: str               # 转化状态
    convert_time: datetime            # 转化时间
    # ... 其他字段
```

#### 2. 商机（Opportunity）
```python
class Opportunity(BaseModel):
    oppo_no: str                      # 商机编号
    oppo_name: str                    # 商机名称
    customer_id: int                  # 客户ID（关联master-data）
    stage: str                        # 商机阶段（初步接触、需求确认、方案报价、商务谈判、成交）
    amount: Decimal                   # 商机金额
    expected_close_date: datetime     # 预计成交日期
    source: str                       # 商机来源（线索转化、直接创建）
    owner_id: int                     # 负责人（用户ID）
    probability: Decimal              # 成交概率
    followup_records: List            # 跟进记录
    activities: List                  # 活动记录
    status: str                       # 商机状态（进行中、已成交、已关闭）
    # ... 其他字段
```

#### 3. 销售订单（SalesOrder）
```python
class SalesOrder(BaseModel):
    order_no: str                    # 订单编号
    order_date: datetime             # 订单日期
    customer_id: int                  # 客户ID（关联master-data）
    opportunity_id: int               # 关联商机ID（可选）
    status: str                       # 订单状态
    total_amount: Decimal            # 订单金额
    delivery_date: datetime          # 交期要求
    priority: str                     # 优先级
    # ... 其他字段
```

#### 4. 服务工单（ServiceWorkOrder）
```python
class ServiceWorkOrder(BaseModel):
    workorder_no: str                 # 工单编号
    workorder_type: str               # 工单类型
    customer_id: int                  # 客户ID（关联master-data）
    status: str                       # 工单状态
    priority: str                     # 优先级
    service_content: str              # 服务内容
    # ... 其他字段
```

### 数据关系
- 线索 → 可能转化为客户（关联master-data）或商机
- 商机 → 客户（关联master-data）
- 商机 → 销售订单（一对多，一个商机可能产生多个订单）
- 销售订单 → 客户（关联master-data）
- 销售订单 → 商机（可选关联）
- 服务工单 → 客户（关联master-data）
- 销售订单 → 订单明细（一对多）

## 🔌 API接口设计

### 核心接口

#### 1. 线索列表
- **路径**：`GET /api/v1/kuaicrm/leads`
- **参数**：page, page_size, status, assigned_to, source, date_range
- **响应**：线索列表、分页信息

#### 2. 商机列表
- **路径**：`GET /api/v1/kuaicrm/opportunities`
- **参数**：page, page_size, stage, owner_id, customer_id, date_range
- **响应**：商机列表、分页信息

#### 3. 销售漏斗视图
- **路径**：`GET /api/v1/kuaicrm/funnel/view`
- **参数**：date_range, owner_id, customer_id
- **响应**：漏斗视图数据（各阶段数量、金额、转化率）

#### 4. 订单列表
- **路径**：`GET /api/v1/kuaicrm/orders`
- **参数**：page, page_size, status, customer_id, date_range
- **响应**：订单列表、分页信息

#### 5. 创建订单
- **路径**：`POST /api/v1/kuaicrm/orders`
- **参数**：订单数据（SalesOrderCreateSchema）
- **响应**：创建的订单信息

#### 6. 订单跟踪
- **路径**：`GET /api/v1/kuaicrm/orders/{id}/tracking`
- **参数**：订单ID
- **响应**：订单跟踪信息（状态历史、进度信息）

## 🎨 前端页面设计

### 核心页面

#### 1. 线索列表页
- **功能**：线索查询、线索筛选、线索分配、线索转化
- **布局**：表格展示、筛选条件、操作按钮、线索评分展示
- **交互**：点击查看详情、创建线索、分配线索、转化线索

#### 2. 商机列表页
- **功能**：商机查询、商机筛选、商机跟进、商机转化
- **布局**：表格展示、筛选条件、操作按钮、阶段标识
- **交互**：点击查看详情、创建商机、跟进商机、变更阶段、转化订单

#### 3. 销售漏斗页
- **功能**：漏斗可视化、阶段分析、转化分析、销售预测
- **布局**：漏斗图表、阶段卡片、数据统计、趋势图表
- **交互**：阶段筛选、时间范围选择、钻取查看详情

#### 4. 订单列表页
- **功能**：订单查询、订单筛选、订单操作
- **布局**：表格展示、筛选条件、操作按钮
- **交互**：点击查看详情、创建订单、订单操作

#### 5. 订单创建页
- **功能**：订单信息录入、订单明细录入
- **布局**：表单布局、明细表格
- **交互**：表单验证、明细添加/删除、保存/取消

## 🔗 集成方案

### 主数据集成
- 从 `master-data` 获取：客户基础信息、客户联系人、客户地址、产品信息
- 集成方式：通过API查询，不维护客户档案

### 其他模块集成
- 与 **MES** 集成：查询生产进度、产品质量追溯
- 与 **QMS** 集成：质量问题反馈、质量追溯
- 与 **WMS** 集成：备件库存查询、发货管理
- 与 **EAM** 集成：预防性维护计划、设备服务记录
- 与 **财务** 集成：销售发票生成、收款管理、服务成本核算

## 📱 移动端设计

### 移动端功能
- 线索创建和跟进
- 商机创建和跟进
- 客户拜访记录
- 服务工单创建和执行
- 现场服务（拍照、签名、定位）
- 签收确认
- 销售漏斗查看

### 移动端页面
- 线索管理页
- 商机管理页
- 客户拜访页
- 服务工单页
- 现场服务页
- 签收确认页
- 销售漏斗页

## ✅ 验收标准

### 功能验收
- [ ] 线索管理功能完整实现
- [ ] 商机管理功能完整实现
- [ ] 销售漏斗功能完整实现
- [ ] 订单管理功能完整实现
- [ ] 服务工单功能完整实现
- [ ] 功能符合需求文档
- [ ] 功能测试通过

### 性能验收
- [ ] API响应时间 < 500ms
- [ ] 页面加载时间 < 2s
- [ ] 支持并发用户数 >= 100

### 质量验收
- [ ] 代码覆盖率 >= 80%
- [ ] 无严重Bug
- [ ] 代码审查通过

## 📝 备注

- 客户数据从master-data获取，不维护客户档案
- 线索可以转化为商机或直接转化为客户
- 商机可以转化为订单，一个商机可能产生多个订单
- 销售漏斗阶段可配置，支持自定义阶段和转化率
- 线索评分算法：基于线索来源、客户规模、需求明确度等因素
- 商机成交概率：基于商机阶段、跟进次数、客户互动等因素自动计算
- 订单状态机设计，支持状态流转
- 服务工单支持自动分配和手动分配
- 移动端支持离线操作，网络恢复后自动同步

---

**参考文档**：
- [CRM最佳实践](../最佳实践/CRM最佳实践.md)
- [应用目录结构规范](../应用目录结构规范.md)
