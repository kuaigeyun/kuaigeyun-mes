# 应用分层契约

> Agent 注册清单：`.cursor/skills/application-layer/SKILL.md`（优先）  
> 真源：应用中心 Tab 顺序 **基础 → 专业 → 行业 → 定制**、manifest `market_category` / `is_dedicated` / `industry_extensions`  
> 配套：`.custom/<客户>/` 实施文档（可写客户名）；产品代码与平台更新日志禁止客户公司名

## 应用中心顺序

| 顺序 | Tab | 定位摘要 |
|------|-----|----------|
| 1 | 基础 | 官方通用 APP，主仓免费 |
| 2 | 专业 | 官方通用 APP，与基础同族，仅 License 收费 |
| 3 | 行业 | 按行业特性启用的小场景插件 |
| 4 | 定制 | 按客户需求组织菜单 / 插件 / 完全自定义页面 |

基础与专业必须相邻展示：二者都是官方通用能力，差异仅为免费 vs 收费许可。

## 四层定位

| 层 | 典型应用 | 定位 | 开通 | 允许 | 禁止 |
|---|---|---|---|---|---|
| **基础** | 快制造、主数据、快质量、快设备 | 多数制造业共用的单据、主数据、引擎；**应收应付等财务管理菜单归属快制造** | 主仓开源默认 `PRO_ENABLED=0` | 中性菜单/字段/API；扩展点空壳 | 行业名称；客户名；compile-time import 专业/行业包 |
| **专业** | 快交付、快研发、轻财务、轻办公、快报表、快物联、KU-AI、数据中心 | **与基础同族或平台高级能力**，仅 License + 私仓 compose | `kuaigeyun-pro` + License Key | 通用高级功能 | 承载行业场景或客户流程；与基础做第二套单据 |
| **行业** | 电子/模具/继电器等场景插件 | 换行业后该**场景本身无意义** | 私仓 compose；全部需 License | 小入口 + 预置字典/附件/看板；只填 `industry_extensions` | 复制审批/消息/打印/编码；整厂 OA；客户组织会签 |
| **定制** | 租户绑定专用应用 | **整合层**：基础 + 行业小插件 + 本客户全定制 | 平台绑定租户后可见 | 依赖声明、客户 profile、聚合菜单 | 再造引擎；把客户流程写回基础或行业默认 |

## 判定三问

对每个字段、菜单、种子、对照入口只进一层：

1. 多数制造业都需要？→ **基础**（或同能力进 **专业** 仅因许可）。
2. 换行业后该场景无意义？→ **行业小插件**。
3. 只有这家客户的组织、表单、清单、会签？→ **定制**。

禁止第四条路：把 2+3 揉进行业包，或在基础菜单/宿主页写死行业名。

## 扩展点（唯一引擎路径）

行业插件与定制应用均通过 manifest `industry_extensions` 声明，由 `IndustryExtensionRuntimeService` 启停：

| kind | strategy | 行为 |
|---|---|---|
| `replace` | `profile` | 写入租户 `industry.ext.{profile_key}`，宿主仍为快研发/快制造原菜单 |
| `replace` | `document` | 宿主 path 不变，FE 解析到扩展页 |
| `standalone` | — | 模块内种子（模板、清单、看板配置等） |

**禁止**在基础应用代码中 `import` 行业或定制应用；宿主只读 core 提供的扩展摘要与 `host-capabilities` API。

## 基础应用自检

- 页面/服务无 `ind-electronics`、`funide-oa` 等 compile-time import。
- 对照/清单按钮仅在 core 摘要显示对应 capability 时出现。
- 未装任何扩展模块时，样品/BOM/ECN 等为 [`industry_document_profiles.py`](../../riveredge-backend/src/core/config/industry_document_profiles.py) 中性默认。

## 专业应用

与基础相同的产品纪律；差异仅为 `is_pro` / License。不得用专业层替代行业或定制。

## 行业插件

- 出现在应用中心「行业」分类及侧栏「行业包」壳（`industry-pack`）。
- 菜单宜短：独立场景入口 + document 替代项；不承担整厂流程。

## 定制应用

- `is_dedicated: true` 或 `market_category: "dedicated"`。
- 未绑定租户：扫描注册时跳过，应用中心不可见。
- 可声明 `industry_extensions`（与行业插件共用运行时）；侧栏走自有 `menu_config`，不挂行业包壳。
- `hide_required_app_menus: true`：启用后按 `application_uuid` 抑制 `requires_apps`（含闭包）、`industry-pack`，以及同租户其它已安装业务应用整棵侧栏；系统应用与基础设施菜单除外。依赖宿主仍安装；**定制侧栏 `menu_config.path` 须落在 `/apps/{dedicated}/...`**，页文件在定制包内；**REST / 表 / 权限码仍走宿主**（定制页 import 宿主 service、`useResourcePermissions` 用宿主 resource）。未绑定定制的租户继续使用宿主页 URL。core 不写死客户应用名。

## 仓库归属（部署）

| 层 | 仓库 | 组装方式 |
|---|---|---|
| 基础 + 行业免费场景 | 主仓 `riveredge` | 随主仓发布 |
| 专业 | 私仓 `kuaigeyun-pro` | `PRO_ENABLED=1` → compose |
| 定制 | 私仓 `kuaigeyun-custom` | `CUSTOM_ENABLED=1` + **`CUSTOM_PROJECTS`**（见 `projects/registry.yaml`） |

禁止将定制仓全量 compose 到所有客户环境。部署脚本只组装 `CUSTOM_PROJECTS` 列出的项目；租户侧可见性由 `core_application_dedicated_bindings` 另行控制。
