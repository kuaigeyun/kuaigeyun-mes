/**
 * 收/付款单入账账户字段：按付款方式过滤银行账户 / 库存现金。
 */
import React from 'react';
import { ProFormDependency, ProFormSelect, ProFormText } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import type { BankAccount } from '../services/finance/bank-account';
import {
  filterBankAccountsForPaymentMethod,
  formatBankAccountOptionLabel,
  isCashPaymentMethod,
  requiresLedgerAccount,
} from '../utils/financeSharedOptions';

type Props = {
  accounts: BankAccount[];
  accountLabel: string;
  noteLabel: string;
  noteName?: string;
};

export const LedgerAccountFormFields: React.FC<Props> = ({
  accounts,
  accountLabel,
  noteLabel,
  noteName = 'bank_account',
}) => {
  const { t } = useTranslation();

  return (
    <>
      <ProFormDependency name={['payment_method']}>
        {({ payment_method }) => {
          const filtered = filterBankAccountsForPaymentMethod(accounts, payment_method);
          const options = filtered.map((a) => ({
            label: formatBankAccountOptionLabel(a),
            value: a.id,
          }));
          const cash = isCashPaymentMethod(payment_method);
          const required = requiresLedgerAccount(payment_method);
          const emptyHint = cash
            ? t('app.kuaicaiwu.receipt.bankAccountCashEmptyHint')
            : t('app.kuaicaiwu.receipt.bankAccountEmptyHint');
          const placeholder = options.length === 0
            ? (cash
              ? t('app.kuaicaiwu.common.noCashAccountHint')
              : t('app.kuaicaiwu.common.noBankAccountHint'))
            : (cash
              ? t('app.kuaicaiwu.receipt.bankAccountCashPlaceholder')
              : t('app.kuaicaiwu.receipt.bankAccountPlaceholder'));
          return (
            <ProFormSelect
              name="bank_account_id"
              label={accountLabel}
              options={options}
              placeholder={placeholder}
              showSearch
              allowClear={!required}
              extra={options.length === 0 && required ? emptyHint : undefined}
              rules={[
                ({ getFieldValue }) => ({
                  validator: async (_, value) => {
                    if (requiresLedgerAccount(getFieldValue('payment_method')) && !value) {
                      if (isCashPaymentMethod(getFieldValue('payment_method'))) {
                        throw new Error(t('app.kuaicaiwu.common.bankAccountRequiredForCash'));
                      }
                      throw new Error(t('app.kuaicaiwu.common.bankAccountRequiredForTransfer'));
                    }
                  },
                }),
              ]}
            />
          );
        }}
      </ProFormDependency>
      <ProFormText
        name={noteName}
        label={noteLabel}
        placeholder={t('app.kuaicaiwu.receipt.bankAccountNotePlaceholder')}
      />
    </>
  );
};

export function resolveLedgerAccountNote(
  accounts: BankAccount[],
  bankAccountId: unknown,
  fallback?: string,
): string | undefined {
  if (bankAccountId == null || bankAccountId === '') return fallback;
  const acc = accounts.find((a) => a.id === Number(bankAccountId));
  if (!acc) return fallback;
  return acc.account_number || acc.account_name || fallback;
}
