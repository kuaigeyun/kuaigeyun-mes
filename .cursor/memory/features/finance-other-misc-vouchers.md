---
title: 其他费用收入/支出
keywords: other_income, other_expense, finance-misc-category, misc_voucher_posting
---

# 其他费用收入 / 其他费用支出

## 标准入口

- 真源在**主仓** `kuaizhizao`（与付款申请同组，禁止只写在 gitignore 的组装态 `apps/kuaicaiwu`）
- 模型：`apps/kuaizhizao/models/other_voucher.py`、`finance_misc_category.py`（表名仍为 `apps_kuaicaiwu_*`，迁移 863 已建）
- 服务：`other_income_service.py` / `other_expense_service.py`；过账 `misc_voucher_posting_service.py`；挂账 `misc_voucher_finance_bridge.py`（应收应付仍调轻财务）
- API：`/apps/kuaizhizao/other-incomes`、`other-expenses`、`finance-misc-categories/{income|expense}`
- 前端：`pages/finance-management/other-incomes|other-expenses`（`MiscVoucherListPage`）；明细行类别用 `MiscCategoryQuickSelect`
- 类别维护：`finance-misc-categories/index.tsx`
- 权限 manifest：`kuaicaiwu:other-income:*`、`kuaicaiwu:other-expense:*`、`kuaicaiwu:finance-misc-category:*`（码前缀历史保留）
- 审核节点：`manifest.audit` → `other_income` / `other_expense`

## 禁止

- 复用 Payment/Receipt 或生成应收应付
- UniPullQuery / 核销

## 交付

- 迁移 `863_…other_misc_vouchers.py`；行表审计列 `868_…other_voucher_line_audit_columns.py`（与付款申请 865 同模式，行表须对齐 BaseModel）；编码规则 `867_…seed_other_income_expense_code_rules.py`
- 占号：`finance_voucher_codes.allocate_other_income_code` / `allocate_other_expense_code` → `_ensure_rule` + `DefaultValuesService.restore_preset_for_page`
- 菜单同步后角色勾选新权限码
