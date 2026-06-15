/**
 * 从生产工单取单开生产领料 — 独立 Tab 页
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { App, Button, Card, Col, Form, Row, Select, Space, Spin, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import {
  DOCUMENT_DETAIL_PAGE_TITLE_STYLE,
  DocumentFormPageLayout,
  PAGE_SPACING,
} from '../../../../../components/layout-templates';
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
import { OUTBOUND_LIST_PATH, outboundWorkOrderEntryPath } from './outboundPaths';

const OutboundWorkOrderPullEntryPage: React.FC = () => {
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

  const pagePath = Number.isFinite(woId) && woId > 0 ? outboundWorkOrderEntryPath(woId) : OUTBOUND_LIST_PATH;
  const woCode = String(workOrder?.code ?? workOrder?.work_order_code ?? '');

  const leavePage = useCallback(() => {
    navigate(OUTBOUND_LIST_PATH);
  }, [navigate]);

  useEffect(() => {
    if (!(Number.isFinite(woId) && woId > 0)) {
      messageApi.error('无效的生产工单');
      leavePage();
    }
  }, [woId, leavePage, messageApi]);

  useEffect(() => {
    const title = woCode ? `生产领料 — ${woCode}` : '生产领料';
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
      } catch (e: unknown) {
        messageApi.error((e as Error)?.message || '加载工单失败');
        leavePage();
      } finally {
        setLoading(false);
      }
    })();
  }, [woId, leavePage, messageApi]);

  const submit = async (mode: 'draft' | 'confirm') => {
    if (!warehouseId || !(warehouseId > 0)) {
      messageApi.error('请选择出库仓库');
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
        messageApi.error('下推成功但未返回领料单 ID');
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
        messageApi.success(`已生成生产领料草稿${created.picking_code ? `：${created.picking_code}` : ''}`);
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
              {woCode ? `生产领料 — ${woCode}` : '生产领料'}
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
              确认出库
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
                  <Form.Item label="出库类型">
                    <ReadOnlyFormValue value="生产领料" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Form.Item label="工单号">
                    <ReadOnlyFormValue value={woCode} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Form.Item label="产品">
                    <ReadOnlyFormValue value={String(workOrder.product_name ?? workOrder.name ?? '')} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Form.Item label="工单状态">
                    <ReadOnlyFormValue value={String(workOrder.status ?? '')} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Form.Item label="计划数量">
                    <ReadOnlyFormValue value={String(workOrder.quantity ?? '')} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Form.Item label="计划开工">
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
                  <Form.Item label="出库仓库" required>
                    <Select
                      style={{ width: '100%' }}
                      placeholder="请选择出库仓库"
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
        </Card>
      </Spin>
    </DocumentFormPageLayout>
  );
};

export default OutboundWorkOrderPullEntryPage;
