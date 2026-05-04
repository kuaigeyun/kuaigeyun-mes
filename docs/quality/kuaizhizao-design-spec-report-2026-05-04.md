# 快制造（kuaizhizao）应用前端设计规范性改进报告

> 评估范围：`riveredge-frontend/src/apps/kuaizhizao/pages/**`
> 评估视角：系统级前端设计规范、组件复用、视觉/交互一致性、可维护性
> 评估时间：2026-05-04
> 评估基准：**销售订单页（`sales-management/sales-orders/index.tsx`）** 是当前 kuaizhizao 内规范度最高、组件覆盖最完整的页面，本报告以其作为「最佳实践基线」，逐项对照其它页面给出差距与改进建议。

---

## 一、销售订单页确立的「基线」要点

> 用作其它页面对照检查的标准用法集合。

| 维度 | 销售订单页的做法 |
|---|---|
| 页面壳层 | `ListPageTemplate` + `statCards` + 内嵌 `UniTable` |
| 表格 | `UniTable`，`viewTypes=['table','detailTable','help']`、`headerTitle`、`actionRef`、`request`、`showAdvancedSearch`、`showImportButton`、`showExportButton`、`columnPersistenceId`、`enableRowSelection` |
| 列宽与省略 | 长字段使用列持久化 + 显式 `width`/`ellipsis`，避免自适应抖动 |
| 编号生成 | `getCodeRulePageConfig` + `isAutoGenerateEnabled` + `generateCode`，统一对接编码规则中心 |
| 创建/编辑表单 | `FormModalTemplate` + `ProForm*`，规则与校验在表单组件层 |
| 详情抽屉 | `DetailDrawerTemplate` + `DetailDrawerSection` + `Pane*` 拆分（basic/lines/timeline/collaboration/extra/footer） |
| 生命周期 | `UniLifecycle` / `UniLifecycleStepper` + 数据来自 `utils/*Lifecycle.ts` 工具 |
| 行内动作 | `renderRowActionsOverflow`（折叠溢出）+ `UniDropdown`（受控菜单语义） |
| 工作流动作 | `UniWorkflowActions` 统一渲染审核/反审/驳回等 |
| 全链路浮层 | `useDocumentTracking` + `DocumentTrackingRelationsTabsBody` + `TraceLinkedDocumentBrief`，`zIndex=token.zIndexPopupBase+1`，进入抽屉打开后才显示，关闭抽屉前先隐藏 |
| 审核闸门 | `useAuditRequired('salesOrder', false)` 控制按钮/标签可见性，不再依据 `review_status` 自由判断 |
| 文案 | 全量 `useTranslation()` + `t('app.kuaizhizao.salesOrder.*')`（约 248 处 `t()`）|
| 主题与颜色 | `theme.useToken()` 取色，`token.colorPrimary / colorWarning / colorSuccess`，仅极少量的逾期高亮才用 hex |
| 金额展示 | `AmountDisplay` 包裹，统一千分位/精度/权限脱敏 |
| 重要交互 | `useDeferAfterPaint` 推迟非关键渲染；`Modal.confirm` 的 `cancelText/okText` 走 i18n |

---

## 二、核心规范性缺口（按高/中/低优先级分组）

### 2.1 高优先级（影响用户感知一致性 / 维护成本最高）

#### G-1 国际化覆盖度极不均衡

`grep -c "t('app.kuaizhizao"` 抽样统计：

| 页面 | `t()` 调用数 |
|---|---|
| 销售订单 `sales-orders/index.tsx` | **248** |
| 仓储初始化 `warehouse-management/initial-data` | 81 |
| 销售预测 `sales-forecasts` | 88 |
| 客户跟进 `customer-follow-ups` | 36 |
| 报价单 `quotations` | 23 |
| 工单 `work-orders` | 18 |
| 采购订单 `purchase-orders` | 20 |
| 销售退货、入库、出库、模具、刀具、包装绑定、报工、返工、检验… | **2 ~ 6** |
| 性能-假期/技能/小时工费率/计件、设备状态、需求计算、刀检/模检… | **2 或 0** |

