/**
 * 成本对比页面
 */

import React, { useRef, useState } from 'react';
import { ProFormSelect, ProFormDigit, ProFormDatePicker, PageContainer } from '@ant-design/pro-components';
import { App, Button, Divider, Row, Col, Statistic, Alert, Descriptions, Typography, Empty, Timeline } from 'antd';
import { BarChartOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { ListPageTemplate, FormModalTemplate, DetailDrawerSection, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { costComparisonApi } from '../../../services/cost';
import { materialApi } from '../../../../master-data/services/material';
import dayjs from 'dayjs';
import {
  loadWorkOrderSelectOptions,
  loadOutsourceWorkOrderSelectOptions,
  loadPurchaseOrderSelectOptions,
  loadPurchaseOrderItemSelectOptions,
  normalizeCostListRows,
  type CostSelectOption,
} from '../costSelectData';
import {
  formatCalculationType,
  formatSourceType,
  formatVarianceType,
  getSourceTypeTag,
  getVarianceTypeTag,
} from '../../../utils/costUiLabels';
import { formatDateTime } from '../../../../../utils/format';

interface CostComparisonResult {
  material_id: number;
  material_code: string;
  material_name: string;
  source_type: string;
  quantity: number;
  standard_cost: {
    total_cost: number;
    unit_cost: number;
    cost_details: any;
    calculation_type: string;
  };
  actual_cost: {
    total_cost: number;
    unit_cost: number;
    cost_details: any;
    calculation_type: string;
  };
  cost_variance: {
    total_cost_variance: number;
    total_cost_variance_rate: number;
    unit_cost_variance: number;
    unit_cost_variance_rate: number;
    variance_type: string;
  };
  calculation_date: string;
}

const CostComparisonPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const formRef = useRef<any>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [result, setResult] = useState<CostComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState<any[]>([]);
  const [costReferenceOptions, setCostReferenceOptions] = useState<{
    workOrders: CostSelectOption[];
    outsourceWorkOrders: CostSelectOption[];
    purchaseOrders: CostSelectOption[];
    purchaseOrderItems: CostSelectOption[];
  }>({ workOrders: [], outsourceWorkOrders: [], purchaseOrders: [], purchaseOrderItems: [] });

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
        const [wo, owo, po, poi] = await Promise.all([
          loadWorkOrderSelectOptions(400),
          loadOutsourceWorkOrderSelectOptions(400),
          loadPurchaseOrderSelectOptions(200),
          loadPurchaseOrderItemSelectOptions(32),
        ]);
        if (!cancelled) {
          setCostReferenceOptions({
            workOrders: wo,
            outsourceWorkOrders: owo,
            purchaseOrders: po,
            purchaseOrderItems: poi,
          });
        }
      } catch (e) {
        console.error('load reference options failed:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCompare = async (values: any) => {
    try {
      setLoading(true);
      const data = {
        material_id: values.material_id,
        quantity: values.quantity,
        work_order_id: values.work_order_id,
        purchase_order_id: values.purchase_order_id,
        purchase_order_item_id: values.purchase_order_item_id,
        outsource_work_order_id: values.outsource_work_order_id,
        calculation_date: values.calculation_date ? values.calculation_date.format('YYYY-MM-DD') : undefined,
      };
      const res = await costComparisonApi.compare(data);
      setResult(res);
      messageApi.success(t('app.kuaicaiwu.costComparison.compareSuccess'));
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaicaiwu.costComparison.compareFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = () => {
    setModalVisible(true);
    setResult(null);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ calculation_date: dayjs(), quantity: 1 });
  };

  return (
    <PageContainer
      title={t('app.kuaicaiwu.costComparison.title')}
      extra={[
        <Button key="compare" type="primary" icon={<BarChartOutlined />} onClick={handleOpenModal}>
          {t('app.kuaicaiwu.costComparison.compareButton')}
        </Button>,
      ]}
    >
      <ListPageTemplate>
        {!result ? (
          <Empty description={t('app.kuaicaiwu.costComparison.emptyHint')} />
        ) : (
          <>
            <DetailDrawerSection title={t('app.kuaicaiwu.costCommon.section.basicInfo')}>
              <Descriptions column={3} size="small" bordered>
                <Descriptions.Item label={t('app.kuaicaiwu.costCommon.col.materialCode')}>
                  <Typography.Text copyable={{ text: String(result.material_code ?? '') }}>
                    {result.material_code ?? '-'}
                  </Typography.Text>
                </Descriptions.Item>
                <Descriptions.Item label={t('app.kuaicaiwu.costCommon.col.materialName')}>{result.material_name ?? '-'}</Descriptions.Item>
                <Descriptions.Item label={t('app.kuaicaiwu.costCommon.col.sourceType')}>
                  {getSourceTypeTag(result.source_type, t)}
                </Descriptions.Item>
                <Descriptions.Item label={t('app.kuaicaiwu.costCommon.col.quantity')}>{result.quantity}</Descriptions.Item>
                <Descriptions.Item label={t('app.kuaicaiwu.costCommon.col.calculationDate')}>
                  {result.calculation_date ? formatDateTime(result.calculation_date, 'YYYY-MM-DD') : '-'}
                </Descriptions.Item>
                <Descriptions.Item label={t('app.kuaicaiwu.costComparison.col.varianceType')}>
                  {getVarianceTypeTag(result.cost_variance.variance_type, t)}
                </Descriptions.Item>
              </Descriptions>
            </DetailDrawerSection>

            <DetailDrawerSection title={t('app.kuaicaiwu.costCommon.section.lifecycle')}>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                {t('app.kuaicaiwu.costComparison.lifecycleHint')}
              </Typography.Paragraph>
            </DetailDrawerSection>

            <DetailDrawerSection title={t('app.kuaicaiwu.costCommon.section.details')}>
              <Typography.Text strong>{t('app.kuaicaiwu.costComparison.standardVsActual')}</Typography.Text>
              <Row gutter={16} style={{ marginTop: 8 }}>
                <Col xs={24} md={12}>
                  <Typography.Text type="secondary">{t('app.kuaicaiwu.costCommon.standardCost')}</Typography.Text>
                  <Divider style={{ margin: '8px 0' }} />
                  <Statistic title={t('app.kuaicaiwu.costCommon.col.totalCost')} value={result.standard_cost.total_cost} prefix="¥" precision={2} />
                  <Statistic style={{ marginTop: 12 }} title={t('app.kuaicaiwu.costCommon.col.unitCost')} value={result.standard_cost.unit_cost} prefix="¥" precision={2} />
                  <div style={{ marginTop: 12, fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>
                    {t('app.kuaicaiwu.costCommon.calculationTypeLabel', {
                      type: formatCalculationType(result.standard_cost.calculation_type, t),
                    })}
                  </div>
                </Col>
                <Col xs={24} md={12}>
                  <Typography.Text type="secondary">{t('app.kuaicaiwu.costCommon.actualCost')}</Typography.Text>
                  <Divider style={{ margin: '8px 0' }} />
                  <Statistic title={t('app.kuaicaiwu.costCommon.col.totalCost')} value={result.actual_cost.total_cost} prefix="¥" precision={2} />
                  <Statistic style={{ marginTop: 12 }} title={t('app.kuaicaiwu.costCommon.col.unitCost')} value={result.actual_cost.unit_cost} prefix="¥" precision={2} />
                  <div style={{ marginTop: 12, fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>
                    {t('app.kuaicaiwu.costCommon.calculationTypeLabel', {
                      type: formatCalculationType(result.actual_cost.calculation_type, t),
                    })}
                  </div>
                </Col>
              </Row>
              <Divider style={{ margin: '16px 0' }} />
              <Alert
                message={formatVarianceType(result.cost_variance.variance_type, t)}
                description={
                  <div>
                    <p>{t('app.kuaicaiwu.costComparison.totalVariance', { amount: result.cost_variance.total_cost_variance.toFixed(2) })}</p>
                    <p>{t('app.kuaicaiwu.costComparison.totalVarianceRate', { rate: result.cost_variance.total_cost_variance_rate.toFixed(2) })}</p>
                    <p>{t('app.kuaicaiwu.costComparison.unitVariance', { amount: result.cost_variance.unit_cost_variance.toFixed(2) })}</p>
                    <p>{t('app.kuaicaiwu.costComparison.unitVarianceRate', { rate: result.cost_variance.unit_cost_variance_rate.toFixed(2) })}</p>
                  </div>
                }
                type={
                  result.cost_variance.variance_type === '超支'
                    ? 'error'
                    : result.cost_variance.variance_type === '节约'
                      ? 'success'
                      : 'info'
                }
                showIcon
              />
              <Divider style={{ margin: '16px 0' }} />
              <Typography.Text strong>{t('app.kuaicaiwu.costComparison.structuredDetails')}</Typography.Text>
              <div style={{ overflowX: 'auto', overflowY: 'hidden', marginTop: 8 }}>
                <Row gutter={16}>
                  <Col xs={24} lg={12}>
                    <Typography.Text type="secondary">{t('app.kuaicaiwu.costComparison.standardDetails')}</Typography.Text>
                    <pre style={{ marginTop: 8, marginBottom: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 320, overflow: 'auto' }}>
                      {JSON.stringify(result.standard_cost.cost_details, null, 2)}
                    </pre>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Typography.Text type="secondary">{t('app.kuaicaiwu.costComparison.actualDetails')}</Typography.Text>
                    <pre style={{ marginTop: 8, marginBottom: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 320, overflow: 'auto' }}>
                      {JSON.stringify(result.actual_cost.cost_details, null, 2)}
                    </pre>
                  </Col>
                </Row>
              </div>
            </DetailDrawerSection>

            <DetailDrawerSection title={t('app.kuaicaiwu.costCommon.section.operationLog')}>
              <Timeline
                items={[
                  {
                    color: 'blue',
                    children: (
                      <>
                        {t('app.kuaicaiwu.costComparison.compareCompleted')} ·{' '}
                        {result.calculation_date
                          ? formatDateTime(result.calculation_date, 'YYYY-MM-DD')
                          : formatDateTime(new Date(), 'YYYY-MM-DD HH:mm:ss')}
                      </>
                    ),
                  },
                ]}
              />
            </DetailDrawerSection>
          </>
        )}
      </ListPageTemplate>

      <FormModalTemplate
        title={t('app.kuaicaiwu.costComparison.modalTitle')}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setResult(null);
        }}
        formRef={formRef}
        onFinish={handleCompare}
        loading={loading}
        width={MODAL_CONFIG.STANDARD_WIDTH}
      >
        <ProFormSelect
          name="material_id"
          label={t('app.kuaicaiwu.costCommon.field.material')}
          placeholder={t('app.kuaicaiwu.costCommon.field.materialPlaceholder')}
          rules={[{ required: true, message: t('app.kuaicaiwu.costCommon.field.materialRequired') }]}
          options={materials.map((m) => ({
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
          placeholder={t('app.kuaicaiwu.costComparison.field.quantityPlaceholder')}
          rules={[
            { required: true, message: t('app.kuaicaiwu.costCommon.field.quantityRequired') },
            { type: 'number', min: 0.0001, message: t('app.kuaicaiwu.costCommon.field.quantityMin') },
          ]}
          fieldProps={{ precision: 4, style: { width: '100%' } }}
        />
        <ProFormSelect
          name="work_order_id"
          label={t('app.kuaicaiwu.costComparison.field.workOrder')}
          placeholder={t('app.kuaicaiwu.costCommon.optional')}
          allowClear
          options={costReferenceOptions.workOrders}
          showSearch
          fieldProps={{
            optionFilterProp: 'label',
            filterOption: (input: string, option: any) =>
              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
          }}
        />
        <ProFormSelect
          name="purchase_order_id"
          label={t('app.kuaicaiwu.costComparison.field.purchaseOrder')}
          placeholder={t('app.kuaicaiwu.costCommon.optional')}
          allowClear
          options={costReferenceOptions.purchaseOrders}
          showSearch
          fieldProps={{
            optionFilterProp: 'label',
            filterOption: (input: string, option: any) =>
              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
          }}
        />
        <ProFormSelect
          name="purchase_order_item_id"
          label={t('app.kuaicaiwu.costComparison.field.purchaseOrderItem')}
          placeholder={t('app.kuaicaiwu.costCommon.optional')}
          allowClear
          options={costReferenceOptions.purchaseOrderItems}
          showSearch
          fieldProps={{
            optionFilterProp: 'label',
            filterOption: (input: string, option: any) =>
              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
          }}
        />
        <ProFormSelect
          name="outsource_work_order_id"
          label={t('app.kuaicaiwu.costComparison.field.outsourceWorkOrder')}
          placeholder={t('app.kuaicaiwu.costCommon.optional')}
          allowClear
          options={costReferenceOptions.outsourceWorkOrders}
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

export default CostComparisonPage;
