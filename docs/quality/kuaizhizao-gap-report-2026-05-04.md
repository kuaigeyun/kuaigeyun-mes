# 快制造应用使用体验与功能完整性分析报告

> 评估范围：`riveredge-frontend/src/apps/kuaizhizao` + `riveredge-backend/src/apps/kuaizhizao`
> 评估视角：终端使用者（销售、计划员、采购员、车间一线、库管、检验员、财务、管理员）
> 评估时间：2026-05-04
> 评估方法：模块走查 + 关键单据链路校验 + 占位/TODO 全文检索

> **范围说明（2026-05-04 更新）**：
> 本报告仍**保留对触屏终端 / kiosk 相关问题的诊断**（`production-execution/work-orders/kiosk.tsx`、`detail-kiosk.tsx`、`sop-viewer/kiosk.tsx`、`quality-management/inspection-center` 等车间大屏/触屏页面），用于后续独立交付 EXE 客户端时参考；
> 但**这些条目暂从本期 Web 端改进计划中排除**，不计入第六章「改进优先级建议」与第七章「端到端用户验收用例」。已在相关条目上以"[暂排除：移交独立 EXE 客户端终端]"标注。

---

## 一、模块全景

应用包含 11 个业务一级菜单（按 `pages/` 目录归并）：

| # | 模块 | 主要单据 | 备注 |
|---|---|---|---|
| 1 | 销售管理 | 报价单、销售订单、销售预测、客户跟进、发货通知、销售退货、9 张销售报表 | |
| 2 | 计划管理 | 需求管理、需求计算（MRP 统一）、生产计划、排程、7 张计划报表 | |
| 3 | 采购管理 | 采购申请、采购订单、收货通知、采购退货、3 张采购报表 | |
| 4 | 生产执行 | 工单、委外工序、委外工单、报工、包装绑定、返工、异常处理（质量/缺料/交期）、kiosk、9 张生产报表 | |
| 5 | 质量管理 | 来料/工序/成品检验、检验计划、追溯、检验中心、6 张质量报表 | |
| 6 | 仓储管理 | 入库/出库/其他入库/其他出库/借料/还料/叫料/盘点/调拨/库存预警/期初导入/批次查询/线边仓/拆卸/装配/客户物料寄存/中央配料、7 张仓储报表 | |
| 7 | 设备管理 | 设备/故障/维护计划/维护提醒/状态/模具/工装/模具维护/模具使用、2 张设备报表 | |
| 8 | 绩效管理 | 绩效汇总/节假日/技能矩阵/员工配置/KPI 定义/工时单价/计件单价、2 张绩效报表 | |
| 9 | 成本管理 | 成本核算 Tab（生产/委外/采购/质量）、成本台账、成本规则、成本对比、成本明细、质量成本、成本报表 | 与 `kuaicaiwu` 财务存在重叠 |
| 10 | 仪表盘 | 车间看板、待办、实时播报、工序进度、管理指标 | |
| 11 | 公共 | `PlaceholderPage`、`StationBinder`、单据追溯面板、SOP Viewer Kiosk | kiosk 类页面[暂排除：移交独立 EXE 客户端终端] |

---

## 二、跨模块的逻辑断裂（端到端链路）

我把"从客户报价到货款回笼"的完整链路画一遍，**红字** 是已识别的断点：

```
报价单
  └─转销售订单─▶ 销售订单
                  ├─MTO 模式─▶ 工单（手动选择）
                  ├─MTS 模式──断──▶ 工单（无直接关联，需经需求计算）
                  └─下推需求─▶ 需求管理 ─▶ 需求计算（MRP）
                                              ├─生成─▶ 工单
                                              └─生成─▶ 采购订单
                                                        └─收货─▶ 收货通知 ─▶ 入库（MOCK 占位）
工单
  ├─派工/报工─▶ 报工记录（kiosk 端报工未真正调 API）[kiosk 部分暂排除]
  ├─领料─▶ 出库（生产领料）
  ├─检验─▶ 工序检验（inspector_id 硬编码=1）
  ├─完工─▶ 成品入库（自动入库逻辑不闭环）
  ├─拆卸/装配─▶ 仓库（仅更新明细状态，未调用库存服务）
  └─异常─▶ 异常处理（质量异常检测 TODO）
销售订单
  ├─出库─▶ 销售出库
  └─送货─▶ 送货单（"销售订单号/出库单号"为手填，未联动）
回款 ─断──▶ 财务（kuaizhizao/services/finance.ts 是占位，需切 kuaicaiwu）
```

