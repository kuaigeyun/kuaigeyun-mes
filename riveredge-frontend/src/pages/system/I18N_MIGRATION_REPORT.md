# 平台级与系统级 i18n 迁移检查报告

> 检查范围：平台级（布局/登录/个人/入口）、系统级（`src/pages/system/**`）、共享组件  
> 更新：基于当前代码库总体检查与查漏补缺

---

## 总体检查摘要

| 范围 | 已接入 useTranslation | 未接入 / 待补全 | 说明 |
|------|------------------------|------------------|------|
| **平台级** | 布局 BasicLayout、infra 登录/租户/管理/运维/监控、部分组件 | 主登录页 `pages/login`、个人中心 tasks/messages/preferences、初始化/锁屏、app.tsx | 布局已用 t，但仍有大量中文硬编码需逐项替换 |
| **系统级** | 约 45+ 个文件（见下表） | 业务配置、数据连接、审批列表/实例、数据集、设备/模具/保养/报表、工作时间、使用分析/启动进度/操作指南/数据质量/onboarding/角色场景、部分 card-view/design | 多数列表与主流程已迁移 |
| **共享组件** | uni-tabs、schema-form、mobile-preview 等部分 | uni-table、uni-import、uni-dropdown、layout-templates、theme-editor、quick-entry 等 | 组件内中文影响所有引用页 |

**查漏补缺建议**：优先补「平台级」主登录与个人中心、BasicLayout 内残留中文；其次补系统级未接入列表页与卡片/设计器；最后按需补共享组件与业务应用（kuaizhizao、master-data、kuaireport）。

---

## 一、已接入 useTranslation 的页面（系统级，约 45+ 文件）

以下页面已引入 `useTranslation`，部分仍存在中文硬编码，需补全 `t()` 替换。

| 模块 | 文件 | 说明 |
|------|------|------|
| 系统参数 | `system-parameters/index.tsx`, `system-parameters/list/index.tsx` | 已有 `pages.system.parameters.*` 键，迁移较完整 |
| 审批流程设计器 | `approval-processes/designer/index.tsx` | 已用 t() |
| 数据字典 | `data-dictionaries/list/index.tsx`, `data-dictionaries/components/DataDictionaryFormModal.tsx` | **已迁移**：仅剩 console.error 开发用，可不做 i18n |
| 权限管理 | `permissions/list/index.tsx` | 已用 t() |
| 账户管理 | `users/list/index.tsx` | 已用 t()，部分文案用 field.user.* |
| 定时任务 | `scheduled-tasks/list/index.tsx` | 已用 t() |
| 操作日志 | `operation-logs/index.tsx` | **已迁移**：列标题、统计卡片、模块映射、错误提示等均已改为 t() |
| 登录日志 | `login-logs/index.tsx` | **已迁移**：统计/列表/详情/导出/刷新等均已改为 t() |
| 在线用户 | `online-users/index.tsx`, `online-users/card-view.tsx` | **已迁移**：状态、统计、卡片、详情、强制下线等均已改为 t() |
| 应用中心 | `applications/list/index.tsx` | **已迁移**：安装/卸载/启用、菜单同步、应用设置/升版、表格与详情等均已改为 t() |
| 站点设置 | `site-settings/index.tsx` | **已迁移**：基本信息/功能设置、Logo、表单标签与提示、保存/刷新等均已改为 t() |
| 消息配置 | `messages/config/index.tsx` | **已迁移**：列表/详情/表单、测试弹窗、SMTP与短信配置、导出/批量删除等均已改为 t() |
| 消息模板 | `messages/template/index.tsx` | **已迁移**：列表/详情/表单、变量声明、导出/批量删除等均已改为 t() |
| 菜单管理 | `menus/index.tsx` | **已补全**：加载/删除/批量删除、列标题（菜单名称/路径/图标/组件/排序/状态/来源等）、确定删除等均已改为 t() |
| 角色管理 | `roles/list/index.tsx`, `roles/components/RoleFormModal.tsx` | 已用 t() |
| 自定义字段 | `custom-fields/list/index.tsx` | **已补全**：关联字段选项（getTableFieldOptions）、选项示例文案（选项1/选项2）均已改为 t() |
| 配置中心 | `config-center/index.tsx` | **已迁移**：参数分类、业务蓝图、配置模板弹窗、分类与参数名称/描述等均已改为 t() |
| 编码规则 | `code-rules/list/index.tsx` | **已迁移**：列表/配置表单、提示、保存/更新/创建消息、序号与启用等均已改为 t() |
| Inngest | `inngest/index.tsx` | **已迁移**：页面标题已改为 t() |
| 数据备份 | `data-backups/index.tsx` | **已迁移**：统计卡片、表格/卡片/详情、创建/恢复/删除/下载、导出等均已改为 t() |
| 文件管理 | `files/list/index.tsx` | **已迁移**：面包屑/树、上传/新建/删除、排序/视图、表格列、右键菜单、弹窗与提示等均已改为 t() |
| 打印模板 | `print-templates/list/index.tsx` | **已迁移**：统计/表格/卡片/详情、新建/编辑/渲染/删除、表单与弹窗等均已改为 t() |
| 打印设备 | `print-devices/list/index.tsx` | **已迁移**：统计卡片、表格/卡片/详情、新建/编辑/删除、测试连接与执行打印弹窗、表单与消息等均已改为 t() |
| 接口管理 | `apis/list/index.tsx` | **已迁移**：列表列、新建/编辑/删除/测试、表单与详情、接口测试 Drawer、导入/导出消息等均已改为 t() |
| 数据源 | `data-sources/list/index.tsx`, `card-view.tsx`, `DataSourceConnectorMarket.tsx` | **已迁移**：list 统计/表格/卡片/详情/表单/批量操作；card-view 统计/卡片/详情与测试弹窗；连接器市场标题/分类/搜索/空态 |
| 部门管理 | `departments/list/index.tsx`, `departments/components/DepartmentFormModal.tsx` | 已用 t() |
| 语言管理 | `languages/list/index.tsx` | 已用 t() |
| 邀请码 | `invitation-codes/list/index.tsx`, `invitation-codes/components/InvitationCodeFormModal.tsx` | 已用 t() |
| 职位管理 | `positions/list/index.tsx`, `positions/components/PositionFormModal.tsx` | 已用 t() |
| 角色权限 | `roles-permissions/index.tsx` | 已用 t() |
| 工作台 | `dashboard/index.tsx`, `dashboard/analysis.tsx` | **已迁移**：index 问候语/TIPS/统计/待办/消息/播报/快捷操作；analysis 页标题、关键指标、图表、热销排行、目标进度等均已改为 t() |

