/**
 * 收货通知单管理页面
 *
 * 采购通知仓库收货，不直接动库存。来源为采购订单。
 * 行为与发货通知单对齐：ProForm、Row/Col、Form.List、编号规则、UniWarehouseSelect、UniMaterialSelect。
 *
 * @author RiverEdge Team
 * @date 2026-02-22
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { useNavigate } from 'react-router-dom';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProForm, ProFormText, ProFormDatePicker, ProFormTextArea, ProFormItem } from '@ant-design/pro-components';
import type { DescriptionsProps } from 'antd';
import {
  App,
  Button,
  Tag,
  Space,
  Modal,
  Table,
  Form as AntForm,
  Select,
  InputNumber,
  Input,
  Row,
  Col,
  Typography,
  Descriptions,
  Empty,
  Dropdown,
  Spin,
  theme,
} from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, SendOutlined, ShoppingOutlined, DownOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniMaterialBatchPicker } from '../../../../../components/uni-material-batch-picker';
import type { Material } from '../../../../master-data/types/material';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import { UniTableDetailHeader } from '../../../../../components/uni-table-detail/UniTableDetail';
import {
  ListPageTemplate,
  DetailDrawerTemplate,
  DetailDrawerSection, DetailDrawerInlineFullChain,
  DetailDrawerActions,
  FormModalTemplate,
  DRAWER_CONFIG,
  MODAL_CONFIG,
  type StatCard,
} from '../../../../../components/layout-templates';
import { UniPullCreateToolbar } from '../../../../../components/uni-pull';
import { SimpleSparkline } from '../../../../../components';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { renderRowActionsOverflow } from '../../../../../utils/renderRowActionsOverflow';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { WarehouseTraceBriefPrimaryActions } from '../../warehouse-management/WarehouseTraceBriefFooter';
import { receiptNoticeApi } from '../../../services/receipt-notice';
import { getReceiptNoticeLifecycle } from '../../../utils/receiptNoticeLifecycle';
import { listPurchaseOrders, getPurchaseOrder } from '../../../services/purchase';
import { testGenerateCode, generateCode, getCodeRulePageConfig } from '../../../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../../constants/routes';
import { buildKuaizhizaoPullCreateMenuItems, getKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';

interface ReceiptNotice {
  id?: number;
  notice_code?: string;
  purchase_order_id?: number;
  purchase_order_code?: string;
  supplier_id?: number;
  supplier_name?: string;
  supplier_contact?: string;
  supplier_phone?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  planned_receipt_date?: string;
  status?: string;
  notified_at?: string;
  purchase_receipt_id?: number;
  purchase_receipt_code?: string;
  total_quantity?: number;
  total_amount?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

interface ReceiptNoticeDetail extends ReceiptNotice {
  items?: { id?: number; material_code: string; material_name: string; material_unit: string; notice_quantity: number; unit_price?: number; total_amount?: number }[];
}

type PullPurchaseOrderCandidate = {
  id: number;
  order_code?: string;
  supplier_id?: number;
  supplier_name?: string;
  status?: string;
  order_date?: string;
  updated_at?: string;
  notice_id?: number;
  converted?: boolean;
};

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  待收货: { text: '待收货', color: 'default' },
  已通知: { text: '已通知', color: 'processing' },
  已入库: { text: '已入库', color: 'success' },
};

const defaultReceiptItem = { material_id: undefined, material_code: '', material_name: '', material_unit: '件', notice_quantity: 1, unit_price: 0 };

const RN_STAT_SPARK_1 = [10, 12, 11, 13, 14, 15, 16];
const RN_STAT_SPARK_2 = [6, 8, 7, 9, 8, 10, 9];
const RN_STAT_SPARK_3 = [4, 3, 5, 4, 6, 5, 7];
const RN_STAT_SPARK_4 = [18, 20, 22, 24, 26, 28, 30];

const RN_DETAIL_ITEMS_MIN_WIDTH = 960;

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

function renderReceiptNoticeRowActions(nodes: React.ReactNode[], keyPrefix: string): React.ReactNode {
  return renderRowActionsOverflow(nodes, keyPrefix);
}

const ReceiptNoticesPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const receiptNoticeDetailDrawerZIndex = token.zIndexPopupBase;
  const { message: messageApi } = App.useApp();
  const pullFromPurchaseOrderAction = getKuaizhizaoDocumentAction('receipt_notice.pull_from_purchase_order');
  const actionRef = useRef<ActionType>(null);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [statsVersion, setStatsVersion] = useState(0);
  const [localStats, setLocalStats] = useState({ total: 0, pending: 0, notified: 0, received: 0 });

  const refreshLocalStats = useCallback(async () => {
    try {
      const response = await receiptNoticeApi.list({ skip: 0, limit: 5000 });
      const data = Array.isArray(response) ? response : (response as any)?.items || (response as any)?.data || [];
      const arr = Array.isArray(data) ? data : [];
      setLocalStats({
        total: (response as any)?.total ?? arr.length,
        pending: arr.filter((x: ReceiptNotice) => (x.status || '').trim() === '待收货').length,
        notified: arr.filter((x: ReceiptNotice) => (x.status || '').trim() === '已通知').length,
        received: arr.filter((x: ReceiptNotice) => (x.status || '').trim() === '已入库').length,
      });
    } catch {
      setLocalStats({ total: 0, pending: 0, notified: 0, received: 0 });
    }
  }, []);

  useEffect(() => {
    refreshLocalStats();
  }, [statsVersion, refreshLocalStats]);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [noticeDetail, setNoticeDetail] = useState<ReceiptNoticeDetail | null>(null);
  const [rnTrackingRefreshKey, setRnTrackingRefreshKey] = useState(0);
  const receiptNoticeTracking = useDocumentTracking(
    detailDrawerVisible && noticeDetail?.id ? 'receipt_notice' : undefined,
    noticeDetail?.id,
    rnTrackingRefreshKey,
  );

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [pullFromPurchaseOrderVisible, setPullFromPurchaseOrderVisible] = useState(false);
  const [pullPurchaseOrderLoading, setPullPurchaseOrderLoading] = useState(false);
  const [pullPurchaseOrderSubmitting, setPullPurchaseOrderSubmitting] = useState(false);
  const [pullPurchaseOrderKeyword, setPullPurchaseOrderKeyword] = useState('');
  const [pullPurchaseOrderCandidates, setPullPurchaseOrderCandidates] = useState<PullPurchaseOrderCandidate[]>([]);
  const [selectedPullPurchaseOrderId, setSelectedPullPurchaseOrderId] = useState<number | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const formRef = useRef<any>(null);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [purchaseOrderList, setPurchaseOrderList] = useState<any[]>([]);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [effectiveRuleCode, setEffectiveRuleCode] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const ordersRes = await listPurchaseOrders({ limit: 500 }).catch(() => ({ data: [], total: 0 }));
        setPurchaseOrderList(ordersRes?.data || []);
      } catch (e) {
        window.console.error('加载采购订单失败', e);
      }
    };
    load();
  }, []);

  const appendReceiptNoticeItemsFromMaterials = useCallback(
    (selected: Material[]) => {
      const current = formRef.current?.getFieldValue('items') ?? [];
      const newRows = selected.map((m) => ({
        material_id: m.id,
        material_code: m.mainCode ?? m.code ?? '',
        material_name: m.name ?? '',
        material_unit: m.baseUnit ?? '件',
        notice_quantity: 1,
        unit_price: 0,
      }));
      formRef.current?.setFieldsValue({ items: [...current, ...newRows] });
      messageApi.success(t('app.kuaizhizao.common.materialBatchAdded', { count: selected.length }));
    },
    [messageApi, t]
  );

  const columns: ProColumns<ReceiptNotice>[] = [
    {
      title: '通知单号',
      dataIndex: 'notice_code',
      width: 148,
      ellipsis: true,
      fixed: 'left',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.notice_code ?? '') }} ellipsis>
          {r.notice_code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: '采购订单号',
      dataIndex: 'purchase_order_code',
      width: 148,
      ellipsis: true,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.purchase_order_code ?? '') }} ellipsis>
          {r.purchase_order_code ?? '-'}
        </Typography.Text>
      ),
    },
    { title: '供应商', dataIndex: 'supplier_name', width: 140, ellipsis: true },
    { title: '入库仓库', dataIndex: 'warehouse_name', width: 120 },
    { title: '计划收货日期', dataIndex: 'planned_receipt_date', valueType: 'date', width: 120 },
    {
      title: '入库转单',
      dataIndex: 'purchase_receipt_code',
      width: 220,
      hideInSearch: true,
      render: (_, r) => {
        if (r.purchase_receipt_id) {
          return (
            <Space size={6}>
              <Tag color="success">已上拉入库</Tag>
              <Typography.Text copyable={{ text: String(r.purchase_receipt_code || r.purchase_receipt_id) }} ellipsis>
                {r.purchase_receipt_code || `#${r.purchase_receipt_id}`}
              </Typography.Text>
            </Space>
          );
        }
        return <Tag color="default">未上拉</Tag>;
      },
    },
    { title: '通知时间', dataIndex: 'notified_at', valueType: 'dateTime', width: 160 },
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
      dataIndex: 'lifecycle',
      width: 132,
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getReceiptNoticeLifecycle(record as unknown as Record<string, unknown>);
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
        if (record.status === '待收货') {
          parts.push(
            <Button
              key="e"
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(record);
              }}
            >
              编辑
            </Button>
          );
          parts.push(
            <Button
              key="n"
              type="link"
              size="small"
              icon={<SendOutlined />}
              style={{ color: '#1890ff' }}
              onClick={(e) => {
                e.stopPropagation();
                handleNotify(record);
              }}
            >
              通知仓库
            </Button>
          );
          parts.push(
            <Button
              key="del"
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(record);
              }}
            >
              删除
            </Button>
          );
        }
        if (record.status === '已通知') {
          parts.push(
            <Button
              key="w"
              type="link"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleWithdraw(record);
              }}
            >
              撤回通知
            </Button>
          );
        }
        if (record.purchase_receipt_id) {
          parts.push(
            <Button
              key="to-pr"
              type="link"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                navigate(ROUTES.WM_INBOUND);
              }}
            >
              查看入库单
            </Button>
          );
        }
        return renderReceiptNoticeRowActions(parts, `rn-${record.id ?? 'row'}`);
      },
    },
  ];

  const handleDetail = async (record: ReceiptNotice) => {
    try {
      const detail = await receiptNoticeApi.get(record.id!.toString());
      setNoticeDetail(detail as ReceiptNoticeDetail);
      setDetailDrawerVisible(true);
      setRnTrackingRefreshKey((k) => k + 1);
    } catch {
      messageApi.error('获取收货通知单详情失败');
    }
  };

  const handleEdit = async (record: ReceiptNotice) => {
    try {
      const detail = await receiptNoticeApi.get(record.id!.toString()) as ReceiptNoticeDetail;
      const itemsForm = (detail.items || []).map((it: any) => ({
        material_id: it.material_id,
        material_code: it.material_code || '',
        material_name: it.material_name || '',
        material_unit: it.material_unit || '件',
        notice_quantity: Number(it.notice_quantity) || 0,
        unit_price: Number(it.unit_price) || 0,
      }));
      formRef.current?.setFieldsValue({
        purchase_order_id: detail.purchase_order_id,
        purchase_order_code: detail.purchase_order_code,
        supplier_id: detail.supplier_id,
        supplier_name: detail.supplier_name,
        supplier_contact: detail.supplier_contact,
        supplier_phone: detail.supplier_phone,
        warehouse_id: detail.warehouse_id,
        warehouse_name: detail.warehouse_name,
        planned_receipt_date: detail.planned_receipt_date ? dayjs(detail.planned_receipt_date) : undefined,
        notes: detail.notes,
        items: itemsForm.length ? itemsForm : [defaultReceiptItem],
      });
      setEditingId(record.id!);
      setEditModalVisible(true);
    } catch {
      messageApi.error('获取详情失败');
    }
  };

  const handleNotify = (record: ReceiptNotice) => {
    Modal.confirm({
      title: '通知仓库',
      content: `确定要通知仓库收货「${record.notice_code}」吗？将同步生成一张「草稿」状态的采购入库单，仓库可在采购入库中核对后确认入库。`,
      onOk: async () => {
        try {
          const res = (await receiptNoticeApi.notify(record.id!.toString())) as ReceiptNotice;
          messageApi.success(
            res?.purchase_receipt_code
              ? `已通知仓库，已生成采购入库草稿：${res.purchase_receipt_code}`
              : '已通知仓库',
          );
          setStatsVersion((v) => v + 1);
          if (noticeDetail?.id === record.id) {
            const fresh = await receiptNoticeApi.get(record.id!.toString());
            setNoticeDetail(fresh as ReceiptNoticeDetail);
          }
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '通知失败');
        }
      },
    });
  };

  const handleWithdraw = (record: ReceiptNotice) => {
    Modal.confirm({
      title: '撤回通知',
      content: `确定将「${record.notice_code}」撤回到待收货吗？将移除关联的采购入库草稿（若尚未确认入库）。`,
      onOk: async () => {
        try {
          await receiptNoticeApi.withdraw(record.id!.toString());
          messageApi.success('已撤回到待收货');
          setStatsVersion((v) => v + 1);
          if (noticeDetail?.id === record.id) {
            const fresh = await receiptNoticeApi.get(record.id!.toString());
            setNoticeDetail(fresh as ReceiptNoticeDetail);
          }
          invalidateMenuBadgeCounts();
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '撤回失败');
        }
      },
    });
  };

  const handleDelete = (record: ReceiptNotice) => {
    Modal.confirm({
      title: '删除收货通知单',
      content: `确定要删除 "${record.notice_code}" 吗？`,
      onOk: async () => {
        try {
          await receiptNoticeApi.delete(record.id!.toString());
          messageApi.success('删除成功');
          if (noticeDetail?.id === record.id) {
            setNoticeDetail(null);
            setDetailDrawerVisible(false);
          }
          setStatsVersion((v) => v + 1);
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '删除失败');
        }
      },
    });
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) return;
    Modal.confirm({
      title: '批量删除',
      content: `确定要删除选中的 ${keys.length} 条收货通知单吗？`,
      onOk: async () => {
        try {
          for (const k of keys) {
            await receiptNoticeApi.delete(String(k));
          }
          messageApi.success(`已删除 ${keys.length} 条收货通知单`);
          setSelectedRowKeys([]);
          setStatsVersion((v) => v + 1);
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error?.message || '批量删除失败');
        }
      },
    });
  };

  const handleCreate = async () => {
    setPreviewCode(null);
    setEffectiveRuleCode(null);
    setEditingId(null);
    setCreateModalVisible(true);
    window.setTimeout(() => {
      formRef.current?.setFieldsValue({ items: [defaultReceiptItem] });
    }, 100);
    let ruleCode = getPageRuleCode('kuaizhizao-receipt-notice');
    let autoGenerate = isAutoGenerateEnabled('kuaizhizao-receipt-notice');
    try {
      const pageConfig = await getCodeRulePageConfig('kuaizhizao-receipt-notice');
      if (pageConfig?.ruleCode) {
        ruleCode = pageConfig.ruleCode;
        autoGenerate = !!pageConfig.autoGenerate;
      }
    } catch {}
    if (autoGenerate && ruleCode) {
      setEffectiveRuleCode(ruleCode);
      testGenerateCode({ rule_code: ruleCode })
        .then((res) => {
          const preview = res.code;
          setPreviewCode(preview ?? null);
          window.setTimeout(() => {
            formRef.current?.setFieldsValue({ notice_code: preview ?? '', items: [defaultReceiptItem] });
          }, 100);
        })
        .catch((e) => {
          window.console.warn('收货通知单编号预生成失败:', e);
          setPreviewCode(null);
        });
    } else {
      setPreviewCode(null);
    }
  };

  const loadPullPurchaseOrderCandidates = useCallback(async (keyword: string = '') => {
    setPullPurchaseOrderLoading(true);
    try {
      const kw = keyword.trim();
      const [poRes, noticeRes] = await Promise.all([
        listPurchaseOrders({ skip: 0, limit: 200, keyword: kw || undefined }),
        receiptNoticeApi.list({ skip: 0, limit: 5000 }),
      ]);
      const orders = poRes?.data || [];
      const notices = Array.isArray(noticeRes) ? noticeRes : (noticeRes as any)?.data ?? (noticeRes as any)?.items ?? [];
      const noticeByOrderId = new Map<number, any>();
      notices.forEach((n: any) => {
        if (n?.purchase_order_id != null && !noticeByOrderId.has(Number(n.purchase_order_id))) {
          noticeByOrderId.set(Number(n.purchase_order_id), n);
        }
      });
      const candidates: PullPurchaseOrderCandidate[] = (orders as any[]).map((o: any) => {
        const linked = noticeByOrderId.get(Number(o.id));
        return {
          id: Number(o.id),
          order_code: o.order_code ?? o.purchase_order_code,
          supplier_id: o.supplier_id,
          supplier_name: o.supplier_name,
          status: o.status,
          order_date: o.order_date,
          updated_at: o.updated_at,
          notice_id: linked?.id,
          converted: !!linked,
        };
      });
      setPullPurchaseOrderCandidates(candidates);
    } finally {
      setPullPurchaseOrderLoading(false);
    }
  }, []);

  const handlePullFromPurchaseOrder = useCallback(async () => {
    setPullFromPurchaseOrderVisible(true);
    setPullPurchaseOrderKeyword('');
    setSelectedPullPurchaseOrderId(null);
    await loadPullPurchaseOrderCandidates('');
  }, [loadPullPurchaseOrderCandidates]);

  const handlePullFromPurchaseOrderConfirm = useCallback(async () => {
    if (!selectedPullPurchaseOrderId) {
      messageApi.warning(`请选择${pullFromPurchaseOrderAction.sourceLabel}`);
      return;
    }
    const selected = pullPurchaseOrderCandidates.find((i) => i.id === selectedPullPurchaseOrderId);
    if (selected?.converted) {
      messageApi.warning(`该${pullFromPurchaseOrderAction.sourceLabel}已创建${pullFromPurchaseOrderAction.targetLabel}，请勿重复创建`);
      return;
    }
    setPullPurchaseOrderSubmitting(true);
    try {
      const detail: any = await getPurchaseOrder(selectedPullPurchaseOrderId);
      const itemRows = Array.isArray(detail?.items) ? detail.items : [];
      const validItems = itemRows
        .filter((it: any) => (Number(it.ordered_quantity ?? it.quantity ?? 0) || 0) > 0)
        .map((it: any) => ({
          material_id: it.material_id ?? it.materialId,
          material_code: it.material_code ?? it.materialCode ?? '',
          material_name: it.material_name ?? it.materialName ?? '',
          material_unit: it.unit ?? it.material_unit ?? it.materialUnit ?? '件',
          notice_quantity: Number(it.ordered_quantity ?? it.quantity ?? 0) || 0,
          unit_price: Number(it.unit_price ?? it.unitPrice ?? 0) || 0,
        }));
      if (validItems.length === 0) {
        throw new Error(`该${pullFromPurchaseOrderAction.sourceLabel}无可通知明细，无法创建${pullFromPurchaseOrderAction.targetLabel}`);
      }
      await receiptNoticeApi.create({
        purchase_order_id: detail.id ?? selectedPullPurchaseOrderId,
        purchase_order_code: detail.order_code ?? selected?.order_code,
        supplier_id: detail.supplier_id ?? selected?.supplier_id,
        supplier_name: detail.supplier_name ?? selected?.supplier_name,
        supplier_contact: detail.supplier_contact,
        supplier_phone: detail.supplier_phone,
        planned_receipt_date: detail.delivery_date,
        items: validItems,
      });
      messageApi.success(`已从${pullFromPurchaseOrderAction.sourceLabel}创建${pullFromPurchaseOrderAction.targetLabel}`);
      setPullFromPurchaseOrderVisible(false);
      setSelectedPullPurchaseOrderId(null);
      setStatsVersion((v) => v + 1);
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.response?.data?.detail || e?.message || `从${pullFromPurchaseOrderAction.sourceLabel}创建${pullFromPurchaseOrderAction.targetLabel}失败`);
    } finally {
      setPullPurchaseOrderSubmitting(false);
    }
  }, [actionRef, invalidateMenuBadgeCounts, messageApi, pullPurchaseOrderCandidates, selectedPullPurchaseOrderId]);

  const onPurchaseOrderSelect = async (orderId: number) => {
    let order = purchaseOrderList.find((o: any) => (o.id ?? o.purchase_order_id) === orderId);
    if (!order) return;
    try {
      const detail = await getPurchaseOrder(orderId);
      order = detail;
    } catch {
      // use list data
    }
    const code = order.order_code || order.purchase_order_code || order.code;
    formRef.current?.setFieldsValue({
      purchase_order_code: code,
      supplier_id: order.supplier_id,
      supplier_name: order.supplier_name,
      supplier_contact: order.supplier_contact,
      supplier_phone: order.supplier_phone,
    });
    if (order.items && order.items.length > 0) {
      const items = order.items.map((it: any) => ({
        material_id: it.material_id ?? it.materialId,
        material_code: it.material_code || it.materialCode || '',
        material_name: it.material_name || it.materialName || '',
        material_unit: it.unit || it.material_unit || it.materialUnit || '件',
        notice_quantity: Number(it.ordered_quantity ?? it.quantity) || 0,
        unit_price: Number(it.unit_price ?? it.unitPrice) || 0,
      }));
      formRef.current?.setFieldsValue({ items });
    }
  };

  const handleCreateSubmit = async (values: any) => {
    const validItems = (values.items ?? []).filter((it: any) => it.material_id && (Number(it.notice_quantity) || 0) > 0);
    if (!validItems.length) {
      messageApi.error('请至少添加一条有效明细');
      throw new Error('请至少添加一条有效明细');
    }
    if (!values.purchase_order_id || !values.purchase_order_code) {
      messageApi.error('请选择采购订单');
      throw new Error('请选择采购订单');
    }
    const supplier = purchaseOrderList.find((o: any) => (o.id ?? o.purchase_order_id) === values.purchase_order_id) || {};
    let noticeCode = values.notice_code;
    const ruleCodeToUse = effectiveRuleCode || getPageRuleCode('kuaizhizao-receipt-notice');
    if (
      ruleCodeToUse &&
      (isAutoGenerateEnabled('kuaizhizao-receipt-notice') || effectiveRuleCode) &&
      (noticeCode === previewCode || !noticeCode)
    ) {
      try {
        const res = await generateCode({ rule_code: ruleCodeToUse });
        noticeCode = res.code;
      } catch (e) {
        window.console.warn('收货通知单编号正式生成失败，使用当前值:', e);
      }
    }
    try {
      await receiptNoticeApi.create({
        notice_code: noticeCode || undefined,
        purchase_order_id: values.purchase_order_id,
        purchase_order_code: values.purchase_order_code,
        supplier_id: values.supplier_id ?? supplier.supplier_id,
        supplier_name: values.supplier_name ?? supplier.supplier_name,
        supplier_contact: values.supplier_contact,
        supplier_phone: values.supplier_phone,
        warehouse_id: values.warehouse_id,
        warehouse_name: values.warehouse_name,
        planned_receipt_date: values.planned_receipt_date ? dayjs(values.planned_receipt_date).format('YYYY-MM-DD') : undefined,
        notes: values.notes,
        items: validItems.map((it: any) => ({
          material_id: it.material_id,
          material_code: it.material_code,
          material_name: it.material_name,
          material_unit: it.material_unit || '件',
          notice_quantity: Number(it.notice_quantity) || 0,
          unit_price: it.unit_price || 0,
        })),
      });
      messageApi.success('创建成功');
      setCreateModalVisible(false);
      setEffectiveRuleCode(null);
      setStatsVersion((v) => v + 1);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '创建失败');
      throw error;
    }
  };

  const handleEditSubmit = async (values: any) => {
    if (!editingId) return;
    try {
      await receiptNoticeApi.update(editingId.toString(), {
        supplier_contact: values.supplier_contact,
        supplier_phone: values.supplier_phone,
        warehouse_id: values.warehouse_id,
        warehouse_name: values.warehouse_name,
        planned_receipt_date: values.planned_receipt_date ? dayjs(values.planned_receipt_date).format('YYYY-MM-DD') : undefined,
        notes: values.notes,
      });
      messageApi.success('更新成功');
      setEditModalVisible(false);
      if (noticeDetail?.id === editingId) {
        const fresh = await receiptNoticeApi.get(editingId.toString());
        setNoticeDetail(fresh as ReceiptNoticeDetail);
      }
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '更新失败');
      throw error;
    }
  };

  const detailColumns: ProDescriptionsItemProps<ReceiptNoticeDetail>[] = [
    {
      title: '通知单号',
      dataIndex: 'notice_code',
      render: (_, entity) => (
        <Typography.Text copyable={{ text: String(entity.notice_code ?? '') }}>{entity.notice_code ?? '-'}</Typography.Text>
      ),
    },
    {
      title: '采购订单号',
      dataIndex: 'purchase_order_code',
      render: (_, entity) => (
        <Typography.Text copyable={{ text: String(entity.purchase_order_code ?? '') }}>{entity.purchase_order_code ?? '-'}</Typography.Text>
      ),
    },
    { title: '供应商', dataIndex: 'supplier_name' },
    { title: '联系人', dataIndex: 'supplier_contact' },
    { title: '电话', dataIndex: 'supplier_phone' },
    { title: '入库仓库', dataIndex: 'warehouse_name' },
    { title: '计划收货日期', dataIndex: 'planned_receipt_date', valueType: 'date' },
    {
      title: '状态',
      dataIndex: 'status',
      render: (s) => {
        const c = STATUS_MAP[(s as string) || ''] || { text: (s as string) || '-', color: 'default' };
        return <Tag color={c.color}>{c.text}</Tag>;
      },
    },
    { title: '通知时间', dataIndex: 'notified_at', valueType: 'dateTime' },
    {
      title: '关联入库单',
      dataIndex: 'purchase_receipt_code',
      render: (v) => v || '-',
    },
    { title: '备注', dataIndex: 'notes', span: 3, render: (t) => t || '-' },
  ];

  const renderCreateForm = () => (
    <>
      <Row gutter={16}>
        <Col span={12}>
          <ProFormText
            name="notice_code"
            label="通知单号"
            placeholder={isAutoGenerateEnabled('kuaizhizao-receipt-notice') ? '编号将根据编号规则自动生成，可修改' : '请输入通知单号'}
            rules={[{ required: true, message: '请输入通知单号' }]}
          />
        </Col>
        <Col span={12}>
          <ProForm.Item name="purchase_order_id" label="采购订单" rules={[{ required: true, message: '请选择采购订单' }]}>
            <Select
              placeholder="请选择采购订单"
              showSearch
              optionFilterProp="label"
              options={purchaseOrderList.map((o: any) => ({
                value: o.id ?? o.purchase_order_id,
                label: `${o.order_code || o.purchase_order_code || o.code || ''} - ${o.supplier_name || ''}`,
              }))}
              onChange={onPurchaseOrderSelect}
            />
          </ProForm.Item>
        </Col>
      </Row>
      <ProFormText name="purchase_order_code" hidden />
      <ProFormText name="supplier_id" hidden />
      <Row gutter={16}>
        <Col span={12}>
          <ProFormText name="supplier_name" label="供应商" placeholder="供应商名称" rules={[{ required: true, message: '请输入供应商' }]} />
        </Col>
        <Col span={12}>
          <ProFormText name="supplier_contact" label="联系人" placeholder="联系人" />
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <ProFormText name="supplier_phone" label="电话" placeholder="电话" />
        </Col>
        <Col span={12}>
          <UniWarehouseSelect
            name="warehouse_id"
            label="入库仓库"
            placeholder="请选择入库仓库"
            onChange={(val, wh) => formRef.current?.setFieldsValue({ warehouse_name: wh?.name ?? '' })}
          />
        </Col>
      </Row>
      <ProFormText name="warehouse_name" hidden />
      <Row gutter={16}>
        <Col span={12}>
          <ProFormDatePicker name="planned_receipt_date" label="计划收货日期" fieldProps={{ style: { width: '100%' } }} />
        </Col>
        <Col span={12} />
      </Row>
      <div className="uni-table-detail" style={{ width: '100%' }}>
        <UniTableDetailHeader title="通知明细" required />
        <ProForm.Item name="items" noStyle rules={[{ type: 'array', min: 1, message: '请至少添加一条通知明细' }]}>
          <AntForm.List name="items">
            {(fields, { add, remove }) => {
              const cols = [
                {
                  title: '物料',
                  dataIndex: 'material_id',
                  width: 220,
                  render: (_: any, __: any, index: number) => (
                    <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items?.[index] !== curr?.items?.[index]}>
                      {({ getFieldValue }: any) => {
                        const row = getFieldValue('items')?.[index];
                        const mid = row?.material_id ? Number(row.material_id) : null;
                        const fallback = mid && (row?.material_code || row?.material_name)
                          ? { value: mid, label: `${row.material_code || ''} - ${row.material_name || ''}`.trim() || String(mid) }
                          : undefined;
                        return (
                          <UniMaterialSelect
                            name={[index, 'material_id']}
                            label=""
                            placeholder="请选择物料"
                            required
                            size="small"
                            listFieldKey={index}
                            listFieldName="items"
                            fillMapping={{
                              material_code: 'mainCode',
                              material_name: 'name',
                              material_unit: 'baseUnit',
                            }}
                            fallbackOption={fallback}
                            formItemProps={{ style: { margin: 0 } }}
                            showQuickCreate
                            showAdvancedSearch
                          />
                        );
                      }}
                    </AntForm.Item>
                  ),
                },
                {
                  title: '单位',
                  dataIndex: 'material_unit',
                  width: 80,
                  render: (_: any, __: any, index: number) => (
                    <AntForm.Item name={[index, 'material_unit']} style={{ margin: 0 }}>
                      <Input placeholder="单位" size="small" />
                    </AntForm.Item>
                  ),
                },
                {
                  title: '数量',
                  dataIndex: 'notice_quantity',
                  width: 100,
                  align: 'right' as const,
                  render: (_: any, __: any, index: number) => (
                    <AntForm.Item name={[index, 'notice_quantity']} rules={[{ required: true, message: '必填' }, { type: 'number', min: 0.01, message: '>0' }]} style={{ margin: 0 }}>
                      <InputNumber placeholder="数量" min={0} precision={2} style={{ width: '100%' }} size="small" />
                    </AntForm.Item>
                  ),
                },
                {
                  title: '单价',
                  dataIndex: 'unit_price',
                  width: 100,
                  align: 'right' as const,
                  render: (_: any, __: any, index: number) => (
                    <AntForm.Item name={[index, 'unit_price']} style={{ margin: 0 }}>
                      <InputNumber placeholder="0" min={0} precision={2} style={{ width: '100%' }} size="small" />
                    </AntForm.Item>
                  ),
                },
                {
                  title: '操作',
                  width: 60,
                  render: (_: any, __: any, index: number) => (
                    <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(index)} disabled={fields.length <= 1} />
                  ),
                },
              ];
              return (
                <div style={{ width: '100%', overflowX: 'auto' }}>
                  <Table
                    size="small"
                    dataSource={fields.map((f, i) => ({ ...f, key: f.key ?? i }))}
                    rowKey="key"
                    pagination={false}
                    columns={cols}
                    footer={() => (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%' }}>
                        <Button type="dashed" icon={<PlusOutlined />} style={{ flex: 1, minWidth: 120 }} onClick={() => add(defaultReceiptItem)}>
                          添加明细
                        </Button>
                        <Button
                          type="default"
                          icon={<ShoppingOutlined />}
                          style={{ flex: 1, minWidth: 120 }}
                          onClick={() => setMaterialPickerOpen(true)}
                        >
                          {t('app.kuaizhizao.common.materialBatchSelect')}
                        </Button>
                      </div>
                    )}
                  />
                </div>
              );
            }}
          </AntForm.List>
        </ProForm.Item>
      </div>
      <ProFormTextArea name="notes" label="备注" placeholder="备注" fieldProps={{ rows: 2 }} colProps={{ span: 24 }} />
    </>
  );

  const renderEditForm = () => (
    <>
      <Row gutter={16}>
        <Col span={12}>
          <ProFormText name="purchase_order_code" label="采购订单号" disabled />
        </Col>
        <Col span={12} />
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <ProFormText name="supplier_name" label="供应商" disabled />
        </Col>
        <Col span={12}>
          <ProFormText name="supplier_contact" label="联系人" placeholder="联系人" />
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <ProFormText name="supplier_phone" label="电话" placeholder="电话" />
        </Col>
        <Col span={12}>
          <UniWarehouseSelect
            name="warehouse_id"
            label="入库仓库"
            placeholder="请选择入库仓库"
            onChange={(val, wh) => formRef.current?.setFieldsValue({ warehouse_name: wh?.name ?? '' })}
          />
        </Col>
      </Row>
      <ProFormText name="warehouse_name" hidden />
      <Row gutter={16}>
        <Col span={12}>
          <ProFormDatePicker name="planned_receipt_date" label="计划收货日期" fieldProps={{ style: { width: '100%' } }} />
        </Col>
        <Col span={12} />
      </Row>
      <div className="uni-table-detail" style={{ width: '100%' }}>
        <UniTableDetailHeader title="通知明细" />
        <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items !== curr?.items}>
          {({ getFieldValue }: any) => {
            const items = getFieldValue('items') ?? [];
            return (
              <Table
                size="small"
                dataSource={items.map((it: any, i: number) => ({ ...it, key: i }))}
                rowKey="key"
                pagination={false}
                columns={[
                  { title: '物料编号', dataIndex: 'material_code', width: 120 },
                  { title: '物料名称', dataIndex: 'material_name', width: 150 },
                  { title: '单位', dataIndex: 'material_unit', width: 60 },
                  { title: '数量', dataIndex: 'notice_quantity', width: 90, align: 'right' },
                  { title: '单价', dataIndex: 'unit_price', width: 90, align: 'right' },
                ]}
              />
            );
          }}
        </AntForm.Item>
      </div>
      <ProFormTextArea name="notes" label="备注" placeholder="备注" fieldProps={{ rows: 2 }} colProps={{ span: 24 }} />
    </>
  );

  const statCards: StatCard[] = [
          {
            title: '单据总数',
            value: localStats.total,
            valueStyle: { color: token.colorPrimary },
            backgroundChart: <SimpleSparkline data={RN_STAT_SPARK_1} color={token.colorPrimary} />,
          },
          {
            title: '待收货',
            value: localStats.pending,
            valueStyle: { color: token.colorWarning },
            backgroundChart: <SimpleSparkline data={RN_STAT_SPARK_2} color={token.colorWarning} />,
          },
          {
            title: '已通知',
            value: localStats.notified,
            valueStyle: { color: token.colorInfo },
            backgroundChart: <SimpleSparkline data={RN_STAT_SPARK_3} color={token.colorInfo} />,
          },
          {
            title: '已入库',
            value: localStats.received,
            valueStyle: { color: token.colorSuccess },
            backgroundChart: <SimpleSparkline data={RN_STAT_SPARK_4} color={token.colorSuccess} />,
          },
        ];

  return (
    <>
      <ListPageTemplate statCards={statCards}>
        <UniTable
          headerTitle="收货通知单"
          columnPersistenceId="apps.kuaizhizao.pages.purchase-management.receipt-notices"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          showCreateButton={false}
          createButtonText="新建收货通知单"
          onCreate={handleCreate}
          toolBarRender={() => [
            <UniPullCreateToolbar
              compactKey="create-receipt-notice-with-pull"
              createIcon={<PlusOutlined />}
              createLabel="新建收货通知单"
              onCreate={handleCreate}
              menuItems={buildKuaizhizaoPullCreateMenuItems([
                {
                  key: 'pull-from-purchase-order',
                  actionKey: 'receipt_notice.pull_from_purchase_order',
                  onClick: () => {
                    void handlePullFromPurchaseOrder();
                  },
                },
              ])}
            />,
          ]}
          enableRowSelection
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton
          onDelete={handleBatchDelete}
          request={async (params) => {
            try {
              const response = await receiptNoticeApi.list({
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                status: params.status,
                supplier_id: params.supplier_id,
                purchase_order_id: params.purchase_order_id,
                keyword: params.keyword,
              });
              const data = Array.isArray(response) ? response : response?.items || response?.data || [];
              const total = Array.isArray(response) ? response.length : response?.total ?? data.length;
              return { data, success: true, total };
            } catch {
              messageApi.error('获取列表失败');
              return { data: [], success: false, total: 0 };
            }
          }}
          scroll={{ x: 1400 }}
          onRow={(record) => ({
            onClick: () => handleDetail(record),
            style: { cursor: 'pointer' },
          })}
        />
      </ListPageTemplate>

      <Modal
        title={pullFromPurchaseOrderAction.label}
        open={pullFromPurchaseOrderVisible}
        width={1200}
        onCancel={() => {
          if (pullPurchaseOrderSubmitting) return;
          setPullFromPurchaseOrderVisible(false);
          setSelectedPullPurchaseOrderId(null);
        }}
        onOk={() => {
          void handlePullFromPurchaseOrderConfirm();
        }}
        okText={`创建${pullFromPurchaseOrderAction.targetLabel}`}
        confirmLoading={pullPurchaseOrderSubmitting}
        destroyOnClose
      >
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Input.Search
            allowClear
            placeholder="按采购订单号/供应商搜索"
            value={pullPurchaseOrderKeyword}
            onChange={(e) => setPullPurchaseOrderKeyword(e.target.value)}
            onSearch={(value) => {
              setPullPurchaseOrderKeyword(value);
              void loadPullPurchaseOrderCandidates(value);
            }}
            enterButton="搜索"
          />
          <Table<PullPurchaseOrderCandidate>
            rowKey="id"
            loading={pullPurchaseOrderLoading}
            dataSource={pullPurchaseOrderCandidates}
            pagination={false}
            scroll={{ x: 1080, y: 360 }}
            rowSelection={{
              type: 'radio',
              selectedRowKeys: selectedPullPurchaseOrderId ? [selectedPullPurchaseOrderId] : [],
              onChange: (keys) => {
                const next = Number(keys?.[0]);
                if (Number.isFinite(next)) setSelectedPullPurchaseOrderId(next);
                else setSelectedPullPurchaseOrderId(null);
              },
              getCheckboxProps: (record) => ({ disabled: !!record.converted }),
            }}
            onRow={(record) => ({
              onClick: () => {
                if (record.converted) return;
                setSelectedPullPurchaseOrderId(record.id);
              },
            })}
            columns={[
              { title: '采购订单号', dataIndex: 'order_code', width: 190, ellipsis: true },
              { title: '供应商', dataIndex: 'supplier_name', width: 220, ellipsis: true },
              { title: '订单状态', dataIndex: 'status', width: 120, align: 'center' },
              { title: '订单日期', dataIndex: 'order_date', width: 130, render: (v) => (v ? dayjs(v).format('YYYY-MM-DD') : '-') },
              { title: '更新时间', dataIndex: 'updated_at', width: 180, render: (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-') },
              {
                title: '转单状态',
                key: 'convert_status',
                width: 150,
                align: 'center',
                render: (_, r) => (r.converted ? <Tag color="gold">{`已创建${pullFromPurchaseOrderAction.targetLabel}`}</Tag> : <Tag color="success">可创建</Tag>),
              },
            ]}
          />
        </Space>
      </Modal>

      <DetailDrawerTemplate
        title={`收货通知单详情${noticeDetail?.notice_code ? ` - ${noticeDetail.notice_code}` : ''}`}
        open={detailDrawerVisible}
        zIndex={receiptNoticeDetailDrawerZIndex}
        onClose={() => {
          setDetailDrawerVisible(false);
          setNoticeDetail(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        column={3}
        dataSource={noticeDetail || undefined}
        extra={
          noticeDetail && (
            <DetailDrawerActions
              items={[
                {
                  key: 'edit',
                  visible: noticeDetail.status === '待收货',
                  render: () => (
                    <Button
                      type="link"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => {
                        setDetailDrawerVisible(false);
                        handleEdit(noticeDetail);
                      }}
                    >
                      编辑
                    </Button>
                  ),
                },
                {
                  key: 'notify',
                  visible: noticeDetail.status === '待收货',
                  render: () => (
                    <Button
                      type="link"
                      size="small"
                      icon={<SendOutlined />}
                      style={{ color: '#1890ff' }}
                      onClick={() => handleNotify(noticeDetail)}
                    >
                      通知仓库
                    </Button>
                  ),
                },
                {
                  key: 'withdraw',
                  visible: noticeDetail.status === '已通知',
                  render: () => (
                    <Button type="link" size="small" onClick={() => handleWithdraw(noticeDetail)}>
                      撤回通知
                    </Button>
                  ),
                },
                {
                  key: 'delete',
                  visible: noticeDetail.status === '待收货',
                  render: () => (
                    <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(noticeDetail)}>
                      删除
                    </Button>
                  ),
                },
              ]}
            />
          )
        }
        customContent={
          noticeDetail && (
            <>
              <DetailDrawerSection title="基本信息">
                <Descriptions
                  column={3}
                  size="small"
                  items={buildDescriptionItemsFromColumns(noticeDetail, detailColumns)}
                />
              </DetailDrawerSection>

              <DetailDrawerSection title="生命周期">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    const lifecycle = getReceiptNoticeLifecycle(noticeDetail as unknown as Record<string, unknown>);
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
                  {noticeDetail.id != null ? (
                    <DetailDrawerInlineFullChain
                      documentType='receipt_notice'
                      documentId={noticeDetail.id}
                      active={detailDrawerVisible}
                      selfDocumentId={noticeDetail.id}
                      renderBriefActions={(doc) => (
                  <WarehouseTraceBriefPrimaryActions
                    doc={doc}
                    t={t}
                    navigate={navigate}
                    closeDrawer={() => {
                      setDetailDrawerVisible(false);
                      setNoticeDetail(null);
                    }}
                  />
                )}
                    />
                  ) : null}
                </div>
              </DetailDrawerSection>

              <DetailDrawerSection title="明细信息">
                <style>{`
                  .receipt-notice-detail-items .ant-table-wrapper .ant-table-body,
                  .receipt-notice-detail-items .ant-table-wrapper .ant-table-content {
                    overflow: visible !important;
                  }
                `}</style>
                {noticeDetail.items && noticeDetail.items.length > 0 ? (
                  <div
                    className="receipt-notice-detail-items"
                    style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', overflowY: 'hidden' }}
                  >
                      <Table
                        size="small"
                        tableLayout="fixed"
                        style={{ minWidth: RN_DETAIL_ITEMS_MIN_WIDTH }}
                        rowKey={(record: any, idx?: number) => record?.id ?? idx}
                      columns={[
                        { title: '物料编号', dataIndex: 'material_code', width: 120, ellipsis: true },
                        { title: '物料名称', dataIndex: 'material_name', width: 150, ellipsis: true },
                        { title: '单位', dataIndex: 'material_unit', width: 60 },
                        { title: '数量', dataIndex: 'notice_quantity', width: 90, align: 'right' },
                        { title: '单价', dataIndex: 'unit_price', width: 90, align: 'right' },
                        { title: '金额', dataIndex: 'total_amount', width: 100, align: 'right' },
                      ]}
                      dataSource={noticeDetail.items}
                      pagination={false}
                      bordered
                    />
                  </div>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无明细" />
                )}
              </DetailDrawerSection>

              <DetailDrawerSection title="操作记录">
                {receiptNoticeTracking.loading && (
                  <div style={{ textAlign: 'center', padding: 24 }}>
                    <Spin />
                  </div>
                )}
                {receiptNoticeTracking.error && !receiptNoticeTracking.loading && (
                  <Typography.Text type="danger">{receiptNoticeTracking.error}</Typography.Text>
                )}
                {receiptNoticeTracking.data && !receiptNoticeTracking.loading && (
                  <DocumentTrackingTimelineBody data={receiptNoticeTracking.data} />
                )}
                {!receiptNoticeTracking.loading && !receiptNoticeTracking.data && !receiptNoticeTracking.error && (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无操作记录" />
                )}
              </DetailDrawerSection>
            </>
          )
        }
      />

      <FormModalTemplate
        title="新建收货通知单"
        open={createModalVisible}
        onClose={() => { setCreateModalVisible(false); setEffectiveRuleCode(null); }}
        formRef={formRef}
        onFinish={handleCreateSubmit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        grid={false}
        initialValues={{ items: [defaultReceiptItem] }}
      >
        {renderCreateForm()}
      </FormModalTemplate>

      <FormModalTemplate
        title="编辑收货通知单"
        open={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        formRef={formRef}
        onFinish={handleEditSubmit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        grid={false}
      >
        {renderEditForm()}
      </FormModalTemplate>

      <UniMaterialBatchPicker
        open={materialPickerOpen}
        onCancel={() => setMaterialPickerOpen(false)}
        onConfirm={appendReceiptNoticeItemsFromMaterials}
      />
    </>
  );
};

export default ReceiptNoticesPage;
