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
| 备份一开始失败、error=`read`、UnsupportedOperation | `features/data-backup-csv-dump-newline.md` |
| 备份下载 Connection Failed、ERR_CONNECTION_REFUSED | `features/data-backup-download-same-origin.md` |
| 平台管理员全平台备份、backup_scope=all | `features/data-backup-platform-all-tenants.md` |
| 备份列表卡死、Worker 未知、解压 dump | `features/data-backup-list-no-zip-extract.md` |
| 快数采、kuaiiot、MES 写回、边缘协议、fill_target | `features/kuaiiot-phased-hardening.md` |
| 编码规则、页面配置、testGenerateCode、编号预览慢 | `features/code-rule-page-config-load.md` |
| 设备台账、车间/产线/工位快速新增、UniDropdown.quickCreate | `features/equipment-factory-binding-quick-add.md` |
| 质检方案快速新建、方案类型空白、defaultPlanType | `features/inspection-plan-quick-type-default.md` |
| 构建 dist、deploy、H5、launch.dev、fast-deploy、开机自启 install-service | `features/fast-deploy-scripts.md` |
| APP 转 PRO、compose、财务管理托管、数据中心占位 | `features/app-pro-migration-compose.md` |
| 构建推送、要不要编前端、只改后端怎么推、web/H5/工位选哪条 | `principles/code-push-routing.md` + 规则 `build-push-aoci.mdc` |
| 构建推送前 AOCI、提交前先索引、要不要跑 AOCI、每次 push 是否 maintain | `principles/aoci-git-commit.md` |
| riveredge-app 组装、mklink、工位/TV/小程序私仓 | `features/riveredge-app-client-junctions.md` |
| kuaicaiwu receivable ModuleNotFound、compose 空壳、external_master_data_sync | `features/compose-kuaicaiwu-empty-husk.md` |
| 回显权限、display、reference_resources、预设角色物料回显 | `features/permission-display-echo.md` |
| 选物料 403、仅回显加载物料列表失败、UniMaterialSelect | `features/uni-material-select-reference-display.md` |
| 新建销售订单很慢、进页预拉物料 2000 | `features/sales-order-form-material-preload.md` |
| 角色同步创建职位、职位代码已存在 | `features/role-create-position-reuse-code.md` |
| SOP 配错物料、工序兜底、QC 分域 | `features/sop-shopfloor-match-domain.md` |
| 工作台更新说明、platformUpdateLog、版本卡 | `features/platform-update-log.md` |
| 审核反审核、空壳待审、writeback_failure、revoke_noop | `features/pc-audit-unreview-empty-pending.md` |
| 原路反审、下推下游、销售已出库仍能删报工、出库撤回送货单 | `features/downstream-revoke-delete-original-path.md` |
| 不要做两套、复用、标准入口 | `principles/reuse-existing-patterns.md` |
| 迁移、菜单同步、manifest、权限码 | `principles/feature-delivery.md` |
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
| `principles/feature-delivery.md` | 新功能交付：迁移 + 菜单同步 | 有效 |
| `principles/api-write-protection.md` | API 写防护运维要点 | 有效 |
| `principles/memory-note-format.md` | 记忆库书写与检索约定 | 有效 |
| `principles/aoci-git-commit.md` | AOCI：何时 maintain、提交什么、构建推送顺序 | 有效 |
| `principles/code-push-routing.md` | 代码推送分流：何时只 push、何时构建产物 | 有效 |

### 功能实现

| slug | 标题 | domain | 状态 |
|------|------|--------|------|
| `features/permission-display-echo.md` | 权限回显 display 矩阵与鉴权 | rbac | 已交付 |
| `features/uni-material-select-reference-display.md` | 物料选择器走 reference-display | rbac | 已交付 |
| `features/sales-order-form-material-preload.md` | 销售订单表单物料按需缓存 | master-data-ui | 已交付 |
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
| `features/data-backup-csv-dump-newline.md` | 数据备份 CSV dump 换行探测 | system | 已交付 |
| `features/data-backup-download-same-origin.md` | 备份下载走当前页面 origin | system | 已交付 |
| `features/data-backup-platform-all-tenants.md` | 平台管理员全平台租户备份 | system | 已交付 |
| `features/data-backup-list-no-zip-extract.md` | 备份列表禁止解压 dump | system | 已交付 |
| `features/kuaiiot-phased-hardening.md` | 快数采分阶段硬化 | kuaiiot | 进行中 |
| `features/code-rule-page-config-load.md` | 编码规则页面配置加载 | code-rule | 已交付 |
| `features/equipment-factory-binding-quick-add.md` | 设备台账工厂绑定快速新增 | master-data-ui | 已交付 |
| `features/inspection-plan-quick-type-default.md` | 快速新建质检方案默认锁定类型 | master-data-ui | 已交付 |
| `features/fast-deploy-scripts.md` | fast-deploy 脚本入口 | deploy | 已交付 |
| `features/riveredge-app-client-junctions.md` | 主仓 riveredge-app 联接到私仓终端 | deploy | 已交付 |
| `features/compose-kuaicaiwu-empty-husk.md` | Pro 空壳导致 kuaicaiwu.models 缺失 | deploy | 已交付 |
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
| `features/pc-audit-unreview-empty-pending.md` | PC 审核反审核空壳待审与补齐写回 | approval | 已交付 |
| `features/downstream-revoke-delete-original-path.md` | 下推下游原路反审/删除门禁 | mes-production | 已交付 |

Obsidian 镜像可用 wikilink，Agent 检索请用上表路径，不要只依赖 `[[...]]`。
