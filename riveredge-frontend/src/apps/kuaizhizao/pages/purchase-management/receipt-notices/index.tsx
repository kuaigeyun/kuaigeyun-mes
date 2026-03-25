/**
 * 收货通知单管理页面
 *
 * 采购通知仓库收货，不直接动库存。来源为采购订单。
 * 行为与发货通知单对齐：ProForm、Row/Col、Form.List、编码规则、UniWarehouseSelect、UniMaterialSelect。
 *
 * @author RiverEdge Team
 * @date 2026-02-22
 */

import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProForm, ProFormText, ProFormDatePicker, ProFormTextArea, ProFormItem } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Table, Form as AntForm, Select, InputNumber, Input, DatePicker, Row, Col } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, SendOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import { ListPageTemplate, DetailDrawerTemplate, FormModalTemplate, DRAWER_CONFIG, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { receiptNoticeApi } from '../../../services/receipt-notice';
import { getReceiptNoticeLifecycle } from '../../../utils/receiptNoticeLifecycle';
import { listPurchaseOrders, getPurchaseOrder } from '../../../services/purchase';
import { testGenerateCode, generateCode, getCodeRulePageConfig } from '../../../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';

interface ReceiptNotice {
  id?: number;
  notice_code?: string;
  purchase_order_id?: number;
  purchase_order_code?: string;
  supplier_id?: number;
  supplier_name?: string;
  supplier_contact?: string;
  supplier_phone?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  planned_receipt_date?: string;
  status?: string;
  notified_at?: string;
  purchase_receipt_id?: number;
  purchase_receipt_code?: string;
  total_quantity?: number;
  total_amount?: number;
  notes?: string;
  created_at?: string;
}

interface ReceiptNoticeDetail extends ReceiptNotice {
  items?: { id?: number; material_code: string; material_name: string; material_unit: string; notice_quantity: number; unit_price?: number; total_amount?: number }[];
}

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  待收货: { text: '待收货', color: 'default' },
  已通知: { text: '已通知', color: 'processing' },
  已入库: { text: '已入库', color: 'success' },
};

const defaultReceiptItem = { material_id: undefined, material_code: '', material_name: '', material_unit: '件', notice_quantity: 1, unit_price: 0 };

