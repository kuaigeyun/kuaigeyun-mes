/**
 * 报价单管理页面
 *
 * 提供报价单的创建、查看、编辑、删除和转销售订单功能。
 *
 * @author RiverEdge Team
 * @date 2026-02-19
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Table, Form, Select, InputNumber, Input, DatePicker } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, SwapOutlined, PrinterOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import SyncFromDatasetModal from '../../../../../components/sync-from-dataset-modal';
import { ListPageTemplate, DetailDrawerTemplate, FormModalTemplate, DRAWER_CONFIG, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { AmountDisplay } from '../../../../../components/permission';
import {
  listQuotations,
  getQuotation,
  createQuotation,
  updateQuotation,
  deleteQuotation,
  convertQuotationToOrder,
  Quotation,
  QuotationItem,
} from '../../../services/quotation';
import { customerApi } from '../../../../master-data/services/supply-chain';
import { materialApi } from '../../../../master-data/services/material';
import { apiRequest } from '../../../../../services/api';
import dayjs from 'dayjs';

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  草稿: { text: '草稿', color: 'default' },
  已发送: { text: '已发送', color: 'processing' },
  已接受: { text: '已接受', color: 'success' },
  已拒绝: { text: '已拒绝', color: 'error' },
  已转订单: { text: '已转订单', color: 'success' },
};

const QuotationsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [quotationDetail, setQuotationDetail] = useState<Quotation | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [syncModalVisible, setSyncModalVisible] = useState(false);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const formRef = useRef<any>(null);
  const [customerList, setCustomerList] = useState<any[]>([]);
  const [materialList, setMaterialList] = useState<any[]>([]);
  const [formItems, setFormItems] = useState<Array<{
    material_id: number;
    material_code: string;
    material_name: string;
    material_spec?: string;
    material_unit: string;
    quote_quantity: number;
    unit_price: number;
    delivery_date?: string;
    notes?: string;
  }>>([]);

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

  const columns: ProColumns<Quotation>[] = [
    { title: '报价单编号', dataIndex: 'quotation_code', width: 150, ellipsis: true, fixed: 'left' },
    { title: '客户', dataIndex: 'customer_name', width: 140, ellipsis: true },
    {
      title: '报价日期',
      dataIndex: 'quotation_date',
      width: 110,
      valueType: 'date',
    },
    {
      title: '总金额',
      dataIndex: 'total_amount',
      width: 110,
      align: 'right',
      render: (_, r) => <AmountDisplay resource="sales_order" value={r.total_amount} />,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: any) => {
        const c = STATUS_MAP[(status as string) || ''] || { text: (status as string) || '-', color: 'default' };
        return <Tag color={c.color}>{c.text}</Tag>;
      },
    },
    { title: '销售员', dataIndex: 'salesman_name', width: 100 },
    { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime', width: 160 },
    {
      title: '操作',
      width: 240,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>详情</Button>
          {record.status === '草稿' && (
            <>
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
              <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>删除</Button>
            </>
          )}
          {record.status !== '已转订单' && record.status !== '已拒绝' && (
            <Button type="link" size="small" icon={<SwapOutlined />} onClick={() => handleConvert(record)} style={{ color: '#1890ff' }}>转订单</Button>
          )}
          <Button type="link" size="small" icon={<PrinterOutlined />} onClick={() => handlePrint(record)}>打印</Button>
        </Space>
      ),
    },
  ];

  const handleDetail = async (record: Quotation) => {
    try {
      const detail = await getQuotation(record.id!, true);
      setQuotationDetail(detail);
      setDetailDrawerVisible(true);
    } catch {
      messageApi.error('获取报价单详情失败');
    }
  };

  const handleEdit = async (record: Quotation) => {
    try {
      const detail = await getQuotation(record.id!, true);
      setQuotationDetail(detail);
      setFormItems((detail.items || []).map((it) => ({
        material_id: it.material_id!,
        material_code: it.material_code || '',
        material_name: it.material_name || '',
        material_spec: it.material_spec,
        material_unit: it.material_unit || '',
        quote_quantity: Number(it.quote_quantity) || 0,
        unit_price: Number(it.unit_price) || 0,
        delivery_date: it.delivery_date,
        notes: it.notes,
      })));
      formRef.current?.setFieldsValue({
        quotation_date: detail.quotation_date ? dayjs(detail.quotation_date) : undefined,
        valid_until: detail.valid_until ? dayjs(detail.valid_until) : undefined,
        delivery_date: detail.delivery_date ? dayjs(detail.delivery_date) : undefined,
        customer_id: detail.customer_id,
        customer_name: detail.customer_name,
        customer_contact: detail.customer_contact,
        customer_phone: detail.customer_phone,
        salesman_name: detail.salesman_name,
        shipping_address: detail.shipping_address,
        shipping_method: detail.shipping_method,
        payment_terms: detail.payment_terms,
        notes: detail.notes,
      });
      setEditingId(record.id!);
      setEditModalVisible(true);
    } catch {
      messageApi.error('获取报价单详情失败');
    }
  };

  const handleDelete = (record: Quotation) => {
    Modal.confirm({
      title: '删除报价单',
      content: `确定要删除报价单 "${record.quotation_code}" 吗？`,
      onOk: async () => {
        try {
          await deleteQuotation(record.id!);
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
      content: `确定要删除选中的 ${keys.length} 条报价单吗？`,
      onOk: async () => {
        try {
          for (const k of keys) {
            await deleteQuotation(Number(k));
          }
          messageApi.success(`已删除 ${keys.length} 条报价单`);
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '批量删除失败');
        }
      },
    });
  };

  const handleSyncConfirm = async (rows: Record<string, any>[]) => {
    try {
      let successCount = 0;
      for (const row of rows) {
        const payload: Partial<Quotation> = {
          quotation_code: row.quotation_code || row.quotationCode,
          quotation_date: row.quotation_date || row.quotationDate,
          customer_name: row.customer_name || row.customerName,
          total_amount: row.total_amount ?? row.totalAmount,
          status: row.status || '草稿',
          items: Array.isArray(row.items) ? row.items : [],
        };
        await createQuotation(payload);
        successCount += 1;
      }
      messageApi.success(`已同步 ${successCount} 条报价单`);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || '同步失败');
    }
  };

  const handleConvert = (record: Quotation) => {
    Modal.confirm({
      title: '转为销售订单',
      content: `确定要将报价单 "${record.quotation_code}" 转为销售订单吗？转换后将创建新的销售订单并建立关联。`,
      onOk: async () => {
        try {
          const res = await convertQuotationToOrder(record.id!);
          messageApi.success(`已转为销售订单：${res.sales_order?.order_code || ''}`);
          actionRef.current?.reload();
          setDetailDrawerVisible(false);
          setQuotationDetail(null);
        } catch (error: any) {
          messageApi.error(error.message || '转订单失败');
        }
      },
    });
  };

  const handlePrint = async (record: Quotation) => {
    try {
      const result = await apiRequest<{ content?: string }>(`/apps/kuaizhizao/quotations/${record.id}/print`, {
        method: 'GET',
        params: { response_format: 'html', output_format: 'html' },
      });
      const html = result?.content || '';
      if (html) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>报价单打印</title></head><body>${html}</body></html>`);
          printWindow.document.close();
          printWindow.onload = () => printWindow.print();
        } else {
          messageApi.warning('无法打开打印窗口，请检查浏览器弹窗设置');
        }
      } else {
        messageApi.warning('打印内容为空');
      }
    } catch (error: any) {
      messageApi.error(error.message || '打印失败');
    }
  };

  const handleCreate = () => {
    setFormItems([]);
    formRef.current?.resetFields();
    setCreateModalVisible(true);
  };

  const addItem = () => {
    setFormItems((prev) => [...prev, {
      material_id: 0,
      material_code: '',
      material_name: '',
      material_unit: '',
      quote_quantity: 1,
      unit_price: 0,
    }]);
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
      material_spec: m.spec || m.material_spec,
      material_unit: m.baseUnit || m.material_unit || m.unit || '',
    };
    setFormItems(updated);
  };

  const submitCreate = async (values: any) => {
    const validItems = formItems.filter((it) => it.material_id && it.quote_quantity > 0);
    if (!validItems.length) {
      messageApi.error('请至少添加一条有效明细（选择物料并填写数量）');
      throw new Error('请至少添加一条有效明细');
    }
    const cust = customerList.find((c: any) => (c.id ?? c.customer_id) === values.customer_id);
    const customerName = cust?.name || cust?.customer_name || values.customer_name || '';
    await createQuotation({
      quotation_date: values.quotation_date?.format('YYYY-MM-DD'),
      valid_until: values.valid_until?.format('YYYY-MM-DD'),
      delivery_date: values.delivery_date?.format('YYYY-MM-DD'),
      customer_id: values.customer_id,
      customer_name: customerName,
      customer_contact: values.customer_contact,
      customer_phone: values.customer_phone,
      salesman_name: values.salesman_name,
      shipping_address: values.shipping_address,
      shipping_method: values.shipping_method,
      payment_terms: values.payment_terms,
      notes: values.notes,
      items: validItems.map((it) => ({
        material_id: it.material_id,
        material_code: it.material_code,
        material_name: it.material_name,
        material_spec: it.material_spec,
        material_unit: it.material_unit,
        quote_quantity: it.quote_quantity,
        unit_price: it.unit_price,
        delivery_date: it.delivery_date,
        notes: it.notes,
      })),
    });
    messageApi.success('创建成功');
    setCreateModalVisible(false);
    actionRef.current?.reload();
  };

  const submitEdit = async (values: any) => {
    if (!editingId) return;
    const validItems = formItems.filter((it) => it.material_id && it.quote_quantity > 0);
    if (!validItems.length) {
      messageApi.error('请至少添加一条有效明细');
      throw new Error('请至少添加一条有效明细');
    }
    const cust = customerList.find((c: any) => (c.id ?? c.customer_id) === values.customer_id);
    const customerName = cust?.name || cust?.customer_name || values.customer_name || '';
    await updateQuotation(editingId, {
      quotation_date: values.quotation_date?.format('YYYY-MM-DD'),
      valid_until: values.valid_until?.format('YYYY-MM-DD'),
      delivery_date: values.delivery_date?.format('YYYY-MM-DD'),
      customer_id: values.customer_id,
      customer_name: customerName,
      customer_contact: values.customer_contact,
      customer_phone: values.customer_phone,
      salesman_name: values.salesman_name,
      shipping_address: values.shipping_address,
      shipping_method: values.shipping_method,
      payment_terms: values.payment_terms,
      notes: values.notes,
      items: validItems.map((it) => ({
        material_id: it.material_id,
        material_code: it.material_code,
        material_name: it.material_name,
        material_spec: it.material_spec,
        material_unit: it.material_unit,
        quote_quantity: it.quote_quantity,
        unit_price: it.unit_price,
        delivery_date: it.delivery_date,
        notes: it.notes,
      })),
    });
    messageApi.success('更新成功');
    setEditModalVisible(false);
    setEditingId(null);
    actionRef.current?.reload();
  };

  const detailColumns: ProDescriptionsItemProps<Quotation>[] = [
    { title: '报价单编号', dataIndex: 'quotation_code' },
    { title: '客户', dataIndex: 'customer_name' },
    { title: '联系人', dataIndex: 'customer_contact' },
    { title: '电话', dataIndex: 'customer_phone' },
    { title: '报价日期', dataIndex: 'quotation_date' },
    { title: '有效期至', dataIndex: 'valid_until' },
    { title: '预计交货日期', dataIndex: 'delivery_date' },
    {
      title: '总金额',
      dataIndex: 'total_amount',
      render: (_, r) => <AmountDisplay resource="sales_order" value={r.total_amount} />,
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (s) => {
        const c = STATUS_MAP[(s as string) || ''] || { text: (s as string) || '-', color: 'default' };
        return <Tag color={c.color}>{c.text}</Tag>;
      },
    },
    { title: '销售员', dataIndex: 'salesman_name' },
    { title: '收货地址', dataIndex: 'shipping_address', span: 2 },
    { title: '发货方式', dataIndex: 'shipping_method' },
    { title: '付款条件', dataIndex: 'payment_terms' },
    { title: '关联销售订单', dataIndex: 'sales_order_code' },
    { title: '备注', dataIndex: 'notes', span: 2 },
  ];

  const formItemContent = (
    <>
      <Form.Item name="customer_id" label="客户" rules={[{ required: true }]}>
        <Select
          placeholder="请选择客户"
          showSearch
          optionFilterProp="label"
          options={customerList.map((c: any) => ({
            value: c.id ?? c.customer_id,
            label: `${c.code || ''} ${c.name || c.customer_name || ''}`.trim(),
          }))}
          onChange={(_, opt: any) => {
            const c = customerList.find((x: any) => (x.id ?? x.customer_id) === opt?.value);
            if (c) {
              formRef.current?.setFieldsValue({
                customer_name: c.name || c.customer_name,
                customer_contact: c.contact || c.customer_contact,
                customer_phone: c.phone || c.customer_phone,
              });
            }
          }}
        />
      </Form.Item>
      <Form.Item name="quotation_date" label="报价日期" rules={[{ required: true }]}>
        <DatePicker style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name="valid_until" label="有效期至">
        <DatePicker style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name="delivery_date" label="预计交货日期">
        <DatePicker style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name="customer_name" hidden><Input /></Form.Item>
      <Form.Item name="customer_contact" label="联系人"><Input /></Form.Item>
      <Form.Item name="customer_phone" label="电话"><Input /></Form.Item>
      <Form.Item name="salesman_name" label="销售员"><Input /></Form.Item>
      <Form.Item name="shipping_address" label="收货地址"><Input.TextArea rows={2} /></Form.Item>
      <Form.Item name="shipping_method" label="发货方式"><Input /></Form.Item>
      <Form.Item name="payment_terms" label="付款条件"><Input /></Form.Item>
      <Form.Item label="明细">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button type="dashed" onClick={addItem} icon={<PlusOutlined />}>添加明细</Button>
          {formItems.map((it, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Select
                placeholder="物料"
                style={{ width: 220 }}
                showSearch
                optionFilterProp="label"
                options={materialList.map((m: any) => ({
                  value: m.id ?? m.material_id,
                  label: `${m.mainCode || m.code || ''} ${m.name || ''}`.trim(),
                }))}
                onChange={(v) => onMaterialSelect(idx, v)}
                value={it.material_id || undefined}
              />
              <InputNumber placeholder="数量" min={0.01} value={it.quote_quantity} onChange={(v) => {
                const u = [...formItems]; u[idx] = { ...u[idx], quote_quantity: v ?? 0 }; setFormItems(u);
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
          headerTitle="报价单"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          showCreateButton
          createButtonText="新建报价单"
          onCreate={handleCreate}
          enableRowSelection
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton
          onDelete={handleBatchDelete}
          showImportButton={false}
          showExportButton
          onExport={async (type, keys, pageData) => {
            try {
              const res = await listQuotations({ skip: 0, limit: 10000 });
              let items = res.data || [];
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else if (type === 'selected' && keys?.length) {
                items = items.filter((d) => d.id != null && keys.includes(d.id));
              }
              if (items.length === 0) {
                messageApi.warning('暂无数据可导出');
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `quotations-${new Date().toISOString().slice(0, 10)}.json`;
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
              const response = await listQuotations({
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                status: params.status,
                start_date: params.start_date,
                end_date: params.end_date,
              });
              return {
                data: response.data || [],
                success: true,
                total: response.total ?? 0,
              };
            } catch {
              messageApi.error('获取报价单列表失败');
              return { data: [], success: false, total: 0 };
            }
          }}
          scroll={{ x: 1100 }}
        />
      </ListPageTemplate>

      <DetailDrawerTemplate
        title={`报价单详情${quotationDetail?.quotation_code ? ` - ${quotationDetail.quotation_code}` : ''}`}
        open={detailDrawerVisible}
        onClose={() => { setDetailDrawerVisible(false); setQuotationDetail(null); }}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        columns={detailColumns}
        dataSource={quotationDetail || {}}
        extra={
          quotationDetail?.status !== '已转订单' && quotationDetail?.status !== '已拒绝' && (
            <Button type="primary" icon={<SwapOutlined />} onClick={() => handleConvert(quotationDetail)}>转为销售订单</Button>
          )
        }
      >
        {quotationDetail?.items && quotationDetail.items.length > 0 && (
          <Table
            size="small"
            rowKey="id"
            columns={[
              { title: '物料编码', dataIndex: 'material_code', width: 120 },
              { title: '物料名称', dataIndex: 'material_name', width: 150 },
              { title: '规格', dataIndex: 'material_spec', width: 100 },
              { title: '单位', dataIndex: 'material_unit', width: 60 },
              { title: '报价数量', dataIndex: 'quote_quantity', width: 100, align: 'right' },
              { title: '单价', dataIndex: 'unit_price', width: 100, align: 'right', render: (v: number) => <AmountDisplay resource="sales_order" value={v} /> },
              { title: '金额', dataIndex: 'total_amount', width: 100, align: 'right', render: (v: number) => <AmountDisplay resource="sales_order" value={v} /> },
              { title: '交货日期', dataIndex: 'delivery_date', width: 110 },
              { title: '备注', dataIndex: 'notes' },
            ]}
            dataSource={quotationDetail.items}
            pagination={false}
          />
        )}
      </DetailDrawerTemplate>

      <FormModalTemplate
        title="新建报价单"
        open={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        formRef={formRef}
        onFinish={submitCreate}
        width={MODAL_CONFIG.LARGE_WIDTH}
        initialValues={{ quotation_date: dayjs() }}
      >
        {formItemContent}
      </FormModalTemplate>

      <FormModalTemplate
        title="编辑报价单"
        open={editModalVisible}
        onClose={() => { setEditModalVisible(false); setEditingId(null); }}
        formRef={formRef}
        onFinish={submitEdit}
        width={MODAL_CONFIG.LARGE_WIDTH}
      >
        {formItemContent}
      </FormModalTemplate>

      <SyncFromDatasetModal
        open={syncModalVisible}
        onClose={() => setSyncModalVisible(false)}
        onConfirm={handleSyncConfirm}
        title="从数据集同步报价单"
      />
    </>
  );
};

export default QuotationsPage;
