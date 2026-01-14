/**
 * MRP运算页面
 *
 * 提供基于销售预测的物料需求计划运算功能
 *
 * @author RiverEdge Team
 * @date 2025-01-15
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormDigit } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Card, Row, Col, Statistic, Table, Alert, Checkbox } from 'antd';
import { CalculatorOutlined, PlayCircleOutlined, EyeOutlined, DownloadOutlined, FileAddOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, StatCard } from '../../../../../components/layout-templates/ListPageTemplate';
import { FormModalTemplate } from '../../../../../components/layout-templates/FormModalTemplate';
import { DetailDrawerTemplate } from '../../../../../components/layout-templates/DetailDrawerTemplate';
import { MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates/constants';
import {
  runMRPComputation,
  listMRPResults,
  getMRPResult,
  generateOrdersFromMRP,
  exportMRPResults,
  getSalesForecastsForMRP,
  MRPResult,
  MRPComputationRequest,
  GenerateOrdersRequest,
} from '../../../services/mrp';
import { getDocumentRelations, DocumentRelation } from '../../../services/sales-forecast';
import { downloadFile } from '../../../services/common';
import { SalesForecast } from '../../../services/sales-forecast';

const MRPComputationPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 运算Modal状态
  const [computationModalVisible, setComputationModalVisible] = useState(false);
  const computationFormRef = useRef<any>(null);
  const [salesForecasts, setSalesForecasts] = useState<SalesForecast[]>([]);
  const [currentForecastId, setCurrentForecastId] = useState<number | null>(null);

  // 结果Drawer状态
  const [resultDrawerVisible, setResultDrawerVisible] = useState(false);
  const [currentResult, setCurrentResult] = useState<MRPResult | null>(null);
  const [documentRelations, setDocumentRelations] = useState<DocumentRelation | null>(null);
  const [computationStatus, setComputationStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  
  // 生成订单Modal状态
  const [generateOrdersModalVisible, setGenerateOrdersModalVisible] = useState(false);
  const [generateWorkOrders, setGenerateWorkOrders] = useState(true);
  const [generatePurchaseOrders, setGeneratePurchaseOrders] = useState(true);

  // 加载销售预测列表
  useEffect(() => {
    const loadSalesForecasts = async () => {
      try {
        const forecasts = await getSalesForecastsForMRP();
        setSalesForecasts(forecasts);
      } catch (error) {
        console.error('加载销售预测列表失败:', error);
      }
    };
    loadSalesForecasts();
  }, []);

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
      dataIndex: 'total_gross_requirement',
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
      dataIndex: 'total_net_requirement',
      width: 100,
      align: 'right',
      render: (text) => {
        const value = text || 0;
        return <span style={{ color: value > 0 ? '#f5222d' : '#52c41a' }}>{value}</span>;
      },
    },
    {
      title: '计划入库',
      dataIndex: 'total_planned_receipt',
      width: 100,
      align: 'right',
      render: (text) => text || 0,
    },
    {
      title: '计划发放',
      dataIndex: 'total_planned_release',
      width: 100,
      align: 'right',
      render: (text) => text || 0,
    },
    {
      title: '建议工单数',
      dataIndex: 'suggested_work_orders',
      width: 100,
      align: 'right',
      render: (text) => text || 0,
    },
    {
      title: '建议采购单数',
      dataIndex: 'suggested_purchase_orders',
      width: 120,
      align: 'right',
      render: (text) => text || 0,
    },
    {
      title: '运算时间',
      dataIndex: 'computation_time',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '操作',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewResultDetail(record)}
          >
            详情
          </Button>
        </Space>
      ),
    },
  ];

  // 处理MRP运算
  const handleMRPComputation = () => {
    setComputationModalVisible(true);
  };

  // 提交MRP运算
  const handleComputationSubmit = async (values: any) => {
    setComputationModalVisible(false);
    
    Modal.confirm({
      title: '确认运行MRP运算',
      content: '确定要运行MRP运算吗？运算过程可能需要一些时间。',
      onOk: async () => {
        try {
          setComputationStatus('running');
          
          const request: MRPComputationRequest = {
            forecast_id: values.forecast_id,
            planning_horizon: values.planning_horizon || 30,
            time_bucket: values.time_bucket || '周',
            include_safety_stock: values.include_safety_stock !== false,
            explosion_type: values.explosion_type || 'single_level',
          };
          
          const result = await runMRPComputation(request);
          
          setCurrentForecastId(result.forecast_id);
          setComputationStatus('completed');
          messageApi.success(`MRP运算完成！共涉及 ${result.total_materials} 个物料，建议生成 ${result.suggested_work_orders} 个工单和 ${result.suggested_purchase_orders} 个采购单`);
          
          // 刷新结果列表
          actionRef.current?.reload();
          
        } catch (error: any) {
          setComputationStatus('failed');
          messageApi.error(error.message || 'MRP运算失败');
        }
      },
    });
  };

  // 查看运算结果详情
  const handleViewResultDetail = async (record: MRPResult) => {
    try {
      if (record.id) {
        const detail = await getMRPResult(record.id);
        setCurrentResult(detail);
        
        // 获取单据关联关系
        try {
          const relations = await getDocumentRelations('mrp_result', record.id);
          setDocumentRelations(relations);
        } catch (error) {
          console.error('获取单据关联关系失败:', error);
          setDocumentRelations(null);
        }
        
        setResultDrawerVisible(true);
      }
    } catch (error: any) {
      messageApi.error(error.message || '获取MRP运算结果详情失败');
    }
  };

  // 处理一键生成工单和采购单
  const handleGenerateOrders = () => {
    if (!currentForecastId) {
      messageApi.warning('请先运行MRP运算');
      return;
    }
    setGenerateOrdersModalVisible(true);
  };

  // 确认生成工单和采购单
  const handleConfirmGenerateOrders = async () => {
    if (!currentForecastId) {
      messageApi.warning('请先运行MRP运算');
      return;
    }

    try {
      const options: GenerateOrdersRequest = {
        generate_work_orders: generateWorkOrders,
        generate_purchase_orders: generatePurchaseOrders,
        selected_material_ids: selectedRowKeys.length > 0 ? selectedRowKeys.map(k => Number(k)) : undefined,
      };

      const result = await generateOrdersFromMRP(currentForecastId, options);
      
      Modal.success({
        title: '生成成功',
        content: `成功生成 ${result.generated_work_orders} 个工单和 ${result.generated_purchase_orders} 个采购单`,
      });
      
      setGenerateOrdersModalVisible(false);
      actionRef.current?.reload();
      
    } catch (error: any) {
      messageApi.error(error.message || '生成工单和采购单失败');
    }
  };

  // 处理导出
  const handleExport = async () => {
    try {
      const blob = await exportMRPResults(currentForecastId || undefined);
      const filename = `MRP运算结果_${new Date().toISOString().slice(0, 10)}.csv`;
      downloadFile(blob, filename);
      messageApi.success('导出成功');
    } catch (error: any) {
      messageApi.error(error.message || '导出失败');
    }
  };

  // 统计卡片数据（从API获取）
  const [statCards, setStatCards] = useState<StatCard[]>([]);
  
  useEffect(() => {
    // 这里可以从API获取统计数据，暂时使用默认值
    setStatCards([
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
    ]);
  }, [computationStatus]);

  return (
    <>
      <ListPageTemplate statCards={statCards}>
      {computationStatus === 'running' && (
        <Alert
          message="MRP运算进行中"
          description="正在计算物料需求计划，请稍候..."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {computationStatus === 'completed' && currentForecastId && (
        <Alert
          message="MRP运算完成"
          description="MRP运算已完成，请查看下方结果列表。可以点击「一键生成工单和采购单」按钮生成订单。"
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* MRP运算结果表格 */}
      <UniTable
        headerTitle="MRP运算结果"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch={true}
        request={async (params) => {
          try {
            const response = await listMRPResults({
              skip: (params.current! - 1) * params.pageSize!,
              limit: params.pageSize,
              forecast_id: currentForecastId || undefined,
            });
            return {
              data: response.data || [],
              success: response.success !== false,
              total: response.total || 0,
            };
          } catch (error) {
            messageApi.error('获取MRP运算结果列表失败');
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
            onClick={handleMRPComputation}
            loading={computationStatus === 'running'}
          >
            运行MRP运算
          </Button>,
          <Button
            key="generate"
            icon={<FileAddOutlined />}
            onClick={handleGenerateOrders}
            disabled={!currentForecastId || computationStatus !== 'completed'}
          >
            一键生成工单和采购单
          </Button>,
          <Button
            key="export"
            icon={<DownloadOutlined />}
            onClick={handleExport}
            disabled={!currentForecastId}
          >
            导出结果
          </Button>,
        ]}
        scroll={{ x: 1200 }}
      />
      </ListPageTemplate>

      {/* MRP运算Modal */}
      <FormModalTemplate
        title="MRP运算参数设置"
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
          name="forecast_id"
          label="选择销售预测"
          placeholder="请选择已审核的销售预测"
          rules={[{ required: true, message: '请选择销售预测' }]}
          options={salesForecasts.map(f => ({
            label: `${f.forecast_code} - ${f.forecast_name}`,
            value: f.id,
          }))}
        />
        <ProFormDigit
          name="planning_horizon"
          label="计划时域（天）"
          placeholder="请输入计划时域"
          rules={[{ required: true, message: '请输入计划时域' }]}
          min={1}
          max={365}
          initialValue={30}
        />
        <ProFormSelect
          name="time_bucket"
          label="时间段"
          rules={[{ required: true, message: '请选择时间段' }]}
          options={[
            { label: '日', value: '日' },
            { label: '周', value: '周' },
            { label: '月', value: '月' },
          ]}
          initialValue="周"
        />
        <ProFormSelect
          name="include_safety_stock"
          label="是否考虑安全库存"
          rules={[{ required: true }]}
          options={[
            { label: '是', value: true },
            { label: '否', value: false },
          ]}
          initialValue={true}
        />
        <ProFormSelect
          name="explosion_type"
          label="展开类型"
          rules={[{ required: true }]}
          options={[
            { label: '单层展开', value: 'single_level' },
            { label: '多层展开', value: 'multi_level' },
          ]}
          initialValue="single_level"
        />
      </FormModalTemplate>

      {/* MRP运算结果Drawer */}
      <DetailDrawerTemplate
        title={`MRP运算结果详情${currentResult?.id ? ` - ${currentResult.id}` : ''}`}
        open={resultDrawerVisible}
        onClose={() => {
          setResultDrawerVisible(false);
          setCurrentResult(null);
          setDocumentRelations(null);
        }}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        columns={[]}
        customContent={
          currentResult ? (
            <div style={{ padding: '16px 0' }}>
              {/* 基本信息 */}
              <Card title="基本信息" style={{ marginBottom: 16 }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <strong>物料编码：</strong>{currentResult.material_code || '-'}
                  </Col>
                  <Col span={12}>
                    <strong>物料名称：</strong>{currentResult.material_name || '-'}
                  </Col>
                </Row>
                <Row gutter={16} style={{ marginTop: 8 }}>
                  <Col span={12}>
                    <strong>当前库存：</strong>{currentResult.current_inventory || 0}
                  </Col>
                  <Col span={12}>
                    <strong>安全库存：</strong>{currentResult.safety_stock || 0}
                  </Col>
                </Row>
                <Row gutter={16} style={{ marginTop: 8 }}>
                  <Col span={12}>
                    <strong>总毛需求：</strong>{currentResult.total_gross_requirement || 0}
                  </Col>
                  <Col span={12}>
                    <strong>总净需求：</strong>
                    <span style={{ color: (currentResult.total_net_requirement || 0) > 0 ? '#f5222d' : '#52c41a' }}>
                      {currentResult.total_net_requirement || 0}
                    </span>
                  </Col>
                </Row>
                <Row gutter={16} style={{ marginTop: 8 }}>
                  <Col span={12}>
                    <strong>建议工单数：</strong>{currentResult.suggested_work_orders || 0}
                  </Col>
                  <Col span={12}>
                    <strong>建议采购单数：</strong>{currentResult.suggested_purchase_orders || 0}
                  </Col>
                </Row>
                <Row gutter={16} style={{ marginTop: 8 }}>
                  <Col span={12}>
                    <strong>运算时间：</strong>
                    {currentResult.computation_time ? new Date(currentResult.computation_time).toLocaleString() : '-'}
                  </Col>
                  <Col span={12}>
                    <strong>运算状态：</strong>
                    <Tag color={currentResult.computation_status === '完成' ? 'success' : 'processing'}>
                      {currentResult.computation_status || '完成'}
                    </Tag>
                  </Col>
                </Row>
              </Card>

              {/* 单据关联 */}
              {documentRelations && (
                <Card title="单据关联" style={{ marginBottom: 16 }}>
                  {documentRelations.upstream_count > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ marginBottom: 8, fontWeight: 'bold' }}>
                        上游单据 ({documentRelations.upstream_count})
                      </div>
                      <Table
                        size="small"
                        columns={[
                          { title: '单据类型', dataIndex: 'document_type', width: 120 },
                          { title: '单据编号', dataIndex: 'document_code', width: 150 },
                          { title: '单据名称', dataIndex: 'document_name', width: 150 },
                          { 
                            title: '状态', 
                            dataIndex: 'status', 
                            width: 100,
                            render: (status: string) => <Tag>{status}</Tag>
                          },
                        ]}
                        dataSource={documentRelations.upstream_documents}
                        pagination={false}
                        rowKey={(record) => `${record.document_type}-${record.document_id}`}
                        bordered
                      />
                    </div>
                  )}
                  {documentRelations.downstream_count > 0 && (
                    <div>
                      <div style={{ marginBottom: 8, fontWeight: 'bold' }}>
                        下游单据 ({documentRelations.downstream_count})
                      </div>
                      <Table
                        size="small"
                        columns={[
                          { title: '单据类型', dataIndex: 'document_type', width: 120 },
                          { title: '单据编号', dataIndex: 'document_code', width: 150 },
                          { title: '单据名称', dataIndex: 'document_name', width: 150 },
                          { 
                            title: '状态', 
                            dataIndex: 'status', 
                            width: 100,
                            render: (status: string) => <Tag>{status}</Tag>
                          },
                        ]}
                        dataSource={documentRelations.downstream_documents}
                        pagination={false}
                        rowKey={(record) => `${record.document_type}-${record.document_id}`}
                        bordered
                      />
                    </div>
                  )}
                  {documentRelations.upstream_count === 0 && documentRelations.downstream_count === 0 && (
                    <div style={{ color: '#999', textAlign: 'center', padding: '20px' }}>
                      暂无关联单据
                    </div>
                  )}
                </Card>
              )}
            </div>
          ) : null
        }
      />

      {/* 生成工单和采购单Modal */}
      <Modal
        title="一键生成工单和采购单"
        open={generateOrdersModalVisible}
        onOk={handleConfirmGenerateOrders}
        onCancel={() => setGenerateOrdersModalVisible(false)}
        okText="确认生成"
        cancelText="取消"
      >
        <div style={{ padding: '16px 0' }}>
          <Alert
            message="生成说明"
            description="将根据MRP运算结果自动生成工单（自制件）和采购单（外购件）。如果已选择物料，则只生成选中物料的订单。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Checkbox
            checked={generateWorkOrders}
            onChange={(e) => setGenerateWorkOrders(e.target.checked)}
            style={{ display: 'block', marginBottom: 8 }}
          >
            生成工单（自制件）
          </Checkbox>
          <Checkbox
            checked={generatePurchaseOrders}
            onChange={(e) => setGeneratePurchaseOrders(e.target.checked)}
            style={{ display: 'block' }}
          >
            生成采购单（外购件）
          </Checkbox>
          {selectedRowKeys.length > 0 && (
            <div style={{ marginTop: 16, color: '#1890ff' }}>
              已选择 {selectedRowKeys.length} 个物料，将只生成选中物料的订单
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};

export default MRPComputationPage;
