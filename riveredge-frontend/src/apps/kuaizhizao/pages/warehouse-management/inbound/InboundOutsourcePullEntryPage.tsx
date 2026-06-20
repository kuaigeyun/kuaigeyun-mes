/**
 * 从委外工单取单开入库 — 独立 Tab 页（委外收货/退料/退货）
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
import {
  outsourceWorkOrderApi,
  outsourceMaterialReceiptApi,
  outsourceMaterialReturnApi,
  outsourceProductReturnApi,
} from '../../../services/production';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { setCustomPageTitle, removeCustomPageTitle } from '../../../../../utils/customPageTitle';
import {
  buildReceiptLineFromWorkOrder,
  type OutsourceReceiptLine,
} from '../../../components/OutsourceReceiptFormContent';
import type { InboundOutsourcePullType } from './inboundCreateConfig';
import { inboundReceiptTypeLabel } from './inboundHubTypes';
import type { InboundReceiptType } from './inboundHubTypes';
import {
  InboundEntryReceiverField,
  InboundEntryRemarksSection,
  ReadOnlyFormValue,
  mapWarehouseSelectOptions,
  useInboundReceiverSelect,
} from './inboundEntryShared';
import { INBOUND_LIST_PATH, inboundOutsourceEntryPath } from './inboundPaths';
import {
  draftDayjs,
  draftOptionalNumber,
  mergeKeyedLineQuantities,
  usePullEntryFormDraft,
} from '../shared/pullEntryFormDraft';
import { resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';

const PULL_TYPE_TO_RECEIPT_TYPE: Record<InboundOutsourcePullType, InboundReceiptType> = {
  outsource_receipt: 'outsource_receipt',
  outsource_material_return: 'outsource_material_return',
  outsource_product_return: 'outsource_product_return',
};

type PreviewLine = {
  key: string;
  issue_id?: number;
  receipt_id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  unit?: string;
  returnable_quantity: number;
  return_quantity: number;
};

function parsePullType(value: string | null): InboundOutsourcePullType {
  if (value === 'outsource_material_return' || value === 'outsource_product_return') return value;
  return 'outsource_receipt';
}

const InboundOutsourcePullEntryPage: React.FC = () => {
  const { woId: woIdParam } = useParams<{ woId: string }>();
  const woId = Number(woIdParam);
  const [searchParams] = useSearchParams();
  const pullType = parsePullType(searchParams.get('pullType'));
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const { t } = useTranslation();
  const pullFromOutsourceWorkOrderAction = resolveKuaizhizaoDocumentAction(t, 'inbound.pull_from_outsource_work_order');
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const receiverHook = useInboundReceiverSelect();
  const initRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [workOrder, setWorkOrder] = useState<Record<string, unknown> | null>(null);
  const [receiptLine, setReceiptLine] = useState<OutsourceReceiptLine | null>(null);
  const [previewLines, setPreviewLines] = useState<PreviewLine[]>([]);
  const [warehouseOptions, setWarehouseOptions] = useState<{ label: string; value: number; name: string }[]>([]);
  const [warehouseId, setWarehouseId] = useState<number | undefined>();
  const [receiptTime, setReceiptTime] = useState(() => dayjs());
  const [notes, setNotes] = useState('');
  const { bindSnapshot, persistNow, clearDraft, applyDraftOnce, resetDraftRestore } = usePullEntryFormDraft(
    'kuaizhizao:inbound-outsource-pull',
  );

  const receiptType = PULL_TYPE_TO_RECEIPT_TYPE[pullType];
  const inboundTypeLabel = inboundReceiptTypeLabel(t, receiptType);
  const pagePath = Number.isFinite(woId) && woId > 0 ? inboundOutsourceEntryPath(woId, pullType) : INBOUND_LIST_PATH;
  const woCode = String(workOrder?.code || woId || '');
  const needsWarehouse = pullType === 'outsource_receipt' || pullType === 'outsource_material_return';
  const pageTitle = woCode ? `${pullFromOutsourceWorkOrderAction.label} — ${woCode}` : pullFromOutsourceWorkOrderAction.label;

  const pullTypeOptions = useMemo(
    () => [
      { label: t('app.kuaizhizao.warehouseInbound.pull.outsourceType.receipt'), value: 'outsource_receipt' as const },
      { label: t('app.kuaizhizao.warehouseInbound.pull.outsourceType.materialReturn'), value: 'outsource_material_return' as const },
      { label: t('app.kuaizhizao.warehouseInbound.pull.outsourceType.productReturn'), value: 'outsource_product_return' as const },
    ],
    [t],
  );

  const leavePage = useCallback(() => {
    clearDraft();
    navigate(INBOUND_LIST_PATH);
  }, [clearDraft, navigate]);

  useEffect(() => {
    bindSnapshot(() => ({
      warehouseId,
      receiptTime,
      notes,
      receiverUuid: receiverHook.receiverUuid,
      receiverName: receiverHook.receiverName,
      receiptLine: receiptLine
        ? {
            receiptQuantity: receiptLine.receiptQuantity,
            qualifiedQuantity: receiptLine.qualifiedQuantity,
            unqualifiedQuantity: receiptLine.unqualifiedQuantity,
          }
        : undefined,
      previewQtyByKey:
        pullType === 'outsource_receipt'
          ? undefined
          : Object.fromEntries(previewLines.map((line) => [line.key, line.return_quantity])),
    }));
    persistNow();
  }, [
    warehouseId,
    receiptTime,
    notes,
    receiptLine,
    previewLines,
    pullType,
    receiverHook.receiverUuid,
    receiverHook.receiverName,
    bindSnapshot,
    persistNow,
  ]);

  useEffect(() => {
    if (!(Number.isFinite(woId) && woId > 0)) {
      messageApi.error(t('app.kuaizhizao.warehouseInbound.entry.outsource.invalid'));
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
  }, [pageTitle, pagePath]);

  useEffect(() => {
    if (!Number.isFinite(woId) || woId <= 0) return;
    initRef.current = false;
    resetDraftRestore();
  }, [woId, pullType, resetDraftRestore]);

  useEffect(() => {
    if (!Number.isFinite(woId) || woId <= 0 || initRef.current) return;
    initRef.current = true;
    void (async () => {
      setLoading(true);
      try {
        const [detail, whRes] = await Promise.all([
          outsourceWorkOrderApi.get(String(woId)),
          masterWarehouseApi.list({ is_active: true, limit: 500 }),
        ]);
        const wo = detail as Record<string, unknown>;
        setWorkOrder(wo);
        setWarehouseOptions(mapWarehouseSelectOptions(whRes));

        if (pullType === 'outsource_receipt') {
          setReceiptLine(buildReceiptLineFromWorkOrder(wo));
          setPreviewLines([]);
        } else if (pullType === 'outsource_material_return') {
          const preview = (await outsourceMaterialReturnApi.returnPreview(woId)) as {
            lines?: Array<Record<string, unknown>>;
            data?: { lines?: Array<Record<string, unknown>> };
            message?: string;
          };
          const lines = preview?.lines ?? preview?.data?.lines ?? [];
          if (!lines.length) {
            messageApi.warning(preview?.message || t('app.kuaizhizao.warehouseInbound.entry.outsource.noMaterialReturnLines'));
            leavePage();
            return;
          }
          setPreviewLines(
            lines.map((line, idx) => {
              const issueId = Number(line.issue_id ?? line.issueId ?? 0);
              const qty = Number(line.returnable_quantity ?? line.returnableQuantity ?? 0);
              return {
                key: `issue-${issueId || idx}`,
                issue_id: issueId || undefined,
                material_id: line.material_id != null ? Number(line.material_id) : undefined,
                material_code: String(line.material_code ?? line.materialCode ?? ''),
                material_name: String(line.material_name ?? line.materialName ?? ''),
                unit: String(line.unit ?? '个'),
                returnable_quantity: qty,
                return_quantity: qty,
              };
            }),
          );
          setReceiptLine(null);
        } else {
          const preview = (await outsourceProductReturnApi.returnPreview(woId)) as {
            lines?: Array<Record<string, unknown>>;
            data?: { lines?: Array<Record<string, unknown>> };
            message?: string;
          };
          const lines = preview?.lines ?? preview?.data?.lines ?? [];
          if (!lines.length) {
            messageApi.warning(preview?.message || t('app.kuaizhizao.warehouseInbound.entry.outsource.noProductReturnLines'));
            leavePage();
            return;
          }
          setPreviewLines(
            lines.map((line, idx) => {
              const receiptId = Number(line.receipt_id ?? line.receiptId ?? 0);
              const qty = Number(line.returnable_quantity ?? line.returnableQuantity ?? 0);
              return {
                key: `receipt-${receiptId || idx}`,
                receipt_id: receiptId || undefined,
                unit: String(line.unit ?? wo.unit ?? '件'),
                returnable_quantity: qty,
                return_quantity: qty,
              };
            }),
          );
          setReceiptLine(null);
        }
        applyDraftOnce((draft) => {
          const whId = draftOptionalNumber(draft.warehouseId);
          if (whId != null) setWarehouseId(whId);
          if (draft.receiptTime) setReceiptTime(draftDayjs(draft.receiptTime));
          if (typeof draft.notes === 'string') setNotes(draft.notes);
          receiverHook.restoreReceiver(
            typeof draft.receiverUuid === 'string' ? draft.receiverUuid : undefined,
            typeof draft.receiverName === 'string' ? draft.receiverName : undefined,
          );
          if (pullType === 'outsource_receipt' && draft.receiptLine) {
            setReceiptLine((prev) => (prev ? { ...prev, ...(draft.receiptLine as Partial<OutsourceReceiptLine>) } : prev));
          } else if (draft.previewQtyByKey) {
            setPreviewLines((prev) =>
              mergeKeyedLineQuantities(prev, draft.previewQtyByKey as Record<string, number>),
            );
          }
        });
      } catch (e: unknown) {
        messageApi.error((e as Error)?.message || t('app.kuaizhizao.warehouseInbound.entry.outsource.loadFailed'));
        leavePage();
      } finally {
        setLoading(false);
      }
    })();
  }, [woId, pullType, leavePage, messageApi, t, applyDraftOnce, receiverHook.restoreReceiver]);

  const receiptTableData = useMemo(() => (receiptLine ? [receiptLine] : []), [receiptLine]);

  const receiptColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.warehouseInbound.col.productCode'), dataIndex: 'productCode', width: 120, ellipsis: true },
      { title: t('app.kuaizhizao.warehouseInbound.col.productName'), dataIndex: 'productName', width: 160, ellipsis: true },
      { title: t('app.kuaizhizao.warehouseInbound.col.unit'), dataIndex: 'unit', width: 70, align: 'center' as const },
      { title: t('app.kuaizhizao.warehouseInbound.col.outsourceQty'), dataIndex: 'orderedQuantity', width: 100, align: 'right' as const },
      { title: t('app.kuaizhizao.warehouseInbound.col.receivedOutsource'), dataIndex: 'receivedQuantity', width: 90, align: 'right' as const },
      { title: t('app.kuaizhizao.warehouseInbound.col.pendingReceipt'), dataIndex: 'pendingQuantity', width: 90, align: 'right' as const },
      {
        title: t('app.kuaizhizao.warehouseInbound.col.thisReceiptOutsource'),
        width: 120,
        align: 'right' as const,
        render: (_: unknown, record: OutsourceReceiptLine) => (
          <InputNumber
            min={0}
            max={record.pendingQuantity > 0 ? record.pendingQuantity : undefined}
            precision={2}
            value={record.receiptQuantity}
            disabled={record.pendingQuantity <= 0}
            style={{ width: '100%' }}
            onChange={(v) => {
              const qty = Number(v ?? 0);
              setReceiptLine((prev) => {
                if (!prev) return prev;
                const unqualified = Number(prev.unqualifiedQuantity || 0);
                return {
                  ...prev,
                  receiptQuantity: qty,
                  qualifiedQuantity: Math.max(0, qty - unqualified),
                };
              });
            }}
          />
        ),
      },
      {
        title: t('app.kuaizhizao.warehouseInbound.col.qualified'),
        width: 110,
        align: 'right' as const,
        render: (_: unknown, record: OutsourceReceiptLine) => (
          <InputNumber
            min={0}
            max={record.receiptQuantity}
            precision={2}
            value={record.qualifiedQuantity}
            style={{ width: '100%' }}
            onChange={(v) => {
              const qualified = Number(v ?? 0);
              setReceiptLine((prev) => {
                if (!prev) return prev;
                const unqualified = Number(prev.unqualifiedQuantity || 0);
                return {
                  ...prev,
                  qualifiedQuantity: qualified,
                  receiptQuantity: qualified + unqualified,
                };
              });
            }}
          />
        ),
      },
      {
        title: t('app.kuaizhizao.warehouseInbound.col.unqualified'),
        width: 110,
        align: 'right' as const,
        render: (_: unknown, record: OutsourceReceiptLine) => (
          <InputNumber
            min={0}
            max={record.receiptQuantity}
            precision={2}
            value={record.unqualifiedQuantity}
            style={{ width: '100%' }}
            onChange={(v) => {
              const unqualified = Number(v ?? 0);
              setReceiptLine((prev) => {
                if (!prev) return prev;
                const qualified = Number(prev.qualifiedQuantity || 0);
                return {
                  ...prev,
                  unqualifiedQuantity: unqualified,
                  receiptQuantity: qualified + unqualified,
                };
              });
            }}
          />
        ),
      },
    ],
    [t],
  );

  const materialReturnColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.warehouseInbound.col.materialCode'), dataIndex: 'material_code', width: 120, ellipsis: true },
      { title: t('app.kuaizhizao.warehouseInbound.col.materialName'), dataIndex: 'material_name', width: 150, ellipsis: true },
      { title: t('app.kuaizhizao.warehouseInbound.col.unit'), dataIndex: 'unit', width: 70, align: 'center' as const },
      { title: t('app.kuaizhizao.warehouseInbound.col.returnableQty'), dataIndex: 'returnable_quantity', width: 100, align: 'right' as const },
      {
        title: t('app.kuaizhizao.warehouseInbound.col.thisReturn'),
        width: 130,
        align: 'right' as const,
        render: (_: unknown, record: PreviewLine) => (
          <InputNumber
            min={0}
            max={record.returnable_quantity}
            precision={4}
            value={record.return_quantity}
            onChange={(v) => {
              const qty = Number(v) || 0;
              setPreviewLines((prev) =>
                prev.map((row) =>
                  row.key === record.key ? { ...row, return_quantity: qty } : row,
                ),
              );
            }}
            style={{ width: 110 }}
          />
        ),
      },
    ],
    [t],
  );

  const productReturnColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.warehouseInbound.col.receiptDoc'), dataIndex: 'receipt_id', width: 100 },
      { title: t('app.kuaizhizao.warehouseInbound.col.unit'), dataIndex: 'unit', width: 70, align: 'center' as const },
      { title: t('app.kuaizhizao.warehouseInbound.col.returnableQty'), dataIndex: 'returnable_quantity', width: 100, align: 'right' as const },
      {
        title: t('app.kuaizhizao.warehouseInbound.col.thisSalesReturn'),
        width: 130,
        align: 'right' as const,
        render: (_: unknown, record: PreviewLine) => (
          <InputNumber
            min={0}
            max={record.returnable_quantity}
            precision={4}
            value={record.return_quantity}
            onChange={(v) => {
              const qty = Number(v) || 0;
              setPreviewLines((prev) =>
                prev.map((row) =>
                  row.key === record.key ? { ...row, return_quantity: qty } : row,
                ),
              );
            }}
            style={{ width: 110 }}
          />
        ),
      },
    ],
    [t],
  );

  const submit = async (mode: 'draft' | 'confirm') => {
    if (!workOrder) return;
    if (needsWarehouse && (!warehouseId || !(warehouseId > 0))) {
      messageApi.warning(t('app.kuaizhizao.warehouseInbound.entry.outsource.selectWarehouse'));
      return;
    }
    const whOpt = warehouseOptions.find((w) => w.value === warehouseId);

    setSubmitting(true);
    try {
      const createdIds: number[] = [];

      if (pullType === 'outsource_receipt') {
        if (!receiptLine || receiptLine.receiptQuantity <= 0) {
          messageApi.warning(t('app.kuaizhizao.warehouseInbound.entry.outsource.noReceiptQty'));
          return;
        }
        const created = (await outsourceMaterialReceiptApi.create({
          outsource_work_order_id: woId,
          outsource_work_order_code: woCode,
          quantity: receiptLine.receiptQuantity,
          qualified_quantity: receiptLine.qualifiedQuantity || 0,
          unqualified_quantity: receiptLine.unqualifiedQuantity || 0,
          unit: receiptLine.unit || '件',
          warehouse_id: warehouseId,
          warehouse_name: whOpt?.name,
          notes: notes.trim() || undefined,
        })) as { id?: number; receipt_code?: string };
        if (created?.id != null) createdIds.push(Number(created.id));
        if (mode === 'draft') {
          messageApi.success(
            t('app.kuaizhizao.warehouseInbound.entry.outsource.receiptDraftCreated', {
              code: created.receipt_code
                ? t('app.kuaizhizao.warehouseInbound.entry.purchase.draftCreatedSuffix', { code: created.receipt_code })
                : '',
            }),
          );
        }
      } else if (pullType === 'outsource_material_return') {
        for (const line of previewLines) {
          if (!line.issue_id || line.return_quantity <= 0) continue;
          if (line.return_quantity > line.returnable_quantity) {
            messageApi.error(
              t('app.kuaizhizao.warehouseInbound.entry.outsource.materialReturnQtyExceeds', {
                material: line.material_code || line.material_name,
              }),
            );
            return;
          }
          const created = (await outsourceMaterialReturnApi.create({
            outsource_work_order_id: woId,
            outsource_work_order_code: woCode,
            outsource_material_issue_id: line.issue_id,
            material_id: line.material_id,
            material_code: line.material_code || '',
            material_name: line.material_name || '',
            quantity: line.return_quantity,
            unit: line.unit || '个',
            warehouse_id: warehouseId,
            warehouse_name: whOpt?.name,
            notes: notes.trim() || undefined,
          })) as { id?: number };
          if (created?.id != null) createdIds.push(Number(created.id));
        }
        if (!createdIds.length) {
          messageApi.warning(t('app.kuaizhizao.warehouseInbound.entry.outsource.fillMaterialReturnQty'));
          return;
        }
        if (mode === 'draft') {
          messageApi.success(t('app.kuaizhizao.warehouseInbound.entry.outsource.materialReturnDraftsCreated', { count: createdIds.length }));
        }
      } else {
        for (const line of previewLines) {
          if (!line.receipt_id || line.return_quantity <= 0) continue;
          if (line.return_quantity > line.returnable_quantity) {
            messageApi.error(t('app.kuaizhizao.warehouseInbound.entry.outsource.productReturnQtyExceeds'));
            return;
          }
          const created = (await outsourceProductReturnApi.create({
            outsource_work_order_id: woId,
            outsource_work_order_code: woCode,
            outsource_material_receipt_id: line.receipt_id,
            quantity: line.return_quantity,
            unit: line.unit || String(workOrder.unit ?? '件'),
            notes: notes.trim() || undefined,
          })) as { id?: number };
          if (created?.id != null) createdIds.push(Number(created.id));
        }
        if (!createdIds.length) {
          messageApi.warning(t('app.kuaizhizao.warehouseInbound.entry.outsource.fillProductReturnQty'));
          return;
        }
        if (mode === 'draft') {
          messageApi.success(t('app.kuaizhizao.warehouseInbound.entry.outsource.productReturnDraftsCreated', { count: createdIds.length }));
        }
      }

      invalidateMenuBadgeCounts();
      clearDraft();
      if (mode === 'confirm') {
        if (createdIds.length === 1) {
          navigate(INBOUND_LIST_PATH, {
            state: {
              inboundDirectConfirm: {
                id: createdIds[0],
                receipt_type: receiptType,
              },
            },
          });
        } else {
          messageApi.success(t('app.kuaizhizao.warehouseInbound.entry.outsource.multiDraftConfirmInList', { count: createdIds.length }));
          leavePage();
        }
      } else {
        leavePage();
      }
    } catch (e: unknown) {
      messageApi.error((e as Error)?.message || t('app.kuaizhizao.warehouseInbound.msg.saveFailed'));
    } finally {
      setSubmitting(false);
    }
  };

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
            <Button loading={submitting} disabled={loading} onClick={() => void submit('draft')}>
              {t('app.kuaizhizao.warehouseInbound.action.generateDraft')}
            </Button>
            <Button type="primary" loading={submitting} disabled={loading} onClick={() => void submit('confirm')}>
              {t('app.kuaizhizao.warehouseInbound.action.confirmInbound')}
            </Button>
          </Space>
        </>
      }
    >
      <Spin spinning={loading}>
        <Card styles={{ body: { padding: PAGE_SPACING.PADDING } }}>
          <div className="form-modal-content-inner">
            {workOrder && (
              <Form layout="vertical" requiredMark={false}>
                <Row gutter={16}>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.inboundType')}>
                      <ReadOnlyFormValue value={inboundTypeLabel} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.outsourceWoCode')}>
                      <ReadOnlyFormValue value={woCode} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.product')}>
                      <ReadOnlyFormValue
                        value={workOrder.product_name ? String(workOrder.product_name) : undefined}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.outsourceSupplier')}>
                      <ReadOnlyFormValue
                        value={workOrder.supplier_name ? String(workOrder.supplier_name) : undefined}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.workOrderStatus')}>
                      <ReadOnlyFormValue value={workOrder.status ? String(workOrder.status) : undefined} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.plannedQty')}>
                      <ReadOnlyFormValue
                        value={workOrder.quantity != null ? String(workOrder.quantity) : undefined}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.businessType')}>
                      <Select
                        style={{ width: '100%' }}
                        value={pullType}
                        options={pullTypeOptions}
                        onChange={(v) => navigate(inboundOutsourceEntryPath(woId, v))}
                      />
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
                  {needsWarehouse && (
                    <Col xs={24} sm={12} lg={6}>
                      <Form.Item
                        label={
                          pullType === 'outsource_material_return'
                            ? t('app.kuaizhizao.warehouseInbound.field.returnInboundWarehouse')
                            : t('app.kuaizhizao.warehouseInbound.field.warehouse')
                        }
                        required
                      >
                        <Select
                          style={{ width: '100%' }}
                          placeholder={t('app.kuaizhizao.warehouseInbound.entry.outsource.selectWarehouse')}
                          showSearch
                          optionFilterProp="label"
                          value={warehouseId}
                          options={warehouseOptions}
                          onChange={(v) => setWarehouseId(v ?? undefined)}
                        />
                      </Form.Item>
                    </Col>
                  )}
                </Row>
              </Form>
            )}

            {pullType === 'outsource_receipt' && receiptLine && (
              <div className="uni-table-detail" style={{ marginTop: PAGE_SPACING.BLOCK_GAP }}>
                <UniTableDetailHeader title={t('app.kuaizhizao.warehouseInbound.section.receiptDetails')} required />
                <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
                <div className="uni-table-detail-body">
                  <div className="uni-table-detail-scroll">
                    <Table
                      className="uni-detail-table warehouse-detail-table"
                      size="small"
                      rowKey="key"
                      pagination={false}
                      scroll={{ x: 1000 }}
                      dataSource={receiptTableData}
                      columns={receiptColumns}
                    />
                  </div>
                </div>
              </div>
            )}

            {pullType === 'outsource_material_return' && previewLines.length > 0 && (
              <div className="uni-table-detail" style={{ marginTop: PAGE_SPACING.BLOCK_GAP }}>
                <UniTableDetailHeader title={t('app.kuaizhizao.warehouseInbound.section.returnDetails')} required />
                <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
                <div className="uni-table-detail-body">
                  <div className="uni-table-detail-scroll">
                    <Table
                      className="uni-detail-table warehouse-detail-table"
                      size="small"
                      rowKey="key"
                      pagination={false}
                      scroll={{ x: 900 }}
                      dataSource={previewLines}
                      columns={materialReturnColumns}
                    />
                  </div>
                </div>
              </div>
            )}

            {pullType === 'outsource_product_return' && previewLines.length > 0 && (
              <div className="uni-table-detail" style={{ marginTop: PAGE_SPACING.BLOCK_GAP }}>
                <UniTableDetailHeader title={t('app.kuaizhizao.warehouseInbound.section.returnDetailsSales')} required />
                <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
                <div className="uni-table-detail-body">
                  <div className="uni-table-detail-scroll">
                    <Table
                      className="uni-detail-table warehouse-detail-table"
                      size="small"
                      rowKey="key"
                      pagination={false}
                      scroll={{ x: 700 }}
                      dataSource={previewLines}
                      columns={productReturnColumns}
                    />
                  </div>
                </div>
              </div>
            )}

            {workOrder && (
              <Form layout="vertical" requiredMark={false} style={{ marginTop: PAGE_SPACING.BLOCK_GAP }}>
                <InboundEntryRemarksSection value={notes} onChange={setNotes} />
              </Form>
            )}
          </div>
        </Card>
      </Spin>
    </DocumentFormPageLayout>
  );
};

export default InboundOutsourcePullEntryPage;
