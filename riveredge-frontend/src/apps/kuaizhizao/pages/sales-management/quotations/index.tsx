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
import { App, Button, Tag, Space, Modal, Table, Form, Select, InputNumber, Input, Row, Col, DatePicker } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, SwapOutlined, PrinterOutlined, ImportOutlined } from '@ant-design/icons';
import { ProForm, ProFormText, ProFormDatePicker, ProFormTextArea } from '@ant-design/pro-components';
import { UniTable } from '../../../../../components/uni-table';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import { CustomerFormModal } from '../../../../master-data/components/CustomerFormModal';
import { customerApi } from '../../../../master-data/services/supply-chain';
import { UniImport } from '../../../../../components/uni-import';
import SyncFromDatasetModal from '../../../../../components/sync-from-dataset-modal';
import { ListPageTemplate, DetailDrawerTemplate, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { AmountDisplay } from '../../../../../components/permission';
import {
  listQuotations,
  getQuotation,
  createQuotation,
  updateQuotation,
  deleteQuotation,
  convertQuotationToOrder,
  Quotation,
} from '../../../services/quotation';
import { apiRequest } from '../../../../../services/api';
import dayjs from 'dayjs';
import { generateCode, testGenerateCode } from '../../../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';

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
  const [syncModalVisible, setSyncModalVisible] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const formRef = useRef<any>(null);
  const [customerList, setCustomerList] = useState<any[]>([]);
  const [materialList, setMaterialList] = useState<any[]>([]);
  const [customerCreateVisible, setCustomerCreateVisible] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [custRes, matRes] = await Promise.all([
          apiRequest<unknown>('/apps/master-data/supply-chain/customers', { params: { limit: 1000, is_active: true } }),
          apiRequest<unknown>('/apps/master-data/materials', { params: { limit: 1000, is_active: true } }),
        ]);
        const custList = Array.isArray(custRes) ? custRes : (custRes as any)?.data ?? (custRes as any)?.items ?? [];
        const matList = Array.isArray(matRes) ? matRes : (matRes as any)?.data ?? (matRes as any)?.items ?? [];
        setCustomerList(Array.isArray(custList) ? custList : []);
        setMaterialList(Array.isArray(matList) ? matList : []);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/14723169-35ed-4ca8-9cad-d93c6c16c078', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'f6a036' }, body: JSON.stringify({ sessionId: 'f6a036', runId: 'load', hypothesisId: 'H5_H6_H7_H8', location: 'quotations/index.tsx:load', message: 'customer/material API result', data: { custIsArray: Array.isArray(custRes), matIsArray: Array.isArray(matRes), custListLen: Array.isArray(custList) ? custList.length : 0, matListLen: Array.isArray(matList) ? matList.length : 0, custResKeys: custRes && typeof custRes === 'object' ? Object.keys(custRes as object) : [], matResKeys: matRes && typeof matRes === 'object' ? Object.keys(matRes as object) : [], firstCustId: Array.isArray(custList) && custList[0] != null ? (custList[0] as any).id ?? (custList[0] as any).customer_id : undefined, firstMatId: Array.isArray(matList) && matList[0] != null ? (matList[0] as any).id ?? (matList[0] as any).material_id : undefined }, timestamp: Date.now() }) }).catch(() => {});
        // #endregion
      } catch (e) {
        console.error('加载客户/物料失败', e);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/14723169-35ed-4ca8-9cad-d93c6c16c078', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'f6a036' }, body: JSON.stringify({ sessionId: 'f6a036', runId: 'load', hypothesisId: 'H5_H7', location: 'quotations/index.tsx:load catch', message: 'customer/material load failed', data: { errMessage: (e as Error)?.message, errName: (e as Error)?.name }, timestamp: Date.now() }) }).catch(() => {});
        // #endregion
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
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record.id!)}>详情</Button>
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

  const handleDetail = async (id: number) => {
    try {
      const res = await getQuotation(id);
      if (res) {
        setQuotationDetail(res);
        setDetailDrawerVisible(true);
      }
    } catch (e: any) {
      messageApi.error('获取报价单详情失败');
    }
  };

  const handleEdit = async (record: Quotation) => {
    try {
      const detail = await getQuotation(record.id!, true);
      setQuotationDetail(detail);
      formRef.current?.setFieldsValue({
        quotation_code: detail.quotation_code,
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
        items: (detail.items || []).map((it) => ({
          material_id: it.material_id!,
          material_code: it.material_code || '',
          material_name: it.material_name || '',
          material_spec: it.material_spec,
          material_unit: it.material_unit || '',
          quote_quantity: Number(it.quote_quantity) || 0,
          unit_price: Number(it.unit_price) || 0,
          delivery_date: it.delivery_date ? dayjs(it.delivery_date) : undefined,
          notes: it.notes,
        })),
      });
      setEditingId(record.id!);
      setModalVisible(true);
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

  const handleItemImport = (data: any[][]) => {
    const rows = data.slice(2);
    const newItems = rows
      .map((row) => {
        const materialCode = String(row[0] || '').trim();
        const spec = String(row[1] || '').trim();
        const unit = String(row[2] || '').trim();
        const quantity = parseFloat(row[3]) || 0;
        const price = parseFloat(row[4]) || 0;
        const deliveryDate = row[5];

        if (!materialCode) return null;

        const material = materialList.find((m: any) => (m.main_code ?? m.mainCode ?? m.code) === materialCode);
        
        return {
          material_id: material?.id ?? material?.material_id,
          material_code: material?.main_code ?? material?.mainCode ?? material?.code ?? materialCode,
          material_name: material?.name ?? material?.material_name ?? '',
          material_spec: material?.specification ?? material?.material_spec ?? spec,
          material_unit: material?.base_unit ?? material?.baseUnit ?? material?.material_unit ?? unit,
          quote_quantity: quantity,
          unit_price: price,
          delivery_date: deliveryDate ? (dayjs(deliveryDate).isValid() ? dayjs(deliveryDate) : undefined) : undefined,
        };
      })
      .filter((it): it is NonNullable<typeof it> => it !== null && (it.material_id !== undefined || it.material_code !== ''));

    if (newItems.length === 0) {
      messageApi.warning('未检测到有效数据（请确保物料编码不为空）');
      return;
    }

    const currentItems = formRef.current?.getFieldValue('items') || [];
    formRef.current?.setFieldsValue({
      items: [...currentItems, ...newItems],
    });
    messageApi.success(`成功导入 ${newItems.length} 条明细`);
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

  const handleCreate = async () => {
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ items: [] });
    setEditingId(null);
    setPreviewCode(null);
    const autoEnabled = isAutoGenerateEnabled('kuaizhizao-quotation');
    const ruleCode = getPageRuleCode('kuaizhizao-quotation');
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/14723169-35ed-4ca8-9cad-d93c6c16c078', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'f6a036' }, body: JSON.stringify({ sessionId: 'f6a036', runId: 'handleCreate', hypothesisId: 'H1_H2', location: 'quotations/index.tsx:handleCreate', message: 'auto code config', data: { autoEnabled, ruleCode, pageCode: 'kuaizhizao-quotation' }, timestamp: Date.now() }) }).catch(() => {});
    // #endregion
    if (autoEnabled) {
      if (ruleCode) {
        try {
          const codeResponse = await testGenerateCode({ rule_code: ruleCode });
          const preview = codeResponse.code;
          setPreviewCode(preview ?? null);
          formRef.current?.setFieldsValue({ quotation_code: preview ?? '' });
        } catch (e) {
          console.warn('报价单编码预生成失败:', e);
          setPreviewCode(null);
        }
      }
    }
    setModalVisible(true);
  };

  const submitCreate = async (values: any) => {
    const validItems = (values.items || []).filter((it: any) => it.material_id && it.quote_quantity > 0);
    if (!validItems.length) {
      messageApi.error('请至少添加一条有效明细（选择物料并填写数量）');
      throw new Error('请至少添加一条有效明细');
    }
    let quotationCode = values.quotation_code;
    const submitAutoEnabled = isAutoGenerateEnabled('kuaizhizao-quotation');
    const submitRuleCode = getPageRuleCode('kuaizhizao-quotation');
    const willCallGenerate = submitAutoEnabled && submitRuleCode && (quotationCode === previewCode || !quotationCode);
    if (submitAutoEnabled) {
      if (submitRuleCode && (quotationCode === previewCode || !quotationCode)) {
        try {
          const codeResponse = await generateCode({ rule_code: submitRuleCode });
          quotationCode = codeResponse.code;
        } catch (e) {
          console.warn('报价单编码正式生成失败，使用当前值:', e);
        }
      }
    }
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/14723169-35ed-4ca8-9cad-d93c6c16c078', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'f6a036' }, body: JSON.stringify({ sessionId: 'f6a036', runId: 'submitCreate', hypothesisId: 'H3', location: 'quotations/index.tsx:submitCreate', message: 'quotation code before create', data: { quotationCode, previewCode, submitAutoEnabled, submitRuleCode, willCallGenerate, customerListLen: customerList.length, customer_id: values.customer_id }, timestamp: Date.now() }) }).catch(() => {});
    // #endregion
    const cust = customerList.find((c: any) => (c.id ?? c.customer_id) === values.customer_id);
    const customerName = cust?.name ?? cust?.customer_name ?? values.customer_name ?? '';
    await createQuotation({
      quotation_code: quotationCode || undefined,
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
      items: validItems.map((it: any) => ({
        material_id: it.material_id,
        material_code: it.material_code,
        material_name: it.material_name,
        material_spec: it.material_spec,
        material_unit: it.material_unit,
        quote_quantity: it.quote_quantity,
        unit_price: it.unit_price,
        delivery_date: it.delivery_date ? (dayjs.isDayjs(it.delivery_date) ? it.delivery_date.format('YYYY-MM-DD') : it.delivery_date) : undefined,
        notes: it.notes,
      })),
    });
    messageApi.success('创建成功');
    setModalVisible(false);
    actionRef.current?.reload();
  };

  const submitEdit = async (values: any) => {
    if (!editingId) return;
    const validItems = (values.items || []).filter((it: any) => it.material_id && it.quote_quantity > 0);
    if (!validItems.length) {
      messageApi.error('请至少添加一条有效明细');
      throw new Error('请至少添加一条有效明细');
    }
    const cust = customerList.find((c: any) => (c.id ?? c.customer_id) === values.customer_id);
    const customerName = cust?.name ?? cust?.customer_name ?? values.customer_name ?? '';
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
      items: validItems.map((it: any) => ({
        material_id: it.material_id,
        material_code: it.material_code,
        material_name: it.material_name,
        material_spec: it.material_spec,
        material_unit: it.material_unit,
        quote_quantity: it.quote_quantity,
        unit_price: it.unit_price,
        delivery_date: it.delivery_date ? (dayjs.isDayjs(it.delivery_date) ? it.delivery_date.format('YYYY-MM-DD') : it.delivery_date) : undefined,
        notes: it.notes,
      })),
    });
    messageApi.success('更新成功');
    setModalVisible(false);
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
      <Row gutter={16}>
        <Col span={12}>
          <ProFormText
            name="quotation_code"
            label="报价单编号"
            placeholder={isAutoGenerateEnabled('kuaizhizao-quotation') ? '编码将根据编码规则自动生成，可修改' : '请输入报价单编号'}
            fieldProps={{ disabled: !!editingId }}
          />
        </Col>
        <Col span={12}>
          <ProForm.Item name="customer_id" label="客户名称" rules={[{ required: true, message: '请选择客户' }]}>
            <UniDropdown
              placeholder="请选择客户"
              showSearch
              allowClear
              style={{ width: '100%' }}
              options={customerList.map((c: any) => ({
                value: c.id ?? c.customer_id,
                label: `${c.code ?? c.customer_code ?? ''} - ${c.name ?? c.customer_name ?? ''}`.trim() || String(c.id ?? c.customer_id),
              }))}
              onChange={(value, option: any) => {
                const c = customerList.find((x: any) => (x.id ?? x.customer_id) === value);
                if (c) {
                  formRef.current?.setFieldsValue({
                    customer_name: c.name ?? c.customer_name,
                    customer_contact: c.contact_person ?? c.contact ?? c.customer_contact,
                    customer_phone: c.phone ?? c.customer_phone,
                  });
                }
              }}
              quickCreate={{
                label: '快速新建',
                onClick: () => setCustomerCreateVisible(true),
              }}
              advancedSearch={{
                label: '高级搜索',
                fields: [
                  { name: 'code', label: '客户编码' },
                  { name: 'name', label: '客户名称' },
                  { name: 'contactPerson', label: '联系人' },
                ],
                onSearch: async (values) => {
                  const list = await customerApi.list({ limit: 200, skip: 0 });
                  let filtered = list;
                  if (values.code?.trim()) {
                    const k = values.code.trim().toLowerCase();
                    filtered = filtered.filter((c: any) => (c.code ?? '').toLowerCase().includes(k));
                  }
                  if (values.name?.trim()) {
                    const k = values.name.trim().toLowerCase();
                    filtered = filtered.filter((c: any) => (c.name ?? '').toLowerCase().includes(k));
                  }
                  if (values.contactPerson?.trim()) {
                    const k = values.contactPerson.trim().toLowerCase();
                    filtered = filtered.filter((c: any) => (c.contactPerson ?? '').toLowerCase().includes(k));
                  }
                  return filtered.map((c: any) => ({
                    value: c.id ?? c.uuid,
                    label: `${c.code ?? ''} - ${c.name ?? ''}`.trim() || String(c.id ?? c.uuid),
                  }));
                },
              }}
            />
          </ProForm.Item>
        </Col>
        <Col span={6}>
          <ProFormDatePicker
            name="quotation_date"
            label="报价日期"
            rules={[{ required: true }]}
            fieldProps={{ style: { width: '100%' } }}
          />
        </Col>
        <Col span={6}>
          <ProFormDatePicker
            name="valid_until"
            label="有效期至"
            fieldProps={{ style: { width: '100%' } }}
          />
        </Col>
        <Col span={6}>
          <ProFormDatePicker
            name="delivery_date"
            label="预计交货日期"
            fieldProps={{ style: { width: '100%' } }}
          />
        </Col>
        <Col span={6}>
          <ProFormText name="customer_contact" label="联系人" />
        </Col>
        <Col span={6}>
          <ProFormText name="customer_phone" label="电话" />
        </Col>
        <Col span={6}>
          <ProFormText name="salesman_name" label="销售员" />
        </Col>
        <Col span={12}>
          <ProFormText name="shipping_address" label="收货地址" placeholder="请输入收货地址" />
        </Col>
        <Col span={6}>
          <ProFormText name="shipping_method" label="发货方式" />
        </Col>
        <Col span={6}>
          <ProFormText name="payment_terms" label="付款条件" />
        </Col>
      </Row>
      <ProFormText name="customer_name" hidden />

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontWeight: 600, color: 'rgba(0, 0, 0, 0.88)' }}>
            <span style={{ color: '#ff4d4f', marginRight: 4, fontFamily: 'SimSun, sans-serif' }}>*</span>
            物料明细
          </span>
          <Button 
            size="small" 
            icon={<ImportOutlined />} 
            onClick={() => setImportModalVisible(true)}
          >
            导入明细
          </Button>
        </div>
        <ProForm.Item name="items" noStyle rules={[{ required: true, message: '请至少添加一条明细' }]}>
          <Form.List name="items">
          {(fields, { add, remove }) => {
            const orderDetailColumns = [
              {
                title: '物料',
                dataIndex: 'material_id',
                width: 200,
                render: (_: any, __: any, index: number) => (
                  <Form.Item name={[index, 'material_id']} rules={[{ required: true, message: '请选择物料' }]} style={{ margin: 0 }}>
                    <Select
                      placeholder="请选择物料"
                      style={{ width: '100%' }}
                      showSearch
                      allowClear
                      size="small"
                      optionFilterProp="label"
                      options={materialList.map((m: any) => ({
                        value: m.id ?? m.material_id,
                        label: `${m.main_code ?? m.mainCode ?? m.code ?? ''} - ${m.name ?? m.material_name ?? ''}`.trim() || String(m.id ?? m.material_id),
                      }))}
                      onChange={(v) => {
                        const m = materialList.find((x: any) => (x.id ?? x.material_id) === v);
                        if (m) {
                          const items = formRef.current?.getFieldValue('items') || [];
                          items[index] = {
                            ...items[index],
                            material_id: m.id ?? m.material_id,
                            material_code: m.main_code ?? m.mainCode ?? m.code ?? m.material_code ?? '',
                            material_name: m.name ?? m.material_name ?? '',
                            material_spec: m.specification ?? m.material_spec ?? '',
                            material_unit: m.base_unit ?? m.baseUnit ?? m.material_unit ?? '',
                          };
                          formRef.current?.setFieldsValue({ items });
                        }
                      }}
                    />
                  </Form.Item>
                ),
              },
              {
                title: '规格',
                dataIndex: 'material_spec',
                width: 120,
                render: (_: any, __: any, index: number) => (
                  <Form.Item name={[index, 'material_spec']} style={{ margin: 0 }}>
                    <Input placeholder="规格" size="small" />
                  </Form.Item>
                ),
              },
              {
                title: '单位',
                dataIndex: 'material_unit',
                width: 80,
                render: (_: any, __: any, index: number) => (
                  <Form.Item name={[index, 'material_unit']} style={{ margin: 0 }}>
                    <Input placeholder="单位" size="small" />
                  </Form.Item>
                ),
              },
              {
                title: '数量',
                dataIndex: 'quote_quantity',
                width: 100,
                align: 'right' as const,
                render: (_: any, __: any, index: number) => (
                  <Form.Item name={[index, 'quote_quantity']} rules={[{ required: true, message: '必填' }]} style={{ margin: 0 }}>
                    <InputNumber placeholder="数量" min={0.01} precision={2} style={{ width: '100%' }} size="small" />
                  </Form.Item>
                ),
              },
              {
                title: '单价',
                dataIndex: 'unit_price',
                width: 100,
                align: 'right' as const,
                render: (_: any, __: any, index: number) => (
                  <Form.Item name={[index, 'unit_price']} style={{ margin: 0 }}>
                    <InputNumber placeholder="单价" min={0} precision={2} prefix="¥" style={{ width: '100%' }} size="small" />
                  </Form.Item>
                ),
              },
              {
                title: '金额',
                width: 110,
                align: 'right' as const,
                render: (_: any, __: any, index: number) => (
                  <Form.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items !== curr?.items}>
                    {({ getFieldValue }: any) => {
                      const items = getFieldValue('items') ?? [];
                      const row = items[index];
                      const amt = (Number(row?.quote_quantity) || 0) * (Number(row?.unit_price) || 0);
                      return <AmountDisplay resource="sales_order" value={amt} />;
                    }}
                  </Form.Item>
                ),
              },
              {
                title: '交货日期',
                dataIndex: 'delivery_date',
                width: 120,
                render: (_: any, __: any, index: number) => (
                  <Form.Item name={[index, 'delivery_date']} style={{ margin: 0 }}>
                    <DatePicker size="small" style={{ width: '100%' }} format="YYYY-MM-DD" />
                  </Form.Item>
                ),
              },
              {
                title: '备注',
                dataIndex: 'notes',
                width: 120,
                render: (_: any, __: any, index: number) => (
                  <Form.Item name={[index, 'notes']} style={{ margin: 0 }}>
                    <Input placeholder="备注" size="small" />
                  </Form.Item>
                ),
              },
              {
                title: '操作',
                width: 70,
                fixed: 'right' as const,
                render: (_: any, __: any, index: number) => (
                  <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(index)}>
                    删除
                  </Button>
                ),
              },
            ];
            const totalWidth = orderDetailColumns.reduce((s, c) => s + (c.width as number || 0), 0);
            return (
              <div style={{ width: '100%', minWidth: 0, overflow: 'hidden', boxSizing: 'border-box' }}>
                <style>{`
                  .quotation-detail-table .ant-table-thead > tr > th {
                    background-color: var(--ant-color-fill-alter) !important;
                    font-weight: 600;
                  }
                  .quotation-detail-table .ant-table {
                    border-top: 1px solid var(--ant-color-border);
                  }
                  .quotation-detail-table .ant-table-tbody > tr > td {
                    border-bottom: 1px solid var(--ant-color-border);
                  }
                `}</style>
                <div style={{ width: '100%', overflowX: 'auto', overflowY: 'visible', WebkitOverflowScrolling: 'touch' }}>
                  <Table
                    className="quotation-detail-table"
                    size="small"
                    dataSource={fields.map((f, i) => ({ ...f, key: f.key ?? i }))}
                    rowKey="key"
                    pagination={false}
                    columns={orderDetailColumns}
                    scroll={fields.length > 0 ? { x: totalWidth } : undefined}
                    style={{ width: '100%', margin: 0 }}
                    footer={() => (
                      <Button
                        type="dashed"
                        icon={<PlusOutlined />}
                        onClick={() => {
                          add({
                            material_id: undefined,
                            material_code: '',
                            material_name: '',
                            material_spec: '',
                            material_unit: '',
                            quote_quantity: 0,
                            unit_price: 0,
                            delivery_date: undefined,
                            notes: '',
                          });
                        }}
                        block
                      >
                        添加明细
                      </Button>
                    )}
                  />
                </div>
              </div>
            );
          }}
        </Form.List>
        </ProForm.Item>
      </div>
      <ProFormTextArea name="notes" label="备注" fieldProps={{ rows: 2 }} />
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
            <Button type="primary" icon={<SwapOutlined />} onClick={() => quotationDetail && handleConvert(quotationDetail)}>转为销售订单</Button>
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

      <Modal
        open={modalVisible}
        onCancel={() => { setModalVisible(false); setEditingId(null); }}
        title={editingId != null ? '编辑报价单' : '新建报价单'}
        width={1200}
        footer={null}
        destroyOnHidden
      >
        <ProForm
          formRef={formRef}
          layout="vertical"
          initialValues={editingId == null ? { quotation_date: dayjs() } : undefined}
          onValuesChange={(changed, all) => {
            if ('customer_id' in changed && changed.customer_id != null) {
              const c = customerList.find((x: any) => (x.id ?? x.customer_id) === changed.customer_id);
              if (c) {
                formRef.current?.setFieldsValue({
                  customer_name: c.name ?? c.customer_name,
                  customer_contact: c.contact_person ?? c.contact ?? c.customer_contact,
                  customer_phone: c.phone ?? c.customer_phone,
                });
              }
            }
          }}
          onFinish={async (values) => {
            if (editingId != null) await submitEdit(values);
            else await submitCreate(values);
          }}
          submitter={{
            searchConfig: { submitText: editingId != null ? '更新' : '提交', resetText: '取消' },
            resetButtonProps: { onClick: () => { setModalVisible(false); setEditingId(null); } },
            render: (_, dom) => (
              <div style={{ textAlign: 'left', marginTop: 16 }}>
                <Space>{dom}</Space>
              </div>
            ),
          }}
        >
          {formItemContent}
        </ProForm>
      </Modal>

      <CustomerFormModal
        open={customerCreateVisible}
        onClose={() => setCustomerCreateVisible(false)}
        editUuid={null}
        onSuccess={(customer) => {
          setCustomerList((prev) => [...prev, customer]);
          formRef.current?.setFieldsValue({
            customer_id: customer.id,
            customer_name: customer.name,
            customer_contact: customer.contactPerson,
            customer_phone: customer.phone,
          });
          setCustomerCreateVisible(false);
        }}
      />

      <SyncFromDatasetModal
        open={syncModalVisible}
        onClose={() => setSyncModalVisible(false)}
        onConfirm={handleSyncConfirm}
        title="从数据集同步报价单"
      />

      <UniImport
        visible={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        onConfirm={handleItemImport}
        title="导入报价明细"
        headers={['物料编码', '规格', '单位', '数量', '单价', '交货日期']}
        exampleRow={['MAT001', 'Spec X', 'PCS', '100', '1.5', '2026-03-01']}
      />
    </>
  );
};

export default QuotationsPage;