**问题**：除了销售订单与少数高优先模块外，其它页面文案绝大多数为硬编码中文，存在：
- 同一含义在不同页面有差异表述（"提交" / "送审" / "提交审核"；"编辑" / "修改"；"删除" / "移除"）。
- 错误/成功提示直接 `messageApi.error('获取设备状态失败')`，无法跟随多语言切换。
- `placeholder=`、`title=`、`okText=`、`cancelText=` 大量未走 i18n。

**改进建议**：
1. 将 `app.kuaizhizao.common.*` 作为通用文案 namespace（操作动词、确认框、错误提示），所有页面引用而非自写。
2. 制定模块前缀约定：`app.kuaizhizao.<module>.<entity>.*`（参考 `salesOrder.*` 已落地）。
3. 在 lint 层加 `react-i18next/no-literal-string`（Chinese 字面量告警）兜底，按目录设白名单灰度推进。

#### G-2 全链路浮层布局常量在每个页面重复声明

40+ 个页面文件各自重复定义同一组常量，仅前缀不同：

```17:21:riveredge-frontend/src/apps/kuaizhizao/pages/quality-management/process-inspection/index.tsx
const PI_DETAIL_CHAIN_FLOAT_MARGIN = 16;
const PI_DETAIL_LEFT_CHAIN_GAP = 16;
const PI_DETAIL_CHAIN_DRAWER_GAP = 16;
const PI_DETAIL_CHAIN_VERTICAL_TRIM = PI_DETAIL_CHAIN_FLOAT_MARGIN * 2 + PI_DETAIL_LEFT_CHAIN_GAP;
const piDetailChainHalfHeightCss = `calc((100vh - ${PI_DETAIL_CHAIN_VERTICAL_TRIM}px) / 2)`;
```

销售订单页同样存在但用 `SALES_ORDER_*` 前缀。一旦设计微调（如把 16px 改 12px），需要全局批量修改 40+ 文件。

**改进建议**：
- 抽取 `useDocumentTrackingChainOverlay()` Hook 或 `getDocumentTrackingChainOverlayCss()` 工具，输入抽屉宽度配置，输出 `{ overlayHalfHeightCss, panelWidthCss, briefTopCss, zIndex, margin }`，所有页面统一引用。
- 同时把"抽屉打开后再淡入浮层 / 关闭抽屉前先淡出浮层"的 timing 也封装到该 Hook（销售订单/报价单页已经实现，但每页拷贝一份，参考 `QUOTATION_CHAIN_OVERLAY_HIDE_BEFORE_DRAWER_MS`）。

#### G-3 `renderRowActionsOverflow` 引入路径不一致

```
'../../../../../utils/renderRowActionsOverflow'   ← 7 个 kuaizhizao 页面 + 系统模块
'../../../../../components/uni-action'            ← 销售订单 + 部分新页面（uni-action 内部 re-export）
```

两条路径并存导致：
- IDE 自动补全两条都出现，新人不知道选哪条；
- 未来若要把 `utils/renderRowActionsOverflow.ts` 删除/迁移，潜在二次破坏。

**改进建议**：
- 收敛到 `components/uni-action`（与 `normalizeActionTree`、`defaultIconForRowAction` 同源），并在 `utils/renderRowActionsOverflow.ts` 内做 deprecated re-export + lint rule 提示迁移。

#### G-4 状态/审核相关表达散落，与 `useAuditRequired` 未对齐

报价单整改后已用 `useAuditRequired('quotation', false)` 控制 `canApprove / canRevokeReview / canCustomerConfirm` 等。但仍有 16 个页面在内部硬编码"审核通过"/"已审核"/"approved" 等串：

```
sales-orders/index.tsx           : 11
sales-forecasts                  : 8
purchase-orders                  : 7
quotations                       : 19  （遗留兼容）
purchase-returns                 : 5
process-inspection / incoming-... : 3 each
```

加之销售订单页面 `APPROVED_STATUS_VALUES` 这种字符串集合直接写在文件顶层：

```88:90:riveredge-frontend/src/apps/kuaizhizao/pages/sales-management/sales-orders/index.tsx
const APPROVED_STATUS_VALUES = ['已审核', SalesOrderStatus.AUDITED, ReviewStatus.APPROVED, '审核通过', '通过', '已通过'] as const;
const isApprovedRecord = (r: SalesOrder) => APPROVED_STATUS_VALUES.some((v) => r.status === v || r.review_status === v);
```

