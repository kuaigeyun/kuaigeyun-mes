# 平台级与系统级 i18n 迁移检查报告

> 检查范围：平台级（布局/登录/个人/入口）、系统级（`src/pages/system/**`）、共享组件  
> 更新：基于当前代码库总体检查与查漏补缺  
> **检查日期**：2025-02-28

---

## 总体检查摘要

| 范围 | 已接入 useTranslation | 未接入 / 待补全 | 说明 |
|------|------------------------|------------------|------|
| **平台级** | 布局 BasicLayout、infra 登录/租户/管理/运维/监控、部分组件 | 主登录页 `pages/login`、个人中心 tasks/messages/preferences、初始化/锁屏、app.tsx | 布局已用 t，但仍有大量中文硬编码需逐项替换 |
| **系统级** | 66 个 .tsx 文件 | 6 个文件未接入；约 30+ 个已接入文件仍有中文硬编码 | 多数列表与主流程已迁移，设备/模具/故障/应用连接器/打印模板等 P1 已补全 |
| **共享组件** | uni-tabs、schema-form、mobile-preview 等部分 | uni-table、uni-import、uni-dropdown、layout-templates、theme-editor、quick-entry 等 | 组件内中文影响所有引用页 |

**locale 键校验**：`zh-CN.ts` 含 2127 个 `pages.system.*` 键，`en-US.ts` 含 2126 个，中英文键基本一致。

**查漏补缺建议**：优先补「平台级」主登录与个人中心、BasicLayout 内残留中文；其次补系统级未接入页面（onboarding-wizard、AppConnectorMarket、print-templates/card-view 等）；最后补已接入但硬编码多的页面（equipment、molds、application-connections 等）。

---

## 一、已接入 useTranslation 的页面（系统级，66 个文件）

以下 66 个 .tsx 文件已引入 `useTranslation`，部分仍存在中文硬编码，需补全 `t()` 替换。完整列表见 grep `useTranslation|useSafeTranslation` 于 `src/pages/system/**/*.tsx`。

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
| 编码规则 | `code-rules/list/index.tsx` | **已迁移**：列表/配置表单、提示、保存/更新/创建消息、序号与启用、规则名称/描述模板等均已改为 t() |
| Inngest | `inngest/index.tsx` | **已迁移**：页面标题已改为 t() |
| 数据备份 | `data-backups/index.tsx` | **已迁移**：统计卡片、表格/卡片/详情、创建/恢复/删除/下载、导出等均已改为 t() |
| 文件管理 | `files/list/index.tsx` | **已迁移**：面包屑/树、上传/新建/删除、排序/视图、表格列、右键菜单、弹窗与提示等均已改为 t() |
| 打印模板 | `print-templates/list/index.tsx` | **已迁移**：list 页统计/表格/详情、新建/编辑/渲染/删除等；`card-view.tsx` 未接入，见第二节 |
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

以下 6 个文件**尚未**引入 `useTranslation`，界面中文为硬编码（扫描日期：2025-02-28）。

| 文件 | 中文匹配数 | 说明 |
|------|------------|------|
| `application-connections/AppConnectorMarket.tsx` | 7 | 连接器市场弹窗，CATEGORY_LABELS（协作/ERP/PLM/CRM）等硬编码 |
| `application-connections/connectors.tsx` | 76 | 连接器静态定义，名称/描述为中文（飞书、钉钉、企业微信等） |
| `data-sources/connectors.tsx` | 18 | 数据源连接器定义（开源关系型数据库等描述） |
| `business-config/BusinessBlueprintNode.tsx` | 3 | 蓝图节点，label 来自父组件 data，本身无用户可见硬编码 |
| `onboarding-wizard/index.tsx` | 52 | 上线向导，SYSTEM_TAB、ROLE_LIST、错误提示等大量中文 |
| `print-templates/card-view.tsx` | 119 | 打印模板卡片视图，统计、操作按钮、弹窗等大量中文 |

**说明**：`application-connections/list/index.tsx` 已接入 useTranslation，但含 TYPE_DISPLAY 等 144 处中文硬编码，需补全。

---

## 二（续）、已接入但仍有中文硬编码的页面（按匹配数排序）

以下页面已引入 `useTranslation`，但扫描发现仍有较多中文字符，需逐项改为 `t()`。

