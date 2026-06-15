/**
 * 从销售订单取单开销售退货入库 — 独立 Tab 页
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
import type { UploadFile } from 'antd/es/upload/interface';
import { warehouseApi as masterWarehouseApi } from '../../../../master-data/services/warehouse';
import { getSalesOrder } from '../../../services/sales-order';
import { warehouseApi } from '../../../services/warehouse-execution';
import { normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { setCustomPageTitle, removeCustomPageTitle } from '../../../../../utils/customPageTitle';
import { formatDateBySiteSetting } from '../../../../../utils/format';
import {
  InboundEntryAttachmentsSection,
  InboundEntryReceiverField,
  InboundEntryRemarksSection,
  ReadOnlyFormValue,
  mapWarehouseSelectOptions,
  useInboundReceiverSelect,
} from './inboundEntryShared';
import { INBOUND_LIST_PATH, inboundSalesReturnEntryPath } from './inboundPaths';

type PreviewLine = {
  sales_order_item_id?: number;
  material_id: number;
  material_code: string;
  material_name: string;
  material_spec?: string;
  material_unit: string;
  source_doc_quantity?: number;
  source_received_quantity?: number;
  source_pending_quantity?: number;
  return_quantity?: number;
  unit_price?: number;
};

type SalesReturnPreview = {
  sales_order_id: number;
  sales_order_code: string;
  lines: PreviewLine[];
  message?: string;
};

const InboundSalesReturnPullEntryPage: React.FC = () => {
  const { salesOrderId: salesOrderIdParam } = useParams<{ salesOrderId: string }>();
  const salesOrderId = Number(salesOrderIdParam);
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const receiverHook = useInboundReceiverSelect();
  const initRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<SalesReturnPreview | null>(null);
  const [order, setOrder] = useState<Record<string, unknown> | null>(null);
  const [warehouseOptions, setWarehouseOptions] = useState<{ label: string; value: number; name: string }[]>([]);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [defaultWarehouseId, setDefaultWarehouseId] = useState<number | undefined>();
  const [lineWh, setLineWh] = useState<Record<number, number>>({});
  const [returnTime, setReturnTime] = useState(() => dayjs());
  const [returnNotes, setReturnNotes] = useState('');
  const [attachments, setAttachments] = useState<UploadFile[]>([]);

  const lines = preview?.lines ?? [];
  const pagePath =
    Number.isFinite(salesOrderId) && salesOrderId > 0 ? inboundSalesReturnEntryPath(salesOrderId) : INBOUND_LIST_PATH;

  const totalReturnQty = useMemo(
    () =>
      lines.reduce((sum, it) => {
        const itemId = it.sales_order_item_id;
        if (itemId == null) return sum;
        return sum + Number(quantities[itemId] ?? 0);
      }, 0),
    [lines, quantities],
  );

  const leavePage = useCallback(() => {
    navigate(INBOUND_LIST_PATH);
  }, [navigate]);

  useEffect(() => {
    if (!(Number.isFinite(salesOrderId) && salesOrderId > 0)) {
      messageApi.error('无效的销售订单');
      leavePage();
    }
  }, [salesOrderId, leavePage, messageApi]);

  useEffect(() => {
    const title = preview?.sales_order_code ? `销售退货 — ${preview.sales_order_code}` : '销售退货';
    setCustomPageTitle(pagePath, title);
    window.dispatchEvent(
      new CustomEvent('riveredge:update-tab-title', {
        detail: { key: pagePath, path: pagePath, title },
      }),
    );
    return () => {
      removeCustomPageTitle(pagePath);
    };
  }, [preview?.sales_order_code, pagePath]);

  useEffect(() => {
    if (!Number.isFinite(salesOrderId) || salesOrderId <= 0 || initRef.current) return;
    initRef.current = true;
    void (async () => {
      setLoading(true);
      try {
        const [previewRaw, orderRaw, whRes] = await Promise.all([
          warehouseApi.salesReturn.previewFromSalesOrder(salesOrderId) as Promise<SalesReturnPreview>,
          getSalesOrder(salesOrderId),
          masterWarehouseApi.list({ is_active: true, limit: 500 }),
        ]);
        if (!previewRaw?.lines?.length) {
          messageApi.warning(previewRaw?.message || '该销售订单无可退货明细');
          leavePage();
          return;
        }
        setWarehouseOptions(mapWarehouseSelectOptions(whRes));
        const qtyMap: Record<number, number> = {};
        previewRaw.lines.forEach((it) => {
          if (it.sales_order_item_id != null) {
            qtyMap[it.sales_order_item_id] = Number(it.return_quantity ?? it.source_pending_quantity ?? 0);
          }
        });
        setPreview(previewRaw);
        setOrder(orderRaw as Record<string, unknown>);
        setQuantities(qtyMap);
      } catch (e: unknown) {
        messageApi.error((e as Error)?.message || '加载销售订单退货预览失败');
        leavePage();
      } finally {
        setLoading(false);
      }
    })();
  }, [salesOrderId, leavePage, messageApi]);

  const applyDefaultWarehouse = (warehouseId: number) => {
    setDefaultWarehouseId(warehouseId);
    const next: Record<number, number> = { ...lineWh };
    lines.forEach((it) => {
      if (it.sales_order_item_id != null) next[it.sales_order_item_id] = warehouseId;
    });
    setLineWh(next);
  };

  const submit = async (mode: 'draft' | 'confirm') => {
    if (!preview) return;
    let hasPositiveQty = false;
    const returnQuantities: Record<number, number> = {};
    for (const it of lines) {
      const itemId = it.sales_order_item_id;
      if (itemId == null) continue;
      const qty = quantities[itemId] ?? 0;
      const max = Number(it.source_pending_quantity ?? 0);
      if (qty <= 0) continue;
      hasPositiveQty = true;
      if (qty > max) {
        messageApi.error(`物料 ${it.material_code || it.material_name} 的本次退货数量不能超过可退数量 ${max}`);
        return;
      }
      returnQuantities[itemId] = qty;
    }
    if (!hasPositiveQty) {
      messageApi.warning('请至少填写一行本次退货数量');
      return;
    }
    const whId = defaultWarehouseId ?? Object.values(lineWh)[0];
    if (!whId || !(whId > 0)) {
      messageApi.error('请选择退入仓库');
      return;
    }
    const whOpt = warehouseOptions.find((o) => o.value === whId);
    if (!whOpt) return;

    setSubmitting(true);
    try {
      const created = (await warehouseApi.salesReturn.pullFromSalesOrder({
        sales_order_id: salesOrderId,
        warehouse_id: whId,
        warehouse_name: whOpt.name,
        return_quantities: returnQuantities,
      })) as { id?: number; return_code?: string };
      if (created?.id == null) {
        messageApi.error('下推成功但未返回退货单 ID');
        return;
      }
      await warehouseApi.salesReturn.update(String(created.id), {
        return_time: returnTime?.toISOString(),
        returner_name: receiverHook.receiverName.trim() || undefined,
        notes: returnNotes.trim() || undefined,
        attachments: normalizeDocumentAttachments(attachments),
      });
      invalidateMenuBadgeCounts();
      if (mode === 'confirm') {
        navigate(INBOUND_LIST_PATH, {
          state: {
            inboundDirectConfirm: {
              id: Number(created.id),
              receipt_type: 'sales_return',
            },
          },
        });
      } else {
        messageApi.success(`已生成销售退货草稿${created.return_code ? `：${created.return_code}` : ''}`);
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
              {preview?.sales_order_code ? `销售退货 — ${preview.sales_order_code}` : '销售退货'}
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
            {preview && (
              <Form layout="vertical" requiredMark={false}>
                <Row gutter={16}>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label="入库类型">
                      <ReadOnlyFormValue value="销售退货" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label="源单编号">
                      <ReadOnlyFormValue value={preview.sales_order_code} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label="客户">
                      <ReadOnlyFormValue value={order?.customer_name ? String(order.customer_name) : undefined} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label="订单状态">
                      <ReadOnlyFormValue value={order?.status ? String(order.status) : undefined} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label="订单日期">
                      <ReadOnlyFormValue
                        value={order?.order_date ? formatDateBySiteSetting(String(order.order_date)) : undefined}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label="交期">
                      <ReadOnlyFormValue
                        value={order?.delivery_date ? formatDateBySiteSetting(String(order.delivery_date)) : undefined}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label="退货日期">
                      <DatePicker
                        style={{ width: '100%' }}
                        value={returnTime}
                        onChange={(v) => setReturnTime(v ?? dayjs())}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <InboundEntryReceiverField label="退货人" hook={receiverHook} />
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label="默认退入仓库" required>
                      <Select
                        style={{ width: '100%' }}
                        placeholder="请选择，将应用到全部明细"
                        showSearch
                        allowClear
                        optionFilterProp="label"
                        value={defaultWarehouseId}
                        options={warehouseOptions}
                        onChange={(v) => {
                          if (v != null) applyDefaultWarehouse(v);
                          else setDefaultWarehouseId(undefined);
                        }}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label="本次合计数量">
                      <ReadOnlyFormValue value={totalReturnQty.toLocaleString()} />
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
            )}

            {lines.length > 0 && (
              <div className="uni-table-detail" style={{ marginTop: PAGE_SPACING.BLOCK_GAP }}>
                <UniTableDetailHeader title="退货明细" required />
                <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
                <div className="uni-table-detail-body">
                  <div className="uni-table-detail-scroll">
                    <Table
                      className="uni-detail-table warehouse-detail-table"
                      size="small"
                      rowKey={(r) => r.sales_order_item_id ?? r.material_id}
                      pagination={false}
                      scroll={{ x: 1100 }}
                      dataSource={lines}
                      columns={[
                        { title: '物料编号', dataIndex: 'material_code', width: 120, ellipsis: true },
                        { title: '物料名称', dataIndex: 'material_name', width: 150, ellipsis: true },
                        { title: '规格', dataIndex: 'material_spec', width: 120, ellipsis: true, render: (v) => v || '—' },
                        { title: '单位', dataIndex: 'material_unit', width: 70, align: 'center' },
                        { title: '已发货', dataIndex: 'source_doc_quantity', width: 100, align: 'right' },
                        { title: '已退货', dataIndex: 'source_received_quantity', width: 90, align: 'right' },
                        { title: '可退数量', dataIndex: 'source_pending_quantity', width: 90, align: 'right' },
                        {
                          title: '退入仓库',
                          width: 150,
                          render: (_: unknown, record: PreviewLine) =>
                            record.sales_order_item_id != null ? (
                              <Select
                                style={{ width: '100%', minWidth: 118 }}
                                placeholder="请选择"
                                showSearch
                                optionFilterProp="label"
                                value={lineWh[record.sales_order_item_id] ?? defaultWarehouseId}
                                options={warehouseOptions}
                                onChange={(nv) => {
                                  setLineWh((prev) => ({ ...prev, [record.sales_order_item_id!]: nv }));
                                }}
                              />
                            ) : null,
                        },
                        {
                          title: '本次退货',
                          width: 130,
                          align: 'right',
                          render: (_: unknown, record: PreviewLine) =>
                            record.sales_order_item_id != null ? (
                              <InputNumber
                                min={0}
                                max={Number(record.source_pending_quantity ?? 0)}
                                precision={4}
                                value={quantities[record.sales_order_item_id] ?? 0}
                                onChange={(v) =>
                                  setQuantities((prev) => ({
                                    ...prev,
                                    [record.sales_order_item_id!]: Number(v) || 0,
                                  }))
                                }
                                style={{ width: 110 }}
                              />
                            ) : null,
                        },
                      ]}
                    />
                  </div>
                </div>
              </div>
            )}

            {preview && (
              <Form layout="vertical" requiredMark={false} style={{ marginTop: PAGE_SPACING.BLOCK_GAP }}>
                <InboundEntryAttachmentsSection
                  category="sales_return_attachments"
                  fileList={attachments}
                  onChange={setAttachments}
                />
                <InboundEntryRemarksSection
                  value={returnNotes}
                  onChange={setReturnNotes}
                  label="退货备注"
                  placeholder="退货单备注"
                />
              </Form>
            )}
          </div>
        </Card>
      </Spin>
    </DocumentFormPageLayout>
  );
};

export default InboundSalesReturnPullEntryPage;