**问题**：相同业务断言在每个单据页都被以略有差异的字面量再写一份；中英文混用容易在多租户/多语言环境出错。

**改进建议**：
1. 把 `isApprovedRecord` / `isPendingReview` / `isWithdrawn` 等抽到 `utils/documentReviewStatus.ts` 公共方法，并接受 `reviewStatus + lifecycleStage + auditRequired` 三入参。
2. 统一通过 `useDocumentReviewGate(scene, record)` 暴露 `{ canApprove, canWithdrawApprove, canCustomerConfirm, canRejectAudit, … }`，业务页面只消费布尔。
3. 不应允许业务页面再直接 `r.review_status === 'APPROVED'`，避免回归。

---

### 2.2 中优先级（视觉/交互不一致，但可独立修复）

#### G-5 Tag/状态颜色映射在多处自定义

报价单 `STATUS_MAP`、销售订单 `getDocumentLifecycleStageTagProps`、设备状态 `getStatusColor`、Dashboard kpi 卡片直接用 `#fff`/`#fa8c16`：

```85:91:riveredge-frontend/src/apps/kuaizhizao/pages/sales-management/quotations/index.tsx
const STATUS_MAP: Record<string, { text: string; color: string }> = {
  草稿: { text: '草稿', color: RE_STATUS_BADGE_DRAFT },
  已发送: { text: '已发送', color: 'processing' },
  已接受: { text: '已接受', color: 'success' },
  已拒绝: { text: '已拒绝', color: 'error' },
  已转订单: { text: '已转订单', color: 'success' },
};
```

```162:172:riveredge-frontend/src/apps/kuaizhizao/pages/equipment-management/equipment-status/index.tsx
const getStatusColor = (status: string): string => {
  const statusColors: Record<string, string> = {
    '正常': 'success',
    '运行中': 'processing',
    '待机': 'default',
    '维修中': 'warning',
    '故障': 'error',
    '停用': 'default',
  };
  return statusColors[status] || 'default';
};
```

**问题**：
- 同一"已审核 / 待审核 / 已驳回"在销售订单 vs 采购订单 vs 工单 颜色 token 不完全一致（有的用 `processing`，有的用 `gold`/`#faad14`）。
- 状态字典硬编码中文 key，多语言切换会失败。

**改进建议**：
- 统一使用 `getDocumentLifecycleStageTagProps` 从 `*Lifecycle.ts` 推导。
- 设备状态、生产工单状态等非生命周期类，封装 `useStatusToken(scene, status)` 返回 `{ colorToken, label, dot }`。
- 禁止在页面里再写 hex；如必须，必须从 `theme.useToken()` 取派生色。

#### G-6 硬编码颜色与像素值

抽样统计（`color: '#`）：`work-orders 23、purchase-orders 14、demand-computation 6、production-plans 6、purchase-returns 2…`。
`marginBottom: 24/16/12` 等魔法数字在 `sales-orders / quotations / production-plans / work-orders / purchase-orders` 共出现 100+ 次。

**改进建议**：
- 在 `src/global.less` 之上抽 `kuaizhizao-tokens.less` 或 `useKuaizhizaoTokens()`，只暴露白名单 token：`spaceXs/Sm/Md/Lg`、`colorWarningSoft`、`colorOverdueRow`。
- 现有 `--ant-color-warning-bg`（销售订单逾期高亮使用）已是好实践，应推广到工单缺料行、收货异常行等。

#### G-7 列持久化覆盖率不全

`columnPersistenceId` 已被 80+ 文件使用，但仍有以下场景未启用：
- `sales-orders/components/SalesOrderDetailBody` 的"明细行表"
- `equipment-management/equipment-status` 用卡片网格替代表格、缺乏视图切换
- `cost-management/production-cost`、`cost-management/cost-rules` 主表
- 各 `dashboard/index.tsx` 内嵌的"最近订单 / 最近跟进"小表格

并且部分页面 id 命名不统一：`kuaizhizao-sales-quotations-v2`（带版本号） vs `purchase-orders-table`（不带前缀）vs `wo-list-v3`。

**改进建议**：
- 命名规范化为 `kuaizhizao-<module>-<entity>[-vN]`，提供 codemod 一次性扫描升级。
- 对所有 UniTable 强制要求传 `columnPersistenceId`（在 `UniTable` 内打 console.warn）。

