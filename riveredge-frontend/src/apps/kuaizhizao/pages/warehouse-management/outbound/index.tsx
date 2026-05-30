/**
 * 出库管理页面
 *
 * 提供出库单的管理功能，支持多种出库类型：生产领料、销售出库、退货出库等。
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { ActionType, ProColumns, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Card, Table, Row, Col, Form, Tooltip, Typography, Spin, Empty, theme as AntdTheme, AutoComplete, Dropdown } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, EyeOutlined, CheckCircleOutlined, InboxOutlined, DownOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, DetailDrawerSection, DetailDrawerInlineFullChain, MODAL_CONFIG, DRAWER_CONFIG, WAREHOUSE_DETAIL_TABLE_STYLES } from '../../../../../components/layout-templates';
import { UniPullCreateToolbar } from '../../../../../components/uni-pull';
import {
  DocumentTrackingTimelineBody,
  useDocumentTracking,
} from '../../../../../components/document-tracking-panel';
import { WarehouseTraceBriefPrimaryActions } from '../WarehouseTraceBriefFooter';
import CodeField from '../../../../../components/code-field';
import { apiRequest } from '../../../../../services/api';
import { warehouseApi, workOrderApi, outsourceMaterialIssueApi } from '../../../services/production';
import { getOutboundLifecycle } from '../../../utils/outboundLifecycle';
import dayjs from 'dayjs';
import { listSalesOrders } from '../../../services/sales-order';
import { warehouseApi as masterWarehouseApi } from '../../../../master-data/services/warehouse';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { buildKuaizhizaoPullCreateMenuItems, getKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import { WorkOrderScoreCell } from '../../../components/WorkOrderScoreCell';

// 统一的出库单接口（结合生产领料和销售出库）
interface OutboundOrder {
  id?: number;
  tenant_id?: number;
  delivery_code?: string; // 销售出库单编号
  picking_code?: string; // 生产领料单编号
  outbound_type?: 'production_picking' | 'sales_delivery' | 'outsource_issue'; // 出库类型
  status?: string;
  delivery_date?: string; // 出库日期
  customer_id?: number;
  customer_name?: string;
  work_order_id?: number;
  work_order_code?: string;
  picking_score?: number | null;
  picking_rank_band?: string | null;
  picking_score_breakdown?: Record<string, { score?: number; weight?: number; weighted?: number; raw?: unknown }> | null;
  warehouse_id?: number;
  warehouse_name?: string;
  delivered_by?: string; // 操作员
  total_quantity?: number;
  total_items?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  items?: OutboundOrderItem[];
}

interface OutboundOrderItem {
  id?: number;
  tenant_id?: number;
  delivery_id?: number; // 销售出库单明细ID
  picking_id?: number; // 生产领料单明细ID
  material_id?: number;
  material_code?: string;
  material_name?: string;
  quantity?: number;
  unit?: string;
  notes?: string;
}

type SalesBatchPickOption = { value: string; label: string };

function normalizeSalesBatchFormValue(raw: unknown): string {
  if (raw == null) return '';
  if (typeof raw === 'string') return raw.trim();
  if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw).trim();
  if (typeof raw === 'object' && raw !== null && 'value' in (raw as object)) {
    const v = (raw as { value?: unknown }).value;
    return v != null && v !== '' ? String(v).trim() : '';
  }
  return String(raw).trim();
}

/** 解析 confirm 接口响应中的出库单对象（兼容 { data: {...} } 等包装） */
function parseSalesDeliveryConfirmResult(raw: unknown): { status?: string } {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  if (typeof o.status === 'string') return { status: o.status };
  const inner = o.data;
  if (inner && typeof inner === 'object' && typeof (inner as Record<string, unknown>).status === 'string') {
    return { status: (inner as { status: string }).status };
  }
  return {};
}

function outboundDocumentTrackingType(order: OutboundOrder): 'production_picking' | 'sales_delivery' | undefined {
  if (order.outbound_type === 'sales_delivery') return 'sales_delivery';
  if (order.outbound_type === 'production_picking') return 'production_picking';
  return undefined;
}

function mapOutsourceIssueToOutbound(item: Record<string, unknown>): OutboundOrder {
  const code = String(item.code ?? '');
  const statusRaw = String(item.status ?? '');
  const status =
    statusRaw === 'completed' ? '已完成' : statusRaw === 'draft' ? '已出库' : statusRaw || '已出库';
  return {
    id: item.id as number,
    outbound_type: 'outsource_issue',
    picking_code: code,
    work_order_code: String(item.outsource_work_order_code ?? item.outsourceWorkOrderCode ?? ''),
    warehouse_id: item.warehouse_id as number | undefined,
    warehouse_name: String(item.warehouse_name ?? item.warehouseName ?? ''),
    total_quantity: Number(item.quantity ?? 0),
    total_items: 1,
    delivered_by: String(
      item.issued_by_name ?? item.issuedByName ?? item.created_by_name ?? item.createdByName ?? '',
    ),
    delivery_date: String(item.issued_at ?? item.issuedAt ?? item.created_at ?? item.createdAt ?? ''),
    status,
    updated_at: String(item.updated_at ?? item.updatedAt ?? ''),
    created_at: String(item.created_at ?? item.createdAt ?? ''),
    notes: String(item.remarks ?? item.notes ?? ''),
    items: [
      {
        material_code: String(item.material_code ?? item.materialCode ?? ''),
        material_name: String(item.material_name ?? item.materialName ?? ''),
        delivery_quantity: Number(item.quantity ?? 0),
        material_unit: String(item.unit ?? ''),
        warehouse_name: String(item.warehouse_name ?? item.warehouseName ?? ''),
        batch_number: String(item.batch_number ?? item.batchNumber ?? ''),
      },
    ],
  };
}

const OutboundPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token } = AntdTheme.useToken();
  const outboundDetailDrawerZIndex = token.zIndexPopupBase;
  const { message: messageApi } = App.useApp();
  const pullFromWorkOrderAction = getKuaizhizaoDocumentAction('outbound.pull_from_work_order');
  const pullFromSalesOrderAction = getKuaizhizaoDocumentAction('outbound.pull_from_sales_order');
  const actionRef = useRef<ActionType>(null);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  // Modal 相关状态（创建出库单）
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const formRef = useRef<any>(null);
  const [outboundType, setOutboundType] = useState<string>('production');

  // Drawer 相关状态（详情查看）
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<OutboundOrder | null>(null);
  const [outboundTrackingRefreshKey, setOutboundTrackingRefreshKey] = useState(0);

  // 批量出库 Modal
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [batchForm] = Form.useForm();
  const [batchOutboundType, setBatchOutboundType] = useState<'production_picking' | 'sales_delivery'>('production_picking');
  const [workOrderOptions, setWorkOrderOptions] = useState<{ label: string; value: number }[]>([]);
  const [salesOrderOptions, setSalesOrderOptions] = useState<{ label: string; value: number }[]>([]);
  const [warehouseOptions, setWarehouseOptions] = useState<{ label: string; value: number; name: string }[]>([]);
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [executionConfig, setExecutionConfig] = useState<any>(null);

  /** 销售出库确认前批号预览 */
  const [salesConfirmOpen, setSalesConfirmOpen] = useState(false);
  const [salesConfirmRecord, setSalesConfirmRecord] = useState<OutboundOrder | null>(null);
  const [salesConfirmDetail, setSalesConfirmDetail] = useState<any>(null);
  const [salesConfirmSubmitting, setSalesConfirmSubmitting] = useState(false);
  const [salesBatchOptionsByMaterialId, setSalesBatchOptionsByMaterialId] = useState<
    Record<number, SalesBatchPickOption[]>
  >({});
  const [salesBatchOptionsLoading, setSalesBatchOptionsLoading] = useState(false);
  const [salesConfirmForm] = Form.useForm();

  const salesConfirmActiveLines: any[] = useMemo(() => {
    const items = Array.isArray(salesConfirmDetail?.items) ? salesConfirmDetail.items : [];
    return items.filter((it: any) => Number(it.delivery_quantity ?? 0) > 0);
  }, [salesConfirmDetail]);

  useEffect(() => {
    if (!salesConfirmOpen || !salesConfirmDetail?.items?.length) {
      setSalesBatchOptionsByMaterialId({});
      return;
    }
    const active = salesConfirmDetail.items.filter((it: any) => Number(it.delivery_quantity ?? 0) > 0);
    if (!active.length) {
      setSalesBatchOptionsByMaterialId({});
      return;
    }
    const mids = [
      ...new Set(active.map((x: { material_id?: number }) => x.material_id).filter(Boolean) as number[]),
    ];
    if (!mids.length) return;

    let cancelled = false;
    (async () => {
      setSalesBatchOptionsLoading(true);
      try {
        const wid = salesConfirmDetail.warehouse_id;
        const res = await apiRequest<{ items?: Record<string, unknown>[] }>(
          '/apps/kuaizhizao/reports/inventory/batch-query',
          {
            method: 'GET',
            params: {
              material_ids: mids,
              include_expired: false,
              ...(wid != null && wid !== '' ? { warehouse_id: wid } : {}),
            },
          },
        );
        const rows = res.items ?? [];
        const map: Record<number, SalesBatchPickOption[]> = {};
        for (const row of rows) {
          const mid = row.material_id as number;
          if (!mid) continue;
          const isMainBatch =
            row.warehouse_name === '主仓' ||
            (typeof row.id === 'number' && row.id >= 1_000_000 && row.id < 2_000_000);
          if (!isMainBatch) continue;
          const qty = Number(row.quantity ?? 0);
          if (qty <= 0) continue;
          if (row.status === '已过期' || row.status === '无库存') continue;
          const bn = String(row.batch_no ?? '').trim();
          if (!bn) continue;
          if (!map[mid]) map[mid] = [];
          if (map[mid].some((o) => o.value === bn)) continue;
          map[mid].push({ value: bn, label: `${bn}（可用 ${qty}）` });
        }
        for (const k of Object.keys(map)) {
          map[+k].sort((a, b) => a.value.localeCompare(b.value, 'zh-CN'));
        }
        if (!cancelled) setSalesBatchOptionsByMaterialId(map);
      } catch {
        if (!cancelled) setSalesBatchOptionsByMaterialId({});
      } finally {
        if (!cancelled) setSalesBatchOptionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [salesConfirmOpen, salesConfirmDetail?.id]);

  const outboundDocTrackingType = currentOrder ? outboundDocumentTrackingType(currentOrder) : undefined;
  const outboundTracking = useDocumentTracking(outboundDocTrackingType, currentOrder?.id, outboundTrackingRefreshKey);

  useEffect(() => {
    const loadExecutionConfig = async () => {
      try {
        const cfg = await workOrderApi.getExecutionConfig();
        setExecutionConfig(cfg);
      } catch {
        setExecutionConfig(null);
      }
    };
    loadExecutionConfig();
  }, []);

  /** 批量出库：加载工单、销售订单、仓库 */
  useEffect(() => {
    if (!batchModalVisible) return;
    const load = async () => {
      try {
        const [woRes, soRes, whRes] = await Promise.all([
          workOrderApi.list({ skip: 0, limit: 500 }),
          listSalesOrders({ skip: 0, limit: 500 }),
          masterWarehouseApi.list({ is_active: true }),
        ]);
        const woList = Array.isArray(woRes) ? woRes : (woRes as any)?.data ?? (woRes as any)?.items ?? [];
        const eligibleWo = woList.filter(
          (wo: any) => ['已下达', '进行中', 'released', 'in_progress'].includes(wo.status)
        );
        setWorkOrderOptions(
          eligibleWo.map((wo: any) => ({
            label: `${wo.code || wo.id} - ${wo.product_name || wo.name || '-'}`,
            value: wo.id,
          }))
        );
        const soData = (soRes as any)?.data ?? (soRes as any)?.items ?? soRes ?? [];
        const soList = Array.isArray(soData) ? soData : [];
        const eligibleSo = soList.filter(
          (so: any) => ['已审核', '已确认', 'AUDITED', 'CONFIRMED'].includes(so.status)
        );
        setSalesOrderOptions(
          eligibleSo.map((so: any) => ({
            label: `${so.order_code || so.code || so.id} - ${so.customer_name || '-'}`,
            value: so.id,
          }))
        );
        const whList = Array.isArray(whRes) ? whRes : (whRes as any)?.data ?? (whRes as any)?.items ?? whRes ?? [];
        setWarehouseOptions(
          (Array.isArray(whList) ? whList : []).map((w: any) => ({
            label: `${w.code || ''} ${w.name || ''}`.trim() || String(w.id),
            value: w.id,
            name: w.name || '',
          }))
        );
      } catch {
        setWorkOrderOptions([]);
        setSalesOrderOptions([]);
        setWarehouseOptions([]);
      }
    };
    load();
  }, [batchModalVisible]);

  /** 批量出库提交 */
  const handleBatchOutboundSubmit = async () => {
    try {
      const values = await batchForm.validateFields();
      const type = values.batch_outbound_type || batchOutboundType;
      setBatchSubmitting(true);

      if (type === 'sales_delivery') {
        const orderIds = values.sales_order_ids as number[];
        const warehouseId = values.warehouse_id as number;
        const wh = warehouseOptions.find((w) => w.value === warehouseId);
        if (!orderIds?.length) {
          messageApi.warning('请选择至少一个销售订单');
          return;
        }
        if (!warehouseId) {
          messageApi.warning('请选择出库仓库');
          return;
        }
        let success = 0;
        for (const id of orderIds) {
          try {
            await warehouseApi.salesDelivery.pullFromSalesOrder({
              sales_order_id: id,
              warehouse_id: warehouseId,
              warehouse_name: wh?.name,
            });
            success++;
          } catch (e: any) {
            messageApi.warning(`销售订单 ${id} 上拉失败：${e?.message || e?.response?.data?.detail || '未知错误'}`);
          }
        }
        messageApi.success(`批量销售出库成功，共创建 ${success} 张销售出库单`);
      } else {
        const workOrderIds = values.work_order_ids as number[];
        const warehouseId = values.warehouse_id as number;
        const wh = warehouseOptions.find((w) => w.value === warehouseId);
        if (!workOrderIds?.length) {
          messageApi.warning('请选择至少一个工单');
          return;
        }
        if (!warehouseId) {
          messageApi.warning('请选择出库仓库');
          return;
        }
        const result = await warehouseApi.productionPicking.batchPick({
          work_order_ids: workOrderIds,
          warehouse_id: warehouseId,
          warehouse_name: wh?.name,
        });
        const list = Array.isArray(result) ? result : (result as any)?.data ?? (result as any)?.items ?? [];
        messageApi.success(`批量生产领料成功，共创建 ${list.length} 张领料单`);
      }
      setBatchModalVisible(false);
      batchForm.resetFields();
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || e?.response?.data?.detail || '批量出库失败');
    } finally {
      setBatchSubmitting(false);
    }
  };

  const handleCreate = () => {
    setOutboundType('production');
    setCreateModalVisible(true);
  };

  useNewShortcut(handleCreate);

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: OutboundOrder) => {
    try {
      let detailData;
      if (record.outbound_type === 'production_picking') {
        detailData = await warehouseApi.productionPicking.get(record.id!.toString());
      } else if (record.outbound_type === 'sales_delivery') {
        detailData = await warehouseApi.salesDelivery.get(record.id!.toString());
      } else if (record.outbound_type === 'outsource_issue') {
        const raw = await outsourceMaterialIssueApi.get(record.id!.toString());
        detailData = mapOutsourceIssueToOutbound(raw as Record<string, unknown>);
        setCurrentOrder(detailData);
        setDetailDrawerVisible(true);
        setOutboundTrackingRefreshKey((k) => k + 1);
        return;
      }
      setCurrentOrder(detailData ? { ...detailData, outbound_type: record.outbound_type } : null);
      setDetailDrawerVisible(true);
      setOutboundTrackingRefreshKey((k) => k + 1);
    } catch {
      messageApi.error('获取出库单详情失败');
    }
  };

  const refreshOrderAfterConfirm = async (record: OutboundOrder) => {
    actionRef.current?.reload();
    if (currentOrder?.id === record.id) {
      try {
        let detailData: any;
        if (record.outbound_type === 'production_picking') {
          detailData = await warehouseApi.productionPicking.get(record.id!.toString());
        } else if (record.outbound_type === 'sales_delivery') {
          detailData = await warehouseApi.salesDelivery.get(record.id!.toString());
        }
        if (detailData) {
          setCurrentOrder({ ...detailData, outbound_type: record.outbound_type });
        }
      } catch {
        /* ignore */
      }
    }
    setOutboundTrackingRefreshKey((k) => k + 1);
  };

  const openSalesDeliveryConfirmModal = async (record: OutboundOrder) => {
    try {
      const detail = await warehouseApi.salesDelivery.get(record.id!.toString());
      const items = Array.isArray(detail?.items) ? detail.items : [];
      const active = items.filter((it: any) => Number(it.delivery_quantity ?? 0) > 0);
      if (!active.length) {
        messageApi.warning('没有可出库明细');
        return;
      }
      setSalesConfirmRecord(record);
      setSalesConfirmDetail(detail);
      salesConfirmForm.resetFields();
      const init: Record<string, string> = {};
      active.forEach((it: any) => {
        if (it.id != null) init[`batch_${it.id}`] = it.batch_number ? String(it.batch_number) : '';
      });
      salesConfirmForm.setFieldsValue(init);
      setSalesConfirmOpen(true);
    } catch {
      messageApi.error('获取出库单详情失败');
    }
  };

  const submitSalesDeliveryConfirm = async () => {
    if (!salesConfirmRecord?.id || !salesConfirmDetail) return;
    const vals = salesConfirmForm.getFieldsValue(true);
    const item_batches = salesConfirmActiveLines
      .map((it: any) => {
        const lineId = Number(it.id);
        const key = Number.isFinite(lineId) ? `batch_${lineId}` : '';
        const fromForm = key ? vals[key] : undefined;
        const trimmedForm = normalizeSalesBatchFormValue(fromForm);
        const fallback = String(it.batch_number ?? '').trim();
        const batch_no = trimmedForm || fallback;
        return { item_id: lineId, batch_no };
      })
      .filter((row) => Number.isFinite(row.item_id) && row.item_id > 0);
    const rec = salesConfirmRecord;
    try {
      setSalesConfirmSubmitting(true);
      const updated = parseSalesDeliveryConfirmResult(
        await warehouseApi.salesDelivery.confirm(rec.id!.toString(), {
          item_batches,
        }),
      );
      const st = (updated?.status ?? '').trim();
      const posted = st === '已出库' || st === '已完成' || st === 'completed';
      if (!posted) {
        messageApi.error(
          `出库未生效（接口返回状态：${st || '未知'}）。若列表仍显示待出库，请刷新页面后重试。`,
        );
        await refreshOrderAfterConfirm({ ...rec, outbound_type: 'sales_delivery' });
        return;
      }
      messageApi.success('出库确认成功，库存已更新');
      invalidateMenuBadgeCounts();
      setSalesConfirmOpen(false);
      setSalesConfirmRecord(null);
      setSalesConfirmDetail(null);
      await refreshOrderAfterConfirm({ ...rec, outbound_type: 'sales_delivery' });
    } catch (e: any) {
      messageApi.error(e?.message || '出库确认失败');
      throw e;
    } finally {
      setSalesConfirmSubmitting(false);
    }
  };

  const salesDeliveryConfirmColumns: ColumnsType<any> = useMemo(
    () => [
      {
        title: '行',
        key: 'idx',
        width: 52,
        align: 'center',
        render: (_: unknown, __: unknown, index: number) => index + 1,
      },
      {
        title: '物料编码',
        dataIndex: 'material_code',
        width: 112,
        ellipsis: true,
        render: (v: unknown) => v ?? '—',
      },
      {
        title: '物料名称',
        dataIndex: 'material_name',
        ellipsis: true,
        render: (v: unknown) => v ?? '—',
      },
      {
        title: '出库数量',
        key: 'qty',
        width: 120,
        align: 'right',
        render: (_: unknown, it: any) =>
          `${it.delivery_quantity ?? ''}${it.material_unit ? ` ${it.material_unit}` : ''}`,
      },
      {
        title: '批号',
        key: 'batch',
        width: 260,
        render: (_: unknown, it: any) => {
          const opts = salesBatchOptionsByMaterialId[it.material_id] ?? [];
          return (
            <Form.Item name={`batch_${it.id}`} style={{ marginBottom: 0 }}>
              <AutoComplete
                size="small"
                allowClear
                options={opts}
                placeholder="下拉选择或扫描/输入批号"
                filterOption={(input, option) => {
                  const q = (input || '').toLowerCase();
                  const lab = String(option?.label ?? '').toLowerCase();
                  const val = String(option?.value ?? '').toLowerCase();
                  return lab.includes(q) || val.includes(q);
                }}
                notFoundContent={salesBatchOptionsLoading ? '加载批次…' : '无主仓可选批次，请手输'}
              />
            </Form.Item>
          );
        },
      },
    ],
    [salesBatchOptionsByMaterialId, salesBatchOptionsLoading],
  );

  /**
   * 处理确认出库（销售出库先弹出批号预览；生产领料保持原确认框）
   */
  const handleConfirm = async (record: OutboundOrder) => {
    if (
      record.outbound_type === 'production_picking' &&
      executionConfig &&
      executionConfig.current_user_can_confirm_picking === false
    ) {
      messageApi.warning('当前业务配置下，您无权限确认生产领料');
      return;
    }
    if (record.outbound_type === 'sales_delivery') {
      await openSalesDeliveryConfirmModal(record);
      return;
    }
    Modal.confirm({
      title: '确认出库',
      content: `确定要确认出库单 "${record.delivery_code || record.picking_code}" 吗？确认后将更新库存。`,
      onOk: async () => {
        try {
          await warehouseApi.productionPicking.confirm(record.id!.toString());
          messageApi.success('出库确认成功，库存已更新');
          invalidateMenuBadgeCounts();
          await refreshOrderAfterConfirm(record);
        } catch (e: any) {
          messageApi.error(e?.message || '出库确认失败');
          throw e;
        }
      },
    });
  };

  /**
   * 表格列定义
   */
  const getOutboundStackedPrimary = (record: OutboundOrder): string => {
    if (record.outbound_type === 'sales_delivery' && record.customer_name) {
      return String(record.customer_name);
    }
    if (record.work_order_code) return String(record.work_order_code);
    if (record.customer_name) return String(record.customer_name);
    return '出库单';
  };

  const columns: ProColumns<OutboundOrder>[] = [
    {
      title: '主体 / 单号',
      key: 'delivery_code',
      dataIndex: ['delivery_code', 'picking_code'],
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      fixed: 'left',
      render: (_, record) => (
        <UniTableStackedPrimaryCell
          primary={getOutboundStackedPrimary(record)}
          secondary={String(record.delivery_code || record.picking_code || '')}
        />
      ),
    },
    {
      title: '出库单号',
      dataIndex: ['delivery_code', 'picking_code'],
      hideInTable: true,
    },
    {
      title: '出库类型',
      dataIndex: 'outbound_type',
      width: 100,
      valueEnum: {
        production_picking: { text: '生产领料', status: 'processing' },
        sales_delivery: { text: '销售出库', status: 'success' },
        outsource_issue: { text: '委外发料', status: 'warning' },
      },
    },
    {
      title: '客户',
      dataIndex: 'customer_name',
      hideInTable: true,
      ellipsis: true,
    },
    {
      title: '工单号',
      dataIndex: 'work_order_code',
      width: 120,
      ellipsis: true,
    },
    {
      title: '权重分',
      dataIndex: 'picking_score',
      width: 88,
      hideInSearch: true,
      render: (_: unknown, record: OutboundOrder) =>
        record.outbound_type === 'production_picking' ? (
          <WorkOrderScoreCell
            score={record.picking_score}
            breakdown={record.picking_score_breakdown}
          />
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      title: '出库数量',
      dataIndex: 'total_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '出库品种',
      dataIndex: 'total_items',
      width: 100,
      align: 'right',
    },
    {
      title: '出库仓库',
      dataIndex: 'warehouse_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: '操作员',
      dataIndex: 'delivered_by',
      width: 100,
      ellipsis: true,
    },
    {
      title: '出库日期',
      dataIndex: 'delivery_date',
      valueType: 'date',
      width: 120,
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 168,
      hideInSearch: true,
      defaultSortOrder: 'descend',
      render: (_, r) => (r.updated_at ? dayjs(r.updated_at).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getOutboundLifecycle(record as Record<string, unknown>);
        return (
          <UniLifecycle
            percent={lifecycle.percent}
            stageName={lifecycle.stageName}
            status={lifecycle.status}
            subStages={lifecycle.subStages}
            showLabel
            size="small"
            showCircleTooltip={false}
          />
        );
      },
    },
    {
      title: '操作',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleDetail(record)}
          >
            详情
          </Button>
          {(record.status === 'draft' || record.status === '草稿' || record.status === '待领料' || record.status === '待出库') &&
            record.outbound_type !== 'outsource_issue' && (
            <Tooltip
              title={
                record.outbound_type === 'production_picking' &&
                executionConfig &&
                executionConfig.current_user_can_confirm_picking === false
                  ? '当前业务配置下，您无权限确认生产领料'
                  : undefined
              }
            >
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => handleConfirm(record)}
                style={{ color: '#52c41a' }}
                disabled={
                  record.outbound_type === 'production_picking' &&
                  executionConfig &&
                  executionConfig.current_user_can_confirm_picking === false
                }
              >
                确认出库
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const handleFormFinish = async () => {
    try {
      messageApi.success('出库单创建成功');
      setCreateModalVisible(false);
      formRef.current?.resetFields();
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      throw error;
    }
  };

  return (
    <ListPageTemplate>
      <UniTable
        headerTitle="出库管理"
        columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.outbound"
        actionRef={actionRef}
        rowKey={(record) => `${record.outbound_type}::${record.id}`}
        columns={columns}
        showAdvancedSearch={true}
        request={async (params) => {
          try {
            const kw = (params as any).keyword;
            const typeFilter = (params as any).outbound_type as string | undefined;
            const skip = (params.current! - 1) * params.pageSize!;
            const limit = params.pageSize!;

            const fetchPicking = !typeFilter || typeFilter === 'production_picking';
            const fetchDelivery = !typeFilter || typeFilter === 'sales_delivery';
            const fetchOutsource = !typeFilter || typeFilter === 'outsource_issue';

            const [pickingRes, deliveryRes, outsourceRes] = await Promise.all([
              fetchPicking
                ? warehouseApi.productionPicking.list({
                    skip,
                    limit,
                    ...params,
                    keyword: kw,
                  })
                : Promise.resolve([]),
              fetchDelivery
                ? warehouseApi.salesDelivery.list({
                    skip,
                    limit,
                    ...params,
                    keyword: kw,
                  })
                : Promise.resolve([]),
              fetchOutsource
                ? outsourceMaterialIssueApi.list({
                    skip,
                    limit,
                    keyword: kw,
                  })
                : Promise.resolve([]),
            ]);

            const toList = (r: any) => (Array.isArray(r) ? r : r?.data ?? r?.items ?? []);
            const pickingData = fetchPicking
              ? toList(pickingRes).map((item: any) => ({
                  ...item,
                  outbound_type: 'production_picking' as const,
                }))
              : [];
            const deliveryData = fetchDelivery
              ? toList(deliveryRes).map((item: any) => ({
                  ...item,
                  outbound_type: 'sales_delivery' as const,
                }))
              : [];
            const outsourceData = fetchOutsource
              ? toList(outsourceRes).map((item: any) => mapOutsourceIssueToOutbound(item))
              : [];

            let combinedData = [...pickingData, ...deliveryData, ...outsourceData];

            if (typeFilter === 'production_picking') {
              combinedData.sort((a, b) => {
                const sa = a.picking_score;
                const sb = b.picking_score;
                if (sa == null && sb == null) {
                  return new Date(b.updated_at || '').getTime() - new Date(a.updated_at || '').getTime();
                }
                if (sa == null) return 1;
                if (sb == null) return -1;
                return sb - sa;
              });
            } else {
              combinedData.sort(
                (a, b) => new Date(b.updated_at || '').getTime() - new Date(a.updated_at || '').getTime(),
              );
            }

            const total =
              (fetchPicking && typeof pickingRes?.total === 'number' ? pickingRes.total : pickingData.length) +
              (fetchDelivery && typeof deliveryRes?.total === 'number' ? deliveryRes.total : deliveryData.length) +
              (fetchOutsource ? outsourceData.length : 0);

            return {
              data: combinedData,
              success: true,
              total,
            };
          } catch {
            messageApi.error('获取出库单列表失败');
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        enableRowSelection={true}
        showDeleteButton={true}
        onDelete={async (keys) => {
          Modal.confirm({
            title: '确认批量删除',
            content: `确定要删除选中的 ${keys.length} 条出库单吗？`,
            onOk: async () => {
              try {
                for (const key of keys) {
                  const [type, id] = String(key).split('::');
                  if (type === 'production_picking') {
                    await warehouseApi.productionPicking.delete(id);
                  } else if (type === 'sales_delivery') {
                    await warehouseApi.salesDelivery.delete(id);
                  }
                }
                messageApi.success(`成功删除 ${keys.length} 条记录`);
                invalidateMenuBadgeCounts();

                actionRef.current?.reload();
              } catch (error: any) {
                messageApi.error(error?.message || '删除失败');
              }
            },
          });
        }}
        toolBarRender={() => [
          <UniPullCreateToolbar
            compactKey="create-outbound-with-pull"
            createIcon={<PlusOutlined />}
            createLabel={'新建出库单' + NEW_SHORTCUT_HINT}
            onCreate={handleCreate}
            menuItems={buildKuaizhizaoPullCreateMenuItems([
              {
                key: 'pull-from-work-order',
                actionKey: 'outbound.pull_from_work_order',
                onClick: () => {
                  batchForm.resetFields();
                  setBatchOutboundType('production_picking');
                  setBatchModalVisible(true);
                },
              },
              {
                key: 'pull-from-sales-order',
                actionKey: 'outbound.pull_from_sales_order',
                onClick: () => {
                  batchForm.resetFields();
                  setBatchOutboundType('sales_delivery');
                  setBatchModalVisible(true);
                },
              },
            ])}
          />,
          <Button
            key="batch"
            icon={<InboxOutlined />}
            onClick={() => {
              batchForm.resetFields();
              setBatchOutboundType('production_picking');
              setBatchModalVisible(true);
            }}
          >
            批量出库
          </Button>,
        ]}
        scroll={{ x: 2000 }}
      />

      <FormModalTemplate
        title="新建出库单"
        open={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onFinish={handleFormFinish}
        isEdit={false}
        initialValues={{ type: 'production' }}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <ProFormSelect
              name="type"
              label="出库类型"
              placeholder="请选择出库类型"
              rules={[{ required: true, message: '请选择出库类型' }]}
              options={[
                { label: '生产领料', value: 'production' },
                { label: '销售出库', value: 'sales' },
                { label: '退货出库', value: 'return' },
              ]}
              fieldProps={{
                onChange: (value: string) => setOutboundType(value),
              }}
            />
          </Col>
          <Col span={12}>
            {outboundType === 'production' && (
              <CodeField
                pageCode="kuaizhizao-warehouse-inbound"
                name="picking_code"
                label="生产领料单编号"
                required={true}
                autoGenerateOnCreate={true}
                context={{}}
              />
            )}
            {outboundType === 'sales' && (
              <CodeField
                pageCode="kuaizhizao-sales-delivery"
                name="delivery_code"
                label="销售出库单编号"
                required={true}
                autoGenerateOnCreate={true}
                context={{}}
              />
            )}
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormSelect
              name="warehouse"
              label="出库仓库"
              placeholder="请选择出库仓库"
              rules={[{ required: true, message: '请选择出库仓库' }]}
              options={[
                { label: '原材料仓库', value: 'raw-materials' },
                { label: '半成品仓库', value: 'semi-finished' },
                { label: '成品仓库', value: 'finished-goods' },
              ]}
            />
          </Col>
          <Col span={12}>
            <ProFormText name="customer" label="客户" placeholder="选择客户" />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormText name="workOrder" label="关联工单" placeholder="选择工单" />
          </Col>
          <Col span={12}>
            <ProFormText
              name="batch_number"
              label="批号"
              placeholder="请输入批号（批号管理物料必填）"
              tooltip="如果所选物料启用了批号管理，此字段为必填"
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormTextArea
              name="serial_numbers"
              label="序列号"
              placeholder="请输入序列号，多个序列号用逗号分隔（序列号管理物料必填）"
              tooltip="如果所选物料启用了序列号管理，此字段为必填"
              fieldProps={{ rows: 2 }}
            />
          </Col>
          <Col span={12} />
        </Row>
      </FormModalTemplate>

      <Modal
        title="批量出库"
        open={batchModalVisible}
        onCancel={() => setBatchModalVisible(false)}
        onOk={handleBatchOutboundSubmit}
        confirmLoading={batchSubmitting}
        width={520}
        okText="确认出库"
      >
        <p style={{ marginBottom: 16, color: '#666' }}>
          根据上游单据批量创建出库单。生产领料：从工单下推；销售出库：从销售订单上拉。
        </p>
        <Form form={batchForm} layout="vertical" initialValues={{ batch_outbound_type: 'production_picking' }}>
          <Form.Item
            name="batch_outbound_type"
            label="出库类型"
            rules={[{ required: true }]}
          >
            <ProFormSelect
              options={[
                { label: '生产领料（从工单）', value: 'production_picking' },
                { label: '销售出库（从销售订单）', value: 'sales_delivery' },
              ]}
              fieldProps={{
                onChange: (v: string) => setBatchOutboundType(v as 'production_picking' | 'sales_delivery'),
              }}
            />
          </Form.Item>
          {batchOutboundType === 'production_picking' && (
            <>
              <Form.Item
                name="work_order_ids"
                label="选择工单"
                rules={[{ required: true, message: '请选择至少一个工单' }]}
              >
                <ProFormSelect
                  mode="multiple"
                  placeholder="请选择工单（已下达/进行中）"
                  options={workOrderOptions}
                  fieldProps={{ showSearch: true, filterOption: (input, opt) => (opt?.label ?? '').toString().toLowerCase().includes(input.toLowerCase()) }}
                />
              </Form.Item>
              <Form.Item
                name="warehouse_id"
                label="出库仓库"
                rules={[{ required: true, message: '请选择出库仓库' }]}
              >
                <ProFormSelect
                  placeholder="请选择仓库"
                  options={warehouseOptions}
                  fieldProps={{ showSearch: true, filterOption: (input, opt) => (opt?.label ?? '').toString().toLowerCase().includes(input.toLowerCase()) }}
                />
              </Form.Item>
            </>
          )}
          {batchOutboundType === 'sales_delivery' && (
            <>
              <Form.Item
                name="sales_order_ids"
                label="选择销售订单"
                rules={[{ required: true, message: '请选择至少一个销售订单' }]}
              >
                <ProFormSelect
                  mode="multiple"
                  placeholder="请选择销售订单（已审核/已确认）"
                  options={salesOrderOptions}
                  fieldProps={{ showSearch: true, filterOption: (input, opt) => (opt?.label ?? '').toString().toLowerCase().includes(input.toLowerCase()) }}
                />
              </Form.Item>
              <Form.Item
                name="warehouse_id"
                label="出库仓库"
                rules={[{ required: true, message: '请选择出库仓库' }]}
              >
                <ProFormSelect
                  placeholder="请选择仓库"
                  options={warehouseOptions}
                  fieldProps={{ showSearch: true, filterOption: (input, opt) => (opt?.label ?? '').toString().toLowerCase().includes(input.toLowerCase()) }}
                />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      <Modal
        title="确认出库 — 批号核对"
        open={salesConfirmOpen}
        okText="确认出库并过账"
        cancelText="取消"
        confirmLoading={salesConfirmSubmitting}
        destroyOnClose
        width={880}
        styles={{ body: { paddingTop: 12 } }}
        onCancel={() => {
          setSalesConfirmOpen(false);
          setSalesConfirmRecord(null);
          setSalesConfirmDetail(null);
        }}
        onOk={submitSalesDeliveryConfirm}
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
          请核对实物批号：可从下拉选择主仓可用批次，或直接扫描/输入。启用批号管理的物料在确认时会校验；未启用的行可留空由系统按策略分摊。
        </Typography.Paragraph>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12, fontSize: 12 }}>
          先进先出/后进先出等策略见 <Link to="/system/config-center">配置中心 → 仓储参数</Link>。
        </Typography.Paragraph>
        {salesConfirmRecord?.delivery_code ? (
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
            出库单号：<Typography.Text strong>{salesConfirmRecord.delivery_code}</Typography.Text>
          </Typography.Text>
        ) : null}
        <Form form={salesConfirmForm} component={false}>
          <Table<any>
            size="small"
            rowKey={(it) => String(it.id ?? `${it.material_id}-${it.material_code}`)}
            columns={salesDeliveryConfirmColumns}
            dataSource={salesConfirmActiveLines}
            pagination={false}
            scroll={{
              x: 700,
              y: Math.min(salesConfirmActiveLines.length * 46 + 40, 420),
            }}
          />
        </Form>
      </Modal>

      <DetailDrawerTemplate
        title={`出库单详情 - ${currentOrder?.delivery_code || currentOrder?.picking_code || ''}`}
        open={detailDrawerVisible}
        zIndex={outboundDetailDrawerZIndex}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentOrder(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        extra={
          currentOrder && ['draft', '草稿', '待领料', '待出库'].includes(currentOrder.status || '') &&
            currentOrder.outbound_type !== 'outsource_issue' && (
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={() => handleConfirm(currentOrder)}
              disabled={
                currentOrder.outbound_type === 'production_picking' &&
                executionConfig &&
                executionConfig.current_user_can_confirm_picking === false
              }
            >
              确认出库
            </Button>
          )
        }
        customContent={
          currentOrder ? (
            <div style={{ padding: '16px 0' }}>
              <Card title="基本信息" style={{ marginBottom: 16 }}>
                <p><strong>出库单号：</strong>{currentOrder.delivery_code || currentOrder.picking_code}</p>
                <p><strong>出库类型：</strong>
                  <Tag color={
                    currentOrder.outbound_type === 'production_picking' ? 'processing'
                      : currentOrder.outbound_type === 'outsource_issue' ? 'warning'
                        : 'success'
                  }>
                    {currentOrder.outbound_type === 'production_picking'
                      ? '生产领料'
                      : currentOrder.outbound_type === 'outsource_issue'
                        ? '委外发料'
                        : '销售出库'}
                  </Tag>
                </p>
                <p><strong>状态：</strong>
                  <Tag color={
                    currentOrder.status === '已完成' ? 'success' :
                      currentOrder.status === '已确认' ? 'processing' :
                        currentOrder.status === '已取消' ? 'error' : 'default'
                  }>
                    {currentOrder.status}
                  </Tag>
                </p>
                {currentOrder.customer_name && (
                  <p><strong>客户：</strong>{currentOrder.customer_name}</p>
                )}
                {currentOrder.work_order_code && (
                  <p><strong>工单号：</strong>{currentOrder.work_order_code}</p>
                )}
                <p><strong>出库仓库：</strong>{currentOrder.warehouse_name}</p>
                <p><strong>出库日期：</strong>{currentOrder.delivery_date}</p>
                <p><strong>操作员：</strong>{currentOrder.delivered_by}</p>
                <p><strong>总数量：</strong>{currentOrder.total_quantity}</p>
                <p><strong>总品种：</strong>{currentOrder.total_items}</p>
                {currentOrder.notes && (
                  <p><strong>备注：</strong>{currentOrder.notes}</p>
                )}
              </Card>

              {/* 生命周期 */}
              <DetailDrawerSection title="生命周期">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    const lifecycle = getOutboundLifecycle(currentOrder as Record<string, unknown>);
                    const mainStages = lifecycle.mainStages ?? [];
                    if (mainStages.length === 0) return null;
                    return (
                      <UniLifecycleStepper
                        steps={mainStages}
                        status={lifecycle.status}
                        showLabels
                        nextStepSuggestions={lifecycle.nextStepSuggestions}
                        hideNextStepSuggestions
                      />
                    );
                  })()}
                  {currentOrder.id != null && outboundDocumentTrackingType(currentOrder) ? (
                    <DetailDrawerInlineFullChain
                      documentType={outboundDocumentTrackingType(currentOrder)!}
                      documentId={currentOrder.id}
                      active={detailDrawerVisible}
                      selfDocumentId={currentOrder.id}
                      renderBriefActions={(doc) => (
                        <WarehouseTraceBriefPrimaryActions
                          doc={doc}
                          t={t}
                          navigate={navigate}
                          closeDrawer={() => {
                            setDetailDrawerVisible(false);
                            setCurrentOrder(null);
                          }}
                        />
                      )}
                    />
                  ) : null}
                </div>
              </DetailDrawerSection>

              {/* 出库单明细 */}
              {currentOrder.items && currentOrder.items.length > 0 && (
                <Card title="出库明细">
                  <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
                  <Table
                    className="warehouse-detail-table"
                    size="small"
                    rowKey={(record, idx) => {
                      const r = record as OutboundOrderItem;
                      return r.id != null ? String(r.id) : `row-${idx ?? 0}`;
                    }}
                    pagination={false}
                    columns={
                      currentOrder.outbound_type === 'production_picking'
                        ? [
                            { title: '物料编号', dataIndex: 'material_code', width: 120 },
                            { title: '物料名称', dataIndex: 'material_name', width: 150 },
                            { title: '需求数量', dataIndex: 'required_quantity', width: 100, align: 'right' as const },
                            { title: '已领数量', dataIndex: 'picked_quantity', width: 100, align: 'right' as const },
                            { title: '单位', dataIndex: 'material_unit', width: 60 },
                            { title: '仓库', dataIndex: 'warehouse_name', width: 120 },
                            { title: '批次号', dataIndex: 'batch_number', width: 100 },
                          ]
                        : [
                            { title: '物料编号', dataIndex: 'material_code', width: 120 },
                            { title: '物料名称', dataIndex: 'material_name', width: 150 },
                            { title: '出库数量', dataIndex: 'delivery_quantity', width: 100, align: 'right' as const },
                            { title: '单位', dataIndex: 'material_unit', width: 60 },
                            { title: '备注', dataIndex: 'notes' },
                          ]
                    }
                    dataSource={currentOrder.items}
                  />
                </Card>
              )}

              {/* 操作记录 */}
              {currentOrder?.id && (
                <DetailDrawerSection title="操作记录">
                  {outboundTracking.loading && (
                    <div style={{ textAlign: 'center', padding: 24 }}>
                      <Spin />
                    </div>
                  )}
                  {outboundTracking.error && !outboundTracking.loading && (
                    <Typography.Text type="danger">{outboundTracking.error}</Typography.Text>
                  )}
                  {outboundTracking.data && !outboundTracking.loading && (
                    <DocumentTrackingTimelineBody data={outboundTracking.data} />
                  )}
                  {!outboundTracking.loading && !outboundTracking.data && !outboundTracking.error && (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无操作记录" />
                  )}
                </DetailDrawerSection>
              )}
            </div>
          ) : null
        }
      />
    </ListPageTemplate>
  );
};

export default OutboundPage;
