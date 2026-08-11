/**
 * 售后服务工单新建/编辑弹窗（表头 + UniTableDetail 明细）
 * 明细仅允许从关联销售订单勾选追加，禁止随意选物料。
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  App,
  Button,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Table,
  Typography,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { FormModalTemplate, MODAL_CONFIG } from '../../../components/layout-templates';
import { UniDropdown } from '../../../components/uni-dropdown';
import { UniTableDetail } from '../../../components/uni-table-detail';
import {
  DOCUMENT_DETAIL_COL_WIDTH,
  DOCUMENT_DETAIL_CONTROL_SIZE,
  DOCUMENT_DETAIL_NUM_COL,
  DOCUMENT_DETAIL_TEXT_COL,
  DocumentDetailTableStyles,
} from './document-detail-table/documentDetailTable';
import {
  AFTER_SALES_REQUEST_TYPES,
  AFTER_SALES_TICKET_STATUSES,
  afterSalesTicketApi,
  type AfterSalesTicket,
  type AfterSalesTicketItemPayload,
} from '../services/after-sales-ticket';
import {
  getSalesOrder,
  listSalesOrders,
  type SalesOrder,
  type SalesOrderItem,
} from '../services/sales-order';
import { customerApi, unwrapSupplyPagedList } from '../../master-data/services/supply-chain';
import type { Customer } from '../../master-data/types/supply-chain';
import { formatApiErrorDetail } from '../../../services/api';
import { formatDateTimeBySiteSetting } from '../../../utils/format';

const getCustomerId = (c: any): number | null => {
  const id = Number(c?.id ?? c?.customer_id);
  return Number.isFinite(id) ? id : null;
};

const getCustomerName = (c: any): string => {
  const code = String(c?.code ?? c?.customer_code ?? '').trim();
  const name = String(c?.name ?? c?.customer_name ?? '').trim();
  return `${code} ${name}`.trim();
};

const mapItemsPayload = (items: any[]): AfterSalesTicketItemPayload[] =>
  (Array.isArray(items) ? items : [])
    .map((row) => {
      const materialId = row?.material_id != null ? Number(row.material_id) : null;
      const materialCode = String(row?.material_code ?? '').trim() || null;
      const materialName = String(row?.material_name ?? '').trim() || null;
      if (materialId == null && !materialCode && !materialName) return null;
      return {
        material_id: Number.isFinite(materialId as number) && (materialId as number) > 0 ? materialId : null,
        material_code: materialCode,
        material_name: materialName,
        material_spec: String(row?.material_spec ?? '').trim() || null,
        material_unit: String(row?.material_unit ?? '').trim() || null,
        sales_order_item_id:
          row?.sales_order_item_id != null && Number(row.sales_order_item_id) > 0
            ? Number(row.sales_order_item_id)
            : null,
        sales_delivery_item_id:
          row?.sales_delivery_item_id != null && Number(row.sales_delivery_item_id) > 0
            ? Number(row.sales_delivery_item_id)
            : null,
        batch_no: String(row?.batch_no ?? '').trim() || null,
        quantity: row?.quantity != null && row.quantity !== '' ? Number(row.quantity) : null,
        claim_amount: row?.claim_amount != null && row.claim_amount !== '' ? Number(row.claim_amount) : null,
        notes: String(row?.notes ?? '').trim() || null,
      };
    })
    .filter(Boolean) as AfterSalesTicketItemPayload[];

const sourceItemQuantity = (it: SalesOrderItem): number => {
  const candidates = [
    it.delivered_quantity,
    it.order_quantity,
    it.required_quantity,
    it.remaining_quantity,
  ];
  for (const raw of candidates) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 1;
};

const toAfterSalesItemRow = (it: SalesOrderItem) => ({
  material_id: it.material_id != null ? Number(it.material_id) : undefined,
  material_code: it.material_code ?? undefined,
  material_name: it.material_name ?? undefined,
  material_spec: it.material_spec ?? undefined,
  material_unit: it.material_unit ?? undefined,
  sales_order_item_id: it.id != null ? Number(it.id) : undefined,
  sales_delivery_item_id: undefined as number | undefined,
  batch_no: undefined as string | undefined,
  quantity: sourceItemQuantity(it),
  claim_amount: undefined as number | undefined,
  notes: undefined as string | undefined,
});

export type AfterSalesTicketPreset = {
  customer_id: number;
  sales_order_id?: number;
  sales_order_code?: string;
};

export interface AfterSalesTicketFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editing?: AfterSalesTicket | null;
  preset?: AfterSalesTicketPreset | null;
}

export const AfterSalesTicketFormModal: React.FC<AfterSalesTicketFormModalProps> = ({
  open,
  onClose,
  onSuccess,
  editing = null,
  preset = null,
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const modalCustomerId = Form.useWatch('customer_id', form);
  const modalSalesOrderId = Form.useWatch('sales_order_id', form);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [salesOrderList, setSalesOrderList] = useState<SalesOrder[]>([]);
  const [docListsLoading, setDocListsLoading] = useState(false);
  const [salesOrderDropdownOpen, setSalesOrderDropdownOpen] = useState(false);
  const salesOrderOptionsCacheRef = useRef<Map<number, SalesOrder[]>>(new Map());
  const prevSalesOrderIdRef = useRef<number | null | undefined>(undefined);

  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [itemPickerLoading, setItemPickerLoading] = useState(false);
  const [sourceOrderItems, setSourceOrderItems] = useState<SalesOrderItem[]>([]);
  const [selectedSourceItemKeys, setSelectedSourceItemKeys] = useState<React.Key[]>([]);

  useEffect(() => {
    if (!open) return;
    void customerApi
      .list({ limit: 1000, isActive: true })
      .then((res) => setCustomers(unwrapSupplyPagedList(res)))
      .catch(() => setCustomers([]));
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSalesOrderList([]);
      setDocListsLoading(false);
      setSalesOrderDropdownOpen(false);
      setItemPickerOpen(false);
      setSourceOrderItems([]);
      setSelectedSourceItemKeys([]);
      prevSalesOrderIdRef.current = undefined;
      return;
    }
    if (editing) {
      form.setFieldsValue({
        customer_id: editing.customer_id,
        request_type: editing.request_type,
        status: editing.status,
        content: editing.content,
        resolution: editing.resolution ?? undefined,
        registered_at: editing.registered_at ? dayjs(editing.registered_at) : dayjs(),
        sales_order_id: editing.sales_order_id ?? undefined,
        items: (editing.items ?? []).map((it) => ({
          material_id: it.material_id ?? undefined,
          material_code: it.material_code ?? undefined,
          material_name: it.material_name ?? undefined,
          material_spec: it.material_spec ?? undefined,
          material_unit: it.material_unit ?? undefined,
          sales_order_item_id: it.sales_order_item_id ?? undefined,
          sales_delivery_item_id: it.sales_delivery_item_id ?? undefined,
          batch_no: it.batch_no ?? undefined,
          quantity: it.quantity != null ? Number(it.quantity) : undefined,
          claim_amount: it.claim_amount != null ? Number(it.claim_amount) : undefined,
          notes: it.notes ?? undefined,
        })),
      });
      return;
    }
    form.setFieldsValue({
      customer_id: preset?.customer_id,
      request_type: '退货',
      status: '待处理',
      content: undefined,
      resolution: undefined,
      registered_at: dayjs(),
      sales_order_id: preset?.sales_order_id,
      items: [],
    });
  }, [open, form, editing, preset]);

  useEffect(() => {
    if (!open || !salesOrderDropdownOpen || modalCustomerId == null) {
      if (!open || modalCustomerId == null) setSalesOrderList([]);
      return;
    }
    const customerId = Number(modalCustomerId);
    if (!Number.isFinite(customerId) || customerId <= 0) {
      setSalesOrderList([]);
      return;
    }
    const cached = salesOrderOptionsCacheRef.current.get(customerId);
    if (cached) {
      setSalesOrderList(cached);
      return;
    }
    let cancelled = false;
    setDocListsLoading(true);
    void listSalesOrders({
      customer_id: customerId,
      limit: 100,
      order_by: '-order_date',
      view: 'options',
    })
      .then((res) => {
        if (cancelled) return;
        const rows = res?.data ?? [];
        salesOrderOptionsCacheRef.current.set(customerId, rows);
        setSalesOrderList(rows);
      })
      .catch(() => {
        if (!cancelled) setSalesOrderList([]);
      })
      .finally(() => {
        if (!cancelled) setDocListsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, salesOrderDropdownOpen, modalCustomerId]);

  useEffect(() => {
    if (!open) return;
    const soId =
      modalSalesOrderId != null && Number(modalSalesOrderId) > 0 ? Number(modalSalesOrderId) : null;
    if (prevSalesOrderIdRef.current === undefined) {
      prevSalesOrderIdRef.current = soId;
      return;
    }
    if (prevSalesOrderIdRef.current !== soId) {
      form.setFieldsValue({ items: [] });
      prevSalesOrderIdRef.current = soId;
    }
  }, [open, modalSalesOrderId, form]);

  const salesOrderOptions = useMemo(() => {
    const options = salesOrderList
      .filter((o) => o.id != null && Number(o.customer_id) === Number(modalCustomerId))
      .map((o) => ({
        label: String(o.order_code || o.id),
        value: Number(o.id),
      }));
    const extraId = editing?.sales_order_id ?? preset?.sales_order_id;
    const extraLabel = editing?.sales_order_code ?? preset?.sales_order_code;
    if (
      extraId != null &&
      Number(editing?.customer_id ?? preset?.customer_id) === Number(modalCustomerId) &&
      !options.some((o) => o.value === Number(extraId))
    ) {
      options.unshift({
        value: Number(extraId),
        label: String(extraLabel || extraId),
      });
    }
    return options;
  }, [
    salesOrderList,
    modalCustomerId,
    editing?.sales_order_id,
    editing?.sales_order_code,
    editing?.customer_id,
    preset?.sales_order_id,
    preset?.sales_order_code,
    preset?.customer_id,
  ]);

  const openSalesOrderItemPicker = async () => {
    const soId = Number(modalSalesOrderId);
    if (!Number.isFinite(soId) || soId <= 0) {
      message.warning(t('app.kuaizhizao.afterSalesTicket.selectSalesOrderFirst'));
      return;
    }
    setItemPickerOpen(true);
    setItemPickerLoading(true);
    setSelectedSourceItemKeys([]);
    setSourceOrderItems([]);
    try {
      const detail = await getSalesOrder(soId, true, false, { view: 'options' });
      const currentItems = (form.getFieldValue('items') ?? []) as Array<{ sales_order_item_id?: number }>;
      const used = new Set(
        currentItems
          .map((r) => Number(r?.sales_order_item_id))
          .filter((id) => Number.isFinite(id) && id > 0),
      );
      const rows = (detail.items ?? []).filter((it) => {
        const id = Number(it.id);
        return Number.isFinite(id) && id > 0 && !used.has(id);
      });
      setSourceOrderItems(rows);
      if (!rows.length) {
        message.warning(t('app.kuaizhizao.afterSalesTicket.noSelectableSalesOrderItems'));
      }
    } catch (e: any) {
      message.error(e?.message || t('app.kuaizhizao.afterSalesTicket.loadSalesOrderItemsFailed'));
      setItemPickerOpen(false);
    } finally {
      setItemPickerLoading(false);
    }
  };

  const confirmSalesOrderItemPicker = () => {
    if (!selectedSourceItemKeys.length) {
      message.warning(t('app.kuaizhizao.afterSalesTicket.selectSalesOrderItems'));
      return;
    }
    // Table rowKey 为 String(id)，selectedRowKeys 可能是 string；统一按字符串匹配
    const selectedKeySet = new Set(selectedSourceItemKeys.map(String));
    const selected = sourceOrderItems.filter((it) => selectedKeySet.has(String(it.id)));
    if (!selected.length) {
      message.warning(t('app.kuaizhizao.afterSalesTicket.selectSalesOrderItems'));
      return;
    }
    const current = Array.isArray(form.getFieldValue('items')) ? [...form.getFieldValue('items')] : [];
    form.setFieldsValue({
      items: [...current, ...selected.map((it) => toAfterSalesItemRow(it))],
    });
    setItemPickerOpen(false);
    setSelectedSourceItemKeys([]);
    setSourceOrderItems([]);
  };

  const itemColumns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.afterSalesTicket.fieldMaterial'),
        dataIndex: 'material_id',
        width: DOCUMENT_DETAIL_COL_WIDTH.material,
        ...DOCUMENT_DETAIL_TEXT_COL,
        render: (_: unknown, __: unknown, index: number) => (
          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev?.items?.[index] !== curr?.items?.[index]}
          >
            {({ getFieldValue }) => {
              const row = getFieldValue('items')?.[index];
              const label =
                `${row?.material_code || ''} ${row?.material_name || ''}`.trim() ||
                (row?.material_id != null ? String(row.material_id) : '—');
              return (
                <div className="uni-detail-material-cell">
                  <Typography.Text ellipsis={{ tooltip: label }}>{label}</Typography.Text>
                  <Form.Item name={[index, 'material_id']} hidden />
                  <Form.Item name={[index, 'material_code']} hidden />
                  <Form.Item name={[index, 'material_name']} hidden />
                  <Form.Item name={[index, 'material_spec']} hidden />
                  <Form.Item name={[index, 'material_unit']} hidden />
                  <Form.Item name={[index, 'sales_order_item_id']} hidden />
                  <Form.Item name={[index, 'sales_delivery_item_id']} hidden />
                </div>
              );
            }}
          </Form.Item>
        ),
      },
      {
        title: t('app.kuaizhizao.afterSalesTicket.fieldBatchNo'),
        dataIndex: 'batch_no',
        width: 140,
        ...DOCUMENT_DETAIL_TEXT_COL,
        render: (_: unknown, __: unknown, index: number) => (
          <Form.Item name={[index, 'batch_no']} noStyle>
            <Input size={DOCUMENT_DETAIL_CONTROL_SIZE} allowClear />
          </Form.Item>
        ),
      },
      {
        title: t('app.kuaizhizao.afterSalesTicket.fieldQuantity'),
        dataIndex: 'quantity',
        width: DOCUMENT_DETAIL_COL_WIDTH.quantity,
        ...DOCUMENT_DETAIL_NUM_COL,
        render: (_: unknown, __: unknown, index: number) => (
          <Form.Item name={[index, 'quantity']} noStyle>
            <InputNumber size={DOCUMENT_DETAIL_CONTROL_SIZE} style={{ width: '100%' }} min={0} />
          </Form.Item>
        ),
      },
      {
        title: t('app.kuaizhizao.afterSalesTicket.fieldClaimAmount'),
        dataIndex: 'claim_amount',
        width: DOCUMENT_DETAIL_COL_WIDTH.unitPrice,
        ...DOCUMENT_DETAIL_NUM_COL,
        render: (_: unknown, __: unknown, index: number) => (
          <Form.Item name={[index, 'claim_amount']} noStyle>
            <InputNumber
              size={DOCUMENT_DETAIL_CONTROL_SIZE}
              style={{ width: '100%' }}
              min={0}
              precision={2}
              prefix="¥"
            />
          </Form.Item>
        ),
      },
      {
        title: t('app.kuaizhizao.afterSalesTicket.fieldLineNotes'),
        dataIndex: 'notes',
        width: 180,
        ...DOCUMENT_DETAIL_TEXT_COL,
        render: (_: unknown, __: unknown, index: number) => (
          <Form.Item name={[index, 'notes']} noStyle>
            <Input size={DOCUMENT_DETAIL_CONTROL_SIZE} allowClear />
          </Form.Item>
        ),
      },
    ],
    [t],
  );

  const sourceItemColumns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.afterSalesTicket.fieldMaterialCode'),
        dataIndex: 'material_code',
        width: 140,
        ellipsis: true,
        render: (_: unknown, row: SalesOrderItem) => row.material_code || '—',
      },
      {
        title: t('app.kuaizhizao.afterSalesTicket.fieldMaterialName'),
        dataIndex: 'material_name',
        width: 200,
        ellipsis: true,
        render: (_: unknown, row: SalesOrderItem) => row.material_name || '—',
      },
      {
        title: t('app.kuaizhizao.afterSalesTicket.fieldQuantity'),
        dataIndex: 'order_quantity',
        width: 100,
        align: 'right' as const,
        render: (_: unknown, row: SalesOrderItem) =>
          String(row.order_quantity ?? row.required_quantity ?? '—'),
      },
      {
        title: t('app.kuaizhizao.afterSalesTicket.sourceDeliveredQty'),
        dataIndex: 'delivered_quantity',
        width: 100,
        align: 'right' as const,
        render: (_: unknown, row: SalesOrderItem) =>
          row.delivered_quantity != null ? String(row.delivered_quantity) : '—',
      },
    ],
    [t],
  );

  const handleFinish = async (v: Record<string, any>) => {
    const customerId = Number(v.customer_id);
    if (!Number.isFinite(customerId) || customerId <= 0) {
      message.error(t('app.kuaizhizao.afterSalesTicket.customerRequired'));
      throw new Error('customer_required');
    }
    const salesOrderId = Number(v.sales_order_id);
    if (!Number.isFinite(salesOrderId) || salesOrderId <= 0) {
      message.error(t('app.kuaizhizao.afterSalesTicket.selectSalesOrderFirst'));
      throw new Error('sales_order_required');
    }
    const registeredRaw = v.registered_at?.toDate?.() ?? v.registered_at;
    const registered = formatDateTimeBySiteSetting(registeredRaw, '');
    if (!registered) {
      message.error(t('common.required'));
      throw new Error('registered_at_required');
    }
    const items = mapItemsPayload(v.items ?? []);
    if (!items.length) {
      message.error(t('common.itemsRequired'));
      throw new Error('items_required');
    }
    if (items.some((it) => !it.sales_order_item_id)) {
      message.error(t('app.kuaizhizao.afterSalesTicket.itemsMustFromSalesOrder'));
      throw new Error('items_must_from_sales_order');
    }
    if (editing?.status === '已关闭') {
      message.error(t('app.kuaizhizao.afterSalesTicket.closedCannotEdit'));
      throw new Error('closed_cannot_edit');
    }
    const payload = {
      request_type: v.request_type,
      content: String(v.content ?? '').trim(),
      registered_at: registered,
      sales_order_id: salesOrderId,
      resolution: v.resolution?.trim() || null,
      status: v.status,
      items,
    };
    try {
      if (editing) {
        await afterSalesTicketApi.update(editing.id, payload);
        message.success(t('pages.system.siteSettings.saveSuccess'));
      } else {
        await afterSalesTicketApi.create({
          customer_id: customerId,
          request_type: payload.request_type,
          content: payload.content,
          registered_at: payload.registered_at,
          sales_order_id: payload.sales_order_id,
          items: payload.items,
        });
        message.success(t('common.createSuccess'));
      }
    } catch (e: any) {
      message.error(
        formatApiErrorDetail(e?.response?.data?.detail) ||
          e?.message ||
          t('common.operationFailed'),
      );
      throw e;
    }
    onClose();
    onSuccess?.();
  };

  return (
    <>
      <FormModalTemplate
        title={
          editing
            ? t('app.kuaizhizao.afterSalesTicket.editTitle')
            : t('app.kuaizhizao.afterSalesTicket.createTitle')
        }
        open={open}
        onClose={onClose}
        onFinish={handleFinish}
        isEdit={!!editing}
        width={MODAL_CONFIG.LARGE_WIDTH}
        form={form}
      >
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name="customer_id"
              label={t('app.kuaizhizao.afterSalesTicket.fieldCustomer')}
              rules={[{ required: true, message: t('common.required') }]}
            >
              <UniDropdown
                showSearch
                optionFilterProp="label"
                options={customers
                  .map((c) => {
                    const id = getCustomerId(c);
                    if (id == null) return null;
                    return { label: getCustomerName(c), value: id };
                  })
                  .filter(Boolean) as { label: string; value: number }[]}
                onChange={() => {
                  form.setFieldsValue({ sales_order_id: undefined, items: [] });
                  prevSalesOrderIdRef.current = null;
                }}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="request_type"
              label={t('app.kuaizhizao.afterSalesTicket.fieldRequestType')}
              rules={[{ required: true, message: t('common.required') }]}
            >
              <Select
                options={AFTER_SALES_REQUEST_TYPES.map((v) => ({ label: v, value: v }))}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="registered_at"
              label={t('app.kuaizhizao.afterSalesTicket.fieldRegisteredAt')}
              rules={[{ required: true, message: t('common.required') }]}
            >
              <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="sales_order_id"
              label={t('app.kuaizhizao.afterSalesTicket.fieldSalesOrder')}
              rules={[{ required: true, message: t('app.kuaizhizao.afterSalesTicket.selectSalesOrderFirst') }]}
            >
              <UniDropdown
                allowClear
                showSearch
                optionFilterProp="label"
                loading={docListsLoading}
                disabled={modalCustomerId == null}
                placeholder={
                  modalCustomerId == null
                    ? t('app.kuaizhizao.afterSalesTicket.selectCustomerFirst')
                    : t('app.kuaizhizao.afterSalesTicket.selectSalesOrderFirst')
                }
                options={salesOrderOptions}
                onOpenChange={setSalesOrderDropdownOpen}
              />
            </Form.Item>
          </Col>
          {editing ? (
            <Col xs={24} md={12}>
              <Form.Item name="status" label={t('app.kuaizhizao.afterSalesTicket.fieldStatus')}>
                <Select
                  options={AFTER_SALES_TICKET_STATUSES.filter((s) => s !== '已关闭').map((v) => ({
                    label: v,
                    value: v,
                  }))}
                />
              </Form.Item>
            </Col>
          ) : null}
        </Row>

        <DocumentDetailTableStyles />
        <UniTableDetail
          name="items"
          title={t('app.kuaizhizao.afterSalesTicket.itemsTitle')}
          columns={itemColumns}
          disabledAdd
          headerExtra={
            <Button type="default" icon={<PlusOutlined />} onClick={() => void openSalesOrderItemPicker()}>
              {t('common.addDetail')}
            </Button>
          }
        />

        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col span={24}>
            <Form.Item
              name="content"
              label={t('app.kuaizhizao.afterSalesTicket.fieldContent')}
              rules={[{ required: true, message: t('common.required') }]}
            >
              <Input.TextArea rows={3} maxLength={2000} showCount />
            </Form.Item>
          </Col>
          {editing ? (
            <Col span={24}>
              <Form.Item name="resolution" label={t('app.kuaizhizao.afterSalesTicket.fieldResolution')}>
                <Input.TextArea rows={2} maxLength={2000} showCount />
              </Form.Item>
            </Col>
          ) : null}
        </Row>
      </FormModalTemplate>

      <Modal
        title={t('app.kuaizhizao.afterSalesTicket.pickSalesOrderItemsTitle')}
        open={itemPickerOpen}
        onCancel={() => {
          setItemPickerOpen(false);
          setSelectedSourceItemKeys([]);
          setSourceOrderItems([]);
        }}
        onOk={confirmSalesOrderItemPicker}
        okButtonProps={{ disabled: selectedSourceItemKeys.length === 0 }}
        width={860}
        destroyOnClose
        zIndex={1100}
      >
        <Table<SalesOrderItem>
          size="small"
          rowKey={(r) => String(r.id)}
          loading={itemPickerLoading}
          columns={sourceItemColumns}
          dataSource={sourceOrderItems}
          pagination={false}
          scroll={{ y: 360 }}
          rowSelection={{
            selectedRowKeys: selectedSourceItemKeys,
            onChange: setSelectedSourceItemKeys,
          }}
          locale={{
            emptyText: t('app.kuaizhizao.afterSalesTicket.noSelectableSalesOrderItems'),
          }}
        />
      </Modal>
    </>
  );
};
