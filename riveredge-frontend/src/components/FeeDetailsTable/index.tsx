import React, { useEffect, useState } from 'react';
import {
  ProFormDigit,
  ProFormSelect,
  ProFormText,
} from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { Button, Form, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { getDictionaryItemList, getDataDictionaryByCode, type DictionaryItem } from '../../services/dataDictionary';
import { mapSystemDictionaryItemOptions } from '../../utils/systemDictionaryI18n';
import { ThemedSegmented } from '../themed-segmented';

interface FeeDetailsTableProps {
  name?: string;
  label?: string;
}

const FEE_TYPE_FALLBACK_ITEMS: Pick<DictionaryItem, 'value' | 'label' | 'is_system_managed'>[] = [
  { value: 'LOGISTICS', label: '物流费', is_system_managed: true },
  { value: 'PACKAGING', label: '包装费', is_system_managed: true },
  { value: 'OTHER', label: '其他', is_system_managed: true },
];

const defaultFeeRow = {
  type: undefined as string | undefined,
  amount: undefined as number | undefined,
  bearer: 'our_side',
  notes: '',
};

const FeeDetailsTable: React.FC<FeeDetailsTableProps> = ({
  name = 'fee_details',
  label: labelProp,
}) => {
  const { t, i18n } = useTranslation();
  const [feeTypeOptions, setFeeTypeOptions] = useState<{ label: string; value: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const label = labelProp ?? t('app.kuaizhizao.salesOrder.feeDetailsFormLabel');

  useEffect(() => {
    const loadDict = async () => {
      setLoading(true);
      try {
        const dict = await getDataDictionaryByCode('FEE_TYPE');
        const items = await getDictionaryItemList(dict.uuid, true);
        const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
        setFeeTypeOptions(mapSystemDictionaryItemOptions('FEE_TYPE', sorted, t));
      } catch (error) {
        console.error('Failed to load FEE_TYPE dictionary:', error);
        setFeeTypeOptions(mapSystemDictionaryItemOptions('FEE_TYPE', FEE_TYPE_FALLBACK_ITEMS as DictionaryItem[], t));
      } finally {
        setLoading(false);
      }
    };
    loadDict();
  }, [t, i18n.language]);

  const buildColumns = (remove: (index: number) => void): ColumnsType<{ key: React.Key; name: number }> => [
    {
      title: t('app.kuaizhizao.salesOrder.feeType'),
      width: 160,
      render: (_: unknown, __: unknown, index: number) => (
        <ProFormSelect
          name={[index, 'type']}
          placeholder={t('app.kuaizhizao.salesOrder.selectFeeType')}
          options={feeTypeOptions}
          fieldProps={{
            loading,
            style: { width: '100%' },
          }}
          formItemProps={{ style: { margin: 0 } }}
          rules={[{ required: true, message: t('common.required') }]}
        />
      ),
    },
    {
      title: t('app.kuaizhizao.salesOrder.feeAmount'),
      width: 132,
      render: (_: unknown, __: unknown, index: number) => (
        <ProFormDigit
          name={[index, 'amount']}
          min={0}
          placeholder="0.00"
          fieldProps={{
            precision: 2,
            prefix: '¥',
            style: { width: '100%' },
          }}
          formItemProps={{ style: { margin: 0 } }}
          rules={[{ required: true, message: t('common.required') }]}
        />
      ),
    },
    {
      title: t('app.kuaizhizao.salesOrder.feeBearer'),
      width: 168,
      render: (_: unknown, __: unknown, index: number) => (
        <Form.Item name={[index, 'bearer']} initialValue="our_side" style={{ margin: 0 }}>
          <ThemedSegmented
            className="form-field-segmented"
            size="middle"
            options={[
              { label: t('app.kuaizhizao.salesOrder.feeBearerOurSide'), value: 'our_side' },
              { label: t('app.kuaizhizao.salesOrder.feeBearerCounterparty'), value: 'other_side' },
            ]}
          />
        </Form.Item>
      ),
    },
    {
      title: t('app.kuaizhizao.salesOrder.notes'),
      width: 200,
      render: (_: unknown, __: unknown, index: number) => (
        <ProFormText
          name={[index, 'notes']}
          placeholder={t('app.kuaizhizao.salesOrder.notesPlaceholder')}
          formItemProps={{ style: { margin: 0 } }}
        />
      ),
    },
    {
      title: t('common.actions'),
      width: 60,
      align: 'center',
      render: (_: unknown, __: unknown, index: number) => (
        <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(index)} />
      ),
    },
  ];

  return (
    <Form.Item label={label} colon={false} style={{ marginBottom: 24 }}>
      <Form.List name={name}>
        {(fields, { add, remove }) => (
          <>
            {fields.length > 0 ? (
              <Table
                size="small"
                bordered
                pagination={false}
                rowKey="key"
                dataSource={fields}
                columns={buildColumns(remove)}
                scroll={{ x: 'max-content' }}
              />
            ) : null}
            <Button
              type="dashed"
              block
              icon={<PlusOutlined />}
              style={{ marginTop: 8 }}
              onClick={() => add({ ...defaultFeeRow })}
            >
              {t('app.kuaizhizao.salesOrder.addFeeItem')}
            </Button>
          </>
        )}
      </Form.List>
    </Form.Item>
  );
};

export default FeeDetailsTable;
