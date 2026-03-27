import React, { useEffect, useState } from 'react';
import {
  ProFormList,
  ProFormGroup,
  ProFormSelect,
  ProFormDigit,
  ProFormText,
  ProFormRadio,
} from '@ant-design/pro-components';
import { getDictionaryItemList, getDataDictionaryByCode } from '../../services/dataDictionary';
import { Card, theme } from 'antd';
import { useTranslation } from 'react-i18next';

interface FeeDetailsTableProps {
  name?: string;
  label?: string;
}

const FeeDetailsTable: React.FC<FeeDetailsTableProps> = ({
  name = 'fee_details',
  label = '费用明细',
}) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const [feeTypeOptions, setFeeTypeOptions] = useState<{ label: string; value: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadDict = async () => {
      setLoading(true);
      try {
        const dict = await getDataDictionaryByCode('FEE_TYPE');
        const items = await getDictionaryItemList(dict.uuid, true);
        setFeeTypeOptions(
          items
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((it) => ({
              label: it.label,
              value: it.value,
            }))
        );
      } catch (error) {
        console.error('Failed to load FEE_TYPE dictionary:', error);
        // Fallback options
        setFeeTypeOptions([
          { label: '物流费', value: 'LOGISTICS' },
          { label: '包装费', value: 'PACKAGING' },
          { label: '其他', value: 'OTHER' },
        ]);
      } finally {
        setLoading(false);
      }
    };
    loadDict();
  }, []);

  return (
    <Card
      title={label}
      size="small"
      style={{
        marginBottom: 24,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
      }}
      styles={{
        header: {
          backgroundColor: token.colorFillAlter,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          fontSize: 14,
          fontWeight: 600,
        },
      }}
    >
      <ProFormList
        name={name}
        copyIconProps={false}
        creatorButtonProps={{
          creatorButtonText: '添加费用项目',
          type: 'dashed',
          block: true,
        }}
        itemRender={({ listDom, action }, { index }) => (
          <div
            key={index}
            style={{
              padding: '12px 16px',
              marginBottom: 12,
              backgroundColor: token.colorFillQuaternary,
              borderRadius: token.borderRadius,
              border: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            {listDom}
            <div style={{ textAlign: 'right', marginTop: 8 }}>
              {action}
            </div>
          </div>
        )}
      >
        <ProFormGroup size={8}>
          <ProFormSelect
            name="type"
            label="费用类型"
            width="sm"
            placeholder="请选择"
            options={feeTypeOptions}
            fieldProps={{
              loading: loading,
            }}
            rules={[{ required: true }]}
          />
          <ProFormDigit
            name="amount"
            label="金额"
            width="xs"
            min={0}
            placeholder="0.00"
            fieldProps={{
              precision: 2,
              prefix: '¥',
            }}
            rules={[{ required: true }]}
          />
          <ProFormRadio.Group
            name="bearer"
            label="承担方"
            width="xs"
            initialValue="our_side"
            options={[
              { label: '我方', value: 'our_side' },
              { label: '对方', value: 'other_side' },
            ]}
          />
          <ProFormText
            name="notes"
            label="备注"
            width="md"
            placeholder="备注说明"
          />
        </ProFormGroup>
      </ProFormList>
    </Card>
  );
};

export default FeeDetailsTable;
