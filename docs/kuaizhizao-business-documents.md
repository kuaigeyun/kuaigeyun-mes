# 快格轻制造 - 业务单据清单

本文档整理快格轻制造（kuaizhizao）应用中所有业务单据，按业务模块分类。

**统计：** 约 35+ 种业务单据，覆盖销售、计划、采购、生产、仓储、质量、财务等模块。

**菜单归属原则**：与库存相关的单据（入库、出库、调拨、盘点、借用归还等）菜单归属**仓储管理**；业务单据（订单、预测、工单等）按业务模块归属。

---

## 职责分离说明（发货/收货通知与实物出入库）

| 单据 | 职责 | 菜单归属 |
|------|------|----------|
| **发货通知单** | 销售通知仓库发货，不直接动库存 | 销售管理 |
| **送货单** | 实际发货时打印，随货物发出，供客户签收 | 仓储管理 |
| **收货通知单** | 采购通知仓库收货，不直接动库存 | 采购管理 |
| **销售出库** | 仓库执行实物出库，动库存 | 仓储管理 |
| **采购入库** | 仓库执行实物入库，动库存 | 仓储管理 |

**流程**：销售订单 → 发货通知单（销售）→ 销售出库（仓储）→ 送货单打印随货（仓储）；采购订单 → 收货通知单（采购）→ 采购入库（仓储）。

---

## 一、销售管理（非库存单据）

| 单据类型 (document_type) | 中文名称 | 数据模型 | 打印 | 单据关联 | 菜单归属 |
|-------------------------|----------|----------|------|----------|----------|
| `quotation` | 报价单 | Quotation | ✓ | ✓ | 销售管理 |
| `sample_trial` | 打样试产单 | SampleTrial | ✓ | - | 销售管理 |
| `sales_order` | 销售订单 | SalesOrder | ✓ | ✓ | 销售管理 |
| `sales_forecast` | 销售预测 | SalesForecast | ✓ | ✓ | 销售管理 |
| `shipment_notice` | 发货通知单 | ShipmentNotice（待实现） | - | - | 销售管理 |


*销售出库单、销售退货单为库存单据，菜单归属仓储管理，见第五章。*

---

## 二、计划管理（非库存单据）

| 单据类型 (document_type) | 中文名称 | 数据模型 | 打印 | 单据关联 | 菜单归属 | 下推/撤回 |
|-------------------------|----------|----------|------|----------|----------|-----------|
| `demand` | 需求 | Demand | - | ✓ | 计划管理 | withdraw_submit, withdraw_push |
| `demand_computation` | 需求计算 | DemandComputation | - | ✓ | 计划管理 | 下推源：→ work_order, purchase_order, production_plan, purchase_requisition |
| `production_plan` | 生产计划 | ProductionPlan | - | ✓ | 计划管理 | 下推源：→ work_order |

---

## 三、采购管理（非库存单据）

| 单据类型 (document_type) | 中文名称 | 数据模型 | 打印 | 单据关联 | 菜单归属 |
|-------------------------|----------|----------|------|----------|----------|
| `purchase_requisition` | 采购申请 | PurchaseRequisition | - | ✓ | 采购管理 |
| `purchase_order` | 采购订单 | PurchaseOrder | ✓ | ✓ | 采购管理 |
| （收货通知单） | 收货通知单 | ReceiptNotice（待实现） | - | - | 采购管理 |

*采购入库单、采购退货单为库存单据，菜单归属仓储管理，见第五章。*

---

## 四、生产执行（非库存单据）

| 单据类型 (document_type) | 中文名称 | 数据模型 | 打印 | 单据关联 | 菜单归属 | 下推/撤回 |
|-------------------------|----------|----------|------|----------|----------|-----------|
| `work_order` | 生产工单 | WorkOrder | ✓ | ✓ | 生产执行 | revoke_state；上拉目标（→ demand_computation） |
| `reporting_record` | 报工记录 | ReportingRecord | - | ✓ | 生产执行 | - |
| `rework_order` | 返工工单 | ReworkOrder | - | - | 生产执行 | - |