#### G-8 视图切换（table/detailTable/help）只在销售订单上一处实现

销售订单的"订单视图 / 明细视图 / 帮助视图"是 kuaizhizao 内最完整的多视图模式（见 2153 行 `viewTypes={['table','detailTable','help']}`），但同样可受益的页面（采购订单、工单、收货通知、发货通知、销售退货）均只展示主视图，用户必须重复打开抽屉/详情才能查看明细。

**改进建议**：
- 至少为：`purchase-orders`、`work-orders`、`shipment-notices`、`receipt-notices`、`sales-returns`、`production-plans` 增加 `detailTable` 视图。
- `helpViewConfig` 抽到模块级 `helpContent.tsx`，避免每个页面再写一遍 JSX。

#### G-9 金额脱敏 `AmountDisplay` 仅在销售/报价/dashboard 使用

`grep "AmountDisplay"` 结果：销售订单、报价单、销售预测、销售退货、销售看板用了，但下列仍直接 `¥{n.toFixed(2)}` 或 `formatMoneyYuan`：
- 采购订单（采购金额、税额）
- 委外订单
- 成本核算（生产成本/成本规则）
- 仓储入/出库（移动均价）

**问题**：未统一权限脱敏，财务/采购视角下"金额查看"权限失效。

**改进建议**：
- 凡涉及"单据金额、含/不含税、毛利"列与汇总，全部走 `AmountDisplay`，不允许自写 `¥xx`。

#### G-10 详情列描述（Descriptions）转换函数被各页拷贝

`buildDescriptionItemsFromColumns` 完全相同的实现散落在：
`equipment / quality-management/process-inspection / incoming-inspection / finished-goods-inspection / equipment-status / equipment-faults / molds / tool-ledger / maintenance-plans / outsource-orders / receipt-notices …`

**改进建议**：
- 抽 `utils/descriptionsFromProColumns.ts` 单一来源；`DetailDrawerTemplate` 可直接消费 `columns + dataSource` 自动生成 `Descriptions`，进一步减少样板。

#### G-11 数据请求形态不统一

报告类页面在 service 层补丁前曾返回裸数组，是经典 `apiRequest` 解包陷阱（已通过 `normalizeReportResponse` 修复）；但其它非报表页面也有类似问题：

```43:51:riveredge-frontend/src/apps/kuaizhizao/pages/sales-management/reports/BaseReport.tsx
const defaultRequest = async (_params: any) => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return { data: [], total: 0, success: true };
};
```

而部分页面 request 写法是 `Array.isArray(response) ? response : (response as any).data || []`（见销售订单 2313 行），各页都补一遍兜底。

**改进建议**：
- 统一在 service 层确保返回 `{ data, total, success }`，禁止业务页面再做"数组兜底"。
- 在 `apiRequest` 添加 `expectsList` 选项，对 list 请求强制保留 envelope。

#### G-12 创建/编辑模态：`Modal` 与 `FormModalTemplate` 混用

`Modal.confirm/info/warning` 直接调用统计：

```
quotations 13、demand-management 4、production-plans 3、work-orders 10
purchase-orders 4、sales-returns 3、warehouse 入库 3、其它 1-2
```

部分确认框 OK/Cancel 文案未 i18n、`okType="danger"` 缺失、`title` 与 `content` 使用上下文样式不一致（有的图标在 title 内，有的在 content 内）。

**改进建议**：
- 抽 `confirmAction({ title, content, danger, t })` 工具，强制 i18n 文案、统一图标位置（`title` 内附 `<ExclamationCircleOutlined />`）。
- 表单类弹窗一律 `FormModalTemplate`，禁止直接 `<Modal>` + 内嵌 `<ProForm>`。

---

### 2.3 低优先级（局部规范/写法/微交互）

#### G-13 页面文件头注释格式不一致

```
@author Luigi Lu / @author RiverEdge Team / Author: Luigi Lu / 无作者
@date 2026-01-27 / Date: 2026-01-05 / @date 2025-12-29
```

**改进建议**：在 `.cursor/rules/page-header.md` 固化一份 page header 模板，并由保存时格式化校验。

