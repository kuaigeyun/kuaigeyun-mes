/**
 * 入库管理页面
 *
 * 提供入库单的管理功能，支持多种入库类型：采购入库、生产入库、退货入库、初始入库等。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormText, ProFormDatePicker, ProFormDigit } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, message, Form, Card } from 'antd';
import { PlusOutlined, EyeOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import CodeField from '../../../../../components/code-field';
import { warehouseApi } from '../../../services/production';

// 统一的入库单接口（结合采购入库和成品入库）
interface InboundOrder {
  id?: number;
  tenant_id?: number;
  receipt_code?: string;
  receipt_type?: 'purchase' | 'finished_goods'; // 入库类型
  status?: string;
  receipt_date?: string;
  supplier_id?: number;
  supplier_name?: string;
  work_order_id?: number;
  work_order_code?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  received_by?: string;
  total_quantity?: number;
  total_items?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  items?: InboundOrderItem[];
}

interface InboundOrderItem {
  id?: number;
  tenant_id?: number;
  receipt_id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  quantity?: number;
  unit?: string;
  notes?: string;
}

const InboundPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Modal 相关状态（创建入库单）
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const formRef = useRef<any>(null);
  const [inboundType, setInboundType] = useState<string>('purchase');

  // Drawer 相关状态（详情查看）
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<InboundOrder | null>(null);

  /**
   * 处理创建入库单
   */
  const handleCreate = () => {
    setInboundType('purchase'); // 重置为默认类型
    setCreateModalVisible(true);
  };

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: InboundOrder) => {
    try {
      let detailData;
      if (record.receipt_type === 'purchase') {
        detailData = await warehouseApi.purchaseReceipt.get(record.id!.toString());
      } else if (record.receipt_type === 'finished_goods') {
        detailData = await warehouseApi.finishedGoodsReceipt.get(record.id!.toString());
      }
      setCurrentOrder(detailData);
      setDetailDrawerVisible(true);
    } catch (error) {
      messageApi.error('获取入库单详情失败');
    }
  };

  /**
   * 处理确认入库
   */
  const handleConfirm = async (record: InboundOrder) => {
    Modal.confirm({
      title: '确认入库',
      content: `确定要确认入库单 "${record.receipt_code}" 吗？确认后将更新库存。`,
      onOk: async () => {
        try {
          if (record.receipt_type === 'purchase') {
            await warehouseApi.purchaseReceipt.confirm(record.id!.toString());
          } else if (record.receipt_type === 'finished_goods') {
            await warehouseApi.finishedGoodsReceipt.confirm(record.id!.toString());
          }
          messageApi.success('入库确认成功，库存已更新');
          actionRef.current?.reload();
        } catch (error) {
          messageApi.error('入库确认失败');
        }
      },
    });
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<InboundOrder>[] = [
    {
      title: '入库单号',
      dataIndex: 'receipt_code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '入库类型',
      dataIndex: 'receipt_type',
      width: 100,
      valueEnum: {
        purchase: { text: '采购入库', status: 'processing' },
        finished_goods: { text: '成品入库', status: 'success' },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        '草稿': { text: '草稿', status: 'default' },
        '已确认': { text: '已确认', status: 'processing' },
        '已完成': { text: '已完成', status: 'success' },
        '已取消': { text: '已取消', status: 'error' },
      },
    },
    {
      title: '供应商',
      dataIndex: 'supplier_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: '工单号',
      dataIndex: 'work_order_code',
      width: 120,
      ellipsis: true,
    },
    {
      title: '入库数量',
      dataIndex: 'total_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '入库品种',
      dataIndex: 'total_items',
      width: 100,
      align: 'right',
    },
    {
      title: '入库仓库',
      dataIndex: 'warehouse_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: '操作员',
      dataIndex: 'received_by',
      width: 100,
      ellipsis: true,
    },
    {
      title: '入库日期',
      dataIndex: 'receipt_date',
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
      width: 120,
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
          {record.status === 'draft' && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleConfirm(record)}
              style={{ color: '#52c41a' }}
            >
              确认
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const handleFormFinish = async (values: any) => {
    try {
      messageApi.success('入库单创建成功');
      setCreateModalVisible(false);
      formRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      throw error;
    }
  };

  return (
    <ListPageTemplate>
      <UniTable
        headerTitle="入库管理"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch={true}
        request={async (params) => {
          try {
            // 并行获取采购入库单和成品入库单
            const [purchaseReceipts, finishedGoodsReceipts] = await Promise.all([
              warehouseApi.purchaseReceipt.list({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                ...params,
              }),
              warehouseApi.finishedGoodsReceipt.list({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                ...params,
              }),
            ]);

            // 合并并转换数据格式
            const purchaseData = purchaseReceipts.data?.map(item => ({
              ...item,
              receipt_type: 'purchase' as const,
            })) || [];

            const finishedData = finishedGoodsReceipts.data?.map(item => ({
              ...item,
              receipt_type: 'finished_goods' as const,
            })) || [];

            // 合并两个数据源
            const combinedData = [...purchaseData, ...finishedData];

            // 按创建时间排序
            combinedData.sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());

            return {
              data: combinedData,
              success: true,
              total: (purchaseReceipts.total || 0) + (finishedGoodsReceipts.total || 0),
            };
          } catch (error) {
            messageApi.error('获取入库单列表失败');
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
            新建入库单
          </Button>,
        ]}
      />

      <FormModalTemplate
        title="新建入库单"
        open={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onFinish={handleFormFinish}
        isEdit={false}
        initialValues={{ type: 'purchase' }}
        width={MODAL_CONFIG.SMALL_WIDTH}
        formRef={formRef}
      >
        <ProFormSelect
          name="type"
          label="入库类型"
          placeholder="请选择入库类型"
          rules={[{ required: true, message: '请选择入库类型' }]}
          options={[
            { label: '采购入库', value: 'purchase' },
            { label: '生产入库', value: 'production' },
            { label: '退货入库', value: 'return' },
            { label: '初始入库', value: 'initial' },
          ]}
          fieldProps={{
            onChange: (value: string) => setInboundType(value),
          }}
        />
        {/* 根据入库类型显示不同的编码字段 */}
        {inboundType === 'purchase' && (
          <CodeField
            pageCode="kuaizhizao-purchase-receipt"
            name="receipt_code"
            label="采购入库单编码"
            required={true}
            autoGenerateOnCreate={true}
            context={{}}
          />
        )}
        {(inboundType === 'production' || inboundType === 'initial') && (
          <CodeField
            pageCode="kuaizhizao-warehouse-finished-goods-inbound"
            name="receipt_code"
            label="成品入库单编码"
            required={true}
            autoGenerateOnCreate={true}
            context={{}}
          />
        )}
        <ProFormSelect
          name="warehouse"
          label="入库仓库"
          placeholder="请选择入库仓库"
          rules={[{ required: true, message: '请选择入库仓库' }]}
          options={[
            { label: '原材料仓库', value: 'raw-materials' },
            { label: '半成品仓库', value: 'semi-finished' },
            { label: '成品仓库', value: 'finished-goods' },
          ]}
        />
        <ProFormText
          name="supplier"
          label="供应商"
          placeholder="选择供应商"
        />
        <ProFormText
          name="workOrder"
          label="关联工单"
          placeholder="选择工单"
        />
      </FormModalTemplate>

      <DetailDrawerTemplate
        title={`入库单详情 - ${currentOrder?.receipt_code || ''}`}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        columns={[]}
        customContent={
          currentOrder ? (
            <div style={{ padding: '16px 0' }}>
              <Card title="基本信息" style={{ marginBottom: 16 }}>
                <p><strong>入库单号：</strong>{currentOrder.receipt_code}</p>
                <p><strong>入库类型：</strong>
                  <Tag color={
                    currentOrder.receipt_type === 'purchase' ? 'processing' : 'success'
                  }>
                    {currentOrder.receipt_type === 'purchase' ? '采购入库' : '成品入库'}
                  </Tag>
                </p>
                <p><strong>状态：</strong>
                  <Tag color={
                    currentOrder.status === '已完成' ? 'success' :
                    currentOrder.status === '已确认' ? 'processing' :
                    currentOrder.status === '已取消' ? 'error' : 'default'
                  }>
                    {currentOrder.status}
                  </Tag>
                </p>
                {currentOrder.supplier_name && (
                  <p><strong>供应商：</strong>{currentOrder.supplier_name}</p>
                )}
                {currentOrder.work_order_code && (
                  <p><strong>工单号：</strong>{currentOrder.work_order_code}</p>
                )}
                <p><strong>入库仓库：</strong>{currentOrder.warehouse_name}</p>
                <p><strong>入库日期：</strong>{currentOrder.receipt_date}</p>
                <p><strong>操作员：</strong>{currentOrder.received_by}</p>
                {currentOrder.notes && (
                  <p><strong>备注：</strong>{currentOrder.notes}</p>
                )}
              </Card>

              {/* 入库单明细 */}
              {currentOrder.items && currentOrder.items.length > 0 && (
                <Card title="入库明细">
                  {currentOrder.items.map((item) => (
                    <div key={item.id} style={{
                      padding: '12px',
                      marginBottom: '8px',
                      border: '1px solid #f0f0f0',
                      borderRadius: '4px'
                    }}>
                      <p><strong>物料编码：</strong>{item.material_code}</p>
                      <p><strong>物料名称：</strong>{item.material_name}</p>
                      <p><strong>数量：</strong>{item.quantity} {item.unit}</p>
                      {item.notes && <p><strong>备注：</strong>{item.notes}</p>}
                    </div>
                  ))}
                </Card>
              )}
            </div>
          ) : null
        }
      />
    </ListPageTemplate>
  );
};

export default InboundPage;
