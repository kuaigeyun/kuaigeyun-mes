import React, { useMemo } from 'react';
import { ProForm } from '@ant-design/pro-components';
import { Form as AntForm, Input } from 'antd';
import { useTranslation } from 'react-i18next';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import type { User } from '../../../../../services/user';
import { normalizeUserDisplayName } from '../../../../../utils/userDisplay';

/** 销售单据归属业务员：下拉选人，无匹配选项时用 salesman_name 回显 */
export const SalesDocumentSalesmanField: React.FC<{
  userList: User[];
  loading: boolean;
  label: string;
}> = ({ userList, loading, label }) => {
  const { t } = useTranslation();
  const form = AntForm.useFormInstance();
  const salesmanId = AntForm.useWatch('salesman_id', form);
  const salesmanName = AntForm.useWatch('salesman_name', form);

  const options = useMemo(() => {
    const base = userList.map((u) => ({
      value: Number(u.id),
      label: normalizeUserDisplayName(u.full_name || u.username),
    }));
    const sid =
      salesmanId != null && salesmanId !== '' && Number.isFinite(Number(salesmanId))
        ? Number(salesmanId)
        : NaN;
    if (Number.isFinite(sid) && !base.some((o) => o.value === sid)) {
      const fallbackLabel =
        normalizeUserDisplayName(salesmanName) || t('app.kuaizhizao.quotation.userFallback', { id: sid });
      return [{ value: sid, label: fallbackLabel }, ...base];
    }
    return base;
  }, [userList, salesmanId, salesmanName, t]);

  return (
    <>
      <ProForm.Item
        name="salesman_id"
        label={label}
        normalize={(v) =>
          v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined
        }
      >
        <UniDropdown
          placeholder={t('field.customer.salesmanPlaceholder')}
          showSearch
          allowClear
          loading={loading}
          style={{ width: '100%' }}
          options={options}
          onChange={(_val, opt: { label?: string }) => {
            form.setFieldsValue({ salesman_name: opt?.label });
          }}
        />
      </ProForm.Item>
      <AntForm.Item name="salesman_name" hidden>
        <Input />
      </AntForm.Item>
    </>
  );
};
