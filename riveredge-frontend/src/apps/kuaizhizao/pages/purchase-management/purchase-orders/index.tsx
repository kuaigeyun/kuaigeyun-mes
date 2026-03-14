/**
 * 采购订单管理页面
 *
 * 提供采购订单的创建、编辑、查看和审批功能
 *
 * @author RiverEdge Team
 * @date 2025-12-30
 */

import React, { useRef, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProForm, ProFormText, ProFormDatePicker, ProFormDigit, ProFormTextArea, ProFormUploadButton, ProFormItem } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Card, Row, Col, Table, Empty, Timeline, Divider, Form as AntForm, Input, InputNumber, DatePicker, Switch, List, Typography, theme, Dropdown } from 'antd';
import { useTranslation } from 'react-i18next';
import { PlusOutlined, EyeOutlined, EditOutlined, CheckCircleOutlined, DeleteOutlined, ClockCircleOutlined, CheckCircleTwoTone, CloseCircleTwoTone, SendOutlined, DownOutlined, FileTextOutlined, InboxOutlined, DollarOutlined } from '@ant-design/icons';
import { apiRequest } from '../../../../../services/api';
import { getDataDictionaryByCode, getDictionaryItemList } from '../../../../../services/dataDictionary';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';
import { getFileDownloadUrl, uploadMultipleFiles } from '../../../../../services/file';
import { UniTable } from '../../../../../components/uni-table';
import SyncFromDatasetModal from '../../../../../components/sync-from-dataset-modal';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, DetailDrawerSection, DetailDrawerActions, MODAL_CONFIG, DRAWER_CONFIG, type StatCard } from '../../../../../components/layout-templates';
import { SimpleSparkline } from '../../../../../components';
import CodeField from '../../../../../components/code-field';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import dayjs from 'dayjs';
import { listPurchaseOrders, getPurchaseOrder, createPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder, approvePurchaseOrder, submitPurchaseOrder, pushPurchaseOrderToReceipt, pushPurchaseOrderToReceiptNotice, pushPurchaseOrderToInvoice, getPurchaseOrderStatistics, PurchaseOrder, PurchaseOrderItem } from '../../../services/purchase';
import { getApprovalStatus, ApprovalStatusResponse } from '../../../../../services/approvalInstance';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import DocumentTrackingPanel from '../../../../../components/document-tracking-panel';
import {
  getStatusDisplay,
  getReviewStatusDisplay,
  isDraftStatus,
  isAuditedStatus,
} from '../../../constants/documentStatus';
import { getPurchaseOrderLifecycle } from '../../../utils/purchaseOrderLifecycle';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { SupplierFormModal } from '../../../../master-data/components/SupplierFormModal';
import { batchImport } from '../../../../../utils/batchOperations';
import { usePageMetrics } from '../../../../../hooks/usePageMetrics';

// 使用从服务文件导入的接口
type PurchaseOrderDetail = PurchaseOrder;
// PurchaseOrderItem 已在导入中定义

const defaultOrderItem = {
  material_id: undefined,
  material_code: '',
  material_name: '',
  material_spec: '',
  unit: '件',
  ordered_quantity: 1,
  unit_price: 0,
  tax_rate: 0,
  required_date: undefined,
};

/** 安全提取金额数值（兼容 number、string、{ value } 对象） */
function formatAmount(val: unknown): string {
  const num =
    typeof val === 'number' && !isNaN(val)
      ? val
      : val && typeof val === 'object' && 'value' in val && typeof (val as { value?: unknown }).value === 'number'
        ? (val as { value: number }).value
        : parseFloat(String(val ?? 0));
  return (isNaN(num) ? 0 : num).toLocaleString();
}

const PurchaseOrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const location = useLocation();
  const { message: messageApi } = App.useApp();
  const queryClient = useQueryClient();
  const actionRef = useRef<ActionType>(null);
  const tableSearchFormRef = useRef<any>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const { statCards: pageMetricCards, hasConfig: hasPageMetricConfig } = usePageMetrics();
  const invalidateStatistics = () => {
    queryClient.invalidateQueries({ queryKey: ['purchaseOrderStatistics'] });
    queryClient.invalidateQueries({ queryKey: ['pageMetrics', location.pathname] });
  };

  useEffect(() => {
    const loadSuppliers = async () => {
      setSuppliersLoading(true);
      try {
        const res = await apiRequest<unknown>('/apps/master-data/supply-chain/suppliers', { params: { limit: 1000, is_active: true } });
        const list = Array.isArray(res) ? res : (res as any)?.data ?? (res as any)?.items ?? [];
        setSupplierList(Array.isArray(list) ? list : []);
      } catch {
        setSupplierList([]);
      } finally {
        setSuppliersLoading(false);
      }
    };
    loadSuppliers();
  }, []);

  useEffect(() => {
    const loadOrderType = async () => {
      setOrderTypeLoading(true);
      try {
        const dict = await getDataDictionaryByCode('ORDER_TYPE');
        const items = await getDictionaryItemList(dict.uuid, true);
        setOrderTypeOptions(items.sort((a, b) => a.sort_order - b.sort_order).map((it) => ({ label: it.label, value: it.value })));
      } catch {
        setOrderTypeOptions([{ label: '标准采购', value: '标准采购' }, { label: '紧急采购', value: '紧急采购' }, { label: '框架协议', value: '框架协议' }]);
      } finally {
        setOrderTypeLoading(false);
      }
    };
    const loadCurrency = async () => {
      setCurrencyLoading(true);
      try {
        const dict = await getDataDictionaryByCode('CURRENCY');
        const items = await getDictionaryItemList(dict.uuid, true);
        setCurrencyOptions(items.sort((a, b) => a.sort_order - b.sort_order).map((it) => ({ label: it.label, value: it.value })));
      } catch {
        setCurrencyOptions([{ label: '人民币(CNY)', value: 'CNY' }, { label: '美元(USD)', value: 'USD' }, { label: '欧元(EUR)', value: 'EUR' }]);
      } finally {
        setCurrencyLoading(false);
      }
    };
    loadOrderType();
    loadCurrency();
  }, []);

  const { data: statistics } = useQuery({
    queryKey: ['purchaseOrderStatistics'],
    queryFn: getPurchaseOrderStatistics,
    enabled: !hasPageMetricConfig,
  });

  // Modal 相关状态
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<PurchaseOrder | null>(null);
  const formRef = useRef<any>(null);
  /** 标记是否在保存后自动提交（草稿转正式） */
  const submitAfterSaveRef = useRef(false);

  // Drawer 相关状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [orderDetail, setOrderDetail] = useState<PurchaseOrderDetail | null>(null);

  // 供应商列表、订单类型、币种
  const [supplierList, setSupplierList] = useState<any[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [orderTypeOptions, setOrderTypeOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [orderTypeLoading, setOrderTypeLoading] = useState(false);
  const [currencyOptions, setCurrencyOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [currencyLoading, setCurrencyLoading] = useState(false);

  // 审批流程相关状态
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatusResponse | null>(null);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [supplierCreateVisible, setSupplierCreateVisible] = useState(false);

  // 下推入库 Modal
  const [pushToReceiptVisible, setPushToReceiptVisible] = useState(false);
  const [pushToReceiptOrder, setPushToReceiptOrder] = useState<PurchaseOrderDetail | null>(null);
  const [pushToReceiptQuantities, setPushToReceiptQuantities] = useState<Record<number, number>>({});
  const [pushToReceiptLoading, setPushToReceiptLoading] = useState(false);

  // 下推收货通知 Modal
  const [pushToNoticeVisible, setPushToNoticeVisible] = useState(false);
  const [pushToNoticeOrder, setPushToNoticeOrder] = useState<PurchaseOrderDetail | null>(null);
  const [pushToNoticeQuantities, setPushToNoticeQuantities] = useState<Record<number, number>>({});
  const [pushToNoticeLoading, setPushToNoticeLoading] = useState(false);

  // 下推采购发票 loading
  const [pushToInvoiceLoading, setPushToInvoiceLoading] = useState(false);

  // 表格列定义
  const columns: ProColumns<PurchaseOrder>[] = [
    {
      title: '订单编号',
      dataIndex: 'order_code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '供应商',
      dataIndex: 'supplier_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '订单日期',
      dataIndex: 'order_date',
      valueType: 'date',
      width: 120,
    },
    {
      title: '交货日期',
      dataIndex: 'delivery_date',
      valueType: 'date',
      width: 120,
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle',
      width: 100,
      valueType: 'select',
      valueEnum: {
        草稿: { text: '草稿' },
        待审核: { text: '待审核' },
        已审核: { text: '已审核' },
        已下推入库: { text: '已下推入库' },
        已完成: { text: '已完成' },
        已驳回: { text: '已驳回' },
        已取消: { text: '已取消' },
      },
      render: (_: unknown, record: PurchaseOrder) => {
        const lifecycle = getPurchaseOrderLifecycle(record);
        const stageName = lifecycle.stageName ?? record.status ?? '草稿';
        const colorMap: Record<string, string> = {
          草稿: 'default',
          待审核: 'warning',
          已审核: 'green',
          已下推入库: 'blue',
          已完成: 'gold',
          已驳回: 'error',
          已取消: 'default',
        };
        return <Tag color={colorMap[stageName] ?? 'default'}>{stageName}</Tag>;
      },
    },
    {
      title: '订单金额',
      dataIndex: 'total_amount',
      width: 120,
      align: 'right',
      render: (text) => `¥${formatAmount(text)}`,
    },
    {
      title: '总数量',
      dataIndex: 'total_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '明细数量',
      dataIndex: 'items_count',
      width: 100,
      align: 'center',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '操作',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>
            详情
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <UniWorkflowActions
            record={record}
            entityName="采购订单"
            statusField="status"
            reviewStatusField="review_status"
            draftStatuses={['草稿', 'draft']}
            pendingStatuses={['待审核', 'pending_review']}
            approvedStatuses={['已审核', 'audited', '审核通过']}
            rejectedStatuses={['已驳回', 'rejected']}
            theme="link"
            size="small"
            actions={{
              submit: (id) => submitPurchaseOrder(id),
              approve: (id) => approvePurchaseOrder(id, { approved: true, review_remarks: '' }),
              reject: (id, reason) => approvePurchaseOrder(id, { approved: false, review_remarks: reason || '' }),
            }}
            onSuccess={() => { invalidateStatistics(); actionRef.current?.reload(); }}
          />
          {isAuditedStatus(record.status) && (
            <Dropdown
              menu={{
                items: [
                  { key: 'receipt-notice', label: '收货通知', icon: <FileTextOutlined />, onClick: () => handlePushToNotice(record) },
                  { key: 'receipt', label: '采购入库', icon: <InboxOutlined />, onClick: () => handlePushToReceipt(record) },
                  { key: 'invoice', label: '采购发票', icon: <DollarOutlined />, onClick: () => handlePushToInvoice(record) },
                ],
              }}
            >
              <Button type="link" size="small" icon={<CheckCircleOutlined />} style={{ color: '#722ed1' }}>
                下推 <DownOutlined />
              </Button>
            </Dropdown>
          )}
          {isDraftStatus(record.status) && (
            <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>
              删除
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // 处理详情查看
  const handleDetail = async (record: PurchaseOrder) => {
    try {
      const detail = await getPurchaseOrder(record.id!);
      setOrderDetail(detail as PurchaseOrderDetail);

      // 获取审批流程状态和记录（采购审批流程增强）
      await loadApprovalData(record.id!);

      setDetailDrawerVisible(true);
    } catch (error) {
      messageApi.error('获取采购订单详情失败');
    }
  };

  // 加载审批流程数据
  const loadApprovalData = async (orderId: number) => {
    setApprovalLoading(true);
    try {
      const status = await getApprovalStatus('purchase_order', orderId);
      setApprovalStatus(status);
    } catch (error) {
      console.error('获取审批流程数据失败:', error);
      setApprovalStatus(null);
    } finally {
      setApprovalLoading(false);
    }
  };

  // 打开下推入库 Modal（加载订单明细，初始化可编辑数量）
  const handlePushToReceipt = async (record: PurchaseOrder) => {
    try {
      const detail = await getPurchaseOrder(record.id!);
      const items = (detail.items || []).filter(
        (it: PurchaseOrderItem) => (it.outstanding_quantity ?? 0) > 0
      );
      if (items.length === 0) {
        messageApi.warning('采购单已全部入库，无可下推明细');
        return;
      }
      const quantities: Record<number, number> = {};
      items.forEach((it: PurchaseOrderItem) => {
        if (it.id != null) {
          quantities[it.id] = Number(it.outstanding_quantity ?? 0);
        }
      });
      setPushToReceiptOrder(detail as PurchaseOrderDetail);
      setPushToReceiptQuantities(quantities);
      setPushToReceiptVisible(true);
    } catch {
      messageApi.error('加载采购订单详情失败');
    }
  };

  // 确认下推入库
  const handlePushToReceiptConfirm = async () => {
    if (!pushToReceiptOrder?.id) return;
    const items = (pushToReceiptOrder.items || []).filter(
      (it: PurchaseOrderItem) => (it.outstanding_quantity ?? 0) > 0
    );
    for (const it of items) {
      if (it.id == null) continue;
      const qty = pushToReceiptQuantities[it.id] ?? 0;
      const max = Number(it.outstanding_quantity ?? 0);
      if (qty <= 0) continue;
      if (qty > max) {
        messageApi.error(`物料 ${it.material_code || it.material_name} 的入库数量不能超过未入库数量 ${max}`);
        return;
      }
    }
    setPushToReceiptLoading(true);
    try {
      const result = await pushPurchaseOrderToReceipt(pushToReceiptOrder.id, pushToReceiptQuantities);
      messageApi.success(`成功生成采购入库单：${result.receipt_code || '已创建'}`);
      setPushToReceiptVisible(false);
      setPushToReceiptOrder(null);
      setPushToReceiptQuantities({});
      invalidateStatistics();
      actionRef.current?.reload();
      if (detailDrawerVisible && orderDetail?.id === pushToReceiptOrder.id) {
        getPurchaseOrder(pushToReceiptOrder.id).then(setOrderDetail);
      }
    } catch (error: any) {
      messageApi.error(error?.response?.data?.detail || error.message || '下推采购入库失败');
    } finally {
      setPushToReceiptLoading(false);
    }
  };

  // 打开下推收货通知 Modal
  const handlePushToNotice = async (record: PurchaseOrder) => {
    try {
      const detail = await getPurchaseOrder(record.id!);
      const items = (detail.items || []).filter((it: PurchaseOrderItem) => (it.outstanding_quantity ?? 0) > 0);
      if (items.length === 0) {
        messageApi.warning('采购单已全部入库，无可下推明细');
        return;
      }
      const quantities: Record<number, number> = {};
      items.forEach((it: PurchaseOrderItem) => {
        if (it.id != null) quantities[it.id] = Number(it.outstanding_quantity ?? 0);
      });
      setPushToNoticeOrder(detail as PurchaseOrderDetail);
      setPushToNoticeQuantities(quantities);
      setPushToNoticeVisible(true);
    } catch {
      messageApi.error('加载采购订单详情失败');
    }
  };

  // 确认下推收货通知
  const handlePushToNoticeConfirm = async () => {
    if (!pushToNoticeOrder?.id) return;
    const items = (pushToNoticeOrder.items || []).filter((it: PurchaseOrderItem) => (it.outstanding_quantity ?? 0) > 0);
    for (const it of items) {
      if (it.id == null) continue;
      const qty = pushToNoticeQuantities[it.id] ?? 0;
      const max = Number(it.outstanding_quantity ?? 0);
      if (qty <= 0) continue;
      if (qty > max) {
        messageApi.error(`物料 ${it.material_code || it.material_name} 的通知数量不能超过未入库数量 ${max}`);
        return;
      }
    }
    setPushToNoticeLoading(true);
    try {
      const result = await pushPurchaseOrderToReceiptNotice(pushToNoticeOrder.id, pushToNoticeQuantities);
      messageApi.success(`成功生成收货通知单：${result.notice_code || '已创建'}`);
      setPushToNoticeVisible(false);
      setPushToNoticeOrder(null);
      setPushToNoticeQuantities({});
      invalidateStatistics();
      actionRef.current?.reload();
      if (detailDrawerVisible && orderDetail?.id === pushToNoticeOrder.id) {
        getPurchaseOrder(pushToNoticeOrder.id).then(setOrderDetail);
      }
    } catch (error: any) {
      messageApi.error(error?.response?.data?.detail || error.message || '下推收货通知失败');
    } finally {
      setPushToNoticeLoading(false);
    }
  };

  // 下推采购发票（直接调用，无需数量选择）
  const handlePushToInvoice = async (record: PurchaseOrder) => {
    setPushToInvoiceLoading(true);
    try {
      const result = await pushPurchaseOrderToInvoice(record.id!);
      messageApi.success(`成功生成采购发票：${result.invoice_code || '已创建'}，请前往财务管理完善发票号码等信息`);
      invalidateStatistics();
      actionRef.current?.reload();
      if (detailDrawerVisible && orderDetail?.id === record.id) {
        getPurchaseOrder(record.id!).then(setOrderDetail);
      }
    } catch (error: any) {
      messageApi.error(error?.response?.data?.detail || error.message || '下推采购发票失败');
    } finally {
      setPushToInvoiceLoading(false);
    }
  };

  // 处理删除
  const handleDelete = async (record: PurchaseOrder) => {
    Modal.confirm({
      title: '删除采购订单',
      content: `确定要删除采购订单 "${record.order_code}" 吗？此操作不可恢复。`,
      okType: 'danger',
      onOk: async () => {
        try {
          await deletePurchaseOrder(record.id!);
          messageApi.success('采购订单删除成功');
          invalidateStatistics();
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '采购订单删除失败');
        }
      },
    });
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) return;
    Modal.confirm({
      title: '批量删除',
      content: `确定要删除选中的 ${keys.length} 条采购订单吗？`,
      okType: 'danger',
      onOk: async () => {
        try {
          for (const k of keys) {
            await deletePurchaseOrder(Number(k));
          }
          messageApi.success(`已删除 ${keys.length} 条采购订单`);
          setSelectedRowKeys([]);
          invalidateStatistics();
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error?.message || '批量删除失败');
        }
      },
    });
  };

  const handleSyncConfirm = async (rows: Record<string, any>[]) => {
    try {
      let successCount = 0;
      for (const row of rows) {
        const payload: Partial<PurchaseOrder> = {
          order_date: row.order_date || row.orderDate,
          delivery_date: row.delivery_date || row.deliveryDate,
          supplier_id: row.supplier_id ?? row.supplierId,
          supplier_name: row.supplier_name || row.supplierName,
          total_amount: row.total_amount ?? row.totalAmount,
          status: row.status || '草稿',
          items: Array.isArray(row.items) ? row.items : [],
        };
        await createPurchaseOrder(payload);
        successCount += 1;
      }
      messageApi.success(`已同步 ${successCount} 条采购订单`);
      invalidateStatistics();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || '同步失败');
    }
  };

  const handleListImport = async (data: any[][]) => {
    if (!data || data.length < 2) {
      messageApi.warning('导入数据为空或格式不正确');
      return;
    }
    const headers = (data[0] || []).map((h: any) => String(h || '').trim());
    const rows = data.slice(2).filter((row: any[]) => row?.some((c: any) => c != null && String(c).trim() !== ''));

    if (rows.length === 0) {
      messageApi.warning('没有可导入的数据行（请从第3行开始填写）');
      return;
    }

    const col = (name: string) => headers.findIndex((h: string) => (h || '').replace(/\*+/, '').trim() === name || (h || '').trim() === name);
    const idx = {
      code: col('订单编号') >= 0 ? col('订单编号') : col('编号'),
      supplier: col('供应商名称') >= 0 ? col('供应商名称') : col('供应商'),
      date: col('订单日期') >= 0 ? col('订单日期') : col('日期'),
      material: col('物料编码') >= 0 ? col('物料编码') : col('物料'),
      qty: col('数量') >= 0 ? col('数量') : -1,
      price: col('单价') >= 0 ? col('单价') : -1,
      delivery: col('交货日期') >= 0 ? col('交货日期') : -1,
      notes: col('备注') >= 0 ? col('备注') : -1,
    };

    if (idx.supplier < 0 || idx.date < 0 || idx.material < 0 || idx.qty < 0) {
      messageApi.error('缺少必需列：供应商名称、订单日期、物料编码、数量');
      return;
    }

    const [matRes, _] = await Promise.all([
      apiRequest<unknown>('/apps/master-data/materials', { params: { limit: 5000, is_active: true } }),
      Promise.resolve(),
    ]);
    const matList = Array.isArray(matRes) ? matRes : (matRes as any)?.data ?? (matRes as any)?.items ?? [];

    const errors: Array<{ row: number; message: string }> = [];
    const groupMap = new Map<string, { code?: string; supplier: string; date: string; items: any[] }>();

    rows.forEach((row: any[], i: number) => {
      const rowNum = i + 3;
      const supplierName = (row[idx.supplier] ?? '').toString().trim();
      const dateVal = (row[idx.date] ?? '').toString().trim();
      const materialCode = (row[idx.material] ?? '').toString().trim();
      const qtyVal = row[idx.qty];
      const qty = Number(qtyVal);
      if (!supplierName) {
        errors.push({ row: rowNum, message: '供应商名称不能为空' });
        return;
      }
      if (!dateVal) {
        errors.push({ row: rowNum, message: '订单日期不能为空' });
        return;
      }
      if (!materialCode) {
        errors.push({ row: rowNum, message: '物料编码不能为空' });
        return;
      }
      if (isNaN(qty) || qty <= 0) {
        errors.push({ row: rowNum, message: '数量必须大于0' });
        return;
      }

      const mat = (Array.isArray(matList) ? matList : []).find((m: any) => (m.mainCode || m.code || '').toUpperCase() === materialCode.toUpperCase());
      if (!mat) {
        errors.push({ row: rowNum, message: `未找到物料：${materialCode}` });
        return;
      }

      const code = idx.code >= 0 ? (row[idx.code] ?? '').toString().trim() : '';
      const price = idx.price >= 0 ? (Number(row[idx.price]) || 0) : 0;
      const delivery = idx.delivery >= 0 ? (row[idx.delivery] ?? '').toString().trim() : undefined;
      const notes = idx.notes >= 0 ? (row[idx.notes] ?? '').toString().trim() : undefined;

      const groupKey = code || `${supplierName}|${dateVal}`;
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, { code: code || undefined, supplier: supplierName, date: dateVal, items: [] });
      }
      const g = groupMap.get(groupKey)!;
      g.items.push({
        material_id: mat.id,
        material_code: mat.mainCode || mat.code,
        material_name: mat.name,
        material_spec: mat.specification || '',
        unit: mat.baseUnit || '件',
        ordered_quantity: qty,
        unit_price: price,
        required_date: delivery || undefined,
        notes: notes || undefined,
      });
    });

    if (errors.length > 0) {
      Modal.warning({
        title: '数据验证失败',
        width: 600,
        content: (
          <div>
            <p>以下行存在错误，请修正后重新导入：</p>
            <List size="small" dataSource={errors} renderItem={(item) => (
              <List.Item><Typography.Text type="danger">第 {item.row} 行：{item.message}</Typography.Text></List.Item>
            )} />
          </div>
        ),
      });
      return;
    }

    const toImport: Partial<PurchaseOrder>[] = [];
    groupMap.forEach((g) => {
      const supp = supplierList.find((s: any) => ((s.name || s.code || '').trim() === g.supplier.trim()) || ((s.supplier_name || '').trim() === g.supplier.trim()));
      toImport.push({
        order_code: g.code,
        order_date: g.date,
        supplier_id: supp?.id,
        supplier_name: g.supplier,
        status: '草稿',
        items: g.items,
      });
    });

    if (toImport.length === 0) {
      messageApi.warning('没有可导入的数据');
      return;
    }

    try {
      const result = await batchImport({
        items: toImport,
        importFn: async (item) => createPurchaseOrder(item),
        title: '正在导入采购订单',
        concurrency: 3,
      });

      if (result.failureCount > 0) {
        Modal.warning({
          title: '导入完成（部分失败）',
          width: 600,
          content: (
            <div>
              <p><strong>导入结果：成功 {result.successCount} 条，失败 {result.failureCount} 条</strong></p>
              {result.errors.length > 0 && (
                <List size="small" dataSource={result.errors} renderItem={(e) => (
                  <List.Item><Typography.Text type="danger">第 {e.row} 行：{e.error}</Typography.Text></List.Item>
                )} />
              )}
            </div>
          ),
        });
      } else {
        messageApi.success(`成功导入 ${result.successCount} 条采购订单`);
      }
      if (result.successCount > 0) {
        invalidateStatistics();
        actionRef.current?.reload();
      }
    } catch (error: any) {
      messageApi.error(error?.message || '导入失败');
    }
  };

  // 处理编辑
  const handleEdit = async (record: PurchaseOrder) => {
    try {
      const detail = await getPurchaseOrder(record.id!);
      setIsEdit(true);
      setCurrentOrder(detail);
      setModalVisible(true);
      const items = (detail.items || []).map((it: any) => ({
        material_id: it.material_id ?? it.materialId,
        material_code: it.material_code || it.materialCode || '',
        material_name: it.material_name || it.materialName || '',
        material_spec: it.material_spec || '',
        unit: it.unit || '件',
        ordered_quantity: Number(it.ordered_quantity ?? it.orderedQuantity) || 0,
        unit_price: Number(it.unit_price ?? it.unitPrice) || 0,
        tax_rate: 0,
        required_date: it.required_date || it.requiredDate ? dayjs(it.required_date || it.requiredDate) : undefined,
      }));
      setTimeout(() => {
        formRef.current?.setFieldsValue({
          order_code: detail.order_code,
          supplier_id: detail.supplier_id,
          supplier_name: detail.supplier_name,
          supplier_contact: detail.supplier_contact,
          supplier_phone: detail.supplier_phone,
          order_date: detail.order_date,
          delivery_date: detail.delivery_date,
          order_type: detail.order_type || '标准采购',
          price_type: 'tax_exclusive',
          notes: detail.notes,
          attachments: (detail as any).attachments || [],
          items: items.length > 0 ? items : [defaultOrderItem],
        });
      }, 100);
    } catch (error) {
      messageApi.error('获取采购订单详情失败');
    }
  };

  /** 参考销售订单：先打开弹窗，再让 CodeField 自动生成编码 */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentOrder(null);
    setModalVisible(true);
    setTimeout(() => {
      formRef.current?.resetFields();
      formRef.current?.setFieldsValue({ items: [defaultOrderItem], price_type: 'tax_exclusive' });
    }, 0);
  };

  // 处理表单提交（创建/更新）
  const handleFormSubmit = async (values: any): Promise<void> => {
    try {
      const validItems = (values.items ?? []).filter(
        (it: any) => it.material_id && (Number(it.ordered_quantity) || 0) > 0
      );
      if (!validItems.length) {
        messageApi.error('请至少添加一条有效采购明细（选择物料并填写数量）');
        throw new Error('请至少添加一条有效采购明细');
      }

      const data = { ...values };
      // 处理附件
      const formAttachments = data.attachments || [];
      data.attachments = formAttachments.map((f: any) => {
        if (f.response) {
          if (Array.isArray(f.response) && f.response.length > 0) {
            return { uid: f.response[0].uuid, name: f.response[0].original_name, status: 'done', url: getFileDownloadUrl(f.response[0].uuid) };
          }
          if (f.response.uuid) {
            return { uid: f.response.uuid, name: f.response.original_name, status: 'done', url: getFileDownloadUrl(f.response.uuid) };
          }
        }
        return { uid: f.uid, name: f.name, status: 'done', url: f.url };
      });

      const priceType = data.price_type ?? 'tax_exclusive';
      data.currency = data.currency || 'CNY';

      const itemsPayload = validItems.map((it: any) => {
        const qty = Number(it.ordered_quantity) || 0;
        let price = Number(it.unit_price) || 0;
        const taxRate = Number(it.tax_rate) || 0;
        if (priceType === 'tax_inclusive' && price > 0 && taxRate >= 0) {
          price = price / (1 + taxRate / 100);
        }
        const reqDate = it.required_date;
        const dateStr = reqDate ? (dayjs.isDayjs(reqDate) ? reqDate.format('YYYY-MM-DD') : String(reqDate).slice(0, 10)) : undefined;
        if (!dateStr) {
          messageApi.error(`第 ${validItems.indexOf(it) + 1} 行：请选择要求到货日期`);
          throw new Error('请填写要求到货日期');
        }
        const totalPrice = qty * price;
        return {
          material_id: Number(it.material_id),
          material_code: it.material_code || '',
          material_name: it.material_name || '',
          material_spec: it.material_spec || null,
          ordered_quantity: qty,
          unit: it.unit || '件',
          unit_price: price,
          total_price: totalPrice,
          received_quantity: 0,
          outstanding_quantity: qty,
          required_date: dateStr,
          inspection_required: true,
          notes: it.notes || null,
        };
      });

      const totalAmount = itemsPayload.reduce((s: number, it: any) => s + Number(it.total_price), 0);
      const firstTaxRate = validItems[0] ? Number(validItems[0].tax_rate) || 0 : 0;
      data.tax_rate = priceType === 'tax_inclusive' ? (firstTaxRate > 1 ? firstTaxRate / 100 : firstTaxRate) : 0;
      data.tax_amount = totalAmount * data.tax_rate;
      data.net_amount = totalAmount + data.tax_amount;

      let orderId: number | undefined;
      if (isEdit && currentOrder?.id) {
        await updatePurchaseOrder(currentOrder.id, { ...data, items: itemsPayload });
        orderId = currentOrder.id;
        if (!submitAfterSaveRef.current) {
          messageApi.success('采购订单更新成功');
        }
      } else {
        const created = await createPurchaseOrder({ ...data, items: itemsPayload });
        orderId = (created as any)?.id;
        if (!submitAfterSaveRef.current) {
          messageApi.success('采购订单创建成功');
        }
      }

      if (submitAfterSaveRef.current && orderId) {
        try {
          await submitPurchaseOrder(orderId);
          messageApi.success(isEdit ? '采购订单已保存并提交，状态已转为待审核' : '采购订单已创建并提交，状态已转为待审核');
        } catch (submitErr: any) {
          messageApi.warning(`保存成功，但提交失败：${submitErr?.message || '未知错误'}。您可在列表中点击「提交」重试。`);
        }
        submitAfterSaveRef.current = false;
      }

      setModalVisible(false);
      invalidateStatistics();
      actionRef.current?.reload();
    } catch (error: any) {
      submitAfterSaveRef.current = false;
      if (error?.message && !error.message.includes('请至少添加') && !error.message.includes('要求到货')) {
        messageApi.error(error.message || '操作失败');
      }
      throw error;
    }
  };

  // 详情列定义
  const detailColumns: ProDescriptionsItemProps<PurchaseOrderDetail>[] = [
    {
      title: '订单编号',
      dataIndex: 'order_code',
    },
    {
      title: '供应商',
      dataIndex: 'supplier_name',
    },
    {
      title: '订单类型',
      dataIndex: 'order_type',
    },
    {
      title: '订单日期',
      dataIndex: 'order_date',
      valueType: 'date',
    },
    {
      title: '交货日期',
      dataIndex: 'delivery_date',
      valueType: 'date',
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status) => {
        const config = getStatusDisplay(status);
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '审核状态',
      dataIndex: 'review_status',
      render: (status) => {
        const config = getReviewStatusDisplay(status);
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '订单金额',
      dataIndex: 'total_amount',
      render: (text) => `¥${formatAmount(text)}`,
    },
    {
      title: '税率',
      dataIndex: 'tax_rate',
      render: (text) => text ? `${text}%` : '-',
    },
    {
      title: '税额',
      dataIndex: 'tax_amount',
      render: (text) => (text != null && text !== '') ? `¥${formatAmount(text)}` : '-',
    },
    {
      title: '含税金额',
      dataIndex: 'net_amount',
      render: (text) => (text != null && text !== '') ? `¥${formatAmount(text)}` : '-',
    },
    {
      title: '备注',
      dataIndex: 'notes',
      span: 2,
      render: (text) => text || '-',
    },
  ];

  const statCards: StatCard[] = hasPageMetricConfig
    ? pageMetricCards
    : statistics
    ? [
        {
          title: t('app.kuaizhizao.purchase.statArrivalRate'),
          value: statistics.monthly_arrival_rate ?? 0,
          suffix: '%',
          valueStyle: { color: token.colorPrimary },
          description: (
            <div style={{ color: '#52c41a' }}>
              较昨日 +0.5%
            </div>
          ),
          backgroundChart: (
            <SimpleSparkline 
              data={statistics.trends?.arrival_rate || [60, 75, 80, 78, 85, 90, 88]} 
              color={token.colorPrimary} 
            />
          ),
        },
        {
          title: t('app.kuaizhizao.salesOrder.lifecyclePendingReview'),
          value: statistics.pending_review_count ?? 0,
          valueStyle: (statistics.pending_review_count ?? 0) > 0 ? { color: '#faad14' } : undefined,
          description: (statistics.pending_review_count ?? 0) > 0 ? '需即时审核' : '无待处理',
          onClick:
            (statistics.pending_review_count ?? 0) > 0
              ? () => {
                  tableSearchFormRef.current?.setFieldsValue?.({ status: '待审核' });
                  actionRef.current?.reload?.();
                }
              : undefined,
        },
        {
          title: t('app.kuaizhizao.purchase.statAnnualTotal'),
          value: statistics.annual_total_amount ?? 0,
          prefix: '¥',
          precision: 2,
          valueStyle: { color: '#2f54eb' },
          description: (
            <div style={{ color: (statistics as any).annual_total_yoy >= 0 ? '#52c41a' : '#ff4d4f' }}>
              较去年同期 {(statistics as any).annual_total_yoy ? `${(statistics as any).annual_total_yoy > 0 ? '+' : ''}${(statistics as any).annual_total_yoy}%` : '+0%'}
            </div>
          ),
          backgroundChart: (
            <SimpleSparkline 
              data={statistics.trends?.annual_total || [1000, 2000, 1500, 3000, 2500, 4000, 3500]} 
              color="#2f54eb" 
            />
          ),
        },
        {
          title: t('app.kuaizhizao.purchase.statSupplierOnTime'),
          value: statistics.supplier_on_time_rate ?? 0,
          suffix: '%',
          valueStyle: { color: '#52c41a' },
          backgroundChart: (
            <SimpleSparkline 
              data={[92, 95, 88, 96, 94, 98, 95]} 
              type="column"
              color="#52c41a" 
            />
          ),
        },
        {
          title: t('app.kuaizhizao.salesOrder.statOverdue'),
          value: statistics.overdue_count ?? 0,
          valueStyle: (statistics.overdue_count ?? 0) > 0 ? { color: token.colorError } : undefined,
          description: (statistics.overdue_count ?? 0) > 0 ? (
            <div style={{ color: token.colorError }}>
              超期金额 ¥{((statistics.overdue_count ?? 0) * 1200).toLocaleString()}
            </div>
          ) : null,
          backgroundChart: (
            <SimpleSparkline 
              data={[5, 8, 3, 12, 7, 15, 10]} 
              color={token.colorError} 
            />
          ),
        },
      ]
    : [];

  return (
    <>
      <ListPageTemplate statCards={statCards}>
        <UniTable<PurchaseOrder>
          headerTitle="采购订单"
          formRef={tableSearchFormRef}
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          showCreateButton
          createButtonText="新建采购订单"
          onCreate={handleCreate}
          enableRowSelection
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton
          onDelete={handleBatchDelete}
          showImportButton={true}
          onImport={handleListImport}
          importHeaders={['订单编号', '供应商名称', '订单日期', '物料编码', '数量', '单价', '交货日期', '备注']}
          importExampleRow={['PO001', '供应商A', '2025-03-08', 'MAT001', '10', '100', '2025-04-01', '']}
          importFieldMap={{
            '订单编号': 'order_code',
            '供应商名称': 'supplier_name',
            '订单日期': 'order_date',
            '物料编码': 'material_code',
            '数量': 'ordered_quantity',
            '单价': 'unit_price',
            '交货日期': 'delivery_date',
            '备注': 'notes',
          }}
          importFieldRules={{
            supplier_name: { required: true },
            order_date: { required: true },
            material_code: { required: true },
            ordered_quantity: { required: true },
          }}
          showExportButton
          onExport={async (type, keys, pageData) => {
            try {
              const res = await listPurchaseOrders({ skip: 0, limit: 10000 });
              let items = res.data || [];
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else if (type === 'selected' && keys?.length) {
                items = items.filter((d) => d.id != null && keys.includes(d.id));
              }
              if (items.length === 0) {
                messageApi.warning('暂无数据可导出');
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `purchase-orders-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(`已导出 ${items.length} 条记录`);
            } catch (error: any) {
              messageApi.error(error?.message || '导出失败');
            }
          }}
          showSyncButton
          onSync={() => setSyncModalVisible(true)}
          request={async (params) => {
            try {
              const response = await listPurchaseOrders({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                status: params.status,
                review_status: params.review_status,
                keyword: params.keyword,
              });
              return {
                data: response.data || [],
                success: response.success !== false,
                total: response.total || 0,
              };
            } catch (error) {
              messageApi.error('获取采购订单列表失败');
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          scroll={{ x: 1400 }}
        />
      </ListPageTemplate>

      {/* 创建/编辑采购订单 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑采购订单' : '新建采购订单'}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setCurrentOrder(null);
          submitAfterSaveRef.current = false;
          formRef.current?.resetFields();
        }}
        onFinish={handleFormSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
        grid={false}
        initialValues={!isEdit ? { items: [defaultOrderItem] } : undefined}
        extraFooter={
          (isEdit && isDraftStatus(currentOrder?.status)) || !isEdit ? (
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={async () => {
                try {
                  await formRef.current?.validateFields();
                  submitAfterSaveRef.current = true;
                  formRef.current?.submit();
                } catch (err: any) {
                  if (err?.errorFields?.length) {
                    messageApi.warning('请完善必填项后再提交');
                  }
                }
              }}
            >
              {isEdit ? '保存并提交' : '创建并提交'}
            </Button>
          ) : undefined
        }
      >
        <Row gutter={16}>
          <Col span={12}>
            <CodeField
              pageCode="kuaizhizao-purchase-order"
              name="order_code"
              label="采购订单编码"
              required={true}
              autoGenerateOnCreate={!isEdit}
              showGenerateButton={false}
              disabled={isEdit}
              context={{}}
            />
          </Col>
          <Col span={6}>
            <ProFormDatePicker
              name="order_date"
              label="订单日期"
              placeholder="请选择订单日期"
              rules={[{ required: true, message: '请选择订单日期' }]}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={6}>
            <ProFormDatePicker
              name="delivery_date"
              label="要求到货日期"
              placeholder="请选择要求到货日期"
              rules={[{ required: true, message: '请选择要求到货日期' }]}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProForm.Item
              name="supplier_id"
              label={
                <span>
                  供应商
                  <a href="/apps/master-data/supply-chain/suppliers" onClick={(e) => { e.preventDefault(); navigate('/apps/master-data/supply-chain/suppliers'); }} style={{ marginLeft: 8, fontSize: 12 }}>供应商管理</a>
                </span>
              }
              rules={[{ required: true, message: '请选择供应商' }]}
            >
              <UniDropdown
                placeholder="请选择供应商"
                showSearch
                allowClear
                loading={suppliersLoading}
                style={{ width: '100%' }}
                options={supplierList.map((s: any) => ({
                  value: s.id ?? s.supplier_id,
                  label: `${s.code ?? s.supplier_code ?? ''} - ${s.name ?? s.supplier_name ?? ''}`.trim() || String(s.id ?? s.supplier_id),
                }))}
                onChange={(v) => {
                  const s = supplierList.find((x: any) => (x.id ?? x.supplier_id) === v);
                  if (s) {
                    formRef.current?.setFieldsValue({
                      supplier_name: s.name ?? s.supplier_name,
                      supplier_contact: s.contact_person ?? s.contactPerson ?? s.supplier_contact,
                      supplier_phone: s.phone ?? s.supplier_phone,
                    });
                  }
                }}
                quickCreate={{
                  label: '快速新建',
                  onClick: () => setSupplierCreateVisible(true),
                }}
              />
            </ProForm.Item>
          </Col>
          <Col span={6}>
            <ProFormText
              name="supplier_contact"
              label="联系人"
              placeholder="请输入联系人"
            />
          </Col>
          <Col span={6}>
            <ProFormText
              name="supplier_phone"
              label="联系电话"
              placeholder="请输入联系电话"
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProForm.Item name="order_type" label="订单类型" initialValue="标准采购">
              <UniDropdown
                placeholder="请选择订单类型"
                showSearch
                allowClear={false}
                loading={orderTypeLoading}
                style={{ width: '100%' }}
                options={orderTypeOptions}
                quickCreate={{ label: '数据字典管理', onClick: () => navigate('/system/data-dictionaries') }}
              />
            </ProForm.Item>
          </Col>
          <Col span={12} />
        </Row>
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 12 }}>
            <Space align="center" size={12}>
              <span style={{ fontWeight: 600, color: 'rgba(0, 0, 0, 0.88)' }}>
                <span style={{ color: '#ff4d4f', marginRight: 4, fontFamily: 'SimSun, sans-serif' }}>*</span>
                采购明细
              </span>
              <ProForm.Item
                name="price_type"
                initialValue="tax_exclusive"
                noStyle
                valuePropName="checked"
                getValueProps={(v: string) => ({ checked: v === 'tax_inclusive' })}
                getValueFromEvent={(checked: boolean) => (checked ? 'tax_inclusive' : 'tax_exclusive')}
              >
                <Switch checkedChildren="含税" unCheckedChildren="不含税" />
              </ProForm.Item>
            </Space>
          </div>
          <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.price_type !== curr?.price_type}>
            {({ getFieldValue: getFormValue }: any) => {
              const priceType = getFormValue('price_type') ?? 'tax_exclusive';
              const showTaxColumns = priceType === 'tax_inclusive';
              return (
        <ProFormItem required style={{ width: '100%' }}>
          <ProForm.Item name="items" noStyle rules={[{ type: 'array', min: 1, message: '请至少添加一条采购明细' }]}>
            <AntForm.List name="items">
              {(fields, { add, remove }) => {
                const orderDetailColumns = [
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
                                material_spec: 'specification',
                                unit: 'baseUnit',
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
                    title: '规格',
                    dataIndex: 'material_spec',
                    width: 120,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'material_spec']} style={{ margin: 0 }}>
                        <Input placeholder="规格" size="small" />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: '单位',
                    dataIndex: 'unit',
                    width: 80,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'unit']} style={{ margin: 0 }}>
                        <Input placeholder="单位" size="small" />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: '数量',
                    dataIndex: 'ordered_quantity',
                    width: 100,
                    align: 'right' as const,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'ordered_quantity']} rules={[{ required: true, message: '必填' }, { type: 'number', min: 0.01, message: '>0' }]} style={{ margin: 0 }}>
                        <InputNumber placeholder="数量" min={0} precision={2} style={{ width: '100%' }} size="small" />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: showTaxColumns ? '含税单价' : '单价',
                    dataIndex: 'unit_price',
                    width: 100,
                    align: 'right' as const,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'unit_price']} rules={[{ required: true, message: '必填' }, { type: 'number', min: 0, message: '≥0' }]} style={{ margin: 0 }}>
                        <InputNumber placeholder={showTaxColumns ? '含税单价' : '单价'} min={0} precision={4} prefix="¥" style={{ width: '100%' }} size="small" />
                      </AntForm.Item>
                    ),
                  },
                  ...(showTaxColumns
                    ? [
                        {
                          title: '不含税金额',
                          width: 110,
                          align: 'right' as const,
                          render: (_: any, __: any, index: number) => (
                            <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items !== curr?.items}>
                              {({ getFieldValue }: any) => {
                                const items = getFieldValue('items') ?? [];
                                const row = items[index];
                                const qty = Number(row?.ordered_quantity) || 0;
                                const price = Number(row?.unit_price) || 0;
                                const taxRate = Number(row?.tax_rate) || 0;
                                const exclAmt = price > 0 ? (qty * price) / (1 + taxRate / 100) : 0;
                                return <span>¥{exclAmt.toFixed(2)}</span>;
                              }}
                            </AntForm.Item>
                          ),
                        },
                        {
                          title: (
                            <span>
                              税率(%)
                              <Button
                                type="link"
                                size="small"
                                style={{ padding: '0 4px', height: 'auto' }}
                                onClick={() => {
                                  const items = formRef.current?.getFieldValue('items') ?? [];
                                  if (items.length === 0) return;
                                  const rate = prompt('批量设置税率', '13');
                                  if (rate != null && rate !== '') {
                                    const num = parseFloat(rate);
                                    if (!isNaN(num) && num >= 0 && num <= 100) {
                                      const next = items.map((it: any) => ({ ...it, tax_rate: num }));
                                      formRef.current?.setFieldsValue({ items: next });
                                    }
                                  }
                                }}
                              >
                                批量
                              </Button>
                            </span>
                          ),
                          dataIndex: 'tax_rate',
                          width: 100,
                          align: 'right' as const,
                          render: (_: any, __: any, index: number) => (
                            <AntForm.Item name={[index, 'tax_rate']} initialValue={0} style={{ margin: 0 }}>
                              <InputNumber placeholder="0" min={0} max={100} precision={2} addonAfter="%" style={{ width: '100%' }} size="small" />
                            </AntForm.Item>
                          ),
                        },
                        {
                          title: '税额',
                          width: 100,
                          align: 'right' as const,
                          render: (_: any, __: any, index: number) => (
                            <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items !== curr?.items}>
                              {({ getFieldValue }: any) => {
                                const items = getFieldValue('items') ?? [];
                                const row = items[index];
                                const qty = Number(row?.ordered_quantity) || 0;
                                const price = Number(row?.unit_price) || 0;
                                const taxRate = Number(row?.tax_rate) || 0;
                                const exclAmt = price > 0 ? (qty * price) / (1 + taxRate / 100) : 0;
                                const taxAmt = exclAmt * (taxRate / 100);
                                return <span>¥{taxAmt.toFixed(2)}</span>;
                              }}
                            </AntForm.Item>
                          ),
                        },
                      ]
                    : []),
                  {
                    title: showTaxColumns ? '价税合计' : '总价',
                    width: 120,
                    align: 'right' as const,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items !== curr?.items}>
                        {({ getFieldValue }: any) => {
                          const items = getFieldValue('items') ?? [];
                          const row = items[index];
                          const qty = Number(row?.ordered_quantity) || 0;
                          const price = Number(row?.unit_price) || 0;
                          const taxRate = Number(row?.tax_rate) || 0;
                          const exclAmt = showTaxColumns && price > 0 ? (qty * price) / (1 + taxRate / 100) : qty * price;
                          const taxAmt = showTaxColumns ? exclAmt * (taxRate / 100) : 0;
                          const totalIncl = exclAmt + taxAmt;
                          return <span>¥{totalIncl.toFixed(2)}</span>;
                        }}
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: '要求到货',
                    dataIndex: 'required_date',
                    width: 120,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'required_date']} rules={[{ required: true, message: '必填' }]} style={{ margin: 0 }}>
                        <DatePicker size="small" style={{ width: '100%' }} format="YYYY-MM-DD" />
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
                      columns={orderDetailColumns}
                      footer={() => (
                        <Button
                          type="dashed"
                          icon={<PlusOutlined />}
                          onClick={() => {
                            const mainDelivery = formRef.current?.getFieldValue('delivery_date');
                            const defaultDate = mainDelivery != null ? (dayjs.isDayjs(mainDelivery) ? mainDelivery : dayjs(mainDelivery)) : dayjs();
                            add({
                              ...defaultOrderItem,
                              tax_rate: 0,
                              required_date: defaultDate,
                            });
                          }}
                          block
                        >
                          添加明细
                        </Button>
                      )}
                    />
                  </div>
                );
              }}
            </AntForm.List>
          </ProForm.Item>
        </ProFormItem>
              );
            }}
          </AntForm.Item>
        </div>
        <ProFormText name="supplier_name" hidden />
        <ProFormUploadButton
          name="attachments"
          label="附件"
          max={10}
          fieldProps={{
            multiple: true,
            customRequest: async (options) => {
              try {
                const res = await uploadMultipleFiles([options.file as File], { category: 'purchase_order_attachments' });
                if (options.onSuccess) {
                  options.onSuccess(res[0], options.file as any);
                }
              } catch (err) {
                if (options.onError) {
                  options.onError(err as any);
                }
              }
            }
          }}
        />
        <ProFormTextArea
          name="notes"
          label="备注"
          placeholder="请输入备注信息"
          fieldProps={{ rows: 3 }}
        />
      </FormModalTemplate>

      <SupplierFormModal
        open={supplierCreateVisible}
        onClose={() => setSupplierCreateVisible(false)}
        editUuid={null}
        onSuccess={(supplier) => {
          setSupplierList((prev) => [...prev, supplier]);
          formRef.current?.setFieldsValue({
            supplier_id: supplier.id,
            supplier_name: supplier.name,
            supplier_contact: supplier.contactPerson,
            supplier_phone: supplier.phone,
          });
          setSupplierCreateVisible(false);
        }}
      />

      {/* 采购订单详情 Drawer */}
      <DetailDrawerTemplate<PurchaseOrderDetail>
        title={`采购订单详情 - ${orderDetail?.order_code || ''}`}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setOrderDetail(null);
          setApprovalStatus(null);
        }}
        dataSource={orderDetail || undefined}
        columns={detailColumns}
        width={DRAWER_CONFIG.HALF_WIDTH}
        extra={
          orderDetail && (
            <DetailDrawerActions
              items={[
                {
                  key: 'edit',
                  visible: isDraftStatus(orderDetail.status),
                  render: () => (
                    <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setDetailDrawerVisible(false); handleEdit(orderDetail); }}>
                      编辑
                    </Button>
                  ),
                },
                {
                  key: 'workflow',
                  render: () => (
                    <UniWorkflowActions
                      record={orderDetail}
                      entityName="采购订单"
                      statusField="status"
                      reviewStatusField="review_status"
                      draftStatuses={['草稿', 'draft']}
                      pendingStatuses={['待审核', 'pending_review']}
                      approvedStatuses={['已审核', 'audited', '审核通过']}
                      rejectedStatuses={['已驳回', 'rejected']}
                      theme="link"
                      size="small"
                      actions={{
                        submit: (id) => submitPurchaseOrder(id),
                        approve: (id) => approvePurchaseOrder(id, { approved: true, review_remarks: '' }),
                        reject: (id, reason) => approvePurchaseOrder(id, { approved: false, review_remarks: reason || '' }),
                      }}
                      onSuccess={() => { invalidateStatistics(); actionRef.current?.reload(); loadApprovalData(orderDetail.id!); getPurchaseOrder(orderDetail.id!).then(setOrderDetail); }}
                    />
                  ),
                },
                {
                  key: 'push',
                  visible: isAuditedStatus(orderDetail.status),
                  render: () => (
                    <Dropdown
                      menu={{
                        items: [
                          { key: 'receipt-notice', label: '收货通知', icon: <FileTextOutlined />, onClick: () => handlePushToNotice(orderDetail) },
                          { key: 'receipt', label: '采购入库', icon: <InboxOutlined />, onClick: () => handlePushToReceipt(orderDetail) },
                          { key: 'invoice', label: '采购发票', icon: <DollarOutlined />, onClick: () => handlePushToInvoice(orderDetail) },
                        ],
                      }}
                    >
                      <Button type="link" size="small" icon={<CheckCircleOutlined />} style={{ color: '#722ed1' }}>
                        下推 <DownOutlined />
                      </Button>
                    </Dropdown>
                  ),
                },
                {
                  key: 'delete',
                  visible: isDraftStatus(orderDetail.status),
                  render: () => (
                    <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(orderDetail)}>
                      删除
                    </Button>
                  ),
                },
              ]}
            />
          )
        }
        customContent={
          orderDetail && (
            <div>
              <DetailDrawerSection title="基本信息">
                <Row gutter={16}>
                  <Col span={8}>
                    <strong>订单编号：</strong>{orderDetail.order_code}
                  </Col>
                  <Col span={8}>
                    <strong>供应商：</strong>{orderDetail.supplier_name}
                  </Col>
                  <Col span={8}>
                    <strong>订单类型：</strong>{orderDetail.order_type || '-'}
                  </Col>
                </Row>
                <Row gutter={16} style={{ marginTop: 8 }}>
                  <Col span={6}>
                    <strong>订单日期：</strong>{orderDetail.order_date}
                  </Col>
                  <Col span={6}>
                    <strong>交货日期：</strong>{orderDetail.delivery_date}
                  </Col>
                  <Col span={6}>
                    <strong>状态：</strong>
                    {(() => {
                      const config = getStatusDisplay(orderDetail.status);
                      return <Tag color={config.color}>{config.text}</Tag>;
                    })()}
                  </Col>
                  <Col span={6}>
                    <strong>审核状态：</strong>
                    {(() => {
                      const config = getReviewStatusDisplay(orderDetail.review_status);
                      return <Tag color={config.color}>{config.text}</Tag>;
                    })()}
                  </Col>
                </Row>
                <Row gutter={16} style={{ marginTop: 8 }}>
                  <Col span={6}>
                    <strong>订单金额：</strong>¥{formatAmount(orderDetail.total_amount)}
                  </Col>
                  <Col span={6}>
                    <strong>税率：</strong>{orderDetail.tax_rate ? `${orderDetail.tax_rate}%` : '-'}
                  </Col>
                  <Col span={6}>
                    <strong>税额：</strong>¥{formatAmount(orderDetail.tax_amount)}
                  </Col>
                  <Col span={6}>
                    <strong>含税金额：</strong>¥{formatAmount(orderDetail.net_amount)}
                  </Col>
                </Row>
              </DetailDrawerSection>

              {/* 生命周期 */}
              {(() => {
                const lifecycle = getPurchaseOrderLifecycle(orderDetail);
                const mainStages = lifecycle.mainStages ?? [];
                const subStages = lifecycle.subStages ?? [];
                if (mainStages.length === 0 && subStages.length === 0) return null;
                return (
                  <DetailDrawerSection title="生命周期">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {mainStages.length > 0 && (
                        <UniLifecycleStepper
                          steps={mainStages}
                          status={lifecycle.status}
                          showLabels
                          nextStepSuggestions={lifecycle.nextStepSuggestions}
                        />
                      )}
                      {subStages.length > 0 && (
                        <div>
                          <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>
                            执行中 · 全链路
                          </div>
                          <UniLifecycleStepper steps={subStages} showLabels />
                        </div>
                      )}
                    </div>
                  </DetailDrawerSection>
                );
              })()}

              {/* 3. 单据明细 */}
              {orderDetail.items && orderDetail.items.length > 0 && (
                <DetailDrawerSection title="订单明细">
                  <Table
                    size="small"
                    columns={[
                      { title: '物料编码', dataIndex: 'material_code', width: 120 },
                      { title: '物料名称', dataIndex: 'material_name', width: 150 },
                      { title: '采购数量', dataIndex: 'ordered_quantity', width: 100, align: 'right' },
                      { title: '单位', dataIndex: 'unit', width: 60 },
                      { title: '单价', dataIndex: 'unit_price', width: 100, align: 'right', render: (text) => `¥${text}` },
                      { title: '总价', dataIndex: 'total_price', width: 120, align: 'right', render: (text) => `¥${text?.toLocaleString()}` },
                      { title: '已到货', dataIndex: 'received_quantity', width: 100, align: 'right' },
                      { title: '未到货', dataIndex: 'outstanding_quantity', width: 100, align: 'right' },
                      { title: '要求到货日期', dataIndex: 'required_date', width: 120 },
                      { title: '是否检验', dataIndex: 'inspection_required', width: 100, render: (val) => val ? '是' : '否' },
                    ]}
                    dataSource={orderDetail.items}
                    pagination={false}
                    rowKey="id"
                    bordered
                    scroll={{ x: 1000 }}
                  />
                </DetailDrawerSection>
              )}

              {/* 4. 操作记录 */}
              {orderDetail?.id && (
                <DetailDrawerSection title="操作历史">
                  <DocumentTrackingPanel
                    documentType="purchase_order"
                    documentId={orderDetail.id}
                    onDocumentClick={(type, id) => messageApi.info(`跳转到${type}#${id}`)}
                  />
                </DetailDrawerSection>
              )}

              {/* 5. 其他功能：审批流程 */}
              {approvalStatus && approvalStatus.has_flow && (
                <Card
                  title="审批流程"
                  style={{ marginBottom: 16 }}
                  loading={approvalLoading}
                  extra={
                    <Tag color={approvalStatus.status === 'approved' ? 'success' : approvalStatus.status === 'rejected' ? 'error' : 'processing'}>
                      {approvalStatus.status === 'approved' ? '已通过' : approvalStatus.status === 'rejected' ? '已驳回' : '进行中'}
                    </Tag>
                  }
                >
                  <div style={{ marginBottom: 16 }}>
                    {approvalStatus.current_node && (
                      <div>
                        <strong>当前节点：</strong>
                        <Tag color="blue">{approvalStatus.current_node}</Tag>
                      </div>
                    )}
                  </div>

                  {/* 审批记录时间线 */}
                  {approvalStatus?.history && approvalStatus.history.length > 0 && (
                    <div>
                      <Divider titlePlacement="left">审批记录</Divider>
                      <Timeline
                        items={approvalStatus.history.map((h) => {
                          const isPassed = h.action === 'approve';
                          const isRejected = h.action === 'reject';

                          return {
                            dot: isPassed ? (
                              <CheckCircleTwoTone twoToneColor="#52c41a" />
                            ) : isRejected ? (
                              <CloseCircleTwoTone twoToneColor="#ff4d4f" />
                            ) : (
                              <ClockCircleOutlined style={{ color: '#1890ff' }} />
                            ),
                            color: isPassed ? 'green' : isRejected ? 'red' : 'blue',
                            children: (
                              <div>
                                <div style={{ marginBottom: 4 }}>
                                  <Tag
                                    color={isPassed ? 'success' : isRejected ? 'error' : 'processing'}
                                  >
                                    {isPassed ? '通过' : isRejected ? '驳回' : h.action || '-'}
                                  </Tag>
                                </div>
                                <div style={{ color: '#666', fontSize: '12px', marginBottom: 4 }}>
                                  {h.action_at && `审核时间：${h.action_at}`}
                                </div>
                                {h.comment && (
                                  <div style={{ color: '#999', fontSize: '12px', marginTop: 4 }}>
                                    审核意见：{h.comment}
                                  </div>
                                )}
                              </div>
                            ),
                          };
                        })}
                      />
                    </div>
                  )}

                  {(!approvalStatus?.history || approvalStatus.history.length === 0) && approvalStatus?.has_flow && (
                    <Empty
                      description="暂无审批记录"
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      style={{ margin: '20px 0' }}
                    />
                  )}
                </Card>
              )}

            </div>
          )
        }
      />

      <SyncFromDatasetModal
        open={syncModalVisible}
        onClose={() => setSyncModalVisible(false)}
        onConfirm={handleSyncConfirm}
        title="从数据集同步采购订单"
      />

      {/* 下推入库 Modal：标准 Modal，采购数量可编辑 */}
      <Modal
        title="下推到采购入库"
        open={pushToReceiptVisible}
        onCancel={() => {
          setPushToReceiptVisible(false);
          setPushToReceiptOrder(null);
          setPushToReceiptQuantities({});
        }}
        onOk={handlePushToReceiptConfirm}
        confirmLoading={pushToReceiptLoading}
        okText="确认下推"
        width={MODAL_CONFIG.STANDARD_WIDTH}
        destroyOnClose
      >
        {pushToReceiptOrder && (
          <div>
            <p style={{ marginBottom: 16 }}>
              从采购订单 <strong>{pushToReceiptOrder.order_code}</strong> 下推生成采购入库单，可修改各明细的入库数量（不超过未入库数量）：
            </p>
            <Table
              size="small"
              dataSource={(pushToReceiptOrder.items || []).filter(
                (it: PurchaseOrderItem) => (it.outstanding_quantity ?? 0) > 0
              )}
              rowKey="id"
              pagination={false}
              scroll={{ x: 700 }}
              columns={[
                { title: '物料编码', dataIndex: 'material_code', width: 120 },
                { title: '物料名称', dataIndex: 'material_name', width: 150 },
                { title: '采购数量', dataIndex: 'ordered_quantity', width: 100, align: 'right' },
                { title: '已到货', dataIndex: 'received_quantity', width: 90, align: 'right' },
                { title: '未到货', dataIndex: 'outstanding_quantity', width: 90, align: 'right' },
                {
                  title: '入库数量',
                  width: 140,
                  align: 'right',
                  render: (_: any, record: PurchaseOrderItem) => (record.id != null ? (
                    <InputNumber
                      min={0}
                      max={Number(record.outstanding_quantity ?? 0)}
                      value={pushToReceiptQuantities[record.id] ?? 0}
                      onChange={(v) =>
                        setPushToReceiptQuantities((prev) => ({
                          ...prev,
                          [record.id!]: Number(v) || 0,
                        }))
                      }
                      style={{ width: 100 }}
                    />
                  ) : null),
                },
              ]}
            />
          </div>
        )}
      </Modal>

      {/* 下推收货通知 Modal */}
      <Modal
        title="下推到收货通知"
        open={pushToNoticeVisible}
        onCancel={() => {
          setPushToNoticeVisible(false);
          setPushToNoticeOrder(null);
          setPushToNoticeQuantities({});
        }}
        onOk={handlePushToNoticeConfirm}
        confirmLoading={pushToNoticeLoading}
        okText="确认下推"
        width={MODAL_CONFIG.STANDARD_WIDTH}
        destroyOnClose
      >
        {pushToNoticeOrder && (
          <div>
            <p style={{ marginBottom: 16 }}>
              从采购订单 <strong>{pushToNoticeOrder.order_code}</strong> 下推生成收货通知单，可修改各明细的通知数量（不超过未入库数量）：
            </p>
            <Table
              size="small"
              dataSource={(pushToNoticeOrder.items || []).filter(
                (it: PurchaseOrderItem) => (it.outstanding_quantity ?? 0) > 0
              )}
              rowKey="id"
              pagination={false}
              scroll={{ x: 700 }}
              columns={[
                { title: '物料编码', dataIndex: 'material_code', width: 120 },
                { title: '物料名称', dataIndex: 'material_name', width: 150 },
                { title: '采购数量', dataIndex: 'ordered_quantity', width: 100, align: 'right' },
                { title: '已到货', dataIndex: 'received_quantity', width: 90, align: 'right' },
                { title: '未到货', dataIndex: 'outstanding_quantity', width: 90, align: 'right' },
                {
                  title: '通知数量',
                  width: 140,
                  align: 'right',
                  render: (_: any, record: PurchaseOrderItem) => (record.id != null ? (
                    <InputNumber
                      min={0}
                      max={Number(record.outstanding_quantity ?? 0)}
                      value={pushToNoticeQuantities[record.id] ?? 0}
                      onChange={(v) =>
                        setPushToNoticeQuantities((prev) => ({
                          ...prev,
                          [record.id!]: Number(v) || 0,
                        }))
                      }
                      style={{ width: 100 }}
                    />
                  ) : null),
                },
              ]}
            />
          </div>
        )}
      </Modal>
    </>
  );
};

export default PurchaseOrdersPage;




