/**
 * 从生产工单取单开入库单 — 独立 Tab 页（成品/半成品）
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { INBOUND_RECEIPT_TYPE_LABELS } from './inboundHubTypes';
import { INBOUND_LIST_PATH, inboundWorkOrderEntryPath } from './inboundPaths';
import type { InboundReceiptType } from './inboundHubTypes';

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

  const line = preview?.lines?.[0];
  const receiptType: InboundReceiptType = preview?.inbound_doc_kind ?? 'finished_goods';
  const inboundTypeLabel = INBOUND_RECEIPT_TYPE_LABELS[receiptType];
  const pagePath = Number.isFinite(woId) && woId > 0 ? inboundWorkOrderEntryPath(woId) : INBOUND_LIST_PATH;
  const maxQty = Number(line?.source_pending_quantity ?? 0);

  const leavePage = useCallback(() => {
    navigate(INBOUND_LIST_PATH);
  }, [navigate]);

  useEffect(() => {
    if (!(Number.isFinite(woId) && woId > 0)) {
      messageApi.error('无效的生产工单');
      leavePage();
    }
  }, [woId, leavePage, messageApi]);

  useEffect(() => {
    const title = preview?.work_order_code ? `${inboundTypeLabel} — ${preview.work_order_code}` : inboundTypeLabel;
    setCustomPageTitle(pagePath, title);
    window.dispatchEvent(
      new CustomEvent('riveredge:update-tab-title', {
        detail: { key: pagePath, path: pagePath, title },
      }),
    );
    return () => {
      removeCustomPageTitle(pagePath);
    };
  }, [preview?.work_order_code, pagePath, inboundTypeLabel]);

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
          messageApi.warning(previewRaw?.message || '该工单无可入库明细');
          leavePage();
          return;
        }
        setWarehouseOptions(mapWarehouseSelectOptions(whRes));
        setPreview(previewRaw);
        setWorkOrder(woRaw as Record<string, unknown>);
        const firstLine = previewRaw.lines[0];
        setReceiptQty(Number(firstLine.receipt_quantity ?? firstLine.source_pending_quantity ?? 0));
      } catch (e: unknown) {
        messageApi.error((e as Error)?.message || '加载工单入库预览失败');
        leavePage();
      } finally {
        setLoading(false);
      }
    })();
  }, [woId, leavePage, messageApi]);

  const submit = async (mode: 'draft' | 'confirm') => {
    if (!preview || !line) return;
    const qty = Number(receiptQty);
    if (!(qty > 0)) {
      messageApi.warning('请填写本次入库数量');
      return;
    }
    if (maxQty > 0 && qty > maxQty) {
      messageApi.error(`本次入库数量不能超过待入库数量 ${maxQty}`);
      return;
    }
    if (!warehouseId || !(warehouseId > 0)) {
      messageApi.error('请选择入库仓库');
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
          messageApi.success(`已生成半成品入库草稿${created.receipt_code ? `：${created.receipt_code}` : ''}`);
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
          messageApi.success(`已生成成品入库草稿${created.receipt_code ? `：${created.receipt_code}` : ''}`);
        }
      }

      if (createdId == null) {
        messageApi.error('下推成功但未返回入库单 ID');
        return;
      }
      invalidateMenuBadgeCounts();
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
      messageApi.error(err?.message || err?.response?.data?.detail || '保存失败');
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
              {preview?.work_order_code ? `${inboundTypeLabel} — ${preview.work_order_code}` : inboundTypeLabel}
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
            {preview && line && (
              <Form layout="vertical" requiredMark={false}>
                <Row gutter={16}>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label="入库类型">
                      <ReadOnlyFormValue value={inboundTypeLabel} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label="工单号">
                      <ReadOnlyFormValue value={preview.work_order_code} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label="产品">
                      <ReadOnlyFormValue value={line.material_name} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label="产品编码">
                      <ReadOnlyFormValue value={line.material_code} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label="计划数量">
                      <ReadOnlyFormValue value={line.source_doc_quantity} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label="已入库">
                      <ReadOnlyFormValue value={line.source_received_quantity} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label="待入库">
                      <ReadOnlyFormValue value={line.source_pending_quantity} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label="源销售订单">
                      <ReadOnlyFormValue value={workOrder?.sales_order_code ? String(workOrder.sales_order_code) : undefined} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label="工单状态">
                      <ReadOnlyFormValue value={workOrder?.status ? String(workOrder.status) : undefined} />
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
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label="默认入库仓库" required>
                      <Select
                        style={{ width: '100%' }}
                        placeholder="请选择入库仓库"
                        showSearch
                        optionFilterProp="label"
                        value={warehouseId}
                        options={warehouseOptions}
                        onChange={(v) => setWarehouseId(v ?? undefined)}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label="工单交期">
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
                <UniTableDetailHeader title="入库明细" required />
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
                      columns={[
                        { title: '物料编号', dataIndex: 'material_code', width: 120, ellipsis: true },
                        { title: '物料名称', dataIndex: 'material_name', width: 150, ellipsis: true },
                        { title: '规格', dataIndex: 'material_spec', width: 120, ellipsis: true, render: (v) => v || '—' },
                        { title: '单位', dataIndex: 'material_unit', width: 70, align: 'center' },
                        { title: '计划数量', dataIndex: 'source_doc_quantity', width: 100, align: 'right' },
                        { title: '已入库', dataIndex: 'source_received_quantity', width: 90, align: 'right' },
                        { title: '待入库', dataIndex: 'source_pending_quantity', width: 90, align: 'right' },
                        {
                          title: '入库仓库',
                          width: 150,
                          render: () => (
                            <Select
                              style={{ width: '100%', minWidth: 118 }}
                              placeholder="请选择"
                              showSearch
                              optionFilterProp="label"
                              value={warehouseId}
                              options={warehouseOptions}
                              onChange={(v) => setWarehouseId(v ?? undefined)}
                            />
                          ),
                        },
                        {
                          title: '本次入库',
                          width: 130,
                          align: 'right',
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
                      ]}
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