const ReceiptNoticesPage: React.FC = () => {
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [noticeDetail, setNoticeDetail] = useState<ReceiptNoticeDetail | null>(null);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const formRef = useRef<any>(null);
  const [purchaseOrderList, setPurchaseOrderList] = useState<any[]>([]);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [effectiveRuleCode, setEffectiveRuleCode] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const ordersRes = await listPurchaseOrders({ limit: 500 }).catch(() => ({ data: [], total: 0 }));
        setPurchaseOrderList(ordersRes?.data || []);
      } catch (e) {
        console.error('加载采购订单失败', e);
      }
    };
    load();
  }, []);

  const columns: ProColumns<ReceiptNotice>[] = [
    { title: '通知单号', dataIndex: 'notice_code', width: 140, ellipsis: true, fixed: 'left' },
    { title: '采购订单号', dataIndex: 'purchase_order_code', width: 140, ellipsis: true },
    { title: '供应商', dataIndex: 'supplier_name', width: 140, ellipsis: true },
    { title: '入库仓库', dataIndex: 'warehouse_name', width: 120 },
    {
      title: '生命周期',
      dataIndex: 'lifecycle',
      width: 100,
      render: (_, record) => {
        const lifecycle = getReceiptNoticeLifecycle(record);
        const stageName = lifecycle.stageName ?? record.status ?? '待收货';
        const c = STATUS_MAP[stageName] || { text: stageName || '-', color: 'default' };
        return <Tag color={c.color}>{c.text}</Tag>;
      },
    },
    { title: '计划收货日期', dataIndex: 'planned_receipt_date', valueType: 'date', width: 120 },
    { title: '通知时间', dataIndex: 'notified_at', valueType: 'dateTime', width: 160 },
    { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime', width: 160 },
    {
      title: '操作',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>详情</Button>
          {record.status === '待收货' && (
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

  const handleDetail = async (record: ReceiptNotice) => {
    try {
      const detail = await receiptNoticeApi.get(record.id!.toString());
      setNoticeDetail(detail as ReceiptNoticeDetail);
      setDetailDrawerVisible(true);
    } catch {
      messageApi.error('获取收货通知单详情失败');
    }
  };

  const handleEdit = async (record: ReceiptNotice) => {
    try {
      const detail = await receiptNoticeApi.get(record.id!.toString()) as ReceiptNoticeDetail;
      const itemsForm = (detail.items || []).map((it: any) => ({
        material_id: it.material_id,
        material_code: it.material_code || '',
        material_name: it.material_name || '',
        material_unit: it.material_unit || '件',
        notice_quantity: Number(it.notice_quantity) || 0,
        unit_price: Number(it.unit_price) || 0,
      }));
      formRef.current?.setFieldsValue({
        purchase_order_id: detail.purchase_order_id,
        purchase_order_code: detail.purchase_order_code,
        supplier_id: detail.supplier_id,
        supplier_name: detail.supplier_name,
        supplier_contact: detail.supplier_contact,
        supplier_phone: detail.supplier_phone,
        warehouse_id: detail.warehouse_id,
        warehouse_name: detail.warehouse_name,
        planned_receipt_date: detail.planned_receipt_date ? dayjs(detail.planned_receipt_date) : undefined,
        notes: detail.notes,
        items: itemsForm.length ? itemsForm : [defaultReceiptItem],
      });
      setEditingId(record.id!);
      setEditModalVisible(true);
    } catch {
      messageApi.error('获取详情失败');
    }
  };

  const handleNotify = (record: ReceiptNotice) => {
    Modal.confirm({
      title: '通知仓库',
      content: `确定要通知仓库收货「${record.notice_code}」吗？将同步生成一张「草稿」状态的采购入库单，仓库可在采购入库中核对后确认入库。`,
      onOk: async () => {
        try {
          const res = (await receiptNoticeApi.notify(record.id!.toString())) as ReceiptNotice;
          messageApi.success(
            res?.purchase_receipt_code
              ? `已通知仓库，已生成采购入库草稿：${res.purchase_receipt_code}`
              : '已通知仓库',
          );
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '通知失败');
        }
      },
    });
  };

  const handleDelete = (record: ReceiptNotice) => {
    Modal.confirm({
      title: '删除收货通知单',
      content: `确定要删除 "${record.notice_code}" 吗？`,
      onOk: async () => {
        try {
          await receiptNoticeApi.delete(record.id!.toString());
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
      content: `确定要删除选中的 ${keys.length} 条收货通知单吗？`,
      onOk: async () => {
        try {
          for (const k of keys) {
            await receiptNoticeApi.delete(String(k));
          }
          messageApi.success(`已删除 ${keys.length} 条收货通知单`);
          setSelectedRowKeys([]);
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
      formRef.current?.setFieldsValue({ items: [defaultReceiptItem] });
    }, 100);
    let ruleCode = getPageRuleCode('kuaizhizao-receipt-notice');
    let autoGenerate = isAutoGenerateEnabled('kuaizhizao-receipt-notice');
    try {
      const pageConfig = await getCodeRulePageConfig('kuaizhizao-receipt-notice');
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
            formRef.current?.setFieldsValue({ notice_code: preview ?? '', items: [defaultReceiptItem] });
          }, 100);
        })
        .catch((e) => {
          console.warn('收货通知单编码预生成失败:', e);
          setPreviewCode(null);
        });
    } else {
      setPreviewCode(null);
    }
  };

  const onPurchaseOrderSelect = async (orderId: number) => {
    let order = purchaseOrderList.find((o: any) => (o.id ?? o.purchase_order_id) === orderId);
    if (!order) return;
    try {
      const detail = await getPurchaseOrder(orderId);
      order = detail;
    } catch {
      // use list data
    }
    const code = order.order_code || order.purchase_order_code || order.code;
    formRef.current?.setFieldsValue({
      purchase_order_code: code,
      supplier_id: order.supplier_id,
      supplier_name: order.supplier_name,
      supplier_contact: order.supplier_contact,
      supplier_phone: order.supplier_phone,
    });
    if (order.items && order.items.length > 0) {
      const items = order.items.map((it: any) => ({
        material_id: it.material_id ?? it.materialId,
        material_code: it.material_code || it.materialCode || '',
        material_name: it.material_name || it.materialName || '',
        material_unit: it.unit || it.material_unit || it.materialUnit || '件',
        notice_quantity: Number(it.ordered_quantity ?? it.quantity) || 0,
        unit_price: Number(it.unit_price ?? it.unitPrice) || 0,
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
    if (!values.purchase_order_id || !values.purchase_order_code) {
      messageApi.error('请选择采购订单');
      throw new Error('请选择采购订单');
    }
    const supplier = purchaseOrderList.find((o: any) => (o.id ?? o.purchase_order_id) === values.purchase_order_id) || {};
    let noticeCode = values.notice_code;
    const ruleCodeToUse = effectiveRuleCode || getPageRuleCode('kuaizhizao-receipt-notice');
    if (
      ruleCodeToUse &&
      (isAutoGenerateEnabled('kuaizhizao-receipt-notice') || effectiveRuleCode) &&
      (noticeCode === previewCode || !noticeCode)
    ) {
      try {
        const res = await generateCode({ rule_code: ruleCodeToUse });
        noticeCode = res.code;
      } catch (e) {
        console.warn('收货通知单编码正式生成失败，使用当前值:', e);
      }
    }
    try {
      await receiptNoticeApi.create({
        notice_code: noticeCode || undefined,
        purchase_order_id: values.purchase_order_id,
        purchase_order_code: values.purchase_order_code,
        supplier_id: values.supplier_id ?? supplier.supplier_id,
        supplier_name: values.supplier_name ?? supplier.supplier_name,
        supplier_contact: values.supplier_contact,
        supplier_phone: values.supplier_phone,
        warehouse_id: values.warehouse_id,
        warehouse_name: values.warehouse_name,
        planned_receipt_date: values.planned_receipt_date ? dayjs(values.planned_receipt_date).format('YYYY-MM-DD') : undefined,
        notes: values.notes,
        items: validItems.map((it: any) => ({
          material_id: it.material_id,
          material_code: it.material_code,
          material_name: it.material_name,
          material_unit: it.material_unit || '件',
          notice_quantity: Number(it.notice_quantity) || 0,
          unit_price: it.unit_price || 0,
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
    try {
      await receiptNoticeApi.update(editingId.toString(), {
        supplier_contact: values.supplier_contact,
        supplier_phone: values.supplier_phone,
        warehouse_id: values.warehouse_id,
        warehouse_name: values.warehouse_name,
        planned_receipt_date: values.planned_receipt_date ? dayjs(values.planned_receipt_date).format('YYYY-MM-DD') : undefined,
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

  const detailColumns: ProDescriptionsItemProps<ReceiptNoticeDetail>[] = [
    { title: '通知单号', dataIndex: 'notice_code' },
    { title: '采购订单号', dataIndex: 'purchase_order_code' },
    { title: '供应商', dataIndex: 'supplier_name' },
    { title: '联系人', dataIndex: 'supplier_contact' },
    { title: '电话', dataIndex: 'supplier_phone' },
    { title: '入库仓库', dataIndex: 'warehouse_name' },
    { title: '计划收货日期', dataIndex: 'planned_receipt_date', valueType: 'date' },
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

  const renderCreateForm = () => (
    <>
      <Row gutter={16}>
        <Col span={12}>
          <ProFormText
            name="notice_code"
            label={
              <span>
                通知单号
                <a href="/system/code-rules" onClick={(e) => { e.preventDefault(); navigate('/system/code-rules'); }} style={{ marginLeft: 8, fontSize: 12 }}>编码规则设置</a>
              </span>
            }
            placeholder={isAutoGenerateEnabled('kuaizhizao-receipt-notice') ? '编码将根据编码规则自动生成，可修改' : '请输入通知单号'}
            rules={[{ required: true, message: '请输入通知单号' }]}
          />
        </Col>
        <Col span={12}>
          <ProForm.Item name="purchase_order_id" label="采购订单" rules={[{ required: true, message: '请选择采购订单' }]}>
            <Select
              placeholder="请选择采购订单"
              showSearch
              optionFilterProp="label"
              options={purchaseOrderList.map((o: any) => ({
                value: o.id ?? o.purchase_order_id,
                label: `${o.order_code || o.purchase_order_code || o.code || ''} - ${o.supplier_name || ''}`,
              }))}
              onChange={onPurchaseOrderSelect}
            />
          </ProForm.Item>
        </Col>
      </Row>
      <ProFormText name="purchase_order_code" hidden />
      <ProFormText name="supplier_id" hidden />
      <Row gutter={16}>
        <Col span={12}>
          <ProFormText name="supplier_name" label="供应商" placeholder="供应商名称" rules={[{ required: true, message: '请输入供应商' }]} />
        </Col>
        <Col span={12}>
          <ProFormText name="supplier_contact" label="联系人" placeholder="联系人" />
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <ProFormText name="supplier_phone" label="电话" placeholder="电话" />
        </Col>
        <Col span={12}>
          <UniWarehouseSelect
            name="warehouse_id"
            label="入库仓库"
            placeholder="请选择入库仓库"
            onChange={(val, wh) => formRef.current?.setFieldsValue({ warehouse_name: wh?.name ?? '' })}
          />
        </Col>
      </Row>
      <ProFormText name="warehouse_name" hidden />
      <Row gutter={16}>
        <Col span={12}>
          <ProFormDatePicker name="planned_receipt_date" label="计划收货日期" fieldProps={{ style: { width: '100%' } }} />
        </Col>
        <Col span={12} />
      </Row>
      <ProFormItem label="通知明细" required style={{ width: '100%' }}>
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
                              material_unit: 'baseUnit',
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
                      <Button type="dashed" icon={<PlusOutlined />} onClick={() => add(defaultReceiptItem)} block>添加明细</Button>
                    )}
                  />
                </div>
              );
            }}
          </AntForm.List>
        </ProForm.Item>
      </ProFormItem>
      <ProFormTextArea name="notes" label="备注" placeholder="备注" fieldProps={{ rows: 2 }} colProps={{ span: 24 }} />
    </>
  );

  const renderEditForm = () => (
    <>
      <Row gutter={16}>
        <Col span={12}>
          <ProFormText name="purchase_order_code" label="采购订单号" disabled />
        </Col>
        <Col span={12} />
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <ProFormText name="supplier_name" label="供应商" disabled />
        </Col>
        <Col span={12}>
          <ProFormText name="supplier_contact" label="联系人" placeholder="联系人" />
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <ProFormText name="supplier_phone" label="电话" placeholder="电话" />
        </Col>
        <Col span={12}>
          <UniWarehouseSelect
            name="warehouse_id"
            label="入库仓库"
            placeholder="请选择入库仓库"
            onChange={(val, wh) => formRef.current?.setFieldsValue({ warehouse_name: wh?.name ?? '' })}
          />
        </Col>
      </Row>
      <ProFormText name="warehouse_name" hidden />
      <Row gutter={16}>
        <Col span={12}>
          <ProFormDatePicker name="planned_receipt_date" label="计划收货日期" fieldProps={{ style: { width: '100%' } }} />
        </Col>
        <Col span={12} />
      </Row>
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
                  { title: '物料编码', dataIndex: 'material_code', width: 120 },
                  { title: '物料名称', dataIndex: 'material_name', width: 150 },
                  { title: '单位', dataIndex: 'material_unit', width: 60 },
                  { title: '数量', dataIndex: 'notice_quantity', width: 90, align: 'right' },
                  { title: '单价', dataIndex: 'unit_price', width: 90, align: 'right' },
                ]}
              />
            );
          }}
        </AntForm.Item>
      </ProFormItem>
      <ProFormTextArea name="notes" label="备注" placeholder="备注" fieldProps={{ rows: 2 }} colProps={{ span: 24 }} />
    </>
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable
          headerTitle="收货通知单"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          showCreateButton
          createButtonText="新建收货通知单"
          onCreate={handleCreate}
          enableRowSelection
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton
          onDelete={handleBatchDelete}
          request={async (params) => {
            try {
              const response = await receiptNoticeApi.list({
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                status: params.status,
                supplier_id: params.supplier_id,
                purchase_order_id: params.purchase_order_id,
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
        title={`收货通知单详情${noticeDetail?.notice_code ? ` - ${noticeDetail.notice_code}` : ''}`}
        open={detailDrawerVisible}
        onClose={() => { setDetailDrawerVisible(false); setNoticeDetail(null); }}
        width={DRAWER_CONFIG.HALF_WIDTH}
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
        title="新建收货通知单"
        open={createModalVisible}
        onClose={() => { setCreateModalVisible(false); setEffectiveRuleCode(null); }}
        formRef={formRef}
        onFinish={handleCreateSubmit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        grid={false}
        initialValues={{ items: [defaultReceiptItem] }}
      >
        {renderCreateForm()}
      </FormModalTemplate>

      <FormModalTemplate
        title="编辑收货通知单"
        open={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        formRef={formRef}
        onFinish={handleEditSubmit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        grid={false}
      >
        {renderEditForm()}
      </FormModalTemplate>
    </>
  );
};

export default ReceiptNoticesPage;
