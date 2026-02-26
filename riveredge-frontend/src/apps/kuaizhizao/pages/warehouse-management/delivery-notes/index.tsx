/**
 * 送货单管理页面
 *
 * 在销售出库前/后向客户发送发货通知，记录物流信息。
 * 归属仓储管理-出库组（与 manifest 一致）。
 *
 * @author RiverEdge Team
 * @date 2026-02-19
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Table, Form, Select, InputNumber, Input, DatePicker } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, SendOutlined, PrinterOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import SyncFromDatasetModal from '../../../../../components/sync-from-dataset-modal';
import { ListPageTemplate, DetailDrawerTemplate, FormModalTemplate, DRAWER_CONFIG, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { deliveryNoticeApi } from '../../../services/delivery-notice';
import { customerApi } from '../../../../master-data/services/supply-chain';
import { materialApi } from '../../../../master-data/services/material';

interface DeliveryNotice {
  id?: number;
  notice_code?: string;
  sales_delivery_id?: number;
  sales_delivery_code?: string;
  sales_order_id?: number;
  sales_order_code?: string;
  customer_id?: number;
  customer_name?: string;
  customer_contact?: string;
  customer_phone?: string;
  planned_delivery_date?: string;
  carrier?: string;
  tracking_number?: string;
  shipping_address?: string;
  status?: string;
  sent_at?: string;
  total_quantity?: number;
  total_amount?: number;
  notes?: string;
  created_at?: string;
}

interface DeliveryNoticeDetail extends DeliveryNotice {
  items?: { id?: number; material_code: string; material_name: string; material_unit: string; notice_quantity: number; unit_price?: number; total_amount?: number }[];
}

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  待发送: { text: '待发送', color: 'default' },
  已发送: { text: '已发送', color: 'processing' },
  已签收: { text: '已签收', color: 'success' },
};

const DeliveryNotesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [noticeDetail, setNoticeDetail] = useState<DeliveryNoticeDetail | null>(null);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const formRef = useRef<any>(null);
  const [customerList, setCustomerList] = useState<any[]>([]);
  const [materialList, setMaterialList] = useState<any[]>([]);
  const [formItems, setFormItems] = useState<Array<{ material_id: number; material_code: string; material_name: string; material_unit: string; notice_quantity: number; unit_price: number }>>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [cust, mat] = await Promise.all([
          customerApi.list({ limit: 1000, isActive: true }),
          materialApi.list({ limit: 2000, isActive: true }),
        ]);
        setCustomerList(Array.isArray(cust) ? cust : cust?.items || []);
        setMaterialList(Array.isArray(mat) ? mat : mat?.items || []);
      } catch (e) {
        console.error('加载客户/物料失败', e);
      }
    };
    load();
  }, []);

  const columns: ProColumns<DeliveryNotice>[] = [
    { title: '通知单号', dataIndex: 'notice_code', width: 140, ellipsis: true, fixed: 'left' },
    { title: '销售出库单号', dataIndex: 'sales_delivery_code', width: 140, ellipsis: true },
    { title: '客户', dataIndex: 'customer_name', width: 140, ellipsis: true },
    { title: '承运商', dataIndex: 'carrier', width: 100 },
    { title: '运单号', dataIndex: 'tracking_number', width: 120, ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: any) => {
        const c = STATUS_MAP[(status as string) || ''] || { text: (status as string) || '-', color: 'default' };
        return <Tag color={c.color}>{c.text}</Tag>;
      },
    },
    { title: '预计送达', dataIndex: 'planned_delivery_date', valueType: 'date', width: 110 },
    { title: '发送时间', dataIndex: 'sent_at', valueType: 'dateTime', width: 160 },
    { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime', width: 160 },
    {
      title: '操作',
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>详情</Button>
          {record.status === '待发送' && (
            <>
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
              <Button type="link" size="small" icon={<SendOutlined />} onClick={() => handleSend(record)} style={{ color: '#1890ff' }}>发送</Button>
              <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>删除</Button>
            </>
          )}
          <Button type="link" size="small" icon={<PrinterOutlined />} onClick={() => handlePrint(record)}>打印</Button>
        </Space>
      ),
    },
  ];

  const handleDetail = async (record: DeliveryNotice) => {
    try {
      const detail = await deliveryNoticeApi.get(record.id!.toString());
      setNoticeDetail(detail as DeliveryNoticeDetail);
      setDetailDrawerVisible(true);
    } catch {
      messageApi.error('获取送货单详情失败');
    }
  };

  const handleEdit = async (record: DeliveryNotice) => {
    try {
      const detail = await deliveryNoticeApi.get(record.id!.toString()) as DeliveryNoticeDetail;
      setFormItems((detail.items || []).map((it: any) => ({
        material_id: it.material_id,
        material_code: it.material_code || '',
        material_name: it.material_name || '',
        material_unit: it.material_unit || '',
        notice_quantity: Number(it.notice_quantity) || 0,
        unit_price: Number(it.unit_price) || 0,
      })));
      formRef.current?.setFieldsValue({
        sales_delivery_code: detail.sales_delivery_code,
        sales_order_code: detail.sales_order_code,
        customer_id: detail.customer_id,
        customer_name: detail.customer_name,
        customer_contact: detail.customer_contact,
        customer_phone: detail.customer_phone,
        planned_delivery_date: detail.planned_delivery_date ? dayjs(detail.planned_delivery_date) : undefined,
        carrier: detail.carrier,
        tracking_number: detail.tracking_number,
        shipping_address: detail.shipping_address,
        notes: detail.notes,
      });
      setEditingId(record.id!);
      setEditModalVisible(true);
    } catch {
      messageApi.error('获取详情失败');
    }
  };

  const handleSend = (record: DeliveryNotice) => {
    Modal.confirm({
      title: '发送通知',
      content: `确定要发送发货通知 "${record.notice_code}" 吗？`,
      onOk: async () => {
        try {
          await deliveryNoticeApi.send(record.id!.toString());
          messageApi.success('发送成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '发送失败');
        }
      },
    });
  };

  const handleDelete = (record: DeliveryNotice) => {
    Modal.confirm({
      title: '删除发货通知',
      content: `确定要删除 "${record.notice_code}" 吗？`,
      onOk: async () => {
        try {
          await deliveryNoticeApi.delete(record.id!.toString());
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
      content: `确定要删除选中的 ${keys.length} 条发货通知吗？`,
      onOk: async () => {
        try {
          for (const k of keys) {
            await deliveryNoticeApi.delete(String(k));
          }
          messageApi.success(`已删除 ${keys.length} 条发货通知`);
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error?.message || '批量删除失败');
        }
      },
    });
  };

  const handleSyncConfirm = async (rows: Record<string, any>[]) => {
    try {
      let successCount = 0;
      for (const row of rows) {
        const payload = {
          customer_id: row.customer_id ?? row.customerId,
          customer_name: row.customer_name || row.customerName,
          planned_delivery_date: row.planned_delivery_date || row.plannedDeliveryDate,
          status: row.status || '待发送',
          items: Array.isArray(row.items) ? row.items : [],
        };
        await deliveryNoticeApi.create(payload);
        successCount += 1;
      }
      messageApi.success(`已同步 ${successCount} 条发货通知`);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || '同步失败');
    }
  };

  const handlePrint = async (record: DeliveryNotice) => {
    try {
      const result = await deliveryNoticeApi.print(record.id!.toString()) as { success?: boolean; content?: string; message?: string };
      if (result?.success && result?.content) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(result.content);
          printWindow.document.close();
          printWindow.onload = () => printWindow.print();
        }
      } else {
        messageApi.warning(result?.message || '打印功能暂未配置模板');
      }
    } catch {
      messageApi.error('打印失败');
    }
  };

  const handleCreate = () => {
    setFormItems([]);
    formRef.current?.resetFields();
    setEditingId(null);
    setCreateModalVisible(true);
  };

  const handleCreateSubmit = async (values: any) => {
    const validItems = formItems.filter((it) => it.material_id && it.notice_quantity > 0);
    if (!validItems.length) {
      messageApi.error('请至少添加一条有效明细');
      throw new Error('请至少添加一条有效明细');
    }
    const cust = customerList.find((c: any) => (c.id ?? c.customer_id) === values.customer_id);
    if (!cust) {
      messageApi.error('请选择客户');
      throw new Error('请选择客户');
    }
    try {
      await deliveryNoticeApi.create({
        customer_id: values.customer_id,
        customer_name: cust.name || cust.customer_name || cust.code,
        customer_contact: values.customer_contact,
        customer_phone: values.customer_phone,
        sales_delivery_id: values.sales_delivery_id,
        sales_delivery_code: values.sales_delivery_code,
        sales_order_id: values.sales_order_id,
        sales_order_code: values.sales_order_code,
        planned_delivery_date: values.planned_delivery_date ? dayjs(values.planned_delivery_date).format('YYYY-MM-DD') : undefined,
        carrier: values.carrier,
        tracking_number: values.tracking_number,
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
      await deliveryNoticeApi.update(editingId.toString(), {
        customer_id: values.customer_id,
        customer_name: cust?.name || cust?.customer_name || values.customer_name,
        customer_contact: values.customer_contact,
        customer_phone: values.customer_phone,
        planned_delivery_date: values.planned_delivery_date ? dayjs(values.planned_delivery_date).format('YYYY-MM-DD') : undefined,
        carrier: values.carrier,
        tracking_number: values.tracking_number,
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

  const detailColumns: ProDescriptionsItemProps<DeliveryNoticeDetail>[] = [
    { title: '通知单号', dataIndex: 'notice_code' },
    { title: '销售出库单号', dataIndex: 'sales_delivery_code' },
    { title: '销售订单号', dataIndex: 'sales_order_code' },
    { title: '客户', dataIndex: 'customer_name' },
    { title: '联系人', dataIndex: 'customer_contact' },
    { title: '电话', dataIndex: 'customer_phone' },
    { title: '预计送达', dataIndex: 'planned_delivery_date', valueType: 'date' },
    { title: '承运商', dataIndex: 'carrier' },
    { title: '运单号', dataIndex: 'tracking_number' },
    { title: '收货地址', dataIndex: 'shipping_address', span: 2 },
    {
      title: '状态',
      dataIndex: 'status',
      render: (s) => {
        const c = STATUS_MAP[(s as string) || ''] || { text: (s as string) || '-', color: 'default' };
        return <Tag color={c.color}>{c.text}</Tag>;
      },
    },
    { title: '发送时间', dataIndex: 'sent_at', valueType: 'dateTime' },
    { title: '备注', dataIndex: 'notes', span: 2 },
  ];

  const renderForm = (onFinish: (values: any) => Promise<void>) => (
    <>
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
      <Form.Item name="sales_delivery_code" label="销售出库单号">
        <Input placeholder="可选，关联出库单" />
      </Form.Item>
      <Form.Item name="sales_order_code" label="销售订单号">
        <Input placeholder="可选" />
      </Form.Item>
      <Form.Item name="planned_delivery_date" label="预计送达日期">
        <DatePicker style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name="carrier" label="承运商/物流">
        <Input placeholder="如：顺丰、德邦" />
      </Form.Item>
      <Form.Item name="tracking_number" label="运单号">
        <Input placeholder="物流单号" />
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
          headerTitle="送货单"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          showCreateButton
          createButtonText="新建送货单"
          onCreate={handleCreate}
          enableRowSelection
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton
          onDelete={handleBatchDelete}
          showImportButton={false}
          showExportButton
          onExport={async (type, keys, pageData) => {
            try {
              const response = await deliveryNoticeApi.list({ skip: 0, limit: 10000 });
              const rawData = Array.isArray(response) ? response : response?.items || response?.data || [];
              let items = rawData;
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else if (type === 'selected' && keys?.length) {
                items = rawData.filter((d: DeliveryNotice) => d.id != null && keys.includes(d.id));
              }
              if (items.length === 0) {
                messageApi.warning('暂无数据可导出');
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `delivery-notes-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(`已导出 ${items.length} 条记录`);
            } catch (error: any) {
              messageApi.error(error?.message || '导出失败');
            }
          }}
          showSyncButton
          onSync={() => setSyncModalVisible(true)}
          request={async (params) => {
            try {
              const response = await deliveryNoticeApi.list({
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                status: params.status,
                customer_id: params.customer_id,
              });
              const data = Array.isArray(response) ? response : response?.items || response?.data || [];
              const total = Array.isArray(response) ? response.length : response?.total ?? data.length;
              return { data, success: true, total };
            } catch {
              messageApi.error('获取列表失败');
              return { data: [], success: false, total: 0 };
            }
          }}
          scroll={{ x: 1300 }}
        />
      </ListPageTemplate>

      <DetailDrawerTemplate
        title={`送货单详情${noticeDetail?.notice_code ? ` - ${noticeDetail.notice_code}` : ''}`}
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
        title="新建送货单"
        open={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        formRef={formRef}
        onFinish={handleCreateSubmit}
        width={MODAL_CONFIG.LARGE_WIDTH}
      >
        {renderForm(handleCreateSubmit)}
      </FormModalTemplate>

      <FormModalTemplate
        title="编辑送货单"
        open={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        formRef={formRef}
        onFinish={handleEditSubmit}
        width={MODAL_CONFIG.LARGE_WIDTH}
      >
        {renderForm(handleEditSubmit)}
      </FormModalTemplate>

      <SyncFromDatasetModal
        open={syncModalVisible}
        onClose={() => setSyncModalVisible(false)}
        onConfirm={handleSyncConfirm}
        title="从数据集同步送货单"
      />
    </>
  );
};

export default DeliveryNotesPage;
