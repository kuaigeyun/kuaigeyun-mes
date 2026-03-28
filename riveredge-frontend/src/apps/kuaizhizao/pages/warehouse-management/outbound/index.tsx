/**
 * 出库管理页面
 *
 * 提供出库单的管理功能，支持多种出库类型：生产领料、销售出库、退货出库等。
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, message, Card, Table, Row, Col, Form, Tooltip } from 'antd';
import { PlusOutlined, EyeOutlined, CheckCircleOutlined, InboxOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, DetailDrawerSection, MODAL_CONFIG, DRAWER_CONFIG, WAREHOUSE_DETAIL_TABLE_STYLES } from '../../../../../components/layout-templates';
import DocumentTrackingPanel from '../../../../../components/document-tracking-panel';
import CodeField from '../../../../../components/code-field';
import { warehouseApi, workOrderApi } from '../../../services/production';
import { getOutboundLifecycle } from '../../../utils/outboundLifecycle';
import { listSalesOrders } from '../../../services/sales-order';
import { warehouseApi as masterWarehouseApi } from '../../../../master-data/services/warehouse';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';

// 统一的出库单接口（结合生产领料和销售出库）
interface OutboundOrder {
  id?: number;
  tenant_id?: number;
  delivery_code?: string; // 销售出库单编号
  picking_code?: string; // 生产领料单编号
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

const OutboundPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  // Modal 相关状态（创建出库单）
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const formRef = useRef<any>(null);
  const [outboundType, setOutboundType] = useState<string>('production');

  // Drawer 相关状态（详情查看）
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<OutboundOrder | null>(null);

  // 批量出库 Modal
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [batchForm] = Form.useForm();
  const [batchOutboundType, setBatchOutboundType] = useState<'production_picking' | 'sales_delivery'>('production_picking');
  const [workOrderOptions, setWorkOrderOptions] = useState<{ label: string; value: number }[]>([]);
  const [salesOrderOptions, setSalesOrderOptions] = useState<{ label: string; value: number }[]>([]);
  const [warehouseOptions, setWarehouseOptions] = useState<{ label: string; value: number; name: string }[]>([]);
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [executionConfig, setExecutionConfig] = useState<any>(null);

  useEffect(() => {
    const loadExecutionConfig = async () => {
      try {
        const cfg = await workOrderApi.getExecutionConfig();
        setExecutionConfig(cfg);
      } catch {
        setExecutionConfig(null);
      }
    };
    loadExecutionConfig();
  }, []);

  /** 批量出库：加载工单、销售订单、仓库 */
  useEffect(() => {
    if (!batchModalVisible) return;
    const load = async () => {
      try {
        const [woRes, soRes, whRes] = await Promise.all([
          workOrderApi.list({ skip: 0, limit: 500 }),
          listSalesOrders({ skip: 0, limit: 500 }),
          masterWarehouseApi.list({ isActive: true }),
        ]);
        const woList = Array.isArray(woRes) ? woRes : (woRes as any)?.data ?? (woRes as any)?.items ?? [];
        const eligibleWo = woList.filter(
          (wo: any) => ['已下达', '进行中', 'released', 'in_progress'].includes(wo.status)
        );
        setWorkOrderOptions(
          eligibleWo.map((wo: any) => ({
            label: `${wo.code || wo.id} - ${wo.product_name || wo.name || '-'}`,
            value: wo.id,
          }))
        );
        const soData = (soRes as any)?.data ?? (soRes as any)?.items ?? soRes ?? [];
        const soList = Array.isArray(soData) ? soData : [];
        const eligibleSo = soList.filter(
          (so: any) => ['已审核', '已确认', 'AUDITED', 'CONFIRMED'].includes(so.status)
        );
        setSalesOrderOptions(
          eligibleSo.map((so: any) => ({
            label: `${so.order_code || so.code || so.id} - ${so.customer_name || '-'}`,
            value: so.id,
          }))
        );
        const whList = Array.isArray(whRes) ? whRes : (whRes as any)?.data ?? (whRes as any)?.items ?? whRes ?? [];
        setWarehouseOptions(
          (Array.isArray(whList) ? whList : []).map((w: any) => ({
            label: `${w.code || ''} ${w.name || ''}`.trim() || String(w.id),
            value: w.id,
            name: w.name || '',
          }))
        );
      } catch {
        setWorkOrderOptions([]);
        setSalesOrderOptions([]);
        setWarehouseOptions([]);
      }
    };
    load();
  }, [batchModalVisible]);

  /** 批量出库提交 */
  const handleBatchOutboundSubmit = async () => {
    try {
      const values = await batchForm.validateFields();
      const type = values.batch_outbound_type || batchOutboundType;
      setBatchSubmitting(true);

      if (type === 'sales_delivery') {
        const orderIds = values.sales_order_ids as number[];
        const warehouseId = values.warehouse_id as number;
        const wh = warehouseOptions.find((w) => w.value === warehouseId);
        if (!orderIds?.length) {
          messageApi.warning('请选择至少一个销售订单');
          return;
        }
        if (!warehouseId) {
          messageApi.warning('请选择出库仓库');
          return;
        }
        let success = 0;
        for (const id of orderIds) {
          try {
            await warehouseApi.salesDelivery.pullFromSalesOrder({
              sales_order_id: id,
              warehouse_id: warehouseId,
              warehouse_name: wh?.name,
            });
            success++;
          } catch (e: any) {
            messageApi.warning(`销售订单 ${id} 上拉失败：${e?.message || e?.response?.data?.detail || '未知错误'}`);
          }
        }
        messageApi.success(`批量销售出库成功，共创建 ${success} 张销售出库单`);
      } else {
        const workOrderIds = values.work_order_ids as number[];
        const warehouseId = values.warehouse_id as number;
        const wh = warehouseOptions.find((w) => w.value === warehouseId);
        if (!workOrderIds?.length) {
          messageApi.warning('请选择至少一个工单');
          return;
        }
        if (!warehouseId) {
          messageApi.warning('请选择出库仓库');
          return;
        }
        const result = await warehouseApi.productionPicking.batchPick({
          work_order_ids: workOrderIds,
          warehouse_id: warehouseId,
          warehouse_name: wh?.name,
        });
        const list = Array.isArray(result) ? result : (result as any)?.data ?? (result as any)?.items ?? [];
        messageApi.success(`批量生产领料成功，共创建 ${list.length} 张领料单`);
      }
      setBatchModalVisible(false);
      batchForm.resetFields();
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || e?.response?.data?.detail || '批量出库失败');
    } finally {
      setBatchSubmitting(false);
    }
  };

  const handleCreate = () => {
    setOutboundType('production');
    setCreateModalVisible(true);
  };

  useNewShortcut(handleCreate);

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
      setCurrentOrder(detailData ? { ...detailData, outbound_type: record.outbound_type } : undefined);
      setDetailDrawerVisible(true);
    } catch (error) {
      messageApi.error('获取出库单详情失败');
    }
  };

  /**
   * 处理确认出库
   */
  const handleConfirm = async (record: OutboundOrder) => {
    if (
      record.outbound_type === 'production_picking' &&
      executionConfig &&
      executionConfig.current_user_can_confirm_picking === false
    ) {
      messageApi.warning('当前业务配置下，您无权限确认生产领料');
      return;
    }
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
          if (currentOrder?.id === record.id) {
            try {
              let detailData: any;
              if (record.outbound_type === 'production_picking') {
                detailData = await warehouseApi.productionPicking.get(record.id!.toString());
              } else if (record.outbound_type === 'sales_delivery') {
                detailData = await warehouseApi.salesDelivery.get(record.id!.toString());
              }
              if (detailData) {
                setCurrentOrder({ ...detailData, outbound_type: record.outbound_type });
              }
            } catch { /* ignore */ }
          }
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
          待领料: 'processing',
          待出库: 'processing',
          已确认: 'processing',
          已领料: 'success',
          已出库: 'success',
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
          {(record.status === 'draft' || record.status === '草稿' || record.status === '待领料' || record.status === '待出库') && (
            <Tooltip
              title={
                record.outbound_type === 'production_picking' &&
                executionConfig &&
                executionConfig.current_user_can_confirm_picking === false
                  ? '当前业务配置下，您无权限确认生产领料'
                  : undefined
              }
            >
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => handleConfirm(record)}
                style={{ color: '#52c41a' }}
                disabled={
                  record.outbound_type === 'production_picking' &&
                  executionConfig &&
                  executionConfig.current_user_can_confirm_picking === false
                }
              >
                确认出库
              </Button>
            </Tooltip>
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
        rowKey={(record) => `${record.outbound_type}::${record.id}`}
        columns={columns}
        showAdvancedSearch={true}
        request={async (params) => {
          try {
            // 并行获取生产领料单和销售出库单
            const [pickingRes, deliveryRes] = await Promise.all([
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

            // 后端可能直接返回数组，或 { data/items: [] } 格式
            const toList = (r: any) => (Array.isArray(r) ? r : r?.data ?? r?.items ?? []);
            const pickingData = toList(pickingRes).map((item: any) => ({
              ...item,
              outbound_type: 'production_picking' as const,
            }));
            const deliveryData = toList(deliveryRes).map((item: any) => ({
              ...item,
              outbound_type: 'sales_delivery' as const,
            }));

            // 合并两个数据源
            const combinedData = [...pickingData, ...deliveryData];

            // 按创建时间排序
            combinedData.sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());

            const total =
              (typeof pickingRes?.total === 'number' ? pickingRes.total : pickingData.length) +
              (typeof deliveryRes?.total === 'number' ? deliveryRes.total : deliveryData.length);

            return {
              data: combinedData,
              success: true,
              total,
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
        enableRowSelection={true}
        showDeleteButton={true}
        onDelete={async (keys) => {
          Modal.confirm({
            title: '确认批量删除',
            content: `确定要删除选中的 ${keys.length} 条出库单吗？`,
            onOk: async () => {
              try {
                for (const key of keys) {
                  const [type, id] = String(key).split('::');
                  if (type === 'production_picking') {
                    await warehouseApi.productionPicking.delete(id);
                  } else if (type === 'sales_delivery') {
                    await warehouseApi.salesDelivery.delete(id);
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
            {'新建出库单' + NEW_SHORTCUT_HINT}
          </Button>,
          <Button
            key="batch"
            icon={<InboxOutlined />}
            onClick={() => {
              batchForm.resetFields();
              setBatchOutboundType('production_picking');
              setBatchModalVisible(true);
            }}
          >
            批量出库
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
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
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
          </Col>
          <Col span={12}>
            {outboundType === 'production' && (
              <CodeField
                pageCode="kuaizhizao-warehouse-inbound"
                name="picking_code"
                label="生产领料单编号"
                required={true}
                autoGenerateOnCreate={true}
                context={{}}
              />
            )}
            {outboundType === 'sales' && (
              <CodeField
                pageCode="kuaizhizao-sales-delivery"
                name="delivery_code"
                label="销售出库单编号"
                required={true}
                autoGenerateOnCreate={true}
                context={{}}
              />
            )}
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
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
          </Col>
          <Col span={12}>
            <ProFormText name="customer" label="客户" placeholder="选择客户" />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormText name="workOrder" label="关联工单" placeholder="选择工单" />
          </Col>
          <Col span={12}>
            <ProFormText
              name="batch_number"
              label="批号"
              placeholder="请输入批号（批号管理物料必填）"
              tooltip="如果所选物料启用了批号管理，此字段为必填"
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormTextArea
              name="serial_numbers"
              label="序列号"
              placeholder="请输入序列号，多个序列号用逗号分隔（序列号管理物料必填）"
              tooltip="如果所选物料启用了序列号管理，此字段为必填"
              fieldProps={{ rows: 2 }}
            />
          </Col>
          <Col span={12} />
        </Row>
      </FormModalTemplate>

      <Modal
        title="批量出库"
        open={batchModalVisible}
        onCancel={() => setBatchModalVisible(false)}
        onOk={handleBatchOutboundSubmit}
        confirmLoading={batchSubmitting}
        width={520}
        okText="确认出库"
      >
        <p style={{ marginBottom: 16, color: '#666' }}>
          根据上游单据批量创建出库单。生产领料：从工单下推；销售出库：从销售订单上拉。
        </p>
        <Form form={batchForm} layout="vertical" initialValues={{ batch_outbound_type: 'production_picking' }}>
          <Form.Item
            name="batch_outbound_type"
            label="出库类型"
            rules={[{ required: true }]}
          >
            <ProFormSelect
              options={[
                { label: '生产领料（从工单）', value: 'production_picking' },
                { label: '销售出库（从销售订单）', value: 'sales_delivery' },
              ]}
              fieldProps={{
                onChange: (v: string) => setBatchOutboundType(v as 'production_picking' | 'sales_delivery'),
              }}
            />
          </Form.Item>
          {batchOutboundType === 'production_picking' && (
            <>
              <Form.Item
                name="work_order_ids"
                label="选择工单"
                rules={[{ required: true, message: '请选择至少一个工单' }]}
              >
                <ProFormSelect
                  mode="multiple"
                  placeholder="请选择工单（已下达/进行中）"
                  options={workOrderOptions}
                  fieldProps={{ showSearch: true, filterOption: (input, opt) => (opt?.label ?? '').toString().toLowerCase().includes(input.toLowerCase()) }}
                />
              </Form.Item>
              <Form.Item
                name="warehouse_id"
                label="出库仓库"
                rules={[{ required: true, message: '请选择出库仓库' }]}
              >
                <ProFormSelect
                  placeholder="请选择仓库"
                  options={warehouseOptions}
                  fieldProps={{ showSearch: true, filterOption: (input, opt) => (opt?.label ?? '').toString().toLowerCase().includes(input.toLowerCase()) }}
                />
              </Form.Item>
            </>
          )}
          {batchOutboundType === 'sales_delivery' && (
            <>
              <Form.Item
                name="sales_order_ids"
                label="选择销售订单"
                rules={[{ required: true, message: '请选择至少一个销售订单' }]}
              >
                <ProFormSelect
                  mode="multiple"
                  placeholder="请选择销售订单（已审核/已确认）"
                  options={salesOrderOptions}
                  fieldProps={{ showSearch: true, filterOption: (input, opt) => (opt?.label ?? '').toString().toLowerCase().includes(input.toLowerCase()) }}
                />
              </Form.Item>
              <Form.Item
                name="warehouse_id"
                label="出库仓库"
                rules={[{ required: true, message: '请选择出库仓库' }]}
              >
                <ProFormSelect
                  placeholder="请选择仓库"
                  options={warehouseOptions}
                  fieldProps={{ showSearch: true, filterOption: (input, opt) => (opt?.label ?? '').toString().toLowerCase().includes(input.toLowerCase()) }}
                />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      <DetailDrawerTemplate
        title={`出库单详情 - ${currentOrder?.delivery_code || currentOrder?.picking_code || ''}`}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        extra={
          currentOrder && ['draft', '草稿', '待领料', '待出库'].includes(currentOrder.status || '') && (
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={() => handleConfirm(currentOrder)}
              disabled={
                currentOrder.outbound_type === 'production_picking' &&
                executionConfig &&
                executionConfig.current_user_can_confirm_picking === false
              }
            >
              确认出库
            </Button>
          )
        }
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

              {/* 生命周期 */}
              <DetailDrawerSection title="生命周期">
                {(() => {
                  const lifecycle = getOutboundLifecycle(currentOrder);
                  const mainStages = lifecycle.mainStages ?? [];
                  if (mainStages.length === 0) return null;
                  return (
                    <UniLifecycleStepper
                      steps={mainStages}
                      status={lifecycle.status}
                      showLabels
                      nextStepSuggestions={lifecycle.nextStepSuggestions}
                    />
                  );
                })()}
              </DetailDrawerSection>

              {/* 出库单明细 */}
              {currentOrder.items && currentOrder.items.length > 0 && (
                <Card title="出库明细">
                  <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
                  <Table
                    className="warehouse-detail-table"
                    size="small"
                    rowKey={(_, idx) => (currentOrder?.items?.[idx] as any)?.id ?? idx}
                    pagination={false}
                    columns={
                      currentOrder.outbound_type === 'production_picking'
                        ? [
                            { title: '物料编号', dataIndex: 'material_code', width: 120 },
                            { title: '物料名称', dataIndex: 'material_name', width: 150 },
                            { title: '需求数量', dataIndex: 'required_quantity', width: 100, align: 'right' as const },
                            { title: '已领数量', dataIndex: 'picked_quantity', width: 100, align: 'right' as const },
                            { title: '单位', dataIndex: 'material_unit', width: 60 },
                            { title: '仓库', dataIndex: 'warehouse_name', width: 120 },
                            { title: '批次号', dataIndex: 'batch_number', width: 100 },
                          ]
                        : [
                            { title: '物料编号', dataIndex: 'material_code', width: 120 },
                            { title: '物料名称', dataIndex: 'material_name', width: 150 },
                            { title: '出库数量', dataIndex: 'delivery_quantity', width: 100, align: 'right' as const },
                            { title: '单位', dataIndex: 'material_unit', width: 60 },
                            { title: '备注', dataIndex: 'notes' },
                          ]
                    }
                    dataSource={currentOrder.items}
                  />
                </Card>
              )}

              {/* 操作记录 */}
              {currentOrder?.id && (
                <DetailDrawerSection title="操作记录">
                  <DocumentTrackingPanel
                    documentType={
                      currentOrder.outbound_type === 'production_picking'
                        ? 'production_picking'
                        : 'sales_delivery'
                    }
                    documentId={currentOrder.id}
                  />
                </DetailDrawerSection>
              )}
            </div>
          ) : null
        }
      />
    </ListPageTemplate>
  );
};

export default OutboundPage;
