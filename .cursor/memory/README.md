# 快格云开发记忆库

供 Agent **先检索、再实现**。同类需求只允许一套标准做法；代码合入后必须在此落笔记。

位置：`.cursor/memory/`（仓库内永久，随 git）。Vault 联接：`E:\AI-Memory\30-Knowledge\MES-Codebase\kuaigeyun-dev-memory`。

## Agent 读取协议（每次开发先做）

MES 改代码时，**先读 Vault 图谱与变更协议**，再用本文件做功能路由。细则：`principles/mes-vault-index.md`。

1. Vault：`E:\AI-Memory\MEMORY.md` → `30-Knowledge/MES-Codebase/architecture-map.md` + `ai-change-protocol.md`
2. **再读本文件**：用下方「关键词路由」对上任务，不要通读全部 features。
3. **打开命中笔记**：只读 `when` 匹配的 1～3 篇。
4. **对齐标准入口**：按笔记里的组件 / API / 扩展点改，禁止平行第二套。
5. **交付后回写**：复制 `features/_TEMPLATE.md` → `features/<slug>.md`，并在本文件索引表加一行。书写细则：`principles/memory-note-format.md`。

Grep 建议：在 `.cursor/memory/` 搜任务里的组件名、权限码、`source_type`、脚本名。frontmatter 的 `keywords` 就是为这次检索准备的。

## 关键词路由

