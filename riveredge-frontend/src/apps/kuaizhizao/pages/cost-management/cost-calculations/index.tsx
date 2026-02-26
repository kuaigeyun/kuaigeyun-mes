/**
 * 成本核算记录管理页面
 *
 * 提供成本核算记录的查看、工单成本核算、产品成本核算、成本对比、成本分析等功能。
 *
 * Author: Luigi Lu
 * Date: 2026-01-05
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptionsItemType, ProFormText, ProFormSelect, ProFormDigit, ProFormDatePicker, ProFormTextArea, ProForm, ProFormInstance } from '@ant-design/pro-components';
import { App, Button, Tag, Space, message, Modal, Tabs, Card, Statistic, Row, Col } from 'antd';
import { ProDescriptions } from '@ant-design/pro-components';
import { EyeOutlined, CalculatorOutlined, BarChartOutlined, LineChartOutlined, BulbOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, DetailDrawerTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { costCalculationApi } from '../../../services/cost';
import dayjs from 'dayjs';

interface CostCalculation {
  id?: number;
  uuid?: string;
  tenant_id?: number;
  calculation_no?: string;
  calculation_type?: string;
  work_order_id?: number;
  work_order_code?: string;
  product_id?: number;
  product_code?: string;
  product_name?: string;
  quantity?: number;
  material_cost?: number;
  labor_cost?: number;
  manufacturing_cost?: number;
  total_cost?: number;
  unit_cost?: number;
  cost_details?: any;
  calculation_date?: string;
  calculation_status?: string;
  remark?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: number;
  updated_by?: number;
  created_by_name?: string;
  updated_by_name?: string;
}

const CostCalculationPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [costCalculationDetail, setCostCalculationDetail] = useState<CostCalculation | null>(null);

  // Modal 相关状态（工单成本核算、产品成本核算、成本对比、成本分析）
  const [workOrderModalVisible, setWorkOrderModalVisible] = useState(false);
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [compareModalVisible, setCompareModalVisible] = useState(false);
  const [analyzeModalVisible, setAnalyzeModalVisible] = useState(false);
  const [optimizationModalVisible, setOptimizationModalVisible] = useState(false);
  const [compareData, setCompareData] = useState<any>(null);
  const [analyzeData, setAnalyzeData] = useState<any>(null);
  const [optimizationData, setOptimizationData] = useState<any>(null);
  const workOrderFormRef = useRef<any>(null);
  const productFormRef = useRef<any>(null);
  const compareFormRef = useRef<any>(null);
  const analyzeFormRef = useRef<any>(null);

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: CostCalculation) => {
    try {
      if (!record.uuid) {
        messageApi.error('核算记录UUID不存在');
        return;
      }
      const detail = await costCalculationApi.get(record.uuid);
      setCostCalculationDetail(detail);
      setDrawerVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || '获取核算记录详情失败');
    }
  };

  /**
   * 处理工单成本核算
   */
  const handleCalculateWorkOrder = () => {
    setWorkOrderModalVisible(true);
    workOrderFormRef.current?.resetFields();
    workOrderFormRef.current?.setFieldsValue({
      calculation_date: dayjs(),
    });
  };

  /**
   * 处理产品成本核算
   */
  const handleCalculateProduct = () => {
    setProductModalVisible(true);
    productFormRef.current?.resetFields();
    productFormRef.current?.setFieldsValue({
      calculation_date: dayjs(),
      calculation_type: '标准成本',
    });
  };

  /**
   * 处理成本对比
   */
  const handleCompare = () => {
    setCompareModalVisible(true);
    compareFormRef.current?.resetFields();
  };

  /**
   * 处理成本分析
   */
  const handleAnalyze = () => {
    setAnalyzeModalVisible(true);
    analyzeFormRef.current?.resetFields();
  };

  /**
   * 处理保存工单成本核算
   */
  const handleSaveWorkOrderCalculation = async (values: any) => {
    try {
      await costCalculationApi.calculateWorkOrderCost({
        work_order_id: values.work_order_id,
        calculation_date: values.calculation_date ? values.calculation_date.format('YYYY-MM-DD') : undefined,
        remark: values.remark,
      });
      messageApi.success('工单成本核算成功');
      setWorkOrderModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '工单成本核算失败');
    }
  };

  /**
   * 处理保存产品成本核算
   */
  const handleSaveProductCalculation = async (values: any) => {
    try {
      await costCalculationApi.calculateProductCost({
        product_id: values.product_id,
        quantity: values.quantity,
        calculation_date: values.calculation_date ? values.calculation_date.format('YYYY-MM-DD') : undefined,
        calculation_type: values.calculation_type,
        remark: values.remark,
      });
      messageApi.success('产品成本核算成功');
      setProductModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '产品成本核算失败');
    }
  };

  /**
   * 处理成本对比查询
   */
  const handleCompareQuery = async (values: any) => {
    try {
      const data = await costCalculationApi.compareCosts(values.product_id);
      setCompareData(data);
    } catch (error: any) {
      messageApi.error(error.message || '成本对比查询失败');
    }
  };

  /**
   * 处理成本分析查询
   */
  const handleAnalyzeQuery = async (values: any) => {
    try {
      const data = await costCalculationApi.analyzeCost(values.product_id);
      setAnalyzeData(data);
      
      // 获取成本优化建议
      const optimization = await costCalculationApi.getOptimization(values.product_id);
      setOptimizationData(optimization);
    } catch (error: any) {
      messageApi.error(error.message || '成本分析查询失败');
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<CostCalculation>[] = [
    {
      title: '核算单号',
      dataIndex: 'calculation_no',
      key: 'calculation_no',
      width: 150,
      fixed: 'left',
    },
    {
      title: '核算类型',
      dataIndex: 'calculation_type',
      key: 'calculation_type',
      width: 120,
      render: (text: string) => {
        const typeMap: Record<string, { color: string; text: string }> = {
          '工单成本': { color: 'blue', text: '工单成本' },
          '产品成本': { color: 'green', text: '产品成本' },
          '标准成本': { color: 'orange', text: '标准成本' },
          '实际成本': { color: 'red', text: '实际成本' },
        };
        const type = typeMap[text] || { color: 'default', text: text };
        return <Tag color={type.color}>{type.text}</Tag>;
      },
    },
    {
      title: '工单编码',
      dataIndex: 'work_order_code',
      key: 'work_order_code',
      width: 150,
    },
    {
      title: '产品编码',
      dataIndex: 'product_code',
      key: 'product_code',
      width: 150,
    },
    {
      title: '产品名称',
      dataIndex: 'product_name',
      key: 'product_name',
      width: 200,
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      render: (text: number) => text?.toFixed(2) || '0.00',
    },
    {
      title: '材料成本',
      dataIndex: 'material_cost',
      key: 'material_cost',
      width: 120,
      render: (text: number) => `¥${text?.toFixed(2) || '0.00'}`,
    },
    {
      title: '人工成本',
      dataIndex: 'labor_cost',
      key: 'labor_cost',
      width: 120,
      render: (text: number) => `¥${text?.toFixed(2) || '0.00'}`,
    },
    {
      title: '制造费用',
      dataIndex: 'manufacturing_cost',
      key: 'manufacturing_cost',
      width: 120,
      render: (text: number) => `¥${text?.toFixed(2) || '0.00'}`,
    },
    {
      title: '总成本',
      dataIndex: 'total_cost',
      key: 'total_cost',
      width: 120,
      render: (text: number) => `¥${text?.toFixed(2) || '0.00'}`,
    },
    {
      title: '单位成本',
      dataIndex: 'unit_cost',
      key: 'unit_cost',
      width: 120,
      render: (text: number) => `¥${text?.toFixed(2) || '0.00'}`,
    },
    {
      title: '核算状态',
      dataIndex: 'calculation_status',
      key: 'calculation_status',
      width: 100,
      render: (text: string) => {
        const statusMap: Record<string, { color: string; text: string }> = {
          '草稿': { color: 'default', text: '草稿' },
          '已核算': { color: 'processing', text: '已核算' },
          '已审核': { color: 'success', text: '已审核' },
        };
        const status = statusMap[text] || { color: 'default', text: text };
        return <Tag color={status.color}>{status.text}</Tag>;
      },
    },
    {
      title: '核算日期',
      dataIndex: 'calculation_date',
      key: 'calculation_date',
      width: 120,
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD') : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_: any, record: CostCalculation) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleDetail(record)}
        >
          详情
        </Button>
      ),
    },
  ];

  /**
   * 详情描述项
   */
  const detailItems: ProDescriptionsItemType<CostCalculation>[] = [
    {
      title: '核算单号',
      dataIndex: 'calculation_no',
    },
    {
      title: '核算类型',
      dataIndex: 'calculation_type',
    },
    {
      title: '工单编码',
      dataIndex: 'work_order_code',
    },
    {
      title: '产品编码',
      dataIndex: 'product_code',
    },
    {
      title: '产品名称',
      dataIndex: 'product_name',
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      render: (text: number) => text?.toFixed(2) || '0.00',
    },
    {
      title: '材料成本',
      dataIndex: 'material_cost',
      render: (text: number) => `¥${text?.toFixed(2) || '0.00'}`,
    },
    {
      title: '人工成本',
      dataIndex: 'labor_cost',
      render: (text: number) => `¥${text?.toFixed(2) || '0.00'}`,
    },
    {
      title: '制造费用',
      dataIndex: 'manufacturing_cost',
      render: (text: number) => `¥${text?.toFixed(2) || '0.00'}`,
    },
    {
      title: '总成本',
      dataIndex: 'total_cost',
      render: (text: number) => `¥${text?.toFixed(2) || '0.00'}`,
    },
    {
      title: '单位成本',
      dataIndex: 'unit_cost',
      render: (text: number) => `¥${text?.toFixed(2) || '0.00'}`,
    },
    {
      title: '成本明细',
      dataIndex: 'cost_details',
      render: (text: any) => text ? JSON.stringify(text, null, 2) : '-',
    },
    {
      title: '核算状态',
      dataIndex: 'calculation_status',
    },
    {
      title: '核算日期',
      dataIndex: 'calculation_date',
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD') : '-',
    },
    {
      title: '备注',
      dataIndex: 'remark',
    },
    {
      title: '创建人',
      dataIndex: 'created_by_name',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
  ];

  return (
    <ListPageTemplate
      title="成本核算记录管理"
      extra={[
        <Button
          key="work-order"
          type="primary"
          icon={<CalculatorOutlined />}
          onClick={handleCalculateWorkOrder}
        >
          工单成本核算
        </Button>,
        <Button
          key="product"
          type="primary"
          icon={<CalculatorOutlined />}
          onClick={handleCalculateProduct}
        >
          产品成本核算
        </Button>,
        <Button
          key="compare"
          icon={<BarChartOutlined />}
          onClick={handleCompare}
        >
          成本对比
        </Button>,
        <Button
          key="analyze"
          icon={<LineChartOutlined />}
          onClick={handleAnalyze}
        >
          成本分析
        </Button>,
      ]}
      actionRef={actionRef}
    >
      <UniTable<CostCalculation>
        actionRef={actionRef}
        request={async (params) => {
          const response = await costCalculationApi.list(params);
          return {
            data: response.items || [],
            success: true,
            total: response.total || 0,
          };
        }}
        columns={columns}
        rowKey="uuid"
        search={{
          labelWidth: 'auto',
        }}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
        }}
      />

      {/* 详情 Drawer */}
      <DetailDrawerTemplate
        title="成本核算记录详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        dataSource={costCalculationDetail}
        columns={detailItems}
      />

      {/* 工单成本核算 Modal */}
      <Modal
        title="工单成本核算"
        open={workOrderModalVisible}
        onCancel={() => setWorkOrderModalVisible(false)}
        footer={null}
        width={MODAL_CONFIG.SMALL_WIDTH}
      >
        <ProForm
          formRef={workOrderFormRef}
          onFinish={handleSaveWorkOrderCalculation}
          submitter={{
            searchConfig: {
              submitText: '核算',
            },
            resetButtonProps: {
              style: { display: 'none' },
            },
          }}
        >
          <ProFormText
            name="work_order_id"
            label="工单ID"
            placeholder="请输入工单ID"
            rules={[{ required: true, message: '请输入工单ID' }]}
          />
          <ProFormDatePicker
            name="calculation_date"
            label="核算日期"
            placeholder="请选择核算日期"
          />
          <ProFormTextArea
            name="remark"
            label="备注"
            placeholder="请输入备注"
            fieldProps={{
              rows: 3,
            }}
          />
        </ProForm>
      </Modal>

      {/* 产品成本核算 Modal */}
      <Modal
        title="产品成本核算"
        open={productModalVisible}
        onCancel={() => setProductModalVisible(false)}
        footer={null}
        width={MODAL_CONFIG.SMALL_WIDTH}
      >
        <ProForm
          formRef={productFormRef}
          onFinish={handleSaveProductCalculation}
          submitter={{
            searchConfig: {
              submitText: '核算',
            },
            resetButtonProps: {
              style: { display: 'none' },
            },
          }}
        >
          <ProFormText
            name="product_id"
            label="产品ID"
            placeholder="请输入产品ID"
            rules={[{ required: true, message: '请输入产品ID' }]}
          />
          <ProFormDigit
            name="quantity"
            label="数量"
            placeholder="请输入数量"
            rules={[{ required: true, message: '请输入数量' }]}
            min={0}
            fieldProps={{
              precision: 2,
            }}
          />
          <ProFormSelect
            name="calculation_type"
            label="核算类型"
            placeholder="请选择核算类型"
            options={[
              { label: '标准成本', value: '标准成本' },
              { label: '实际成本', value: '实际成本' },
            ]}
            rules={[{ required: true, message: '请选择核算类型' }]}
          />
          <ProFormDatePicker
            name="calculation_date"
            label="核算日期"
            placeholder="请选择核算日期"
          />
          <ProFormTextArea
            name="remark"
            label="备注"
            placeholder="请输入备注"
            fieldProps={{
              rows: 3,
            }}
          />
        </ProForm>
      </Modal>

      {/* 成本对比 Modal */}
      <Modal
        title="成本对比"
        open={compareModalVisible}
        onCancel={() => {
          setCompareModalVisible(false);
          setCompareData(null);
        }}
        footer={null}
        width={MODAL_CONFIG.STANDARD_WIDTH}
      >
        <ProForm
          formRef={compareFormRef}
          onFinish={handleCompareQuery}
          submitter={{
            searchConfig: {
              submitText: '查询',
            },
            resetButtonProps: {
              style: { display: 'none' },
            },
          }}
        >
          <ProFormText
            name="product_id"
            label="产品ID"
            placeholder="请输入产品ID"
            rules={[{ required: true, message: '请输入产品ID' }]}
          />
        </ProForm>
        {compareData && (
          <Card title="成本对比结果" style={{ marginTop: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <Statistic
                  title="标准成本"
                  value={compareData.standard_cost}
                  prefix="¥"
                  precision={2}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="实际成本"
                  value={compareData.actual_cost}
                  prefix="¥"
                  precision={2}
                />
              </Col>
            </Row>
            <Row gutter={16} style={{ marginTop: 16 }}>
              <Col span={12}>
                <Statistic
                  title="成本差异"
                  value={compareData.cost_difference}
                  prefix="¥"
                  precision={2}
                  valueStyle={{ color: compareData.cost_difference > 0 ? '#cf1322' : '#3f8600' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="成本差异率"
                  value={compareData.cost_difference_rate}
                  suffix="%"
                  precision={2}
                  valueStyle={{ color: compareData.cost_difference_rate > 0 ? '#cf1322' : '#3f8600' }}
                />
              </Col>
            </Row>
            <ProDescriptions
              title="成本明细差异"
              bordered
              style={{ marginTop: 16 }}
              dataSource={{
                material_cost_difference: `¥${compareData.material_cost_difference?.toFixed(2) || '0.00'}`,
                labor_cost_difference: `¥${compareData.labor_cost_difference?.toFixed(2) || '0.00'}`,
                manufacturing_cost_difference: `¥${compareData.manufacturing_cost_difference?.toFixed(2) || '0.00'}`,
              }}
              columns={[
                { title: '材料成本差异', dataIndex: 'material_cost_difference' },
                { title: '人工成本差异', dataIndex: 'labor_cost_difference' },
                { title: '制造费用差异', dataIndex: 'manufacturing_cost_difference' },
              ]}
            />
            {compareData.difference_analysis && (
              <div style={{ marginTop: 16 }}>
                <strong>差异原因分析：</strong>
                <p>{compareData.difference_analysis}</p>
              </div>
            )}
          </Card>
        )}
      </Modal>

      {/* 成本分析 Modal */}
      <Modal
        title="成本分析"
        open={analyzeModalVisible}
        onCancel={() => {
          setAnalyzeModalVisible(false);
          setAnalyzeData(null);
          setOptimizationData(null);
        }}
        footer={null}
        width={MODAL_CONFIG.LARGE_WIDTH}
      >
        <ProForm
          formRef={analyzeFormRef}
          onFinish={handleAnalyzeQuery}
          submitter={{
            searchConfig: {
              submitText: '查询',
            },
            resetButtonProps: {
              style: { display: 'none' },
            },
          }}
        >
          <ProFormText
            name="product_id"
            label="产品ID"
            placeholder="请输入产品ID"
            rules={[{ required: true, message: '请输入产品ID' }]}
          />
        </ProForm>
        {analyzeData && (
          <Tabs defaultActiveKey="1" style={{ marginTop: 16 }}>
            <Tabs.TabPane tab="成本构成" key="1">
              <Row gutter={16}>
                <Col span={8}>
                  <Card>
                    <Statistic
                      title="材料成本"
                      value={analyzeData.cost_composition?.材料成本 || 0}
                      prefix="¥"
                      precision={2}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card>
                    <Statistic
                      title="人工成本"
                      value={analyzeData.cost_composition?.人工成本 || 0}
                      prefix="¥"
                      precision={2}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card>
                    <Statistic
                      title="制造费用"
                      value={analyzeData.cost_composition?.制造费用 || 0}
                      prefix="¥"
                      precision={2}
                    />
                  </Card>
                </Col>
              </Row>
            </Tabs.TabPane>
            <Tabs.TabPane tab="成本趋势" key="2">
              <Card>
                <p>成本趋势图表（待实现）</p>
                <pre>{JSON.stringify(analyzeData.cost_trend, null, 2)}</pre>
              </Card>
            </Tabs.TabPane>
            <Tabs.TabPane tab="成本明细" key="3">
              <Card>
                <pre>{JSON.stringify(analyzeData.cost_breakdown, null, 2)}</pre>
              </Card>
            </Tabs.TabPane>
            {optimizationData && (
              <Tabs.TabPane tab="优化建议" key="4">
                <Card>
                  <Descriptions title="成本优化建议" bordered>
                    <Descriptions.Item label="优先级">
                      <Tag color={optimizationData.priority === '高' ? 'red' : optimizationData.priority === '中' ? 'orange' : 'green'}>
                        {optimizationData.priority}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="潜在节省">
                      ¥{optimizationData.potential_savings?.toFixed(2) || '0.00'}
                    </Descriptions.Item>
                  </Descriptions>
                  <div style={{ marginTop: 16 }}>
                    <strong>优化建议：</strong>
                    <ul>
                      {optimizationData.suggestions?.map((suggestion: any, index: number) => (
                        <li key={index}>
                          <Tag color={suggestion.priority === '高' ? 'red' : suggestion.priority === '中' ? 'orange' : 'green'}>
                            {suggestion.type}
                          </Tag>
                          {suggestion.description}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Card>
              </Tabs.TabPane>
            )}
          </Tabs>
        )}
      </Modal>
    </ListPageTemplate>
  );
};

export default CostCalculationPage;