*生产领料单、生产退料单、成品入库单为库存单据，菜单归属仓储管理，见第五章。*

---

## 五、仓储管理（库存相关单据，菜单归属均为仓储管理）

以下单据均与库存相关，菜单统一归属**仓储管理**。

### 5.1 入库管理（和业务流程有关的）

| 中文名称 | 单据类型 (document_type) | 数据模型 | 业务来源 |
|----------|--------------------------|----------|----------|
| 采购收货 | `purchase_receipt` | PurchaseReceipt | 采购订单 |
| 生产入库 | `finished_goods_receipt` | FinishedGoodsReceipt | 生产工单 |
| 销售退货 | `sales_return` | SalesReturn | 销售出库 |
| 生产退料 | `production_return` | ProductionReturn | 生产工单 |
| 委外收货 | `outsource_material_receipt` | OutsourceMaterialReceipt | 委外工单 |
| 委外退料 | （待实现） | - | 委外管理 |
| 线边库存退库 | （待实现） | LineSideInventory 相关 | 线边仓 |
| 报废入库 | `other_inbound`（reason_type=报废）或 ScrapRecord | OtherInbound / ScrapRecord | 生产/仓储 |

### 5.2 入库管理（和业务流程无关的）

| 中文名称 | 单据类型 (document_type) | 数据模型 |
|----------|--------------------------|----------|
| 其他入库单 | `other_inbound` | OtherInbound |

### 5.3 出库管理（和业务流程有关的）

| 中文名称 | 单据类型 (document_type) | 数据模型 | 业务来源 |
|----------|--------------------------|----------|----------|
| 销售发货 | `sales_delivery` | SalesDelivery | 销售订单/发货通知单 |
| 生产领料 | `production_picking` | ProductionPicking | 生产工单 |
| 采购退货 | `purchase_return` | PurchaseReturn | 采购订单 |
| 委外退货 | （待实现） | - | 委外管理 |
| 委外领料 | `outsource_material_issue` | OutsourceMaterialIssue | 委外工单 |

### 5.4 出库管理（和业务流程无关的）

| 中文名称 | 单据类型 (document_type) | 数据模型 |
|----------|--------------------------|----------|
| 其他出库单 | `other_outbound` | OtherOutbound |

### 5.5 功能类单据

| 中文名称 | 单据类型 (document_type) | 数据模型 | 打印 | 单据关联 |
|----------|--------------------------|----------|------|----------|
| 借用单 | `material_borrow` | MaterialBorrow | ✓ | ✓ |
| 归还单 | `material_return` | MaterialReturn | ✓ | ✓ |
| 组装单 | （待实现） | - | - | - |
| 拆卸单 | （待实现） | - | - | - |
| 盘点单 | `stocktaking` | Stocktaking | - | - |
| 调拨单 | `inventory_transfer` | InventoryTransfer | - | - |

### 5.6 送货单

| 中文名称 | 单据类型 | 数据模型 | 说明 |
|----------|----------|----------|------|
| 送货单 | `delivery_notice` | DeliveryNotice | 实际发货时打印，随货物发出，供客户签收 |

---

## 六、质量管理

| 单据类型 (document_type) | 中文名称 | 数据模型 | 打印 | 单据关联 | 下推/撤回 |
|-------------------------|----------|----------|------|----------|-----------|
| `incoming_inspection` | 来料检验单 | IncomingInspection | - | ✓ | - |
| `process_inspection` | 过程检验单 | ProcessInspection | - | ✓ | - |
| `finished_goods_inspection` | 成品检验单 | FinishedGoodsInspection | - | ✓ | - |

---

## 七、财务协同

| 单据类型 (document_type) | 中文名称 | 数据模型 | 打印 | 单据关联 | 下推/撤回 |
|-------------------------|----------|----------|------|----------|-----------|
| `payable` | 应付单 | Payable | - | ✓ | - |
| `receivable` | 应收单 | Receivable | - | ✓ | - |
| `purchase_invoice` | 采购发票 | PurchaseInvoice | - | - | - |
| `invoice` | 发票 | Invoice | - | - | - |

