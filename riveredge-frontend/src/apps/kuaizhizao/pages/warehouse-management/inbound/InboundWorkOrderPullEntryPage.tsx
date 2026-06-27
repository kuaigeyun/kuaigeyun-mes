/**
 * 从生产工单取单开入库单 — 独立 Tab 页（成品/半成品）
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { App, Button, Card, Col, DatePicker, Form, InputNumber, Row, Select, Space, Spin, Table, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  DOCUMENT_DETAIL_PAGE_TITLE_STYLE,
  DocumentFormPageLayout,
  PAGE_SPACING,
  WAREHOUSE_DETAIL_TABLE_STYLES,
} from '../../../../../components/layout-templates';
import { UniTableDetailHeader } from '../../../../../components/uni-table-detail/UniTableDetail';
import { warehouseApi as masterWarehouseApi } from '../../../../master-data/services/warehouse';
import { workOrderApi } from '../../../services/production';
import { warehouseApi } from '../../../services/warehouse-execution';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { setCustomPageTitle, removeCustomPageTitle } from '../../../../../utils/customPageTitle';
import { formatDateBySiteSetting } from '../../../../../utils/format';
import {
  InboundEntryReceiverField,
  InboundEntryRemarksSection,
  ReadOnlyFormValue,
  mapWarehouseSelectOptions,
  useInboundReceiverSelect,
} from './inboundEntryShared';
import { inboundReceiptTypeLabel } from './inboundHubTypes';
import { INBOUND_LIST_PATH, inboundWorkOrderEntryPath } from './inboundPaths';
import type { InboundReceiptType } from './inboundHubTypes';
import { draftDayjs, draftOptionalNumber, usePullEntryFormDraft } from '../shared/pullEntryFormDraft';
import { resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';

type PreviewLine = {
  material_id: number;
  material_code: string;
  material_name: string;
  material_spec?: string;
  material_unit: string;
  source_doc_quantity?: number;
  source_received_quantity?: number;
  source_pending_quantity?: number;
  receipt_quantity?: number;
};

type WorkOrderPreview = {
  work_order_id: number;
  work_order_code: string;
  inbound_doc_kind: 'finished_goods' | 'semi_finished_goods';
  lines: PreviewLine[];
  message?: string;
};

const InboundWorkOrderPullEntryPage: React.FC = () => {
  const { woId: woIdParam } = useParams<{ woId: string }>();
  const woId = Number(woIdParam);
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const { t } = useTranslation();
  const pullFromWorkOrderAction = resolveKuaizhizaoDocumentAction(t, 'inbound.pull_from_work_order');
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const receiverHook = useInboundReceiverSelect();
  const initRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<WorkOrderPreview | null>(null);
  const [workOrder, setWorkOrder] = useState<Record<string, unknown> | null>(null);
  const [warehouseOptions, setWarehouseOptions] = useState<{ label: string; value: number; name: string }[]>([]);
  const [receiptQty, setReceiptQty] = useState(0);
  const [warehouseId, setWarehouseId] = useState<number | undefined>();
  const [receiptTime, setReceiptTime] = useState(() => dayjs());
  const [receiptNotes, setReceiptNotes] = useState('');
  const { bindSnapshot, persistNow, clearDraft, applyDraftOnce } = usePullEntryFormDraft(
    'kuaizhizao:inbound-work-order-pull',
  );

  const line = preview?.lines?.[0];
  const receiptType: InboundReceiptType = preview?.inbound_doc_kind ?? 'finished_goods';
  const inboundTypeLabel = inboundReceiptTypeLabel(t, receiptType);
  const pagePath = Number.isFinite(woId) && woId > 0 ? inboundWorkOrderEntryPath(woId) : INBOUND_LIST_PATH;
  const maxQty = Number(line?.source_pending_quantity ?? 0);
  const pageTitle = preview?.work_order_code
    ? `${pullFromWorkOrderAction.label} — ${preview.work_order_code}`
    : pullFromWorkOrderAction.label;

  const leavePage = useCallback(() => {
    clearDraft();
    navigate(INBOUND_LIST_PATH);
  }, [clearDraft, navigate]);

  useEffect(() => {
    bindSnapshot(() => ({
      receiptQty,
      warehouseId,
      receiptTime,
      receiptNotes,
      receiverUuid: receiverHook.receiverUuid,
      receiverName: receiverHook.receiverName,
    }));
    persistNow();
  }, [
    receiptQty,
    warehouseId,
    receiptTime,
    receiptNotes,
    receiverHook.receiverUuid,
    receiverHook.receiverName,
    bindSnapshot,
    persistNow,
  ]);

  useEffect(() => {
    if (!(Number.isFinite(woId) && woId > 0)) {
      messageApi.error(t('app.kuaizhizao.warehouseInbound.entry.workOrder.invalid'));
      leavePage();
    }
  }, [woId, leavePage, messageApi, t]);

  useEffect(() => {
    setCustomPageTitle(pagePath, pageTitle);
    window.dispatchEvent(
      new CustomEvent('riveredge:update-tab-title', {
        detail: { key: pagePath, path: pagePath, title: pageTitle },
      }),
    );
    return () => {
      removeCustomPageTitle(pagePath);
    };
  }, [pagePath, pageTitle]);

  useEffect(() => {
    if (!Number.isFinite(woId) || woId <= 0 || initRef.current) return;
    initRef.current = true;
    void (async () => {
      setLoading(true);
      try {
        const [previewRaw, woRaw, whRes] = await Promise.all([
          warehouseApi.finishedGoodsReceipt.previewFromWorkOrder(woId) as Promise<WorkOrderPreview>,
          workOrderApi.get(String(woId)),
          masterWarehouseApi.list({ is_active: true, limit: 500 }),
        ]);
        if (!previewRaw?.lines?.length) {
          messageApi.warning(previewRaw?.message || t('app.kuaizhizao.warehouseInbound.entry.workOrder.noLines'));
          leavePage();
          return;
        }
        setWarehouseOptions(mapWarehouseSelectOptions(whRes));
        setPreview(previewRaw);
        setWorkOrder(woRaw as Record<string, unknown>);
        const firstLine = previewRaw.lines[0];
        setReceiptQty(Number(firstLine.receipt_quantity ?? firstLine.source_pending_quantity ?? 0));
        applyDraftOnce((draft) => {
          const qty = draftOptionalNumber(draft.receiptQty);
          if (qty != null) setReceiptQty(qty);
          const whId = draftOptionalNumber(draft.warehouseId);
          if (whId != null) setWarehouseId(whId);
          if (draft.receiptTime) setReceiptTime(draftDayjs(draft.receiptTime));
          if (typeof draft.receiptNotes === 'string') setReceiptNotes(draft.receiptNotes);
          receiverHook.restoreReceiver(
            typeof draft.receiverUuid === 'string' ? draft.receiverUuid : undefined,
            typeof draft.receiverName === 'string' ? draft.receiverName : undefined,
          );
        });
      } catch (e: unknown) {
        messageApi.error((e as Error)?.message || t('app.kuaizhizao.warehouseInbound.entry.workOrder.loadFailed'));
        leavePage();
      } finally {
        setLoading(false);
      }
    })();
  }, [woId, leavePage, messageApi, t, applyDraftOnce, receiverHook.restoreReceiver]);

  const submit = async (mode: 'draft' | 'confirm') => {
    if (!preview || !line) return;
    const qty = Number(receiptQty);
    if (!(qty > 0)) {
      messageApi.warning(t('app.kuaizhizao.warehouseInbound.entry.workOrder.fillReceiptQty'));
      return;
    }
    if (maxQty <= 0) {
      messageApi.error(t('app.kuaizhizao.warehouseInbound.entry.workOrder.noPendingQty'));
      return;
    }
    if (qty > maxQty) {
      messageApi.error(t('app.kuaizhizao.warehouseInbound.entry.workOrder.qtyExceedsPending', { max: maxQty }));
      return;
    }
    if (!warehouseId || !(warehouseId > 0)) {
      messageApi.error(t('app.kuaizhizao.warehouseInbound.entry.workOrder.selectWarehouse'));
      return;
    }
    const whOpt = warehouseOptions.find((o) => o.value === warehouseId);
    if (!whOpt) return;

    setSubmitting(true);
    try {
      let createdId: number | undefined;
      const headerPatch = {
        receipt_time: receiptTime?.toISOString(),
        receiver_name: receiverHook.receiverName.trim() || undefined,
        notes: receiptNotes.trim() || undefined,
      };

      if (receiptType === 'semi_finished_goods') {
        const created = (await warehouseApi.semiFinishedGoodsReceipt.create({
          work_order_id: woId,
          work_order_code: preview.work_order_code,
          sales_order_id: workOrder?.sales_order_id != null ? Number(workOrder.sales_order_id) : undefined,
          sales_order_code: workOrder?.sales_order_code ? String(workOrder.sales_order_code) : undefined,
          warehouse_id: warehouseId,
          warehouse_name: whOpt.name,
          status: '待入库',
          total_quantity: qty,
          ...headerPatch,
          items: [
            {
              material_id: line.material_id,
              material_code: line.material_code,
              material_name: line.material_name,
              material_spec: line.material_spec,
              material_unit: line.material_unit,
              receipt_quantity: qty,
              qualified_quantity: qty,
              unqualified_quantity: 0,
              quality_status: '合格',
              status: '待入库',
            },
          ],
        })) as { id?: number; receipt_code?: string };
        createdId = created?.id;
        if (mode === 'draft') {
          messageApi.success(
            t('app.kuaizhizao.warehouseInbound.entry.workOrder.semiDraftCreated', {
              code: created.receipt_code
                ? t('app.kuaizhizao.warehouseInbound.entry.purchase.draftCreatedSuffix', { code: created.receipt_code })
                : '',
            }),
          );
        }
      } else {
        const result = await warehouseApi.finishedGoodsReceipt.batchReceipt({
          work_order_ids: [woId],
          warehouse_id: warehouseId,
          warehouse_name: whOpt.name,
          receipt_quantity: qty,
        });
        const list = Array.isArray(result)
          ? result
          : (result as { data?: unknown[]; items?: unknown[] })?.data
            ?? (result as { items?: unknown[] })?.items
            ?? [];
        const created = (list[0] ?? {}) as { id?: number; receipt_code?: string };
        createdId = created.id;
        if (createdId != null) {
          await warehouseApi.finishedGoodsReceipt.update(String(createdId), {
            work_order_id: woId,
            work_order_code: preview.work_order_code,
            warehouse_id: warehouseId,
            warehouse_name: whOpt.name,
            status: '待入库',
            total_quantity: qty,
            ...headerPatch,
          });
        }
        if (mode === 'draft') {
          messageApi.success(
            t('app.kuaizhizao.warehouseInbound.entry.workOrder.finishedDraftCreated', {
              code: created.receipt_code
                ? t('app.kuaizhizao.warehouseInbound.entry.purchase.draftCreatedSuffix', { code: created.receipt_code })
                : '',
            }),
          );
        }
      }

      if (createdId == null) {
        messageApi.error(t('app.kuaizhizao.warehouseInbound.entry.purchase.noReceiptId'));
        return;
      }
      invalidateMenuBadgeCounts();
      clearDraft();
      if (mode === 'confirm') {
        navigate(INBOUND_LIST_PATH, {
          state: {
            inboundDirectConfirm: {
              id: Number(createdId),
              receipt_type: receiptType,
            },
          },
        });
      } else {
        leavePage();
      }
    } catch (e: unknown) {
      const err = e as { message?: string; response?: { data?: { detail?: string } } };
      messageApi.error(err?.message || err?.response?.data?.detail || t('app.kuaizhizao.warehouseInbound.msg.saveFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const entryColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.warehouseInbound.col.materialCode'), dataIndex: 'material_code', width: 120, ellipsis: true },
      { title: t('app.kuaizhizao.warehouseInbound.col.materialName'), dataIndex: 'material_name', width: 150, ellipsis: true },
      { title: t('app.kuaizhizao.warehouseInbound.col.spec'), dataIndex: 'material_spec', width: 120, ellipsis: true, render: (v: unknown) => v || '—' },
      { title: t('app.kuaizhizao.warehouseInbound.col.unit'), dataIndex: 'material_unit', width: 70, align: 'center' as const },
      { title: t('app.kuaizhizao.warehouseInbound.col.plannedQty'), dataIndex: 'source_doc_quantity', width: 100, align: 'right' as const },
      { title: t('app.kuaizhizao.warehouseInbound.col.receivedQty'), dataIndex: 'source_received_quantity', width: 90, align: 'right' as const },
      { title: t('app.kuaizhizao.warehouseInbound.col.pendingQty'), dataIndex: 'source_pending_quantity', width: 90, align: 'right' as const },
      {
        title: t('app.kuaizhizao.warehouseInbound.col.warehouse'),
        width: 150,
        render: () => (
          <Select
            style={{ width: '100%', minWidth: 118 }}
            placeholder={t('app.kuaizhizao.warehouseInbound.field.select')}
            showSearch
            optionFilterProp="label"
            value={warehouseId}
            options={warehouseOptions}
            onChange={(v) => setWarehouseId(v ?? undefined)}
          />
        ),
      },
      {
        title: t('app.kuaizhizao.warehouseInbound.col.thisReceipt'),
        width: 130,
        align: 'right' as const,
        render: () => (
          <InputNumber
            min={0}
            max={maxQty > 0 ? maxQty : undefined}
            precision={4}
            value={receiptQty}
            onChange={(v) => setReceiptQty(Number(v) || 0)}
            style={{ width: 110 }}
          />
        ),
      },
    ],
    [t, warehouseId, warehouseOptions, receiptQty, maxQty],
  );

  return (
    <DocumentFormPageLayout
      header={
        <>
          <Space align="center" size={8}>
            <Button type="text" icon={<ArrowLeftOutlined />} aria-label={t('app.kuaizhizao.warehouseInbound.action.back')} onClick={leavePage} />
            <Typography.Title level={4} style={DOCUMENT_DETAIL_PAGE_TITLE_STYLE}>
              {pageTitle}
            </Typography.Title>
          </Space>
          <Space wrap>
            <Button disabled={submitting || loading} onClick={leavePage}>
              {t('app.kuaizhizao.warehouseInbound.action.cancel')}
            </Button>
            <Button loading={submitting} disabled={loading || maxQty <= 0} onClick={() => void submit('draft')}>
              {t('app.kuaizhizao.warehouseInbound.action.generateDraft')}
            </Button>
            <Button type="primary" loading={submitting} disabled={loading || maxQty <= 0} onClick={() => void submit('confirm')}>
              {t('app.kuaizhizao.warehouseInbound.action.confirmInbound')}
            </Button>
          </Space>
        </>
      }
    >
      <Spin spinning={loading}>
        <Card styles={{ body: { padding: PAGE_SPACING.PADDING } }}>
          <div className="form-modal-content-inner">
            {preview && line && (
              <Form layout="vertical" requiredMark={false}>
                <Row gutter={16}>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.inboundType')}>
                      <ReadOnlyFormValue value={inboundTypeLabel} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.workOrderCode')}>
                      <ReadOnlyFormValue value={preview.work_order_code} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.product')}>
                      <ReadOnlyFormValue value={line.material_name} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.productCode')}>
                      <ReadOnlyFormValue value={line.material_code} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.plannedQty')}>
                      <ReadOnlyFormValue value={line.source_doc_quantity} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.receivedQty')}>
                      <ReadOnlyFormValue value={line.source_received_quantity} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.pendingQty')}>
                      <ReadOnlyFormValue value={line.source_pending_quantity} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.sourceSalesOrder')}>
                      <ReadOnlyFormValue value={workOrder?.sales_order_code ? String(workOrder.sales_order_code) : undefined} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.workOrderStatus')}>
                      <ReadOnlyFormValue value={workOrder?.status ? String(workOrder.status) : undefined} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.receiptDate')}>
                      <DatePicker
                        style={{ width: '100%' }}
                        value={receiptTime}
                        onChange={(v) => setReceiptTime(v ?? dayjs())}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <InboundEntryReceiverField hook={receiverHook} />
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.defaultWarehouse')} required>
                      <Select
                        style={{ width: '100%' }}
                        placeholder={t('app.kuaizhizao.warehouseInbound.field.selectInboundWarehouse')}
                        showSearch
                        optionFilterProp="label"
                        value={warehouseId}
                        options={warehouseOptions}
                        onChange={(v) => setWarehouseId(v ?? undefined)}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.workOrderDeliveryDate')}>
                      <ReadOnlyFormValue
                        value={
                          workOrder?.delivery_date
                            ? formatDateBySiteSetting(String(workOrder.delivery_date))
                            : undefined
                        }
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
            )}

            {line && (
              <div className="uni-table-detail" style={{ marginTop: PAGE_SPACING.BLOCK_GAP }}>
                <UniTableDetailHeader title={t('app.kuaizhizao.warehouseInbound.section.inboundDetails')} required />
                <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
                <div className="uni-table-detail-body">
                  <div className="uni-table-detail-scroll">
                    <Table
                      className="uni-detail-table warehouse-detail-table"
                      size="small"
                      rowKey="material_id"
                      pagination={false}
                      scroll={{ x: 900 }}
                      dataSource={[line]}
                      columns={entryColumns}
                    />
                  </div>
                </div>
              </div>
            )}

            {preview && (
              <Form layout="vertical" requiredMark={false} style={{ marginTop: PAGE_SPACING.BLOCK_GAP }}>
                <InboundEntryRemarksSection value={receiptNotes} onChange={setReceiptNotes} />
              </Form>
            )}
          </div>
        </Card>
      </Spin>
    </DocumentFormPageLayout>
  );
};

export default InboundWorkOrderPullEntryPage;
