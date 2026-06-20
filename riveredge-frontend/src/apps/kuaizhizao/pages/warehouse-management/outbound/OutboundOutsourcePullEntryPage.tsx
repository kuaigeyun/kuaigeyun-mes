/**
 * 从委外工单取单开委外发料 — 独立 Tab 页
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  App,
  Button,
  Card,
  Col,
  Form,
  InputNumber,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Typography,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import {
  DOCUMENT_DETAIL_PAGE_TITLE_STYLE,
  DocumentFormPageLayout,
  PAGE_SPACING,
  WAREHOUSE_DETAIL_TABLE_STYLES,
} from '../../../../../components/layout-templates';
import { warehouseApi as masterWarehouseApi } from '../../../../master-data/services/warehouse';
import { outsourceMaterialIssueApi, outsourceWorkOrderApi } from '../../../services/production';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { setCustomPageTitle, removeCustomPageTitle } from '../../../../../utils/customPageTitle';
import {
  OutboundEntryRemarksSection,
  ReadOnlyFormValue,
  mapWarehouseSelectOptions,
} from './outboundEntryShared';
import { getOutboundIssueTypeLabel } from './outboundHubTypes';
import { OUTBOUND_LIST_PATH, outboundOutsourceEntryPath } from './outboundPaths';
import { resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import {
  draftOptionalNumber,
  mergeMaterialIssueQuantities,
  usePullEntryFormDraft,
} from '../shared/pullEntryFormDraft';

type IssueLine = {
  key: number;
  materialId: number;
  materialCode: string;
  materialName: string;
  unit: string;
  pendingQuantity: number;
  issueQuantity: number;
};

const OutboundOutsourcePullEntryPage: React.FC = () => {
  const { t } = useTranslation();
  const pullFromOutsourceWorkOrderAction = resolveKuaizhizaoDocumentAction(t, 'outbound.pull_from_outsource_work_order');
  const { woId: woIdParam } = useParams<{ woId: string }>();
  const woId = Number(woIdParam);
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const initRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [workOrder, setWorkOrder] = useState<Record<string, unknown> | null>(null);
  const [warehouseOptions, setWarehouseOptions] = useState<{ label: string; value: number; name: string }[]>([]);
  const [warehouseId, setWarehouseId] = useState<number | undefined>();
  const [notes, setNotes] = useState('');
  const [issueLines, setIssueLines] = useState<IssueLine[]>([]);
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const { bindSnapshot, persistNow, clearDraft, applyDraftOnce } = usePullEntryFormDraft(
    'kuaizhizao:outbound-outsource-pull',
  );

  const pagePath = Number.isFinite(woId) && woId > 0 ? outboundOutsourceEntryPath(woId) : OUTBOUND_LIST_PATH;
  const woCode = String(workOrder?.code ?? '');
  const pageTitle = woCode
    ? `${pullFromOutsourceWorkOrderAction.label} — ${woCode}`
    : pullFromOutsourceWorkOrderAction.label;

  const totalIssueQty = useMemo(
    () => issueLines.reduce((sum, line) => sum + Number(line.issueQuantity || 0), 0),
    [issueLines],
  );

  const lineColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.warehouseOutbound.col.materialCode'), dataIndex: 'materialCode', width: 120 },
      { title: t('app.kuaizhizao.warehouseOutbound.col.materialName'), dataIndex: 'materialName', ellipsis: true },
      {
        title: t('app.kuaizhizao.warehouseOutbound.entry.pendingIssueQty'),
        dataIndex: 'pendingQuantity',
        width: 100,
        align: 'right' as const,
      },
      {
        title: t('app.kuaizhizao.warehouseOutbound.entry.thisIssue'),
        key: 'issueQuantity',
        width: 140,
        render: (_: unknown, line: IssueLine) => (
          <InputNumber
            min={0}
            max={line.pendingQuantity}
            value={line.issueQuantity}
            onChange={(v) => {
              const qty = Number(v ?? 0);
              setIssueLines((prev) =>
                prev.map((row) =>
                  row.key === line.key ? { ...row, issueQuantity: qty } : row,
                ),
              );
            }}
            style={{ width: '100%' }}
          />
        ),
      },
      { title: t('app.kuaizhizao.warehouseOutbound.col.unit'), dataIndex: 'unit', width: 60 },
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
      issueQuantities: Object.fromEntries(issueLines.map((line) => [line.materialId, line.issueQuantity])),
    }));
    persistNow();
  }, [warehouseId, notes, issueLines, bindSnapshot, persistNow]);

  useEffect(() => {
    if (!(Number.isFinite(woId) && woId > 0)) {
      messageApi.error(t('app.kuaizhizao.warehouseOutbound.entry.invalidOutsource'));
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
        const [owo, whRes, preview] = await Promise.all([
          outsourceWorkOrderApi.get(String(woId)),
          masterWarehouseApi.list({ is_active: true, limit: 500 }),
          outsourceMaterialIssueApi.issuePreview(woId),
        ]);
        setWorkOrder(owo as Record<string, unknown>);
        setWarehouseOptions(mapWarehouseSelectOptions(whRes));
        setPreviewMessage(preview?.message ?? preview?.data?.message ?? null);
        const rawLines = preview?.lines ?? preview?.data?.lines ?? [];
        setIssueLines(
          rawLines.map((line: Record<string, unknown>) => {
            const materialId = Number(line.materialId ?? line.material_id);
            const pending = Number(line.pendingQuantity ?? line.pending_quantity ?? 0);
            return {
              key: materialId,
              materialId,
              materialCode: String(line.materialCode ?? line.material_code ?? ''),
              materialName: String(line.materialName ?? line.material_name ?? ''),
              unit: String(line.unit ?? ''),
              pendingQuantity: pending,
              issueQuantity: pending > 0 ? pending : 0,
            };
          }),
        );
        applyDraftOnce((draft) => {
          const whId = draftOptionalNumber(draft.warehouseId);
          if (whId != null) setWarehouseId(whId);
          if (typeof draft.notes === 'string') setNotes(draft.notes);
          if (draft.issueQuantities) {
            setIssueLines((prev) =>
              mergeMaterialIssueQuantities(prev, draft.issueQuantities as Record<number, number>),
            );
          }
        });
      } catch (e: unknown) {
        messageApi.error((e as Error)?.message || t('app.kuaizhizao.warehouseOutbound.entry.loadOutsourceFailed'));
        leavePage();
      } finally {
        setLoading(false);
      }
    })();
  }, [woId, leavePage, messageApi, t, applyDraftOnce]);

  const submit = async () => {
    if (!warehouseId || !(warehouseId > 0)) {
      messageApi.error(t('app.kuaizhizao.warehouseOutbound.msg.selectWarehouse'));
      return;
    }
    const whOpt = warehouseOptions.find((o) => o.value === warehouseId);
    if (!whOpt) return;

    const activeLines = issueLines.filter((line) => line.issueQuantity > 0);
    if (!activeLines.length) {
      messageApi.warning(t('app.kuaizhizao.warehouseOutbound.entry.fillIssueQty'));
      return;
    }

    setSubmitting(true);
    try {
      await outsourceMaterialIssueApi.createBatch({
        outsource_work_order_id: woId,
        outsource_work_order_code: woCode,
        warehouse_id: warehouseId,
        warehouse_name: whOpt.name,
        remarks: notes.trim() || undefined,
        lines: activeLines.map((line) => ({
          material_id: line.materialId,
          material_code: line.materialCode,
          material_name: line.materialName,
          quantity: line.issueQuantity,
          unit: line.unit,
        })),
      });
      invalidateMenuBadgeCounts();
      clearDraft();
      messageApi.success(t('app.kuaizhizao.warehouseOutbound.entry.outsourceIssueCreated'));
      leavePage();
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
            <Button type="primary" loading={submitting} disabled={loading} onClick={() => void submit()}>
              {t('app.kuaizhizao.warehouseOutbound.action.confirmIssue')}
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
                    <ReadOnlyFormValue value={getOutboundIssueTypeLabel(t, 'outsource_issue')} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Form.Item label={t('app.kuaizhizao.warehouseOutbound.entry.outsourceCode')}>
                    <ReadOnlyFormValue value={woCode} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Form.Item label={t('app.kuaizhizao.warehouseOutbound.entry.product')}>
                    <ReadOnlyFormValue value={String(workOrder.product_name ?? workOrder.productName ?? '')} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Form.Item label={t('app.kuaizhizao.warehouseOutbound.entry.outsourceSupplier')}>
                    <ReadOnlyFormValue value={String(workOrder.supplier_name ?? workOrder.supplierName ?? '')} />
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
                <Col xs={24}>
                  <OutboundEntryRemarksSection value={notes} onChange={setNotes} />
                </Col>
              </Row>
              {previewMessage ? (
                <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                  {previewMessage}
                </Typography.Text>
              ) : null}
              <Typography.Text strong style={{ display: 'block', marginTop: 16, marginBottom: 8 }}>
                {t('app.kuaizhizao.warehouseOutbound.entry.issueDetails')}
                <Typography.Text type="secondary" style={{ marginLeft: 12, fontWeight: 'normal' }}>
                  {t('app.kuaizhizao.warehouseOutbound.entry.totalIssueQty', { qty: totalIssueQty })}
                </Typography.Text>
              </Typography.Text>
              <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
              <Table
                className="warehouse-detail-table"
                size="small"
                rowKey="key"
                pagination={false}
                dataSource={issueLines}
                columns={lineColumns}
              />
            </Form>
          )}
        </Card>
      </Spin>
    </DocumentFormPageLayout>
  );
};

export default OutboundOutsourcePullEntryPage;
