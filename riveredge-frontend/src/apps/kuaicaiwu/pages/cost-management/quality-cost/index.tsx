/**
 * 质量成本核算页面
 */

import React, { useMemo, useRef, useState } from 'react';
import { ProFormSelect, ProFormDatePicker, PageContainer, ProDescriptions } from '@ant-design/pro-components';
import { App, Button, Card, Divider, Row, Col, Statistic } from 'antd';
import { CalculatorOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { StructuredCostDataView } from '../../../../../components/structured-cost-data-view';
import { qualityCostApi } from '../../../services/cost';
import { materialApi } from '../../../../master-data/services/material';
import dayjs from 'dayjs';
import { loadWorkOrderSelectOptions, normalizeCostListRows, type CostSelectOption } from '../costSelectData';
import { formatCalculationType } from '../../../utils/costUiLabels';
import { formatDateTime } from '../../../../../utils/format';

interface QualityCostResult {
  prevention_cost: number;
  appraisal_cost: number;
  internal_failure_cost: number;
  external_failure_cost: number;
  total_quality_cost: number;
  cost_details: any;
  calculation_type: string;
  calculation_date: string;
  start_date?: string;
  end_date?: string;
}

export interface QualityCostPageProps {
  embedded?: boolean;
}

const QualityCostPage: React.FC<QualityCostPageProps> = ({ embedded = false }) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const formRef = useRef<any>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [result, setResult] = useState<QualityCostResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState<any[]>([]);
  const [workOrderOptions, setWorkOrderOptions] = useState<CostSelectOption[]>([]);

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

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const opts = await loadWorkOrderSelectOptions(400);
        if (!cancelled) setWorkOrderOptions(opts);
      } catch (e) {
        console.error('load work orders failed:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCalculate = async (values: any) => {
    try {
      setLoading(true);
      const data = {
        start_date: values.start_date ? values.start_date.format('YYYY-MM-DD') : undefined,
        end_date: values.end_date ? values.end_date.format('YYYY-MM-DD') : undefined,
        material_id: values.material_id,
        work_order_id: values.work_order_id,
        calculation_date: values.calculation_date ? values.calculation_date.format('YYYY-MM-DD') : undefined,
      };
      const res = await qualityCostApi.calculate(data);
      setResult(res);
      messageApi.success(t('app.kuaicaiwu.qualityCost.calculateSuccess'));
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaicaiwu.qualityCost.calculateFailed'));
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
      start_date: dayjs().subtract(30, 'day'),
      end_date: dayjs(),
    });
  };

  const resultColumns = useMemo(
    () => [
      { title: t('app.kuaicaiwu.qualityCost.col.totalQualityCost'), dataIndex: 'total_quality_cost' },
      { title: t('app.kuaicaiwu.costCommon.col.calculationType'), dataIndex: 'calculation_type' },
      { title: t('app.kuaicaiwu.costCommon.col.startDate'), dataIndex: 'start_date', hide: !result?.start_date },
      { title: t('app.kuaicaiwu.costCommon.col.endDate'), dataIndex: 'end_date', hide: !result?.end_date },
      { title: t('app.kuaicaiwu.costCommon.col.calculationDate'), dataIndex: 'calculation_date' },
    ],
    [t, result],
  );

  return (
    <PageContainer
      ghost={embedded}
      title={embedded ? false : t('app.kuaicaiwu.qualityCost.title')}
      extra={[
        <Button key="calculate" type="primary" icon={<CalculatorOutlined />} onClick={handleOpenModal}>
          {t('app.kuaicaiwu.qualityCost.calculate')}
        </Button>,
      ]}
    >
      {result && (
        <Card title={t('app.kuaicaiwu.costCommon.resultTitle')} style={{ marginBottom: 16 }}>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic title={t('app.kuaicaiwu.qualityCost.col.preventionCost')} value={result.prevention_cost} prefix="¥" precision={2} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title={t('app.kuaicaiwu.qualityCost.col.appraisalCost')} value={result.appraisal_cost} prefix="¥" precision={2} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title={t('app.kuaicaiwu.qualityCost.col.internalFailureCost')} value={result.internal_failure_cost} prefix="¥" precision={2} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title={t('app.kuaicaiwu.qualityCost.col.externalFailureCost')} value={result.external_failure_cost} prefix="¥" precision={2} />
              </Card>
            </Col>
          </Row>

          <ProDescriptions
            bordered
            column={2}
            dataSource={{
              total_quality_cost: (
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#1890ff' }}>
                  ¥{result.total_quality_cost?.toFixed(2)}
                </span>
              ),
              calculation_type: formatCalculationType(result.calculation_type, t),
              start_date: result.start_date ? formatDateTime(result.start_date, 'YYYY-MM-DD') : undefined,
              end_date: result.end_date ? formatDateTime(result.end_date, 'YYYY-MM-DD') : undefined,
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
        title={t('app.kuaicaiwu.qualityCost.modalTitle')}
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
        <ProFormDatePicker
          name="start_date"
          label={t('app.kuaicaiwu.costCommon.col.startDate')}
          placeholder={t('app.kuaicaiwu.qualityCost.field.startDatePlaceholder')}
          fieldProps={{ style: { width: '100%' } }}
        />
        <ProFormDatePicker
          name="end_date"
          label={t('app.kuaicaiwu.costCommon.col.endDate')}
          placeholder={t('app.kuaicaiwu.qualityCost.field.endDatePlaceholder')}
          fieldProps={{ style: { width: '100%' } }}
        />
        <ProFormSelect
          name="material_id"
          label={t('app.kuaicaiwu.qualityCost.field.materialOptional')}
          placeholder={t('app.kuaicaiwu.qualityCost.field.materialOptionalPlaceholder')}
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
        <ProFormSelect
          name="work_order_id"
          label={t('app.kuaicaiwu.qualityCost.field.workOrderOptional')}
          placeholder={t('app.kuaicaiwu.qualityCost.field.workOrderOptionalPlaceholder')}
          allowClear
          options={workOrderOptions}
          showSearch
          fieldProps={{
            optionFilterProp: 'label',
            filterOption: (input: string, option: any) =>
              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
          }}
        />
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

export default QualityCostPage;
