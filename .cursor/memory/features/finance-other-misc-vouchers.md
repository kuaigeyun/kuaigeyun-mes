---
title: 其他费用收入/支出
keywords: other_income, other_expense, finance-misc-category, misc_voucher_posting
---

# 其他费用收入 / 其他费用支出

## 标准入口

- 模型：`apps/kuaicaiwu/models/other_voucher.py`、`finance_misc_category.py`
- 服务：`other_income_service.py` / `other_expense_service.py`；过账 `misc_voucher_posting_service.py`（仅银行流水）
- API：`/apps/kuaicaiwu/other-incomes`、`other-expenses`、`finance-misc-categories/{income|expense}`
- 银行：`BankAccountService.sync_from_confirmed_voucher` 支持 `voucher_type=other_income|other_expense`
- 前端：`pages/finance-management/other-incomes|other-expenses`（`MiscVoucherListPage`）；明细行类别用 `MiscCategoryQuickSelect` = `UniDropdown.quickCreate` + `QuickCreateModal`（同物料单位 `MaterialUnitQuickSelect`，禁止 Select 自写 popupRender）
- 类别维护：`finance-misc-categories/index.tsx`（UniTable 标准壳；收入支出 `ThemedSegmented` 在 `beforeSearchButtons`）
- 权限 manifest：`kuaicaiwu:other-income:*`、`kuaicaiwu:other-expense:*`、`kuaicaiwu:finance-misc-category:*`
- 审核节点：`manifest.audit` → `other_income` / `other_expense`（`check_audit_required`）

## 禁止

- 复用 Payment/Receipt 或生成应收应付
- UniPullQuery / 核销

## 交付

- 迁移 `863_…other_misc_vouchers.py`；行表审计列 `868_…other_voucher_line_audit_columns.py`（与付款申请 865 同模式，行表须对齐 BaseModel）；编码规则 `867_…seed_other_income_expense_code_rules.py`
- 占号：`finance_voucher_codes.allocate_other_income_code` / `allocate_other_expense_code` → `_ensure_rule` + `DefaultValuesService.restore_preset_for_page`
- 菜单同步后角色勾选新权限码
