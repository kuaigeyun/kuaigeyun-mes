/**
 * BOM管理页面
 *
 * 提供物料清单的创建、编辑、查看和多层展开功能
 *
 * @author RiverEdge Team
 * @date 2025-12-30
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Drawer, Tree, Card, Row, Col, Statistic, Input, Select, message, Table } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, NodeIndexOutlined, ExperimentOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { bomApi } from '../../../services/production';

// BOM接口定义
interface BillOfMaterials {
  id?: number;
  tenant_id?: number;
  bom_code?: string;
  bom_name?: string;
  product_id?: number;
  product_code?: string;
  product_name?: string;
  version?: string;
  status?: string;
  effective_date?: string;
  expiration_date?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  items?: BOMItem[];
}

interface BOMItem {
  id?: number;
  tenant_id?: number;
  bom_id?: number;
  component_material_id?: number;
  component_material_code?: string;
  component_material_name?: string;
  quantity?: number;
  unit?: string;
  level?: number;
  is_phantom?: boolean;
  notes?: string;
}

interface BOMExpansionResult {
  bom_id?: number;
  total_items?: number;
  levels?: number;
  items?: BOMExpansionItem[];
}

interface BOMExpansionItem {
  material_code?: string;
  material_name?: string;
  quantity?: number;
  unit?: string;
  level?: number;
  path?: string;
}

const BOMManagementPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Modal 相关状态
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [currentBOM, setCurrentBOM] = useState<BillOfMaterials | null>(null);

  // Drawer 相关状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [expansionDrawerVisible, setExpansionDrawerVisible] = useState(false);
  const [expansionResult, setExpansionResult] = useState<BOMExpansionResult | null>(null);

  // 表格列定义
  const columns: ProColumns<BillOfMaterials>[] = [
    {
      title: 'BOM编码',
      dataIndex: 'bom_code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: 'BOM名称',
      dataIndex: 'bom_name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '产品编码',
      dataIndex: 'product_code',
      width: 120,
      ellipsis: true,
    },
    {
      title: '产品名称',
      dataIndex: 'product_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '版本',
      dataIndex: 'version',
      width: 80,
      align: 'center',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status) => {
        const statusMap = {
          '草稿': { text: '草稿', color: 'default' },
          '已审核': { text: '已审核', color: 'processing' },
          '已生效': { text: '已生效', color: 'success' },
          '已失效': { text: '已失效', color: 'error' },
        };
        const config = statusMap[status as keyof typeof statusMap] || statusMap['草稿'];
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '生效日期',
      dataIndex: 'effective_date',
      valueType: 'date',
      width: 120,
    },
    {
      title: '失效日期',
      dataIndex: 'expiration_date',
      valueType: 'date',
      width: 120,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '操作',
      width: 200,
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
            icon={<NodeIndexOutlined />}
            onClick={() => handleExpansion(record)}
            style={{ color: '#1890ff' }}
          >
            展开
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
        </Space>
      ),
    },
  ];

  // 处理详情查看
  const handleDetail = async (record: BillOfMaterials) => {
    try {
      const detail = await bomApi.billOfMaterials.get(record.id!.toString());
      setCurrentBOM(detail);
      setDetailDrawerVisible(true);
    } catch (error) {
      messageApi.error('获取BOM详情失败');
    }
  };

  // 处理BOM展开
  const handleExpansion = async (record: BillOfMaterials) => {
    try {
      const result = await bomApi.billOfMaterials.expand(record.id!.toString(), {
        required_quantity: 1,
        include_phantom: true,
      });
      setExpansionResult(result);
      setExpansionDrawerVisible(true);
    } catch (error) {
      messageApi.error('BOM展开失败');
    }
  };

  // 处理编辑
  const handleEdit = (record: BillOfMaterials) => {
    setCurrentBOM(record);
    setEditModalVisible(true);
  };

  // 处理创建
  const handleCreate = () => {
    setCurrentBOM(null);
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
                  title="总BOM数量"
                  value={25}
                  prefix={<NodeIndexOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="生效中BOM"
                  value={18}
                  prefix={<ExperimentOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="草稿BOM"
                  value={5}
                  suffix="个"
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="平均层级"
                  value={2.3}
                  suffix="级"
                  precision={1}
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
          </Row>
        </div>

        {/* BOM管理表格 */}
        <UniTable
          headerTitle="BOM管理"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          request={async (params) => {
            try {
              const response = await bomApi.billOfMaterials.list({
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
              messageApi.error('获取BOM列表失败');
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
              新建BOM
            </Button>,
          ]}
          scroll={{ x: 1400 }}
        />
      </div>

      {/* 创建BOM Modal */}
      <Modal
        title="新建BOM"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={() => {
          messageApi.success('BOM创建成功');
          setCreateModalVisible(false);
          actionRef.current?.reload();
        }}
        width={600}
      >
        <div style={{ padding: '16px 0' }}>
          {/* 这里可以添加BOM创建表单组件 */}
          <p>BOM创建表单开发中...</p>
        </div>
      </Modal>

      {/* 编辑BOM Modal */}
      <Modal
        title="编辑BOM"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={() => {
          messageApi.success('BOM更新成功');
          setEditModalVisible(false);
          actionRef.current?.reload();
        }}
        width={600}
      >
        <div style={{ padding: '16px 0' }}>
          {/* 这里可以添加BOM编辑表单组件 */}
          <p>BOM编辑表单开发中...</p>
        </div>
      </Modal>

      {/* BOM详情 Drawer */}
      <Drawer
        title={`BOM详情 - ${currentBOM?.bom_code}`}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={700}
      >
        {currentBOM && (
          <div style={{ padding: '16px 0' }}>
            <Card title="基本信息" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <strong>BOM编码：</strong>{currentBOM.bom_code}
                </Col>
                <Col span={12}>
                  <strong>BOM名称：</strong>{currentBOM.bom_name}
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 8 }}>
                <Col span={12}>
                  <strong>产品编码：</strong>{currentBOM.product_code}
                </Col>
                <Col span={12}>
                  <strong>产品名称：</strong>{currentBOM.product_name}
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 8 }}>
                <Col span={8}>
                  <strong>版本：</strong>{currentBOM.version}
                </Col>
                <Col span={8}>
                  <strong>状态：</strong>
                  <Tag color={currentBOM.status === '已生效' ? 'success' : 'default'}>
                    {currentBOM.status}
                  </Tag>
                </Col>
                <Col span={8}>
                  <strong>创建时间：</strong>{currentBOM.created_at}
                </Col>
              </Row>
            </Card>

            {/* BOM明细 */}
            {currentBOM.items && currentBOM.items.length > 0 && (
              <Card title="BOM明细">
                <Table
                  size="small"
                  columns={[
                    { title: '物料编码', dataIndex: 'component_material_code', width: 120 },
                    { title: '物料名称', dataIndex: 'component_material_name', width: 150 },
                    { title: '数量', dataIndex: 'quantity', width: 80, align: 'right' },
                    { title: '单位', dataIndex: 'unit', width: 60 },
                    { title: '层级', dataIndex: 'level', width: 60 },
                    { title: '是否虚拟件', dataIndex: 'is_phantom', width: 100, render: (val) => val ? '是' : '否' },
                  ]}
                  dataSource={currentBOM.items}
                  pagination={false}
                  rowKey="id"
                  bordered
                />
              </Card>
            )}
          </div>
        )}
      </Drawer>

      {/* BOM展开结果 Drawer */}
      <Drawer
        title="BOM展开结果"
        open={expansionDrawerVisible}
        onClose={() => setExpansionDrawerVisible(false)}
        width={800}
      >
        {expansionResult && (
          <div style={{ padding: '16px 0' }}>
            <Card title="展开统计" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={8}>
                  <Statistic title="总物料项数" value={expansionResult.total_items} />
                </Col>
                <Col span={8}>
                  <Statistic title="展开层数" value={expansionResult.levels} />
                </Col>
                <Col span={8}>
                  <Statistic title="基础物料数" value={expansionResult.items?.filter(item => item.level === expansionResult.levels).length} />
                </Col>
              </Row>
            </Card>

            <Card title="展开明细">
              <Table
                size="small"
                columns={[
                  { title: '物料编码', dataIndex: 'material_code', width: 120 },
                  { title: '物料名称', dataIndex: 'material_name', width: 150 },
                  { title: '数量', dataIndex: 'quantity', width: 80, align: 'right' },
                  { title: '单位', dataIndex: 'unit', width: 60 },
                  { title: '层级', dataIndex: 'level', width: 60 },
                  { title: '路径', dataIndex: 'path', width: 200, ellipsis: true },
                ]}
                dataSource={expansionResult.items}
                pagination={{ pageSize: 20 }}
                rowKey={(record, index) => `${record.material_code}-${index}`}
                bordered
              />
            </Card>
          </div>
        )}
      </Drawer>
    </>
  );
};

export default BOMManagementPage;
