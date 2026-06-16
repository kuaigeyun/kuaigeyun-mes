/**
 * 月度成本结转向导页面
 */

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Form, Table, Typography, Alert, Divider, Result, Button, Space } from 'antd';
import { ProForm, ProFormDatePicker, ProFormMoney } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { WizardTemplate, DetailDrawerSection } from '../../../../../components/layout-templates';
import { costCalculationApi } from '../../../services/cost';
import { apiRequest } from '../../../../../services/api';
import dayjs from 'dayjs';

const { Text } = Typography;

type ProductionRow = {
  key: string;
  product: string;
  quantity: number;
  hours: number;
  material_cost: number;
};

const MonthlySettlementPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const [settlementData, setSettlementData] = useState<{
    period: dayjs.Dayjs;
    productionData: ProductionRow[];
    indirectCosts: { payroll: number; electricity: number; rent: number };
    totalHours?: number;
  }>({
    period: dayjs().subtract(1, 'month'),
    productionData: [],
    indirectCosts: { payroll: 0, electricity: 0, rent: 0 },
  });

  const fetchSummary = async (date: dayjs.Dayjs) => {
    setLoading(true);
    try {
      const resp = await costCalculationApi.getPeriodSummary(date.year(), date.month() + 1);
      setSettlementData((prev) => ({
        ...prev,
        productionData: resp.items.map((item: any) => ({
          key: String(item.product_id ?? item.id ?? Math.random()),
          product: item.product_name,
          quantity: item.quantity,
          hours: item.hours,
          material_cost: item.material_cost || item.quantity * 10,
        })),
        totalHours: resp.total_hours,
      }));
    } catch {
      messageApi.error(t('app.kuaicaiwu.monthlySettlement.fetchSummaryFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (currentStep === 0) {
      fetchSummary(settlementData.period);
    }
    setCurrentStep(currentStep + 1);
  };
  const handlePrev = () => setCurrentStep(currentStep - 1);

  const [payrollImportHint, setPayrollImportHint] = useState<string>('');

  const handleImportPayrollFromPerformance = async () => {
    const period = settlementData.period.format('YYYY-MM');
    try {
      const res = await apiRequest<{ period: string; total_amount: number; employee_count: number }>(
        '/apps/master-data/performance/summaries/payroll-total',
        { params: { period } },
      );
      form.setFieldValue('payroll', res.total_amount);
      setPayrollImportHint(
        t('app.kuaicaiwu.monthlySettlement.payrollImportHint', {
          period,
          count: res.employee_count,
          amount: res.total_amount.toFixed(2),
        }),
      );
      messageApi.success(t('app.kuaicaiwu.monthlySettlement.payrollImportSuccess'));
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaicaiwu.monthlySettlement.payrollImportFailed'));
    }
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      const values = await form.validateFields();
      await costCalculationApi.performMonthlySettlement({
        year: settlementData.period.year(),
        month: settlementData.period.month() + 1,
        indirect_costs: values,
      });
      messageApi.success(t('app.kuaicaiwu.monthlySettlement.settlementSuccess'));
      setCurrentStep(4);
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaicaiwu.monthlySettlement.settlementFailed'));
    } finally {
      setLoading(false);
    }
  };

  const productionSummaryColumns = useMemo(
    () => [
      { title: t('app.kuaicaiwu.monthlySettlement.col.productName'), dataIndex: 'product', ellipsis: true },
      { title: t('app.kuaicaiwu.monthlySettlement.col.finishedQty'), dataIndex: 'quantity', width: 120 },
      { title: t('app.kuaicaiwu.monthlySettlement.col.totalHours'), dataIndex: 'hours', width: 120 },
      {
        title: t('app.kuaicaiwu.monthlySettlement.col.materialCostCollected'),
        dataIndex: 'material_cost',
        width: 160,
        render: (val: number) => `￥${val.toLocaleString()}`,
      },
    ],
    [t],
  );

  const previewColumns = useMemo(
    () => [
      { title: t('app.kuaicaiwu.monthlySettlement.col.productName'), dataIndex: 'product', ellipsis: true },
      { title: t('app.kuaicaiwu.monthlySettlement.col.finishedQty'), dataIndex: 'quantity', width: 120 },
      {
        title: t('app.kuaicaiwu.monthlySettlement.col.allocatedLabor'),
        dataIndex: 'allocated_labor',
        width: 140,
        render: (val: string) => `￥${val}`,
      },
      {
        title: t('app.kuaicaiwu.monthlySettlement.col.estimatedUnitCost'),
        dataIndex: 'total_unit_cost',
        width: 140,
        render: (val: string) => `￥${val}`,
      },
    ],
    [t],
  );

  const periodLabel = settlementData.period.format('YYYY-MM');

  const steps = [
    {
      title: t('app.kuaicaiwu.monthlySettlement.step.selectPeriod'),
      content: (
        <DetailDrawerSection title={t('app.kuaicaiwu.monthlySettlement.section.periodSelect')}>
          <Alert title={t('app.kuaicaiwu.monthlySettlement.periodHint')} type="info" showIcon style={{ marginBottom: 24 }} />
          <ProForm submitter={false}>
            <ProFormDatePicker
              name="period"
              label={t('app.kuaicaiwu.monthlySettlement.field.period')}
              picker="month"
              initialValue={settlementData.period}
              fieldProps={{
                onChange: (val: dayjs.Dayjs | null) =>
                  setSettlementData((prev) => ({ ...prev, period: val ? val : prev.period })),
              }}
              rules={[{ required: true }]}
            />
          </ProForm>
        </DetailDrawerSection>
      ),
    },
    {
      title: t('app.kuaicaiwu.monthlySettlement.step.productionReview'),
      content: (
        <DetailDrawerSection title={t('app.kuaicaiwu.monthlySettlement.section.productionSummary', { period: periodLabel })}>
          <Text type="secondary">{t('app.kuaicaiwu.monthlySettlement.productionReviewHint')}</Text>
          <div style={{ marginTop: 16, overflowX: 'auto', overflowY: 'hidden' }}>
            <Table<ProductionRow>
              dataSource={settlementData.productionData}
              pagination={false}
              scroll={{ x: 'max-content' }}
              columns={productionSummaryColumns}
            />
          </div>
        </DetailDrawerSection>
      ),
    },
    {
      title: t('app.kuaicaiwu.monthlySettlement.step.costEntry'),
      content: (
        <DetailDrawerSection title={t('app.kuaicaiwu.monthlySettlement.section.costEntry')}>
          <Text type="secondary">{t('app.kuaicaiwu.monthlySettlement.costEntryHint')}</Text>
          <Divider />
          <Space style={{ marginBottom: 16 }}>
            <Button onClick={handleImportPayrollFromPerformance}>{t('app.kuaicaiwu.monthlySettlement.importPayroll')}</Button>
          </Space>
          {payrollImportHint ? <Alert type="info" title={payrollImportHint} showIcon style={{ marginBottom: 16 }} /> : null}
          <Form form={form} layout="vertical" initialValues={settlementData.indirectCosts}>
            <ProFormMoney
              name="payroll"
              label={t('app.kuaicaiwu.monthlySettlement.field.payroll')}
              placeholder={t('app.kuaicaiwu.monthlySettlement.field.payrollPlaceholder')}
              rules={[{ required: true }]}
            />
            <ProFormMoney name="electricity" label={t('app.kuaicaiwu.monthlySettlement.field.electricity')} placeholder={t('app.kuaicaiwu.monthlySettlement.field.electricityPlaceholder')} />
            <ProFormMoney name="rent" label={t('app.kuaicaiwu.monthlySettlement.field.rent')} placeholder={t('app.kuaicaiwu.monthlySettlement.field.rentPlaceholder')} />
          </Form>
        </DetailDrawerSection>
      ),
    },
    {
      title: t('app.kuaicaiwu.monthlySettlement.step.preview'),
      content: (
        <DetailDrawerSection title={t('app.kuaicaiwu.monthlySettlement.section.preview')}>
          <Alert message={t('app.kuaicaiwu.monthlySettlement.previewHint')} type="warning" showIcon style={{ marginBottom: 24 }} />
          <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
            <Table
              dataSource={settlementData.productionData.map((item) => {
                const payroll = form.getFieldValue('payroll') || 0;
                const totalHours = settlementData.totalHours || 1;
                const ratio = item.hours / totalHours;
                const allocated_labor = payroll * ratio;
                const total_cost = item.material_cost + allocated_labor;
                return {
                  ...item,
                  allocated_labor: allocated_labor.toFixed(2),
                  total_unit_cost: (total_cost / (item.quantity || 1)).toFixed(2),
                };
              })}
              pagination={false}
              scroll={{ x: 'max-content' }}
              columns={previewColumns}
            />
          </div>
        </DetailDrawerSection>
      ),
    },
    {
      title: t('app.kuaicaiwu.monthlySettlement.step.done'),
      content: (
        <DetailDrawerSection title={t('app.kuaicaiwu.monthlySettlement.section.done')} marginBottom={0}>
          <Result
            status="success"
            title={t('app.kuaicaiwu.monthlySettlement.doneTitle')}
            subTitle={t('app.kuaicaiwu.monthlySettlement.doneSubtitle', { period: periodLabel })}
            extra={[
              <Button
                type="primary"
                key="view"
                onClick={() => navigate('/apps/kuaicaiwu/cost-management/cost-report')}
              >
                {t('app.kuaicaiwu.monthlySettlement.viewReport')}
              </Button>,
              <Button key="back" onClick={() => setCurrentStep(0)}>
                {t('app.kuaicaiwu.monthlySettlement.settleAgain')}
              </Button>,
            ]}
          />
        </DetailDrawerSection>
      ),
    },
  ];

  return (
    <WizardTemplate
      steps={steps}
      current={currentStep}
      onStepChange={setCurrentStep}
      onPrev={handlePrev}
      onNext={handleNext}
      onFinish={handleFinish}
      finishText={t('app.kuaicaiwu.monthlySettlement.finishText')}
      finishDisabled={loading}
    />
  );
};

export default MonthlySettlementPage;