### 2.1 主要断裂点清单

| # | 链路位置 | 断裂表现 | 证据 |
|---|---|---|---|
| 1 | 销售订单 → 工单 | MTS 模式无直接绑定，链路只能靠"需求计算" | `production-execution/work-orders/index.tsx:705-718`：仅 MTO 时拉销售订单 |
| 2 | 需求 → 下游单据 | 文档关系服务里 `if demand_type == "sales_forecast"/"sales_order"` 两个分支都标 `TODO: 步骤1.2实现统一需求计算后` | `services/document_relation_service.py:1300, 1327, 1355` |
| 3 | 需求计算 → 全链路溯源 | "完整溯源功能开发中，将支持点击跳转至对应订单"（已上线但是个静态提示）| `pages/plan-management/demand-computation/index.tsx:2524` |
| 4 | 销售出库 → 送货单 | 送货单弹窗里 `sales_delivery_code`、`sales_order_code` 是 `Input placeholder="可选，关联出库单"`，**手填字符串**，无联动 | `pages/warehouse-management/delivery-notes/index.tsx:491-501` |
| 5 | 收货通知 → 入库 | 服务端 `create_receipt_from_order` 直接返回 `{"id": 1, "receipt_code": "MOCK"}` | `services/purchase_service.py:955` |
| 6 | 工单完工 → 成品入库 | 入库逻辑零散，期初导入里 "TODO: 如果提供了已投入数量，可以创建生产领料单记录" | `services/initial_data_service.py:643` |
| 7 | 拆卸/装配 → 库存 | "执行拆卸（更新明细状态，TODO: 调用库存服务）"——仅状态变化，库存数量不动 | `api/productions/productions.py:3113` |
| 8 | 工单异常 → 质量模块 | 异常检测工作流里 "3. 质量异常检测（TODO: 待质量模块完善后补充）" | `inngest/functions/exception_detection_workflow.py:126` |
| 9 | 客户跟进 ↔ 销售订单 | 两边页面没有双向跳转/单据卡片 | `pages/sales-management/customer-follow-ups/index.tsx`（独立单据，无 DocumentTracking） |
| 10 | 工单批量下达 | "检查5：工作中心能力检查（后端待实现，暂跳过）" | `pages/production-execution/work-orders/index.tsx:2600` |
| 11 | 财务回款 | `services/finance.ts` 是 5 行占位："本模块仅保留占位，请使用 kuaicaiwu 的 finance 服务" | `services/finance.ts:5` |
| 12 | 待办处理 | 看板"处理"按钮只是 redirect 到对应页面，并不在原地完成事务 | `api/dashboards/dashboards.py:658-799` 全是 `return {..., redirect: "/..."}` |

---

## 三、各模块基础功能缺失

### 3.1 销售管理

| 严重度 | 缺失/问题 | 证据 |
|---|---|---|
| ★★★ | 客户销售业绩汇总报表里的金额是**伪造**：`completed_amount = total × 0.8`、`received_amount = total × 0.7`、`salesman_name = "系统管理员"`、`customer_code = f"C{customer_id:04d}"` | `services/report_service.py:464-468` |
| ★★★ | `_get_sales_order_summary` 在无数据时注入 DEBUG 行，把 `tenant_id`、其它租户列表、null 租户数都返回给前端，**租户 ID 泄露** | `services/report_service.py:319-326` |
| ★★ | 销售订单 `发货方式 / 付款条件` 字典未配置时静默 console.warn，没有兜底默认值 | `pages/sales-management/sales-orders/index.tsx:553, 565` |
| ★★ | 报价单"生成 PDF" 后端 TODO（已修复前端按钮文案，但实际 PDF 仍依赖 print_service） | `api/purchases/purchases.py:487`「TODO: 实现PDF生成」（同模式报价亦受影响）|
| ★ | 销售退货编辑限制只允许"草稿状态"，弹的是 `messageApi.warning('非草稿状态不支持编辑')`，但**没有给"撤回到草稿"动作**，用户只能新建 | `pages/sales-management/sales-returns/index.tsx:423` |
| ★ | 销售报表全部使用 `request: async (params) => ...` 但**忽略了 ProTable 的搜索表单**——所以"客户名称""日期范围"高级搜索其实不会传给后端 | 9 个 sales reports 页全部 `getSalesReport({...params, report_type})`，未取 `searchFormValues` |
| ★ | 销售报表全部 `limit(50)` 或 `limit(100)`，前端 `total: res.data?.length`，**没有分页**，>100 条数据直接截断 | `services/report_service.py:313, 347` 等多处 |

