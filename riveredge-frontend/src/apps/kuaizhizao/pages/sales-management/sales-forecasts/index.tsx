/**
 * 销售预测页面
 *
 * 提供销售预测的创建、编辑、查看和管理功能
 *
 * @author RiverEdge Team
 * @date 2025-12-30
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Drawer, Form, Card, Row, Col, Statistic, Input, Select, DatePicker, Table, message } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, CheckCircleOutlined, CalculatorOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';

// 销售预测接口定义
interface SalesForecast {
  id?: number;
  tenant_id?: number;
  forecast_code?: string;
  forecast_name?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
  reviewer_id?: number;
  reviewer_name?: string;
  review_time?: string;
  review_status?: string;
  review_remarks?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  forecast_items?: ForecastItem[];
}

interface ForecastItem {
  id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  component_type?: string;
  forecast_date?: string;
  forecast_quantity?: number;
}

const SalesForecastsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Modal 相关状态
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [currentForecast, setCurrentForecast] = useState<SalesForecast | null>(null);

  // Drawer 相关状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [forecastDetail, setForecastDetail] = useState<SalesForecast | null>(null);

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
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleApprove(record)}
              style={{ color: '#52c41a' }}
            >
              审核
            </Button>
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
      // 这里应该调用API获取详情
      setForecastDetail(record);
      setDetailDrawerVisible(true);
    } catch (error) {
      messageApi.error('获取销售预测详情失败');
    }
  };

  // 处理审核
  const handleApprove = async (record: SalesForecast) => {
    Modal.confirm({
      title: '审核销售预测',
      content: `确定要审核通过销售预测 "${record.forecast_name}" 吗？`,
      onOk: async () => {
        try {
          messageApi.success('销售预测审核成功');
          actionRef.current?.reload();
        } catch (error) {
          messageApi.error('销售预测审核失败');
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
  const handleEdit = (record: SalesForecast) => {
    setCurrentForecast(record);
    setEditModalVisible(true);
  };

  // 处理创建
  const handleCreate = () => {
    setCurrentForecast(null);
    setCreateModalVisible(true);
  };

  return (
    <>
      <div>
        {/* 统计卡片 */}
        <div style={{ padding: '16px 16px 0 16px' }}>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="总预测数"
                  value={12}
                  prefix={<CalculatorOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="已审核预测"
                  value={8}
                  suffix="个"
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="草稿预测"
                  value={3}
                  suffix="个"
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="预测准确率"
                  value={92.5}
                  suffix="%"
                  precision={1}
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
          </Row>
        </div>

        {/* 销售预测表格 */}
        <UniTable
          headerTitle="销售预测管理"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          request={async (params) => {
            // 模拟数据 - 实际应该调用API
            const mockData: SalesForecast[] = [
              {
                id: 1,
                forecast_code: 'FC202501001',
                forecast_name: '2026年1月销售预测',
                start_date: '2026-01-01',
                end_date: '2026-01-31',
                status: '已审核',
                review_status: '审核通过',
                reviewer_name: '张经理',
                created_at: '2024-12-01 09:00:00',
                forecast_items: [
                  {
                    material_code: 'FIN001',
                    material_name: '产品A',
                    forecast_date: '2026-01-15',
                    forecast_quantity: 100,
                  }
                ]
              },
              {
                id: 2,
                forecast_code: 'FC202502001',
                forecast_name: '2026年2月销售预测',
                start_date: '2026-02-01',
                end_date: '2026-02-28',
                status: '草稿',
                review_status: '待审核',
                created_at: '2024-12-01 10:30:00',
              }
            ];

            return {
              data: mockData,
              success: true,
              total: mockData.length,
            };
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
          ]}
          scroll={{ x: 1200 }}
        />
      </div>

      {/* 创建销售预测 Modal */}
      <Modal
        title="新建销售预测"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={() => {
          messageApi.success('销售预测创建成功');
          setCreateModalVisible(false);
          actionRef.current?.reload();
        }}
        width={600}
      >
        <div style={{ padding: '16px 0' }}>
          {/* 这里可以添加销售预测创建表单组件 */}
          <p>销售预测创建表单开发中...</p>
        </div>
      </Modal>

      {/* 编辑销售预测 Modal */}
      <Modal
        title="编辑销售预测"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={() => {
          messageApi.success('销售预测更新成功');
          setEditModalVisible(false);
          actionRef.current?.reload();
        }}
        width={600}
      >
        <div style={{ padding: '16px 0' }}>
          {/* 这里可以添加销售预测编辑表单组件 */}
          <p>销售预测编辑表单开发中...</p>
        </div>
      </Modal>

      {/* 销售预测详情 Drawer */}
      <Drawer
        title={`销售预测详情 - ${forecastDetail?.forecast_code}`}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={700}
      >
        {forecastDetail && (
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
              <Card title="预测明细">
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
          </div>
        )}
      </Drawer>
    </>
  );
};

export default SalesForecastsPage;