| 任务在说… | 先读 |
|-----------|------|
| **新建 PC 页、新列表、新单据、脚手架、缺新建按钮、showCreateButton、没按规范** | **`principles/new-pc-page-hard-gate.md`** → **`.cursor/skills/new-document-page/SKILL.md`** → AOCI `keyword=new-document-page`；**禁止等用户口头提醒** |
| 工位服务器设置、开发态工单不是设置地址、X-Station-Api-Origin | `features/station-settings-api-origin.md` |
| 工位人脸录入、已录入账号采样、设备设置录脸、触屏专用角色 | `features/station-face-settings-manage.md` |
| 工位指派给我、班组派工、assigned_worker_id 看不到班组工单 | `features/station-assigned-wo-includes-team.md` |
| 工位齐套缺料顶栏叫料、呼叫闪烁、安灯发起呼叫预警 | `features/station-shortage-andon-call.md` |
| 工位工单筛选固定/共享对齐、workOrderQueue | `features/station-wo-queue-shared-filter.md` |
| 交接班摘要全 0、device_info.workstation_id、shift summary | `features/station-shift-handover-summary.md` |
| 工位工时计时、暂停含停机、多次报工翻倍 | `features/station-work-hours-timer.md` |
| 工序暂停与 PC/移动对齐、停机原因码 | `features/station-pause-cross-client.md` |
| 生产入库待入库筛出退料、待退料混入 | `features/inbound-hub-pending-excludes-returns.md` |
| 返工单起始工序不显示、返工报工起始工序 | `features/rework-order-start-operation-display.md` |
| 生产工单二次拆分、列表看不到子单、拆分子单进度串、拆分完工进度 0% | `features/work-order-nested-split-list-tree.md` |
| 追溯报告导出、Maximum call stack、桑基图爆栈、快制造应用加载错误 | `features/traceability-sankey-stack-overflow.md` |
| 工位字被裁、看不清、ellipsis、中区滚不动 | `features/station-hmi-info-visibility.md` |
| 移动端 S2 门禁、代报 assign、仓储 confirm、tokenRefresh 误登出 | `features/mobile-v2-s2-contract-fixes.md` |
| 三仓、跨端落点、client/pro 真源、Junction | `principles/three-repo-map.md` |
| AOCI MCP 三仓、aoci-client、aoci-pro | `features/aoci-mcp-three-repos.md` |
| 架构、调用链、D/E 边界、PC/Mobile/Station | `principles/mes-vault-index.md` → Vault `architecture-map.md` |
| 即时库存同步、batch_no 非空、无批号 | `features/inventory-sync-empty-batch-no.md` |
| 同步/推送 Hub、外推、DocumentPush、preferIds、`:sync` / `:push` | `features/sync-push-hub-master-data.md` |
| SyncFromSource、多源映射、只补缺字段、match_key 合并 | `features/sync-from-source-multi-source-merge.md` |
| 通知仓库 504、服务器暂时不可用、NestedTransaction 死锁 | `features/notify-warehouse-nested-tx-deadlock.md` |
| 单位/物料同步串扰、单位写成物料编码、query_measureunits | `features/unit-material-sync-decouple.md` |
| 单位显示成编码、库存/工单见吨(T)、MaterialUnitLabel、单位名称 | `features/material-unit-display-name.md` |
| 来源类型转换没生效、FErpClsID、source_type 仍 Buy | `features/sync-material-source-type-conversion.md` |
| BOM 自制件下拉空、mainMaterialScope make 找不到 | `features/bom-main-material-make-scope.md` |
| 物料分组空拉、BD_MATERIALGROUP、FormId 名对体错 | `features/sync-material-group-empty-pull.md` |
| entry / FEntity、嵌套明细摊平、`normalizeApiBodyToRows` | `features/sync-from-source-nested-detail-expand.md` |
| BOM `line_key`、父件+子件匹配键 | `features/sync-bom-line-key-derived.md` |
| 苍穹增量、水位、无变更跳过、batchQuery | `features/sync-from-source-cosmic-incremental.md` |
| 仓库列表、createorg_number、苍穹组织编码 | `features/cosmic-warehouse-createorg.md` |
| 导入 limit 2000、物料列表 le、采购订单 Excel | `features/list-api-import-limit.md` |
| 定时任务、Taskiq、缺少 event、租户隔离 | `features/scheduled-task-tenant-isolation-event.md` |
| 数据备份、任务堆积、pending 卡住、reclaim | `features/data-backup-stalled-reclaim.md` |
| 数据备份定时、对象存储落点、保留天数/份数清理 | `features/data-backup-policy-schedule-storage.md` |
| 应用连接器 RustFS、S3 兼容存储、文件/备份落点 | `features/connector-storage-rustfs.md` |
| 系统配置连接管理闪锁定、已启用快连接仍短暂锁 | `features/kuaiconnect-settings-pro-flash.md` |
| 备份一开始失败、error=`read`、UnsupportedOperation | `features/data-backup-csv-dump-newline.md` |
| 备份下载 Connection Failed、ERR_CONNECTION_REFUSED | `features/data-backup-download-same-origin.md` |
| 平台管理员全平台备份、backup_scope=all | `features/data-backup-platform-all-tenants.md` |
| 备份列表卡死、Worker 未知、解压 dump | `features/data-backup-list-no-zip-extract.md` |
| 租户恢复 parent_id、部门树 FK、fk_core_departments_parent_id | `features/tenant-restore-self-fk-nullify.md` |
| 快数采、kuaiiot、MES 写回、边缘协议、fill_target | `features/kuaiiot-phased-hardening.md` |
| 快视觉、kuaivision、视觉入站、检测记录、边缘节点 Token | `features/kuaivision-p0-shell.md` |
| 快视觉边缘、edge-agent、心跳、厚度步骤 POC、bump-config | `features/kuaivision-p2-edge.md` |
| 快视觉样本、模型制品、保留天数、运维告警、promote-sample | `features/kuaivision-p3-governance.md` |
| 编码规则、页面配置、testGenerateCode、编号预览慢 | `features/code-rule-page-config-load.md` |
| 设备台账、车间/产线/工位快速新增、UniDropdown.quickCreate | `features/equipment-factory-binding-quick-add.md` |
| 好力 GO 模具/设备台账批量导出、导出选中 | `features/haoligo-ledger-batch-export.md` |
| 质检方案快速新建、方案类型空白、defaultPlanType | `features/inspection-plan-quick-type-default.md` |
| 委外检验、质量巡检、OSQC、plan_type outsource/patrol | `features/quality-outsource-patrol.md` |
| 图纸气泡标注、drawing_balloon、FAI 导入特性、PRO OCR | `features/drawing-balloon-sheet-pro.md` |
| 定制图纸详情、主文件附加文件、afterBasic、FilePreviewModal | `features/funide-oa-drawing-detail-files-section.md` |
| 客诉 8D、工作台跳系统首页、eight-d-reports/:id、host-mirror | `features/funide-oa-eight-d-workbench-route.md` |
| 研发电子/结构菜单、2D/3D/模具交付物、试验委托 general | `features/funide-oa-rd-electronics-structure-menu.md` |
| 构建 dist、deploy、H5、launch.dev、fast-deploy、开机自启 install-service | `features/fast-deploy-scripts.md` |
| APP 转 PRO、compose、财务管理托管、数据中心占位 | `features/app-pro-migration-compose.md` |
| 应用中心开关慢、启用禁用卡顿、ensure_permissions force | `features/app-enable-disable-perf.md` |
| 侧栏本地生产不一致、菜单接管抢 is_active、财务管理缺分组 | `features/menu-takeover-single-source.md` |
| 菜单同步仍平铺、menu_config 过期、只认后端 manifest | `features/menu-config-disk-manifest-source.md` |
| KU-AI 能力矩阵、调用分析、insights 菜单、hub 加载慢 | `features/kuaiai-insights-in-hub.md` |
| KU-AI 异常感知、Pulse 下线 | `features/kuaiai-pulse-offline.md` |
| KU-AI 信任中心下线 | `features/kuaiai-trust-offline.md` |
| 构建推送、要不要编前端、只改后端怎么推、web/H5/工位选哪条 | `principles/code-push-routing.md` + 规则 `build-push-aoci.mdc` |
| 构建推送前 AOCI、提交前先索引、要不要跑 AOCI、每次 push 是否 maintain | `principles/aoci-git-commit.md` |
| riveredge-app 组装、mklink、工位/TV/小程序私仓 | `features/riveredge-app-client-junctions.md` |
| kuaicaiwu receivable ModuleNotFound、compose 空壳、external_master_data_sync | `features/compose-kuaicaiwu-empty-husk.md` |
| 个性化主题保存后又暗、偏好与标签互相冲掉、jsonb merge | `features/user-preference-atomic-merge.md` |
| 回显权限、display、reference_resources、轻办公人事选人/车间回显、预设角色物料回显 | `features/permission-display-echo.md` |
| 轻办公报销单、费用报销、kuaioa_expense、报销明细 | `features/kuaioa-expense-reimbursement.md` |
| 取单 403、pull-lines 要不要开查看、来源筛选项直调 list | `features/pull-source-display-echo.md` |
| 采购合计取舍、单价 0.195 合计 0.20、DocumentAmountSummary | `features/document-amount-summary-precision.md` |
| 数值精度、数量/单价/金额小数位、0–6、configTree max | `features/numeric-precision-decimal-places-6.md` |
| 往来对账单下推付款申请/采购收票、开票日期 | `features/partner-statement-push-invoice-date.md` |
| 采购收票预览、开票明细、进项发票源单物料 | `features/purchase-invoice-pull-detail-lines.md` |
| 选物料 403、仅回显加载物料列表失败、UniMaterialSelect | `features/uni-material-select-reference-display.md` |
| 建议供应商无搜索、SupplierSelectDropdown、UniDropdown 可搜 | `features/supplier-select-dropdown.md` |
| 客户供应商多收付款账户、settlementAccounts、付款账户 | `features/partner-settlement-accounts.md` |
| 付款申请、采购请款、push_payment_application、可请款占用 | `features/payment-application-procurement.md` |
| 付款单来源单据、打印导出、FINANCE_PAYMENT_PRINT | `features/finance-payment-source-print.md` |
| 付款凭证必传、requirePaymentVoucher、付款申请要求上传凭证 | `features/payment-require-voucher.md` |
| 其他费用收入、其他费用支出、收支类别、other_income | `features/finance-other-misc-vouchers.md` |
| 其他费用应收应付、misc_voucher_finance_bridge、确认收款付款 | `features/finance-other-misc-ar-ap-chain.md` |
| 应付/应收审核要点两遍、流程过了单据仍待审、FinanceService | `features/finance-ar-ap-audit-writeback.md` |
| 新建销售订单很慢、进页预拉物料 2000 | `features/sales-order-form-material-preload.md` |
| 前端慢、进页卡、Top5 菜单性能基线、useDeferAfterPaint | `features/frontend-perf-baseline.md` |
| 销售订单点详情很慢、get_sales_order_by_id 数秒 | `features/sales-order-detail-api-perf.md` |
| 销售订单列表慢、菜单销售订单徽章不显示 | `features/sales-order-list-perf-menu-badge.md` |
| 全链路追踪很慢、附件中心很慢、trace/attachment-center | `features/document-trace-attach-perf.md` |
| 工作台待办、dashboard todos、无权限仍见待办 | `features/dashboard-todo-rbac-filter.md` |
| 开源无专业包崩溃、kuaicaiwu ImportError、销售采购订单列表 500、infra_license_keys、业务蓝图 graph、IKKZ4P、IKL5HM | `features/oss-pro-decouple-startup.md` |
| 设备状态实时、MQTT 无感、external_device_id 绑定、台账 status 联动 | `features/kuaiiot-device-status-realtime.md` |
| 指令设备 ID、command_device_id、清零报文 device_id | `features/iot-line-clear-mqtt.md` + `kuaiiot-device-status-realtime.md` |
| 产线清零、zscl 清 0、发送型 MQTT、command_code t0/c0/z0、报工后自动清零 | `features/iot-line-clear-mqtt.md` |
| 角色同步创建职位、职位代码已存在 | `features/role-create-position-reuse-code.md` |
| SOP 配错物料、工序兜底、QC 分域 | `features/sop-shopfloor-match-domain.md` |
| Modal 点击穿透、portal 冒泡、遮罩点到列表、maskProps | `features/modal-portal-click-isolation.md` |
| 工作台更新说明、platformUpdateLog、版本卡 | `features/platform-update-log.md` |
| 运营看板、参观模式、visit_mode、手填指标 | `features/business-board-visit-mode.md` |
| 简易/加强密码、password_mode、强制改密、站点登录密码策略 | `features/tenant-password-policy.md` |
| 流程造数、操作用户、单项跳过、采购/工单失败继续、工序流转间隔、造数进度条、flow-generate job | `features/flow-data-generate-operator-modes.md` |
| 设备点检造数、保养执行造数、点检单导入 | `features/equipment-ops-data-generate.md` |
| 点检计划已拆除、DJJH、勿再实现计划层、造数改选点检单 | `features/equipment-spot-check-plan.md` |
| 应用初始化缓慢、首次组织引导、消息模板预设、失败重试 | `features/tenant-bootstrap-initialization.md` |
| 保养计划方案真源、设备绑定、维护类型周期 | `features/maintenance-plan-scheme-bind.md` |
| 移动/工位点检跟绑定、保养执行带计划方案 | `features/equip-ops-scheme-bind-clients.md` |
| 审核反审核、空壳待审、writeback_failure、revoke_noop | `features/pc-audit-unreview-empty-pending.md` |
| 终审撤销回到上一级、终审人无审核按钮、撤销应留终审人待办可再审 | `features/audit-revoke-reopen-final-node.md` |
| 采购订单采购员空白、不含税金额不能改、金额单价互算 | `features/purchase-order-buyer-amount-edit.md` |
| 可审人有委托无审核按钮、点审核误报没有权限、列表态未补齐待办、按钮提示待办人仍是上一节点、条件分支未确认就进特批 | `features/audit-hub-approve-button-visible.md` |
| 多级审核第二级要点两次、列表分不清已审未审、待我审核、您已审核 | `features/audit-multilevel-second-click.md` |
| 其他费用收支类别接口不存在、finance-misc-categories | `features/finance-other-misc-vouchers.md` |
| 原路反审、下推下游、销售已出库仍能删报工、出库撤回送货单 | `features/downstream-revoke-delete-original-path.md` |
| 不要做两套、复用、标准入口 | `principles/reuse-existing-patterns.md` |
| 迁移、菜单同步、manifest、权限码、死代码交付自检 | `principles/feature-delivery.md` |
| API 写防护、渠道头、幂等 | `principles/api-write-protection.md` |
| 记忆库怎么写 | `principles/memory-note-format.md` |
| AOCI 提交、aoci.txt、勿排除索引、可跳过 maintain 的情形 | `principles/aoci-git-commit.md` |