### 3.2 计划管理

| 严重度 | 缺失/问题 | 证据 |
|---|---|---|
| ★★★ | 生产计划"编辑"按钮**没接通**，点击仅提示 `messageApi.info('编辑功能正在对接明细调整界面...')` | `pages/plan-management/production-plans/index.tsx:380` |
| ★★ | 需求计算下游溯源是 TODO（见跨模块表第 2 项）| 同上 |
| ★ | 排程页 `pages/plan-management/scheduling/index.tsx` 存在但功能性未走查到（建议手测）| —— |
| ★ | 需求计算的 `allow_draft` 模式会**自动创建占位供应商「待指定」**，污染主数据；用户后续如果忘了改会下出"待指定"的真实采购单 | `services/demand_computation_service.py:2644-2710` |

### 3.3 采购管理

| 严重度 | 缺失/问题 | 证据 |
|---|---|---|
| ★★★ | 采购单 PDF 生成 TODO，按钮可点但无内容 | `api/purchases/purchases.py:487` |
| ★★★ | `create_receipt_from_order` 在某条路径下返回 `{"id": 1, "receipt_code": "MOCK"}`，**会污染入库台账** | `services/purchase_service.py:955` |
| ★★ | `ORDER_TYPE` 字典缺失时直接吞错使用默认值，用户在采购单上看不到订单类型选项却也不报错 | `pages/purchase-management/purchase-orders/index.tsx:464` |
| ★ | 收货通知撤回会移除关联采购入库草稿，但提示文案藏在 `Modal.confirm` 里，撤回后用户经常找不到刚生成的收货明细 | `pages/purchase-management/receipt-notices/index.tsx:469` |

### 3.4 生产执行（最严重的一个模块）

| 严重度 | 缺失/问题 | 证据 |
|---|---|---|
| ★★★ | **[暂排除：移交独立 EXE 客户端终端]** detail-kiosk 报工"完工"按钮根本没调 API：`// TODO: 调用真实的报工API`，UI 上 `message.success('成功报工')` 但库里**没数据**——一线工人以为报完了 | `pages/production-execution/work-orders/detail-kiosk.tsx:90-93` |
| ★★★ | 工序检验 `inspector_id: 1` 硬编码，**所有车间检验记录都挂在 1 号用户名下**，绩效/追溯/责任全部失真 | `pages/production-execution/work-orders/components/ProcessInspectionModal.tsx:59` |
| ★★ | **[暂排除：移交独立 EXE 客户端终端]** kiosk "暂停"按钮：`message.info('暂停功能待实现')` | `pages/production-execution/work-orders/detail-kiosk.tsx:129` |
| ★★ | **[暂排除：移交独立 EXE 客户端终端]** kiosk "分步引导式作业指导" Tab：`<Empty description="分步引导式作业指导开发中" />` | `pages/production-execution/work-orders/kiosk.tsx:1399` |
| ★★ | **[暂排除：移交独立 EXE 客户端终端]** kiosk "工序检验" 标签页：`title={item.label === '质检' ? '工序检验数据待对接' : undefined}` | `pages/production-execution/work-orders/kiosk.tsx:1128` |
| ★★ | 委外工单 (outsource-orders)："新建委外单需要更多字段，这里需要从工单创建，所以这里暂时不支持直接创建"——**禁用了独立创建路径**，使用者必须从工单里委外 | `pages/production-execution/outsource-orders/index.tsx:438` |
| ★★ | 委外工单"委外总金额"字段 `disabled={true}` 写死，自动算出来错时无法人工覆盖 | `pages/production-execution/outsource-work-orders/index.tsx:1376` |
| ★ | 工单批量下达"工作中心能力检查"暂跳过 | `pages/production-execution/work-orders/index.tsx:2600` |
| ★ | 工单批量打印二维码"TODO: 可以打开一个Modal显示所有二维码，或者提供下载功能" | `pages/production-execution/work-orders/index.tsx:2035` |
| ★ | 异常工作流的"质量异常检测"是 TODO | `inngest/functions/exception_detection_workflow.py:126` |
| ★ | 拆卸订单"执行拆卸"只改明细状态，库存不变 | `api/productions/productions.py:3113` |

