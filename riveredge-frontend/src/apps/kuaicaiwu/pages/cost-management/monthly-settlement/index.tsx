/**
 * 月度成本结转向导页面
 *
 * 提供月度成本结转的步骤式操作，引导用户完成：
 * 1. 选择核算期间
 * 2. 核对产量与工时数据
 * 3. 录入当期费用单据
 * 4. 预览分配结果并结转
 *
 * Author: Luigi Lu
 * Date: 2026-03-27
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Form, Table, Typography, Alert, Divider, Result, Button, Space } from 'antd';
import { ProForm, ProFormDatePicker, ProFormMoney } from '@ant-design/pro-components';
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
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  // 业务数据状态
  const [settlementData, setSettlementData] = useState<{
    period: dayjs.Dayjs;
    productionData: ProductionRow[];
    indirectCosts: { payroll: number; electricity: number; rent: number };
    totalHours?: number;
  }>({
    period: dayjs().subtract(1, 'month'),
    productionData: [],
    indirectCosts: {
      payroll: 0,
      electricity: 0,
      rent: 0,
    },
  });

  const fetchSummary = async (date: any) => {
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
    } catch (error) {
      messageApi.error('获取生产摘要失败');
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
      setPayrollImportHint(`已从 ${period} 绩效已确认汇总导入（${res.employee_count} 人，合计 ¥${res.total_amount.toFixed(2)}），可手工调整`);
      messageApi.success('已填入绩效薪资参考总额');
    } catch (error: any) {
      messageApi.error(error?.message || '导入失败，请确认该月绩效已确认');
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
      messageApi.success('月度成本结转成功');
      setCurrentStep(4); // 完成页
    } catch (error: any) {
      messageApi.error(error.message || '结转失败');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    {
      title: '选择期间',
      content: (
        <DetailDrawerSection title="核算期间选择">
          <Alert message="通常在次月初对上月的成本进行结转核算。" type="info" showIcon style={{ marginBottom: 24 }} />
          <ProForm submitter={false}>
            <ProFormDatePicker
              name="period"
              label="核算月份"
              picker="month"
              initialValue={settlementData.period}
              fieldProps={{
                onChange: (val: any) =>
                  setSettlementData((prev) => ({ ...prev, period: val ? (val as dayjs.Dayjs) : prev.period })),
              }}
              rules={[{ required: true }]}
            />
          </ProForm>
        </DetailDrawerSection>
      ),
    },
    {
      title: '产量与工时核对',
      content: (
        <DetailDrawerSection title={`${settlementData.period.format('YYYY年MM月')} 生产数据摘要`}>
          <Text type="secondary">系统已根据当期报工记录提取以下产量与总工时数据，请核对：</Text>
          <div style={{ marginTop: 16, overflowX: 'auto', overflowY: 'hidden' }}>
            <Table<ProductionRow>
              dataSource={settlementData.productionData}
              pagination={false}
              scroll={{ x: 'max-content' }}
              columns={[
                { title: '产品名称', dataIndex: 'product', ellipsis: true },
                { title: '完工数量', dataIndex: 'quantity', width: 120 },
                { title: '总报工工时', dataIndex: 'hours', width: 120 },
                {
                  title: '已归集材料成本',
                  dataIndex: 'material_cost',
                  width: 160,
                  render: (val: number) => `￥${val.toLocaleString()}`,
                },
              ]}
            />
          </div>
        </DetailDrawerSection>
      ),
    },
    {
      title: '费用录入',
      content: (
        <DetailDrawerSection title="录入当期待分摊费用">
          <Text type="secondary">请输入当期发生的制造费用、人工工资等，系统将按照预设规则进行自动分摊。</Text>
          <Divider />
          <Space style={{ marginBottom: 16 }}>
            <Button onClick={handleImportPayrollFromPerformance}>从绩效导入薪资总额</Button>
          </Space>
          {payrollImportHint ? <Alert type="info" message={payrollImportHint} showIcon style={{ marginBottom: 16 }} /> : null}
          <Form form={form} layout="vertical" initialValues={settlementData.indirectCosts}>
            <ProFormMoney name="payroll" label="当期生产人员薪资总额" placeholder="请输入薪资总额" rules={[{ required: true }]} />
            <ProFormMoney name="electricity" label="当期电费/动力费" placeholder="请输入电量费用" />
            <ProFormMoney name="rent" label="厂房租赁及折旧费" placeholder="请输入租赁折旧费" />
          </Form>
        </DetailDrawerSection>
      ),
    },
    {
      title: '预览与结转',
      content: (
        <DetailDrawerSection title="预分摊结果预览">
          <Alert
            message="以下是模拟分摊后的单位成本预览，确认无误后点击结转按钮生成正式记录。"
            type="warning"
            showIcon
            style={{ marginBottom: 24 }}
          />
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
              columns={[
                { title: '产品名称', dataIndex: 'product', ellipsis: true },
                { title: '完工数量', dataIndex: 'quantity', width: 120 },
                { title: '分摊人工', dataIndex: 'allocated_labor', width: 140, render: (val: any) => `￥${val}` },
                { title: '预估单位成本', dataIndex: 'total_unit_cost', width: 140, render: (val: any) => `￥${val}` },
              ]}
            />
          </div>
        </DetailDrawerSection>
      ),
    },
    {
      title: '完成',
      content: (
        <DetailDrawerSection title="结转完成" marginBottom={0}>
          <Result
            status="success"
            title="月度成本结转完成"
            subTitle={`${settlementData.period.format('YYYY年MM月')} 的成本核算记录已成功存入系统。`}
            extra={[
              <Button
                type="primary"
                key="view"
                onClick={() => navigate('/apps/kuaicaiwu/cost-management/cost-report')}
              >
                查看成本报表
              </Button>,
              <Button key="back" onClick={() => setCurrentStep(0)}>
                再次核算
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
      finishText="执行正式结转"
      finishDisabled={loading}
    />
  );
};

export default MonthlySettlementPage;
