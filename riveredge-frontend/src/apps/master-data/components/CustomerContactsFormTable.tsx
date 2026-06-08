/**
 * 客户联系人明细表（UniTableDetail + Form.List）
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Form, Input, Select } from 'antd';
import { UniTableDetail } from '../../../components/uni-table-detail';
import type { CustomerContact } from '../types/supply-chain';

export const EMPTY_CUSTOMER_CONTACT_ROW: CustomerContact = {
  contactPerson: undefined,
  contactTitle: undefined,
  phone: undefined,
  email: undefined,
};

export interface CustomerContactsFormTableProps {
  contactTitleOptions: Array<{ value: string; label: string }>;
  onQuickCreateContactTitle?: (anchor: HTMLElement | null) => void;
}

export const CustomerContactsFormTable: React.FC<CustomerContactsFormTableProps> = ({
  contactTitleOptions,
  onQuickCreateContactTitle,
}) => {
  const { t } = useTranslation();

  return (
    <UniTableDetail
      name="contacts"
      title={t('field.customer.contacts')}
      required={false}
      initialValue={EMPTY_CUSTOMER_CONTACT_ROW}
      containerStyle={{ width: '100%', marginBottom: 24 }}
      tableProps={{ className: 'customer-contacts-detail-table', size: 'small' }}
      columns={[
        {
          title: t('field.customer.contactPerson'),
          dataIndex: 'contactPerson',
          width: 140,
          render: (_: unknown, __: unknown, index: number) => (
            <Form.Item
              name={[index, 'contactPerson']}
              style={{ margin: 0 }}
              rules={[{ max: 100, message: t('field.customer.contactPersonMaxLength') }]}
            >
              <Input placeholder={t('field.customer.contactPersonPlaceholder')} size="small" allowClear />
            </Form.Item>
          ),
        },
        {
          title: t('field.customer.contactTitle'),
          dataIndex: 'contactTitle',
          width: 140,
          render: (_: unknown, __: unknown, index: number) => (
            <Form.Item name={[index, 'contactTitle']} style={{ margin: 0 }}>
              <Select
                placeholder={t('field.customer.contactTitlePlaceholder')}
                size="small"
                allowClear
                showSearch
                optionFilterProp="label"
                options={contactTitleOptions}
                dropdownRender={(menu) => (
                  <>
                    {menu}
                    {onQuickCreateContactTitle ? (
                      <div style={{ padding: '4px 8px 8px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                        <a
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={(e) => onQuickCreateContactTitle(e.currentTarget as HTMLElement)}
                        >
                          快速新增
                        </a>
                      </div>
                    ) : null}
                  </>
                )}
              />
            </Form.Item>
          ),
        },
        {
          title: t('field.customer.phone'),
          dataIndex: 'phone',
          width: 150,
          render: (_: unknown, __: unknown, index: number) => (
            <Form.Item
              name={[index, 'phone']}
              style={{ margin: 0 }}
              rules={[{ max: 20, message: t('field.customer.phoneMaxLength') }]}
            >
              <Input placeholder={t('field.customer.phonePlaceholder')} size="small" allowClear />
            </Form.Item>
          ),
        },
        {
          title: t('field.customer.email'),
          dataIndex: 'email',
          width: 200,
          render: (_: unknown, __: unknown, index: number) => (
            <Form.Item
              name={[index, 'email']}
              style={{ margin: 0 }}
              rules={[
                { type: 'email', message: t('field.customer.emailInvalid') },
                { max: 100, message: t('field.customer.emailMaxLength') },
              ]}
            >
              <Input placeholder={t('field.customer.emailPlaceholder')} size="small" allowClear />
            </Form.Item>
          ),
        },
      ]}
    />
  );
};