### 3.5 质量管理

| 严重度 | 缺失/问题 | 证据 |
|---|---|---|
| ★★★ | inspector_id 硬编码（同上）| —— |
| ★★ | 工序检验扫码报工"TODO: Add button to trigger this"——扫码功能写好了但**没暴露入口**| `pages/quality-management/process-inspection/index.tsx:295` |
| ★★ | 质量异常检测 TODO（同上）| —— |
| ★ | 检验合格后是否自动放行入库的逻辑没有显式 UI 提示，用户不知道哪一步触发了入库 | 业务行为，需手测 |

### 3.6 仓储管理

| 严重度 | 缺失/问题 | 证据 |
|---|---|---|
| ★★★ | 拆卸/装配单的库存不联动 | `api/productions/productions.py:3113` |
| ★★ | **送货单/借料单/还料单"打印"** 一律 `messageApi.warning('打印功能暂未配置模板')`——没有兜底 PDF 或 HTML 预览 | `delivery-notes:339`、`material-borrows:303`、`material-returns:313` |
| ★★ | 送货单关联销售出库/销售订单是手填字符串，错号几率大 | `delivery-notes/index.tsx:491-501` |
| ★ | 入库页因为 `unit` 字典未配置时会 404，靠"直接显示物料单位码"绕过 | `pages/warehouse-management/inbound/index.tsx:112` |
| ★ | 期初导入对 WIP 已投入数量 "TODO: 如果提供了已投入数量，可以创建生产领料单记录"——意味着初始化数据**不会回写领料台账** | `services/initial_data_service.py:643` |

### 3.7 设备管理

功能项齐全，未发现硬性 TODO。但与"设备故障 → 工单异常"的联动只是异步抓取，看板显示而已，**不会自动暂停受影响工单**。

### 3.8 绩效管理

| 严重度 | 缺失/问题 | 证据 |
|---|---|---|
| ★★★ | 销售人/操作员名都假数据"系统管理员" | `services/report_service.py:468` |
| ★★ | inspector_id=1 → 工序检验绩效全部归到 1 号 | 同 3.4 |

### 3.9 成本管理

| 严重度 | 缺失/问题 | 证据 |
|---|---|---|
| ★★ | 成本核算页"成本趋势图表（待实现）"+ "成本明细" Tab 是 `<pre>{JSON.stringify(...)}</pre>` 直接 dump JSON，**正式环境不可见** | `pages/cost-management/cost-calculations/index.tsx:736-742` |
| ★★ | "成本优化"路由只是个 redirect 占位（`<Navigate to="../cost-calculations" replace />`）| `pages/cost-management/cost-optimization/index.tsx:8` |
| ★ | `services/finance.ts` 是占位文件，"请使用 kuaicaiwu 的 finance 服务"——成本与财务**双系统**，对账要跨应用 | `services/finance.ts:5` |

### 3.10 仪表盘

| 严重度 | 缺失/问题 | 证据 |
|---|---|---|
| ★★ | 待办"处理"按钮全部是 `redirect: "/apps/kuaizhizao/..."`——没有"一键确认/审核/收货"的就地动作 | `api/dashboards/dashboards.py:683-799` 共 30+ 处一致 |
| ★ | 看板上的"实时播报""管理指标"等卡片对刚启用、没数据的租户体验差（直接全 0）| `pages/dashboard/index.tsx:74-90` |

