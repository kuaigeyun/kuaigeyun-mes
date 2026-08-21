import React, { useEffect, useState } from 'react';
import { ProForm, ProFormSelect } from '@ant-design/pro-components';
import { App } from 'antd';
import type { FormInstance } from 'antd';
import type { NamePath } from 'antd/es/form/interface';
import { useTranslation } from 'react-i18next';
import { UniUserIdSelect } from '../../../components/uni-user-id-select';
import { UniMaterialSelect } from '../../../components/uni-material-select';
import { CustomerSelectDropdown } from '../../master-data/components/CustomerSelectDropdown';
import { SupplierSelectDropdown } from '../../master-data/components/SupplierSelectDropdown';
import { getDepartmentTree } from '../../../services/department';
import { operationApi, unwrapProcessPagedList } from '../../master-data/services/process';
import {
  companionIdField,
  flattenDepartmentOptions,
  type OaLookupKind,
} from '../utils/oaLookupFields';
import type { KuaioaFieldConfig } from './KuaioaCrudListPage';

type ColProps = { span: number };

type Props = {
  field: KuaioaFieldConfig;
  kind: OaLookupKind;
  label: string;
  required?: boolean;
  colProps?: ColProps;
  form: FormInstance;
  resource: string;
  editing: Record<string, unknown> | null;
};

const userDisplayName = (user?: { label?: string; full_name?: string | null; username?: string }) =>
  user?.label || user?.full_name || user?.username || undefined;

const OaLookupField: React.FC<Props> = ({
  field,
  kind,
  label,
  required,
  colProps,
  form,
  resource,
  editing,
}) => {
  const rules = required ? [{ required: true, message: `请选择${label}` }] : undefined;
  const pickName = `_pick_${field.name}`;
  const idName = companionIdField(field.name);

  if (kind === 'user') {
    const presetId = Number(editing?.[idName]);
    return (
      <UniUserIdSelect
        name={pickName}
        label={label}
        required={required}
        colProps={colProps}
        presetUsers={
          Number.isFinite(presetId) && presetId > 0
            ? [{ id: presetId, label: String(editing?.[field.name] ?? '') }]
            : undefined
        }
        onUserPicked={(user) => {
          const patch: Record<string, unknown> = {
            [field.name]: userDisplayName(user),
          };
          if (field.name === 'applicant_name' || field.name === 'custodian_name') {
            patch[idName] = user?.id;
          }
          form.setFieldsValue(patch);
        }}
      />
    );
  }

  if (kind === 'customer') {
    return (
      <ProForm.Item name="_customer_id" label={label} rules={rules}>
        <CustomerSelectDropdown
          hostResource={resource}
          snapshotNameField="customer_name"
          style={{ width: '100%' }}
          onCustomerPick={(customer) => {
            form.setFieldsValue({ customer_name: customer?.name ?? undefined });
          }}
        />
      </ProForm.Item>
    );
  }

  if (kind === 'supplier') {
    return (
      <ProForm.Item name="_supplier_id" label={label} rules={rules}>
        <SupplierSelectDropdown
          hostResource={resource}
          style={{ width: '100%' }}
          onSupplierPick={(supplier) => {
            form.setFieldsValue({ supplier_name: supplier?.name ?? undefined });
          }}
        />
      </ProForm.Item>
    );
  }

  if (kind === 'material') {
    return (
      <UniMaterialSelect
        name="_material_id"
        label={label}
        required={required}
        formItemProps={{ style: { width: '100%', marginTop: 0, marginInline: 0 } }}
        fillMapping={{
          material_code: 'mainCode',
          material_name: 'name',
        }}
      />
    );
  }

  if (kind === 'department') {
    return <OaDepartmentSelect name={field.name} label={label} rules={rules} colProps={colProps} />;
  }

  return (
    <ProFormSelect
      name={field.name}
      label={label}
      rules={rules}
      colProps={colProps}
      showSearch
      fieldProps={{ optionFilterProp: 'label' }}
      request={async ({ keyWords }) => {
        const res = await operationApi.list({
          keyword: keyWords || undefined,
          isActive: true,
          limit: 80,
        });
        return unwrapProcessPagedList(res).map((op) => ({
          label: `${op.code} ${op.name}`,
          value: op.name,
        }));
      }}
    />
  );
};

export const OaDepartmentSelect: React.FC<{
  name: NamePath;
  label: string;
  rules?: Array<{ required: boolean; message: string }>;
  colProps?: ColProps;
  disabled?: boolean;
}> = ({ name, label, rules, colProps, disabled }) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [options, setOptions] = useState<Array<{ label: string; value: string }>>([]);

  useEffect(() => {
    void getDepartmentTree()
      .then((res) => {
        setOptions(flattenDepartmentOptions(res.items ?? []));
      })
      .catch((error: { message?: string }) => {
        message.error(error?.message || t('common.operationFailed'));
      });
  }, [message, t]);

  return (
    <ProFormSelect
      name={name}
      label={label}
      rules={rules}
      colProps={colProps}
      disabled={disabled}
      showSearch
      options={options}
      fieldProps={{ optionFilterProp: 'label', disabled }}
    />
  );
};

export default OaLookupField;
