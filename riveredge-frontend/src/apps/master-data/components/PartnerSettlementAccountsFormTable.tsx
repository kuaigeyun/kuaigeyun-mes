/**
 * 客户/供应商收付款账户明细（UniTableDetail + Form.List，布局同联系人）
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox, Form, Input } from 'antd';
import { UniTableDetail } from '../../../components/uni-table-detail';
import type { PartnerSettlementAccount } from '../types/supply-chain';

export const EMPTY_PARTNER_SETTLEMENT_ACCOUNT_ROW: PartnerSettlementAccount = {
  accountName: undefined,
  bankName: undefined,
  bankAccount: undefined,
  isDefault: false,
};

export interface PartnerSettlementAccountsFormTableProps {
  /** i18n key for section title, e.g. field.supplier.paymentAccounts */
  titleKey: string;
}

export const PartnerSettlementAccountsFormTable: React.FC<PartnerSettlementAccountsFormTableProps> = ({
  titleKey,
}) => {
  const { t } = useTranslation();

  return (
    <UniTableDetail
      name="settlementAccounts"
      title={t(titleKey)}
      required={false}
      initialValue={EMPTY_PARTNER_SETTLEMENT_ACCOUNT_ROW}
      containerStyle={{ width: '100%', marginBottom: 24 }}
      tableProps={{ className: 'partner-settlement-accounts-detail-table', size: 'small' }}
      columns={[
        {
          title: t('field.partner.settlementAccountName'),
          dataIndex: 'accountName',
          width: 160,
          render: (_: unknown, __: unknown, index: number) => (
            <Form.Item
              name={[index, 'accountName']}
              style={{ margin: 0 }}
              rules={[{ max: 200, message: t('field.partner.settlementAccountNameMaxLength') }]}
            >
              <Input placeholder={t('field.partner.settlementAccountNamePlaceholder')} size="small" allowClear />
            </Form.Item>
          ),
        },
        {
          title: t('field.partner.settlementBankName'),
          dataIndex: 'bankName',
          width: 180,
          render: (_: unknown, __: unknown, index: number) => (
            <Form.Item
              name={[index, 'bankName']}
              style={{ margin: 0 }}
              rules={[{ max: 200, message: t('field.partner.settlementBankNameMaxLength') }]}
            >
              <Input placeholder={t('field.partner.settlementBankNamePlaceholder')} size="small" allowClear />
            </Form.Item>
          ),
        },
        {
          title: t('field.partner.settlementBankAccount'),
          dataIndex: 'bankAccount',
          width: 200,
          render: (_: unknown, __: unknown, index: number) => (
            <Form.Item
              name={[index, 'bankAccount']}
              style={{ margin: 0 }}
              rules={[{ max: 64, message: t('field.partner.settlementBankAccountMaxLength') }]}
            >
              <Input placeholder={t('field.partner.settlementBankAccountPlaceholder')} size="small" allowClear />
            </Form.Item>
          ),
        },
        {
          title: t('field.partner.settlementAccountDefault'),
          dataIndex: 'isDefault',
          width: 88,
          align: 'center',
          render: (_: unknown, __: unknown, index: number) => (
            <Form.Item name={[index, 'isDefault']} style={{ margin: 0 }} valuePropName="checked">
              <Checkbox />
            </Form.Item>
          ),
        },
      ]}
    />
  );
};