---

## 八、辅助/内部单据（无独立 UI 或仅内部使用）

| 单据类型 (document_type) | 中文名称 | 说明 |
|-------------------------|----------|------|
| `mrp_result` | MRP 运算结果 | 已合并入需求计算，模型可能仍存在 |
| `lrp_result` | LRP 运算结果 | 已合并入需求计算，模型可能仍存在 |

---

## 九、单据能力矩阵

### 9.1 支持打印的单据（print_service.DOCUMENT_TEMPLATE_CODES）

- work_order, production_picking, production_return, finished_goods_receipt
- sales_delivery, purchase_order, purchase_receipt, sales_forecast, sales_order
- other_inbound, other_outbound, quotation, material_borrow, material_return
- delivery_notice, sample_trial

### 9.2 支持单据关联追溯的单据（document_relation_service.DOCUMENT_TYPES）

- demand, demand_computation, sales_forecast, sales_order, quotation
- material_borrow, material_return
- work_order, production_picking, production_return, reporting_record
- finished_goods_receipt, sales_delivery, delivery_notice
- purchase_order, purchase_receipt, payable, receivable
- incoming_inspection, process_inspection, finished_goods_inspection

### 9.3 支持单据撤回的单据（document_state_engine）

- **demand**: withdraw_submit, withdraw_push
- **sales_order**: withdraw_submit, withdraw_push
- **work_order**: revoke_state

### 9.4 支持下推/上拉的单据（document_push_pull_service）

**下推：**
- demand → demand_computation
- demand_computation → work_order
- demand_computation → purchase_order
- demand_computation → production_plan
- demand_computation → purchase_requisition
- production_plan → work_order

**上拉：**
- work_order → demand_computation
- purchase_order → demand_computation

### 9.5 支持状态流转/审核的单据（constants.DOCUMENT_ENTITY_TYPES）

- demand, sales_order, sales_forecast, work_order
- purchase_order, purchase_requisition, demand_computation, production_plan

---

## 十、数据来源

- 模型定义：[riveredge-backend/src/apps/kuaizhizao/models/__init__.py](riveredge-backend/src/apps/kuaizhizao/models/__init__.py)
- 单据关联：[riveredge-backend/src/apps/kuaizhizao/services/document_relation_service.py](riveredge-backend/src/apps/kuaizhizao/services/document_relation_service.py)
- 打印服务：[riveredge-backend/src/apps/kuaizhizao/services/print_service.py](riveredge-backend/src/apps/kuaizhizao/services/print_service.py)
- 单据撤回：[riveredge-backend/src/apps/kuaizhizao/services/document_state_engine.py](riveredge-backend/src/apps/kuaizhizao/services/document_state_engine.py)
- 下推上拉：[riveredge-backend/src/apps/kuaizhizao/services/document_push_pull_service.py](riveredge-backend/src/apps/kuaizhizao/services/document_push_pull_service.py)
- 打印模板：[riveredge-frontend/src/config/printTemplateSchemas.ts](riveredge-frontend/src/config/printTemplateSchemas.ts)

## 十一、实施计划参考

发货通知单、收货通知单、送货单职责分离及菜单调整，详见计划文档：`发货收货通知单职责分离`。

---

## 十二、菜单结构（目标规划）

以下为快格轻制造菜单的规划结构，供 manifest 与路由实施时参考。标注说明：**业务**=业务单据、**功能**=功能配置、**查询**=查询/分析类。

### 12.1 销售管理（一级菜单）

| 菜单项 | 路径 | 类型 |
|--------|------|------|
| 报价单 | sales-management/quotations | 业务 |
| 样品试用单 | sales-management/sample-trials | 业务 |
| 销售预测 | sales-management/sales-forecasts | 业务 |
| 销售订单 | sales-management/sales-orders | 业务 |
| 发货通知单 | sales-management/shipment-notices | 业务 |

**销售报表（分组）**