---

## 四、用户视角的"看到却用不了"高频清单

按用户每天最容易踩到的顺序排（kiosk/触屏终端类条目已挪出本表，统一由独立 EXE 客户端项目跟进）：

1. **检验员**：所有工序检验记录都挂到了"1 号用户"，再也分不清谁检的
2. **计划员**：生产计划"编辑"点了只是提示"正在对接"
3. **销售/老板**：客户销售汇总里看见 80% 完成、70% 回款，**全是估算公式**
4. **业务经理**：看待办点"处理"，结果只是跳到列表页
5. **库管**：送货单"打印"点了是 `warning('暂未配置模板')`
6. **库管**：拆卸单点"执行拆卸"，明细变状态了但库存数量不动
7. **采购员**：采购单"生成 PDF" 后端 TODO
8. **财务**：要看真财务得切到 `kuaicaiwu`

> 已挪出（待 EXE 客户端跟进）：detail-kiosk "完工" 不写库、kiosk "暂停" 提示待实现、kiosk "分步引导" / "工序检验" 占位。

---

## 五、数据可信度风险（写到台账里就再也擦不干净的那种）

| 风险点 | 后果 |
|---|---|
| 报表 DEBUG 行返回 `tenant_id`、其它租户列表 | **多租户隔离信息泄露**（`report_service.py:319-326`）|
| `create_receipt_from_order` 返回 `MOCK` 假入库 | 收货数据失真，库存对不上账 |
| `inspector_id = 1` | 检验责任无法追溯 |
| `salesman_name = "系统管理员"` | 销售业绩归错人 |
| 客户金额按 0.8 / 0.7 系数 | 财务核对/客户对账翻车 |
| `customer_code = f"C{customer_id:04d}"` | 跟主数据真实客户编号不一致 |
| `allow_draft` 自动创建"待指定"占位供应商 | 主数据中出现假供应商，下游单据会误关联 |

---

## 六、改进优先级建议

> 本章只列入**本期 Web 端**改进事项。kiosk / 车间触屏 / SOP 大屏类问题已统一移交独立 EXE 客户端项目，详见末尾「附 A：移交独立 EXE 客户端终端的事项清单」。

### P0（建议立即修，不修就有数据/合规风险）

1. `_get_sales_order_summary` 删掉 DEBUG 注入逻辑（租户信息泄露）
2. `create_receipt_from_order` 的 MOCK 分支补完或拒绝
3. `inspector_id` 改用当前登录用户
4. 客户销售汇总的占位算式去掉，改为真实查询或显式标注"暂不支持"
5. 报表 API 解包问题（已修复）

### P1（用户日常会被卡住）

6. 生产计划"编辑"功能
7. 报价 / 采购 PDF 生成
8. 送货单/借料/还料 打印模板配置 + 默认 PDF 兜底
9. 拆卸/装配订单的库存联动
10. 工序检验扫码报工入口暴露（Web 端的 `process-inspection` 页面入口；kiosk 端的扫码已挪到附 A）
11. 报表搜索表单参数透传到后端 + 真分页

### P2（链路完整性 / 体验）

12. 销售订单 ↔ 工单 ↔ 出库 ↔ 送货单的双向选择联动
13. 需求溯源 step1.2 接通
14. 看板待办的就地处理（取代纯 redirect）
15. 成本核算 Tab 的 `<pre>JSON</pre>` 改为表格/图表
16. 工单批量下达"工作中心能力"检查
17. 异常检测里的"质量异常"补全
18. allow_draft 占位供应商显式提示，避免"待指定"流入正式单据

### P3（清理与去重）

19. 移除 `PlaceholderPage`、`cost-optimization` 重定向占位
20. `services/finance.ts` 占位文件统一切到 kuaicaiwu
21. `STATION_STORAGE_KEY` 等 `@deprecated` 清理
22. `services/sales-order.ts` 里 `// 趋势数据（mock使用或由后端支持）` 类注释收敛

