# 业务配置、蓝图与参数设置逻辑审计报告 (Business Config & Blueprint Audit)

**审计结论**：业务配置模块目前存在“前端硬编码”、“参数空值化”以及“业务模型与后台脱节”的重大风险。蓝图设置仅实现了 UI 菜单的隐藏，而未在业务逻辑与后端接口层面建立实质性的“流量拦截”，导致系统在大负荷与非标准作业下极易出现逻辑崩溃。

---

## 一、 业务蓝图 (Business Blueprint) 逻辑审计

### 1.1 预置模式前端硬编码风险 (Hardcoded Logic Fallacy)
- **问题描述**：所有行业（通用、机械、电子、机加）及规模（小、中、大）的业务蓝图模版完全硬编码在前端组件中。
- **技术证据**：见 `BusinessFlowConfig.tsx` 第 240-789 行：`PRESET_TEMPLATES` 静态定义了 45 个节点的开关状态。
- **业务影响**：**极高维护风险**。当后端新增单据类型或调整业务流时，前端模版无法自动同步，导致新安装的租户看到的“标准蓝图”与实际系统功能产生版本断层。

### 1.2 “灰度隐藏”而非“逻辑切断” (Soft-hiding Fallacy)
- **问题描述**：在蓝图中禁用某个节点（如“销售预测”）仅通过菜单过滤实现，后端 API 并未对禁用节点的请求进行物理拦截。
- **技术证据**：见 `menuBusinessFilter.ts` 第 21-46 行：逻辑仅涉及 `MenuTree` 的过滤。
- **业务影响**：**绕过审计风险**。熟练用户或脚本仍可通过直接请求 URL 或 API 访问已禁用的功能，使得企业的“业务蓝图定制”沦为空谈，无法实现真正的业务边界控制。

---

## 二、 流程/参数设置 (Process & Parameter Settings) 逻辑审计

### 2.1 “幽灵参数”未生效风险 (Phantom Parameter Risk)
- **问题描述**：大量参数（如 `allow_production_without_material`、`quick_reporting` 等）在配置页面存在，但在实际业务模块的代码中完全未被引用。
- **技术证据**：全量搜索 `allow_production_without_material` 结果为 0。在 `sales-orders/index.tsx` 中仅发现了 `audit_enabled` 的引用，其余 20+ 项参数处于“虚无态”。
- **业务影响**：**误导用户决策**。中小企业主认为开启了“允许无料生产”或“快速报工”模式，但实际生产过程中系统逻辑依然生硬，导致配置页面成为“摆设”，极大地损害了产品的严肃性。

### 2.2 参数缺失与中小企业实情脱节 (SME Adaptation Gap)
- **问题描述**：当前参数设置缺乏针对中国中小制造业“灵活、高频、非标”特性的硬性支撑。
- **缺失证据**：
    - **超量入库容差 (Tolerance)**：SME 采购经常有溢价/溢量收货，系统目前仅通过 Boolean 控制开关，缺乏 `百分比容差` 参数。
    - **紧急旁路审核 (Emergency Bypass)**：缺乏针对“特急单”在无图纸/无完整 BOM 时开启“临时工单”的配置开关。
    - **尾差平摊算法选择 (Rounding Options)**：中小型企业对 1 分钱的对账非常敏感，系统缺乏“进一法/舍去法/四舍五入”的全局核算参数。

---

## 三、 中国中小制造业实情适配建议 (SME Adaptation)

1. **蓝图数据化**：必须将 `PRESET_TEMPLATES` 迁移至后端，通过 `/infra/business-config/schema` 统一分发，确保存量逻辑一致性。
2. **参数校验硬化**：针对 `quality` 的 sampling（采样）参数、`warehouse` 的 FIFO 开关，必须在 `create/update` 接口层增加 `ConfigGate` 校验。
3. **补充参数位**：
    - [ ] `purchase_price_range_warning`: 针对 SME 价格波动大的特性，增加价格预警阈值。
    - [ ] `material_shortage_block_level`: 允许 SME 在“严禁开工”与“允许延后领料”之间灵活切换。

---

## 四、 改进与整改计划 (Step 4: Improvement Plan)

### 4.1 短期整改 (Immediate Actions - 1个月内)
- **[针对 1.1]**: **蓝图数据化解耦**。将前端 `BusinessFlowConfig.tsx` 中的 `PRESET_TEMPLATES` 物理迁移至后端数据库，通过 `/api/infra/config/presets` 接口动态下发，确保存量与新租户的版本一致性。
- **[针对 1.2]**: **物理路由拦截 (Security Gate)**。在集成层引入 `BlueprintGuard`。当蓝图中禁用某个节点（如“销售预测”）时，后端 API 必须对该模块的所有请求执行物理拦截并返回 403，而非仅仅隐藏菜单。

### 4.2 中期优化 (Medium-term - 3个月内)
- **[针对 2.1]**: **激活“幽灵参数”**。通过维护一个 `ParameterRegistry`，将配置页的开关（如 `allow_production_without_material`）真实挂载到 `reporting/save` 等业务 Hook 中，消除 UI 与逻辑的脱节。
- **[针对 2.2]**: **SME 弹性参数增强**。在配置项中增加 `purchase.tolerance_percentage` (超量收货容差) 与 `finance.rounding_method` (结算取整策略)，并在后端单据提交逻辑中实现该参数的原子计算。
- **[针对 4.2]**: **紧急旁路管理**。开发 `system.emergency_bypass` 特权参数。允许 SME 在特急场景下绕过常规审批直达任务执行，但配套 48 小时内的“事后追溯补录”强制提醒机制。

### 4.3 长期演进 (Long-term Strategy)
- **[针对 3.1]**: **动态业务 Schema 引擎**。构建基于 JSON Schema 的动态配置引擎。允许实施人员通过可视化界面，在不修改代码的情况下，为 SME 定义新的单据属性与验证规则。
- **[针对 4.1]**: **配置变更影响分析**。当蓝图或关键参数发生变更时，由系统自动扫描所有“在途单据”，并输出变更可能导致的数据不一致风险报告，引导用户平滑切换业务模式。

---
> [!IMPORTANT]
> **审计建议**：配置页面的核心目标是“降本增效”。如果一个开关不能改变系统的运行行为，那么这个开关就是对用户心智的误导。必须建立“配置项 -> 逻辑钩子 (Hook) -> 后端拦截”的全链路校验机制。