---

## 二、未接入 useTranslation 的页面（系统级，待迁移）

以下为**尚未**引入 `useTranslation` 或仅部分接入的系统模块，界面中文为硬编码。

| 模块 | 典型文件 | 说明 |
|------|----------|------|
| 业务配置 | `business-config/index.tsx`, `BusinessFlowConfig.tsx` | 大量表单与流程配置文案 |
| 应用连接器 | `application-connections/list/index.tsx`, `connectors.tsx` 等 | 列表与连接器定义 |
| 审批流程列表/实例 | `approval-processes/list/index.tsx`, `instances/index.tsx`, `kanban-view.tsx` | 列表、看板、实例操作 |
| 数据连接 | `integration-configs/list/index.tsx`, `card-view.tsx`, `ConnectionWizard.tsx` | 列表、卡片、向导 |
| 数据集 | `datasets/list/index.tsx`, `designer/index.tsx` | 列表与设计器 |
| 设备/故障/保养/模具 | `equipment/list`, `equipment-faults/list`, `maintenance-plans/list`, `molds/list`, `equipment/trace` | 各列表与追溯页 |
| 报表模板 | `report-templates/index.tsx`, `design/index.tsx` | 列表与设计器 |
| 工作时间配置 | `working-hours-configs/index.tsx` | 配置表单 |
| 使用分析/启动进度/操作指南/数据质量/onboarding/角色场景 | `usage-analysis`, `launch-progress`, `operation-guide`, `data-quality`, `onboarding-wizard`, `role-scenarios` | 各单页文案 |
| 系统参数分组表单 | `system-parameters/grouped-form-view.tsx` | 可与 parameters 共用键 |
| 打印/数据备份/打印模板 卡片与设计器 | `print-devices/card-view.tsx`, `data-backups/card-view.tsx`, `print-templates/card-view.tsx`, `print-templates/design` | 卡片视图与设计器子页 |

---

## 平台级迁移情况（查漏补缺）

| 路径 | useTranslation | 说明 |
|------|----------------|------|
| `src/layouts/BasicLayout.tsx` | ✅ 已接入 | 使用 useSafeTranslation，菜单等依赖 menuTranslation；**仍有大量中文**（消息、下拉、面包屑、设置等），需逐段改为 t() |
| `src/pages/login/index.tsx` | ❌ 未接入 | 主应用登录页，中文量多，**建议优先迁移** |
| `src/pages/infra/login.tsx` | ✅ 已接入 | 基础设施登录 |
| `src/pages/personal/*` (tasks, messages, preferences) | ❌ 未接入 | 个人任务、消息、偏好设置 |
| `src/pages/init/*` (template-select 等) | ❌ 未接入 | 初始化/模板选择 |
| `src/pages/lock-screen/index.tsx` | ❌ 未接入 | 锁屏页 |
| `src/app.tsx` | ❌ 未接入 | 根组件内若有用户可见文案需改为 t() |
| `src/routes/*` | 视具体文案 | 路由标题等若硬编码需用 t() |
| `src/pages/infra/*` (tenants, admin, packages, operation, monitoring) | ✅ 已接入 | 已使用 useTranslation |

