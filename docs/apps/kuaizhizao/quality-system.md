# 质量体系（ISO / QMS）落点与范围

## 落点

快制造 → **质量管理** → **质量体系**（不新开独立 QMS 应用）。

## 首批范围（已定）

| 模块 | 路径 | 说明 |
|------|------|------|
| ISO 条款 | `/quality-management/iso-clauses` | 条款树主数据 + 落实摘要；体系文件/内审选条款关联 |
| 体系文件 | `/quality-management/system-documents` | 受控：草稿 / 生效 / 作废；可挂检验与改进证据 |
| 内部审核 | `/quality-management/internal-audits` | 计划、执行、不符合项；可链 8D |
| 管理评审 | `/quality-management/management-reviews` | 输入输出纪要；可引用内审与质量报表结论 |

## 明确不做（本批）

- **独立 CAPA / 纠正预防措施菜单**：纠正措施继续以 **8D + 不合格品台账** 为入口；内审不符合项可关联 8D。
- **培训 / 校准搬家**：留在 kuaioa 培训、设备管理校准；体系单据仅存跨应用引用（路径/编码/说明），不做第二套主数据。
- **管理评审按单条款登记**：管理评审为综合输入，不按单条款字段登记。

## ISO 条款与落实口径

- 条款目录：`standard_code` + `clause_code` + 标题，树形 `parent_id`；预置 **ISO 9001:2015** 公开条款号与短标题（不含标准正文）。
- 体系文件、内审：`iso_clause_id` 外键选条款，保留 `iso_clause` 文本快照（条款号）。
- 落实摘要（按条款及子树合计）：
  - **已覆盖**：至少 1 份生效体系文件
  - **待复审**：有生效文件且存在复审到期
  - **有缺口**：无生效文件，或从未完成过该条款内审

## 证据链接约定

`evidence_links` / `finding_links` / `input_links` 等 JSON 数组元素：

```json
{
  "ref_type": "eight_d|incoming_inspection|process_inspection|finished_goods_inspection|oqc_inspection|nonconforming|internal_audit|training|calibration|other",
  "ref_id": null,
  "ref_code": "BD202608140001",
  "ref_name": "可选名称",
  "path": "/apps/kuaizhizao/quality-management/eight-d-reports?report_id=1",
  "note": "可选说明"
}
```

培训、校准优先填 `path` + `ref_name`，不强制本库外键。