## 目录

| 路径 | 用途 |
|------|------|
| `principles/` | 长期原则（Agent 行为 + 可检索摘要） |
| `features/` | 已落地实现：标准入口、关键文件、扩展点、踩坑 |

## 索引

### 原则

| slug | 标题 | 状态 |
|------|------|------|
| `principles/mes-vault-index.md` | MES Vault 入口与源码图谱 | 有效 |
| `principles/three-repo-map.md` | 三仓职责与跨端功能落点 | 有效 |
| `principles/reuse-existing-patterns.md` | 复用优先：同一功能一套标准 | 有效 |
| `principles/new-pc-page-hard-gate.md` | 新建 PC 页：先 Skill + AOCI，UniTable 壳硬门禁 | 有效 |
| `principles/feature-delivery.md` | 新功能交付：迁移 + 菜单同步 | 有效 |
| `principles/api-write-protection.md` | API 写防护运维要点 | 有效 |
| `principles/memory-note-format.md` | 记忆库书写与检索约定 | 有效 |
| `principles/aoci-git-commit.md` | AOCI：何时 maintain、提交什么、构建推送顺序 | 有效 |
| `principles/code-push-routing.md` | 代码推送分流：何时只 push、何时构建产物 | 有效 |

### 功能实现

| slug | 标题 | domain | 状态 |
|------|------|--------|------|
| `features/app-enable-disable-perf.md` | 应用启用/禁用增量权限同步 | core-platform | 已交付 |
| `features/funide-oa-rd-electronics-structure-menu.md` | 定制研发电子/结构菜单 | funide-oa | 已交付 |
| `features/funide-oa-drawing-detail-files-section.md` | 定制工程图纸详情图纸文件板块 | funide-oa | 已交付 |
| `features/funide-oa-eight-d-workbench-route.md` | 客诉 8D 工作台路由须手挂 | funide-oa | 已交付 |
| `features/kuaiai-insights-in-hub.md` | KU-AI 调用分析并入能力矩阵 | kuaiai | 已交付 |
| `features/kuaiai-pulse-offline.md` | KU-AI 异常感知下线 | kuaiai | 已交付 |
| `features/kuaiai-trust-offline.md` | KU-AI 信任中心下线 | kuaiai | 已交付 |
| `features/flow-data-generate-operator-modes.md` | 流程造数步骤操作用户模式 | kuaizhizao-ops | 已交付 |
| `features/equipment-ops-data-generate.md` | 设备点检保养造数与点检单导入 | kuaizhizao-ops | 已交付 |
| `features/equipment-spot-check-plan.md` | 点检计划整层拆除（迁移 887；造数改 spot_check_ids） | kuaizhizao-ops | 已拆除 |
| `features/maintenance-plan-scheme-bind.md` | 保养计划绑定保养方案 | kuaizhizao-ops | 已交付 |
| `features/equip-ops-scheme-bind-clients.md` | 移动/工位点检保养方案绑定对齐 | kuaizhizao-ops | 已交付 |
| `features/user-preference-atomic-merge.md` | 用户偏好 JSON 原子深合并 | system | 已交付 |
| `features/permission-display-echo.md` | 权限回显 display 矩阵与鉴权 | rbac | 已交付 |
| `features/pull-source-display-echo.md` | 取单来源回显（不必开查看） | rbac | 已交付 |
| `features/document-amount-summary-precision.md` | 单据合计金额精度（先乘后舍） | finance-ui | 已交付 |
| `features/numeric-precision-decimal-places-6.md` | 配置中心数值精度 0–6 与库表 scale | platform-config | 已交付 |
| `features/partner-statement-push-invoice-date.md` | 对账单下推请款/收票与开票日期列 | finance-ui | 已交付 |
| `features/purchase-invoice-pull-detail-lines.md` | 收票预览展示源单物料明细 | finance-ui | 已交付 |
| `features/uni-material-select-reference-display.md` | 物料选择器走 reference-display | rbac | 已交付 |
| `features/supplier-select-dropdown.md` | 供应商可搜索下拉 SupplierSelectDropdown | master-data | 已交付 |
| `features/partner-settlement-accounts.md` | 客户/供应商多收付款账户 JSON | master-data | 已交付 |
| `features/sales-order-form-material-preload.md` | 销售订单表单物料按需缓存 | master-data-ui | 已交付 |
| `features/frontend-perf-baseline.md` | 前端性能基线与优化主线 | frontend-perf | 有效 |
| `features/sales-order-detail-api-perf.md` | 销售订单详情接口并行取数 | kuaizhizao-sales | 已交付 |
| `features/sales-order-list-perf-menu-badge.md` | 销售订单列表并行取数与菜单徽章 DataScope | kuaizhizao-sales | 已交付 |
| `features/document-trace-attach-perf.md` | 全链路与附件中心取数加速 | kuaizhizao-trace | 已交付 |
| `features/dashboard-todo-rbac-filter.md` | 工作台待办按单据 :read 过滤 | rbac | 已交付 |
| `features/oss-pro-decouple-startup.md` | 开源仓无专业包可独立启动 | deploy | 已交付 |
| `features/aoci-mcp-three-repos.md` | AOCI MCP 三仓绑定 | tooling | 有效 |
| `features/station-wo-queue-shared-filter.md` | 工位工单队列筛选固定/共享同一套 | mes-station | 已交付 |
| `features/station-shift-handover-summary.md` | 交接班摘要按工位归属与写路径 | mes-station | 已交付 |
| `features/station-work-hours-timer.md` | 工位本次报工工时计时口径 | mes-station | 已交付 |
| `features/station-pause-cross-client.md` | 工序暂停跨端 API/原因码对齐 | mes-station | 已交付 |
| `features/inbound-hub-pending-excludes-returns.md` | 入库 Hub 待入库不含退料退货 | warehouse | 已交付 |
| `features/rework-order-start-operation-display.md` | 返工起始工序列表/报工展示 | mes-production | 已交付 |
| `features/work-order-nested-split-list-tree.md` | 生产工单多级拆分列表树 | mes-production | 已交付 |
| `features/inventory-sync-empty-batch-no.md` | 即时库存同步空批号落空串 | sync-from-source | 已交付 |
| `features/sync-push-hub-master-data.md` | 物料/BOM/工序 SyncPushHub + 外推 | sync-push | 已交付 |
| `features/sync-from-source-multi-source-merge.md` | 入站多源：只补缺字段 + 匹配键合并 | sync-from-source | 已交付 |
| `features/notify-warehouse-nested-tx-deadlock.md` | 通知仓库 Nested 事务死锁修复 | kuaizhizao-warehouse | 已交付 |
| `features/unit-material-sync-decouple.md` | 单位/物料同步别名与写入前去重拆开 | sync-from-source | 已交付 |
| `features/material-unit-display-name.md` | 用户可见单位一律显示目录名称 | materialUnitDisplay / MaterialUnitLabel | 已交付 |
| `features/sync-material-source-type-conversion.md` | 物料来源类型转换依赖 FieldKeys | sync-from-source | 已交付 |
| `features/bom-main-material-make-scope.md` | BOM 主物料自制件下拉须服务端滤 Make | master-data-ui | 已交付 |
| `features/sync-material-group-empty-pull.md` | 物料分组空拉与 FormId/createorg | sync-from-source | 已交付 |
| `features/sync-from-source-nested-detail-expand.md` | 入站同步：嵌套明细统一摊平 | sync-from-source | 已交付 |
| `features/sync-bom-line-key-derived.md` | BOM 匹配键 line_key 由父件+子件派生 | sync-from-source | 已交付 |
| `features/sync-from-source-cosmic-incremental.md` | 入站同步：苍穹增量水位 + 无变更跳过 | sync-from-source | 已交付 |
| `features/cosmic-warehouse-createorg.md` | 苍穹仓库列表自动带 createorg_number | sync-from-source | 已交付 |
| `features/list-api-import-limit.md` | 单据导入物料列表分页不超过 2000 | master-data-ui | 已交付 |
| `features/scheduled-task-tenant-isolation-event.md` | 定时任务执行：租户隔离缺 event | scheduler | 已交付 |
| `features/data-backup-stalled-reclaim.md` | 数据备份堆积回收 | system | 已交付 |
| `features/data-backup-policy-schedule-storage.md` | 数据备份定时/存储/清理策略 | system | 已交付 |
| `features/connector-storage-rustfs.md` | 应用连接器 RustFS 对象存储 | kuaiconnect | 已交付 |
| `features/kuaiconnect-settings-pro-flash.md` | 已启用快连接时系统配置不闪锁定（PRO 常显） | kuaiconnect | 已交付 |
| `features/data-backup-csv-dump-newline.md` | 数据备份 CSV dump 换行探测 | system | 已交付 |
| `features/data-backup-download-same-origin.md` | 备份下载走当前页面 origin | system | 已交付 |
| `features/data-backup-platform-all-tenants.md` | 平台管理员全平台租户备份 | system | 已交付 |
| `features/data-backup-list-no-zip-extract.md` | 备份列表禁止解压 dump | system | 已交付 |
| `features/tenant-restore-self-fk-nullify.md` | 租户恢复自引用 FK 置空 | system | 已交付 |
| `features/kuaiiot-phased-hardening.md` | 快数采分阶段硬化 | kuaiiot | 进行中 |
| `features/kuaivision-p0-shell.md` | 快视觉 P0 壳与入站 | kuaivision | 已交付 |
| `features/kuaivision-p2-edge.md` | 快视觉 P2 Edge 与 POC | kuaivision | 已交付 |
| `features/kuaivision-p3-governance.md` | 快视觉 P3 样本模型运维 | kuaivision | 已交付 |
| `features/kuaiiot-device-status-realtime.md` | 设备连接/台账状态 MQTT 无感刷新 | kuaiiot | 已交付 |
| `features/iot-line-clear-mqtt.md` | 产线 MQTT 清零（接入/发送 + 手动/自动） | kuaiiot | 已交付 |
| `features/code-rule-page-config-load.md` | 编码规则页面配置加载 | code-rule | 已交付 |
| `features/equipment-factory-binding-quick-add.md` | 设备台账工厂绑定快速新增 | master-data-ui | 已交付 |
| `features/haoligo-ledger-batch-export.md` | 好力 GO 模具/设备台账批量导出 | dedicated-haoligo | 已交付 |
| `features/inspection-plan-quick-type-default.md` | 快速新建质检方案默认锁定类型 | master-data-ui | 已交付 |
| `features/quality-outsource-patrol.md` | 委外检验 OSQC 与质量巡检 | quality | 已交付 |
| `features/fast-deploy-scripts.md` | fast-deploy 脚本入口 | deploy | 已交付 |
| `features/riveredge-app-client-junctions.md` | 主仓 riveredge-app 联接到私仓终端 | deploy | 已交付 |
| `features/compose-kuaicaiwu-empty-husk.md` | Pro 空壳导致 kuaicaiwu.models 缺失 | deploy | 已交付 |
| `features/menu-takeover-single-source.md` | 菜单接管只认库内启用，侧栏读路径不写 is_active | system | 已交付 |
| `features/menu-config-disk-manifest-source.md` | 菜单同步只认后端磁盘 manifest 并回写 menu_config | system | 已交付 |
| `features/station-settings-api-origin.md` | 工位 API 走服务器设置 | mes-station | 已交付 |
| `features/station-face-settings-manage.md` | 工位人脸录入与采样管理在设备设置 | mes-station | 已交付 |
| `features/station-assigned-wo-includes-team.md` | 指派给我含班组成员被指派工单 | mes-station | 已交付 |
| `features/station-shortage-andon-call.md` | 齐套缺料预警走底栏呼叫/安灯 | mes-station | 已交付 |
| `features/station-st2-security-contract.md` | 工位 ST2 IPC/刷脸/报工/文档打印契约 | mes-station | 已交付 |
| `features/station-hmi-info-visibility.md` | 工位 HMI 信息可见性 | mes-station | 已交付 |
| `features/mobile-v2-s2-contract-fixes.md` | 移动端第二轮 S2 静态门禁 | mobile | 已交付 |
| `features/role-create-position-reuse-code.md` | 角色同步创建职位遇已有代码则复用 | system | 已交付 |
| `features/sop-shopfloor-match-domain.md` | SOP 现场匹配与分域隔离 | master-data | 已交付 |
| `features/platform-update-log.md` | 平台更新日志每次交付补一条 | system | 有效 |
| `features/business-board-visit-mode.md` | 运营看板参观模式与手填指标 | system | 有效 |
| `features/tenant-password-policy.md` | 租户简易/加强登录密码策略 | core-platform | 有效 |
| `features/pc-audit-unreview-empty-pending.md` | PC 审核反审核空壳待审与补齐写回 | approval | 已交付 |
| `features/audit-revoke-reopen-final-node.md` | 撤销审核重开终审节点待再审 | approval | 已交付 |
| `features/purchase-order-buyer-amount-edit.md` | 采购订单采购员默认与金额单价互算 | mes-purchase | 已交付 |
| `features/modal-portal-click-isolation.md` | Modal Portal 点击不穿透底层 | modal / portal | 已交付 |
| `features/audit-hub-approve-button-visible.md` | 审核弹窗可审人须有审核按钮 | approval | 已交付 |
| `features/audit-multilevel-second-click.md` | 多级审核一次点击，列表待我审核/您已审核 | approval | 已交付 |
| `features/downstream-revoke-delete-original-path.md` | 下推下游原路反审/删除门禁 | mes-production | 已交付 |
| `features/payment-require-voucher.md` | 付款申请要求付款单上传凭证 | finance | 已交付 |
| `features/kuaioa-expense-reimbursement.md` | 轻办公费用报销单与独立审核流 | kuaioa | 已交付 |

Obsidian 镜像可用 wikilink，Agent 检索请用上表路径，不要只依赖 `[[...]]`。