| 文件 | 中文匹配数 | 典型场景 |
|------|------------|----------|
| `application-connections/list/index.tsx` | ~~144~~ **已迁移** | TYPE_DISPLAY 映射、列名、操作、空态等均已改为 t() |
| `equipment/list/index.tsx` | ~~128~~ **已迁移** | 设备列表、列名、表单、筛选、详情等均已改为 t() |
| `molds/list/index.tsx` | ~~112~~ **已迁移** | 模具列表、列名、表单、详情、类型/状态映射等均已改为 t() |
| `equipment-faults/list/index.tsx` | ~~107~~ **已迁移** | 故障列表、列名、表单、详情、状态映射等均已改为 t() |
| `code-rules/list/index.tsx` | ~~122~~ **已迁移** | 编码规则列表、配置表单、规则名称/描述模板均已改为 t() |
| `equipment/trace/index.tsx` | ~~72~~ **已迁移** | 设备追溯、维护计划/执行、故障/维修、详情等均已改为 t() |
| `launch-progress/index.tsx` | ~~77~~ **已迁移** | 启动进度、检查清单、统计、标签等均已改为 t() |
| `dashboard/index.tsx` | 82 | 工作台（部分可能为注释/变量名） |
| `site-settings/index.tsx` | ~~66~~ **已迁移** | 站点设置表单、货币/日期/语言/时区 fallback 选项均已改为 t() |
| `operation-guide/index.tsx` | ~~63~~ **已迁移** | 操作指南、帮助文档、功能预览、表单等均已改为 t() |
| `maintenance-plans/list/index.tsx` | ~~59~~ **已迁移** | 保养计划列表、详情 Drawer 枚举渲染等均已改为 t() |
| `files/list/index.tsx` | ~~58~~ **已迁移** | 文件管理、路径常量、占位描述等均已改为 t() |
| `approval-processes/designer/index.tsx` | ~~55~~ **已迁移** | 审批流程设计器 |
| `data-quality/index.tsx` | ~~55~~ **已迁移** | 数据质量、验证/清洗/报告、表格列、空态等均已改为 t() |
| `roles-permissions/index.tsx` | 56 | 角色权限 |
| `custom-fields/list/index.tsx` | ~~68~~ **已迁移** | 自定义字段 |
| `print-templates/design/index.tsx` | ~~52~~ **已迁移** | 打印模板设计器 |
| 其他（1–50 处） | 见扫描结果 | 零散遗漏 |

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
| **已接入且已迁移** | 系统级约 40 文件 | 操作/登录日志、在线用户、应用中心、站点/消息配置与模板、菜单、数据字典、配置中心、编码规则、脚本、数据备份、文件、打印模板 list/card-view、打印设备、接口、数据源 list/card-view、应用连接器 list/市场、设备/模具/设备故障、部门/职位/角色/权限/用户/邀请码/语言、Inngest 等 |
| **已接入待补全** | 系统级约 25 文件 + 布局 | 设备追溯、保养计划、审批流程、数据集、报表模板、自定义字段、工作台、站点设置、files、launch-progress、operation-guide、data-quality、roles-permissions 等；BasicLayout 内消息/设置/面包屑 |
| **未接入** | 平台级 4 处 + 系统级 6 文件 | 平台：主登录、个人中心、初始化、锁屏；系统：`AppConnectorMarket.tsx`、`application-connections/connectors.tsx`、`data-sources/connectors.tsx`、`BusinessBlueprintNode.tsx`、`onboarding-wizard/index.tsx`、`print-templates/card-view.tsx` |

**结论**：系统级 77 个 .tsx 中 66 个已接入 useTranslation，6 个未接入；约 30 个已接入页面仍有较多中文硬编码需补全。平台级主登录与 BasicLayout 残留中文建议优先查漏补缺。

---

## 五、查漏补缺与迁移优先级

1. **平台级优先（查漏补缺）**  
   - **主登录** `pages/login/index.tsx`：未接入，优先接入并替换登录/注册/错误文案。  
   - **BasicLayout**：已接入，逐段排查消息中心、用户下拉、设置、面包屑、全屏/锁屏等，将残留中文改为 `t()`。  
   - 个人中心 `personal/tasks|messages|preferences`、初始化 `init`、锁屏 `lock-screen`：未接入，按需迁移。

2. **系统级未接入（P0）**  
   - `onboarding-wizard/index.tsx`（52 处）：上线向导，用户入口高。  
   - `print-templates/card-view.tsx`（119 处）：打印模板卡片视图。  
   - `application-connections/AppConnectorMarket.tsx`（7 处）：连接器市场弹窗。  
   - `application-connections/connectors.tsx`、`data-sources/connectors.tsx`：连接器静态定义，可统一迁移。  
   - `BusinessBlueprintNode.tsx`：label 来自父组件，可选迁移。

3. **系统级已接入待补全（P1–P2）**  
   - **P1**（已完成）：`application-connections/list`、`equipment/list`、`molds/list`、`equipment-faults/list`、`code-rules/list` 均已补全迁移。  
   - **P2**（已完成）：`equipment/trace`、`launch-progress`、`maintenance-plans/list`、`site-settings`、`operation-guide`、`data-quality`、`files/list`、`approval-processes/designer`、`print-templates/design`、`custom-fields/list` 已补全；`dashboard`、`roles-permissions` 已完整迁移。  
   - **P3**：其他 1–50 处匹配的文件。

4. **共享组件与业务应用**  
   - 组件：uni-table、uni-import、uni-dropdown、ListPageTemplate、theme-editor、quick-entry 等若有用户可见中文，可统一加 t() 或通过 props 传入文案。  
   - 业务应用（kuaizhizao、master-data、kuaireport）：按各应用迭代计划迁移，与系统级可并行。

---

## 六、检查方法（2025-02-28 执行）

- **useTranslation 覆盖**：`grep -r "useTranslation|useSafeTranslation" src/pages/system --include="*.tsx"`，得 66 个文件已接入。
- **中文硬编码扫描**：`grep -r "[\u4e00-\u9fff]" src/pages/system --include="*.tsx"` 统计每行匹配数（含注释、字符串、变量名，人工复核时需排除非用户可见文案）。
- **locale 键校验**：`grep "^  'pages\.system\." zh-CN.ts | wc -l` 得 2127，`en-US.ts` 得 2126，键基本一致。
- **未接入判定**：77 个 .tsx 中未出现在 useTranslation 结果内的 6 个文件即为未接入。

---

## 七、单页迁移步骤建议

1. 在页面中 `import { useTranslation } from 'react-i18next'`，组件内 `const { t } = useTranslation()`。  
2. 在 `zh-CN.ts`（及 `en-US.ts`）中为该页增加命名空间，如 `pages.system.operationLogs.*`。  
3. 将界面中文（标题、列名、按钮、提示、错误信息等）改为 `t('key')`。  
4. 若有下拉/映射（如操作类型、模块名），用当前语言键或 `t()` 生成选项。  
5. 跑一遍页面与列表/筛选/详情，确认无遗漏中文。

如需从某一具体模块开始迁移，可指定模块名（如「先做操作日志」），再按上述步骤细化到键名与替换清单。