---

## 七、推荐的"端到端用户验收用例"

如果要让管理员或试用客户实际跑一遍，建议按下列顺序（**只覆盖 Web 端**；车间报工 / kiosk 验收用例移到附 A）：

1. 报价单 → 转销售订单 → 检查链路图能否一路追到"生产计划/工单/出库/送货"
2. 创建 MTS 销售订单 → 跑需求计算 → 一键生成工单 → 看是否能在销售订单里追溯到衍生工单
3. 工单下达 → 在 Web 端工单列表/详情中执行"派工"操作 → 确认派工记录与负责人写库正确（kiosk 报工真实落库由 EXE 客户端项目验收）
4. 工序检验记录（Web 端 `process-inspection` 页面创建）→ 去绩效/追溯页面看 inspector 是不是当前登录用户
5. 客户销售业绩汇总报表 → 与销售订单/收款台账人工核对一笔
6. 需求计算 `allow_draft` 模式生成委外工单 → 检查是否出现"待指定"假供应商
7. 送货单"打印" → 没有模板时是否还有可用的输出
8. 拆卸订单"执行拆卸" → 去批次库存查询确认数量是否真的减少

每一项跑完截图对照对应章节就能验证修复进度。

---

## 附 A：移交独立 EXE 客户端终端的事项清单

下列条目已从本期 Web 端改进计划中**剥离**，待"快制造车间触屏 EXE 客户端"项目立项后再统筹处理。本报告之所以仍然列出，是为了让独立项目能直接以这份清单作为需求输入。

### A.1 高风险（不修则数据丢失 / 责任无法追溯）

| 来源 | 描述 | 证据 |
|---|---|---|
| 第 3.4 节 | detail-kiosk 报工"完工"按钮根本没调 API（`// TODO: 调用真实的报工API`），UI 提示"成功报工"但库里无数据 | `pages/production-execution/work-orders/detail-kiosk.tsx:90-93` |

### A.2 中风险（功能占位 / 用户误以为已实现）

| 来源 | 描述 | 证据 |
|---|---|---|
| 第 3.4 节 | kiosk "暂停"按钮 `message.info('暂停功能待实现')` | `detail-kiosk.tsx:129` |
| 第 3.4 节 | kiosk "分步引导式作业指导" Tab `<Empty description="..." />` | `kiosk.tsx:1399` |
| 第 3.4 节 | kiosk "工序检验" 标签页提示"工序检验数据待对接" | `kiosk.tsx:1128` |
| 第 3.5 节 | 工序检验扫码报工"TODO: Add button to trigger this"，扫码逻辑写好但**未在车间触屏暴露入口**（Web 端入口归 P1-#10） | `pages/quality-management/process-inspection/index.tsx:295` |
| 跨模块 §2.1 | 工单 → 报工记录在 kiosk 路径上未真正调 API（与 A.1 同源，独立验收时一并覆盖） | 同上 |
| 第 1 节 | 公共菜单中的 `SOP Viewer Kiosk`（`pages/production-execution/sop-viewer/kiosk.tsx`）的最终形态、版本与下发机制由 EXE 客户端统一规划 | —— |

### A.3 EXE 客户端立项时建议的独立验收用例

1. **真实报工写库**：工单下达 → 触屏端"开始 / 暂停 / 完工" → DB / 报工记录页核对是否每一步都落库，且 `operator_id` 为当前扫码登录工人。
2. **工序检验扫码闭环**：触屏端扫件号 → 自动定位待检工序 → 录入合格/不合格 → 检验记录 inspector 字段为当前登录用户、绩效页能正确归人。
3. **SOP 分步引导**：分步骤展示 SOP，每一步签字 / 留痕；离线/弱网下的本地缓存与回写策略。
4. **工位与设备绑定**：`StationBinder` 在 EXE 端的持久化方案（替换 `STATION_STORAGE_KEY`）。
5. **多账户切换 / 离线鉴权**：触屏车间常见多人共用一台机器，需要可视化用户切换、超时锁屏、断网容错。

> 一旦上述独立项目落地，本报告对应条目可整体闭合。
