/**
 * 入库管理页面
 *
 * 提供入库单的管理功能，支持多种入库类型：采购入库、成品入库（产品入库）、生产退料等。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormText, ProFormDatePicker, ProFormDigit } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Card, Table } from 'antd';
import { PlusOutlined, EyeOutlined, CheckCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import CodeField from '../../../../../components/code-field';
import { warehouseApi } from '../../../services/production';
import { getInboundLifecycle } from '../../../utils/inboundLifecycle';

// 统一的入库单接口（结合采购入库、成品入库、生产退料）
interface InboundOrder {
  id?: number;
  tenant_id?: number;
  receipt_code?: string;
  return_code?: string;
  receipt_type?: 'purchase' | 'finished_goods' | 'production_return';
  status?: string;
  receipt_date?: string;
  return_time?: string;
  supplier_id?: number;
  supplier_name?: string;
  work_order_id?: number;
  work_order_code?: string;
  picking_code?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  workshop_name?: string;
  received_by?: string;
  returner_name?: string;
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
      let detailData: any;
      if (record.receipt_type === 'purchase') {
        detailData = await warehouseApi.purchaseReceipt.get(record.id!.toString());
      } else if (record.receipt_type === 'finished_goods') {
        detailData = await warehouseApi.finishedGoodsReceipt.get(record.id!.toString());
      } else if (record.receipt_type === 'production_return') {
        detailData = await warehouseApi.productionReturn.get(record.id!.toString());
      }
      if (detailData) {
        setCurrentOrder({ ...detailData, receipt_type: record.receipt_type });
        setDetailDrawerVisible(true);
      }
    } catch (error) {
      messageApi.error('获取入库单详情失败');
    }
  };

  /**
   * 处理确认入库/退料
   */
  const handleConfirm = async (record: InboundOrder) => {
    const code = record.receipt_code || record.return_code || '';
    const title = record.receipt_type === 'production_return' ? '确认退料' : '确认入库';
    const content = record.receipt_type === 'production_return'
      ? `确定要确认退料单 "${code}" 吗？确认后将更新库存。`
      : `确定要确认入库单 "${code}" 吗？确认后将更新库存。`;
    Modal.confirm({
      title,
      content,
      onOk: async () => {
        try {
          if (record.receipt_type === 'purchase') {
            await warehouseApi.purchaseReceipt.confirm(record.id!.toString());
          } else if (record.receipt_type === 'finished_goods') {
            await warehouseApi.finishedGoodsReceipt.confirm(record.id!.toString());
          } else if (record.receipt_type === 'production_return') {
            await warehouseApi.productionReturn.confirm(record.id!.toString());
          }
          messageApi.success(record.receipt_type === 'production_return' ? '退料确认成功' : '入库确认成功，库存已更新');
          actionRef.current?.reload();
        } catch (error) {
          messageApi.error(record.receipt_type === 'production_return' ? '退料确认失败' : '入库确认失败');
        }
      },
    });
  };

  /**
   * 处理删除（仅生产退料支持）
   */
  const handleDelete = async (record: InboundOrder) => {
    if (record.receipt_type !== 'production_return') return;
    const code = record.return_code || record.receipt_code || '';
    Modal.confirm({
      title: '删除退料单',
      content: `确定要删除退料单 "${code}" 吗？`,
      onOk: async () => {
        try {
          await warehouseApi.productionReturn.delete(record.id!.toString());
          messageApi.success('删除成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '删除失败');
        }
      },
    });
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<InboundOrder>[] = [
    {
      title: '单号',
      dataIndex: ['receipt_code', 'return_code'],
      width: 140,
      ellipsis: true,
      fixed: 'left',
      render: (_, record) => record.receipt_code || record.return_code,
    },
    {
      title: '入库类型',
      dataIndex: 'receipt_type',
      width: 100,
      valueEnum: {
        purchase: { text: '采购入库', status: 'processing' },
        finished_goods: { text: '成品入库', status: 'success' },
        production_return: { text: '生产退料', status: 'warning' },
      },
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle',
      width: 100,
      render: (_, record) => {
        const lifecycle = getInboundLifecycle(record);
        const stageName = lifecycle.stageName ?? record.status ?? '草稿';
        const colorMap: Record<string, string> = {
          草稿: 'default',
          已确认: 'processing',
          已完成: 'success',
          已取消: 'error',
          待退料: 'default',
          已退料: 'success',
        };
        return <Tag color={colorMap[stageName] ?? 'default'}>{stageName}</Tag>;
      },
    },
    {
      title: '供应商',
      dataIndex: 'supplier_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: '工单/领料单',
      dataIndex: ['work_order_code', 'picking_code'],
      width: 140,
      ellipsis: true,
      render: (_, record) => [record.work_order_code, record.picking_code].filter(Boolean).join(' / ') || '-',
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
      dataIndex: ['received_by', 'returner_name'],
      width: 100,
      ellipsis: true,
      render: (_, record) => record.received_by || record.returner_name || '-',
    },
    {
      title: '日期',
      dataIndex: ['receipt_date', 'return_time'],
      width: 160,
      render: (_, record) => record.receipt_date || record.return_time || '-',
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
          {(record.status === 'draft' || record.status === '待退料') && (
            <>
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => handleConfirm(record)}
                style={{ color: '#52c41a' }}
              >
                {record.receipt_type === 'production_return' ? '确认退料' : '确认'}
              </Button>
              {record.receipt_type === 'production_return' && (
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(record)}
                >
                  删除
                </Button>
              )}
            </>
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
        rowKey={(record) => `${record.receipt_type}::${record.id}`}
        columns={columns}
        showAdvancedSearch={true}
        request={async (params) => {
          try {
            const skip = ((params.current || 1) - 1) * (params.pageSize || 20);
            const limit = params.pageSize || 20;
            const listParams = { skip, limit, ...params };

            // 并行获取采购入库单、成品入库单、生产退料单
            const [purchaseReceipts, finishedGoodsReceipts, productionReturns] = await Promise.all([
              warehouseApi.purchaseReceipt.list(listParams),
              warehouseApi.finishedGoodsReceipt.list(listParams),
              warehouseApi.productionReturn.list(listParams),
            ]);

            const purchaseData = (purchaseReceipts.data ?? purchaseReceipts.items ?? [])?.map((item: any) => ({
              ...item,
              receipt_type: 'purchase' as const,
            })) || [];

            const finishedData = (finishedGoodsReceipts.data ?? finishedGoodsReceipts.items ?? [])?.map((item: any) => ({
              ...item,
              receipt_type: 'finished_goods' as const,
            })) || [];

            const returnData = (Array.isArray(productionReturns) ? productionReturns : (productionReturns.data ?? productionReturns.items ?? []))?.map((item: any) => ({
              ...item,
              receipt_type: 'production_return' as const,
              receipt_code: item.return_code,
            })) || [];

            const combinedData = [...purchaseData, ...finishedData, ...returnData];
            combinedData.sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());

            const total = (purchaseReceipts.total ?? purchaseData.length) + (finishedGoodsReceipts.total ?? finishedData.length) + (productionReturns?.total ?? returnData.length);

            return {
              data: combinedData,
              success: true,
              total,
            };
          } catch (error) {
            messageApi.error('获取入库单列表失败');
            return { data: [], success: false, total: 0 };
          }
        }}
        enableRowSelection={true}
        showDeleteButton={true}
        onDelete={async (keys) => {
          Modal.confirm({
            title: '确认批量删除',
            content: `确定要删除选中的 ${keys.length} 条入库单吗？`,
            onOk: async () => {
              try {
                for (const key of keys) {
                  const [type, id] = String(key).split('::');
                  if (type === 'purchase') {
                    await warehouseApi.purchaseReceipt.delete(id);
                  } else if (type === 'finished_goods') {
                    await warehouseApi.finishedGoodsReceipt.delete(id);
                  } else if (type === 'production_return') {
                    await warehouseApi.productionReturn.delete(id);
                  }
                }
                messageApi.success(`成功删除 ${keys.length} 条记录`);
                actionRef.current?.reload();
              } catch (error: any) {
                messageApi.error(error?.message || '删除失败');
              }
            },
          });
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
        <ProFormText
          name="batch_number"
          label="批号"
          placeholder="请输入批号（批号管理物料必填）"
          tooltip="如果所选物料启用了批号管理，此字段为必填"
        />
        <ProFormDatePicker
          name="expiry_date"
          label="有效期"
          placeholder="请选择有效期"
          tooltip="有保质期要求的物料需要填写有效期"
        />
      </FormModalTemplate>

      <DetailDrawerTemplate
        title={`${currentOrder?.receipt_type === 'production_return' ? '生产退料单' : '入库单'}详情 - ${currentOrder?.receipt_code || currentOrder?.return_code || ''}`}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        customContent={
          currentOrder ? (
            <div style={{ padding: '16px 0' }}>
              <Card title="基本信息" style={{ marginBottom: 16 }}>
                <p><strong>单号：</strong>{currentOrder.receipt_code || currentOrder.return_code}</p>
                <p><strong>类型：</strong>
                  <Tag color={
                    currentOrder.receipt_type === 'purchase' ? 'processing' :
                      currentOrder.receipt_type === 'finished_goods' ? 'success' : 'warning'
                  }>
                    {currentOrder.receipt_type === 'purchase' ? '采购入库' : currentOrder.receipt_type === 'finished_goods' ? '成品入库' : '生产退料'}
                  </Tag>
                </p>
                <p><strong>状态：</strong>
                  <Tag color={
                    (currentOrder.status === '已完成' || currentOrder.status === '已退料') ? 'success' :
                      (currentOrder.status === '已确认' || currentOrder.status === '待退料') ? 'processing' :
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
                {currentOrder.picking_code && (
                  <p><strong>领料单号：</strong>{currentOrder.picking_code}</p>
                )}
                {currentOrder.workshop_name && (
                  <p><strong>车间：</strong>{currentOrder.workshop_name}</p>
                )}
                <p><strong>仓库：</strong>{currentOrder.warehouse_name}</p>
                <p><strong>日期：</strong>{currentOrder.receipt_date || currentOrder.return_time}</p>
                <p><strong>操作员：</strong>{currentOrder.received_by || currentOrder.returner_name}</p>
                {currentOrder.notes && (
                  <p><strong>备注：</strong>{currentOrder.notes}</p>
                )}
              </Card>

              {/* 入库/退料明细 */}
              {currentOrder.items && currentOrder.items.length > 0 && (
                <Card title={currentOrder.receipt_type === 'production_return' ? '退料明细' : '入库明细'}>
                  <Table
                    size="small"
                    rowKey="id"
                    pagination={false}
                    columns={currentOrder.receipt_type === 'production_return'
                      ? [
                          { title: '物料编码', dataIndex: 'material_code', width: 120 },
                          { title: '物料名称', dataIndex: 'material_name', width: 150 },
                          { title: '单位', dataIndex: 'material_unit', width: 60 },
                          { title: '退料数量', dataIndex: 'return_quantity', width: 100, align: 'right' as const },
                          { title: '仓库', dataIndex: 'warehouse_name', width: 120 },
                          { title: '批次号', dataIndex: 'batch_number', width: 100 },
                        ]
                      : [
                          { title: '物料编码', dataIndex: 'material_code', width: 120 },
                          { title: '物料名称', dataIndex: 'material_name', width: 150 },
                          { title: '数量', dataIndex: 'quantity', width: 100, align: 'right' as const },
                          { title: '单位', dataIndex: 'unit', width: 60 },
                        ]
                    }
                    dataSource={currentOrder.items}
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

export default InboundPage;
