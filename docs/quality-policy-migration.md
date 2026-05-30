# 质检分场景策略改造 — 发布说明与验收

## 变更摘要

- **主数据**：物料 UI 为 `inspection_mode`（无/简易/方案）；后端 `inspection_stages` 仅 IQC/FQC/OQC。工序 `inspection_stages` 仅 IPQC。
- **唯一解析**：业务仅通过 `resolve_inspection_policy(tenant_id, stage, material_id=…, operation_id=…)` 判定是否建单/门禁及方案。
- **检验方案**：新增 `plan_type=outbound`（出货检验），OQC 模板解析仅用 outbound，不再复用 `finished`。
- **组织门禁**：配置中心新增 `require_fqc_before_finished_goods_receipt`（成品检验合格才入库）。
- **Legacy**：未写入 JSON 的物料/工序仍从 `inspection_mode` + `default_inspection_plan_id` 读 shim；保存时同步回写 legacy 字段供旧导出使用。

## 部署步骤

1. 拉取代码并执行数据库迁移：`329_20260530150000_material_operation_inspection_stages`。
2. 重启后端服务。
3. 在配置中心 → 质量模块按需开启 **成品检验合格才入库**。
4. **OQC 方案迁移（手工）**：若某检验方案仅用于出货检，请将 `plan_type` 从 `finished` 改为 `outbound`（系统不会自动猜测迁移）。

## 验收场景

| # | 配置 | 预期 |
|---|------|------|
| 1 | 物料 A：仅 IQC=plan，FQC/OQC=none | 采购可建 IQC；末道报工/出库不建 FQC/OQC、不卡对应门禁 |
| 2 | 物料 B：FQC=plan，IQC=none | 末道报工自动 FQC；采购入库不建 IQC、IQC 门禁不拦截该物料行 |
| 3 | 物料 C：OQC=plan（outbound 方案）与 FQC=plan（finished 方案）不同 | 出货/OQC 与成品检使用各自方案，互不混用 |
| 4 | 开启 `require_fqc_before_finished_goods_receipt` + 物料 FQC≠none | 无合格且已审核 FQC 时，成品入库确认失败 |
| 5 | 关闭 IPQC 环节 | 保存工序 IPQC≠none 返回 409；报工不建过程检 |
| 6 | 旧物料仅 legacy 字段 | 行为与改造前一致（IQC/FQC/OQC 同 mode/plan_id shim） |

## 三层唯一源

1. **L1 组织**：配置中心环节开关、模块能力、自动建单、门禁（IQC/FQC/OQC）。
2. **L2 主数据**：`material.inspection_stages` / `operation.inspection_stages` JSON。
3. **L3 检验方案**：`plan_type` 与 stage 映射 — iqc→incoming、ipqc→process、fqc→finished、oqc→outbound。

判定公式：`组织允许 AND 主数据该场景 mode≠none` → 才建单/才门禁。
