/**
 * MRP运算页面
 *
 * 提供基于销售预测的物料需求计划运算功能
 *
 * @author RiverEdge Team
 * @date 2025-12-30
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormDigit } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Drawer, Form, Card, Row, Col, Statistic, Select, message, Table, Progress, Alert } from 'antd';
import { CalculatorOutlined, PlayCircleOutlined, EyeOutlined, CheckCircleOutlined, BarChartOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';

// MRP运算结果接口定义
interface MRPResult {
  id?: number;
  plan_id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  gross_requirement?: number;
  current_inventory?: number;
  net_requirement?: number;
  planned_receipts?: number;
  planned_orders?: number;
  inventory_schedule?: any;
  calculation_date?: string;
}

interface MRPComputationRequest {
  sales_forecast_id: number;
  consider_inventory: boolean;
  look_ahead_days: number;
}

const MRPComputationPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 运算Modal状态
  const [computationModalVisible, setComputationModalVisible] = useState(false);
  const [computationForm] = Form.useForm();

  // 结果Drawer状态
  const [resultDrawerVisible, setResultDrawerVisible] = useState(false);
  const [computationResults, setComputationResults] = useState<MRPResult[]>([]);
  const [computationStatus, setComputationStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');

  // 表格列定义
  const columns: ProColumns<MRPResult>[] = [
    {
      title: '物料编码',
      dataIndex: 'material_code',
      width: 120,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '物料名称',
      dataIndex: 'material_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '毛需求',
      dataIndex: 'gross_requirement',
      width: 100,
      align: 'right',
      render: (text) => text || 0,
    },
    {
      title: '当前库存',
      dataIndex: 'current_inventory',
      width: 100,
      align: 'right',
      render: (text) => text || 0,
    },
    {
      title: '净需求',
      dataIndex: 'net_requirement',
      width: 100,
      align: 'right',
      render: (text, record) => {
        const value = text || 0;
        return <span style={{ color: value > 0 ? '#f5222d' : '#52c41a' }}>{value}</span>;
      },
    },
    {
      title: '计划入库',
      dataIndex: 'planned_receipts',
      width: 100,
      align: 'right',
      render: (text) => text || 0,
    },
    {
      title: '计划订单',
      dataIndex: 'planned_orders',
      width: 100,
      align: 'right',
      render: (text) => text || 0,
    },
    {
      title: '运算时间',
      dataIndex: 'calculation_date',
      valueType: 'dateTime',
      width: 160,
    },
  ];

  // 处理MRP运算
  const handleMRPComputation = () => {
    setComputationModalVisible(true);
  };

  // 提交MRP运算
  const handleComputationSubmit = async (values: MRPComputationRequest) => {
    setComputationModalVisible(false);
    setComputationStatus('running');

    Modal.confirm({
      title: '确认运行MRP运算',
      content: '确定要运行MRP运算吗？运算过程可能需要一些时间。',
      onOk: async () => {
        try {
          // 模拟MRP运算过程
          setComputationStatus('running');

          // 这里应该调用实际的MRP运算API
          setTimeout(() => {
            const mockResults: MRPResult[] = [
              {
                id: 1,
                material_code: 'FIN001',
                material_name: '产品A',
                gross_requirement: 100,
                current_inventory: 20,
                net_requirement: 80,
                planned_receipts: 0,
                planned_orders: 80,
                calculation_date: new Date().toISOString(),
              },
              {
                id: 2,
                material_code: 'MAT001',
                material_name: '原材料A',
                gross_requirement: 200,
                current_inventory: 50,
                net_requirement: 150,
                planned_receipts: 0,
                planned_orders: 150,
                calculation_date: new Date().toISOString(),
              },
              {
                id: 3,
                material_code: 'MAT002',
                material_name: '原材料B',
                gross_requirement: 150,
                current_inventory: 80,
                net_requirement: 70,
                planned_receipts: 0,
                planned_orders: 70,
                calculation_date: new Date().toISOString(),
              },
            ];

            setComputationResults(mockResults);
            setComputationStatus('completed');
            setResultDrawerVisible(true);
            messageApi.success('MRP运算完成');
          }, 2000);

        } catch (error) {
          setComputationStatus('failed');
          messageApi.error('MRP运算失败');
        }
      },
    });
  };

  // 查看运算结果
  const handleViewResult = () => {
    if (computationResults.length > 0) {
      setResultDrawerVisible(true);
    } else {
      messageApi.warning('暂无运算结果');
    }
  };

  return (
    <>
      <div>
        {/* 运算状态和统计 */}
        <div style={{ padding: '16px 16px 0 16px' }}>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="运算状态"
                  value={computationStatus === 'completed' ? '完成' :
                         computationStatus === 'running' ? '运行中' :
                         computationStatus === 'failed' ? '失败' : '就绪'}
                  prefix={<CalculatorOutlined />}
                  valueStyle={{
                    color: computationStatus === 'completed' ? '#52c41a' :
                           computationStatus === 'running' ? '#1890ff' :
                           computationStatus === 'failed' ? '#f5222d' : '#faad14'
                  }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="物料需求项"
                  value={computationResults.length}
                  suffix="项"
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="净需求总量"
                  value={computationResults.reduce((sum, item) => sum + (item.net_requirement || 0), 0)}
                  suffix="件"
                  valueStyle={{ color: '#f5222d' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="建议订单数"
                  value={computationResults.filter(item => (item.planned_orders || 0) > 0).length}
                  suffix="个"
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
          </Row>

          {computationStatus === 'running' && (
            <Alert
              message="MRP运算进行中"
              description="正在计算物料需求计划，请稍候..."
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          {computationStatus === 'completed' && computationResults.length > 0 && (
            <Alert
              message="MRP运算完成"
              description={`共计算 ${computationResults.length} 个物料需求，建议生成 ${computationResults.filter(item => (item.planned_orders || 0) > 0).length} 个采购/生产订单`}
              type="success"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}
        </div>

        {/* MRP运算结果表格 */}
        <UniTable
          headerTitle="MRP运算结果"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={false}
          request={async (params) => {
            return {
              data: computationResults,
              success: true,
              total: computationResults.length,
            };
          }}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          toolBarRender={() => [
            <Button
              key="compute"
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleMRPComputation}
              loading={computationStatus === 'running'}
            >
              运行MRP运算
            </Button>,
            <Button
              key="view"
              icon={<EyeOutlined />}
              onClick={handleViewResult}
              disabled={computationResults.length === 0}
            >
              查看结果
            </Button>,
          ]}
          scroll={{ x: 1000 }}
        />
      </div>

      {/* MRP运算Modal */}
      <Modal
        title="MRP运算参数设置"
        open={computationModalVisible}
        onCancel={() => setComputationModalVisible(false)}
        onOk={() => computationForm.submit()}
        width={500}
      >
        <Form
          form={computationForm}
          layout="vertical"
          onFinish={handleComputationSubmit}
          initialValues={{
            consider_inventory: true,
            look_ahead_days: 30,
          }}
        >
          <Form.Item
            label="选择销售预测"
            name="sales_forecast_id"
            rules={[{ required: true, message: '请选择销售预测' }]}
          >
            <Select placeholder="选择销售预测">
              <Select.Option value={1}>FC202501001 - 2026年1月销售预测</Select.Option>
              <Select.Option value={2}>FC202502001 - 2026年2月销售预测</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="是否考虑现有库存"
            name="consider_inventory"
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value={true}>是</Select.Option>
              <Select.Option value={false}>否</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="展望天数"
            name="look_ahead_days"
            rules={[{ required: true, message: '请输入展望天数' }]}
          >
            <Select>
              <Select.Option value={30}>30天</Select.Option>
              <Select.Option value={60}>60天</Select.Option>
              <Select.Option value={90}>90天</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* MRP运算结果Drawer */}
      <Drawer
        title="MRP运算详细结果"
        open={resultDrawerVisible}
        onClose={() => setResultDrawerVisible(false)}
        width={900}
      >
        <div style={{ padding: '16px 0' }}>
          {/* 运算概览 */}
          <Card title="运算概览" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={6}>
                <Statistic title="总物料项" value={computationResults.length} />
              </Col>
              <Col span={6}>
                <Statistic title="有净需求的物料" value={computationResults.filter(item => (item.net_requirement || 0) > 0).length} />
              </Col>
              <Col span={6}>
                <Statistic title="建议采购订单" value={computationResults.filter(item => (item.planned_orders || 0) > 0).length} />
              </Col>
              <Col span={6}>
                <Statistic title="运算时间" value={new Date().toLocaleString()} />
              </Col>
            </Row>
          </Card>

          {/* 详细结果表格 */}
          <Card title="物料需求明细">
            <Table
              size="small"
              columns={columns}
              dataSource={computationResults}
              pagination={{ pageSize: 10 }}
              rowKey="id"
              bordered
              scroll={{ x: 800 }}
            />
          </Card>
        </div>
      </Drawer>
    </>
  );
};

export default MRPComputationPage;