#### G-14 `useEffect` + `setInterval` 轮询 vs `useQuery refetchInterval`

`equipment-management/equipment-status` 用 `useEffect + setInterval(30s)` 自实现轮询；`production-execution/dashboard`、`work-orders/kiosk` 又用 `ahooks` `useRequest`；其余主表用 `@tanstack/react-query`。

**问题**：三种状态机并存，缓存失效/卸载清理逻辑各写各的，bug 多发。

**改进建议**：除 kiosk（大屏长驻）允许 `setInterval` 外，其它"周期刷新"统一用 `useQuery({ refetchInterval, refetchIntervalInBackground: false })`。

#### G-15 报表"导出"按钮文案与样式不统一

- `BaseReport.tsx`：`'正在导出 {title}...'`、`'{title} 导出成功'`（写死中文）
- 销售订单/报价单页：`onExport` 通过 `UniTable showExportButton`，文案走 i18n
- 各 reports/*：`<Button type="primary" icon={<DownloadOutlined />}>导出报表</Button>` 又是硬编码

**改进建议**：所有报表 `导出` 走 `UniTable.showExportButton`，禁止自写按钮。

#### G-16 路由跳转风格混杂

```
ROUTES.SALES_ORDER_DETAIL(id)         // 工单/采购订单/部分页面
navigate(`/kuaizhizao/sales/${id}`)   // 销售相关 hard-coded
navigate(`./detail?id=${id}`)         // 个别页面
```

**改进建议**：所有内链都通过 `constants/routes.ts` 的 `ROUTES` 常量；引入 ESLint 规则禁止字面量 `'/kuaizhizao'` 路径。

#### G-17 `customer-follow-ups`、`shipment-notices` 直接 `import { message }` 而非 `App.useApp()`

```
message.error / message.success 出现于 16 个页面 / 弹窗组件
App.useApp() 是 antd5 推荐做法
```

**改进建议**：批量替换为 `const { message: messageApi } = App.useApp();`，并在 lint 层禁用 `'antd'` 的 `message` 命名导入。

#### G-18 `equipment-status` 等卡片型页面未接入 `ListPageTemplate`

直接渲染 `<Row><Col><Card>`，缺失页面外边距规范（销售订单页统一通过 `ListPageTemplate` 提供 16px padding 容器）。

**改进建议**：所有 kuaizhizao 主页面（即使非表格）统一以 `ListPageTemplate`/`PageTemplate` 包裹，避免不同页面外边距错落。

#### G-19 `production-cost` 仍使用 `PageContainer`

```12:14:riveredge-frontend/src/apps/kuaizhizao/pages/cost-management/production-cost/index.tsx
import { ActionType, ProColumns, ProFormSelect, ProFormDigit, ProFormDatePicker, ProFormTextArea, PageContainer, ProDescriptions } from '@ant-design/pro-components';
```

而 kuaizhizao 已统一以 `ListPageTemplate` 替代 `PageContainer`，仍混用会导致面包屑/标题区双重渲染。

**改进建议**：迁移到 `ListPageTemplate`，移除所有 `PageContainer` import。

#### G-20 Dashboard 页面直接使用 `#fff` / `linear-gradient(...)`

```48:55:riveredge-frontend/src/apps/kuaizhizao/pages/sales-management/dashboard/index.tsx
const kpiCardBodyStyle: React.CSSProperties = {
  padding: '16px 24px',
  color: '#fff',
  minHeight: 140,
  …
};
```

各业务模块的 dashboard（warehouse/equipment/sales/production/purchase）KPI 卡 gradient/字号/卡片内边距各写一遍。

**改进建议**：抽 `KpiHeroCard` 通用组件，接受 `{ label, value, deltaPercent, theme: 'sales'|'warehouse'|... }`，主题色统一从 design token 派生。

#### G-21 `Spin` / `Empty` 使用风格不一

- 销售订单详情：`<Spin />` 默认尺寸；
- 报价单详情：`<Spin size="large" />`；
- 工单看板：自定义全屏 loading；
- 多个页面在 `request` 失败后未渲染 `Empty`。

**改进建议**：在 `DetailDrawerTemplate` 内置标准 loading/empty，业务页面不再自渲染。

#### G-22 表格 `scroll.x` / 列宽度 magic number 严重

- `BaseReport.tsx`：`scroll={{ x: 1200 }}` 硬编码
- 销售订单列：约 30 列，每列均显式 `width`，其它页面有的全列不写宽度（导致列折叠）
- 报价单整改前 `scroll.x` 反复手调

**改进建议**：建立 `tableWidth.ts` 常量（`CODE_COL_W=200`、`DATETIME_COL_W=160`、`MONEY_COL_W=140`、`STATUS_COL_W=100`、`ACTION_COL_W=180`）；`UniTable` 根据列定义自动汇总 `scroll.x`。

#### G-23 表格 `bordered` / `size` 不统一

`BaseReport.tsx` 强制 `bordered`，主单据页一般无边框；`reports/*` 多数 `bordered` + `size="small"`，但 `inventory-report/index.tsx` 又是 `size="middle"`。

**改进建议**：`UniTable` 默认 `size="middle"`、报表场景 `size="small"`，由 `variant?: 'list'|'report'` prop 决定，不允许页面级再覆盖。

---

## 三、按页面归类的差距摘要（典型样本）

| 页面 | 主要差距（按本报告条目编号） |
|---|---|
| `sales-management/sales-orders` | **基线参考**；少量遗留 hex 颜色（G-6） |
| `sales-management/quotations` | G-1（i18n 局部）/ G-4 / G-5 / G-6 / G-15 |
| `sales-management/sales-returns` | G-1 / G-7 / G-8 / G-9 |
| `sales-management/sales-forecasts` | G-4 / G-9 / G-13 |
| `sales-management/customer-follow-ups` | G-1 / G-17 |
| `sales-management/shipment-notices` | G-8 / G-17 |
| `sales-management/dashboard` | G-1 / G-6 / G-20 |
| `sales-management/reports/*` | **G-15 / G-22 / G-23**（BaseReport 是模板根因） |
| `purchase-management/purchase-orders` | G-1 / G-2 / G-6 / G-9 / G-12 |
| `purchase-management/purchase-requisitions` | G-1 / G-3 / G-12 |
| `purchase-management/receipt-notices` | G-1 / G-8 |
| `purchase-management/purchase-returns` | G-1 / G-4 |
| `plan-management/demand-management` | G-1 / G-3 / G-12 |
| `plan-management/demand-computation` | G-1 / G-6 / G-12 |
| `plan-management/production-plans` | G-1 / G-12 |
| `plan-management/scheduling` | G-1 / G-14（用 ahooks） |
| `production-execution/work-orders` | G-1 / G-2 / G-3 / G-6 / G-12 |
| `production-execution/outsource-orders` | G-1 / G-2 / G-10 |
| `production-execution/outsource-work-orders` | G-1 / G-2 |
| `production-execution/reporting` | G-1 / G-2 / G-12 / G-17 |
| `production-execution/rework-orders` | G-1 |
| `production-execution/quality-exceptions / material-shortage / delivery-delay-*` | G-1 / G-12 |
| `production-execution/exception-process` | G-1 / G-12 |
| `production-execution/dashboard` | G-1 / G-6 / G-20 |
| `quality-management/incoming/process/finished-inspection` | G-1 / G-2 / G-10 / G-12 |
| `quality-management/inspection-plans` | G-1 |
| `quality-management/traceability` | G-1 / G-17 |
| `quality-management/inspection-center` | G-17（直接 `message`） |
| `quality-management/reports/*` | G-15 / G-22 / G-23 |
| `equipment-management/equipment` | G-1 / G-3 / G-10 |
| `equipment-management/equipment-status` | **G-5 / G-14 / G-18 / G-1** |
| `equipment-management/molds / tool-ledger / maintenance-*` | G-1 / G-10 |
| `equipment-management/dashboard` | G-1 / G-20 |
| `equipment-management/reports/*` | G-15 / G-22 |
| `warehouse-management/inbound / outbound` | G-1 / G-12 |
| `warehouse-management/delivery-notes` | G-2 / G-12 |
| `warehouse-management/initial-data` | G-1 局部良好；G-12 |
| `warehouse-management/material-borrows / returns / other-*` | G-1 / G-12 |
| `warehouse-management/dashboard` | G-1 / G-17 / G-20 |
| `warehouse-management/reports/*` | G-15 / G-22 |
| `cost-management/production-cost` | **G-19**（PageContainer）/ G-1 / G-9 |
| `cost-management/cost-rules / cost-calculations` | G-1 / G-7 |
| `performance/holidays / skills / kpi / piece-rates / hourly-rates / employee-configs / summaries` | G-1 / G-7 |
| `performance/reports/*` | G-15 / G-22 |
| `analysis-center/document-timing` | G-1 |
| `reports/quality-report / inventory-report / production-report` | **G-15 / G-22 / G-23**（与模块内 reports/* 不一致，存在两套实现） |

---

## 四、规范化改造路线图（建议 2~3 个 sprint 落地）

### Sprint 1：基础设施沉淀（不动业务逻辑）

| Task | 影响范围 | 风险 |
|---|---|---|
| 抽 `useDocumentTrackingChainOverlay()` Hook（覆盖 G-2） | 40+ 详情页 | 低 |
| 收敛 `renderRowActionsOverflow` 单一入口（G-3） | 跨 kuaizhizao + 系统模块 | 低 |
| 抽 `descriptionsFromProColumns`（G-10） | 12+ 页面 | 低 |
| 抽 `tableWidth.ts` + `UniTable.scrollAuto`（G-22） | 全部表格 | 低 |
| 抽 `KpiHeroCard`（G-20） | 5 个 dashboard | 低 |
| `confirmAction()` 与 `successToast/errorToast`（G-12 / G-17） | 全部 | 低 |

### Sprint 2：状态/审核/金额一致化

| Task | 影响范围 | 风险 |
|---|---|---|
| `useDocumentReviewGate` + 删除字面量审核字符串（G-4） | 所有有审核的单据 | 中（需回归测试） |
| `useStatusToken(scene, status)`（G-5） | 状态展示页 | 中 |
| `AmountDisplay` 全量覆盖（G-9） | 采购/委外/成本/仓储 | 中（涉及权限） |
| `ListPageTemplate` 强制壳（G-18 / G-19） | equipment-status / cost | 低 |

### Sprint 3：i18n 与可访问性补齐

| Task | 影响范围 | 风险 |
|---|---|---|
| 新增 `app.kuaizhizao.common.*` namespace（G-1） | 所有页面 | 低 |
| 按模块逐目录引入 `no-literal-string` lint（G-1） | 全量 | 低（白名单灰度） |
| 所有报表统一 `UniTable.showExportButton`（G-15） | 报表 30+ 页 | 低 |
| 路由统一 `ROUTES`（G-16） | 全量 | 低 |
| `useQuery refetchInterval` 替换 `setInterval`（G-14） | equipment-status / 部分 dashboard | 低 |

---

## 五、衡量指标

完成上述改造后，建议以以下指标量化"前端规范度"：

| 指标 | 目标值 | 当前值（抽样估算） |
|---|---|---|
| 平均每页 `t()` 调用 / 页面字面量字数 | ≥ 60% | ≈ 25% |
| 直接 `message` 命名导入数 | 0 | 16 |
| 直接 `<Modal>` 使用数 | < 10 | 90+ |
| 重复 `*_DETAIL_CHAIN_FLOAT_MARGIN` 定义数 | 1 | 40+ |
| `renderRowActionsOverflow` 引用路径数 | 1 | 2 |
| `columnPersistenceId` 缺失的 `UniTable` 数 | 0 | 5 ~ 8 |
| `AmountDisplay` 漏包的金额列数 | 0 | 30+ |
| 直接 hex 颜色 `style={{ color:'#...' }}` 出现数 | < 10 | 110+ |
| 不通过 `ListPageTemplate` 渲染的主页面数 | ≤ dashboard 例外 | equipment-status 等 5+ |

---

## 六、附：与既有"功能完整性报告"的关系

本报告与 `kuaizhizao-gap-report-2026-05-04.md` 互补：

- 前者关注**业务能力**（链路是否打通、按钮是否真生效、有没有占位 TODO）。
- 本报告关注**实现规范**（同样的能力是否用同一种方式实现、UI/i18n/状态机是否一致）。

两份报告中重复出现的页面（如 `equipment-status` 既"实时状态字段不全"也"卡片样式不规范"），建议合并为一个改造卡片同时治理，避免二次改动。