| 菜单项 | 路径 | 类型 |
|--------|------|------|
| 销售订单综合查询 | sales-management/reports/sales-order-query | 报表 |
| 销售订单执行跟踪 | sales-management/reports/order-execution-tracking | 报表 |
| 客户销售业绩汇总 | sales-management/reports/customer-sales-summary | 报表 |
| 客户销售明细对账 | sales-management/reports/customer-sales-reconciliation | 报表 |
| 产品销售排行榜 | sales-management/reports/product-sales-ranking | 报表 |
| 销售预测与实际对比 | sales-management/reports/forecast-vs-actual | 报表 |
| 报价单综合查询 | sales-management/reports/quotation-query | 报表 |
| 样品试用单综合查询 | sales-management/reports/sample-trial-query | 报表（可选） |

### 12.2 计划管理（一级菜单）

| 菜单项 | 路径 | 类型 |
|--------|------|------|
| 需求管理 | plan-management/demand-management | 业务 |
| 需求计算 | plan-management/demand-computation | 业务 |
| 生产计划 | plan-management/production-plans | 业务 |
| 计划排程 | plan-management/scheduling | 功能 |

**计划报表（分组）**

| 菜单项 | 路径 | 类型 |
|--------|------|------|
| 需求计划明细表 | plan-management/reports/demand-plan-detail | 报表 |
| 生产计划下达与完成对比 | plan-management/reports/production-plan-comparison | 报表 |
| 采购计划下达与完成对比 | plan-management/reports/purchase-plan-comparison | 报表 |
| 产能负荷分析 | plan-management/reports/capacity-load-analysis | 报表 |
| 物料缺口/短缺预警 | plan-management/reports/material-shortage-alert | 报表 |

### 12.3 采购管理（一级菜单）

| 菜单项 | 路径 | 类型 |
|--------|------|------|
| 采购申请 | purchase-management/purchase-requisitions | 业务 |
| 采购订单 | purchase-management/purchase-orders | 业务 |
| 收货通知单 | purchase-management/receipt-notices | 业务 |

**采购报表（分组）**

| 菜单项 | 路径 | 类型 |
|--------|------|------|
| 采购申请状态跟踪 | purchase-management/reports/purchase-requisition-tracking | 报表 |
| 采购订单综合查询 | purchase-management/reports/purchase-order-query | 报表 |
| 采购订单执行进度 | purchase-management/reports/purchase-order-progress | 报表 |
| 供应商交货明细与统计 | purchase-management/reports/supplier-delivery-summary | 报表 |
| 供应商价格对比分析 | purchase-management/reports/supplier-price-comparison | 报表 |
| 采购对账 | purchase-management/reports/purchase-reconciliation | 报表 |
| 供应商到货质量合格率 | purchase-management/reports/supplier-quality-rate | 报表（可选） |

### 12.4 生产执行（一级菜单）

| 菜单项 | 路径 | 类型 |
|--------|------|------|
| 生产工单 | production-execution/work-orders | 业务 |
| 报工管理 | production-execution/reporting | 业务 |
| 生产终端 | production-execution/terminal | 业务 |
| 返工工单 | production-execution/rework-orders | 业务 |
| 委外管理 | production-execution/outsource-management | 业务 |
| 报工统计 | production-execution/reporting/statistics | 查询 |

**异常管理（分组）**

| 菜单项 | 路径 | 类型 |
|--------|------|------|
| 缺料异常 | production-execution/material-shortage-exceptions | 查询 |
| 交期异常 | production-execution/delivery-delay-exceptions | 查询 |
| 质量异常 | production-execution/quality-exceptions | 查询 |
| 异常处理 | production-execution/exception-process | 功能 |
| 异常统计 | production-execution/exception-statistics | 查询 |

**生产报表（分组）**

| 菜单项 | 路径 | 类型 |
|--------|------|------|
| 工单综合查询 | production-execution/reports/work-order-query | 报表 |
| 工单状态跟踪 | production-execution/reports/work-order-tracking | 报表 |
| 工单物料耗用明细 | production-execution/reports/work-order-material-usage | 报表 |
| 工单工时/报工明细 | production-execution/reports/work-order-labor-detail | 报表 |
| 生产效率分析 | production-execution/reports/production-efficiency | 报表 |
| 工序生产进度明细 | production-execution/reports/process-progress-detail | 报表 |
| 返工工单综合查询 | production-execution/reports/rework-order-analysis | 报表 |
| 委外工单综合查询 | production-execution/reports/outsource-order-query | 报表 |
| 委外工单发料与收货对账 | production-execution/reports/outsource-material-reconciliation | 报表 |
| 车间在制品盘点 | production-execution/reports/wip-inventory | 报表 |

