/**
 * 需求管理页面
 *
 * 提供销售预测的管理功能，支持MTS/MTO两种模式的需求预测。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormText, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Drawer, message, Form, Table, Input, Select } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, CalculatorOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { planningApi } from '../../../services/production';

// 使用后端销售预测接口定义
interface DemandForecast {
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
  // 预测明细
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

const DemandManagementPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Modal 相关状态（创建/编辑销售预测）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentForecast, setCurrentForecast] = useState<DemandForecast | null>(null);

  // Drawer 相关状态（详情查看）
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);

  /**
   * 处理创建销售预测
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentForecast(null);
    setModalVisible(true);
  };

  /**
   * 处理编辑销售预测
   */
  const handleEdit = (record: DemandForecast) => {
    setIsEdit(true);
    setCurrentForecast(record);
    setModalVisible(true);
  };

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: DemandForecast) => {
    try {
      const detail = await planningApi.productionPlan.get(record.id!.toString());
      setCurrentForecast(detail);
      setDetailDrawerVisible(true);
    } catch (error) {
      messageApi.error('获取销售预测详情失败');
    }
  };

  /**
   * 处理审核预测
   */
  const handleActivate = (record: DemandForecast) => {
    Modal.confirm({
      title: '审核销售预测',
      content: `确定要审核通过销售预测 "${record.forecast_name}" 吗？审核后将可用于MRP运算。`,
      onOk: async () => {
        try {
          // 这里应该调用审核API，暂时模拟
          messageApi.success('销售预测审核成功');
          actionRef.current?.reload();
        } catch (error) {
          messageApi.error('销售预测审核失败');
        }
      },
    });
  };

  /**
   * 处理运行MRP
   */
  const handleRunMRP = async (record: DemandForecast) => {
    Modal.confirm({
      title: '运行MRP运算',
      content: `确定要基于销售预测 "${record.forecast_name}" 运行MRP运算吗？`,
      onOk: async () => {
        try {
          if (record.id) {
            await planningApi.mrp.compute({
              forecast_id: record.id,
              planning_horizon: 30,
              time_bucket: '周',
              include_safety_stock: true,
              explosion_type: 'single_level',
            });
            messageApi.success('MRP运算已启动，请稍后查看结果');
          }
        } catch (error) {
          messageApi.error('MRP运算启动失败');
        }
      },
    });
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<DemandForecast>[] = [
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
      valueEnum: {
        '草稿': { text: '草稿', status: 'default' },
        '已审核': { text: '已审核', status: 'processing' },
        '已完成': { text: '已完成', status: 'success' },
        '已取消': { text: '已取消', status: 'error' },
      },
    },
    {
      title: '审核状态',
      dataIndex: 'review_status',
      width: 100,
      valueEnum: {
        '待审核': { text: '待审核', status: 'default' },
        '审核通过': { text: '审核通过', status: 'success' },
        '审核驳回': { text: '审核驳回', status: 'error' },
      },
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
              onClick={() => handleActivate(record)}
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
              运行MRP
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <UniTable
        headerTitle="需求管理 - 销售预测"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch={true}
        request={async (params) => {
          try {
            const response = await planningApi.productionPlan.list({
              skip: (params.current! - 1) * params.pageSize!,
              limit: params.pageSize,
              ...params,
            });
            return {
              data: response.data,
              success: response.success,
              total: response.total,
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
        ]}
      />

      {/* 创建/编辑销售预测 Modal */}
      <Modal
        title={isEdit ? '编辑销售预测' : '新建销售预测'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => {
          messageApi.success(isEdit ? '销售预测更新成功' : '销售预测创建成功');
          setModalVisible(false);
          actionRef.current?.reload();
        }}
        width={800}
      >
        <Form layout="vertical" style={{ padding: '16px 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Form.Item
              label="预测名称"
              required
            >
              <Input placeholder="请输入预测名称" />
            </Form.Item>

            <Form.Item
              label="生产模式"
              required
            >
              <Select defaultValue="MTS">
                <Select.Option value="MTS">按库存生产 (MTS)</Select.Option>
                <Select.Option value="MTO">按订单生产 (MTO)</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item
              label="产品"
              required
            >
              <Select placeholder="选择产品">
                <Select.Option value="FIN001">产品A</Select.Option>
                <Select.Option value="FIN002">产品B</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item
              label="预测周期"
              required
            >
              <Input placeholder="例如：2026-01" />
            </Form.Item>

            <Form.Item
              label="预测数量"
              required
            >
              <Input type="number" placeholder="请输入预测数量" />
            </Form.Item>

            <Form.Item
              label="单位"
              required
            >
              <Input placeholder="例如：个、kg" defaultValue="个" />
            </Form.Item>
          </div>

          <Form.Item
            label="备注"
          >
            <Input.TextArea rows={3} placeholder="请输入备注信息" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 销售预测详情 Drawer */}
      <Drawer
        title="销售预测详情"
        size="large"
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
      >
        {currentForecast && (
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div><strong>预测编号：</strong>{currentForecast.forecast_code}</div>
              <div><strong>预测名称：</strong>{currentForecast.forecast_name}</div>
              <div><strong>预测期间：</strong>{currentForecast.start_date} ~ {currentForecast.end_date}</div>
              <div><strong>状态：</strong>
                <Tag color={
                  currentForecast.status === '已审核' ? 'processing' :
                  currentForecast.status === '已完成' ? 'success' :
                  currentForecast.status === '已取消' ? 'error' : 'default'
                }>
                  {currentForecast.status}
                </Tag>
              </div>
              <div><strong>审核状态：</strong>
                <Tag color={
                  currentForecast.review_status === '审核通过' ? 'success' :
                  currentForecast.review_status === '审核驳回' ? 'error' : 'default'
                }>
                  {currentForecast.review_status}
                </Tag>
              </div>
              <div><strong>审核人：</strong>{currentForecast.reviewer_name}</div>
              <div><strong>审核时间：</strong>{currentForecast.review_time}</div>
              <div><strong>创建时间：</strong>{currentForecast.created_at}</div>
            </div>

            {currentForecast.review_remarks && (
              <div style={{ marginBottom: '24px' }}>
                <strong>审核备注：</strong>{currentForecast.review_remarks}
              </div>
            )}

            {currentForecast.notes && (
              <div style={{ marginBottom: '24px' }}>
                <strong>备注：</strong>{currentForecast.notes}
              </div>
            )}

            {/* 预测明细表格 */}
            {currentForecast.forecast_items && currentForecast.forecast_items.length > 0 && (
              <div>
                <h4>预测明细</h4>
                <Table
                  size="small"
                  columns={[
                    { title: '物料编码', dataIndex: 'material_code', width: 120 },
                    { title: '物料名称', dataIndex: 'material_name', width: 150 },
                    { title: '类型', dataIndex: 'component_type', width: 100 },
                    { title: '预测日期', dataIndex: 'forecast_date', width: 120 },
                    { title: '预测数量', dataIndex: 'forecast_quantity', width: 120, align: 'right' },
                  ]}
                  dataSource={currentForecast.forecast_items}
                  pagination={false}
                  bordered
                  rowKey="id"
                />
              </div>
            )}
          </div>
        )}
      </Drawer>
    </>
  );
};

export default DemandManagementPage;