**平台级查漏补缺**：优先做 `pages/login`（主登录）、`BasicLayout` 内顶部栏/消息/设置/面包屑等残留中文；其次 personal、init、lock-screen。

---

## 三、当前 zh-CN 中与系统级相关的键

### 3.1 菜单（menu.system.*）

- 已覆盖：角色、权限、部门、职位、用户、应用中心、菜单、站点设置、配置中心、业务配置、参数设置、数据字典、编码规则、数据连接、语言、自定义字段、文件、接口、数据源、应用连接器、数据集、消息配置/模板、定时任务、审批流程/实例、脚本、打印模板/设备、操作日志、登录日志、在线用户、数据备份、角色权限、数据中心、流程管理、应用/系统菜单及提示等。

### 3.2 通用操作（pages.system.*）

- `pages.system.create`：新建  
- `pages.system.batchDelete`：批量删除  
- `pages.system.deleteSuccess` / `deleteFailed`：删除成功/失败  
- `pages.system.updateSuccess` / `createSuccess`：更新/创建成功  
- `pages.system.selectFirst`：请先选择要删除的记录  
- `pages.system.importDeveloping` / `exportDeveloping`：导入/导出功能开发中  

### 3.3 系统参数页（pages.system.parameters.*）

- 标题、描述、安全与会话（Token 检查间隔、不活动超时、用户缓存时间）、界面与交互（标签页数、每页条数、加载延迟、主题色）、网络与系统（超时、重试次数）、保存成功/失败/提示等均已配置。

### 3.4 其他已存在的 field 键

- `field.customField.*`：自定义字段  
- `field.user.*`：用户相关（账户管理等多处使用）  
- `field.systemParameter.*`：系统参数  

---

## 四、迁移状态汇总

| 状态 | 范围 | 说明 |
|------|------|------|
| **已接入且已迁移** | 系统级 40+ 文件 | 工作台、操作/登录日志、在线用户、应用中心、站点/消息配置与模板、菜单、数据字典、配置中心、编码规则、脚本、数据备份、文件、打印模板/设备、接口、数据源（含 card-view、连接器市场）、部门/职位/角色/权限/用户/邀请码/语言、自定义字段、Inngest 等 |
| **已接入待补全** | 布局、部分组件 | BasicLayout 内消息/设置/面包屑等；部分已接入页可能仍有零散中文 |
| **未接入** | 平台级 4 处 + 系统级 12 类 | 平台：主登录、个人中心、初始化、锁屏；系统：业务配置、数据连接、审批列表实例、数据集、设备/模具/保养/报表、工作时间、使用分析等单页、部分 card-view/design |

**结论**：系统级核心列表与配置页多数已完成 i18n；剩余以业务配置、数据连接、审批/数据集/设备/报表及各类单页为主。平台级主登录与 BasicLayout 残留中文建议优先查漏补缺。

---

## 五、查漏补缺与迁移优先级

1. **平台级优先（查漏补缺）**  
   - **主登录** `pages/login/index.tsx`：未接入，优先接入并替换登录/注册/错误文案。  
   - **BasicLayout**：已接入，逐段排查消息中心、用户下拉、设置、面包屑、全屏/锁屏等，将残留中文改为 `t()`。  
   - 个人中心 `personal/tasks|messages|preferences`、初始化 `init`、锁屏 `lock-screen`：未接入，按需迁移。

2. **系统级未接入（按优先级）**  
   - **高**：数据连接 `integration-configs`（列表+向导）、审批流程列表与实例、业务配置。  
   - **中**：数据集列表与设计器、设备/故障/保养/模具、报表模板、工作时间配置。  
   - **低**：使用分析、启动进度、操作指南、数据质量、onboarding、角色场景；各 card-view/design 子页。

3. **共享组件与业务应用**  
   - 组件：uni-table、uni-import、uni-dropdown、ListPageTemplate、theme-editor、quick-entry 等若有用户可见中文，可统一加 t() 或通过 props 传入文案。  
   - 业务应用（kuaizhizao、master-data、kuaireport）：按各应用迭代计划迁移，与系统级可并行。

---

## 六、单页迁移步骤建议

1. 在页面中 `import { useTranslation } from 'react-i18next'`，组件内 `const { t } = useTranslation()`。  
2. 在 `zh-CN.ts`（及 `en-US.ts`）中为该页增加命名空间，如 `pages.system.operationLogs.*`。  
3. 将界面中文（标题、列名、按钮、提示、错误信息等）改为 `t('key')`。  
4. 若有下拉/映射（如操作类型、模块名），用当前语言键或 `t()` 生成选项。  
5. 跑一遍页面与列表/筛选/详情，确认无遗漏中文。

如需从某一具体模块开始迁移，可指定模块名（如「先做操作日志」），再按上述步骤细化到键名与替换清单。
