/**
 * LRP运算页面
 *
 * 提供基于销售订单的订单专属生产计划运算功能
 *
 * @author RiverEdge Team
 * @date 2025-12-30
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormDigit } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Card, Row, Col, Statistic, Table, Alert } from 'antd';
import { CalculatorOutlined, PlayCircleOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, StatCard } from '../../../../../components/layout-templates/ListPageTemplate';
import { FormModalTemplate } from '../../../../../components/layout-templates/FormModalTemplate';
import { DetailDrawerTemplate } from '../../../../../components/layout-templates/DetailDrawerTemplate';
import { MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates/constants';

// LRP运算结果接口定义
interface LRPResult {
  id?: number;
  plan_id?: number;
  sales_order_id?: number;
  sales_order_code?: string;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  required_quantity?: number;
  available_inventory?: number;
  production_plan_quantity?: number;
  purchase_plan_quantity?: number;
  delivery_date?: string;
  calculation_date?: string;
}

interface LRPComputationRequest {
  sales_order_id: number;
  consider_inventory: boolean;
  look_ahead_days: number;
}

const LRPComputationPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 运算Modal状态
  const [computationModalVisible, setComputationModalVisible] = useState(false);
  const computationFormRef = useRef<any>(null);

  // 结果Drawer状态
  const [resultDrawerVisible, setResultDrawerVisible] = useState(false);
  const [computationResults, setComputationResults] = useState<LRPResult[]>([]);
  const [computationStatus, setComputationStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');

  // 表格列定义
  const columns: ProColumns<LRPResult>[] = [
    {
      title: '销售订单',
      dataIndex: 'sales_order_code',
      width: 120,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '物料编码',
      dataIndex: 'material_code',
      width: 120,
      ellipsis: true,
    },
    {
      title: '物料名称',
      dataIndex: 'material_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '需求数量',
      dataIndex: 'required_quantity',
      width: 100,
      align: 'right',
      render: (text) => text || 0,
    },
    {
      title: '可用库存',
      dataIndex: 'available_inventory',
      width: 100,
      align: 'right',
      render: (text) => text || 0,
    },
    {
      title: '建议生产',
      dataIndex: 'production_plan_quantity',
      width: 100,
      align: 'right',
      render: (text) => {
        const value = text || 0;
        return <span style={{ color: value > 0 ? '#1890ff' : '#d9d9d9' }}>{value}</span>;
      },
    },
    {
      title: '建议采购',
      dataIndex: 'purchase_plan_quantity',
      width: 100,
      align: 'right',
      render: (text) => {
        const value = text || 0;
        return <span style={{ color: value > 0 ? '#52c41a' : '#d9d9d9' }}>{value}</span>;
      },
    },
    {
      title: '交货日期',
      dataIndex: 'delivery_date',
      valueType: 'date',
      width: 120,
    },
    {
      title: '运算时间',
      dataIndex: 'calculation_date',
      valueType: 'dateTime',
      width: 160,
    },
  ];

  // 处理LRP运算
  const handleLRPComputation = () => {
    setComputationModalVisible(true);
  };

  // 提交LRP运算
  const handleComputationSubmit = async (values: LRPComputationRequest) => {
    setComputationModalVisible(false);
    setComputationStatus('running');

    Modal.confirm({
      title: '确认运行LRP运算',
      content: '确定要运行LRP运算吗？运算过程可能需要一些时间。',
      onOk: async () => {
        try {
          // 模拟LRP运算过程
          setComputationStatus('running');

          // 这里应该调用实际的LRP运算API
          setTimeout(() => {
            const mockResults: LRPResult[] = [
              {
                id: 1,
                sales_order_code: 'SO202501001',
                material_code: 'FIN001',
                material_name: '定制产品A',
                required_quantity: 50,
                available_inventory: 0,
                production_plan_quantity: 50,
                purchase_plan_quantity: 0,
                delivery_date: '2026-01-15',
                calculation_date: new Date().toISOString(),
              },
              {
                id: 2,
                sales_order_code: 'SO202501001',
                material_code: 'MAT001',
                material_name: '组件A',
                required_quantity: 100,
                available_inventory: 20,
                production_plan_quantity: 80,
                purchase_plan_quantity: 0,
                delivery_date: '2026-01-10',
                calculation_date: new Date().toISOString(),
              },
              {
                id: 3,
                sales_order_code: 'SO202501001',
                material_code: 'MAT003',
                material_name: '标准件C',
                required_quantity: 200,
                available_inventory: 50,
                production_plan_quantity: 0,
                purchase_plan_quantity: 150,
                delivery_date: '2026-01-08',
                calculation_date: new Date().toISOString(),
              },
            ];

            setComputationResults(mockResults);
            setComputationStatus('completed');
            setResultDrawerVisible(true);
            messageApi.success('LRP运算完成');
          }, 2000);

        } catch (error) {
          setComputationStatus('failed');
          messageApi.error('LRP运算失败');
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

  // 统计卡片数据
  const statCards: StatCard[] = [
    {
      title: '运算状态',
      value: computationStatus === 'completed' ? '完成' :
             computationStatus === 'running' ? '运行中' :
             computationStatus === 'failed' ? '失败' : '就绪',
      prefix: <CalculatorOutlined />,
      valueStyle: {
        color: computationStatus === 'completed' ? '#52c41a' :
               computationStatus === 'running' ? '#1890ff' :
               computationStatus === 'failed' ? '#f5222d' : '#faad14'
      },
    },
    {
      title: '订单专属需求',
      value: computationResults.length,
      suffix: '项',
      valueStyle: { color: '#1890ff' },
    },
    {
      title: '建议生产总量',
      value: computationResults.reduce((sum, item) => sum + (item.production_plan_quantity || 0), 0),
      suffix: '件',
      valueStyle: { color: '#722ed1' },
    },
    {
      title: '建议采购总量',
      value: computationResults.reduce((sum, item) => sum + (item.purchase_plan_quantity || 0), 0),
      suffix: '件',
      valueStyle: { color: '#52c41a' },
    },
  ];

  return (
    <>
      <ListPageTemplate statCards={statCards}>
      {computationStatus === 'running' && (
        <Alert
          message="LRP运算进行中"
          description="正在计算订单专属生产计划，请稍候..."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {computationStatus === 'completed' && computationResults.length > 0 && (
        <Alert
          message="LRP运算完成"
          description={`共计算 ${computationResults.length} 个订单需求，建议生产 ${computationResults.reduce((sum, item) => sum + (item.production_plan_quantity || 0), 0)} 件，采购 ${computationResults.reduce((sum, item) => sum + (item.purchase_plan_quantity || 0), 0)} 件`}
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* LRP运算结果表格 */}
      <UniTable
        headerTitle="LRP运算结果"
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
            onClick={handleLRPComputation}
            loading={computationStatus === 'running'}
          >
            运行LRP运算
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
        scroll={{ x: 1200 }}
      />
      </ListPageTemplate>

      {/* LRP运算Modal */}
      <FormModalTemplate
        title="LRP运算参数设置"
        open={computationModalVisible}
        onClose={() => setComputationModalVisible(false)}
        onFinish={handleComputationSubmit}
        width={MODAL_CONFIG.SMALL_WIDTH}
        layout="vertical"
        formRef={computationFormRef}
        initialValues={{
          consider_inventory: true,
          look_ahead_days: 30,
        }}
      >
        <ProFormSelect
          name="sales_order_id"
          label="选择销售订单"
          placeholder="选择销售订单"
          rules={[{ required: true, message: '请选择销售订单' }]}
          options={[
            { label: 'SO202501001 - 定制产品A订单', value: 1 },
            { label: 'SO202501002 - 定制产品B订单', value: 2 },
          ]}
        />
        <ProFormSelect
          name="consider_inventory"
          label="是否考虑现有库存"
          rules={[{ required: true }]}
          options={[
            { label: '是', value: true },
            { label: '否', value: false },
          ]}
        />
        <ProFormSelect
          name="look_ahead_days"
          label="展望天数"
          rules={[{ required: true, message: '请输入展望天数' }]}
          options={[
            { label: '30天', value: 30 },
            { label: '60天', value: 60 },
            { label: '90天', value: 90 },
          ]}
        />
      </FormModalTemplate>

      {/* LRP运算结果Drawer */}
      <DetailDrawerTemplate
        title="LRP运算详细结果"
        open={resultDrawerVisible}
        onClose={() => setResultDrawerVisible(false)}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        columns={[]}
        customContent={
          <div style={{ padding: '16px 0' }}>
            {/* 运算概览 */}
            <Card title="运算概览" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic title="订单物料项" value={computationResults.length} />
                </Col>
                <Col span={6}>
                  <Statistic title="需生产物料" value={computationResults.filter(item => (item.production_plan_quantity || 0) > 0).length} />
                </Col>
                <Col span={6}>
                  <Statistic title="需采购物料" value={computationResults.filter(item => (item.purchase_plan_quantity || 0) > 0).length} />
                </Col>
                <Col span={6}>
                  <Statistic title="运算时间" value={new Date().toLocaleString()} />
                </Col>
              </Row>
            </Card>

            {/* 详细结果表格 */}
            <Card title="订单专属需求明细">
              <Table
                size="small"
                columns={columns}
                dataSource={computationResults}
                pagination={{ pageSize: 10 }}
                rowKey="id"
                bordered
                scroll={{ x: 1000 }}
              />
            </Card>
          </div>
        }
      />
    </>
  );
};

export default LRPComputationPage;