### 12.5 质量管理（一级菜单）

| 菜单项 | 路径 | 类型 |
|--------|------|------|
| 来料检验 | quality-management/incoming-inspection | 业务 |
| 过程检验 | quality-management/process-inspection | 业务 |
| 成品检验 | quality-management/finished-goods-inspection | 业务 |
| 追溯管理 | quality-management/traceability | 查询 |

**质量报表（分组）**

| 菜单项 | 路径 | 类型 |
|--------|------|------|
| 来料检验报告查询与统计 | quality-management/reports/incoming-inspection-report | 报表 |
| 过程检验报告查询与统计 | quality-management/reports/process-inspection-report | 报表 |
| 成品检验报告查询与统计 | quality-management/reports/finished-inspection-report | 报表 |
| 质量异常处理跟踪 | quality-management/reports/quality-exception-tracking | 报表 |
| 不合格品处理汇总 | quality-management/reports/nonconforming-summary | 报表 |
| 质量合格率趋势 | quality-management/reports/quality-rate-trend | 报表（可选） |

### 12.6 设备管理（一级菜单）

**资产台账（分组）**

| 菜单项 | 路径 | 类型 |
|--------|------|------|
| 设备台账 | equipment-management/equipment | 功能 |
| 模具台账 | equipment-management/molds | 功能 |
| 工装台账 | equipment-management/tool-ledger | 功能 |

**运营维护（分组）**

| 菜单项 | 路径 | 类型 |
|--------|------|------|
| 设备故障 | equipment-management/equipment-faults | 业务 |
| 保养计划 | equipment-management/maintenance-plans | 业务 |
| 维护提醒 | equipment-management/maintenance-reminders | 业务 |
| 设备状态 | equipment-management/equipment-status | 业务 |

**设备报表（分组）**

| 菜单项 | 路径 | 类型 |
|--------|------|------|
| 设备维修记录明细 | equipment-management/reports/equipment-maintenance-detail | 报表 |
| 设备保养计划与执行 | equipment-management/reports/equipment-maintenance-plan | 报表 |
| 设备故障统计 | equipment-management/reports/equipment-fault-analysis | 报表 |
| 设备运行状态日志 | equipment-management/reports/equipment-status-log | 报表（可选） |

### 12.7 仓储管理（一级菜单）

**入库业务（分组）**

| 菜单项 | 路径 | 类型 |
|--------|------|------|
| 入库管理 | warehouse-management/inbound | 业务 |
| 其他入库单 | warehouse-management/other-inbound | 业务 |
| 还料单 | warehouse-management/material-returns | 业务 |
| 客户来料登记 | warehouse-management/customer-material-registration | 业务 |

**出库业务（分组）**

| 菜单项 | 路径 | 类型 |
|--------|------|------|
| 出库管理 | warehouse-management/outbound | 业务 |
| 其他出库单 | warehouse-management/other-outbound | 业务 |
| 借料单 | warehouse-management/material-borrows | 业务 |
| 送货单 | warehouse-management/delivery-notes | 业务 |

**功能业务（分组）**

| 菜单项 | 路径 | 类型 |
|--------|------|------|
| 盘点单 | warehouse-management/stocktaking | 业务 |
| 调拨单 | warehouse-management/inventory-transfer | 业务 |
| 组装单 | warehouse-management/assembly-orders | 业务 |
| 拆卸单 | warehouse-management/disassembly-orders | 业务 |

**库存管理（分组）**

