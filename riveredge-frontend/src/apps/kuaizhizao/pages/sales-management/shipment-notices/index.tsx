/**
 * 发货通知单管理页面
 *
 * 销售通知仓库发货，不直接动库存。来源为销售订单。
 * 参考销售订单排版布局，支持单据编号自动生成。
 *
 * @author RiverEdge Team
 * @date 2026-02-22
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProForm, ProFormText, ProFormDatePicker, ProFormTextArea, ProFormItem } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Table, Form as AntForm, Select, InputNumber, Input, Row, Col, Typography } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, SendOutlined, ShoppingOutlined, ImportOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { MaterialBatchPickerModal } from '../../../../../components/material-batch-picker-modal';
import { UniImport } from '../../../../../components/uni-import';
import type { Material } from '../../../../master-data/types/material';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import { ListPageTemplate, DetailDrawerTemplate, FormModalTemplate, DRAWER_CONFIG, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { shipmentNoticeApi } from '../../../services/shipment-notice';
import { getShipmentNoticeLifecycle } from '../../../utils/shipmentNoticeLifecycle';
import { customerApi } from '../../../../master-data/services/supply-chain';
import { listSalesOrders, getSalesOrder } from '../../../services/sales-order';
import { generateCode, testGenerateCode, getCodeRulePageConfig } from '../../../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';
import { useTranslation } from 'react-i18next';

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
  items?: { id?: number; material_id?: number; material_code: string; material_name: string; material_unit: string; notice_quantity: number; unit_price?: number; total_amount?: number }[];
}

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  待发货: { text: '待发货', color: 'default' },
  已通知: { text: '已通知', color: 'processing' },
  已出库: { text: '已出库', color: 'success' },
};

const defaultNoticeItem = { material_id: undefined, material_code: '', material_name: '', material_spec: '', material_unit: '件', notice_quantity: 1, unit_price: 0 };

const ShipmentNoticesPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [noticeDetail, setNoticeDetail] = useState<ShipmentNoticeDetail | null>(null);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const formRef = useRef<any>(null);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [customerList, setCustomerList] = useState<any[]>([]);
  const [salesOrderList, setSalesOrderList] = useState<any[]>([]);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [effectiveRuleCode, setEffectiveRuleCode] = useState<string | null>(null);
  const [importVisible, setImportVisible] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [cust, ordersRes] = await Promise.all([
          customerApi.list({ limit: 1000, isActive: true }),
          listSalesOrders({ limit: 500 }).catch(() => ({ data: [], total: 0, success: false })),
        ]);
        setCustomerList(Array.isArray(cust) ? cust : (cust as any)?.data || (cust as any)?.items || []);
        setSalesOrderList(ordersRes?.data || []);
      } catch (e) {
        console.error('加载客户/销售订单失败', e);
      }
    };
    load();
  }, []);

  const appendShipmentNoticeItemsFromMaterials = useCallback(
    (selected: Material[]) => {
      const current = formRef.current?.getFieldValue('items') ?? [];
      const newRows = selected.map((m) => ({
        material_id: m.id,
        material_code: m.mainCode ?? m.code ?? '',
        material_name: m.name ?? '',
        material_spec: m.specification ?? '',
        material_unit: m.baseUnit ?? '件',
        notice_quantity: 1,
        unit_price: (m as any).defaults?.defaultSalePrice ?? (m as any).defaults?.default_sale_price ?? 0,
      }));
      // 如果当前只有一行且未选择物料，则替换该行
      if (current.length === 1 && !current[0].material_id && !current[0].material_code) {
        formRef.current?.setFieldsValue({ items: newRows });
      } else {
        formRef.current?.setFieldsValue({ items: [...current, ...newRows] });
      }
      messageApi.success(t('app.kuaizhizao.common.materialBatchAdded', { count: selected.length }));
    },
    [messageApi, t]
  );

  /**
   * 发货通知单明细汇总组件
   */
  const ShipmentNoticeFormSummary: React.FC = () => {
    const items = AntForm.useWatch('items');
    const totalQuantity = items?.reduce((sum: number, it: any) => sum + (Number(it?.notice_quantity) || 0), 0) || 0;
    const totalAmount = items?.reduce((sum: number, it: any) => sum + (Number(it?.notice_quantity) * Number(it?.unit_price || 0) || 0), 0) || 0;

    return (
      <div style={{ marginTop: 12, padding: '12px', background: '#fafafa', borderRadius: '4px', display: 'flex', justifyContent: 'flex-end', gap: 24 }}>
        <span>{t('app.kuaizhizao.shipmentNotice.totalQuantity') || '总通知数量'}: <Typography.Text strong>{totalQuantity}</Typography.Text></span>
        <span>{t('app.kuaizhizao.shipmentNotice.totalAmount') || '总预计金额'}: <Typography.Text strong>¥{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Typography.Text></span>
      </div>
    );
  };

  const columns: ProColumns<ShipmentNotice>[] = [
    { title: '通知单号', dataIndex: 'notice_code', width: 140, ellipsis: true, fixed: 'left' },
    { title: '销售订单号', dataIndex: 'sales_order_code', width: 140, ellipsis: true },
    { title: '客户', dataIndex: 'customer_name', width: 140, ellipsis: true },
    { title: '出库仓库', dataIndex: 'warehouse_name', width: 120 },
    {
      title: '生命周期',
      dataIndex: 'lifecycle',
      width: 100,
      render: (_, record) => {
        const lifecycle = getShipmentNoticeLifecycle(record as any);
        const stageName = lifecycle.stageName ?? record.status ?? '待发货';
        const c = STATUS_MAP[stageName] || { text: stageName || '-', color: 'default' };
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
              <Button type="link" size="small" icon={<SendOutlined />} onClick={() => handleNotify(record as any)} style={{ color: '#1890ff' }}>通知仓库</Button>
              <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record as any)}>删除</Button>
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
      const itemsForm = (detail.items || []).map((it: any) => ({
        material_id: it.material_id,
        material_code: it.material_code || '',
        material_name: it.material_name || '',
        material_spec: it.material_spec || '',
        material_unit: it.material_unit || '',
        notice_quantity: Number(it.notice_quantity) || 0,
        unit_price: Number(it.unit_price) || 0,
      }));
      formRef.current?.setFieldsValue({
        sales_order_id: detail.sales_order_id,
        sales_order_code: detail.sales_order_code,
        customer_id: detail.customer_id,
        customer_name: detail.customer_name,
        customer_contact: detail.customer_contact,
        customer_phone: detail.customer_phone,
        warehouse_id: detail.warehouse_id,
        warehouse_name: detail.warehouse_name,
        planned_ship_date: detail.planned_ship_date ? dayjs(detail.planned_ship_date) : undefined,
        shipping_address: detail.shipping_address,
        notes: detail.notes,
        items: itemsForm.length ? itemsForm : [defaultNoticeItem],
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
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error?.message || '批量删除失败');
        }
      },
    });
  };

  const handleCreate = async () => {
    setPreviewCode(null);
    setEffectiveRuleCode(null);
    setEditingId(null);
    setCreateModalVisible(true);
    setTimeout(() => {
      formRef.current?.setFieldsValue({ items: [defaultNoticeItem] });
    }, 100);
    let ruleCode = getPageRuleCode('kuaizhizao-shipment-notice');
    let autoGenerate = isAutoGenerateEnabled('kuaizhizao-shipment-notice');
    try {
      const pageConfig = await getCodeRulePageConfig('kuaizhizao-shipment-notice');
      if (pageConfig?.ruleCode) {
        ruleCode = pageConfig.ruleCode;
        autoGenerate = !!pageConfig.autoGenerate;
      }
    } catch {}
    if (autoGenerate && ruleCode) {
      setEffectiveRuleCode(ruleCode);
      testGenerateCode({ rule_code: ruleCode })
        .then((res) => {
          const preview = res.code;
          setPreviewCode(preview ?? null);
          setTimeout(() => {
            formRef.current?.setFieldsValue({ notice_code: preview ?? '', items: [defaultNoticeItem] });
          }, 100);
        })
        .catch((e) => {
          console.warn('发货通知单编号预生成失败:', e);
          setPreviewCode(null);
        });
    } else {
      setPreviewCode(null);
    }
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
    const cust = customerList.find((c: any) => (c.id ?? c.customer_id) === custId);
    const custName = cust?.name || cust?.customer_name || order.customer_name || order.customerName || '';
    formRef.current?.setFieldsValue({
      sales_order_code: code,
      customer_id: custId,
      customer_name: custName,
      customer_contact: order.customer_contact || cust?.contactPerson || (cust as any)?.contact,
      customer_phone: order.customer_phone || cust?.phone,
      shipping_address: order.shipping_address || cust?.address,
    });
    if (order.items && order.items.length > 0) {
      const items = order.items.map((it: any, index: number) => ({
        material_id: it.material_id ?? it.materialId,
        material_code: it.material_code || it.materialCode || '',
        material_name: it.material_name || it.materialName || '',
        material_spec: it.material_spec || '',
        material_unit: it.material_unit || it.materialUnit || '件',
        notice_quantity: Number(it.required_quantity ?? it.quantity ?? it.order_quantity) || 0,
        unit_price: Number((it.unit_price ?? it.unitPrice) || (order.items && order.items[index]?.unit_price)) || 0,
      }));
      formRef.current?.setFieldsValue({ items });
    }
  };

  const handleCreateSubmit = async (values: any) => {
    const validItems = (values.items ?? []).filter((it: any) => it.material_id && (Number(it.notice_quantity) || 0) > 0);
    if (!validItems.length) {
      messageApi.error('请至少添加一条有效明细');
      throw new Error('请至少添加一条有效明细');
    }
    if (!values.sales_order_id || !values.sales_order_code) {
      messageApi.error('请选择销售订单');
      throw new Error('请选择销售订单');
    }
    const cust = customerList.find((c: any) => (c.id ?? c.customer_id) === values.customer_id) || { name: values.customer_name };
    let noticeCode = values.notice_code;
    const ruleCodeToUse = effectiveRuleCode || getPageRuleCode('kuaizhizao-shipment-notice');
    if (
      ruleCodeToUse &&
      (isAutoGenerateEnabled('kuaizhizao-shipment-notice') || effectiveRuleCode) &&
      (noticeCode === previewCode || !noticeCode)
    ) {
      try {
        const res = await generateCode({ rule_code: ruleCodeToUse });
        noticeCode = res.code;
      } catch (e) {
        console.warn('发货通知单编号正式生成失败，使用当前值:', e);
      }
    }
    try {
      await shipmentNoticeApi.create({
        notice_code: noticeCode || undefined,
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
        items: validItems.map((it: any) => ({
          material_id: it.material_id,
          material_code: it.material_code,
          material_name: it.material_name,
          material_spec: it.material_spec,
          material_unit: it.material_unit || '件',
          notice_quantity: Number(it.notice_quantity) || 0,
          unit_price: Number(it.unit_price) || 0,
        })),
      });
      messageApi.success('创建成功');
      setCreateModalVisible(false);
      setEffectiveRuleCode(null);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '创建失败');
      throw error;
    }
  };

  const handleEditSubmit = async (values: any) => {
    if (!editingId) return;
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

  const handleExcelImport = (data: any[][]) => {
    if (data.length <= 1) return;
    // 假设第一行是表头，从第二行开始取数据
    // 简单映射：A列编号, B列数量, C列单价 (业务具体根据 headers 调整)
    const items = data.slice(1).filter(row => row[0]).map(row => ({
      material_code: String(row[0] || ''),
      notice_quantity: Number(row[1]) || 1,
      unit_price: Number(row[2]) || 0,
      material_name: String(row[3] || ''),
      material_spec: String(row[4] || ''),
      material_unit: String(row[5] || '件'),
    }));

    if (items.length === 0) {
      messageApi.warning('未发现有效数据');
      return;
    }

    const currentItems = formRef.current?.getFieldValue('items') || [];
    const filteredCurrent = currentItems.filter((it: any) => it.material_id || it.material_code);
    formRef.current?.setFieldsValue({
      items: [...filteredCurrent, ...items]
    });
    messageApi.success(`成功导入 ${items.length} 条数据`);
  };

  const renderCreateForm = () => (
    <>
      <Row gutter={16}>
        <Col span={12}>
          <ProFormText
            name="notice_code"
            label={
              <span>
                通知单号
                <a href="/system/code-rules" onClick={(e) => { e.preventDefault(); navigate('/system/code-rules'); }} style={{ marginLeft: 8, fontSize: 12 }}>编号规则设置</a>
              </span>
            }
            placeholder={isAutoGenerateEnabled('kuaizhizao-shipment-notice') ? '编号将根据编号规则自动生成，可修改' : '请输入通知单号'}
            rules={[{ required: true, message: '请输入通知单号' }]}
          />
        </Col>
        <Col span={12}>
          <ProForm.Item name="sales_order_id" label="销售订单" rules={[{ required: true, message: '请选择销售订单' }]}>
            <Select
              placeholder="请选择销售订单"
              showSearch
              optionFilterProp="label"
              options={salesOrderList.map((o: any) => ({
                value: o.id ?? o.sales_order_id,
                label: `${o.order_code || o.sales_order_code || o.code || ''} - ${o.customer_name || o.customerName || ''}`.trim(),
              }))}
              onChange={onSalesOrderSelect}
            />
          </ProForm.Item>
        </Col>
      </Row>
      <ProFormText name="sales_order_code" hidden />
      <ProFormText name="customer_name" hidden />
      <Row gutter={16}>
        <Col span={12}>
          <ProForm.Item name="customer_id" label="客户" rules={[{ required: true, message: '请选择客户' }]}>
            <Select
              placeholder="请选择客户"
              showSearch
              optionFilterProp="label"
              options={customerList.map((c: any) => ({ value: c.id ?? c.customer_id, label: c.name || c.customer_name || c.code }))}
              onChange={(v) => {
                const cust = customerList.find((x: any) => (x.id ?? x.customer_id) === v);
                if (cust) formRef.current?.setFieldsValue({
                  customer_name: cust.name || cust.customer_name,
                  customer_contact: cust.contactPerson ?? (cust as any)?.contact,
                  customer_phone: cust.phone,
                  shipping_address: cust.address,
                });
              }}
            />
          </ProForm.Item>
        </Col>
        <Col span={12}>
          <ProFormText name="customer_contact" label="联系人" placeholder="联系人" />
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <ProFormText name="customer_phone" label="电话" placeholder="电话" />
        </Col>
        <Col span={12}>
          <UniWarehouseSelect
            name="warehouse_id"
            label="出库仓库"
            placeholder="请选择出库仓库"
            onChange={(_, wh) => formRef.current?.setFieldsValue({ warehouse_name: wh?.name ?? '' })}
          />
        </Col>
      </Row>
      <ProFormText name="warehouse_name" hidden />
      <Row gutter={16}>
        <Col span={12}>
          <ProFormDatePicker name="planned_ship_date" label="计划发货日期" fieldProps={{ style: { width: '100%' } }} />
        </Col>
        <Col span={12} />
      </Row>
      <ProFormTextArea name="shipping_address" label="收货地址" placeholder="收货地址" fieldProps={{ rows: 2 }} />
      <ProFormItem 
        label={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span>通知明细</span>
            <Button size="small" icon={<ImportOutlined />} onClick={() => setImportVisible(true)}>导入明细</Button>
          </div>
        } 
        required 
        style={{ width: '100%' }}
      >
        <ProForm.Item name="items" noStyle rules={[{ type: 'array', min: 1, message: '请至少添加一条通知明细' }]}>
          <AntForm.List name="items">
            {(fields, { add, remove }) => {
              const cols = [
                {
                  title: '物料',
                  dataIndex: 'material_id',
                  width: 220,
                  render: (_: any, __: any, index: number) => (
                    <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items?.[index] !== curr?.items?.[index]}>
                      {({ getFieldValue }: any) => {
                        const row = getFieldValue('items')?.[index];
                        const mid = row?.material_id ? Number(row.material_id) : null;
                        const fallback = mid && (row?.material_code || row?.material_name)
                          ? { value: mid, label: `${row.material_code || ''} - ${row.material_name || ''}`.trim() || String(mid) }
                          : undefined;
                        return (
                          <UniMaterialSelect
                            name={[index, 'material_id']}
                            label=""
                            placeholder="请选择物料"
                            required
                            size="small"
                            listFieldKey={index}
                            listFieldName="items"
                            fillMapping={{
                              material_code: 'mainCode',
                              material_name: 'name',
                              material_spec: 'specification',
                              material_unit: 'baseUnit',
                              unit_price: 'defaults.defaultSalePrice' as any,
                            }}
                            fallbackOption={fallback}
                            formItemProps={{ style: { margin: 0 } }}
                            showQuickCreate
                            showAdvancedSearch
                          />
                        );
                      }}
                    </AntForm.Item>
                  ),
                },
                {
                  title: '规格',
                  dataIndex: 'material_spec',
                  width: 120,
                  render: (_: any, __: any, index: number) => (
                    <AntForm.Item name={[index, 'material_spec']} style={{ margin: 0 }}>
                      <Input placeholder="规格" size="small" />
                    </AntForm.Item>
                  ),
                },
                {
                  title: '单位',
                  dataIndex: 'material_unit',
                  width: 80,
                  render: (_: any, __: any, index: number) => (
                    <AntForm.Item name={[index, 'material_unit']} style={{ margin: 0 }}>
                      <Input placeholder="单位" size="small" />
                    </AntForm.Item>
                  ),
                },
                {
                  title: '数量',
                  dataIndex: 'notice_quantity',
                  width: 100,
                  align: 'right' as const,
                  render: (_: any, __: any, index: number) => (
                    <AntForm.Item name={[index, 'notice_quantity']} rules={[{ required: true, message: '必填' }, { type: 'number', min: 0.01, message: '>0' }]} style={{ margin: 0 }}>
                      <InputNumber placeholder="数量" min={0} precision={2} style={{ width: '100%' }} size="small" />
                    </AntForm.Item>
                  ),
                },
                {
                  title: '单价',
                  dataIndex: 'unit_price',
                  width: 100,
                  align: 'right' as const,
                  render: (_: any, __: any, index: number) => (
                    <AntForm.Item name={[index, 'unit_price']} style={{ margin: 0 }}>
                      <InputNumber placeholder="0" min={0} precision={2} style={{ width: '100%' }} size="small" />
                    </AntForm.Item>
                  ),
                },
                {
                  title: '操作',
                  width: 60,
                  render: (_: any, __: any, index: number) => (
                    <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(index)} disabled={fields.length <= 1} />
                  ),
                },
              ];
              return (
                <div style={{ width: '100%', overflowX: 'auto' }}>
                  <Table
                    size="small"
                    dataSource={fields.map((f, i) => ({ ...f, key: f.key ?? i }))}
                    rowKey="key"
                    pagination={false}
                    columns={cols}
                    footer={() => (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%' }}>
                        <Button type="dashed" icon={<PlusOutlined />} style={{ flex: 1, minWidth: 120 }} onClick={() => add(defaultNoticeItem)}>
                          添加明细
                        </Button>
                        <Button
                          type="default"
                          icon={<ShoppingOutlined />}
                          style={{ flex: 1, minWidth: 120 }}
                          onClick={() => setMaterialPickerOpen(true)}
                        >
                          {t('app.kuaizhizao.common.materialBatchSelect')}
                        </Button>
                      </div>
                    )}
                  />
                </div>
              );
            }}
          </AntForm.List>
        </ProForm.Item>
        <ShipmentNoticeFormSummary />
      </ProFormItem>
      <ProFormTextArea name="notes" label="备注" placeholder="备注" fieldProps={{ rows: 2 }} colProps={{ span: 24 }} />
    </>
  );

  const renderEditForm = () => (
    <>
      <Row gutter={16}>
        <Col span={12}>
          <ProFormText name="sales_order_code" label="销售订单号" disabled />
        </Col>
        <Col span={12} />
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <ProForm.Item name="customer_id" label="客户" rules={[{ required: true, message: '请选择客户' }]}>
            <Select
              placeholder="请选择客户"
              showSearch
              optionFilterProp="label"
              options={customerList.map((c: any) => ({ value: c.id ?? c.customer_id, label: c.name || c.customer_name || c.code }))}
              onChange={(v) => {
                const cust = customerList.find((x: any) => (x.id ?? x.customer_id) === v);
                if (cust) formRef.current?.setFieldsValue({
                  customer_name: cust.name || cust.customer_name,
                  customer_contact: cust.contactPerson ?? (cust as any)?.contact,
                  customer_phone: cust.phone,
                });
              }}
            />
          </ProForm.Item>
        </Col>
        <Col span={12}>
          <ProFormText name="customer_contact" label="联系人" placeholder="联系人" />
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <ProFormText name="customer_phone" label="电话" placeholder="电话" />
        </Col>
        <Col span={12}>
          <UniWarehouseSelect
            name="warehouse_id"
            label="出库仓库"
            placeholder="请选择出库仓库"
            onChange={(_, wh) => formRef.current?.setFieldsValue({ warehouse_name: wh?.name ?? '' })}
          />
        </Col>
      </Row>
      <ProFormText name="warehouse_name" hidden />
      <ProFormText name="customer_name" hidden />
      <Row gutter={16}>
        <Col span={12}>
          <ProFormDatePicker name="planned_ship_date" label="计划发货日期" fieldProps={{ style: { width: '100%' } }} />
        </Col>
        <Col span={12} />
      </Row>
      <ProFormTextArea name="shipping_address" label="收货地址" placeholder="收货地址" fieldProps={{ rows: 2 }} />
      <ProFormItem label="通知明细">
        <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items !== curr?.items}>
          {({ getFieldValue }: any) => {
            const items = getFieldValue('items') ?? [];
            return (
              <Table
                size="small"
                dataSource={items.map((it: any, i: number) => ({ ...it, key: i }))}
                rowKey="key"
                pagination={false}
                columns={[
                  { title: '物料编号', dataIndex: 'material_code', width: 120 },
                  { title: '物料名称', dataIndex: 'material_name', width: 150 },
                  { title: '单位', dataIndex: 'material_unit', width: 60 },
                  { title: '数量', dataIndex: 'notice_quantity', width: 90, align: 'right' },
                  { title: '单价', dataIndex: 'unit_price', width: 90, align: 'right' },
                ]}
              />
            );
          }}
        </AntForm.Item>
        <ShipmentNoticeFormSummary />
      </ProFormItem>
      <ProFormTextArea name="notes" label="备注" placeholder="备注" fieldProps={{ rows: 2 }} colProps={{ span: 24 }} />
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
          footer={() => (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <Button type="dashed" icon={<PlusOutlined />} onClick={() => setImportVisible(true)}>
                导入
              </Button>
            </div>
          )}
        />
      </ListPageTemplate>

      <DetailDrawerTemplate
        title={`发货通知单详情${noticeDetail?.notice_code ? ` - ${noticeDetail.notice_code}` : ''}`}
        open={detailDrawerVisible}
        onClose={() => { setDetailDrawerVisible(false); setNoticeDetail(null); }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={detailColumns}
        dataSource={noticeDetail || {}}
      >
        {noticeDetail?.items && noticeDetail.items.length > 0 && (
          <Table
            size="small"
            rowKey={(record: any) => record.id || record.material_code}
            columns={[
              { title: '物料编号', dataIndex: 'material_code', width: 120 },
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
        onClose={() => { setCreateModalVisible(false); setEffectiveRuleCode(null); }}
        formRef={formRef}
        onFinish={handleCreateSubmit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        grid={false}
        initialValues={{ items: [defaultNoticeItem] }}
      >
        {renderCreateForm()}
      </FormModalTemplate>

      <FormModalTemplate
        title="编辑发货通知单"
        open={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        formRef={formRef}
        onFinish={handleEditSubmit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        grid={false}
      >
        {renderEditForm()}
      </FormModalTemplate>

      <MaterialBatchPickerModal
        open={materialPickerOpen}
        onCancel={() => setMaterialPickerOpen(false)}
        onConfirm={(selected) => {
          appendShipmentNoticeItemsFromMaterials(selected);
          setMaterialPickerOpen(false);
        }}
      />

      <UniImport
        visible={importVisible}
        onCancel={() => setImportVisible(false)}
        onConfirm={handleExcelImport}
        title="导入通知明细"
        headers={['物料编号', '数量', '单价', '物料名称', '规格', '单位']}
        exampleRow={['MT001', '10', '15.5', '示例物料', '规格X', '件']}
      />
    </>
  );
};

export default ShipmentNoticesPage;
