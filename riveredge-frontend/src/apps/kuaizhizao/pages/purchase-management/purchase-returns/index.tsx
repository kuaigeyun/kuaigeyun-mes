/**
 * 采购退货单管理页面
 *
 * 提供采购退货单的查看、确认退货与删除；列表与详情遵循 UI_Standard / riveredge-detail-drawer-ui。
 *
 * @author RiverEdge Team
 * @date 2026-01-17
 */

import React, { useRef, useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { useNavigate } from 'react-router-dom';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProFormText,
  ProFormDatePicker,
  ProFormTextArea,
  ProFormSelect,
  ProFormInstance,
} from '@ant-design/pro-components';
import type { DescriptionsProps } from 'antd';
import {
  App,
  Button,
  Tag,
  Modal,
  Table,
  Typography,
  Descriptions,
  Empty,
  Dropdown,
  Space,
  Row,
  Col,
  Form as AntForm,
  InputNumber,
  Input,
  Spin,
  theme,
} from 'antd';
import { EyeOutlined, CheckCircleOutlined, EditOutlined, PlusOutlined, AppstoreAddOutlined, ImportOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import {
  ListPageTemplate,
  DetailDrawerTemplate,
  FormModalTemplate,
  DetailDrawerSection, DetailDrawerInlineFullChain,
  DetailDrawerActions,
  MODAL_CONFIG,
  DRAWER_CONFIG,
  type StatCard,
} from '../../../../../components/layout-templates';
const LazyUniImport = lazy(() =>
  import('../../../../../components/uni-import').then((m) => ({ default: m.UniImport })),
);
import { UniTableDetail } from '../../../../../components/uni-table-detail';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniMaterialBatchPicker } from '../../../../../components/uni-material-batch-picker';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import type { Material } from '../../../../master-data/types/material';
import { SimpleSparkline } from '../../../../../components';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { WarehouseTraceBriefPrimaryActions } from '../../warehouse-management/WarehouseTraceBriefFooter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { warehouseApi } from '../../../services/production';
import { supplierApi, getDictionaryOptions } from '../../../../master-data/services/supply-chain';
import { initializeSystemDictionaries } from '../../../../../services/dataDictionary';
import { getPurchaseReturnLifecycle } from '../../../utils/purchaseReturnLifecycle';
import { renderRowActionsOverflow } from '../../../../../utils/renderRowActionsOverflow';

