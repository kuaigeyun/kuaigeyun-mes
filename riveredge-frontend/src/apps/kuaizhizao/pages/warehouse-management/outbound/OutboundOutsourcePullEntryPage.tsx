/**
 * 从委外工单取单开委外发料 — 独立 Tab 页
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { OUTBOUND_LIST_PATH, outboundOutsourceEntryPath } from './outboundPaths';

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

  const pagePath = Number.isFinite(woId) && woId > 0 ? outboundOutsourceEntryPath(woId) : OUTBOUND_LIST_PATH;
  const woCode = String(workOrder?.code ?? '');

  const totalIssueQty = useMemo(
    () => issueLines.reduce((sum, line) => sum + Number(line.issueQuantity || 0), 0),
    [issueLines],
  );

  const leavePage = useCallback(() => {
    navigate(OUTBOUND_LIST_PATH);
  }, [navigate]);

  useEffect(() => {
    if (!(Number.isFinite(woId) && woId > 0)) {
      messageApi.error('无效的委外工单');
      leavePage();
    }
  }, [woId, leavePage, messageApi]);

  useEffect(() => {
    const title = woCode ? `委外发料 — ${woCode}` : '委外发料';
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
      } catch (e: unknown) {
        messageApi.error((e as Error)?.message || '加载委外工单失败');
        leavePage();
      } finally {
        setLoading(false);
      }
    })();
  }, [woId, leavePage, messageApi]);

  const submit = async () => {
    if (!warehouseId || !(warehouseId > 0)) {
      messageApi.error('请选择出库仓库');
      return;
    }
    const whOpt = warehouseOptions.find((o) => o.value === warehouseId);
    if (!whOpt) return;

    const activeLines = issueLines.filter((line) => line.issueQuantity > 0);
    if (!activeLines.length) {
      messageApi.warning('请至少填写一行本次发料数量');
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
      messageApi.success('委外发料单已创建');
      leavePage();
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
              {woCode ? `委外发料 — ${woCode}` : '委外发料'}
            </Typography.Title>
          </Space>
          <Space wrap>
            <Button disabled={submitting || loading} onClick={leavePage}>
              取消
            </Button>
            <Button type="primary" loading={submitting} disabled={loading} onClick={() => void submit()}>
              确认发料
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
                    <ReadOnlyFormValue value="委外发料" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Form.Item label="委外工单号">
                    <ReadOnlyFormValue value={woCode} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Form.Item label="产品">
                    <ReadOnlyFormValue value={String(workOrder.product_name ?? workOrder.productName ?? '')} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Form.Item label="委外供应商">
                    <ReadOnlyFormValue value={String(workOrder.supplier_name ?? workOrder.supplierName ?? '')} />
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
                发料明细
                <Typography.Text type="secondary" style={{ marginLeft: 12, fontWeight: 'normal' }}>
                  合计发料数量：{totalIssueQty}
                </Typography.Text>
              </Typography.Text>
              <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
              <Table
                className="warehouse-detail-table"
                size="small"
                rowKey="key"
                pagination={false}
                dataSource={issueLines}
                columns={[
                  { title: '物料编码', dataIndex: 'materialCode', width: 120 },
                  { title: '物料名称', dataIndex: 'materialName', ellipsis: true },
                  {
                    title: '待发数量',
                    dataIndex: 'pendingQuantity',
                    width: 100,
                    align: 'right',
                  },
                  {
                    title: '本次发料',
                    key: 'issueQuantity',
                    width: 140,
                    render: (_, line) => (
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
                  { title: '单位', dataIndex: 'unit', width: 60 },
                ]}
              />
            </Form>
          )}
        </Card>
      </Spin>
    </DocumentFormPageLayout>
  );
};

export default OutboundOutsourcePullEntryPage;
