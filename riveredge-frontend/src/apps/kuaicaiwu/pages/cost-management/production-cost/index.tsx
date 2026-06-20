/**
 * 生产成本核算页面
 */

import React, { useMemo, useRef, useState } from 'react';
import { ProFormSelect, ProFormDigit, ProFormDatePicker, ProFormTextArea, PageContainer, ProDescriptions } from '@ant-design/pro-components';
import { App, Button, Card, Divider } from 'antd';
import { CalculatorOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { StructuredCostDataView } from '../../../../../components/structured-cost-data-view';
import { productionCostApi } from '../../../services/cost';
import { materialApi } from '../../../../master-data/services/material';
import dayjs from 'dayjs';
import { normalizeCostListRows } from '../costSelectData';
import { formatCalculationType, formatSourceType, getSourceTypeTag } from '../../../utils/costUiLabels';
import { formatDateTime } from '../../../../../utils/format';

interface ProductionCostResult {
  material_id: number;
  material_code: string;
  material_name: string;
  source_type: string;
  quantity: number;
  material_cost: number;
  labor_cost: number;
  manufacturing_cost: number;
  total_cost: number;
  unit_cost: number;
  cost_details: any;
  calculation_type: string;
  calculation_date: string;
}

export interface ProductionCostPageProps {
  embedded?: boolean;
}

const ProductionCostPage: React.FC<ProductionCostPageProps> = ({ embedded = false }) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const formRef = useRef<any>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [result, setResult] = useState<ProductionCostResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState<any[]>([]);

  React.useEffect(() => {
    const loadMaterials = async () => {
      try {
        const list = await materialApi.list({ limit: 1000, isActive: true });
        setMaterials(normalizeCostListRows(list));
      } catch (error: any) {
        console.error('load materials failed:', error);
      }
    };
    loadMaterials();
  }, []);

  const handleCalculate = async (values: any) => {
    try {
      setLoading(true);
      const data = {
        material_id: values.material_id,
        quantity: values.quantity,
        calculation_date: values.calculation_date ? values.calculation_date.format('YYYY-MM-DD') : undefined,
        variant_attributes: values.variant_attributes ? JSON.parse(values.variant_attributes) : undefined,
      };
      const res = await productionCostApi.calculate(data);
      setResult(res);
      messageApi.success(t('app.kuaicaiwu.productionCost.calculateSuccess'));
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaicaiwu.productionCost.calculateFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = () => {
    setModalVisible(true);
    setResult(null);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      calculation_date: dayjs(),
      quantity: 1,
    });
  };

  const resultColumns = useMemo(
    () => [
      { title: t('app.kuaicaiwu.costCommon.col.materialCode'), dataIndex: 'material_code' },
      { title: t('app.kuaicaiwu.costCommon.col.materialName'), dataIndex: 'material_name' },
      { title: t('app.kuaicaiwu.costCommon.col.sourceType'), dataIndex: 'source_type' },
      { title: t('app.kuaicaiwu.costCommon.col.quantity'), dataIndex: 'quantity' },
      { title: t('app.kuaicaiwu.costCommon.col.materialCost'), dataIndex: 'material_cost' },
      { title: t('app.kuaicaiwu.productionCost.col.processingCost'), dataIndex: 'labor_cost' },
      { title: t('app.kuaicaiwu.costCommon.col.manufacturingCost'), dataIndex: 'manufacturing_cost' },
      { title: t('app.kuaicaiwu.costCommon.col.totalCost'), dataIndex: 'total_cost' },
      { title: t('app.kuaicaiwu.costCommon.col.unitCost'), dataIndex: 'unit_cost' },
      { title: t('app.kuaicaiwu.costCommon.col.calculationType'), dataIndex: 'calculation_type' },
      { title: t('app.kuaicaiwu.costCommon.col.calculationDate'), dataIndex: 'calculation_date' },
    ],
    [t],
  );

  return (
    <PageContainer
      ghost={embedded}
      title={embedded ? false : t('app.kuaicaiwu.productionCost.title')}
      extra={[
        <Button key="calculate" type="primary" icon={<CalculatorOutlined />} onClick={handleOpenModal}>
          {t('app.kuaicaiwu.productionCost.calculate')}
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
              source_type: getSourceTypeTag(result.source_type, t),
              quantity: result.quantity,
              material_cost: `¥${result.material_cost?.toFixed(2)}`,
              labor_cost: `¥${result.labor_cost?.toFixed(2)}`,
              manufacturing_cost: `¥${result.manufacturing_cost?.toFixed(2)}`,
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
        title={t('app.kuaicaiwu.productionCost.modalTitle')}
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
        <ProFormSelect
          name="material_id"
          label={t('app.kuaicaiwu.costCommon.field.material')}
          placeholder={t('app.kuaicaiwu.costCommon.field.materialPlaceholder')}
          rules={[{ required: true, message: t('app.kuaicaiwu.costCommon.field.materialRequired') }]}
          options={materials
            .filter((m) => ['Make', 'Phantom', 'Configure'].includes(m.sourceType || m.source_type))
            .map((m) => ({
              label: `${m.mainCode || m.code} - ${m.name} (${formatSourceType(m.sourceType || m.source_type || 'Make', t)})`,
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
        <ProFormDatePicker
          name="calculation_date"
          label={t('app.kuaicaiwu.costCommon.col.calculationDate')}
          placeholder={t('app.kuaicaiwu.costCommon.field.calculationDatePlaceholder')}
          fieldProps={{ style: { width: '100%' } }}
        />
        <ProFormTextArea
          name="variant_attributes"
          label={t('app.kuaicaiwu.productionCost.field.variantAttributes')}
          placeholder={t('app.kuaicaiwu.productionCost.field.variantAttributesPlaceholder')}
          fieldProps={{ rows: 3 }}
        />
      </FormModalTemplate>
    </PageContainer>
  );
};

export default ProductionCostPage;
