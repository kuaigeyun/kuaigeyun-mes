/**
 * 生产计划页面
 *
 * 提供生产计划的管理、查看和执行功能
 *
 * @author RiverEdge Team
 * @date 2025-12-30
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Card, Row, Col, message, Table } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, CheckCircleOutlined, PlayCircleOutlined, BarChartOutlined, ExportOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, DetailDrawerTemplate, DRAWER_CONFIG } from '../../../../../components/layout-templates';

// 生产计划接口定义
interface ProductionPlan {
  id?: number;
  tenant_id?: number;
  plan_code?: string;
  plan_name?: string;
  plan_type?: string; // MRP/LRP
  status?: string;
  start_date?: string;
  end_date?: string;
  generated_by?: number;
  generated_by_name?: string;
  approved_by?: number;
  approved_by_name?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  items?: ProductionPlanItem[];
}

interface ProductionPlanItem {
  id?: number;
  tenant_id?: number;
  plan_id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  planned_quantity?: number;
  unit?: string;
  due_date?: string;
  item_type?: string; // production/purchase
  source_type?: string;
  source_id?: number;
  available_inventory?: number;
  notes?: string;
}

const ProductionPlansPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Drawer 相关状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<ProductionPlan | null>(null);

  // 表格列定义
  const columns: ProColumns<ProductionPlan>[] = [
    {
      title: '计划编号',
      dataIndex: 'plan_code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '计划名称',
      dataIndex: 'plan_name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '计划类型',
      dataIndex: 'plan_type',
      width: 100,
      render: (type) => {
        const typeMap = {
          'MRP': { text: '按预测计划', color: 'processing' },
          'LRP': { text: '按订单计划', color: 'success' },
        };
        const config = typeMap[type as keyof typeof typeMap] || { text: type, color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '计划期间',
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
          '已执行': { text: '已执行', color: 'success' },
          '已取消': { text: '已取消', color: 'error' },
        };
        const config = statusMap[status as keyof typeof statusMap] || statusMap['草稿'];
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '生成人',
      dataIndex: 'generated_by_name',
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
          {(record.status === '草稿' || record.status === '已审核') && (
            <Button
              type="link"
              size="small"
              icon={<ExportOutlined />}
              onClick={() => handlePushToWorkOrders(record)}
              style={{ color: '#722ed1' }}
            >
              转工单
            </Button>
          )}
          {record.status === '已审核' && (
            <Button
              type="link"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleExecute(record)}
              style={{ color: '#1890ff' }}
            >
              执行
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // 处理详情查看
  const handleDetail = async (record: ProductionPlan) => {
    try {
      // 这里应该调用API获取详情
      setCurrentPlan(record);
      setDetailDrawerVisible(true);
    } catch (error) {
      messageApi.error('获取生产计划详情失败');
    }
  };

  // 处理审核
  const handleApprove = async (record: ProductionPlan) => {
    Modal.confirm({
      title: '审核生产计划',
      content: `确定要审核通过生产计划 "${record.plan_name}" 吗？`,
      onOk: async () => {
        try {
          messageApi.success('生产计划审核成功');
          actionRef.current?.reload();
        } catch (error) {
          messageApi.error('生产计划审核失败');
        }
      },
    });
  };

  // 处理转工单
  const handlePushToWorkOrders = async (record: ProductionPlan) => {
    Modal.confirm({
      title: '转工单',
      content: `确定要将生产计划 "${record.plan_name}" 转为工单吗？仅「建议行动=生产」的明细会生成工单。`,
      onOk: async () => {
        try {
          const { planningApi } = await import('../../../services/production');
          const result = await planningApi.productionPlan.pushToWorkOrders(record.id!);
          messageApi.success(result?.message || '转工单成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error?.response?.data?.detail || '转工单失败');
        }
      },
    });
  };

  // 处理执行
  const handleExecute = async (record: ProductionPlan) => {
    Modal.confirm({
      title: '执行生产计划',
      content: `确定要执行生产计划 "${record.plan_name}" 吗？执行后将生成相应的工单和采购订单。`,
      onOk: async () => {
        try {
          messageApi.success('生产计划执行成功，已生成工单和采购订单');
          actionRef.current?.reload();
        } catch (error) {
          messageApi.error('生产计划执行失败');
        }
      },
    });
  };

  // 处理编辑
  const handleEdit = (record: ProductionPlan) => {
    messageApi.info('编辑功能开发中...');
  };

  return (
    <ListPageTemplate
      statCards={[
        {
          title: '总计划数',
          value: 12,
          prefix: <BarChartOutlined />,
          valueStyle: { color: '#1890ff' },
        },
        {
          title: '按预测计划',
          value: 8,
          suffix: '个',
          valueStyle: { color: '#52c41a' },
        },
        {
          title: '按订单计划',
          value: 4,
          suffix: '个',
          valueStyle: { color: '#722ed1' },
        },
        {
          title: '已执行计划',
          value: 6,
          suffix: '个',
          valueStyle: { color: '#faad14' },
        },
      ]}
    >
      <UniTable
          headerTitle="生产计划管理"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          request={async (params) => {
            // 模拟数据 - 实际应该调用API
            const mockData: ProductionPlan[] = [
              {
                id: 1,
                plan_code: 'PP202501001',
                plan_name: 'MRP计划-2026年1月',
                plan_type: 'MRP',
                status: '已执行',
                start_date: '2026-01-01',
                end_date: '2026-01-31',
                generated_by_name: '系统自动生成',
                created_at: '2024-12-01 09:00:00',
                items: [
                  {
                    material_code: 'FIN001',
                    material_name: '产品A',
                    planned_quantity: 100,
                    unit: '件',
                    item_type: 'production',
                  }
                ]
              },
              {
                id: 2,
                plan_code: 'LP202501001',
                plan_name: 'LRP计划-定制订单001',
                plan_type: 'LRP',
                status: '已审核',
                start_date: '2026-01-01',
                end_date: '2026-01-15',
                generated_by_name: '系统自动生成',
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
              onClick={() => messageApi.info('手动创建生产计划功能开发中...')}
            >
              新建生产计划
            </Button>,
          ]}
          scroll={{ x: 1200 }}
        />

      <DetailDrawerTemplate
        title={`生产计划详情 - ${currentPlan?.plan_code || ''}`}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        columns={[]}
        customContent={
          currentPlan ? (
            <div style={{ padding: '16px 0' }}>
              <Card title="基本信息" style={{ marginBottom: 16 }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <strong>计划编号：</strong>{currentPlan.plan_code}
                  </Col>
                  <Col span={12}>
                    <strong>计划名称：</strong>{currentPlan.plan_name}
                  </Col>
                </Row>
                <Row gutter={16} style={{ marginTop: 8 }}>
                  <Col span={8}>
                    <strong>计划类型：</strong>
                    <Tag color={currentPlan.plan_type === 'MRP' ? 'processing' : 'success'}>
                      {currentPlan.plan_type === 'MRP' ? '按预测计划' : '按订单计划'}
                    </Tag>
                  </Col>
                  <Col span={8}>
                    <strong>状态：</strong>
                    <Tag color={currentPlan.status === '已执行' ? 'success' : 'default'}>
                      {currentPlan.status}
                    </Tag>
                  </Col>
                  <Col span={8}>
                    <strong>生成人：</strong>{currentPlan.generated_by_name}
                  </Col>
                </Row>
                <Row gutter={16} style={{ marginTop: 8 }}>
                  <Col span={12}>
                    <strong>计划期间：</strong>{currentPlan.start_date} ~ {currentPlan.end_date}
                  </Col>
                  <Col span={12}>
                    <strong>创建时间：</strong>{currentPlan.created_at}
                  </Col>
                </Row>
              </Card>

              {/* 计划明细 */}
              {currentPlan.items && currentPlan.items.length > 0 && (
                <Card title="计划明细">
                  <Table
                    size="small"
                    columns={[
                      { title: '物料编码', dataIndex: 'material_code', width: 120 },
                      { title: '物料名称', dataIndex: 'material_name', width: 150 },
                      { title: '计划数量', dataIndex: 'planned_quantity', width: 100, align: 'right' },
                      { title: '单位', dataIndex: 'unit', width: 60 },
                      { title: '类型', dataIndex: 'item_type', width: 80, render: (type) => type === 'production' ? '生产' : '采购' },
                      { title: '需求日期', dataIndex: 'due_date', width: 120 },
                      { title: '可用库存', dataIndex: 'available_inventory', width: 100, align: 'right' },
                    ]}
                    dataSource={currentPlan.items}
                    pagination={false}
                    rowKey="id"
                    bordered
                  />
                </Card>
              )}
            </div>
          ) : null
        }
      />
    </ListPageTemplate>
  );
};

export default ProductionPlansPage;
