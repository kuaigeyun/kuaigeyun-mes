/**
 * 发货通知单管理页面
 *
 * 销售通知仓库发货，不直接动库存。来源为销售订单。
 *
 * @author RiverEdge Team
 * @date 2026-02-22
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Table, Form, Select, InputNumber, Input, DatePicker } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, SendOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, DetailDrawerTemplate, FormModalTemplate, DRAWER_CONFIG, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { shipmentNoticeApi } from '../../../services/shipment-notice';
import { customerApi } from '../../../../master-data/services/supply-chain';
import { materialApi } from '../../../../master-data/services/material';
import { listSalesOrders, getSalesOrder } from '../../../services/sales-order';

interface ShipmentNotice {
  id?: number;
  notice_code?: string;
  sales_order_id?: number;
  sales_order_code?: string;
  customer_id?: number;
  customer_name?: string;
  customer_contact?: string;
  customer_phone?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  planned_ship_date?: string;
  shipping_address?: string;
  status?: string;
  notified_at?: string;
  sales_delivery_id?: number;
  sales_delivery_code?: string;
  total_quantity?: number;
  total_amount?: number;
  notes?: string;
  created_at?: string;
}

interface ShipmentNoticeDetail extends ShipmentNotice {
  items?: { id?: number; material_code: string; material_name: string; material_unit: string; notice_quantity: number; unit_price?: number; total_amount?: number }[];
}

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  待发货: { text: '待发货', color: 'default' },
  已通知: { text: '已通知', color: 'processing' },
  已出库: { text: '已出库', color: 'success' },
};

const ShipmentNoticesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [noticeDetail, setNoticeDetail] = useState<ShipmentNoticeDetail | null>(null);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const formRef = useRef<any>(null);
  const [customerList, setCustomerList] = useState<any[]>([]);
  const [materialList, setMaterialList] = useState<any[]>([]);
  const [salesOrderList, setSalesOrderList] = useState<any[]>([]);
  const [formItems, setFormItems] = useState<Array<{ material_id: number; material_code: string; material_name: string; material_unit: string; notice_quantity: number; unit_price: number }>>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [cust, mat, ordersRes] = await Promise.all([
          customerApi.list({ limit: 1000, isActive: true }),
          materialApi.list({ limit: 2000, isActive: true }),
          listSalesOrders({ limit: 500 }).catch(() => ({ data: [], total: 0, success: false })),
        ]);
        setCustomerList(Array.isArray(cust) ? cust : cust?.items || []);
        setMaterialList(Array.isArray(mat) ? mat : mat?.items || []);
        setSalesOrderList(ordersRes?.data || []);
      } catch (e) {
        console.error('加载客户/物料/销售订单失败', e);
      }
    };
    load();
  }, []);

  const columns: ProColumns<ShipmentNotice>[] = [
    { title: '通知单号', dataIndex: 'notice_code', width: 140, ellipsis: true, fixed: 'left' },
    { title: '销售订单号', dataIndex: 'sales_order_code', width: 140, ellipsis: true },
    { title: '客户', dataIndex: 'customer_name', width: 140, ellipsis: true },
    { title: '出库仓库', dataIndex: 'warehouse_name', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: any) => {
        const c = STATUS_MAP[(status as string) || ''] || { text: (status as string) || '-', color: 'default' };
        return <Tag color={c.color}>{c.text}</Tag>;
      },
    },
    { title: '计划发货日期', dataIndex: 'planned_ship_date', valueType: 'date', width: 120 },
    { title: '通知时间', dataIndex: 'notified_at', valueType: 'dateTime', width: 160 },
    { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime', width: 160 },
    {
      title: '操作',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>详情</Button>
          {record.status === '待发货' && (
            <>
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
              <Button type="link" size="small" icon={<SendOutlined />} onClick={() => handleNotify(record)} style={{ color: '#1890ff' }}>通知仓库</Button>
              <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>删除</Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  const handleDetail = async (record: ShipmentNotice) => {
    try {
      const detail = await shipmentNoticeApi.get(record.id!.toString());
      setNoticeDetail(detail as ShipmentNoticeDetail);
      setDetailDrawerVisible(true);
    } catch {
      messageApi.error('获取发货通知单详情失败');
    }
  };

  const handleEdit = async (record: ShipmentNotice) => {
    try {
      const detail = await shipmentNoticeApi.get(record.id!.toString()) as ShipmentNoticeDetail;
      setFormItems((detail.items || []).map((it: any) => ({
        material_id: it.material_id,
        material_code: it.material_code || '',
        material_name: it.material_name || '',
        material_unit: it.material_unit || '',
        notice_quantity: Number(it.notice_quantity) || 0,
        unit_price: Number(it.unit_price) || 0,
      })));
      formRef.current?.setFieldsValue({
        sales_order_id: detail.sales_order_id,
        sales_order_code: detail.sales_order_code,
        customer_id: detail.customer_id,
        customer_name: detail.customer_name,
        customer_contact: detail.customer_contact,
        customer_phone: detail.customer_phone,
        warehouse_name: detail.warehouse_name,
        planned_ship_date: detail.planned_ship_date ? dayjs(detail.planned_ship_date) : undefined,
        shipping_address: detail.shipping_address,
        notes: detail.notes,
      });
      setEditingId(record.id!);
      setEditModalVisible(true);
    } catch {
      messageApi.error('获取详情失败');
    }
  };

  const handleNotify = (record: ShipmentNotice) => {
    Modal.confirm({
      title: '通知仓库',
      content: `确定要通知仓库发货 "${record.notice_code}" 吗？`,
      onOk: async () => {
        try {
          await shipmentNoticeApi.notify(record.id!.toString());
          messageApi.success('已通知仓库');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '通知失败');
        }
      },
    });
  };

  const handleDelete = (record: ShipmentNotice) => {
    Modal.confirm({
      title: '删除发货通知单',
      content: `确定要删除 "${record.notice_code}" 吗？`,
      onOk: async () => {
        try {
          await shipmentNoticeApi.delete(record.id!.toString());
          messageApi.success('删除成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '删除失败');
        }
      },
    });
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) return;
    Modal.confirm({
      title: '批量删除',
      content: `确定要删除选中的 ${keys.length} 条发货通知单吗？`,
      onOk: async () => {
        try {
          for (const k of keys) {
            await shipmentNoticeApi.delete(String(k));
          }
          messageApi.success(`已删除 ${keys.length} 条发货通知单`);
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error?.message || '批量删除失败');
        }
      },
    });
  };

  const handleCreate = () => {
    setFormItems([]);
    formRef.current?.resetFields();
    setEditingId(null);
    setCreateModalVisible(true);
  };

  const onSalesOrderSelect = async (orderId: number) => {
    let order = salesOrderList.find((o: any) => (o.id ?? o.sales_order_id) === orderId);
    if (!order) return;
    try {
      const detail = await getSalesOrder(orderId, true);
      order = detail;
    } catch {
      // use list data
    }
    const code = order.order_code || order.sales_order_code || order.code;
    const custId = order.customer_id ?? order.customerId;
    formRef.current?.setFieldsValue({
      sales_order_code: code,
      customer_id: custId,
      customer_name: custName,
      customer_contact: order.customer_contact,
      customer_phone: order.customer_phone,
    });
    if (order.items && order.items.length > 0) {
      setFormItems(order.items.map((it: any) => ({
        material_id: it.material_id ?? it.materialId,
        material_code: it.material_code || it.materialCode || '',
        material_name: it.material_name || it.materialName || '',
        material_unit: it.material_unit || it.materialUnit || '',
        notice_quantity: Number(it.required_quantity ?? it.quantity ?? it.order_quantity) || 0,
        unit_price: Number(it.unit_price ?? it.unitPrice) || 0,
      })));
    }
  };

  const handleCreateSubmit = async (values: any) => {
    const validItems = formItems.filter((it) => it.material_id && it.notice_quantity > 0);
    if (!validItems.length) {
      messageApi.error('请至少添加一条有效明细');
      throw new Error('请至少添加一条有效明细');
    }
    if (!values.sales_order_id || !values.sales_order_code) {
      messageApi.error('请选择销售订单');
      throw new Error('请选择销售订单');
    }
    const cust = customerList.find((c: any) => (c.id ?? c.customer_id) === values.customer_id) || { name: values.customer_name };
    try {
      await shipmentNoticeApi.create({
        sales_order_id: values.sales_order_id,
        sales_order_code: values.sales_order_code,
        customer_id: values.customer_id,
        customer_name: cust.name || cust.customer_name || values.customer_name,
        customer_contact: values.customer_contact,
        customer_phone: values.customer_phone,
        warehouse_id: values.warehouse_id,
        warehouse_name: values.warehouse_name,
        planned_ship_date: values.planned_ship_date ? dayjs(values.planned_ship_date).format('YYYY-MM-DD') : undefined,
        shipping_address: values.shipping_address,
        notes: values.notes,
        items: validItems.map((it) => ({
          material_id: it.material_id,
          material_code: it.material_code,
          material_name: it.material_name,
          material_unit: it.material_unit,
          notice_quantity: it.notice_quantity,
          unit_price: it.unit_price || 0,
        })),
      });
      messageApi.success('创建成功');
      setCreateModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '创建失败');
      throw error;
    }
  };

  const handleEditSubmit = async (values: any) => {
    if (!editingId) return;
    const validItems = formItems.filter((it) => it.material_id && it.notice_quantity > 0);
    if (!validItems.length) {
      messageApi.error('请至少添加一条有效明细');
      throw new Error('请至少添加一条有效明细');
    }
    const cust = customerList.find((c: any) => (c.id ?? c.customer_id) === values.customer_id);
    try {
      await shipmentNoticeApi.update(editingId.toString(), {
        customer_id: values.customer_id,
        customer_name: cust?.name || cust?.customer_name || values.customer_name,
        customer_contact: values.customer_contact,
        customer_phone: values.customer_phone,
        warehouse_id: values.warehouse_id,
        warehouse_name: values.warehouse_name,
        planned_ship_date: values.planned_ship_date ? dayjs(values.planned_ship_date).format('YYYY-MM-DD') : undefined,
        shipping_address: values.shipping_address,
        notes: values.notes,
      });
      messageApi.success('更新成功');
      setEditModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '更新失败');
      throw error;
    }
  };

  const addItem = () => {
    setFormItems((prev) => [...prev, { material_id: 0, material_code: '', material_name: '', material_unit: '', notice_quantity: 1, unit_price: 0 }]);
  };

  const onMaterialSelect = (idx: number, materialId: number) => {
    const m = materialList.find((x: any) => (x.id || x.material_id) === materialId);
    if (!m) return;
    const updated = [...formItems];
    updated[idx] = {
      ...updated[idx],
      material_id: m.id || m.material_id,
      material_code: m.mainCode || m.code || m.material_code || '',
      material_name: m.name || m.material_name || '',
      material_unit: m.baseUnit || m.material_unit || m.unit || '',
    };
    setFormItems(updated);
  };

  const detailColumns: ProDescriptionsItemProps<ShipmentNoticeDetail>[] = [
    { title: '通知单号', dataIndex: 'notice_code' },
    { title: '销售订单号', dataIndex: 'sales_order_code' },
    { title: '客户', dataIndex: 'customer_name' },
    { title: '联系人', dataIndex: 'customer_contact' },
    { title: '电话', dataIndex: 'customer_phone' },
    { title: '出库仓库', dataIndex: 'warehouse_name' },
    { title: '计划发货日期', dataIndex: 'planned_ship_date', valueType: 'date' },
    { title: '收货地址', dataIndex: 'shipping_address', span: 2 },
    {
      title: '状态',
      dataIndex: 'status',
      render: (s) => {
        const c = STATUS_MAP[(s as string) || ''] || { text: (s as string) || '-', color: 'default' };
        return <Tag color={c.color}>{c.text}</Tag>;
      },
    },
    { title: '通知时间', dataIndex: 'notified_at', valueType: 'dateTime' },
    { title: '备注', dataIndex: 'notes', span: 2 },
  ];

  const renderForm = (onFinish: (values: any) => Promise<void>) => (
    <>
      <Form.Item name="sales_order_id" label="销售订单" rules={[{ required: true }]}>
        <Select
          placeholder="请选择销售订单"
          options={salesOrderList.map((o: any) => ({
            value: o.id ?? o.sales_order_id,
            label: `${o.order_code || o.sales_order_code || o.code || ''} - ${o.customer_name || o.customerName || ''}`,
          }))}
          onChange={onSalesOrderSelect}
        />
      </Form.Item>
      <Form.Item name="sales_order_code" label="销售订单号" hidden>
        <Input />
      </Form.Item>
      <Form.Item name="customer_id" label="客户" rules={[{ required: true }]}>
        <Select
          placeholder="请选择客户"
          options={customerList.map((c: any) => ({ value: c.id ?? c.customer_id, label: c.name || c.customer_name || c.code }))}
          onChange={(v) => {
            const cust = customerList.find((x: any) => (x.id ?? x.customer_id) === v);
            if (cust) formRef.current?.setFieldsValue({ customer_name: cust.name || cust.customer_name, customer_contact: cust.contact, customer_phone: cust.phone });
          }}
        />
      </Form.Item>
      <Form.Item name="customer_contact" label="联系人">
        <Input placeholder="联系人" />
      </Form.Item>
      <Form.Item name="customer_phone" label="电话">
        <Input placeholder="电话" />
      </Form.Item>
      <Form.Item name="warehouse_name" label="出库仓库">
        <Input placeholder="出库仓库名称" />
      </Form.Item>
      <Form.Item name="planned_ship_date" label="计划发货日期">
        <DatePicker style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name="shipping_address" label="收货地址">
        <Input.TextArea rows={2} placeholder="收货地址" />
      </Form.Item>
      <Form.Item label="明细">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button type="dashed" onClick={addItem} icon={<PlusOutlined />}>添加明细</Button>
          {formItems.map((it, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Select
                placeholder="物料"
                style={{ width: 200 }}
                options={materialList.map((m: any) => ({ value: m.id ?? m.material_id, label: `${m.mainCode || m.code || ''} ${m.name || ''}` }))}
                onChange={(v) => onMaterialSelect(idx, v)}
              />
              <InputNumber placeholder="数量" min={0.01} value={it.notice_quantity} onChange={(v) => {
                const u = [...formItems]; u[idx] = { ...u[idx], notice_quantity: v ?? 0 }; setFormItems(u);
              }} />
              <InputNumber placeholder="单价" min={0} value={it.unit_price} onChange={(v) => {
                const u = [...formItems]; u[idx] = { ...u[idx], unit_price: v ?? 0 }; setFormItems(u);
              }} />
              <Button type="link" danger size="small" onClick={() => setFormItems(formItems.filter((_, i) => i !== idx))}>删除</Button>
            </div>
          ))}
        </Space>
      </Form.Item>
      <Form.Item name="notes" label="备注">
        <Input.TextArea rows={2} />
      </Form.Item>
    </>
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable
          headerTitle="发货通知单"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          showCreateButton
          createButtonText="新建发货通知单"
          onCreate={handleCreate}
          enableRowSelection
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton
          onDelete={handleBatchDelete}
          request={async (params) => {
            try {
              const response = await shipmentNoticeApi.list({
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                status: params.status,
                customer_id: params.customer_id,
                sales_order_id: params.sales_order_id,
              });
              const data = Array.isArray(response) ? response : response?.items || response?.data || [];
              const total = Array.isArray(response) ? response.length : response?.total ?? data.length;
              return { data, success: true, total };
            } catch {
              messageApi.error('获取列表失败');
              return { data: [], success: false, total: 0 };
            }
          }}
          scroll={{ x: 1200 }}
        />
      </ListPageTemplate>

      <DetailDrawerTemplate
        title={`发货通知单详情${noticeDetail?.notice_code ? ` - ${noticeDetail.notice_code}` : ''}`}
        open={detailDrawerVisible}
        onClose={() => { setDetailDrawerVisible(false); setNoticeDetail(null); }}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        columns={detailColumns}
        dataSource={noticeDetail || {}}
      >
        {noticeDetail?.items && noticeDetail.items.length > 0 && (
          <Table
            size="small"
            rowKey={(_, idx) => (noticeDetail?.items?.[idx] as any)?.id ?? idx}
            columns={[
              { title: '物料编码', dataIndex: 'material_code', width: 120 },
              { title: '物料名称', dataIndex: 'material_name', width: 150 },
              { title: '单位', dataIndex: 'material_unit', width: 60 },
              { title: '数量', dataIndex: 'notice_quantity', width: 90, align: 'right' },
              { title: '单价', dataIndex: 'unit_price', width: 90, align: 'right' },
              { title: '金额', dataIndex: 'total_amount', width: 100, align: 'right' },
            ]}
            dataSource={noticeDetail.items}
            pagination={false}
          />
        )}
      </DetailDrawerTemplate>

      <FormModalTemplate
        title="新建发货通知单"
        open={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        formRef={formRef}
        onFinish={handleCreateSubmit}
        width={MODAL_CONFIG.LARGE_WIDTH}
      >
        {renderForm(handleCreateSubmit)}
      </FormModalTemplate>

      <FormModalTemplate
        title="编辑发货通知单"
        open={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        formRef={formRef}
        onFinish={handleEditSubmit}
        width={MODAL_CONFIG.LARGE_WIDTH}
      >
        {renderForm(handleEditSubmit)}
      </FormModalTemplate>
    </>
  );
};

export default ShipmentNoticesPage;
