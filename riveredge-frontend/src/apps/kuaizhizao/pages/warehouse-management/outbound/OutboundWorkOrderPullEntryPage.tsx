/**
 * 从生产工单取单开生产领料 — 独立 Tab 页
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { App, Button, Card, Col, Form, Row, Select, Space, Spin, Table, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
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
  OutboundEntryOperatorField,
  OutboundEntryRemarksSection,
  ReadOnlyFormValue,
  mapWarehouseSelectOptions,
  useOutboundOperatorSelect,
} from './outboundEntryShared';
import { getOutboundIssueTypeLabel } from './outboundHubTypes';
import { OUTBOUND_LIST_PATH, outboundWorkOrderEntryPath } from './outboundPaths';
import { draftOptionalNumber, usePullEntryFormDraft } from '../shared/pullEntryFormDraft';
import { resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';

type WorkOrderKittingLine = {
  key: number;
  material_code: string;
  material_name: string;
  material_unit?: string;
  required_quantity: number;
  picked_quantity: number;
  shortage_quantity: number;
  main_warehouse_available: number;
  line_side_available: number;
  status: string;
};

const OutboundWorkOrderPullEntryPage: React.FC = () => {
  const { t } = useTranslation();
  const pullFromWorkOrderAction = resolveKuaizhizaoDocumentAction(t, 'outbound.pull_from_work_order');
  const { woId: woIdParam } = useParams<{ woId: string }>();
  const woId = Number(woIdParam);
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const operatorHook = useOutboundOperatorSelect();
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const initRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [workOrder, setWorkOrder] = useState<Record<string, unknown> | null>(null);
  const [warehouseOptions, setWarehouseOptions] = useState<{ label: string; value: number; name: string }[]>([]);
  const [warehouseId, setWarehouseId] = useState<number | undefined>();
  const [notes, setNotes] = useState('');
  const [kittingItems, setKittingItems] = useState<WorkOrderKittingLine[]>([]);
  const [kittingRate, setKittingRate] = useState<number>(0);
  const [kittingStatus, setKittingStatus] = useState<string>('');
  const { bindSnapshot, persistNow, clearDraft, applyDraftOnce } = usePullEntryFormDraft(
    'kuaizhizao:outbound-work-order-pull',
  );

  const pagePath = Number.isFinite(woId) && woId > 0 ? outboundWorkOrderEntryPath(woId) : OUTBOUND_LIST_PATH;
  const woCode = String(workOrder?.code ?? workOrder?.work_order_code ?? '');
  const pageTitle = woCode
    ? `${pullFromWorkOrderAction.label} — ${woCode}`
    : pullFromWorkOrderAction.label;
  const totalRequiredQty = useMemo(
    () => kittingItems.reduce((sum, row) => sum + Number(row.required_quantity || 0), 0),
    [kittingItems],
  );
  const kittingColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.warehouseOutbound.col.materialCode'), dataIndex: 'material_code', width: 140, ellipsis: true },
      { title: t('app.kuaizhizao.warehouseOutbound.col.materialName'), dataIndex: 'material_name', width: 180, ellipsis: true },
      { title: t('app.kuaizhizao.warehouseOutbound.col.unit'), dataIndex: 'material_unit', width: 70, align: 'center' as const },
      { title: '需求数量', dataIndex: 'required_quantity', width: 110, align: 'right' as const },
      { title: '已领数量', dataIndex: 'picked_quantity', width: 110, align: 'right' as const },
      { title: '缺口数量', dataIndex: 'shortage_quantity', width: 110, align: 'right' as const },
      { title: '主仓可用', dataIndex: 'main_warehouse_available', width: 130, align: 'right' as const },
      { title: '线边可用', dataIndex: 'line_side_available', width: 120, align: 'right' as const },
      { title: t('app.kuaizhizao.warehouseOutbound.col.status'), dataIndex: 'status', width: 100, align: 'center' as const },
    ],
    [t],
  );

  const leavePage = useCallback(() => {
    clearDraft();
    navigate(OUTBOUND_LIST_PATH);
  }, [clearDraft, navigate]);

  useEffect(() => {
    bindSnapshot(() => ({
      warehouseId,
      notes,
      receiverUuid: operatorHook.receiverUuid,
      receiverName: operatorHook.receiverName,
    }));
    persistNow();
  }, [
    warehouseId,
    notes,
    operatorHook.receiverUuid,
    operatorHook.receiverName,
    bindSnapshot,
    persistNow,
  ]);

  useEffect(() => {
    if (!(Number.isFinite(woId) && woId > 0)) {
      messageApi.error(t('app.kuaizhizao.warehouseOutbound.entry.invalidWorkOrder'));
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
        const [woRaw, whRes] = await Promise.all([
          workOrderApi.get(String(woId)),
          masterWarehouseApi.list({ is_active: true, limit: 500 }),
        ]);
        setWorkOrder(woRaw as Record<string, unknown>);
        setWarehouseOptions(mapWarehouseSelectOptions(whRes));
        try {
          const kittingRaw = (await workOrderApi.getKittingAnalysis(String(woId))) as {
            kitting_rate?: number | string;
            status?: string;
            items?: Array<Record<string, unknown>>;
          };
          const nextRows = (kittingRaw?.items || []).map((item, idx) => ({
            key: Number(item.material_id ?? idx),
            material_code: String(item.material_code ?? ''),
            material_name: String(item.material_name ?? ''),
            material_unit: item.material_unit ? String(item.material_unit) : '',
            required_quantity: Number(item.required_quantity ?? 0),
            picked_quantity: Number(item.picked_quantity ?? 0),
            shortage_quantity: Number(item.shortage_quantity ?? 0),
            main_warehouse_available: Number(item.main_warehouse_available ?? 0),
            line_side_available: Number(item.line_side_available ?? 0),
            status: String(item.status ?? ''),
          }));
          setKittingItems(nextRows);
          setKittingRate(Number(kittingRaw?.kitting_rate ?? 0));
          setKittingStatus(String(kittingRaw?.status ?? ''));
        } catch {
          // 齐套分析异常不阻断取单页，仅降级为无明细展示
          setKittingItems([]);
          setKittingRate(0);
          setKittingStatus('');
        }
        applyDraftOnce((draft) => {
          const whId = draftOptionalNumber(draft.warehouseId);
          if (whId != null) setWarehouseId(whId);
          if (typeof draft.notes === 'string') setNotes(draft.notes);
          operatorHook.restoreReceiver(
            typeof draft.receiverUuid === 'string' ? draft.receiverUuid : undefined,
            typeof draft.receiverName === 'string' ? draft.receiverName : undefined,
          );
        });
      } catch (e: unknown) {
        messageApi.error((e as Error)?.message || t('app.kuaizhizao.warehouseOutbound.entry.loadWorkOrderFailed'));
        leavePage();
      } finally {
        setLoading(false);
      }
    })();
  }, [woId, leavePage, messageApi, t, applyDraftOnce, operatorHook.restoreReceiver]);

  const submit = async (mode: 'draft' | 'confirm') => {
    if (!warehouseId || !(warehouseId > 0)) {
      messageApi.error(t('app.kuaizhizao.warehouseOutbound.msg.selectWarehouse'));
      return;
    }
    const whOpt = warehouseOptions.find((o) => o.value === warehouseId);
    if (!whOpt) return;

    setSubmitting(true);
    try {
      const result = await warehouseApi.productionPicking.batchPick({
        work_order_ids: [woId],
        warehouse_id: warehouseId,
        warehouse_name: whOpt.name,
      });
      const list = Array.isArray(result) ? result : (result as { data?: unknown[]; items?: unknown[] })?.data
        ?? (result as { items?: unknown[] })?.items
        ?? [];
      const created = (list[0] ?? {}) as { id?: number; picking_code?: string };
      if (created?.id == null) {
        messageApi.error(t('app.kuaizhizao.warehouseOutbound.entry.noPickingId'));
        return;
      }
      if (notes.trim() || operatorHook.receiverName.trim()) {
        await warehouseApi.productionPicking.update(String(created.id), {
          work_order_id: woId,
          work_order_code: woCode,
          warehouse_id: warehouseId,
          warehouse_name: whOpt.name,
          notes: notes.trim() || undefined,
          picker_name: operatorHook.receiverName.trim() || undefined,
        });
      }
      invalidateMenuBadgeCounts();
      clearDraft();
      if (mode === 'confirm') {
        navigate(OUTBOUND_LIST_PATH, {
          state: {
            outboundDirectConfirm: {
              id: Number(created.id),
              outbound_type: 'production_picking',
            },
          },
        });
      } else {
        messageApi.success(
          t('app.kuaizhizao.warehouseOutbound.entry.draftPickingCreated', {
            code: created.picking_code ? `：${created.picking_code}` : '',
          }),
        );
        leavePage();
      }
    } catch (e: unknown) {
      const err = e as { message?: string; response?: { data?: { detail?: string } } };
      messageApi.error(err?.message || err?.response?.data?.detail || t('app.kuaizhizao.warehouseOutbound.entry.saveFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DocumentFormPageLayout
      header={
        <>
          <Space align="center" size={8}>
            <Button type="text" icon={<ArrowLeftOutlined />} aria-label={t('app.kuaizhizao.warehouseOutbound.action.back')} onClick={leavePage} />
            <Typography.Title level={4} style={DOCUMENT_DETAIL_PAGE_TITLE_STYLE}>
              {pageTitle}
            </Typography.Title>
          </Space>
          <Space wrap>
            <Button disabled={submitting || loading} onClick={leavePage}>
              {t('app.kuaizhizao.warehouseOutbound.action.cancel')}
            </Button>
            <Button loading={submitting} disabled={loading} onClick={() => void submit('draft')}>
              {t('app.kuaizhizao.warehouseOutbound.action.generateDraft')}
            </Button>
            <Button type="primary" loading={submitting} disabled={loading} onClick={() => void submit('confirm')}>
              {t('app.kuaizhizao.warehouseOutbound.action.confirmOutbound')}
            </Button>
          </Space>
        </>
      }
    >
      <Spin spinning={loading}>
        <Card styles={{ body: { padding: PAGE_SPACING.PADDING } }}>
          {workOrder && (
            <Form layout="vertical" requiredMark={false}>
              <Row gutter={16}>
                <Col xs={24} sm={12} lg={6}>
                  <Form.Item label={t('app.kuaizhizao.warehouseOutbound.field.outboundType')}>
                    <ReadOnlyFormValue value={getOutboundIssueTypeLabel(t, 'production_picking')} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Form.Item label={t('app.kuaizhizao.warehouseOutbound.col.workOrderCode')}>
                    <ReadOnlyFormValue value={woCode} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Form.Item label={t('app.kuaizhizao.warehouseOutbound.entry.product')}>
                    <ReadOnlyFormValue value={String(workOrder.product_name ?? workOrder.name ?? '')} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Form.Item label={t('app.kuaizhizao.warehouseOutbound.entry.workOrderStatus')}>
                    <ReadOnlyFormValue value={String(workOrder.status ?? '')} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Form.Item label={t('app.kuaizhizao.warehouseOutbound.entry.plannedQty')}>
                    <ReadOnlyFormValue value={String(workOrder.quantity ?? '')} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Form.Item label={t('app.kuaizhizao.warehouseOutbound.entry.plannedStart')}>
                    <ReadOnlyFormValue
                      value={
                        workOrder.planned_start_date
                          ? formatDateBySiteSetting(String(workOrder.planned_start_date))
                          : undefined
                      }
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Form.Item label={t('app.kuaizhizao.warehouseOutbound.field.warehouse')} required>
                    <Select
                      style={{ width: '100%' }}
                      placeholder={t('app.kuaizhizao.warehouseOutbound.msg.selectWarehouse')}
                      options={warehouseOptions}
                      value={warehouseId}
                      onChange={setWarehouseId}
                      showSearch
                      filterOption={(input, opt) =>
                        (opt?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                      }
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <OutboundEntryOperatorField hook={operatorHook} />
                </Col>
                <Col xs={24}>
                  <OutboundEntryRemarksSection value={notes} onChange={setNotes} />
                </Col>
              </Row>
            </Form>
          )}
          <div className="uni-table-detail" style={{ marginTop: PAGE_SPACING.BLOCK_GAP }}>
            <UniTableDetailHeader
              title={t('app.kuaizhizao.warehouseOutbound.entry.issueDetails')}
              extra={
                <Typography.Text type="secondary">
                  {`齐套率 ${Number.isFinite(kittingRate) ? kittingRate : 0}% / 总需求 ${totalRequiredQty}`}
                  {kittingStatus ? ` / ${kittingStatus}` : ''}
                </Typography.Text>
              }
            />
            <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
            <div className="uni-table-detail-body">
              <div className="uni-table-detail-scroll">
                <Table
                  className="uni-detail-table warehouse-detail-table"
                  size="small"
                  rowKey="key"
                  pagination={false}
                  scroll={{ x: 1200 }}
                  dataSource={kittingItems}
                  columns={kittingColumns}
                  locale={{ emptyText: '暂无可领料明细' }}
                />
              </div>
            </div>
          </div>
        </Card>
      </Spin>
    </DocumentFormPageLayout>
  );
};

export default OutboundWorkOrderPullEntryPage;
