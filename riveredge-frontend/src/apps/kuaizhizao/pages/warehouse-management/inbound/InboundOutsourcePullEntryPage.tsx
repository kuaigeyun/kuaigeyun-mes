/**
 * 从委外工单取单开入库 — 独立 Tab 页（委外收货/退料/退货）
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { INBOUND_RECEIPT_TYPE_LABELS } from './inboundHubTypes';
import type { InboundReceiptType } from './inboundHubTypes';
import {
  InboundEntryReceiverField,
  InboundEntryRemarksSection,
  ReadOnlyFormValue,
  mapWarehouseSelectOptions,
  useInboundReceiverSelect,
} from './inboundEntryShared';
import { INBOUND_LIST_PATH, inboundOutsourceEntryPath } from './inboundPaths';

const PULL_TYPE_OPTIONS: { label: string; value: InboundOutsourcePullType }[] = [
  { label: '委外收货', value: 'outsource_receipt' },
  { label: '委外退料', value: 'outsource_material_return' },
  { label: '委外退货', value: 'outsource_product_return' },
];

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

  const receiptType = PULL_TYPE_TO_RECEIPT_TYPE[pullType];
  const inboundTypeLabel = INBOUND_RECEIPT_TYPE_LABELS[receiptType];
  const pagePath = Number.isFinite(woId) && woId > 0 ? inboundOutsourceEntryPath(woId, pullType) : INBOUND_LIST_PATH;
  const woCode = String(workOrder?.code || woId || '');
  const needsWarehouse = pullType === 'outsource_receipt' || pullType === 'outsource_material_return';

  const leavePage = useCallback(() => {
    navigate(INBOUND_LIST_PATH);
  }, [navigate]);

  useEffect(() => {
    if (!(Number.isFinite(woId) && woId > 0)) {
      messageApi.error('无效的委外工单');
      leavePage();
    }
  }, [woId, leavePage, messageApi]);

  useEffect(() => {
    const title = woCode ? `${inboundTypeLabel} — ${woCode}` : inboundTypeLabel;
    setCustomPageTitle(pagePath, title);
    window.dispatchEvent(
      new CustomEvent('riveredge:update-tab-title', {
        detail: { key: pagePath, path: pagePath, title },
      }),
    );
    return () => {
      removeCustomPageTitle(pagePath);
    };
  }, [woCode, pagePath, inboundTypeLabel]);

  useEffect(() => {
    if (!Number.isFinite(woId) || woId <= 0) return;
    initRef.current = false;
  }, [woId, pullType]);

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
            messageApi.warning(preview?.message || '该委外工单暂无可退料明细');
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
            messageApi.warning(preview?.message || '该委外工单暂无可退货明细');
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
      } catch (e: unknown) {
        messageApi.error((e as Error)?.message || '加载委外工单失败');
        leavePage();
      } finally {
        setLoading(false);
      }
    })();
  }, [woId, pullType, leavePage, messageApi]);

  const receiptTableData = useMemo(() => (receiptLine ? [receiptLine] : []), [receiptLine]);

  const submit = async (mode: 'draft' | 'confirm') => {
    if (!workOrder) return;
    if (needsWarehouse && (!warehouseId || !(warehouseId > 0))) {
      messageApi.warning('请选择仓库');
      return;
    }
    const whOpt = warehouseOptions.find((w) => w.value === warehouseId);

    setSubmitting(true);
    try {
      const createdIds: number[] = [];

      if (pullType === 'outsource_receipt') {
        if (!receiptLine || receiptLine.receiptQuantity <= 0) {
          messageApi.warning('该委外工单暂无可收货数量');
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
          messageApi.success(`已生成委外收货草稿${created.receipt_code ? `：${created.receipt_code}` : ''}`);
        }
      } else if (pullType === 'outsource_material_return') {
        for (const line of previewLines) {
          if (!line.issue_id || line.return_quantity <= 0) continue;
          if (line.return_quantity > line.returnable_quantity) {
            messageApi.error(`物料 ${line.material_code || line.material_name} 的退料数量不能超过可退数量`);
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
          messageApi.warning('请至少填写一行退料数量');
          return;
        }
        if (mode === 'draft') {
          messageApi.success(`已生成 ${createdIds.length} 张委外退料草稿`);
        }
      } else {
        for (const line of previewLines) {
          if (!line.receipt_id || line.return_quantity <= 0) continue;
          if (line.return_quantity > line.returnable_quantity) {
            messageApi.error('退货数量不能超过可退数量');
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
          messageApi.warning('请至少填写一行退货数量');
          return;
        }
        if (mode === 'draft') {
          messageApi.success(`已生成 ${createdIds.length} 张委外退货草稿`);
        }
      }

      invalidateMenuBadgeCounts();
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
          messageApi.success(`已生成 ${createdIds.length} 张草稿，请在列表中分别确认`);
          leavePage();
        }
      } else {
        leavePage();
      }
    } catch (e: unknown) {
      messageApi.error((e as Error)?.message || '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DocumentFormPageLayout
      header={
        <>
          <Space align="center" size={8}>
            <Button type="text" icon={<ArrowLeftOutlined />} aria-label="返回" onClick={leavePage} />
            <Typography.Title level={4} style={DOCUMENT_DETAIL_PAGE_TITLE_STYLE}>
              {woCode ? `${inboundTypeLabel} — ${woCode}` : inboundTypeLabel}
            </Typography.Title>
          </Space>
          <Space wrap>
            <Button disabled={submitting || loading} onClick={leavePage}>
              取消
            </Button>
            <Button loading={submitting} disabled={loading} onClick={() => void submit('draft')}>
              生成草稿
            </Button>
            <Button type="primary" loading={submitting} disabled={loading} onClick={() => void submit('confirm')}>
              确认入库
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
                    <Form.Item label="入库类型">
                      <ReadOnlyFormValue value={inboundTypeLabel} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label="委外工单号">
                      <ReadOnlyFormValue value={woCode} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label="产品">
                      <ReadOnlyFormValue
                        value={workOrder.product_name ? String(workOrder.product_name) : undefined}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label="委外供应商">
                      <ReadOnlyFormValue
                        value={workOrder.supplier_name ? String(workOrder.supplier_name) : undefined}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label="工单状态">
                      <ReadOnlyFormValue value={workOrder.status ? String(workOrder.status) : undefined} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label="计划数量">
                      <ReadOnlyFormValue
                        value={workOrder.quantity != null ? String(workOrder.quantity) : undefined}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label="业务类型">
                      <Select
                        style={{ width: '100%' }}
                        value={pullType}
                        options={PULL_TYPE_OPTIONS}
                        onChange={(v) => navigate(inboundOutsourceEntryPath(woId, v))}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label="入库日期">
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
                      <Form.Item label={pullType === 'outsource_material_return' ? '退料入库仓库' : '入库仓库'} required>
                        <Select
                          style={{ width: '100%' }}
                          placeholder="请选择仓库"
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
                <UniTableDetailHeader title="收货明细" required />
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
                      columns={[
                        { title: '产品编码', dataIndex: 'productCode', width: 120, ellipsis: true },
                        { title: '产品名称', dataIndex: 'productName', width: 160, ellipsis: true },
                        { title: '单位', dataIndex: 'unit', width: 70, align: 'center' },
                        { title: '委外数量', dataIndex: 'orderedQuantity', width: 100, align: 'right' },
                        { title: '已收', dataIndex: 'receivedQuantity', width: 90, align: 'right' },
                        { title: '待收', dataIndex: 'pendingQuantity', width: 90, align: 'right' },
                        {
                          title: '本次收货',
                          width: 120,
                          align: 'right',
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
                          title: '合格',
                          width: 110,
                          align: 'right',
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
                          title: '不合格',
                          width: 110,
                          align: 'right',
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
                      ]}
                    />
                  </div>
                </div>
              </div>
            )}

            {pullType === 'outsource_material_return' && previewLines.length > 0 && (
              <div className="uni-table-detail" style={{ marginTop: PAGE_SPACING.BLOCK_GAP }}>
                <UniTableDetailHeader title="退料明细" required />
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
                      columns={[
                        { title: '物料编号', dataIndex: 'material_code', width: 120, ellipsis: true },
                        { title: '物料名称', dataIndex: 'material_name', width: 150, ellipsis: true },
                        { title: '单位', dataIndex: 'unit', width: 70, align: 'center' },
                        { title: '可退数量', dataIndex: 'returnable_quantity', width: 100, align: 'right' },
                        {
                          title: '本次退料',
                          width: 130,
                          align: 'right',
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
                      ]}
                    />
                  </div>
                </div>
              </div>
            )}

            {pullType === 'outsource_product_return' && previewLines.length > 0 && (
              <div className="uni-table-detail" style={{ marginTop: PAGE_SPACING.BLOCK_GAP }}>
                <UniTableDetailHeader title="退货明细" required />
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
                      columns={[
                        { title: '收货单', dataIndex: 'receipt_id', width: 100 },
                        { title: '单位', dataIndex: 'unit', width: 70, align: 'center' },
                        { title: '可退数量', dataIndex: 'returnable_quantity', width: 100, align: 'right' },
                        {
                          title: '本次退货',
                          width: 130,
                          align: 'right',
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
                      ]}
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
