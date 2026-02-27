/**
 * 出库管理页面
 *
 * 提供出库单的管理功能，支持多种出库类型：生产领料、销售出库、退货出库等。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, message, Card, theme } from 'antd';
import { PlusOutlined, EyeOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import CodeField from '../../../../../components/code-field';
import { warehouseApi } from '../../../services/production';
import { getOutboundLifecycle } from '../../../utils/outboundLifecycle';

// 统一的出库单接口（结合生产领料和销售出库）
interface OutboundOrder {
  id?: number;
  tenant_id?: number;
  delivery_code?: string; // 销售出库单编码
  picking_code?: string; // 生产领料单编码
  outbound_type?: 'production_picking' | 'sales_delivery'; // 出库类型
  status?: string;
  delivery_date?: string; // 出库日期
  customer_id?: number;
  customer_name?: string;
  work_order_id?: number;
  work_order_code?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  delivered_by?: string; // 操作员
  total_quantity?: number;
  total_items?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  items?: OutboundOrderItem[];
}

interface OutboundOrderItem {
  id?: number;
  tenant_id?: number;
  delivery_id?: number; // 销售出库单明细ID
  picking_id?: number; // 生产领料单明细ID
  material_id?: number;
  material_code?: string;
  material_name?: string;
  quantity?: number;
  unit?: string;
  notes?: string;
}

const { useToken } = theme;

const OutboundPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const { token } = useToken();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Modal 相关状态（创建出库单）
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const formRef = useRef<any>(null);
  const [outboundType, setOutboundType] = useState<string>('production');

  // Drawer 相关状态（详情查看）
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<OutboundOrder | null>(null);

  /**
   * 处理创建出库单
   */
  const handleCreate = () => {
    setOutboundType('production'); // 重置为默认类型
    setCreateModalVisible(true);
  };

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: OutboundOrder) => {
    try {
      let detailData;
      if (record.outbound_type === 'production_picking') {
        detailData = await warehouseApi.productionPicking.get(record.id!.toString());
      } else if (record.outbound_type === 'sales_delivery') {
        detailData = await warehouseApi.salesDelivery.get(record.id!.toString());
      }
      setCurrentOrder(detailData);
      setDetailDrawerVisible(true);
    } catch (error) {
      messageApi.error('获取出库单详情失败');
    }
  };

  /**
   * 处理确认出库
   */
  const handleConfirm = async (record: OutboundOrder) => {
    Modal.confirm({
      title: '确认出库',
      content: `确定要确认出库单 "${record.delivery_code || record.picking_code}" 吗？确认后将更新库存。`,
      onOk: async () => {
        try {
          if (record.outbound_type === 'production_picking') {
            await warehouseApi.productionPicking.confirm(record.id!.toString());
          } else if (record.outbound_type === 'sales_delivery') {
            await warehouseApi.salesDelivery.confirm(record.id!.toString());
          }
          messageApi.success('出库确认成功，库存已更新');
          actionRef.current?.reload();
        } catch (error) {
          messageApi.error('出库确认失败');
        }
      },
    });
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<OutboundOrder>[] = [
    {
      title: '出库单号',
      dataIndex: ['delivery_code', 'picking_code'],
      width: 140,
      ellipsis: true,
      fixed: 'left',
      render: (_, record) => record.delivery_code || record.picking_code,
    },
    {
      title: '出库类型',
      dataIndex: 'outbound_type',
      width: 100,
      valueEnum: {
        production_picking: { text: '生产领料', status: 'processing' },
        sales_delivery: { text: '销售出库', status: 'success' },
      },
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle',
      width: 100,
      valueEnum: {
        '草稿': { text: '草稿', status: 'default' },
        '已确认': { text: '已确认', status: 'processing' },
        '已完成': { text: '已完成', status: 'success' },
        '已取消': { text: '已取消', status: 'error' },
      },
      render: (_, record) => {
        const lifecycle = getOutboundLifecycle(record);
        const stageName = lifecycle.stageName ?? record.status ?? '草稿';
        const colorMap: Record<string, string> = {
          草稿: 'default',
          已确认: 'processing',
          已完成: 'success',
          已取消: 'error',
        };
        return <Tag color={colorMap[stageName] ?? 'default'}>{stageName}</Tag>;
      },
    },
    {
      title: '客户',
      dataIndex: 'customer_name',
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
      title: '出库数量',
      dataIndex: 'total_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '出库品种',
      dataIndex: 'total_items',
      width: 100,
      align: 'right',
    },
    {
      title: '出库仓库',
      dataIndex: 'warehouse_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: '操作员',
      dataIndex: 'delivered_by',
      width: 100,
      ellipsis: true,
    },
    {
      title: '出库日期',
      dataIndex: 'delivery_date',
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
      messageApi.success('出库单创建成功');
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
        headerTitle="出库管理"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch={true}
        request={async (params) => {
          try {
            // 并行获取生产领料单和销售出库单
            const [productionPickings, salesDeliveries] = await Promise.all([
              warehouseApi.productionPicking.list({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                ...params,
              }),
              warehouseApi.salesDelivery.list({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                ...params,
              }),
            ]);

            // 合并并转换数据格式
            const pickingData = productionPickings.data?.map(item => ({
              ...item,
              outbound_type: 'production_picking' as const,
            })) || [];

            const deliveryData = salesDeliveries.data?.map(item => ({
              ...item,
              outbound_type: 'sales_delivery' as const,
            })) || [];

            // 合并两个数据源
            const combinedData = [...pickingData, ...deliveryData];

            // 按创建时间排序
            combinedData.sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());

            return {
              data: combinedData,
              success: true,
              total: (productionPickings.total || 0) + (salesDeliveries.total || 0),
            };
          } catch (error) {
            messageApi.error('获取出库单列表失败');
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
            新建出库单
          </Button>,
        ]}
      />

      <FormModalTemplate
        title="新建出库单"
        open={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onFinish={handleFormFinish}
        isEdit={false}
        initialValues={{ type: 'production' }}
        width={MODAL_CONFIG.SMALL_WIDTH}
        formRef={formRef}
      >
        <ProFormSelect
          name="type"
          label="出库类型"
          placeholder="请选择出库类型"
          rules={[{ required: true, message: '请选择出库类型' }]}
          options={[
            { label: '生产领料', value: 'production' },
            { label: '销售出库', value: 'sales' },
            { label: '退货出库', value: 'return' },
          ]}
          fieldProps={{
            onChange: (value: string) => setOutboundType(value),
          }}
        />
        {/* 根据出库类型显示不同的编码字段 */}
        {outboundType === 'production' && (
          <CodeField
            pageCode="kuaizhizao-warehouse-inbound"
            name="picking_code"
            label="生产领料单编码"
            required={true}
            autoGenerateOnCreate={true}
            context={{}}
          />
        )}
        {outboundType === 'sales' && (
          <CodeField
            pageCode="kuaizhizao-sales-delivery"
            name="delivery_code"
            label="销售出库单编码"
            required={true}
            autoGenerateOnCreate={true}
            context={{}}
          />
        )}
        <ProFormSelect
          name="warehouse"
          label="出库仓库"
          placeholder="请选择出库仓库"
          rules={[{ required: true, message: '请选择出库仓库' }]}
          options={[
            { label: '原材料仓库', value: 'raw-materials' },
            { label: '半成品仓库', value: 'semi-finished' },
            { label: '成品仓库', value: 'finished-goods' },
          ]}
        />
        <ProFormText
          name="customer"
          label="客户"
          placeholder="选择客户"
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
        <ProFormTextArea
          name="serial_numbers"
          label="序列号"
          placeholder="请输入序列号，多个序列号用逗号分隔（序列号管理物料必填）"
          tooltip="如果所选物料启用了序列号管理，此字段为必填"
          fieldProps={{ rows: 2 }}
        />
      </FormModalTemplate>

      <DetailDrawerTemplate
        title={`出库单详情 - ${currentOrder?.delivery_code || currentOrder?.picking_code || ''}`}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        customContent={
          currentOrder ? (
            <div style={{ padding: '16px 0' }}>
              <Card title="基本信息" style={{ marginBottom: 16 }}>
                <p><strong>出库单号：</strong>{currentOrder.delivery_code || currentOrder.picking_code}</p>
                <p><strong>出库类型：</strong>
                  <Tag color={
                    currentOrder.outbound_type === 'production_picking' ? 'processing' : 'success'
                  }>
                    {currentOrder.outbound_type === 'production_picking' ? '生产领料' : '销售出库'}
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
                {currentOrder.customer_name && (
                  <p><strong>客户：</strong>{currentOrder.customer_name}</p>
                )}
                {currentOrder.work_order_code && (
                  <p><strong>工单号：</strong>{currentOrder.work_order_code}</p>
                )}
                <p><strong>出库仓库：</strong>{currentOrder.warehouse_name}</p>
                <p><strong>出库日期：</strong>{currentOrder.delivery_date}</p>
                <p><strong>操作员：</strong>{currentOrder.delivered_by}</p>
                <p><strong>总数量：</strong>{currentOrder.total_quantity}</p>
                <p><strong>总品种：</strong>{currentOrder.total_items}</p>
                {currentOrder.notes && (
                  <p><strong>备注：</strong>{currentOrder.notes}</p>
                )}
              </Card>

              {/* 出库单明细 */}
              {currentOrder.items && currentOrder.items.length > 0 && (
                <Card title="出库明细">
                  {currentOrder.items.map((item) => (
                    <div key={item.id} style={{
                      padding: '12px',
                      marginBottom: '8px',
                      border: `1px solid ${token.colorBorder}`,
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

export default OutboundPage;
