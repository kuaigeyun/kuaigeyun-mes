/**
 * 从生产工单取单开生产退料入库 — 独立 Tab 页
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
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
import {
  InboundEntryReceiverField,
  InboundEntryRemarksSection,
  ReadOnlyFormValue,
  mapWarehouseSelectOptions,
  useInboundReceiverSelect,
} from './inboundEntryShared';
import { inboundReceiptTypeLabel } from './inboundHubTypes';
import { INBOUND_LIST_PATH, inboundProductionReturnEntryPath } from './inboundPaths';
import {
  draftDayjs,
  draftOptionalNumber,
  usePullEntryFormDraft,
} from '../shared/pullEntryFormDraft';
import { navigateLeavingPullEntry, pullEntryTabKey } from '../shared/pullEntryCloseTab';
import { resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import {
  MaterialUnitSelect,
  fetchMaterialForUnitSelectCache,
} from '../../../../../components/material-unit-select';
import { recalculateQuantityOnUnitChange } from '../../../../../components/quantity-with-unit/formHelpers';
import { formatQuantityWithUnit } from '../../../../../utils/materialUnitDisplay';
import { toApiDateTimeString } from '../../../../../utils/formDate';

type PreviewPicking = {
  picking_id: number;
  picking_code: string;
  status: string;
  lines: Array<{
    picking_item_id?: number;
    material_id?: number;
    material_code?: string;
    material_name?: string;
    material_spec?: string;
    material_unit?: string;
    source_doc_quantity?: number;
    source_received_quantity?: number;
    source_pending_quantity?: number;
  }>;
};

type ReturnLine = {
  key: number;
  picking_item_id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  material_unit?: string;
  picked_quantity: number;
  return_quantity: number;
};

const InboundProductionReturnPullEntryPage: React.FC = () => {
  const { workOrderId: woIdParam } = useParams<{ workOrderId: string }>();
  const workOrderId = Number(woIdParam);
  const navigate = useNavigate();
  const location = useLocation();
  const { message: messageApi } = App.useApp();
  const { t } = useTranslation();
  const pullFromProductionReturnAction = resolveKuaizhizaoDocumentAction(t, 'inbound.pull_from_work_order_for_production_return');
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const receiverHook = useInboundReceiverSelect();
  const initRef = useRef(false);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [workOrder, setWorkOrder] = useState<Record<string, unknown> | null>(null);
  const [previewPickings, setPreviewPickings] = useState<PreviewPicking[]>([]);
  const [pickingId, setPickingId] = useState<number | null>(null);
  const [pickingCode, setPickingCode] = useState('');
  const [lines, setLines] = useState<ReturnLine[]>([]);
  const [warehouseOptions, setWarehouseOptions] = useState<{ label: string; value: number; name: string }[]>([]);
  const [warehouseId, setWarehouseId] = useState<number | undefined>();
  const [returnTime, setReturnTime] = useState(() => dayjs());
  const [returnNotes, setReturnNotes] = useState('');
  const { bindSnapshot, persistNow, clearDraft, applyDraftOnce } = usePullEntryFormDraft(
    'kuaizhizao:inbound-production-return-pull',
  );

  const pagePath =
    Number.isFinite(workOrderId) && workOrderId > 0
      ? inboundProductionReturnEntryPath(workOrderId)
      : INBOUND_LIST_PATH;
  const woCode = String(workOrder?.code || workOrderId || '');
  const pageTitle = woCode
    ? `${pullFromProductionReturnAction.label} — ${woCode}`
    : pullFromProductionReturnAction.label;

  const pickingOptions = useMemo(
    () =>
      previewPickings.map((picking) => ({
        value: picking.picking_id,
        label: `${picking.picking_code} - ${picking.status}`,
      })),
    [previewPickings],
  );

  const totalReturnQty = useMemo(
    () => lines.reduce((sum, it) => sum + Number(it.return_quantity ?? 0), 0),
    [lines],
  );

  const leavePage = useCallback(() => {
    clearDraft();
    navigateLeavingPullEntry(
      navigate,
      INBOUND_LIST_PATH,
      pullEntryTabKey(location.pathname, location.search),
    );
  }, [clearDraft, navigate, location.pathname, location.search]);

  const applyPickingSelection = useCallback(
    (nextPickingId: number | null, qtyByItemId?: Record<number, number>, pickingsSource?: PreviewPicking[]) => {
      setPickingId(nextPickingId);
      const source = pickingsSource ?? previewPickings;
      const picking = source.find((row) => row.picking_id === nextPickingId);
      setPickingCode(picking?.picking_code || '');
      const nextLines = (picking?.lines || [])
        .filter((line) => Number(line.source_pending_quantity ?? 0) > 0)
        .map((line, idx) => ({
          key: Number(line.picking_item_id ?? idx),
          picking_item_id: line.picking_item_id != null ? Number(line.picking_item_id) : undefined,
          material_id: line.material_id != null ? Number(line.material_id) : undefined,
          material_code: String(line.material_code ?? ''),
          material_name: String(line.material_name ?? ''),
          material_spec: line.material_spec ? String(line.material_spec) : undefined,
          material_unit: String(line.material_unit || '个'),
          picked_quantity: Number(line.source_pending_quantity ?? 0),
          return_quantity: 0,
        }));
      if (qtyByItemId) {
        setLines(
          nextLines.map((row) =>
            qtyByItemId[row.key] != null
              ? { ...row, return_quantity: Number(qtyByItemId[row.key]) }
              : row,
          ),
        );
      } else {
        setLines(nextLines);
      }
    },
    [previewPickings],
  );

  useEffect(() => {
    bindSnapshot(() => ({
      pickingId,
      lineReturnQty: Object.fromEntries(lines.map((row) => [row.key, row.return_quantity])),
      warehouseId,
      returnTime,
      returnNotes,
      receiverUuid: receiverHook.receiverUuid,
      receiverName: receiverHook.receiverName,
    }));
    persistNow();
  }, [
    pickingId,
    lines,
    warehouseId,
    returnTime,
    returnNotes,
    receiverHook.receiverUuid,
    receiverHook.receiverName,
    bindSnapshot,
    persistNow,
  ]);

  useEffect(() => {
    if (!(Number.isFinite(workOrderId) && workOrderId > 0)) {
      messageApi.error(t('app.kuaizhizao.warehouseInbound.entry.workOrder.invalid'));
      leavePage();
    }
  }, [workOrderId, leavePage, messageApi, t]);

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
    if (!Number.isFinite(workOrderId) || workOrderId <= 0 || initRef.current) return;
    initRef.current = true;
    void (async () => {
      setLoading(true);
      try {
        const [woRaw, whRes, previewRaw] = await Promise.all([
          workOrderApi.get(String(workOrderId)),
          masterWarehouseApi.list({ is_active: true, limit: 500 }),
          warehouseApi.productionReturn.previewFromWorkOrder(workOrderId),
        ]);
        const preview = previewRaw as { pickings?: PreviewPicking[]; message?: string };
        const pickings = Array.isArray(preview.pickings) ? preview.pickings : [];
        if (!pickings.length) {
          messageApi.warning(preview.message || t('app.kuaizhizao.warehouseInbound.entry.productionReturn.noReturnLines'));
          leavePage();
          return;
        }
        setWorkOrder(woRaw as Record<string, unknown>);
        setWarehouseOptions(mapWarehouseSelectOptions(whRes));
        setPreviewPickings(pickings);
        applyDraftOnce((draft) => {
          const whId = draftOptionalNumber(draft.warehouseId);
          if (whId != null) setWarehouseId(whId);
          if (draft.returnTime) setReturnTime(draftDayjs(draft.returnTime));
          if (typeof draft.returnNotes === 'string') setReturnNotes(draft.returnNotes);
          receiverHook.restoreReceiver(
            typeof draft.receiverUuid === 'string' ? draft.receiverUuid : undefined,
            typeof draft.receiverName === 'string' ? draft.receiverName : undefined,
          );
          const draftPickingId = draftOptionalNumber(draft.pickingId);
          const qtyByItemId = draft.lineReturnQty as Record<number, number> | undefined;
          if (draftPickingId != null) {
            applyPickingSelection(draftPickingId, qtyByItemId, pickings);
          } else {
            const firstPicking = pickings.find((picking) =>
              (picking.lines || []).some((line) => Number(line.source_pending_quantity ?? 0) > 0),
            );
            applyPickingSelection(firstPicking?.picking_id ?? null, undefined, pickings);
          }
        });
      } catch (e: unknown) {
        messageApi.error((e as Error)?.message || t('app.kuaizhizao.warehouseInbound.entry.workOrder.loadFailed'));
        leavePage();
      } finally {
        setLoading(false);
      }
    })();
  }, [
    workOrderId,
    leavePage,
    messageApi,
    t,
    applyDraftOnce,
    receiverHook.restoreReceiver,
    applyPickingSelection,
  ]);

  const submit = async (mode: 'draft' | 'confirm') => {
    if (!pickingId) {
      messageApi.warning(t('app.kuaizhizao.warehouseInbound.entry.productionReturn.selectPicking'));
      return;
    }
    if (!warehouseId || !(warehouseId > 0)) {
      messageApi.warning(t('app.kuaizhizao.warehouseInbound.entry.productionReturn.selectWarehouse'));
      return;
    }
    const whOpt = warehouseOptions.find((w) => w.value === warehouseId);
    if (!whOpt) return;

    const activeLines = lines.filter((it) => it.return_quantity > 0);
    if (!activeLines.length) {
      messageApi.warning(t('app.kuaizhizao.warehouseInbound.entry.productionReturn.fillReturnQty'));
      return;
    }
    for (const it of activeLines) {
      if (it.return_quantity > it.picked_quantity) {
        messageApi.error(
          t('app.kuaizhizao.warehouseInbound.entry.productionReturn.qtyExceedsPicked', {
            material: it.material_code || it.material_name,
            max: it.picked_quantity,
          }),
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const created = (await warehouseApi.productionReturn.create({
        work_order_id: workOrderId,
        work_order_code: woCode,
        picking_id: pickingId,
        picking_code: pickingCode || undefined,
        warehouse_id: warehouseId,
        warehouse_name: whOpt.name,
        return_time: toApiDateTimeString(returnTime),
        returner_name: receiverHook.receiverName.trim() || undefined,
        notes: returnNotes.trim() || undefined,
        items: activeLines.map((it) => ({
          picking_item_id: it.picking_item_id,
          material_id: it.material_id,
          material_code: it.material_code || '',
          material_name: it.material_name || '',
          material_spec: it.material_spec || undefined,
          material_unit: it.material_unit || '个',
          return_quantity: it.return_quantity,
          warehouse_id: warehouseId,
          warehouse_name: whOpt.name,
        })),
      })) as { id?: number; return_code?: string };
      if (created?.id == null) {
        messageApi.error(t('app.kuaizhizao.warehouseInbound.entry.productionReturn.noReturnId'));
        return;
      }
      invalidateMenuBadgeCounts();
      clearDraft();
      if (mode === 'confirm') {
        navigateLeavingPullEntry(
          navigate,
          INBOUND_LIST_PATH,
          pullEntryTabKey(location.pathname, location.search),
          {
            inboundDirectConfirm: {
              id: Number(created.id),
              receipt_type: 'production_return',
            },
          },
        );
      } else {
        messageApi.success(
          t('app.kuaizhizao.warehouseInbound.entry.productionReturn.draftCreated', {
            code: created.return_code
              ? t('app.kuaizhizao.warehouseInbound.entry.purchase.draftCreatedSuffix', { code: created.return_code })
              : '',
          }),
        );
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
      {
        title: t('app.kuaizhizao.warehouseInbound.col.unit'),
        dataIndex: 'material_unit',
        width: 88,
        align: 'center' as const,
        render: (_: unknown, record: ReturnLine) =>
          record.material_id ? (
            <MaterialUnitSelect
              materialId={record.material_id}
              value={record.material_unit}
              size="small"
              noStyle
              onChange={(newUnit) => {
                void (async () => {
                  const material = await fetchMaterialForUnitSelectCache(record.material_id!);
                  setLines((prev) =>
                    prev.map((row) => {
                      if (row.key !== record.key) return row;
                      const convert = (qty: number) =>
                        recalculateQuantityOnUnitChange({
                          material,
                          currentQuantity: qty,
                          oldUnit: row.material_unit,
                          newUnit,
                        });
                      return {
                        ...row,
                        material_unit: newUnit,
                        picked_quantity: convert(row.picked_quantity),
                        return_quantity: convert(row.return_quantity),
                      };
                    }),
                  );
                })();
              }}
            />
          ) : (
            record.material_unit || '—'
          ),
      },
      {
        title: t('app.kuaizhizao.warehouseInbound.col.returnableQty'),
        dataIndex: 'picked_quantity',
        width: 100,
        align: 'right' as const,
        render: (v: number, record: ReturnLine) => formatQuantityWithUnit(v, record.material_unit),
      },
      {
        title: t('app.kuaizhizao.warehouseInbound.col.thisReturn'),
        width: 130,
        align: 'right' as const,
        render: (_: unknown, record: ReturnLine) => (
          <InputNumber
            min={0}
            max={record.picked_quantity}
            precision={4}
            value={record.return_quantity}
            onChange={(v) => {
              const qty = Number(v) || 0;
              setLines((prev) =>
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
            <Button
              type="primary"
              loading={submitting}
              disabled={loading}
              onClick={() => void submit('confirm')}
            >
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
                      <ReadOnlyFormValue value={inboundReceiptTypeLabel(t, 'production_return')} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.workOrderCode')}>
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
                    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.workOrderStatus')}>
                      <ReadOnlyFormValue value={workOrder.status ? String(workOrder.status) : undefined} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.picking')} required>
                      <Select
                        placeholder={t('app.kuaizhizao.warehouseInbound.field.selectPicking')}
                        showSearch
                        style={{ width: '100%' }}
                        value={pickingId ?? undefined}
                        options={pickingOptions}
                        filterOption={(input, opt) =>
                          (opt?.label ?? '').toString().toLowerCase().includes((input ?? '').toLowerCase())
                        }
                        onChange={(v) => {
                          applyPickingSelection(v ? Number(v) : null);
                        }}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.returnDate')}>
                      <DatePicker
                        style={{ width: '100%' }}
                        value={returnTime}
                        onChange={(v) => setReturnTime(v ?? dayjs())}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <InboundEntryReceiverField label={t('app.kuaizhizao.warehouseInbound.field.returner')} hook={receiverHook} />
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.returnWarehouse')} required>
                      <Select
                        placeholder={t('app.kuaizhizao.warehouseInbound.field.selectReturnWarehouse')}
                        showSearch
                        style={{ width: '100%' }}
                        value={warehouseId}
                        options={warehouseOptions}
                        filterOption={(input, opt) =>
                          (opt?.label ?? '').toString().toLowerCase().includes((input ?? '').toLowerCase())
                        }
                        onChange={(v) => setWarehouseId(v ? Number(v) : undefined)}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.totalQty')}>
                      <ReadOnlyFormValue value={totalReturnQty.toLocaleString()} />
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
            )}

            {lines.length > 0 && (
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
                      scroll={{ x: 1000 }}
                      dataSource={lines}
                      columns={entryColumns}
                    />
                  </div>
                </div>
              </div>
            )}

            {workOrder && (
              <Form layout="vertical" requiredMark={false} style={{ marginTop: PAGE_SPACING.BLOCK_GAP }}>
                <InboundEntryRemarksSection
                  value={returnNotes}
                  onChange={setReturnNotes}
                  label={t('app.kuaizhizao.warehouseInbound.field.returnRemarks')}
                  placeholder={t('app.kuaizhizao.warehouseInbound.field.returnRemarksPlaceholder')}
                />
              </Form>
            )}
          </div>
        </Card>
      </Spin>
    </DocumentFormPageLayout>
  );
};

export default InboundProductionReturnPullEntryPage;
