import React from 'react';
import { ProFormItem } from '@ant-design/pro-components';
import { Form } from 'antd';
import { useTranslation } from 'react-i18next';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';

interface DowngradeDispositionFieldsProps {
  dispositionFieldName?: string;
  materialFieldName?: string;
  warehouseFieldName?: string;
}

export function DowngradeDispositionFields({
  dispositionFieldName = 'disposition',
  materialFieldName = 'downgrade_material_id',
  warehouseFieldName = 'downgrade_warehouse_id',
}: DowngradeDispositionFieldsProps) {
  const { t } = useTranslation();
  const disposition = Form.useWatch(dispositionFieldName);

  if (disposition !== 'downgrade') {
    return null;
  }

  return (
    <>
      <ProFormItem
        name={materialFieldName}
        label={t('app.kuaizhizao.quality.common.form.downgradeMaterial')}
        rules={[{ required: true, message: t('app.kuaizhizao.quality.common.validation.requiredDowngradeMaterial') }]}
      >
        <UniMaterialSelect
          placeholder={t('app.kuaizhizao.quality.common.placeholder.downgradeMaterial')}
          style={{ width: '100%' }}
        />
      </ProFormItem>
      <ProFormItem
        name={warehouseFieldName}
        label={t('app.kuaizhizao.quality.common.form.downgradeWarehouse')}
        rules={[{ required: true, message: t('app.kuaizhizao.quality.common.validation.requiredDowngradeWarehouse') }]}
      >
        <UniWarehouseSelect
          placeholder={t('app.kuaizhizao.quality.common.placeholder.downgradeWarehouse')}
          style={{ width: '100%' }}
        />
      </ProFormItem>
    </>
  );
}
