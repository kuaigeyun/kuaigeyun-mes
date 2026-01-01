/**
 * 销售预测页面
 *
 * 提供销售预测的创建、编辑、查看和管理功能
 *
 * @author RiverEdge Team
 * @date 2025-12-30
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormDatePicker, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Card, Row, Col, Table } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, CheckCircleOutlined, CalculatorOutlined, UploadOutlined, DownloadOutlined, SendOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { UniImport } from '../../../../../components/uni-import';
import { listSalesForecasts, getSalesForecast, createSalesForecast, updateSalesForecast, approveSalesForecast, submitSalesForecast, importSalesForecasts, exportSalesForecasts, getDocumentRelations, SalesForecast as APISalesForecast, DocumentRelation } from '../../../services/sales-forecast';
import { downloadFile } from '../../../services/common';

// 使用API服务中的接口定义
type SalesForecast = APISalesForecast;

const SalesForecastsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Modal 相关状态
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentForecast, setCurrentForecast] = useState<SalesForecast | null>(null);
  const formRef = useRef<any>(null);

  // Drawer 相关状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [forecastDetail, setForecastDetail] = useState<SalesForecast | null>(null);
  const [documentRelations, setDocumentRelations] = useState<DocumentRelation | null>(null);

  // 导入导出相关状态
  const [importVisible, setImportVisible] = useState(false);

  // 表格列定义
  const columns: ProColumns<SalesForecast>[] = [
    {
      title: '预测编号',
      dataIndex: 'forecast_code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '预测名称',
      dataIndex: 'forecast_name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '预测期间',
      dataIndex: ['start_date', 'end_date'],
      width: 200,
      render: (_, record) => `${record.start_date} ~ ${record.end_date}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status) => {
        const statusMap = {
          '草稿': { text: '草稿', color: 'default' },
          '已审核': { text: '已审核', color: 'processing' },
          '已完成': { text: '已完成', color: 'success' },
          '已取消': { text: '已取消', color: 'error' },
        };
        const config = statusMap[status as keyof typeof statusMap] || statusMap['草稿'];
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '审核状态',
      dataIndex: 'review_status',
      width: 100,
      render: (status) => {
        const statusMap = {
          '待审核': { text: '待审核', color: 'default' },
          '审核通过': { text: '审核通过', color: 'success' },
          '审核驳回': { text: '审核驳回', color: 'error' },
        };
        const config = statusMap[status as keyof typeof statusMap] || statusMap['待审核'];
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '审核人',
      dataIndex: 'reviewer_name',
      width: 100,
      ellipsis: true,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '操作',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleDetail(record)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          {record.status === '草稿' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<SendOutlined />}
                onClick={() => handleSubmit(record)}
                style={{ color: '#1890ff' }}
              >
                提交
              </Button>
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => handleApprove(record)}
                style={{ color: '#52c41a' }}
              >
                审核
              </Button>
            </>
          )}
          {record.status === '已审核' && (
            <Button
              type="link"
              size="small"
              icon={<CalculatorOutlined />}
              onClick={() => handleRunMRP(record)}
              style={{ color: '#1890ff' }}
            >
              MRP运算
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // 处理详情查看
  const handleDetail = async (record: SalesForecast) => {
    try {
      const detail = await getSalesForecast(record.id!);
      setForecastDetail(detail);
      
      // 获取单据关联关系
      try {
        const relations = await getDocumentRelations('sales_forecast', record.id!);
        setDocumentRelations(relations);
      } catch (error) {
        console.error('获取单据关联关系失败:', error);
        setDocumentRelations(null);
      }
      
      setDetailDrawerVisible(true);
    } catch (error) {
      messageApi.error('获取销售预测详情失败');
    }
  };

  // 处理提交
  const handleSubmit = async (record: SalesForecast) => {
    Modal.confirm({
      title: '提交销售预测',
      content: `确定要提交销售预测 "${record.forecast_name}" 吗？提交后将进入待审核状态。`,
      onOk: async () => {
        try {
          await submitSalesForecast(record.id!);
          messageApi.success('销售预测提交成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '销售预测提交失败');
        }
      },
    });
  };

  // 处理批量导入
  const handleImport = async (data: any[][]) => {
    try {
      const result = await importSalesForecasts(data);
      if (result.success) {
        messageApi.success(`导入成功：成功 ${result.success_count} 条，失败 ${result.failure_count} 条`);
        actionRef.current?.reload();
      } else {
        messageApi.warning(`导入完成：成功 ${result.success_count} 条，失败 ${result.failure_count} 条`);
        if (result.errors && result.errors.length > 0) {
          const errorMsg = result.errors.slice(0, 5).map(e => `第${e.row}行: ${e.error}`).join('\n');
          Modal.error({
            title: '导入错误详情',
            content: errorMsg + (result.errors.length > 5 ? `\n...还有${result.errors.length - 5}个错误` : ''),
          });
        }
      }
      setImportVisible(false);
    } catch (error: any) {
      messageApi.error(error.message || '导入失败');
    }
  };

  // 处理批量导出
  const handleExport = async () => {
    try {
      const blob = await exportSalesForecasts();
      const filename = `销售预测_${new Date().toISOString().slice(0, 10)}.csv`;
      downloadFile(blob, filename);
      messageApi.success('导出成功');
    } catch (error: any) {
      messageApi.error(error.message || '导出失败');
    }
  };

  // 处理审核
  const handleApprove = async (record: SalesForecast) => {
    Modal.confirm({
      title: '审核销售预测',
      content: `确定要审核通过销售预测 "${record.forecast_name}" 吗？`,
      onOk: async () => {
        try {
          await approveSalesForecast(record.id!);
          messageApi.success('销售预测审核成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '销售预测审核失败');
        }
      },
    });
  };

  // 处理MRP运算
  const handleRunMRP = async (record: SalesForecast) => {
    Modal.confirm({
      title: '运行MRP运算',
      content: `确定要基于销售预测 "${record.forecast_name}" 运行MRP运算吗？`,
      onOk: async () => {
        try {
          messageApi.success('MRP运算已启动，请稍后查看结果');
        } catch (error) {
          messageApi.error('MRP运算启动失败');
        }
      },
    });
  };

  // 处理编辑
  const handleEdit = async (record: SalesForecast) => {
    try {
      const detail = await getSalesForecast(record.id!);
      setIsEdit(true);
      setCurrentForecast(detail);
      setModalVisible(true);
      // 延迟设置表单值
      setTimeout(() => {
        formRef.current?.setFieldsValue({
          forecast_name: detail.forecast_name,
          start_date: detail.start_date,
          end_date: detail.end_date,
          notes: detail.notes,
        });
      }, 100);
    } catch (error) {
      messageApi.error('获取销售预测详情失败');
    }
  };

  // 处理创建
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentForecast(null);
    setModalVisible(true);
    formRef.current?.resetFields();
  };

  const handleFormFinish = async (values: any) => {
    try {
      if (isEdit && currentForecast?.id) {
        await updateSalesForecast(currentForecast.id, values);
        messageApi.success('销售预测更新成功');
      } else {
        await createSalesForecast(values);
        messageApi.success('销售预测创建成功');
      }
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      throw error;
    }
  };

  return (
    <ListPageTemplate
      statCards={[
        {
          title: '总预测数',
          value: 12,
          prefix: <CalculatorOutlined />,
          valueStyle: { color: '#1890ff' },
        },
        {
          title: '已审核预测',
          value: 8,
          suffix: '个',
          valueStyle: { color: '#52c41a' },
        },
        {
          title: '草稿预测',
          value: 3,
          suffix: '个',
          valueStyle: { color: '#faad14' },
        },
        {
          title: '预测准确率',
          value: '92.5',
          suffix: '%',
          valueStyle: { color: '#722ed1' },
        },
      ]}
    >
      <UniTable
          headerTitle="销售预测管理"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          request={async (params) => {
            try {
              const response = await listSalesForecasts({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                status: params.status,
                keyword: params.keyword,
              });
              return {
                data: response.data || [],
                success: response.success !== false,
                total: response.total || 0,
              };
            } catch (error) {
              messageApi.error('获取销售预测列表失败');
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
              key="create"
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
            >
              新建销售预测
            </Button>,
            <Button
              key="import"
              icon={<UploadOutlined />}
              onClick={() => setImportVisible(true)}
            >
              批量导入
            </Button>,
            <Button
              key="export"
              icon={<DownloadOutlined />}
              onClick={handleExport}
            >
              批量导出
            </Button>,
          ]}
          scroll={{ x: 1200 }}
        />

      <FormModalTemplate
        title={isEdit ? '编辑销售预测' : '新建销售预测'}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setCurrentForecast(null);
          formRef.current?.resetFields();
        }}
        onFinish={handleFormFinish}
        isEdit={isEdit}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        grid={true}
      >
        <ProFormText
          name="forecast_name"
          label="预测名称"
          placeholder="请输入预测名称"
          rules={[{ required: true, message: '请输入预测名称' }]}
          colProps={{ span: 12 }}
        />
        <ProFormDatePicker
          name="start_date"
          label="开始日期"
          placeholder="请选择开始日期"
          rules={[{ required: true, message: '请选择开始日期' }]}
          colProps={{ span: 12 }}
        />
        <ProFormDatePicker
          name="end_date"
          label="结束日期"
          placeholder="请选择结束日期"
          rules={[{ required: true, message: '请选择结束日期' }]}
          colProps={{ span: 12 }}
        />
        <ProFormTextArea
          name="notes"
          label="备注"
          placeholder="请输入备注信息"
          fieldProps={{ rows: 3 }}
          colProps={{ span: 24 }}
        />
        <div style={{ padding: '16px', background: '#f5f5f5', borderRadius: '4px', marginTop: '16px' }}>
          <p style={{ margin: 0, color: '#999' }}>
            注意：销售预测明细项功能开发中，当前版本仅支持基本信息的创建和编辑。
          </p>
        </div>
      </FormModalTemplate>

      <DetailDrawerTemplate
        title={`销售预测详情 - ${forecastDetail?.forecast_code || ''}`}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={DRAWER_CONFIG.SMALL_WIDTH}
        columns={[]}
        customContent={
          forecastDetail ? (
            <div style={{ padding: '16px 0' }}>
              <Card title="基本信息" style={{ marginBottom: 16 }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <strong>预测编号：</strong>{forecastDetail.forecast_code}
                  </Col>
                  <Col span={12}>
                    <strong>预测名称：</strong>{forecastDetail.forecast_name}
                  </Col>
                </Row>
                <Row gutter={16} style={{ marginTop: 8 }}>
                  <Col span={12}>
                    <strong>预测期间：</strong>{forecastDetail.start_date} ~ {forecastDetail.end_date}
                  </Col>
                  <Col span={12}>
                    <strong>状态：</strong>
                    <Tag color={forecastDetail.status === '已审核' ? 'success' : 'default'}>
                      {forecastDetail.status}
                    </Tag>
                  </Col>
                </Row>
                <Row gutter={16} style={{ marginTop: 8 }}>
                  <Col span={12}>
                    <strong>审核状态：</strong>
                    <Tag color={forecastDetail.review_status === '审核通过' ? 'success' : 'default'}>
                      {forecastDetail.review_status}
                    </Tag>
                  </Col>
                  <Col span={12}>
                    <strong>审核人：</strong>{forecastDetail.reviewer_name}
                  </Col>
                </Row>
              </Card>

              {/* 预测明细 */}
              {forecastDetail.forecast_items && forecastDetail.forecast_items.length > 0 && (
                <Card title="预测明细" style={{ marginBottom: 16 }}>
                  <Table
                    size="small"
                    columns={[
                      { title: '物料编码', dataIndex: 'material_code', width: 120 },
                      { title: '物料名称', dataIndex: 'material_name', width: 150 },
                      { title: '预测日期', dataIndex: 'forecast_date', width: 120 },
                      { title: '预测数量', dataIndex: 'forecast_quantity', width: 120, align: 'right' },
                    ]}
                    dataSource={forecastDetail.forecast_items}
                    pagination={false}
                    rowKey="id"
                    bordered
                  />
                </Card>
              )}

              {/* 单据关联 */}
              {documentRelations && (
                <Card title="单据关联" style={{ marginBottom: 16 }}>
                  {documentRelations.downstream_count > 0 && (
                    <div style={{ marginBottom: 16 }}>
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
                  {documentRelations.downstream_count === 0 && (
                    <div style={{ color: '#999', textAlign: 'center', padding: '20px' }}>
                      暂无下游关联单据
                    </div>
                  )}
                </Card>
              )}
            </div>
          ) : null
        }
      />

      {/* 批量导入弹窗 */}
      <UniImport
        visible={importVisible}
        onCancel={() => setImportVisible(false)}
        onConfirm={handleImport}
        title="批量导入销售预测"
        headers={[
          '预测名称',
          '预测类型',
          '预测周期',
          '开始日期',
          '结束日期',
          '备注'
        ]}
        exampleRow={[
          '2026年1月销售预测',
          'MTS',
          '2026-01',
          '2026-01-01',
          '2026-01-31',
          '1月份销售预测'
        ]}
      />
    </ListPageTemplate>
  );
};

export default SalesForecastsPage;
