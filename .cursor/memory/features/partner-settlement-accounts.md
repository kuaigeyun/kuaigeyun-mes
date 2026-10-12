---
title: 客户/供应商多收付款账户
keywords: settlementAccounts, PartnerSettlementAccountsFormTable, paymentAccounts, receiptAccounts
---

## 何时读

客户/供应商维护多条付款或收款银行账户时。

## 真源

- DB：`apps_master_data_customers|suppliers.settlement_accounts` JSON 数组（snake 键：`account_name`, `bank_name`, `bank_account`, `is_default`）
- API：`PartnerSettlementAccountItem` / `settlementAccounts`（与开票 `invoiceBank*` 分离）
- 服务：`supply_chain_service._apply_partner_settlement_accounts_payload`、`_partner_settlement_accounts_for_response`
- 前端：`PartnerSettlementAccountsFormTable`（UniTableDetail，联系人下方）；`normalizePartnerSettlementAccountsForSubmit`

## 禁止

- 读侧把开票银行字段冒充付款/收款账户列表
- 在 `request` 或其它路径旁路写账户明细
