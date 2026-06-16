import React, { useEffect, useState } from 'react';
import {
  ProFormList,
  ProFormGroup,
  ProFormSelect,
  ProFormDigit,
  ProFormText,
  ProFormItem,
} from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { getDictionaryItemList, getDataDictionaryByCode, type DictionaryItem } from '../../services/dataDictionary';
import { Card, theme } from 'antd';
import { ThemedSegmented } from '../themed-segmented';
import { mapSystemDictionaryItemOptions } from '../../utils/systemDictionaryI18n';

interface FeeDetailsTableProps {
  name?: string;
  label?: string;
}

const FEE_TYPE_FALLBACK_ITEMS: Pick<DictionaryItem, 'value' | 'label' | 'is_system_managed'>[] = [
  { value: 'LOGISTICS', label: '物流费', is_system_managed: true },
  { value: 'PACKAGING', label: '包装费', is_system_managed: true },
  { value: 'OTHER', label: '其他', is_system_managed: true },
];

const FeeDetailsTable: React.FC<FeeDetailsTableProps> = ({
  name = 'fee_details',
  label: labelProp,
}) => {
  const { t, i18n } = useTranslation();
  const { token } = theme.useToken();
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
      <style>{`
        .fee-details-row .ant-form-item {
          margin-bottom: 0 !important;
        }
        .fee-details-row .ant-pro-form-group {
          margin-bottom: 0 !important;
        }
        .fee-details-row .ant-pro-form-list-action {
          margin: 0 !important;
          padding: 0 !important;
          height: 100%;
          display: flex;
          align-items: center;
        }
        .fee-details-row .ant-pro-form-list-action .ant-btn,
        .fee-details-row .ant-pro-form-list-action .anticon {
          line-height: 1 !important;
        }
      `}</style>
      <ProFormList
        name={name}
        copyIconProps={false}
        creatorButtonProps={{
          creatorButtonText: t('app.kuaizhizao.salesOrder.addFeeItem'),
          type: 'dashed',
          block: true,
        }}
        itemRender={({ listDom, action }, { index }) => (
          <div
            className="fee-details-row"
            key={index}
            style={{
              padding: '6px 16px',
              marginBottom: 8,
              backgroundColor: token.colorFillQuaternary,
              borderRadius: token.borderRadius,
              border: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                flexWrap: 'nowrap',
                gap: 8,
                width: '100%',
              }}
            >
              <div style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden' }}>{listDom}</div>
              <div
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  alignSelf: 'center',
                  minHeight: 40,
                  paddingBottom: 0,
                }}
              >
                {action}
              </div>
            </div>
          </div>
        )}
      >
        <ProFormGroup size={8}>
          <ProFormSelect
            name="type"
            label={t('app.kuaizhizao.salesOrder.feeType')}
            width="sm"
            placeholder={t('app.kuaizhizao.salesOrder.selectFeeType')}
            options={feeTypeOptions}
            fieldProps={{
              loading: loading,
            }}
            rules={[{ required: true }]}
          />
          <ProFormDigit
            name="amount"
            label={t('app.kuaizhizao.salesOrder.feeAmount')}
            width="xs"
            min={0}
            placeholder="0.00"
            fieldProps={{
              precision: 2,
              prefix: '¥',
            }}
            rules={[{ required: true }]}
          />
          <ProFormItem
            name="bearer"
            label={t('app.kuaizhizao.salesOrder.feeBearer')}
            initialValue="our_side"
            style={{ marginBottom: 0 }}
          >
            <ThemedSegmented
              options={[
                { label: t('app.kuaizhizao.salesOrder.feeBearerOurSide'), value: 'our_side' },
                { label: t('app.kuaizhizao.salesOrder.feeBearerCounterparty'), value: 'other_side' },
              ]}
            />
          </ProFormItem>
          <ProFormText
            name="notes"
            label={t('app.kuaizhizao.salesOrder.notes')}
            width="md"
            placeholder={t('app.kuaizhizao.salesOrder.notesPlaceholder')}
          />
        </ProFormGroup>
      </ProFormList>
    </Card>
  );
};

export default FeeDetailsTable;
