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
import { App, Button, Tag, Space, Modal, Card, Row, Col, Statistic, Table, Alert, Checkbox } from 'antd';
import { CalculatorOutlined, PlayCircleOutlined, EyeOutlined, DownloadOutlined, FileAddOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, StatCard } from '../../../../../components/layout-templates/ListPageTemplate';
import { FormModalTemplate } from '../../../../../components/layout-templates/FormModalTemplate';
import { DetailDrawerTemplate } from '../../../../../components/layout-templates/DetailDrawerTemplate';
import { MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates/constants';
import { runLRPComputation, listLRPResults, getLRPResult, generateOrdersFromLRP, exportLRPResults, LRPResult, LRPComputationRequest } from '../../../services/mrp';
import { listSalesOrders, SalesOrder } from '../../../services/sales';
import { downloadFile } from '../../../services/common';

// 使用服务中的接口定义
type LRPResultType = LRPResult;

const LRPComputationPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 运算Modal状态
  const [computationModalVisible, setComputationModalVisible] = useState(false);
  const computationFormRef = useRef<any>(null);
  const [currentSalesOrderId, setCurrentSalesOrderId] = useState<number | null>(null);

  // 结果Drawer状态
  const [resultDrawerVisible, setResultDrawerVisible] = useState(false);
  const [computationResults, setComputationResults] = useState<LRPResultType[]>([]);
  const [computationStatus, setComputationStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');

  // 生成订单Modal状态
  const [generateOrdersModalVisible, setGenerateOrdersModalVisible] = useState(false);
  const [generateWorkOrders, setGenerateWorkOrders] = useState(true);
  const [generatePurchaseOrders, setGeneratePurchaseOrders] = useState(true);

  // 表格列定义
  const columns: ProColumns<LRPResultType>[] = [
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
      title: '净需求',
      dataIndex: 'net_requirement',
      width: 100,
      align: 'right',
      render: (text) => text || 0,
    },
    {
      title: '计划生产',
      dataIndex: 'planned_production',
      width: 100,
      align: 'right',
      render: (text) => {
        const value = text || 0;
        return <span style={{ color: value > 0 ? '#1890ff' : '#d9d9d9' }}>{value}</span>;
      },
    },
    {
      title: '计划采购',
      dataIndex: 'planned_procurement',
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
      dataIndex: 'computation_time',
      valueType: 'dateTime',
      width: 160,
    },
  ];

  // 统计卡片数据（从API获取）
  const [statCardsData, setStatCardsData] = useState({
    total: 0,
    totalProduction: 0,
    totalProcurement: 0,
  });

  // 更新统计数据
  React.useEffect(() => {
    const updateStats = async () => {
      if (currentSalesOrderId) {
        try {
          const response = await listLRPResults({
            skip: 0,
            limit: 10000,
            sales_order_id: currentSalesOrderId,
          });
          const results = response.data || [];
          setStatCardsData({
            total: results.length,
            totalProduction: results.reduce((sum: number, item: LRPResultType) => sum + (item.planned_production || 0), 0),
            totalProcurement: results.reduce((sum: number, item: LRPResultType) => sum + (item.planned_procurement || 0), 0),
          });
        } catch (error) {
          // 忽略错误
        }
      }
    };
    updateStats();
  }, [currentSalesOrderId]);

  // 处理LRP运算
  const handleLRPComputation = () => {
    setComputationModalVisible(true);
  };

  // 提交LRP运算
  const handleComputationSubmit = async (values: any) => {
    setComputationModalVisible(false);
    setComputationStatus('running');

    Modal.confirm({
      title: '确认运行LRP运算',
      content: '确定要运行LRP运算吗？运算过程可能需要一些时间。',
      onOk: async () => {
        try {
          setComputationStatus('running');
          
          // 调用真实的LRP运算API
          const request: LRPComputationRequest = {
            sales_order_id: values.sales_order_id,
            planning_horizon: values.planning_horizon || 3,
            consider_capacity: values.consider_capacity || false,
          };
          
          await runLRPComputation(request);
          
          // 运算完成后，刷新结果列表
          setCurrentSalesOrderId(values.sales_order_id);
          setTimeout(() => {
            actionRef.current?.reload();
            setComputationStatus('completed');
            messageApi.success('LRP运算完成');
          }, 1000);
        } catch (error: any) {
          setComputationStatus('failed');
          messageApi.error(error.message || 'LRP运算失败');
        }
      },
    });
  };

  // 处理一键生成工单和采购单
  const handleGenerateOrders = () => {
    if (!currentSalesOrderId) {
      messageApi.warning('请先选择销售订单并运行LRP运算');
      return;
    }
    setGenerateOrdersModalVisible(true);
  };

  // 确认生成工单和采购单
  const handleConfirmGenerateOrders = async () => {
    if (!currentSalesOrderId) {
      messageApi.warning('请先选择销售订单并运行LRP运算');
      return;
    }

    try {
      const selectedMaterialIds = selectedRowKeys.length > 0 
        ? selectedRowKeys.map(key => Number(key))
        : undefined;

      const result = await generateOrdersFromLRP(currentSalesOrderId, {
        generate_work_orders: generateWorkOrders,
        generate_purchase_orders: generatePurchaseOrders,
        selected_material_ids: selectedMaterialIds,
      });

      messageApi.success(
        `成功生成 ${result.generated_work_orders} 个工单和 ${result.generated_purchase_orders} 个采购单`
      );
      setGenerateOrdersModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '生成订单失败');
    }
  };

  // 处理导出
  const handleExport = async () => {
    try {
      const blob = await exportLRPResults(currentSalesOrderId || undefined);
      const filename = `LRP运算结果_${new Date().toISOString().slice(0, 10)}.csv`;
      downloadFile(blob, filename);
      messageApi.success('导出成功');
    } catch (error: any) {
      messageApi.error(error.message || '导出失败');
    }
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
      value: statCardsData.total,
      suffix: '项',
      valueStyle: { color: '#1890ff' },
    },
    {
      title: '建议生产总量',
      value: statCardsData.totalProduction,
      suffix: '件',
      valueStyle: { color: '#722ed1' },
    },
    {
      title: '建议采购总量',
      value: statCardsData.totalProcurement,
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
        showAdvancedSearch={true}
        request={async (params) => {
          try {
            const response = await listLRPResults({
              skip: (params.current! - 1) * params.pageSize!,
              limit: params.pageSize,
              sales_order_id: currentSalesOrderId || undefined,
            });
            return {
              data: response.data || [],
              success: response.success !== false,
              total: response.total || 0,
            };
          } catch (error) {
            messageApi.error('获取LRP运算结果列表失败');
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
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
            key="generate"
            icon={<FileAddOutlined />}
            onClick={handleGenerateOrders}
            disabled={!currentSalesOrderId || computationStatus !== 'completed'}
          >
            一键生成工单和采购单
          </Button>,
          <Button
            key="export"
            icon={<DownloadOutlined />}
            onClick={handleExport}
            disabled={!currentSalesOrderId}
          >
            导出结果
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
          planning_horizon: 3,
          consider_capacity: false,
        }}
      >
        <ProFormSelect
          name="sales_order_id"
          label="选择销售订单"
          placeholder="选择销售订单"
          rules={[{ required: true, message: '请选择销售订单' }]}
          request={async () => {
            try {
              const response = await listSalesOrders({
                skip: 0,
                limit: 1000,
                status: '已确认',
              });
              return (response.data || []).map((order: SalesOrder) => ({
                label: `${order.order_code} - ${order.customer_name}`,
                value: order.id,
              }));
            } catch (error) {
              return [];
            }
          }}
        />
        <ProFormDigit
          name="planning_horizon"
          label="计划时域（月数）"
          rules={[{ required: true, message: '请输入计划时域' }]}
          min={1}
          max={12}
          initialValue={3}
        />
        <ProFormSelect
          name="consider_capacity"
          label="是否考虑产能"
          rules={[{ required: true }]}
          options={[
            { label: '是', value: true },
            { label: '否', value: false },
          ]}
        />
      </FormModalTemplate>

      {/* 生成工单和采购单Modal */}
      <Modal
        title="一键生成工单和采购单"
        open={generateOrdersModalVisible}
        onOk={handleConfirmGenerateOrders}
        onCancel={() => setGenerateOrdersModalVisible(false)}
        okText="确认生成"
        cancelText="取消"
      >
        <Alert
          message="提示"
          description="将根据LRP运算结果自动生成工单（自制件）和采购单（外购件）。如果已选择物料，则只生成选中物料的订单。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Space direction="vertical">
          <Checkbox
            checked={generateWorkOrders}
            onChange={(e) => setGenerateWorkOrders(e.target.checked)}
          >
            生成工单（自制件）
          </Checkbox>
          <Checkbox
            checked={generatePurchaseOrders}
            onChange={(e) => setGeneratePurchaseOrders(e.target.checked)}
          >
            生成采购单（外购件）
          </Checkbox>
        </Space>
      </Modal>

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