interface PurchaseReturn {
  id?: number;
  tenant_id?: number;
  return_code?: string;
  purchase_receipt_id?: number;
  purchase_receipt_code?: string;
  purchase_order_id?: number;
  purchase_order_code?: string;
  supplier_id?: number;
  supplier_name?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  return_time?: string;
  returner_id?: number;
  returner_name?: string;
  reviewer_id?: number;
  reviewer_name?: string;
  review_time?: string;
  review_status?: string;
  review_remarks?: string;
  return_reason?: string;
  return_type?: string;
  status?: string;
  total_quantity?: number;
  total_amount?: number;
  shipping_method?: string;
  tracking_number?: string;
  shipping_address?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

interface PurchaseReturnDetail extends PurchaseReturn {
  items?: PurchaseReturnItem[];
}

interface PurchaseReturnItem {
  id?: number;
  material_code?: string;
  material_name?: string;
  return_quantity?: number;
  unit_price?: number;
  total_amount?: number;
  batch_number?: string;
  expiry_date?: string;
  location_code?: string;
  serial_numbers?: string[];
  notes?: string;
}

const PR_DETAIL_ITEMS_MIN_WIDTH = 1000;

const FALLBACK_RETURN_REASON: { label: string; value: string }[] = [
  { label: '质量问题', value: 'QUALITY_ISSUE' },
  { label: '规格不符', value: 'SPEC_MISMATCH' },
  { label: '数量错误', value: 'QTY_ERROR' },
  { label: '包装破损', value: 'PACKAGE_DAMAGE' },
  { label: '客户取消', value: 'CUSTOMER_CANCEL' },
  { label: '其他', value: 'OTHER' },
];

const FALLBACK_RETURN_TYPE: { label: string; value: string }[] = [
  { label: '换货', value: 'EXCHANGE' },
  { label: '退款', value: 'REFUND' },
  { label: '返修', value: 'REWORK' },
  { label: '报废退货', value: 'SCRAP_RETURN' },
  { label: '其他', value: 'OTHER' },
];

const FALLBACK_SHIPPING_METHOD: { label: string; value: string }[] = [
  { label: '快递', value: 'EXPRESS' },
  { label: '物流', value: 'LOGISTICS' },
  { label: '自提', value: 'SELF_PICKUP' },
  { label: '专车配送', value: 'DEDICATED' },
  { label: '空运', value: 'AIR' },
  { label: '海运', value: 'SEA' },
];

function buildDescriptionItemsFromColumns<T extends Record<string, any>>(
  dataSource: T,
  cols: ProDescriptionsItemProps<T>[]
): NonNullable<DescriptionsProps['items']> {
  return cols.map((col, index) => {
    const dataIndex = col.dataIndex as keyof T | undefined;
    const value = dataIndex != null ? dataSource[dataIndex] : undefined;
    let content: React.ReactNode = value as React.ReactNode;
    if (col.valueType === 'dateTime' && value) {
      content = dayjs(value as string).format('YYYY-MM-DD HH:mm:ss');
    } else if (col.valueType === 'date' && value) {
      content = dayjs(value as string).format('YYYY-MM-DD');
    }
    if (col.render && dataSource != null) {
            content = (col.render as (dom: import('react').ReactNode, entity: T, i: number) => import('react').ReactNode)(
        content,
        dataSource,
        index,
      );
    }
    return {
      key: String(col.key ?? col.dataIndex ?? index),
      label: col.title as React.ReactNode,
      children: content !== undefined && content !== null ? content : '-',
      span: col.span ?? 1,
    };
  });
}

function renderPurchaseReturnRowActions(nodes: React.ReactNode[], keyPrefix: string): React.ReactNode {
  return renderRowActionsOverflow(nodes, keyPrefix);
}

const PurchaseReturnsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const purchaseReturnDetailDrawerZIndex = token.zIndexPopupBase;
  const actionRef = useRef<ActionType>(null);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const queryClient = useQueryClient();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingDetail, setEditingDetail] = useState<PurchaseReturnDetail | null>(null);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const formRef = useRef<ProFormInstance>(null);
  const [returnReasonOptions, setReturnReasonOptions] = useState(FALLBACK_RETURN_REASON);
  const [returnTypeOptions, setReturnTypeOptions] = useState(FALLBACK_RETURN_TYPE);
  const [shippingMethodOptions, setShippingMethodOptions] = useState(FALLBACK_SHIPPING_METHOD);
  const [dictOptionsLoading, setDictOptionsLoading] = useState(false);

  const invalidatePurchaseReturnStatistics = () => {
    queryClient.invalidateQueries({ queryKey: ['purchaseReturnStatistics'] });
  };

  const { data: prStats } = useQuery({
    queryKey: ['purchaseReturnStatistics'],
    queryFn: () => warehouseApi.purchaseReturn.statistics(),
  });

  useEffect(() => {
    if (!modalVisible) return;
    let cancelled = false;
    (async () => {
      setDictOptionsLoading(true);
      const loadAll = async () => {
        const [reason, rtype, ship] = await Promise.all([
          getDictionaryOptions('RETURN_REASON'),
          getDictionaryOptions('RETURN_TYPE'),
          getDictionaryOptions('SHIPPING_METHOD'),
        ]);
        return { reason, rtype, ship };
      };
      try {
        let { reason, rtype, ship } = await loadAll();
        if (!cancelled && (reason.length === 0 || rtype.length === 0 || ship.length === 0)) {
          try {
            await initializeSystemDictionaries();
            if (!cancelled) ({ reason, rtype, ship } = await loadAll());
          } catch (e) {
            console.warn('initializeSystemDictionaries failed:', e);
          }
        }
        if (!cancelled) {
          setReturnReasonOptions(reason.length ? reason : FALLBACK_RETURN_REASON);
          setReturnTypeOptions(rtype.length ? rtype : FALLBACK_RETURN_TYPE);
          setShippingMethodOptions(ship.length ? ship : FALLBACK_SHIPPING_METHOD);
        }
      } finally {
        if (!cancelled) setDictOptionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modalVisible]);

  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [returnDetail, setReturnDetail] = useState<PurchaseReturnDetail | null>(null);
  const [prRetTrackingRefreshKey, setPrRetTrackingRefreshKey] = useState(0);
  const purchaseReturnTracking = useDocumentTracking(
    detailDrawerVisible && returnDetail?.id ? 'purchase_return' : undefined,
    returnDetail?.id,
    prRetTrackingRefreshKey,
  );

  const handleDetail = async (record: PurchaseReturn) => {
    try {
      const detail = await warehouseApi.purchaseReturn.get(record.id!.toString());
      setReturnDetail(detail as PurchaseReturnDetail);
      setDetailDrawerVisible(true);
      setPrRetTrackingRefreshKey((k) => k + 1);
    } catch {
      messageApi.error('获取采购退货单详情失败');
    }
  };

  const handleConfirm = async (record: PurchaseReturn) => {
    Modal.confirm({
      title: '确认采购退货',
      content: `确定要确认采购退货单 "${record.return_code}" 吗？确认后将自动更新库存。`,
      onOk: async () => {
        try {
          await warehouseApi.purchaseReturn.confirm(record.id!.toString());
          messageApi.success('采购退货确认成功');
          invalidatePurchaseReturnStatistics();
          if (returnDetail?.id === record.id) {
            const fresh = await warehouseApi.purchaseReturn.get(record.id!.toString());
            setReturnDetail(fresh as PurchaseReturnDetail);
            setPrRetTrackingRefreshKey((k) => k + 1);
          }
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '采购退货确认失败');
        }
      },
    });
  };

  const handleCreate = () => {
    setEditingId(null);
    setEditingDetail(null);
    setModalVisible(true);
    setTimeout(() => {
      formRef.current?.setFieldsValue({
        return_time: dayjs(),
        items: [],
      });
    }, 0);
  };

  const handleEdit = async (record: PurchaseReturn) => {
    if (record.status !== '待退货' && record.status !== '草稿') {
      messageApi.warning('仅「待退货」或「草稿」状态可编辑');
      return;
    }
    try {
      const detail = (await warehouseApi.purchaseReturn.get(record.id!.toString())) as PurchaseReturnDetail;
      setEditingId(record.id!);
      setEditingDetail(detail);
      setModalVisible(true);
      formRef.current?.setFieldsValue({
        supplier_id: detail.supplier_id,
        supplier_name: detail.supplier_name,
        warehouse_id: detail.warehouse_id,
        warehouse_name: detail.warehouse_name,
        return_time: detail.return_time ? dayjs(detail.return_time) : dayjs(),
        return_reason: detail.return_reason,
        return_type: detail.return_type,
        shipping_method: detail.shipping_method,
        notes: detail.notes,
        items: (detail.items || []).map((it) => ({
          material_id: (it as any).material_id,
          material_code: it.material_code,
          material_name: it.material_name,
          return_quantity: it.return_quantity,
          unit_price: it.unit_price,
          batch_number: it.batch_number,
          notes: it.notes,
          purchase_receipt_item_id: (it as any).purchase_receipt_item_id,
          material_spec: (it as any).material_spec,
          material_unit: (it as any).material_unit ?? '件',
        })),
      });
    } catch {
      messageApi.error('加载退货单失败');
    }
  };

  const handleWithdraw = async (record: PurchaseReturn) => {
    Modal.confirm({
      title: '撤回退货确认',
      content: `确定要撤回采购退货单 "${record.return_code}" 的确认状态吗？`,
      onOk: async () => {
        try {
          await warehouseApi.purchaseReturn.withdraw(record.id!.toString());
          messageApi.success('已撤回到待退货');
          invalidatePurchaseReturnStatistics();
          invalidateMenuBadgeCounts();
          if (returnDetail?.id === record.id) {
            const fresh = await warehouseApi.purchaseReturn.get(record.id!.toString());
            setReturnDetail(fresh as PurchaseReturnDetail);
            setPrRetTrackingRefreshKey((k) => k + 1);
          }
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '撤回失败');
        }
      },
    });
  };

  const buildPurchaseReturnItemsPayload = (items: any[]) =>
    (items || []).map((it) => {
      const qty = Number(it.return_quantity ?? 0);
      const price = Number(it.unit_price ?? 0);
      const total = Number((it.total_amount != null ? it.total_amount : qty * price).toFixed(2));
      return {
        purchase_receipt_item_id: it.purchase_receipt_item_id ?? undefined,
        material_id: it.material_id,
        material_code: it.material_code || '',
        material_name: it.material_name || '',
        material_spec: it.material_spec ?? undefined,
        material_unit: it.material_unit || '件',
        return_quantity: qty,
        unit_price: price,
        total_amount: total,
        batch_number: it.batch_number ?? undefined,
        location_code: it.location_code ?? undefined,
        notes: it.notes ?? undefined,
      };
    });

  const onFinish = async (values: any) => {
    try {
      const itemsPayload = buildPurchaseReturnItemsPayload(values.items);
      const returnTime =
        values.return_time && typeof values.return_time.format === 'function'
          ? values.return_time.format('YYYY-MM-DD')
          : values.return_time;
      if (editingId) {
        const detail = editingDetail;
        if (!detail || (detail.status !== '待退货' && detail.status !== '草稿')) {
          messageApi.warning('当前状态不允许编辑');
          return;
        }
        await warehouseApi.purchaseReturn.update(editingId.toString(), {
          supplier_id: values.supplier_id,
          supplier_name: values.supplier_name ?? detail.supplier_name,
          warehouse_id: values.warehouse_id,
          warehouse_name: values.warehouse_name ?? detail.warehouse_name,
          return_time: returnTime,
          return_reason: values.return_reason ?? null,
          return_type: values.return_type ?? detail.return_type ?? '质量问题',
          shipping_method: values.shipping_method ?? null,
          tracking_number: detail.tracking_number ?? null,
          shipping_address: detail.shipping_address ?? null,
          notes: values.notes ?? null,
          purchase_receipt_id: detail.purchase_receipt_id ?? null,
          purchase_receipt_code: detail.purchase_receipt_code ?? null,
          purchase_order_id: detail.purchase_order_id ?? null,
          purchase_order_code: detail.purchase_order_code ?? null,
          status: detail.status,
          items: itemsPayload,
        });
        messageApi.success('采购退货单已更新');
      } else {
        await warehouseApi.purchaseReturn.create({
          ...values,
          return_time: returnTime,
          items: itemsPayload,
        });
        messageApi.success('采购退货单创建成功');
      }
      setModalVisible(false);
      setEditingId(null);
      setEditingDetail(null);
      invalidatePurchaseReturnStatistics();
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
    }
  };

  const appendItemsFromMaterials = (materials: Material[]) => {
    const currentItems = formRef.current?.getFieldValue('items') || [];
    const newItems = materials.map((m) => ({
      material_id: m.id,
      material_code: m.mainCode,
      material_name: m.name,
      material_spec: m.specification,
      material_unit: m.baseUnit,
      return_quantity: 1,
      unit_price: m.defaults?.defaultPurchasePrice ?? 0,
    }));
    formRef.current?.setFieldsValue({
      items: [...currentItems, ...newItems],
    });
    setMaterialPickerOpen(false);
  };

  const handleImport = (data: any[]) => {
    const currentItems = formRef.current?.getFieldValue('items') || [];
    const newItems = data.map((row) => ({
      material_code: row['物料编号'],
      return_quantity: Number(row['退货数量'] || 1),
      unit_price: Number(row['单价'] || 0),
      batch_number: row['批次号'],
      notes: row['备注'],
    }));
    formRef.current?.setFieldsValue({
      items: [...currentItems, ...newItems],
    });
    setImportModalVisible(false);
  };

  const detailColumns: ProDescriptionsItemProps<PurchaseReturnDetail>[] = [
    {
      title: '退货单编号',
      dataIndex: 'return_code',
      render: (_, entity) => (
        <Typography.Text copyable={{ text: String(entity.return_code ?? '') }}>{entity.return_code ?? '-'}</Typography.Text>
      ),
    },
    {
      title: '采购入库单编号',
      dataIndex: 'purchase_receipt_code',
      render: (_, entity) => (
        <Typography.Text copyable={{ text: String(entity.purchase_receipt_code ?? '') }}>{entity.purchase_receipt_code ?? '-'}</Typography.Text>
      ),
    },
    {
      title: '采购订单编号',
      dataIndex: 'purchase_order_code',
      render: (_, entity) => (
        <Typography.Text copyable={{ text: String(entity.purchase_order_code ?? '') }}>{entity.purchase_order_code ?? '-'}</Typography.Text>
      ),
    },
    { title: '供应商', dataIndex: 'supplier_name' },
    { title: '仓库', dataIndex: 'warehouse_name' },
    {
      title: '退货状态',
      dataIndex: 'status',
      render: (status) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          待退货: { text: '待退货', color: 'default' },
          已退货: { text: '已退货', color: 'success' },
          已取消: { text: '已取消', color: 'error' },
        };
        const config = statusMap[(status as string) || ''] || { text: (status as string) || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '审核状态',
      dataIndex: 'review_status',
      render: (status) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          待审核: { text: '待审核', color: 'default' },
          审核通过: { text: '审核通过', color: 'success' },
          审核驳回: { text: '审核驳回', color: 'error' },
        };
        const config = statusMap[(status as string) || ''] || { text: (status as string) || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    { title: '退货原因', dataIndex: 'return_reason' },
    { title: '退货类型', dataIndex: 'return_type' },
    { title: '总数量', dataIndex: 'total_quantity' },
    {
      title: '总金额',
      dataIndex: 'total_amount',
      render: (text: any) => `¥${text?.toLocaleString() || 0}`,
    },
    { title: '退货时间', dataIndex: 'return_time', valueType: 'dateTime' },
    { title: '退货人', dataIndex: 'returner_name' },
    { title: '审核人', dataIndex: 'reviewer_name' },
    { title: '审核时间', dataIndex: 'review_time', valueType: 'dateTime' },
    { title: '备注', dataIndex: 'notes', span: 3, render: (text: any) => text || '-' },
  ];

  const columns: ProColumns<PurchaseReturn>[] = [
    {
      title: '供应商 / 退货单号',
      key: 'return_code',
      dataIndex: 'return_code',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      fixed: 'left',
      render: (_, r) => (
        <UniTableStackedPrimaryCell
          primary={String(r.supplier_name ?? '')}
          secondary={String(r.return_code ?? '')}
        />
      ),
    },
    { title: '退货单编号', dataIndex: 'return_code', hideInTable: true },
    { title: '供应商', dataIndex: 'supplier_name', hideInTable: true },
    {
      title: '采购入库单编号',
      dataIndex: 'purchase_receipt_code',
      width: 148,
      ellipsis: true,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.purchase_receipt_code ?? '') }} ellipsis>
          {r.purchase_receipt_code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: '采购订单编号',
      dataIndex: 'purchase_order_code',
      width: 148,
      ellipsis: true,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.purchase_order_code ?? '') }} ellipsis>
          {r.purchase_order_code ?? '-'}
        </Typography.Text>
      ),
    },
    { title: '仓库', dataIndex: 'warehouse_name', width: 120, ellipsis: true },
    {
      title: '审核状态',
      dataIndex: 'review_status',
      width: 100,
      hideInSearch: true,
      render: (status: any) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          待审核: { text: '待审核', color: 'default' },
          审核通过: { text: '审核通过', color: 'success' },
          审核驳回: { text: '审核驳回', color: 'error' },
        };
        const config = statusMap[status as keyof typeof statusMap] || statusMap['待审核'];
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '总数量',
      dataIndex: 'total_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '总金额',
      dataIndex: 'total_amount',
      width: 120,
      align: 'right',
      render: (text: any) => `¥${text?.toLocaleString() || 0}`,
    },
    {
      title: '退货时间',
      dataIndex: 'return_time',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      valueType: 'dateTime',
      width: 168,
      hideInSearch: true,
      defaultSortOrder: 'descend',
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getPurchaseReturnLifecycle(record);
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
      width: 220,
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => {
        const parts: React.ReactNode[] = [
          <Button
            key="d"
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleDetail(record);
            }}
          >
            详情
          </Button>,
        ];
        if (record.status === '待退货' || record.status === '草稿') {
          parts.push(
            <Button
              key="e"
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                void handleEdit(record);
              }}
            >
              编辑
            </Button>
          );
        }
        if (record.status === '待退货') {
          parts.push(
            <Button
              key="c"
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              style={{ color: '#52c41a' }}
              onClick={(e) => {
                e.stopPropagation();
                handleConfirm(record);
              }}
            >
              确认退货
            </Button>
          );
        }
        if (record.status === '已退货') {
          parts.push(
            <Button
              key="w"
              type="link"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                void handleWithdraw(record);
              }}
            >
              撤回确认
            </Button>
          );
        }
        return renderPurchaseReturnRowActions(parts, `pr-${record.id ?? 'row'}`);
      },
    },
  ];

  const statCards: StatCard[] = useMemo(() => {
    const s = prStats;
    const z = [0, 0, 0, 0, 0, 0, 0];
    return [
      {
        title: '退货单总数',
        value: s?.total_count ?? 0,
        valueStyle: { color: token.colorPrimary },
        backgroundChart: <SimpleSparkline data={s?.trend_total?.length ? s.trend_total : z} color={token.colorPrimary} />,
      },
      {
        title: '待退货',
        value: s?.pending_count ?? 0,
        valueStyle: { color: token.colorWarning },
        backgroundChart: <SimpleSparkline data={s?.trend_pending?.length ? s.trend_pending : z} color={token.colorWarning} />,
      },
      {
        title: '已退货',
        value: s?.done_count ?? 0,
        valueStyle: { color: token.colorSuccess },
        backgroundChart: <SimpleSparkline data={s?.trend_done?.length ? s.trend_done : z} color={token.colorSuccess} />,
      },
      {
        title: '已取消',
        value: s?.cancelled_count ?? 0,
        valueStyle: { color: token.colorError },
        backgroundChart: <SimpleSparkline data={s?.trend_cancelled?.length ? s.trend_cancelled : z} color={token.colorError} />,
      },
    ];
  }, [prStats, token]);

  return (
    <>
      <ListPageTemplate statCards={statCards}>
        <UniTable<PurchaseReturn>
          headerTitle="采购退货单"
          columnPersistenceId="apps.kuaizhizao.pages.purchase-management.purchase-returns"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          showCreateButton={true}
          createButtonText="新建采购退货单"
          onCreate={handleCreate}
          request={async (params) => {
            try {
              const response = await warehouseApi.purchaseReturn.list({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                status: params.status,
                purchase_receipt_id: params.purchase_receipt_id,
                supplier_id: params.supplier_id,
                keyword: params.keyword,
              });
              return {
                data: Array.isArray(response) ? response : response.data || [],
                success: true,
                total: Array.isArray(response) ? response.length : response.total || 0,
              };
            } catch {
              messageApi.error('获取采购退货单列表失败');
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          enableRowSelection={true}
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton={true}
          onDelete={async (keys) => {
            Modal.confirm({
              title: '确认批量删除',
              content: `确定要删除选中的 ${keys.length} 条采购退货单吗？`,
              onOk: async () => {
                try {
                  for (const id of keys) {
                    await warehouseApi.purchaseReturn.delete(String(id));
                  }
                  messageApi.success(`成功删除 ${keys.length} 条记录`);
                  setSelectedRowKeys([]);
                  invalidatePurchaseReturnStatistics();
                  if (returnDetail?.id != null && keys.includes(returnDetail.id)) {
                    setReturnDetail(null);
                    setDetailDrawerVisible(false);
                  }
                  invalidateMenuBadgeCounts();

                  actionRef.current?.reload();
                } catch (error: any) {
                  messageApi.error(error.message || '删除失败');
                }
              },
            });
          }}
          scroll={{ x: 1500 }}
          onRow={(record) => ({
            onClick: () => handleDetail(record),
            style: { cursor: 'pointer' },
          })}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={editingId ? '编辑采购退货单' : '新增采购退货单'}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setEditingId(null);
          setEditingDetail(null);
        }}
        onFinish={onFinish}
        formRef={formRef}
        width={MODAL_CONFIG.LARGE_WIDTH}
      >
        <Row gutter={16}>
          <Col span={8}>
            <ProFormSelect
              name="supplier_id"
              label="供应商"
              placeholder="请选择供应商"
              required
              request={async () => {
                const res = await supplierApi.list({ limit: 1000, isActive: true });
                const list = Array.isArray(res) ? res : (res as any)?.data || (res as any)?.items || [];
                return list.map((s: any) => ({
                  label: s.name || s.supplier_name || s.code || `供应商${s.id}`,
                  value: s.id ?? s.supplier_id,
                }));
              }}
              fieldProps={{
                showSearch: true,
                optionFilterProp: 'label',
                onChange: (_, option) => {
                  formRef.current?.setFieldsValue({ supplier_name: (option as any)?.label ?? '' });
                },
              }}
              rules={[{ required: true, message: '请选择供应商' }]}
            />
            <ProFormText name="supplier_name" hidden />
          </Col>
          <Col span={8}>
            <UniWarehouseSelect
              name="warehouse_id"
              label="退入仓库"
              placeholder="请选择仓库"
              required
              onChange={(_, wh) => formRef.current?.setFieldsValue({ warehouse_name: wh?.name ?? '' })}
              rules={[{ required: true, message: '请选择仓库' }]}
            />
            <ProFormText name="warehouse_name" hidden />
          </Col>
          <Col span={8}>
            <ProFormDatePicker
              name="return_time"
              label="退货日期"
              required
              fieldProps={{ style: { width: '100%' } }}
              initialValue={dayjs()}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={8}>
            <ProFormSelect
              name="return_reason"
              label="退货原因"
              placeholder="请选择退货原因"
              options={returnReasonOptions}
              fieldProps={{ showSearch: true, allowClear: true, loading: dictOptionsLoading }}
            />
          </Col>
          <Col span={8}>
            <ProFormSelect
              name="return_type"
              label="退货类型"
              placeholder="请选择退货类型"
              options={returnTypeOptions}
              fieldProps={{ showSearch: true, allowClear: true, loading: dictOptionsLoading }}
            />
          </Col>
          <Col span={8}>
            <ProFormSelect
              name="shipping_method"
              label="发货方式"
              placeholder="请选择发货方式"
              options={shippingMethodOptions}
              fieldProps={{ showSearch: true, allowClear: true, loading: dictOptionsLoading }}
            />
          </Col>
        </Row>

        <UniTableDetail
          name="items"
          title="退货明细"
          required
          requiredMessage="请添加至少一项明细"
          headerExtra={(
            <Space size={8}>
              <Button
                type="default"
                icon={<ImportOutlined />}
                onClick={() => setImportModalVisible(true)}
              >
                导入明细
              </Button>
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => {
                  const items = [...(formRef.current?.getFieldValue('items') ?? [])];
                  items.push({ return_quantity: 1, unit_price: 0 });
                  formRef.current?.setFieldsValue({ items });
                }}
              >
                添加明细
              </Button>
              <Button
                type="default"
                icon={<AppstoreAddOutlined />}
                onClick={() => setMaterialPickerOpen(true)}
              >
                {t('app.kuaizhizao.common.materialBatchSelect')}
              </Button>
            </Space>
          )}
          columns={[
            {
              title: '物料',
              dataIndex: 'material_id',
              width: 260,
              render: (_: unknown, __: unknown, index: number) => (
                <UniMaterialSelect
                  name={[index, 'material_id']}
                  label=""
                  placeholder="选择物料"
                  required
                  size="small"
                  listFieldKey={index}
                  listFieldName="items"
                  fillMapping={{
                    material_code: 'mainCode',
                    material_name: 'name',
                    material_spec: 'specification',
                    material_unit: 'baseUnit',
                  }}
                  showAdvancedSearch
                />
              ),
            },
            {
              title: '退货数量',
              dataIndex: 'return_quantity',
              width: 120,
              align: 'right' as const,
              render: (_: unknown, __: unknown, index: number) => (
                <AntForm.Item name={[index, 'return_quantity']} noStyle>
                  <InputNumber size="small" style={{ width: '100%' }} min={1} />
                </AntForm.Item>
              ),
            },
            {
              title: '单价',
              dataIndex: 'unit_price',
              width: 120,
              align: 'right' as const,
              render: (_: unknown, __: unknown, index: number) => (
                <AntForm.Item name={[index, 'unit_price']} noStyle>
                  <InputNumber size="small" style={{ width: '100%' }} min={0} prefix="¥" />
                </AntForm.Item>
              ),
            },
          ]}
          disabledAdd
          initialValue={{ return_quantity: 1, unit_price: 0 }}
          tableProps={{
            size: 'small',
            style: { width: '100%', margin: 0 },
          }}
        />

        <ProFormTextArea name="notes" label="备注" placeholder="请输入备注说明" fieldProps={{ rows: 3 }} />
      </FormModalTemplate>

      <UniMaterialBatchPicker
        open={materialPickerOpen}
        onCancel={() => setMaterialPickerOpen(false)}
        onConfirm={appendItemsFromMaterials}
      />

      <Suspense fallback={null}>
        <LazyUniImport
          visible={importModalVisible}
          onCancel={() => setImportModalVisible(false)}
          onConfirm={handleImport}
          title="导入采购退货明细"
          headers={['物料编号', '退货数量', '单价', '批次号', '备注']}
          exampleRow={['MAT001', '10', '99.5', 'B20260117001', '备注说明']}
        />
      </Suspense>

      <DetailDrawerTemplate
        title={`采购退货单详情${returnDetail?.return_code ? ` - ${returnDetail.return_code}` : ''}`}
        open={detailDrawerVisible}
        zIndex={purchaseReturnDetailDrawerZIndex}
        onClose={() => {
          setDetailDrawerVisible(false);
          setReturnDetail(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        column={3}
        dataSource={returnDetail || undefined}
        extra={
          returnDetail ? (
            <DetailDrawerActions
              items={[
                {
                  key: 'edit',
                  visible: returnDetail.status === '待退货' || returnDetail.status === '草稿',
                  render: () => (
                    <Button type="link" size="small" icon={<EditOutlined />} onClick={() => void handleEdit(returnDetail)}>
                      编辑
                    </Button>
                  ),
                },
                {
                  key: 'confirm',
                  visible: returnDetail.status === '待退货',
                  render: () => (
                    <Button
                      type="link"
                      size="small"
                      icon={<CheckCircleOutlined />}
                      style={{ color: '#52c41a' }}
                      onClick={() => handleConfirm(returnDetail)}
                    >
                      确认退货
                    </Button>
                  ),
                },
                {
                  key: 'withdraw',
                  visible: returnDetail.status === '已退货',
                  render: () => (
                    <Button type="link" size="small" onClick={() => void handleWithdraw(returnDetail)}>
                      撤回确认
                    </Button>
                  ),
                },
              ]}
            />
          ) : null
        }
        customContent={
          returnDetail && (
            <>
              <DetailDrawerSection title="基本信息">
                <Descriptions
                  column={3}
                  size="small"
                  items={buildDescriptionItemsFromColumns(returnDetail, detailColumns)}
                />
              </DetailDrawerSection>

              <DetailDrawerSection title="生命周期">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    const lifecycle = getPurchaseReturnLifecycle(returnDetail);
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
                  {returnDetail.id != null ? (
                    <DetailDrawerInlineFullChain
                      documentType='purchase_return'
                      documentId={returnDetail.id}
                      active={detailDrawerVisible}
                      selfDocumentId={returnDetail.id}
                      renderBriefActions={(doc) => (
                  <WarehouseTraceBriefPrimaryActions
                    doc={doc}
                    t={t}
                    navigate={navigate}
                    closeDrawer={() => {
                      setDetailDrawerVisible(false);
                      setReturnDetail(null);
                    }}
                  />
                )}
                    />
                  ) : null}
                </div>
              </DetailDrawerSection>

              <DetailDrawerSection title="明细信息">
                <style>{`
                  .purchase-return-detail-items .ant-table-wrapper .ant-table-body,
                  .purchase-return-detail-items .ant-table-wrapper .ant-table-content {
                    overflow: visible !important;
                  }
                `}</style>
                {returnDetail.items && returnDetail.items.length > 0 ? (
                  <div
                    className="purchase-return-detail-items"
                    style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', overflowY: 'hidden' }}
                  >
                    <Table
                      size="small"
                      tableLayout="fixed"
                      style={{ minWidth: PR_DETAIL_ITEMS_MIN_WIDTH }}
                      columns={[
                        { title: '物料编号', dataIndex: 'material_code', width: 120, ellipsis: true },
                        { title: '物料名称', dataIndex: 'material_name', width: 150, ellipsis: true },
                        { title: '退货数量', dataIndex: 'return_quantity', width: 100, align: 'right' },
                        {
                          title: '单价',
                          dataIndex: 'unit_price',
                          width: 100,
                          align: 'right',
                          render: (text) => `¥${text || 0}`,
                        },
                        {
                          title: '金额',
                          dataIndex: 'total_amount',
                          width: 100,
                          align: 'right',
                          render: (text) => `¥${text || 0}`,
                        },
                        { title: '批次号', dataIndex: 'batch_number', width: 120 },
                        { title: '库位', dataIndex: 'location_code', width: 100 },
                      ]}
                      dataSource={returnDetail.items}
                      pagination={false}
                      rowKey="id"
                      bordered
                    />
                  </div>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无明细" />
                )}
              </DetailDrawerSection>

              <DetailDrawerSection title="操作记录">
                {purchaseReturnTracking.loading && (
                  <div style={{ textAlign: 'center', padding: 24 }}>
                    <Spin />
                  </div>
                )}
                {purchaseReturnTracking.error && !purchaseReturnTracking.loading && (
                  <Typography.Text type="danger">{purchaseReturnTracking.error}</Typography.Text>
                )}
                {purchaseReturnTracking.data && !purchaseReturnTracking.loading && (
                  <DocumentTrackingTimelineBody data={purchaseReturnTracking.data} />
                )}
                {!purchaseReturnTracking.loading && !purchaseReturnTracking.data && !purchaseReturnTracking.error && (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无操作记录" />
                )}
              </DetailDrawerSection>
            </>
          )
        }
      />
    </>
  );
};

export default PurchaseReturnsPage;
