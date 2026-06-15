/**
 * 从生产工单取单开生产退料入库 — 独立 Tab 页
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
import { PRODUCTION_PICKING_ELIGIBLE_STATUSES } from './inboundCreateConfig';
import {
  InboundEntryReceiverField,
  InboundEntryRemarksSection,
  ReadOnlyFormValue,
  mapWarehouseSelectOptions,
  useInboundReceiverSelect,
} from './inboundEntryShared';
import { INBOUND_LIST_PATH, inboundProductionReturnEntryPath } from './inboundPaths';

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
  const { message: messageApi } = App.useApp();
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const receiverHook = useInboundReceiverSelect();
  const initRef = useRef(false);

  const [loading, setLoading] = useState(false);
  const [pickingLoading, setPickingLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [workOrder, setWorkOrder] = useState<Record<string, unknown> | null>(null);
  const [pickingOptions, setPickingOptions] = useState<{ label: string; value: number }[]>([]);
  const [pickingId, setPickingId] = useState<number | null>(null);
  const [pickingCode, setPickingCode] = useState('');
  const [lines, setLines] = useState<ReturnLine[]>([]);
  const [warehouseOptions, setWarehouseOptions] = useState<{ label: string; value: number; name: string }[]>([]);
  const [warehouseId, setWarehouseId] = useState<number | undefined>();
  const [returnTime, setReturnTime] = useState(() => dayjs());
  const [returnNotes, setReturnNotes] = useState('');

  const pagePath =
    Number.isFinite(workOrderId) && workOrderId > 0
      ? inboundProductionReturnEntryPath(workOrderId)
      : INBOUND_LIST_PATH;
  const woCode = String(workOrder?.code || workOrderId || '');

  const totalReturnQty = useMemo(
    () => lines.reduce((sum, it) => sum + Number(it.return_quantity ?? 0), 0),
    [lines],
  );

  const leavePage = useCallback(() => {
    navigate(INBOUND_LIST_PATH);
  }, [navigate]);

  const loadPickings = useCallback(async (woId: number) => {
    setPickingLoading(true);
    try {
      const res = await warehouseApi.productionPicking.list({
        work_order_id: woId,
        skip: 0,
        limit: 100,
      });
      const list = Array.isArray(res)
        ? res
        : (res as { data?: unknown[]; items?: unknown[] })?.data
          ?? (res as { items?: unknown[] })?.items
          ?? [];
      const eligible = list.filter((p: { status?: string }) =>
        PRODUCTION_PICKING_ELIGIBLE_STATUSES.includes(String(p.status || '')),
      );
      setPickingOptions(
        eligible.map((p: { id?: number; picking_code?: string; code?: string; status?: string }) => ({
          value: Number(p.id),
          label: `${p.picking_code || p.code || p.id} - ${p.status || ''}`,
        })),
      );
    } catch {
      setPickingOptions([]);
      messageApi.error('加载领料单失败');
    } finally {
      setPickingLoading(false);
    }
  }, [messageApi]);

  const loadPickingLines = useCallback(async (nextPickingId: number) => {
    setPickingLoading(true);
    try {
      const pickingDetail = (await warehouseApi.productionPicking.get(String(nextPickingId))) as {
        picking_code?: string;
        code?: string;
        items?: Array<Record<string, unknown>>;
      };
      setPickingCode(pickingDetail.picking_code || pickingDetail.code || '');
      const nextLines = (pickingDetail.items ?? [])
        .filter((it) => Number(it.picked_quantity ?? it.pickedQuantity ?? 0) > 0)
        .map((it, idx) => {
          const picked = Number(it.picked_quantity ?? it.pickedQuantity ?? 0) || 0;
          return {
            key: Number(it.id ?? idx),
            picking_item_id: it.id != null ? Number(it.id) : undefined,
            material_id: it.material_id != null ? Number(it.material_id) : undefined,
            material_code: String(it.material_code || ''),
            material_name: String(it.material_name || ''),
            material_spec: it.material_spec ? String(it.material_spec) : undefined,
            material_unit: String(it.material_unit || '个'),
            picked_quantity: picked,
            return_quantity: picked,
          };
        });
      setLines(nextLines);
      if (!nextLines.length) {
        messageApi.warning('所选领料单无可用退料明细');
      }
    } catch (e: unknown) {
      setLines([]);
      messageApi.error((e as Error)?.message || '加载领料明细失败');
    } finally {
      setPickingLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    if (!(Number.isFinite(workOrderId) && workOrderId > 0)) {
      messageApi.error('无效的生产工单');
      leavePage();
    }
  }, [workOrderId, leavePage, messageApi]);

  useEffect(() => {
    const title = woCode ? `生产退料 — ${woCode}` : '生产退料';
    setCustomPageTitle(pagePath, title);
    window.dispatchEvent(
      new CustomEvent('riveredge:update-tab-title', {
        detail: { key: pagePath, path: pagePath, title },
      }),
    );
    return () => {
      removeCustomPageTitle(pagePath);
    };
  }, [woCode, pagePath]);

  useEffect(() => {
    if (!Number.isFinite(workOrderId) || workOrderId <= 0 || initRef.current) return;
    initRef.current = true;
    void (async () => {
      setLoading(true);
      try {
        const [woRaw, whRes] = await Promise.all([
          workOrderApi.get(String(workOrderId)),
          masterWarehouseApi.list({ is_active: true, limit: 500 }),
        ]);
        setWorkOrder(woRaw as Record<string, unknown>);
        setWarehouseOptions(mapWarehouseSelectOptions(whRes));
        await loadPickings(workOrderId);
      } catch (e: unknown) {
        messageApi.error((e as Error)?.message || '加载生产工单失败');
        leavePage();
      } finally {
        setLoading(false);
      }
    })();
  }, [workOrderId, leavePage, loadPickings, messageApi]);

  const submit = async (mode: 'draft' | 'confirm') => {
    if (!pickingId) {
      messageApi.warning('请选择领料单');
      return;
    }
    if (!warehouseId || !(warehouseId > 0)) {
      messageApi.warning('请选择退料仓库');
      return;
    }
    const whOpt = warehouseOptions.find((w) => w.value === warehouseId);
    if (!whOpt) return;

    const activeLines = lines.filter((it) => it.return_quantity > 0);
    if (!activeLines.length) {
      messageApi.warning('请至少填写一行退料数量');
      return;
    }
    for (const it of activeLines) {
      if (it.return_quantity > it.picked_quantity) {
        messageApi.error(`物料 ${it.material_code || it.material_name} 的退料数量不能超过已领数量 ${it.picked_quantity}`);
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
        return_time: returnTime?.toISOString(),
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
        messageApi.error('创建成功但未返回退料单 ID');
        return;
      }
      invalidateMenuBadgeCounts();
      if (mode === 'confirm') {
        navigate(INBOUND_LIST_PATH, {
          state: {
            inboundDirectConfirm: {
              id: Number(created.id),
              receipt_type: 'production_return',
            },
          },
        });
      } else {
        messageApi.success(`已生成生产退料草稿${created.return_code ? `：${created.return_code}` : ''}`);
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
              {woCode ? `生产退料 — ${woCode}` : '生产退料'}
            </Typography.Title>
          </Space>
          <Space wrap>
            <Button disabled={submitting || loading} onClick={leavePage}>
              取消
            </Button>
            <Button loading={submitting} disabled={loading || pickingLoading} onClick={() => void submit('draft')}>
              生成草稿
            </Button>
            <Button
              type="primary"
              loading={submitting}
              disabled={loading || pickingLoading}
              onClick={() => void submit('confirm')}
            >
              确认入库
            </Button>
          </Space>
        </>
      }
    >
      <Spin spinning={loading || pickingLoading}>
        <Card styles={{ body: { padding: PAGE_SPACING.PADDING } }}>
          <div className="form-modal-content-inner">
            {workOrder && (
              <Form layout="vertical" requiredMark={false}>
                <Row gutter={16}>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label="入库类型">
                      <ReadOnlyFormValue value="生产退料" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label="工单号">
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
                    <Form.Item label="工单状态">
                      <ReadOnlyFormValue value={workOrder.status ? String(workOrder.status) : undefined} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label="领料单" required>
                      <Select
                        placeholder="请选择领料单"
                        showSearch
                        style={{ width: '100%' }}
                        value={pickingId ?? undefined}
                        options={pickingOptions}
                        filterOption={(input, opt) =>
                          (opt?.label ?? '').toString().toLowerCase().includes((input ?? '').toLowerCase())
                        }
                        onChange={(v) => {
                          const next = v ? Number(v) : null;
                          setPickingId(next);
                          setLines([]);
                          if (next) void loadPickingLines(next);
                        }}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label="退料日期">
                      <DatePicker
                        style={{ width: '100%' }}
                        value={returnTime}
                        onChange={(v) => setReturnTime(v ?? dayjs())}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <InboundEntryReceiverField label="退料人" hook={receiverHook} />
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label="退料仓库" required>
                      <Select
                        placeholder="请选择退料仓库"
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
                    <Form.Item label="本次合计数量">
                      <ReadOnlyFormValue value={totalReturnQty.toLocaleString()} />
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
            )}

            {lines.length > 0 && (
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
                      scroll={{ x: 1000 }}
                      dataSource={lines}
                      columns={[
                        { title: '物料编号', dataIndex: 'material_code', width: 120, ellipsis: true },
                        { title: '物料名称', dataIndex: 'material_name', width: 150, ellipsis: true },
                        { title: '规格', dataIndex: 'material_spec', width: 120, ellipsis: true, render: (v) => v || '—' },
                        { title: '单位', dataIndex: 'material_unit', width: 70, align: 'center' },
                        { title: '已领数量', dataIndex: 'picked_quantity', width: 100, align: 'right' },
                        {
                          title: '本次退料',
                          width: 130,
                          align: 'right',
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
                      ]}
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
                  label="退料备注"
                  placeholder="退料单备注"
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