| 菜单项 | 路径 | 类型 |
|--------|------|------|
| 线边仓管理 | warehouse-management/line-side-warehouse | 查询 |
| 倒冲记录 | warehouse-management/backflush-records | 查询 |
| 补货建议 | warehouse-management/replenishment-suggestions | 查询 |
| 即时库存 | warehouse-management/inventory | 查询 |
| 批次库存查询 | warehouse-management/batch-inventory-query | 查询 |
| 期初数据导入 | warehouse-management/initial-data | 功能 |
| 条码映射规则 | warehouse-management/barcode-mapping-rules | 功能 |

**库存报表（分组）**

| 菜单项 | 路径 | 类型 |
|--------|------|------|
| 库存收发存汇总 | warehouse-management/reports/inventory-summary | 报表 |
| 库存收发存明细 | warehouse-management/reports/inventory-ledger | 报表 |
| 库龄分析 | warehouse-management/reports/inventory-age-analysis | 报表 |
| 呆滞物料统计 | warehouse-management/reports/slow-moving-inventory | 报表 |
| 入库明细汇总 | warehouse-management/reports/inbound-summary | 报表 |
| 出库明细汇总 | warehouse-management/reports/outbound-summary | 报表 |
| 盘点单历史与差异 | warehouse-management/reports/stocktaking-history | 报表 |
| 调拨单跟踪 | warehouse-management/reports/transfer-tracking | 报表 |

### 12.8 财务管理（一级菜单）

**应收管理（分组）**

| 菜单项 | 路径 | 类型 |
|--------|------|------|
| 应收账款 | finance-management/receivables | 业务 |
| 销项发票 | finance-management/sales-invoices | 业务 |
| 收款记录 | finance-management/receipts | 业务 |

**应付管理（分组）**

| 菜单项 | 路径 | 类型 |
|--------|------|------|
| 应付账款 | finance-management/payables | 业务 |
| 进项发票 | finance-management/purchase-invoices | 业务 |
| 付款记录 | finance-management/payments | 业务 |

**发票台账（分组）**

| 菜单项 | 路径 | 类型 |
|--------|------|------|
| 发票列表 | finance-management/invoices | 业务 |

**报表（分组）**

| 菜单项 | 路径 | 类型 |
|--------|------|------|
| 应收账款账龄分析 | finance-management/reports/receivable-age-analysis | 报表 |
| 应收账款对账 | finance-management/reports/receivable-reconciliation | 报表 |
| 销售回款明细 | finance-management/reports/sales-receipt-detail | 报表 |
| 应付账款账龄分析 | finance-management/reports/payable-age-analysis | 报表 |
| 应付账款对账 | finance-management/reports/payable-reconciliation | 报表 |
| 三单匹配 | finance-management/reports/three-way-match | 报表 |

### 12.9 分析中心（一级菜单）

**效率管理（分组）**

| 菜单项 | 路径 | 类型 |
|--------|------|------|
| 单据节点耗时 | analysis-center/document-timing | 查询 |
| 单据效率分析 | analysis-center/document-efficiency | 查询 |

**成本管理（分组）**

| 菜单项 | 路径 | 类型 |
|--------|------|------|
| 成本核算 | cost-management/cost-calculations | 查询 |
| 成本分析 | cost-management/cost-comparison | 查询 |
| 成本规则 | cost-management/cost-rules | 查询 |
| 成本明细 | cost-management/cost-details | 查询 |
| 成本优化 | cost-management/cost-optimization | 查询 |
| 成本报表 | cost-management/cost-report | 查询 |

**跨业务报表（分组）**

| 菜单项 | 路径 | 类型 |
|--------|------|------|
| 销售订单全链路跟踪 | analysis-center/reports/sales-order-full-trace | 报表 |
| 采购订单全链路跟踪 | analysis-center/reports/purchase-order-full-trace | 报表 |
| 物料全生命周期跟踪 | analysis-center/reports/material-lifecycle-trace | 报表 |
| 业务单据状态看板 | analysis-center/reports/business-status-dashboard | 报表 |

**说明**：业务单据与报表菜单已整合，各模块下「报表」分组挂载对应报表；分析中心下成本管理路径仍为 `cost-management/*`；标注「可选」的报表可后期迭代。