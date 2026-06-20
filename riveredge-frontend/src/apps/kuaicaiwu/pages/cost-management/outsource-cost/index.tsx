/**
 * 委外成本核算页面
 */

import React, { useMemo, useRef, useState } from 'react';
import { ProFormSelect, ProFormDigit, ProFormDatePicker, PageContainer, ProDescriptions } from '@ant-design/pro-components';
import { App, Button, Card, Divider } from 'antd';
import { CalculatorOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { StructuredCostDataView } from '../../../../../components/structured-cost-data-view';
import { outsourceCostApi } from '../../../services/cost';
import { materialApi } from '../../../../master-data/services/material';
import dayjs from 'dayjs';
import { loadOutsourceWorkOrderSelectOptions, normalizeCostListRows, type CostSelectOption } from '../costSelectData';
import { formatCalculationType, getSourceTypeTag } from '../../../utils/costUiLabels';
import { formatDateTime } from '../../../../../utils/format';

interface OutsourceCostResult {
  material_id?: number;
  material_code?: string;
  material_name?: string;
  outsource_work_order_id?: number;
  outsource_work_order_code?: string;
  source_type: string;
  quantity: number;
  material_cost: number;
  processing_cost: number;
  total_cost: number;
  unit_cost: number;
  cost_details: any;
  calculation_type: string;
  calculation_date: string;
  supplier_name?: string;
}

export interface OutsourceCostPageProps {
  embedded?: boolean;
}

const OutsourceCostPage: React.FC<OutsourceCostPageProps> = ({ embedded = false }) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const formRef = useRef<any>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [result, setResult] = useState<OutsourceCostResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState<any[]>([]);
  const [outsourceWorkOrderOptions, setOutsourceWorkOrderOptions] = useState<CostSelectOption[]>([]);
  const [calculationMode, setCalculationMode] = useState<'standard' | 'actual'>('standard');

  React.useEffect(() => {
    const loadMaterials = async () => {
      try {
        const list = await materialApi.list({ limit: 1000, isActive: true });
        const rows = normalizeCostListRows(list);
        setMaterials(rows.filter((m) => (m.sourceType || m.source_type) === 'Outsource'));
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
        const opts = await loadOutsourceWorkOrderSelectOptions(400);
        if (!cancelled) setOutsourceWorkOrderOptions(opts);
      } catch (e) {
        console.error('load outsource work orders failed:', e);
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
      } else {
        data.outsource_work_order_id = values.outsource_work_order_id;
      }
      const res = await outsourceCostApi.calculate(data);
      setResult(res);
      messageApi.success(t('app.kuaicaiwu.outsourceCost.calculateSuccess'));
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaicaiwu.outsourceCost.calculateFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (mode: 'standard' | 'actual') => {
    setCalculationMode(mode);
    setModalVisible(true);
    setResult(null);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ calculation_date: dayjs(), quantity: 1 });
  };

  const resultColumns = useMemo(
    () => [
      { title: t('app.kuaicaiwu.costCommon.col.materialCode'), dataIndex: 'material_code', hide: !result?.material_code },
      { title: t('app.kuaicaiwu.costCommon.col.materialName'), dataIndex: 'material_name', hide: !result?.material_name },
      {
        title: t('app.kuaicaiwu.outsourceCost.col.outsourceWorkOrderCode'),
        dataIndex: 'outsource_work_order_code',
        hide: !result?.outsource_work_order_code,
      },
      { title: t('app.kuaicaiwu.costCommon.col.supplier'), dataIndex: 'supplier_name', hide: !result?.supplier_name },
      { title: t('app.kuaicaiwu.costCommon.col.sourceType'), dataIndex: 'source_type' },
      { title: t('app.kuaicaiwu.costCommon.col.quantity'), dataIndex: 'quantity' },
      { title: t('app.kuaicaiwu.costCommon.col.materialCost'), dataIndex: 'material_cost' },
      { title: t('app.kuaicaiwu.outsourceCost.col.processingCost'), dataIndex: 'processing_cost' },
      { title: t('app.kuaicaiwu.costCommon.col.totalCost'), dataIndex: 'total_cost' },
      { title: t('app.kuaicaiwu.costCommon.col.unitCost'), dataIndex: 'unit_cost' },
      { title: t('app.kuaicaiwu.costCommon.col.calculationType'), dataIndex: 'calculation_type' },
      { title: t('app.kuaicaiwu.costCommon.col.calculationDate'), dataIndex: 'calculation_date' },
    ],
    [t, result],
  );

  const modalTitle =
    calculationMode === 'standard'
      ? t('app.kuaicaiwu.outsourceCost.modalStandard')
      : t('app.kuaicaiwu.outsourceCost.modalActual');

  return (
    <PageContainer
      ghost={embedded}
      title={embedded ? false : t('app.kuaicaiwu.outsourceCost.title')}
      extra={[
        <Button key="standard" type="primary" icon={<CalculatorOutlined />} onClick={() => handleOpenModal('standard')}>
          {t('app.kuaicaiwu.outsourceCost.calculateStandard')}
        </Button>,
        <Button key="actual" icon={<CalculatorOutlined />} onClick={() => handleOpenModal('actual')}>
          {t('app.kuaicaiwu.outsourceCost.calculateActual')}
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
              outsource_work_order_code: result.outsource_work_order_code,
              supplier_name: result.supplier_name,
              source_type: getSourceTypeTag('Outsource', t),
              quantity: result.quantity,
              material_cost: `¥${result.material_cost?.toFixed(2)}`,
              processing_cost: `¥${result.processing_cost?.toFixed(2)}`,
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
              placeholder={t('app.kuaicaiwu.outsourceCost.field.materialPlaceholder')}
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
        ) : (
          <ProFormSelect
            name="outsource_work_order_id"
            label={t('app.kuaicaiwu.outsourceCost.field.outsourceWorkOrder')}
            placeholder={t('app.kuaicaiwu.outsourceCost.field.outsourceWorkOrderPlaceholder')}
            rules={[{ required: true, message: t('app.kuaicaiwu.outsourceCost.field.outsourceWorkOrderRequired') }]}
            options={outsourceWorkOrderOptions}
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

export default OutsourceCostPage;
