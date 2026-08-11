/**
 * 收/付款单入账账户字段：按付款方式过滤银行账户 / 库存现金。
 */
import React, { useEffect, useRef } from 'react';
import { ProForm, ProFormDependency, ProFormSelect, ProFormText } from '@ant-design/pro-components';
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

function SyncLedgerAccountWithPaymentMethod({ accounts }: { accounts: BankAccount[] }) {
  const form = ProForm.useFormInstance();
  const paymentMethod = ProForm.useWatch('payment_method', form);
  const bankAccountId = ProForm.useWatch('bank_account_id', form);
  const prevPaymentMethodRef = useRef<string | undefined>();

  useEffect(() => {
    if (paymentMethod === undefined) return;

    const methodChanged = prevPaymentMethodRef.current !== paymentMethod;
    prevPaymentMethodRef.current = paymentMethod;

    const filtered = filterBankAccountsForPaymentMethod(accounts, paymentMethod);
    const validIds = new Set(filtered.map((a) => a.id));
    const currentId =
      bankAccountId != null && bankAccountId !== '' ? Number(bankAccountId) : null;

    if (currentId != null && !validIds.has(currentId)) {
      form.setFieldValue('bank_account_id', undefined);
      if (requiresLedgerAccount(paymentMethod) && filtered.length === 1) {
        form.setFieldValue('bank_account_id', filtered[0].id);
      }
      return;
    }

    if (
      methodChanged &&
      requiresLedgerAccount(paymentMethod) &&
      filtered.length === 1 &&
      currentId == null
    ) {
      form.setFieldValue('bank_account_id', filtered[0].id);
    }
  }, [paymentMethod, accounts, bankAccountId, form]);

  return null;
}

export const LedgerAccountFormFields: React.FC<Props> = ({
  accounts,
  accountLabel,
  noteLabel,
  noteName = 'bank_account',
}) => {
  const { t } = useTranslation();

  return (
    <>
      <SyncLedgerAccountWithPaymentMethod accounts={accounts} />
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
