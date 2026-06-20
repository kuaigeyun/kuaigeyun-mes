/**
 * 采购件成本核算页面
 */

import React, { useMemo, useRef, useState } from 'react';
import { ProFormSelect, ProFormDigit, ProFormDatePicker, PageContainer, ProDescriptions } from '@ant-design/pro-components';
import { App, Button, Card, Divider } from 'antd';
import { CalculatorOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { StructuredCostDataView } from '../../../../../components/structured-cost-data-view';
import { purchaseCostApi } from '../../../services/cost';
import { materialApi } from '../../../../master-data/services/material';
import dayjs from 'dayjs';
import {
  loadPurchaseOrderSelectOptions,
  loadPurchaseOrderItemSelectOptions,
  normalizeCostListRows,
  type CostSelectOption,
} from '../costSelectData';
import { formatCalculationType, getSourceTypeTag } from '../../../utils/costUiLabels';
import { formatDateTime } from '../../../../../utils/format';

interface PurchaseCostResult {
  material_id: number;
  material_code: string;
  material_name: string;
  purchase_order_code?: string;
  source_type: string;
  quantity: number;
  purchase_price: number;
  purchase_fee: number;
  total_cost: number;
  unit_cost: number;
  cost_details: any;
  calculation_type: string;
  calculation_date: string;
  supplier_name?: string;
}

export interface PurchaseCostPageProps {
  embedded?: boolean;
}

const PurchaseCostPage: React.FC<PurchaseCostPageProps> = ({ embedded = false }) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const formRef = useRef<any>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [result, setResult] = useState<PurchaseCostResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState<any[]>([]);
  const [purchaseOrderOptions, setPurchaseOrderOptions] = useState<CostSelectOption[]>([]);
  const [purchaseOrderItemOptions, setPurchaseOrderItemOptions] = useState<CostSelectOption[]>([]);
  const [calculationMode, setCalculationMode] = useState<'standard' | 'actual-item' | 'actual-order'>('standard');

  React.useEffect(() => {
    const loadMaterials = async () => {
      try {
        const list = await materialApi.list({ limit: 1000, isActive: true });
        const rows = normalizeCostListRows(list);
        setMaterials(rows.filter((m) => (m.sourceType || m.source_type) === 'Buy'));
      } catch (error: any) {
        console.error('load materials failed:', error);
      }
    };
    loadMaterials();
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [po, poi] = await Promise.all([
          loadPurchaseOrderSelectOptions(200),
          loadPurchaseOrderItemSelectOptions(32),
        ]);
        if (!cancelled) {
          setPurchaseOrderOptions(po);
          setPurchaseOrderItemOptions(poi);
        }
      } catch (e) {
        console.error('load purchase orders failed:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCalculate = async (values: any) => {
    try {
      setLoading(true);
      const data: any = {
        calculation_date: values.calculation_date ? values.calculation_date.format('YYYY-MM-DD') : undefined,
      };
      if (calculationMode === 'standard') {
        data.material_id = values.material_id;
        data.quantity = values.quantity;
      } else if (calculationMode === 'actual-item') {
        data.purchase_order_item_id = values.purchase_order_item_id;
      } else {
        data.purchase_order_id = values.purchase_order_id;
      }
      const res = await purchaseCostApi.calculate(data);
      setResult(res);
      messageApi.success(t('app.kuaicaiwu.purchaseCost.calculateSuccess'));
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaicaiwu.purchaseCost.calculateFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (mode: 'standard' | 'actual-item' | 'actual-order') => {
    setCalculationMode(mode);
    setModalVisible(true);
    setResult(null);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ calculation_date: dayjs(), quantity: 1 });
  };

  const resultColumns = useMemo(
    () => [
      { title: t('app.kuaicaiwu.costCommon.col.materialCode'), dataIndex: 'material_code' },
      { title: t('app.kuaicaiwu.costCommon.col.materialName'), dataIndex: 'material_name' },
      {
        title: t('app.kuaicaiwu.purchaseCost.col.purchaseOrderCode'),
        dataIndex: 'purchase_order_code',
        hide: !result?.purchase_order_code,
      },
      { title: t('app.kuaicaiwu.costCommon.col.supplier'), dataIndex: 'supplier_name', hide: !result?.supplier_name },
      { title: t('app.kuaicaiwu.costCommon.col.sourceType'), dataIndex: 'source_type' },
      { title: t('app.kuaicaiwu.costCommon.col.quantity'), dataIndex: 'quantity' },
      { title: t('app.kuaicaiwu.purchaseCost.col.purchasePrice'), dataIndex: 'purchase_price' },
      { title: t('app.kuaicaiwu.purchaseCost.col.purchaseFee'), dataIndex: 'purchase_fee' },
      { title: t('app.kuaicaiwu.costCommon.col.totalCost'), dataIndex: 'total_cost' },
      { title: t('app.kuaicaiwu.costCommon.col.unitCost'), dataIndex: 'unit_cost' },
      { title: t('app.kuaicaiwu.costCommon.col.calculationType'), dataIndex: 'calculation_type' },
      { title: t('app.kuaicaiwu.costCommon.col.calculationDate'), dataIndex: 'calculation_date' },
    ],
    [t, result],
  );

  const modalTitle =
    calculationMode === 'standard'
      ? t('app.kuaicaiwu.purchaseCost.modalStandard')
      : calculationMode === 'actual-item'
        ? t('app.kuaicaiwu.purchaseCost.modalActualItem')
        : t('app.kuaicaiwu.purchaseCost.modalActualOrder');

  return (
    <PageContainer
      ghost={embedded}
      title={embedded ? false : t('app.kuaicaiwu.purchaseCost.title')}
      extra={[
        <Button key="standard" type="primary" icon={<CalculatorOutlined />} onClick={() => handleOpenModal('standard')}>
          {t('app.kuaicaiwu.purchaseCost.calculateStandard')}
        </Button>,
        <Button key="item" icon={<CalculatorOutlined />} onClick={() => handleOpenModal('actual-item')}>
          {t('app.kuaicaiwu.purchaseCost.calculateActualItem')}
        </Button>,
        <Button key="order" icon={<CalculatorOutlined />} onClick={() => handleOpenModal('actual-order')}>
          {t('app.kuaicaiwu.purchaseCost.calculateActualOrder')}
        </Button>,
      ]}
    >
      {result && (
        <Card title={t('app.kuaicaiwu.costCommon.resultTitle')} style={{ marginBottom: 16 }}>
          <ProDescriptions
            bordered
            column={2}
            dataSource={{
              material_code: result.material_code,
              material_name: result.material_name,
              purchase_order_code: result.purchase_order_code,
              supplier_name: result.supplier_name,
              source_type: getSourceTypeTag('Buy', t),
              quantity: result.quantity,
              purchase_price: `¥${result.purchase_price?.toFixed(2)}`,
              purchase_fee: `¥${result.purchase_fee?.toFixed(2)}`,
              total_cost: (
                <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#1890ff' }}>
                  ¥{result.total_cost?.toFixed(2)}
                </span>
              ),
              unit_cost: `¥${result.unit_cost?.toFixed(2)}`,
              calculation_type: formatCalculationType(result.calculation_type, t),
              calculation_date: result.calculation_date ? formatDateTime(result.calculation_date, 'YYYY-MM-DD') : '-',
            }}
            columns={resultColumns}
          />
          {result.cost_details && (
            <>
              <Divider>{t('app.kuaicaiwu.costCommon.costDetails')}</Divider>
              <div style={{ maxHeight: 400, overflow: 'auto' }}>
                <StructuredCostDataView data={result.cost_details} />
              </div>
            </>
          )}
        </Card>
      )}

      <FormModalTemplate
        title={modalTitle}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setResult(null);
        }}
        formRef={formRef}
        onFinish={handleCalculate}
        loading={loading}
        width={MODAL_CONFIG.SMALL_WIDTH}
      >
        {calculationMode === 'standard' ? (
          <>
            <ProFormSelect
              name="material_id"
              label={t('app.kuaicaiwu.costCommon.field.material')}
              placeholder={t('app.kuaicaiwu.purchaseCost.field.materialPlaceholder')}
              rules={[{ required: true, message: t('app.kuaicaiwu.costCommon.field.materialRequired') }]}
              options={materials.map((m) => ({
                label: `${m.mainCode || m.code} - ${m.name}`,
                value: m.id,
              }))}
              fieldProps={{
                showSearch: true,
                filterOption: (input: string, option: any) =>
                  option?.label?.toLowerCase().includes(input.toLowerCase()),
              }}
            />
            <ProFormDigit
              name="quantity"
              label={t('app.kuaicaiwu.costCommon.col.quantity')}
              placeholder={t('app.kuaicaiwu.costCommon.field.quantityPlaceholder')}
              rules={[
                { required: true, message: t('app.kuaicaiwu.costCommon.field.quantityRequired') },
                { type: 'number', min: 0.0001, message: t('app.kuaicaiwu.costCommon.field.quantityMin') },
              ]}
              fieldProps={{ precision: 4, style: { width: '100%' } }}
            />
          </>
        ) : calculationMode === 'actual-item' ? (
          <ProFormSelect
            name="purchase_order_item_id"
            label={t('app.kuaicaiwu.purchaseCost.field.purchaseOrderItem')}
            placeholder={t('app.kuaicaiwu.purchaseCost.field.purchaseOrderItemPlaceholder')}
            rules={[{ required: true, message: t('app.kuaicaiwu.purchaseCost.field.purchaseOrderItemRequired') }]}
            options={purchaseOrderItemOptions}
            showSearch
            fieldProps={{
              optionFilterProp: 'label',
              filterOption: (input: string, option: any) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
            }}
          />
        ) : (
          <ProFormSelect
            name="purchase_order_id"
            label={t('app.kuaicaiwu.purchaseCost.field.purchaseOrder')}
            placeholder={t('app.kuaicaiwu.purchaseCost.field.purchaseOrderPlaceholder')}
            rules={[{ required: true, message: t('app.kuaicaiwu.purchaseCost.field.purchaseOrderRequired') }]}
            options={purchaseOrderOptions}
            showSearch
            fieldProps={{
              optionFilterProp: 'label',
              filterOption: (input: string, option: any) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
            }}
          />
        )}
        <ProFormDatePicker
          name="calculation_date"
          label={t('app.kuaicaiwu.costCommon.col.calculationDate')}
          placeholder={t('app.kuaicaiwu.costCommon.field.calculationDatePlaceholder')}
          fieldProps={{ style: { width: '100%' } }}
        />
      </FormModalTemplate>
    </PageContainer>
  );
};

export default PurchaseCostPage;
