/**
 * 报价单管理页面
 *
 * 提供报价单的创建、查看、编辑、删除和转销售订单功能。
 *
 * @author RiverEdge Team
 * @date 2026-02-19
 */

import React, { useRef, useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { useNavigate } from 'react-router-dom';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Table, Form, InputNumber, Input, Row, Col, DatePicker, List, Typography, Alert, theme as AntdTheme, Descriptions, Empty, Spin, Dropdown, Tooltip, Select } from 'antd';
import type { DescriptionsProps } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, SwapOutlined, PrinterOutlined, ImportOutlined, AppstoreAddOutlined, SendOutlined, CommentOutlined, RollbackOutlined, CheckOutlined, CloseCircleOutlined, UndoOutlined, ArrowDownOutlined, BranchesOutlined, ReloadOutlined } from '@ant-design/icons';
import { ProForm, ProFormText, ProFormDatePicker, ProFormTextArea } from '@ant-design/pro-components';
import { UniTable } from '../../../../../components/uni-table';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import { MaterialUnitSelect } from '../../../../../components/material-unit-select';
import { DictionarySelect } from '../../../../../components/dictionary-select';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { MaterialBatchPickerModal } from '../../../../../components/material-batch-picker-modal';
import type { Material } from '../../../../master-data/types/material';
import { CustomerFormModal } from '../../../../master-data/components/CustomerFormModal';
import { customerApi } from '../../../../master-data/services/supply-chain';
import { ListPageTemplate, DetailDrawerTemplate, DRAWER_CONFIG, FormModalTemplate } from '../../../../../components/layout-templates';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { AmountDisplay } from '../../../../../components/permission';
import { DictionaryLabel } from '../../../../../components/dictionary-label';
import {
  listQuotations,
  getQuotation,
  createQuotation,
  updateQuotation,
  deleteQuotation,
  convertQuotationToOrder,
  submitQuotation,
  withdrawQuotation,
  approveQuotation,
  rejectQuotation,
  revokeReviewQuotation,
  confirmCustomerQuotation,
  reopenQuotation,
  revokePushQuotation,
  createQuotationRevision,
  printQuotation,
  getQuotationPrintVariables,
  recordQuotationPrint,
  Quotation,
} from '../../../services/quotation';
import { getSalesOrder, type SalesOrder } from '../../../services/sales-order';
import { SalesOrderDetailBody } from '../sales-orders/components/SalesOrderDetailBody';
import { getQuotationLifecycle } from '../../../utils/quotationLifecycle';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import {
  DocumentTrackingRelationsTabsBody,
  DocumentTrackingTimelineBody,
  TraceLinkedDocumentBrief,
  useDocumentTracking,
} from '../../../../../components/document-tracking-panel';
import { apiRequest } from '../../../../../services/api';
import type { DocumentPrintApiResult } from '../../../../../utils/printResponseHelpers';
import { getPrintTemplateList, type PrintTemplate } from '../../../../../services/printTemplate';
import { getDataDictionaryByCode, getDictionaryItemList } from '../../../../../services/dataDictionary';
import dayjs from 'dayjs';
import { generateCode, testGenerateCode, getCodeRulePageConfig } from '../../../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';
import { batchImport } from '../../../../../utils/batchOperations';
import { renderRowActionsOverflow } from '../../../../../utils/renderRowActionsOverflow';
import { useTranslation } from 'react-i18next';
import { CustomerFollowUpFormModal, type CustomerFollowUpPreset } from '../../../components/CustomerFollowUpFormModal';
import { RE_STATUS_BADGE_DRAFT, resolveStatusTagDisplayProps } from '../../../../../constants/statusBadges';
import '../../../../../components/uni-table-detail/index.less';

const LazyUniImport = lazy(() =>
  import('../../../../../components/uni-import').then((m) => ({ default: m.UniImport }))
);
const LazySyncFromDatasetModal = lazy(() => import('../../../../../components/sync-from-dataset-modal'));

/** 币种字典值：人民币（与 CURRENCY 字典项 value 一致，一般为 CNY） */
const DEFAULT_QUOTATION_CURRENCY = 'CNY';

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  草稿: { text: '草稿', color: RE_STATUS_BADGE_DRAFT },
  已发送: { text: '已发送', color: 'processing' },
  已接受: { text: '已接受', color: 'success' },
  已拒绝: { text: '已拒绝', color: 'error' },
  已转订单: { text: '已转订单', color: 'success' },
};

/** 与后端 LEGACY_PENDING_VALUES 一致 */
const PENDING_REVIEW_STATUSES = new Set(['待审核', 'PENDING', 'PENDING_REVIEW']);

function isApprovedReview(rs: string | undefined): boolean {
  const r = (rs || '').trim();
  return ['已通过', 'APPROVED', '审核通过', '通过', '已审核'].includes(r);
}

function canWithdrawQuotation(q: Quotation): boolean {
  return q.status === '已发送' && PENDING_REVIEW_STATUSES.has((q.review_status || '').trim());
}

function canApproveQuotation(q: Quotation): boolean {
  if (q.status !== '已发送') return false;
  const rs = (q.review_status || '').trim();
  return PENDING_REVIEW_STATUSES.has(rs) || rs === '';
}

function canRejectQuotation(q: Quotation): boolean {
  return canApproveQuotation(q);
}

function canRevokeReviewQuotation(q: Quotation): boolean {
  return q.status === '已发送' && isApprovedReview(q.review_status);
}

function canConfirmCustomerQuotation(q: Quotation): boolean {
  return q.status === '已发送' && isApprovedReview(q.review_status);
}

function canReopenQuotation(q: Quotation): boolean {
  return q.status === '已拒绝';
}

function canRevokePushQuotation(q: Quotation): boolean {
  return q.status === '已转订单' && q.conversion_downstream_missing === true;
}

function canDeleteQuotation(q: Quotation): boolean {
  if (q.conversion_downstream_missing === true) return true;
  if (q.status === '已转订单') return false;
  if (q.sales_order_id != null && Number(q.sales_order_id) > 0) return false;
  return true;
}

/** 允许「转订单」：已审核通过或已接受；或已转单但下游已删可重新下推 */
function canConvertQuotation(q: Quotation): boolean {
  if (q.is_latest_in_series === false) return false;
  if (q.status === '已拒绝') return false;
  if (q.status === '已转订单') {
    return q.conversion_downstream_missing === true;
  }
  if (q.status === '已接受') return true;
  if (q.status === '已发送') return isApprovedReview(q.review_status);
  return false;
}

/** 生成PDF报价：与后端 print 门禁一致 */
function canPrintFormalQuotation(q: Quotation): boolean {
  const st = (q.status || '').trim();
  if (st === '已接受' || st === '已转订单') return true;
  if (st === '已发送' && isApprovedReview(q.review_status)) return true;
  return false;
}

/** 另存为新版本：非草稿的最新系列行 */
function canCreateRevision(q: Quotation): boolean {
  if (q.is_latest_in_series === false) return false;
  if ((q.status || '').trim() === '草稿') return false;
  return true;
}

/** ProForm 提交时日期可能是 dayjs、字符串或 Date，避免直接调用 .format 报错 */
function toApiDateString(v: unknown): string | undefined {
  if (v == null || v === '') return undefined;
  if (dayjs.isDayjs(v)) return v.isValid() ? v.format('YYYY-MM-DD') : undefined;
  const d = dayjs(v as string | Date | number);
  return d.isValid() ? d.format('YYYY-MM-DD') : undefined;
}

/** 将 ProDescriptions 列配置转为 Ant Design Descriptions items（与 detailDrawerDescriptionItems 一致） */
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
      content = col.render(content, dataSource, index, {} as any, col as any);
    }
    return {
      key: String(col.key ?? col.dataIndex ?? index),
      label: col.title as React.ReactNode,
      children: content !== undefined && content !== null ? content : '-',
      span: col.span ?? 1,
    };
  });
}

/** 报价明细表最小横向滚动宽度（避免列换行，以横向滚动为主） */
const QUOTATION_DETAIL_ITEMS_SCROLL_X = 1060;

/** 报价单详情内打开下游销售订单时：二层抽屉宽度与 zIndex（叠在报价单抽屉之上） */
const LINKED_DOCUMENT_DRAWER_WIDTH = '45%';
const LINKED_DOCUMENT_DRAWER_Z_INDEX = 1050;

/** 抽屉外左上角全链路浮层：高于默认抽屉遮罩，低于二层抽屉避免挡住下游单据 */
const QUOTATION_FULL_CHAIN_OVERLAY_Z_INDEX = 1030;

/** 全链路悬浮层外边距：左/上与视口留白；宽度方向仍与中线各收一侧（左半屏）；高度方向为视口上下留白 */
const QUOTATION_FULL_CHAIN_FLOAT_MARGIN = 16;

/** 左半屏「全链路」与「关联单据简览」两块悬浮窗之间的垂直间距（与全局 16px 间距体系一致） */
const QUOTATION_LEFT_CHAIN_GAP = 16;

/** 左侧「全链路 + 关联简览」悬浮窗与右侧报价单抽屉之间的水平间距（避免两块视觉贴死） */
const QUOTATION_CHAIN_DRAWER_GAP = 16;

/** 左半屏上下两块悬浮窗参与高度平分的纵向扣除：上外边距 + 下外边距 + 中间间隙 */
const QUOTATION_CHAIN_VERTICAL_TRIM =
  QUOTATION_FULL_CHAIN_FLOAT_MARGIN * 2 + QUOTATION_LEFT_CHAIN_GAP;

const quotationChainHalfHeightCss = `calc((100vh - ${QUOTATION_CHAIN_VERTICAL_TRIM}px) / 2)`;
const quotationChainPanelWidthCss = `calc(50vw - ${QUOTATION_FULL_CHAIN_FLOAT_MARGIN * 2 + QUOTATION_CHAIN_DRAWER_GAP}px)`;
const quotationBriefPanelTopCss = `calc(${QUOTATION_FULL_CHAIN_FLOAT_MARGIN}px + (100vh - ${QUOTATION_CHAIN_VERTICAL_TRIM}px) / 2 + ${QUOTATION_LEFT_CHAIN_GAP}px)`;

function renderQuotationRowActions(nodes: React.ReactNode[], keyPrefix: string): React.ReactNode {
  return renderRowActionsOverflow(nodes, keyPrefix);
}

/** 与销售订单明细表同一套 Table + Form.List 用法；物料列样式见 .quotation-detail-table */
const QuotationMaterialSelectCell: React.FC<{ index: number }> = ({ index }) => {
  const row = Form.useWatch(['items', index]);
  const mid =
    row?.material_id != null && row?.material_id !== ''
      ? Number(row.material_id)
      : null;
  const fallback =
    mid != null &&
    Number.isFinite(mid) &&
    (row?.material_code || row?.material_name)
      ? {
          value: mid,
          label: `${row.material_code || ''} - ${row.material_name || ''}`.trim() || String(mid),
        }
      : undefined;
  return (
    <div
      className="quotation-material-cell"
      style={{ display: 'flex', alignItems: 'center', width: '100%', minWidth: 0 }}
    >
      <div style={{ flex: 1, minWidth: 200 }}>
        <UniMaterialSelect
          name={[index, 'material_id']}
          label=""
          placeholder="请选择物料（支持名称/编号搜索）"
          required
          size="small"
          listFieldKey={index}
          listFieldName="items"
          fillMapping={{
            material_code: 'mainCode',
            material_name: 'name',
            material_spec: 'specification',
            material_unit: 'baseUnit',
            unit_price: 'defaults.defaultSalePrice' as any,
          }}
          fallbackOption={fallback}
          formItemProps={{ style: { margin: 0 } }}
          showQuickCreate
          showAdvancedSearch
        />
      </div>
    </div>
  );
};

const QuotationAmountCell: React.FC<{ index: number }> = ({ index }) => {
  const row = Form.useWatch(['items', index]);
  const amt = (Number(row?.quote_quantity) || 0) * (Number(row?.unit_price) || 0);
  return <AmountDisplay resource="sales_order" value={amt} />;
};

const QuotationFormSummary: React.FC = () => {
  const items = Form.useWatch('items');
  const totalQuantity = items?.reduce((sum: number, it: any) => sum + (Number(it?.quote_quantity) || 0), 0) || 0;
  const totalAmount =
    items?.reduce((sum: number, it: any) => sum + (Number(it?.quote_quantity) || 0) * (Number(it?.unit_price) || 0), 0) || 0;

  return (
    <div
      style={{
        marginTop: 12,
        padding: '12px',
        background: '#fafafa',
        borderRadius: '4px',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 24,
      }}
    >
      <span>总数量: <Typography.Text strong>{totalQuantity}</Typography.Text></span>
      <span>
        总金额:{' '}
        <Typography.Text strong type="danger">
          <AmountDisplay resource="sales_order" value={totalAmount} />
        </Typography.Text>
      </span>
    </div>
  );
};

const QuotationsPage: React.FC = () => {
  const { t } = useTranslation();
  const { token } = AntdTheme.useToken();
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const tableSearchFormRef = useRef<any>(null);
  const [listTotal, setListTotal] = useState(0);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [quotationDetail, setQuotationDetail] = useState<Quotation | null>(null);
  /** 抽屉外全链路悬浮窗：刷新追溯图（驱动 DocumentTraceFlowGraph refreshKey） */
  const [fullChainRefreshKey, setFullChainRefreshKey] = useState(0);
  const [fullChainTraceLoading, setFullChainTraceLoading] = useState(false);
  /** 抽屉外全链路浮层：点击关联节点后下半区展示该单据简览（默认不展示当前报价单本身） */
  const [fullChainBriefDoc, setFullChainBriefDoc] = useState<{ document_type: string; document_id: number } | null>(
    null
  );
  const quotationTracking = useDocumentTracking(
    detailDrawerVisible && quotationDetail ? 'quotation' : undefined,
    quotationDetail?.id
  );
  const quotationLifecycleDetail = useMemo(
    () => (quotationDetail ? getQuotationLifecycle(quotationDetail) : null),
    [quotationDetail],
  );
  const quotationNextSteps = quotationLifecycleDetail?.nextStepSuggestions;
  const hideQuotationStepperNextRow = Boolean(quotationNextSteps?.length);
  const showQuotationLifecycleNextInTitle =
    Boolean(quotationNextSteps?.length) && !quotationDetail?.conversion_downstream_missing;
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [pdfPreviewVisible, setPdfPreviewVisible] = useState(false);
  const [pdfPreviewBlobUrl, setPdfPreviewBlobUrl] = useState<string | null>(null);
  const [pdfPreviewFileName, setPdfPreviewFileName] = useState<string>('报价单.pdf');
  const [printModalVisible, setPrintModalVisible] = useState(false);
  const [printingRecord, setPrintingRecord] = useState<Quotation | null>(null);
  const [printTemplates, setPrintTemplates] = useState<PrintTemplate[]>([]);
  const [selectedPrintTemplateUuid, setSelectedPrintTemplateUuid] = useState<string | undefined>(undefined);
  const [printSubmitting, setPrintSubmitting] = useState(false);
  const [printVariablesPreview, setPrintVariablesPreview] = useState<Record<string, any> | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [effectiveRuleCode, setEffectiveRuleCode] = useState<string | null>(null);
  const [effectiveAutoGen, setEffectiveAutoGen] = useState<boolean | null>(null);
  const formRef = useRef<any>(null);
  const [customerList, setCustomerList] = useState<any[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [userList, setUserList] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [materialList, setMaterialList] = useState<any[]>([]);
  const [customerCreateVisible, setCustomerCreateVisible] = useState(false);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  /** 发货方式字典选项（数据字典 SHIPPING_METHOD） */
  const [shippingMethodOptions, setShippingMethodOptions] = useState<Array<{ label: string; value: string }>>([]);
  /** 付款条件字典选项（数据字典 PAYMENT_TERMS） */
  const [paymentTermsOptions, setPaymentTermsOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [followUpModalOpen, setFollowUpModalOpen] = useState(false);
  const [followUpPreset, setFollowUpPreset] = useState<CustomerFollowUpPreset | null>(null);
  /** 报价单详情内点击下游销售订单：二层只读抽屉 */
  const [linkedSalesOrderDrawerOpen, setLinkedSalesOrderDrawerOpen] = useState(false);
  const [linkedSalesOrder, setLinkedSalesOrder] = useState<SalesOrder | null>(null);
  const [linkedSalesOrderLoading, setLinkedSalesOrderLoading] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectingRecord, setRejectingRecord] = useState<Quotation | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState('');

  useEffect(() => {
    const load = async () => {
      setCustomersLoading(true);
      setUsersLoading(true);
      try {
        const [custRes, matRes, userRes] = await Promise.all([
          apiRequest<unknown>('/apps/master-data/supply-chain/customers', { params: { limit: 1000, is_active: true } }),
          apiRequest<unknown>('/apps/master-data/materials', { params: { limit: 1000, is_active: true } }),
          apiRequest<unknown>('/core/users', { params: { limit: 1000, is_active: true } }),
        ]);
        const custList = Array.isArray(custRes) ? custRes : (custRes as any)?.data ?? (custRes as any)?.items ?? [];
        const matList = Array.isArray(matRes) ? matRes : (matRes as any)?.data ?? (matRes as any)?.items ?? [];
        const usrList = Array.isArray(userRes) ? userRes : (userRes as any)?.data ?? (userRes as any)?.items ?? [];
        setCustomerList(Array.isArray(custList) ? custList : []);
        setMaterialList(Array.isArray(matList) ? matList : []);
        setUserList(Array.isArray(usrList) ? usrList : []);
      } catch {
        setCustomerList([]);
        setMaterialList([]);
        setUserList([]);
      } finally {
        setCustomersLoading(false);
        setUsersLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const loadShippingMethod = async () => {
      try {
        const dict = await getDataDictionaryByCode('SHIPPING_METHOD');
        const items = await getDictionaryItemList(dict.uuid, true);
        setShippingMethodOptions(
          items.sort((a, b) => a.sort_order - b.sort_order).map((it) => ({ label: it.label, value: it.value }))
        );
      } catch (e: any) {
        setShippingMethodOptions([]);
      }
    };
    const loadPaymentTerms = async () => {
      try {
        const dict = await getDataDictionaryByCode('PAYMENT_TERMS');
        const items = await getDictionaryItemList(dict.uuid, true);
        setPaymentTermsOptions(
          items.sort((a, b) => a.sort_order - b.sort_order).map((it) => ({ label: it.label, value: it.value }))
        );
      } catch (e: any) {
        setPaymentTermsOptions([]);
      }
    };
    loadShippingMethod();
    loadPaymentTerms();
  }, []);

  /** 高级搜索与列表列统一定义，避免 dataIndex 重复 */
  const columns: ProColumns<Quotation>[] = [
    {
      title: '报价单编号',
      dataIndex: 'quotation_code',
      width: 168,
      fixed: 'left',
      order: 10,
      fieldProps: { placeholder: '支持模糊匹配' },
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.quotation_code ?? '') }} ellipsis>
          {r.quotation_code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: t('app.kuaizhizao.quotation.colSeries'),
      dataIndex: 'quotation_series_code',
      width: 140,
      ellipsis: true,
      hideInSearch: true,
      order: 12,
      render: (_, r) => r.quotation_series_code || r.quotation_code || '-',
    },
    {
      title: t('app.kuaizhizao.quotation.colVersion'),
      dataIndex: 'version_no',
      width: 88,
      hideInSearch: true,
      order: 13,
      render: (_, r) => t('app.kuaizhizao.quotation.versionDisplay', { n: r.version_no ?? 1 }),
    },
    {
      title: '客户',
      dataIndex: 'customer_name',
      // 不设置 width 以便自适应响应式布局
      ellipsis: true,
      order: 20,
      fieldProps: { placeholder: '客户名称' },
    },
    {
      title: '报价日期',
      dataIndex: 'quotation_date',
      width: 110,
      valueType: 'date',
      hideInSearch: true,
    },
    {
      title: '报价日期范围',
      dataIndex: 'date_range',
      valueType: 'dateRange',
      hideInTable: true,
      fieldProps: { placeholder: ['开始日期', '结束日期'] },
      order: 30,
    },
    {
      title: '销售员',
      dataIndex: 'salesman_name',
      width: 100,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '总金额',
      dataIndex: 'total_amount',
      width: 110,
      align: 'right',
      hideInSearch: true,
      render: (_, r) => <AmountDisplay resource="sales_order" value={r.total_amount} />,
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueType: 'select',
      hideInTable: true,
      valueEnum: {
        草稿: { text: '草稿' },
        已发送: { text: '已发送' },
        已接受: { text: '已接受' },
        已拒绝: { text: '已拒绝' },
        已转订单: { text: '已转订单' },
      },
      order: 40,
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
      dataIndex: 'lifecycle',
      width: 132,
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getQuotationLifecycle(record);
        const activeStage = lifecycle.mainStages?.find((s) => s.status === 'active');
        const displayLabel = activeStage?.label ?? lifecycle.stageName;
        return (
          <UniLifecycle
            percent={lifecycle.percent}
            stageName={displayLabel}
            status={lifecycle.status}
            subStages={lifecycle.subStages}
            showLabel
            showCircleTooltip={false}
          />
        );
      },
    },
    {
      title: '操作',
      width: 400,
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => {
        const parts: React.ReactNode[] = [
          <Button key="d" type="link" size="small" onClick={() => handleDetail(record.id!)}>
            详情
          </Button>,
        ];
        const canEdit = record.status === '草稿';
        const deletable = canDeleteQuotation(record);
        parts.push(
          <Button key="e" type="link" size="small" disabled={!canEdit} onClick={() => canEdit && handleEdit(record)}>
            编辑
          </Button>
        );
        parts.push(
          <Button key="del" type="link" size="small" danger disabled={!deletable} onClick={() => deletable && handleDelete(record)}>
            删除
          </Button>
        );
        if (record.status === '草稿') {
          parts.push(
            <Button key="sub" type="link" size="small" onClick={() => handleSubmit(record)}>
              提交
            </Button>
          );
        }
        if (canWithdrawQuotation(record)) {
          parts.push(
            <Button key="w" type="link" size="small" onClick={() => handleWithdraw(record)}>
              撤回
            </Button>
          );
        }
        if (canApproveQuotation(record)) {
          parts.push(
            <Button key="ap" type="link" size="small" onClick={() => handleApprove(record)}>
              审核通过
            </Button>
          );
        }
        if (canRejectQuotation(record)) {
          parts.push(
            <Button key="rj" type="link" size="small" onClick={() => openRejectModal(record)}>
              驳回
            </Button>
          );
        }
        if (canRevokeReviewQuotation(record)) {
          parts.push(
            <Button key="rv" type="link" size="small" onClick={() => handleRevokeReview(record)}>
              撤回审核
            </Button>
          );
        }
        if (canConfirmCustomerQuotation(record)) {
          parts.push(
            <Button key="cc" type="link" size="small" onClick={() => handleConfirmCustomer(record)}>
              客户确认
            </Button>
          );
        }
        if (canReopenQuotation(record)) {
          parts.push(
            <Button key="ro" type="link" size="small" onClick={() => handleReopen(record)}>
              重新编辑
            </Button>
          );
        }
        {
          const convertible = canConvertQuotation(record);
          // 仅当 superseded_by_id 有值时才认为"真正被取代"，避免数据异常导致误判
          const superseded =
            record.is_latest_in_series === false &&
            record.superseded_by_id != null &&
            Number(record.superseded_by_id) > 0;
          const showConvert =
            convertible ||
            (superseded &&
              (record.status === '已接受' ||
                (record.status === '已发送' && isApprovedReview(record.review_status))));
          if (showConvert) {
            parts.push(
              <Tooltip
                key="cv"
                title={superseded ? '该报价单已有修订版，请从最新修订版转销售订单' : undefined}
              >
                <Button
                  type="link"
                  size="small"
                  disabled={superseded}
                  onClick={() => !superseded && handleConvert(record)}
                >
                  转销售订单
                </Button>
              </Tooltip>
            );
          }
        }
        if (canRevokePushQuotation(record)) {
          parts.push(
            <Button key="rp" type="link" size="small" onClick={() => handleRevokePush(record)}>
              撤回下推
            </Button>
          );
        }
        if (canCreateRevision(record)) {
          parts.push(
            <Button
              key="rev"
              type="link"
              size="small"
              onClick={() => handleRevision(record)}
            >
              {t('app.kuaizhizao.quotation.saveAsRevision')}
            </Button>
          );
        }
        parts.push(
          <Tooltip
            key="pr"
            title={
              canPrintFormalQuotation(record)
                ? t('app.kuaizhizao.quotation.formalPrint')
                : t('app.kuaizhizao.quotation.formalPrintDenied')
            }
          >
            <Button
              type="link"
              size="small"
              disabled={!canPrintFormalQuotation(record)}
              onClick={() => canPrintFormalQuotation(record) && handlePrint(record)}
            >
              {t('app.kuaizhizao.quotation.formalPrint')}
            </Button>
          </Tooltip>
        );
        if (record.customer_id != null && Number.isFinite(Number(record.customer_id))) {
          parts.push(
            <Button key="fu" type="link" size="small" onClick={() => openFollowUpFromQuotation(record)}>
              {t('app.kuaizhizao.customerFollowUp.addFollowUpFromDocument')}
            </Button>
          );
        }
        return renderQuotationRowActions(parts, `q-${record.id ?? 'row'}`);
      },
    },
  ];

  // columns 定义已合并

  const handleDetail = async (id: number) => {
    try {
      const res = await getQuotation(id);
      if (res) {
        setQuotationDetail(res);
        setDetailDrawerVisible(true);
      }
    } catch (e: any) {
      messageApi.error('获取报价单详情失败');
    }
  };

  const openFollowUpFromQuotation = (record: Quotation) => {
    const cid = record.customer_id;
    if (cid == null || !Number.isFinite(Number(cid))) {
      messageApi.warning(t('app.kuaizhizao.customerFollowUp.needCustomerForFollowUp'));
      return;
    }
    setFollowUpPreset({
      customer_id: Number(cid),
      quotation_id: record.id != null ? record.id : undefined,
      quotation_code: record.quotation_code ?? undefined,
    });
    setFollowUpModalOpen(true);
  };

  const handleEdit = async (record: Quotation) => {
    try {
      const detail = await getQuotation(record.id!, true);
      setQuotationDetail(detail);
      setEditingId(record.id!);
      setModalVisible(true);
      // Modal 使用 destroyOnHidden：挂载前 setFieldsValue 会丢。弹窗打开后再写入。
      const editValues = {
        quotation_code: detail.quotation_code,
        quotation_date: detail.quotation_date ? dayjs(detail.quotation_date) : undefined,
        valid_until: detail.valid_until ? dayjs(detail.valid_until) : undefined,
        delivery_date: detail.delivery_date ? dayjs(detail.delivery_date) : undefined,
        customer_id: detail.customer_id,
        customer_name: detail.customer_name,
        customer_contact: detail.customer_contact,
        customer_phone: detail.customer_phone,
        salesman_id: detail.salesman_id,
        salesman_name: detail.salesman_name,
        shipping_address: detail.shipping_address,
        shipping_method: detail.shipping_method,
        payment_terms: detail.payment_terms,
        currency_code: detail.currency_code ?? DEFAULT_QUOTATION_CURRENCY,
        notes: detail.notes,
        items: (detail.items || []).map((it) => ({
          material_id: it.material_id!,
          material_code: it.material_code || '',
          material_name: it.material_name || '',
          material_spec: it.material_spec,
          material_unit: it.material_unit || '',
          quote_quantity: Number(it.quote_quantity) || 0,
          unit_price: Number(it.unit_price) || 0,
          delivery_date: it.delivery_date ? dayjs(it.delivery_date) : undefined,
          notes: it.notes,
        })),
      };
      setTimeout(() => {
        formRef.current?.setFieldsValue(editValues);
      }, 50);
    } catch {
      messageApi.error('获取报价单详情失败');
    }
  };

  const handleDelete = (record: Quotation) => {
    Modal.confirm({
      title: '删除报价单',
      content: `确定要删除报价单 "${record.quotation_code}" 吗？`,
      onOk: async () => {
        try {
          await deleteQuotation(record.id!);
          messageApi.success('删除成功');
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '删除失败');
        }
      },
    });
  };

  const handleItemImport = (data: any[][]) => {
    const rows = data.slice(2);
    const newItems = rows
      .map((row) => {
        const materialCode = String(row[0] || '').trim();
        const spec = String(row[1] || '').trim();
        const unit = String(row[2] || '').trim();
        const quantity = parseFloat(row[3]) || 0;
        const price = parseFloat(row[4]) || 0;
        const deliveryDate = row[5];

        if (!materialCode) return null;

        const material = materialList.find((m: any) => (m.main_code ?? m.mainCode ?? m.code) === materialCode);
        
        return {
          material_id: material?.id ?? material?.material_id,
          material_code: material?.main_code ?? material?.mainCode ?? material?.code ?? materialCode,
          material_name: material?.name ?? material?.material_name ?? '',
          material_spec: material?.specification ?? material?.material_spec ?? spec,
          material_unit: material?.base_unit ?? material?.baseUnit ?? material?.material_unit ?? unit,
          quote_quantity: quantity,
          unit_price: price || material?.defaults?.defaultSalePrice || material?.default_sale_price || 0,
          delivery_date: deliveryDate ? (dayjs(deliveryDate).isValid() ? dayjs(deliveryDate) : undefined) : undefined,
        };
      })
      .filter((it): it is NonNullable<typeof it> => it !== null && (it.material_id !== undefined || it.material_code !== ''));

    if (newItems.length === 0) {
      messageApi.warning('未检测到有效数据（请确保物料编号不为空）');
      return;
    }

    const currentItems = formRef.current?.getFieldValue('items') || [];
    formRef.current?.setFieldsValue({
      items: [...currentItems, ...newItems],
    });
    messageApi.success(`成功导入 ${newItems.length} 条明细`);
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) return;
    Modal.confirm({
      title: '批量删除',
      content: `确定要删除选中的 ${keys.length} 条报价单吗？`,
      onOk: async () => {
        try {
          for (const k of keys) {
            await deleteQuotation(Number(k));
          }
          messageApi.success(`已删除 ${keys.length} 条报价单`);
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '批量删除失败');
        }
      },
    });
  };

  const handleBatchOperation = async (
    keys: React.Key[],
    actionName: string,
    action: (id: number) => Promise<any>
  ) => {
    if (keys.length === 0) return;
    let successCount = 0;
    let failedCount = 0;
    const failedItems: Array<{ id: number; error: string }> = [];
    for (const k of keys) {
      const id = Number(k);
      try {
        await action(id);
        successCount += 1;
      } catch (error: any) {
        failedCount += 1;
        failedItems.push({ id, error: error?.message || `${actionName}失败` });
      }
    }
    if (failedCount === 0) {
      messageApi.success(`${actionName}成功：${successCount} 条`);
    } else {
      messageApi.warning(`${actionName}完成：成功 ${successCount} 条，失败 ${failedCount} 条`);
      if (failedItems.length > 0) {
        console.error(`${actionName}失败详情:`, failedItems);
      }
    }
    invalidateMenuBadgeCounts();

    actionRef.current?.reload();
    setSelectedRowKeys([]);
  };

  const handleBatchSubmit = (keys: React.Key[]) =>
    handleBatchOperation(keys, '批量提交', (id) => submitQuotation(id));
  const handleBatchApprove = (keys: React.Key[]) =>
    handleBatchOperation(keys, '批量审核通过', (id) => approveQuotation(id));
  const handleBatchWithdraw = (keys: React.Key[]) =>
    handleBatchOperation(keys, '批量撤回', (id) => withdrawQuotation(id));
  const handleBatchReopen = (keys: React.Key[]) =>
    handleBatchOperation(keys, '批量重新编辑', (id) => reopenQuotation(id));

  const handleSyncConfirm = async (rows: Record<string, any>[]) => {
    try {
      let successCount = 0;
      for (const row of rows) {
        const payload: Partial<Quotation> = {
          quotation_code: row.quotation_code || row.quotationCode,
          quotation_date: row.quotation_date || row.quotationDate,
          customer_name: row.customer_name || row.customerName,
          total_amount: row.total_amount ?? row.totalAmount,
          status: row.status || '草稿',
          items: Array.isArray(row.items) ? row.items : [],
        };
        await createQuotation(payload);
        successCount += 1;
      }
      messageApi.success(`已同步 ${successCount} 条报价单`);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || '同步失败');
    }
  };

  /**
   * 处理列表页批量导入报价单
   * 导入格式：报价单编号, 客户名称, 报价日期, 物料编号, 数量, 单价, 交货日期, 备注
   * 同一报价单编号的多行会合并为一条报价单的多个明细
   */
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
      code: col('报价单编号') >= 0 ? col('报价单编号') : col('编号'),
      customer: col('客户名称') >= 0 ? col('客户名称') : col('客户'),
      date: col('报价日期') >= 0 ? col('报价日期') : col('日期'),
      material: col('物料编号') >= 0 ? col('物料编号') : col('物料'),
      qty: col('数量') >= 0 ? col('数量') : -1,
      price: col('单价') >= 0 ? col('单价') : -1,
      delivery: col('交货日期') >= 0 ? col('交货日期') : -1,
      notes: col('备注') >= 0 ? col('备注') : -1,
    };

    if (idx.customer < 0 || idx.date < 0 || idx.material < 0 || idx.qty < 0) {
      messageApi.error('缺少必需列：客户名称、报价日期、物料编号、数量');
      return;
    }

    const errors: Array<{ row: number; message: string }> = [];
    const groupMap = new Map<string, { code?: string; customer: string; date: string; items: any[] }>();

    rows.forEach((row: any[], i: number) => {
      const rowNum = i + 3;
      const customerName = (row[idx.customer] ?? '').toString().trim();
      const dateVal = (row[idx.date] ?? '').toString().trim();
      const materialCode = (row[idx.material] ?? '').toString().trim();
      const qtyVal = row[idx.qty];
      const qty = Number(qtyVal);
      if (!customerName) {
        errors.push({ row: rowNum, message: '客户名称不能为空' });
        return;
      }
      if (!dateVal) {
        errors.push({ row: rowNum, message: '报价日期不能为空' });
        return;
      }
      if (!materialCode) {
        errors.push({ row: rowNum, message: '物料编号不能为空' });
        return;
      }
      if (isNaN(qty) || qty <= 0) {
        errors.push({ row: rowNum, message: '数量必须大于0' });
        return;
      }

      const mat = materialList.find((m: any) => (m.mainCode || m.code || '').toUpperCase() === materialCode.toUpperCase());
      if (!mat) {
        errors.push({ row: rowNum, message: `未找到物料：${materialCode}` });
        return;
      }

      const code = idx.code >= 0 ? (row[idx.code] ?? '').toString().trim() : '';
      const price = idx.price >= 0 ? (Number(row[idx.price]) || 0) : 0;
      const delivery = idx.delivery >= 0 ? (row[idx.delivery] ?? '').toString().trim() : undefined;
      const notes = idx.notes >= 0 ? (row[idx.notes] ?? '').toString().trim() : undefined;

      const groupKey = code || `${customerName}|${dateVal}`;
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, { code: code || undefined, customer: customerName, date: dateVal, items: [] });
      }
      const g = groupMap.get(groupKey)!;
      g.items.push({
        material_id: mat.id,
        material_code: mat.mainCode || mat.code,
        material_name: mat.name,
        material_spec: mat.specification || '',
        material_unit: mat.baseUnit || '件',
        quote_quantity: qty,
        unit_price: price,
        delivery_date: delivery || undefined,
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
            <List
              size="small"
              dataSource={errors}
              renderItem={(item) => (
                <List.Item>
                  <Typography.Text type="danger">第 {item.row} 行：{item.message}</Typography.Text>
                </List.Item>
              )}
            />
          </div>
        ),
      });
      return;
    }

    const toImport: Partial<Quotation>[] = [];
    groupMap.forEach((g) => {
      const cust = customerList.find((c: any) => ((c.name || c.code || '').trim() === g.customer.trim()) || ((c.customer_name || '').trim() === g.customer.trim()));
      toImport.push({
        quotation_code: g.code,
        quotation_date: g.date,
        customer_id: cust?.id,
        customer_name: g.customer,
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
        importFn: async (item) => createQuotation(item),
        title: '正在导入报价单',
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
                <List
                  size="small"
                  dataSource={result.errors}
                  renderItem={(e) => (
                    <List.Item><Typography.Text type="danger">第 {e.row} 行：{e.error}</Typography.Text></List.Item>
                  )}
                />
              )}
            </div>
          ),
        });
      } else {
        messageApi.success(`成功导入 ${result.successCount} 条报价单`);
      }
      if (result.successCount > 0) {
        invalidateMenuBadgeCounts();

        actionRef.current?.reload();
      }
    } catch (error: any) {
      messageApi.error(error?.message || '导入失败');
    }
  };

  const handleConvert = (record: Quotation) => {
    Modal.confirm({
      title: '转为销售订单',
      content: `确定要将报价单 "${record.quotation_code}" 转为销售订单吗？转换后将创建新的销售订单并建立关联。`,
      onOk: async () => {
        try {
          const res = await convertQuotationToOrder(record.id!);
          messageApi.success(`已转为销售订单：${res.sales_order?.order_code || ''}`);
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
          setDetailDrawerVisible(false);
          setQuotationDetail(null);
        } catch (error: any) {
          messageApi.error(error.message || '转订单失败');
        }
      },
    });
  };

  const handleSubmit = (record: Quotation) => {
    Modal.confirm({
      title: '提交报价单',
      content: `确定提交报价单「${record.quotation_code || record.id}」？提交后状态将变为「已发送」；若业务蓝图要求审核，将进入待审核。`,
      onOk: async () => {
        try {
          const updated = await submitQuotation(record.id!);
          messageApi.success('提交成功');
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
          setQuotationDetail((prev) => (prev?.id === record.id ? updated : prev));
        } catch (error: any) {
          messageApi.error(error?.message || error?.detail || '提交失败');
        }
      },
    });
  };

  const handleWithdraw = (record: Quotation) => {
    Modal.confirm({
      title: '撤回报价单',
      content: `确定撤回「${record.quotation_code || record.id}」？将恢复为草稿，可继续编辑或删除。`,
      onOk: async () => {
        try {
          const updated = await withdrawQuotation(record.id!);
          messageApi.success('已撤回');
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
          setQuotationDetail((prev) => (prev?.id === record.id ? updated : prev));
        } catch (error: any) {
          messageApi.error(error?.message || error?.detail || '撤回失败');
        }
      },
    });
  };

  const openRejectModal = (record: Quotation) => {
    setRejectingRecord(record);
    setRejectRemarks('');
    setRejectModalOpen(true);
  };

  const submitReject = async () => {
    if (!rejectingRecord?.id) return;
    try {
      const updated = await rejectQuotation(rejectingRecord.id, {
        review_remarks: rejectRemarks.trim() || undefined,
      });
      messageApi.success('已驳回');
      setRejectModalOpen(false);
      setRejectingRecord(null);
      setRejectRemarks('');
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
      setQuotationDetail((prev) => (prev?.id === rejectingRecord.id ? updated : prev));
    } catch (e: any) {
      messageApi.error(e?.message || e?.detail || '驳回失败');
    }
  };

  const handleApprove = (record: Quotation) => {
    Modal.confirm({
      title: '审核通过',
      content: `确定审核通过报价单「${record.quotation_code || record.id}」？`,
      onOk: async () => {
        try {
          const updated = await approveQuotation(record.id!);
          messageApi.success('审核已通过');
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
          setQuotationDetail((prev) => (prev?.id === record.id ? updated : prev));
        } catch (e: any) {
          messageApi.error(e?.message || e?.detail || '操作失败');
        }
      },
    });
  };

  const handleRevokeReview = (record: Quotation) => {
    Modal.confirm({
      title: '撤回审核',
      content: '确定撤回审核？将回到待审核，需重新审核。',
      onOk: async () => {
        try {
          const updated = await revokeReviewQuotation(record.id!);
          messageApi.success('已撤回审核');
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
          setQuotationDetail((prev) => (prev?.id === record.id ? updated : prev));
        } catch (e: any) {
          messageApi.error(e?.message || e?.detail || '操作失败');
        }
      },
    });
  };

  const handleConfirmCustomer = (record: Quotation) => {
    Modal.confirm({
      title: '客户确认',
      content: '标记为「已接受」，表示报价已获客户认可，可继续下推销售订单。',
      onOk: async () => {
        try {
          const updated = await confirmCustomerQuotation(record.id!);
          messageApi.success('已标记客户确认');
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
          setQuotationDetail((prev) => (prev?.id === record.id ? updated : prev));
        } catch (e: any) {
          messageApi.error(e?.message || e?.detail || '操作失败');
        }
      },
    });
  };

  const handleReopen = (record: Quotation) => {
    Modal.confirm({
      title: '重新编辑',
      content: '将报价单恢复为草稿，修改后可再次提交。',
      onOk: async () => {
        try {
          const updated = await reopenQuotation(record.id!);
          messageApi.success('已恢复草稿');
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
          setQuotationDetail((prev) => (prev?.id === record.id ? updated : prev));
        } catch (e: any) {
          messageApi.error(e?.message || e?.detail || '操作失败');
        }
      },
    });
  };

  const handleRevokePush = (record: Quotation) => {
    Modal.confirm({
      title: '撤回下推',
      content: '解除与已删除销售订单的关联，恢复为「已接受」，可再次转销售订单。',
      onOk: async () => {
        try {
          const updated = await revokePushQuotation(record.id!);
          messageApi.success('已撤回下推');
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
          setQuotationDetail((prev) => (prev?.id === record.id ? updated : prev));
        } catch (e: any) {
          messageApi.error(e?.message || e?.detail || '操作失败');
        }
      },
    });
  };

  const handleRevision = (record: Quotation) => {
    Modal.confirm({
      title: t('app.kuaizhizao.quotation.saveAsRevision'),
      content: t('app.kuaizhizao.quotation.saveAsRevisionHint'),
      onOk: async () => {
        try {
          const created = await createQuotationRevision(record.id!);
          messageApi.success(
            `已创建新版本${created.quotation_code ? `：${created.quotation_code}` : ''}`
          );
          invalidateMenuBadgeCounts();
          actionRef.current?.reload();
          setQuotationDetail(created);
          setDetailDrawerVisible(true);
        } catch (e: any) {
          messageApi.error(e?.message || e?.detail || '操作失败');
        }
      },
    });
  };

  const handlePrint = async (record: Quotation) => {
    try {
      const templates = await getPrintTemplateList({
        is_active: true,
        document_type: 'quotation',
      });
      setPrintTemplates(templates || []);
      const defaultTpl = templates.find((t) => t.is_default) ?? templates[0];
      setSelectedPrintTemplateUuid(defaultTpl?.uuid);
    } catch {
      setPrintTemplates([]);
      setSelectedPrintTemplateUuid(undefined);
    }
    try {
      if (record.id != null) {
        const vars = await getQuotationPrintVariables(record.id);
        setPrintVariablesPreview(vars);
      } else {
        setPrintVariablesPreview(null);
      }
    } catch {
      setPrintVariablesPreview(null);
    }
    setPrintingRecord(record);
    setPrintModalVisible(true);
  };

  const handleConfirmPrint = async () => {
    const record = printingRecord;
    if (!record) return;
    const qid = record.id;
    if (qid == null) {
      messageApi.warning('报价单 ID 无效');
      return;
    }

    const safeCode = String(record.quotation_code || record.id || 'quotation').replace(
      /[/\\?%*:|"<>]/g,
      '-',
    );
    const fileName = `生成PDF报价_${safeCode}.pdf`;

    const openPdfPreview = (blobUrl: string) => {
      setPdfPreviewBlobUrl(blobUrl);
      setPdfPreviewFileName(fileName);
      setPdfPreviewVisible(true);
    };

    try {
      setPrintSubmitting(true);
      const result: DocumentPrintApiResult = await printQuotation(qid, {
        templateUuid: selectedPrintTemplateUuid,
        outputFormat: 'pdf',
        responseFormat: 'json',
      });
      const raw = result?.content || '';
      if (
        result?.content_encoding === 'base64' &&
        result?.mime_type === 'application/pdf' &&
        raw
      ) {
        const binary = atob(raw);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        openPdfPreview(blobUrl);
        setPrintModalVisible(false);
        setPrintingRecord(null);
        void recordQuotationPrint(qid).catch(() => undefined);
        messageApi.success('已打开预览');
        return;
      }
      messageApi.warning('打印内容为空');
    } catch (error: any) {
      messageApi.error(error.message || '打印失败');
    } finally {
      setPrintSubmitting(false);
    }
  };

  /**
   * 处理新建报价单
   * 参考销售订单：先打开弹窗，再请求 testGenerateCode 预填编号（不占用序号）
   */
  const defaultQuoteItem = { material_id: undefined, material_code: '', material_name: '', material_spec: '', material_unit: '件', quote_quantity: 1, unit_price: 0, delivery_date: undefined, notes: '' };

  const handleCreate = async () => {
    formRef.current?.resetFields();
    setEditingId(null);
    setPreviewCode(null);
    setEffectiveRuleCode(null);
    setEffectiveAutoGen(null);
    setModalVisible(true);
    setTimeout(() => {
      formRef.current?.setFieldsValue({ items: [defaultQuoteItem], currency_code: DEFAULT_QUOTATION_CURRENCY });
    }, 100);
    try {
      const config = await getCodeRulePageConfig('kuaizhizao-quotation');
      const autoGen = config?.autoGenerate ?? isAutoGenerateEnabled('kuaizhizao-quotation');
      const ruleCode = config?.ruleCode ?? getPageRuleCode('kuaizhizao-quotation');
      setEffectiveRuleCode(ruleCode ?? null);
      setEffectiveAutoGen(autoGen);
      if (autoGen && ruleCode) {
        try {
          const codeResponse = await testGenerateCode({ rule_code: ruleCode });
          const preview = codeResponse.code;
          setPreviewCode(preview ?? null);
          formRef.current?.setFieldsValue({ quotation_code: preview ?? '' });
        } catch (e) {
          console.warn('报价单编号预生成失败:', e);
          setPreviewCode(null);
        }
      } else {
        setPreviewCode(null);
      }
    } catch {
      const ruleCode = getPageRuleCode('kuaizhizao-quotation');
      setEffectiveRuleCode(ruleCode ?? null);
      setEffectiveAutoGen(isAutoGenerateEnabled('kuaizhizao-quotation'));
      if (isAutoGenerateEnabled('kuaizhizao-quotation') && ruleCode) {
        try {
          const codeResponse = await testGenerateCode({ rule_code: ruleCode });
          const preview = codeResponse.code;
          setPreviewCode(preview ?? null);
          formRef.current?.setFieldsValue({ quotation_code: preview ?? '' });
        } catch (e) {
          console.warn('报价单编号预生成失败:', e);
          setPreviewCode(null);
        }
      } else {
        setPreviewCode(null);
      }
    }
  };

  const submitCreate = async (values: any) => {
    const validItems = (values.items || []).filter((it: any) => it.material_id && it.quote_quantity > 0);
    if (!validItems.length) {
      messageApi.error('请至少添加一条有效明细（选择物料并填写数量）');
      throw new Error('请至少添加一条有效明细');
    }
    let quotationCode = values.quotation_code;
    const submitRuleCode = effectiveRuleCode || getPageRuleCode('kuaizhizao-quotation');
    const submitAutoEnabled = effectiveAutoGen ?? isAutoGenerateEnabled('kuaizhizao-quotation');
    if (submitAutoEnabled && submitRuleCode && (quotationCode === previewCode || !quotationCode)) {
      try {
        const codeResponse = await generateCode({ rule_code: submitRuleCode });
        quotationCode = codeResponse.code;
      } catch (e) {
        console.warn('报价单编号正式生成失败，使用当前值:', e);
      }
    }
    const cust = customerList.find((c: any) => (c.id ?? c.customer_id) === values.customer_id);
    const customerName = cust?.name ?? cust?.customer_name ?? values.customer_name ?? '';
    await createQuotation({
      quotation_code: quotationCode || undefined,
      quotation_date: toApiDateString(values.quotation_date),
      valid_until: toApiDateString(values.valid_until),
      delivery_date: toApiDateString(values.delivery_date),
      customer_id: values.customer_id,
      customer_name: customerName,
      customer_contact: values.customer_contact,
      customer_phone: values.customer_phone,
      salesman_id: values.salesman_id,
      salesman_name: values.salesman_name,
      shipping_address: values.shipping_address,
      shipping_method: values.shipping_method,
      payment_terms: values.payment_terms,
      currency_code: values.currency_code ?? DEFAULT_QUOTATION_CURRENCY,
      notes: values.notes,
      items: validItems.map((it: any) => ({
        material_id: it.material_id,
        material_code: it.material_code,
        material_name: it.material_name,
        material_spec: it.material_spec,
        material_unit: it.material_unit,
        quote_quantity: it.quote_quantity,
        unit_price: it.unit_price,
        delivery_date: toApiDateString(it.delivery_date),
        notes: it.notes,
      })),
    });
    messageApi.success('创建成功');
    setModalVisible(false);
    setEffectiveRuleCode(null);
    setEffectiveAutoGen(null);
    invalidateMenuBadgeCounts();

    actionRef.current?.reload();
  };

  const submitEdit = async (values: any) => {
    if (!editingId) return;
    const validItems = (values.items || []).filter((it: any) => it.material_id && it.quote_quantity > 0);
    if (!validItems.length) {
      messageApi.error('请至少添加一条有效明细');
      throw new Error('请至少添加一条有效明细');
    }
    const cust = customerList.find((c: any) => (c.id ?? c.customer_id) === values.customer_id);
    const customerName = cust?.name ?? cust?.customer_name ?? values.customer_name ?? '';
    await updateQuotation(editingId, {
      quotation_date: toApiDateString(values.quotation_date),
      valid_until: toApiDateString(values.valid_until),
      delivery_date: toApiDateString(values.delivery_date),
      customer_id: values.customer_id,
      customer_name: customerName,
      customer_contact: values.customer_contact,
      customer_phone: values.customer_phone,
      salesman_id: values.salesman_id,
      salesman_name: values.salesman_name,
      shipping_address: values.shipping_address,
      shipping_method: values.shipping_method,
      payment_terms: values.payment_terms,
      currency_code: values.currency_code ?? DEFAULT_QUOTATION_CURRENCY,
      notes: values.notes,
      items: validItems.map((it: any) => ({
        material_id: it.material_id,
        material_code: it.material_code,
        material_name: it.material_name,
        material_spec: it.material_spec,
        material_unit: it.material_unit,
        quote_quantity: it.quote_quantity,
        unit_price: it.unit_price,
        delivery_date: toApiDateString(it.delivery_date),
        notes: it.notes,
      })),
    });
    messageApi.success('更新成功');
    setModalVisible(false);
    setEditingId(null);
    setEffectiveRuleCode(null);
    setEffectiveAutoGen(null);
    invalidateMenuBadgeCounts();

    actionRef.current?.reload();
  };

  /** 详情-基本信息（平铺，与抽屉四区块一致） */
  const detailSummaryColumns: ProDescriptionsItemProps<Quotation>[] = [
    { title: '报价单编号', dataIndex: 'quotation_code' },
    {
      title: t('app.kuaizhizao.quotation.colSeries'),
      dataIndex: 'quotation_series_code',
      render: (_: unknown, r: Quotation) => r.quotation_series_code || r.quotation_code || '-',
    },
    {
      title: t('app.kuaizhizao.quotation.colVersion'),
      dataIndex: 'version_no',
      render: (_: unknown, r: Quotation) =>
        t('app.kuaizhizao.quotation.versionDisplay', { n: r.version_no ?? 1 }),
    },
    {
      title: t('app.kuaizhizao.quotation.colVersionState'),
      dataIndex: 'is_latest_in_series',
      render: (_: unknown, r: Quotation) =>
        r.is_latest_in_series === false ? (
          <Tag>{t('app.kuaizhizao.quotation.historyTag')}</Tag>
        ) : (
          <Tag color="blue">{t('app.kuaizhizao.quotation.latestTag')}</Tag>
        ),
    },
    { title: '客户', dataIndex: 'customer_name' },
    { title: '报价日期', dataIndex: 'quotation_date', valueType: 'date' },
    { title: '销售员', dataIndex: 'salesman_name' },
    {
      title: '总金额',
      dataIndex: 'total_amount',
      render: (_, r) => <AmountDisplay resource="sales_order" value={r.total_amount} />,
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (s) => {
        const c = STATUS_MAP[(s as string) || ''] || { text: (s as string) || '-', color: 'default' };
        return <Tag {...resolveStatusTagDisplayProps(c)}>{c.text}</Tag>;
      },
    },
    { title: '更新时间', dataIndex: 'updated_at', valueType: 'dateTime' },
  ];

  const detailCustomerDeliveryColumns: ProDescriptionsItemProps<Quotation>[] = [
    { title: '联系人', dataIndex: 'customer_contact' },
    { title: '电话', dataIndex: 'customer_phone' },
    { title: '有效期至', dataIndex: 'valid_until', valueType: 'date' },
    { title: '预计交货日期', dataIndex: 'delivery_date', valueType: 'date' },
    { title: '收货地址', dataIndex: 'shipping_address', span: 3 },
    {
      title: '发货方式',
      dataIndex: 'shipping_method',
      render: (_, record) => {
        const val = record.shipping_method;
        const opt = shippingMethodOptions.find((o) => o.value === val);
        return opt?.label ?? val ?? '-';
      },
    },
    {
      title: '付款条件',
      dataIndex: 'payment_terms',
      render: (_, record) => {
        const val = record.payment_terms;
        const opt = paymentTermsOptions.find((o) => o.value === val);
        return opt?.label ?? val ?? '-';
      },
    },
    {
      title: '币种',
      dataIndex: 'currency_code',
      render: (_: unknown, record: Quotation) => (
        <DictionaryLabel dictionaryCode="CURRENCY" value={record.currency_code || DEFAULT_QUOTATION_CURRENCY} />
      ),
    },
  ];

  const detailLinkNotesColumns: ProDescriptionsItemProps<Quotation>[] = [
    { title: '关联销售订单', dataIndex: 'sales_order_code' },
    { title: '备注', dataIndex: 'notes', span: 3 },
  ];

  const detailBasicColumns: ProDescriptionsItemProps<Quotation>[] = [
    ...detailSummaryColumns,
    ...detailCustomerDeliveryColumns,
    ...detailLinkNotesColumns,
  ];

  const openLinkedSalesOrderDrawer = useCallback(
    async (id: number) => {
      setLinkedSalesOrderDrawerOpen(true);
      setLinkedSalesOrder(null);
      setLinkedSalesOrderLoading(true);
      try {
        const data = await getSalesOrder(id, true, true);
        setLinkedSalesOrder(data);
      } catch (e: any) {
        messageApi.error(e?.message || e?.detail || '加载销售订单失败');
        setLinkedSalesOrderDrawerOpen(false);
      } finally {
        setLinkedSalesOrderLoading(false);
      }
    },
    [messageApi]
  );

  const onQuotationTrackingDocClick = useCallback(
    (type: string, id: number) => {
      if (type === 'sales_order' && id) {
        openLinkedSalesOrderDrawer(id);
      }
    },
    [openLinkedSalesOrderDrawer]
  );

  const onFullChainGraphNodeClick = useCallback(
    (type: string, id: number) => {
      if (!id) return;
      if (type === 'quotation' && quotationDetail?.id != null && id === quotationDetail.id) {
        setFullChainBriefDoc(null);
        return;
      }
      setFullChainBriefDoc({ document_type: type, document_id: id });
    },
    [quotationDetail?.id]
  );

  useEffect(() => {
    if (detailDrawerVisible && quotationDetail?.id != null) {
      setFullChainBriefDoc(null);
    }
  }, [detailDrawerVisible, quotationDetail?.id]);

  const closeLinkedSalesOrderDrawer = useCallback(() => {
    setLinkedSalesOrderDrawerOpen(false);
    setLinkedSalesOrder(null);
    setLinkedSalesOrderLoading(false);
  }, []);

  const appendQuotationItemsFromMaterials = useCallback(
    (selected: Material[]) => {
      const mainDelivery = formRef.current?.getFieldValue('delivery_date');
      const defaultDelivery =
        mainDelivery != null ? (dayjs.isDayjs(mainDelivery) ? mainDelivery : dayjs(mainDelivery)) : dayjs();
      const rowFromMaterial = (m: Material) => ({
        material_id: m.id,
        material_code: m.mainCode ?? m.code ?? '',
        material_name: m.name ?? '',
        material_spec: m.specification ?? '',
        material_unit: m.baseUnit ?? '',
        quote_quantity: 1,
        unit_price: (m as any).defaults?.defaultSalePrice ?? (m as any).default_sale_price ?? 0,
        delivery_date: defaultDelivery,
        notes: '',
      });
      const isEmptyItemRow = (row: any) => {
        if (row == null) return true;
        if (row.material_id != null && row.material_id !== '') return false;
        const code = row.material_code;
        return code == null || String(code).trim() === '';
      };
      const queue = selected.map(rowFromMaterial);
      const items = [...(formRef.current?.getFieldValue('items') ?? [])].map((row: any) => ({ ...row }));
      for (let i = 0; i < items.length && queue.length > 0; i++) {
        if (isEmptyItemRow(items[i])) {
          items[i] = queue.shift()!;
        }
      }
      while (queue.length > 0) {
        items.push(queue.shift()!);
      }
      formRef.current?.setFieldsValue({ items });
      messageApi.success(t('app.kuaizhizao.common.materialBatchAdded', { count: selected.length }));
    },
    [messageApi, t]
  );

  const formItemContent = (
    <>
      <Row gutter={16}>
        <Col span={12}>
          <ProFormText
            name="quotation_code"
            label="报价单编号"
            placeholder={isAutoGenerateEnabled('kuaizhizao-quotation') ? '编号将根据编号规则自动生成，可修改' : '请输入报价单编号'}
            fieldProps={{ disabled: !!editingId }}
            rules={[{ required: true, whitespace: true, message: '请输入报价单编号' }]}
          />
        </Col>
        <Col span={12}>
          <ProForm.Item
            name="customer_id"
            label={
              <span>
                客户名称
                <a
                  href="/apps/master-data/supply-chain/customers"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/apps/master-data/supply-chain/customers');
                  }}
                  style={{ marginLeft: 8, fontSize: 12 }}
                >
                  客户信息管理
                </a>
              </span>
            }
            rules={[{ required: true, message: '请选择客户' }]}
          >
            <UniDropdown
              placeholder="请选择客户"
              showSearch
              allowClear
              loading={customersLoading}
              style={{ width: '100%' }}
              options={customerList.map((c: any) => ({
                value: c.id ?? c.customer_id,
                label: `${c.code ?? c.customer_code ?? ''} - ${c.name ?? c.customer_name ?? ''}`.trim() || String(c.id ?? c.customer_id),
              }))}
              onChange={(value, _option: any) => {
                const c = customerList.find((x: any) => (x.id ?? x.customer_id) === value);
                if (c) {
                  const sId = c.salesmanId ?? c.salesman_id;
                  const salesman = userList.find((u) => u.id === sId);
                  const sName = c.salesmanName ?? c.salesman_name ?? (salesman ? (salesman.full_name || salesman.username) : '');
                  formRef.current?.setFieldsValue({
                    customer_name: c.name ?? c.customer_name,
                    customer_contact: c.contactPerson ?? c.contact_person ?? c.contact ?? c.customer_contact,
                    customer_phone: c.phone ?? c.customer_phone,
                    salesman_id: sId,
                    salesman_name: sName,
                  });
                }
              }}
              quickCreate={{
                label: '快速新建',
                onClick: () => setCustomerCreateVisible(true),
              }}
              advancedSearch={{
                label: '高级搜索',
                fields: [
                  { name: 'code', label: '客户编号' },
                  { name: 'name', label: '客户名称' },
                  { name: 'contactPerson', label: '联系人' },
                ],
                onSearch: async (values) => {
                  let list: any[] = [];
                  try {
                    const res = await customerApi.list({ limit: 200, skip: 0 });
                    list = Array.isArray(res) ? res : (res as any)?.data ?? (res as any)?.items ?? [];
                  } catch {
                    return [];
                  }
                  let filtered = list;
                  if (values.code?.trim()) {
                    const k = values.code.trim().toLowerCase();
                    filtered = filtered.filter((c: any) => (c.code ?? '').toLowerCase().includes(k));
                  }
                  if (values.name?.trim()) {
                    const k = values.name.trim().toLowerCase();
                    filtered = filtered.filter((c: any) => (c.name ?? '').toLowerCase().includes(k));
                  }
                  if (values.contactPerson?.trim()) {
                    const k = values.contactPerson.trim().toLowerCase();
                    filtered = filtered.filter((c: any) => (c.contactPerson ?? '').toLowerCase().includes(k));
                  }
                  return filtered.map((c: any) => ({
                    value: c.id ?? c.uuid,
                    label: `${c.code ?? ''} - ${c.name ?? ''}`.trim() || String(c.id ?? c.uuid),
                  }));
                },
              }}
            />
          </ProForm.Item>
        </Col>
      </Row>
      {/* 归属业务员 + 日期 + 发货方式：五列等分（各约 20%） */}
      <Row gutter={16}>
        <Col flex={1} style={{ minWidth: 0 }}>
          <ProForm.Item name="salesman_id" label="归属业务员">
            <UniDropdown
              placeholder="请选择归属业务员"
              showSearch
              allowClear
              loading={usersLoading}
              style={{ width: '100%' }}
              options={userList.map((u: any) => ({
                value: u.id,
                label: u.full_name || u.username,
              }))}
              onChange={(_val, opt: any) => {
                formRef.current?.setFieldsValue({ salesman_name: opt?.label });
              }}
            />
          </ProForm.Item>
          <Form.Item name="salesman_name" hidden>
            <Input />
          </Form.Item>
        </Col>
        <Col flex={1} style={{ minWidth: 0 }}>
          <ProFormDatePicker
            name="quotation_date"
            label="报价日期"
            rules={[{ required: true }]}
            fieldProps={{ style: { width: '100%' } }}
          />
        </Col>
        <Col flex={1} style={{ minWidth: 0 }}>
          <ProFormDatePicker
            name="valid_until"
            label="有效期至"
            fieldProps={{ style: { width: '100%' } }}
          />
        </Col>
        <Col flex={1} style={{ minWidth: 0 }}>
          <ProFormDatePicker
            name="delivery_date"
            label="预计交货日期"
            fieldProps={{ style: { width: '100%' } }}
          />
        </Col>
        <Col flex={1} style={{ minWidth: 0 }}>
          <DictionarySelect
            dictionaryCode="SHIPPING_METHOD"
            name="shipping_method"
            label="发货方式"
            placeholder="请选择发货方式"
            formRef={formRef}
          />
        </Col>
      </Row>
      {/* 联系人 1/6 · 电话 1/6 · 地址 1/3 · 付款条件 1/6 · 币种 1/6 */}
      <Row gutter={16}>
        <Col span={4}>
          <ProFormText name="customer_contact" label="联系人" />
        </Col>
        <Col span={4}>
          <ProFormText name="customer_phone" label="联系人电话" />
        </Col>
        <Col span={8}>
          <ProFormText name="shipping_address" label="收货地址" placeholder="请输入收货地址" />
        </Col>
        <Col span={4}>
          <DictionarySelect
            dictionaryCode="PAYMENT_TERMS"
            name="payment_terms"
            label="付款条件"
            placeholder="请选择付款条件"
            formRef={formRef}
          />
        </Col>
        <Col span={4}>
          <DictionarySelect
            dictionaryCode="CURRENCY"
            name="currency_code"
            label="币种"
            placeholder="请选择币种"
            formRef={formRef}
            initialValue={DEFAULT_QUOTATION_CURRENCY}
          />
        </Col>
      </Row>
      <ProFormText name="customer_name" hidden />

      <div className="uni-table-detail">
        <div className="uni-table-detail-header">
          <span className="detail-title">
            <span className="required-mark">*</span>
            物料明细
          </span>
          <div className="uni-table-detail-header-actions">
            <Button type="default" size="small" icon={<ImportOutlined />} onClick={() => setImportModalVisible(true)}>
              导入明细
            </Button>
          </div>
        </div>
        {/* 与销售订单一致：Form.Item(noStyle) + Form.List + Table；勿再套一层 ProForm.Item 同名 items */}
        <Form.Item
          name="items"
          noStyle
          rules={[{ type: 'array' as const, min: 1, message: '请至少添加一条明细' }]}
        >
          <Form.List name="items">
            {(fields, { add, remove }) => {
              const quotationDetailColumns = [
                {
                  title: '物料',
                  dataIndex: 'material_id',
                  width: 260,
                  render: (_: unknown, __: unknown, index: number) => (
                    <QuotationMaterialSelectCell index={index} />
                  ),
                },
                {
                  title: '规格',
                  dataIndex: 'material_spec',
                  width: 120,
                  render: (_: unknown, __: unknown, index: number) => (
                    <Form.Item name={[index, 'material_spec']} style={{ margin: 0 }}>
                      <Input placeholder="规格" size="small" />
                    </Form.Item>
                  ),
                },
                {
                  title: '单位',
                  dataIndex: 'material_unit',
                  width: 100,
                  render: (_: unknown, __: unknown, index: number) => (
                    <Form.Item
                      noStyle
                      shouldUpdate={(prev: any, curr: any) =>
                        prev?.items?.[index]?.material_id !==
                        curr?.items?.[index]?.material_id
                      }
                    >
                      {({ getFieldValue }) => {
                        const materialId = getFieldValue(['items', index, 'material_id']);
                        return (
                          <Form.Item name={[index, 'material_unit']} style={{ margin: 0 }}>
                            <MaterialUnitSelect materialId={materialId} size="small" noStyle />
                          </Form.Item>
                        );
                      }}
                    </Form.Item>
                  ),
                },
                {
                  title: '数量',
                  dataIndex: 'quote_quantity',
                  width: 100,
                  align: 'right' as const,
                  render: (_: unknown, __: unknown, index: number) => (
                    <Form.Item
                      name={[index, 'quote_quantity']}
                      rules={[{ required: true, message: '必填' }]}
                      style={{ margin: 0 }}
                    >
                      <InputNumber placeholder="数量" min={0.01} precision={2} style={{ width: '100%' }} size="small" />
                    </Form.Item>
                  ),
                },
                {
                  title: '单价',
                  dataIndex: 'unit_price',
                  width: 100,
                  align: 'right' as const,
                  render: (_: unknown, __: unknown, index: number) => (
                    <Form.Item name={[index, 'unit_price']} style={{ margin: 0 }}>
                      <InputNumber placeholder="单价" min={0} precision={2} prefix="¥" style={{ width: '100%' }} size="small" />
                    </Form.Item>
                  ),
                },
                {
                  title: '金额',
                  width: 120,
                  align: 'right' as const,
                  render: (_: unknown, __: unknown, index: number) => <QuotationAmountCell index={index} />,
                },
                {
                  title: '交货日期',
                  dataIndex: 'delivery_date',
                  width: 130,
                  render: (_: unknown, __: unknown, index: number) => (
                    <Form.Item name={[index, 'delivery_date']} style={{ margin: 0 }}>
                      <DatePicker size="small" style={{ width: '100%' }} format="YYYY-MM-DD" />
                    </Form.Item>
                  ),
                },
                {
                  title: '备注',
                  dataIndex: 'notes',
                  width: 120,
                  render: (_: unknown, __: unknown, index: number) => (
                    <Form.Item name={[index, 'notes']} style={{ margin: 0 }}>
                      <Input placeholder="备注" size="small" />
                    </Form.Item>
                  ),
                },
                {
                  title: '操作',
                  width: 70,
                  fixed: 'right' as const,
                  onHeaderCell: () => ({ className: 'quotation-fixed-op-header' }),
                  render: (_: unknown, __: unknown, index: number) => (
                    <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(index)}>
                      删除
                    </Button>
                  ),
                },
              ];
              const totalWidth = quotationDetailColumns.reduce((s, c) => s + (Number(c.width) || 0), 0);
              return (
                <div style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                  <style>{`
                    .quotation-detail-table .ant-table-thead > tr > th {
                      background-color: var(--ant-color-fill-alter) !important;
                      font-weight: 600;
                    }
                    .quotation-detail-table .ant-table-thead > tr > th.quotation-fixed-op-header {
                      background: var(--ant-color-fill-alter) !important;
                    }
                    .quotation-detail-table .ant-table-cell-fix-right {
                      background: var(--ant-color-bg-container) !important;
                    }
                    .quotation-detail-table .ant-table {
                      border-top: 1px solid var(--ant-color-border);
                    }
                    .quotation-detail-table .ant-table-tbody > tr > td {
                      border-bottom: 1px solid var(--ant-color-border);
                      overflow: visible !important;
                    }
                    .quotation-detail-table .quotation-material-cell .ant-form-item,
                    .quotation-detail-table .quotation-material-cell .ant-form-item-control,
                    .quotation-detail-table .quotation-material-cell .ant-form-item-control-input,
                    .quotation-detail-table .quotation-material-cell .ant-select {
                      width: 100% !important;
                      min-width: 0;
                    }
                    .quotation-detail-table .ant-form-item-explain,
                    .quotation-detail-table .ant-form-item-explain-error {
                      display: none !important;
                    }
                    .quotation-detail-table .ant-input-number-input::selection,
                    .quotation-detail-table .ant-input::selection {
                      background-color: var(--ant-color-primary);
                      color: #fff;
                      border-radius: 0;
                    }
                  `}</style>
                  <div style={{ width: '100%', overflowX: 'auto' }}>
                    <Table
                      className="quotation-detail-table"
                      size="small"
                      dataSource={fields.map((f, i) => ({ ...f, key: f.key ?? i }))}
                      rowKey="key"
                      pagination={false}
                      columns={quotationDetailColumns}
                      scroll={fields.length > 0 ? { x: totalWidth } : undefined}
                      style={{ width: '100%', margin: 0 }}
                      footer={() => (
                        <div
                          style={{
                            display: 'flex',
                            gap: 8,
                            width: '100%',
                            flexWrap: 'wrap',
                            boxSizing: 'border-box',
                          }}
                        >
                          <Button
                            type="dashed"
                            icon={<PlusOutlined />}
                            style={{ flex: 1, minWidth: 120 }}
                            onClick={() => {
                              add({
                                material_id: undefined,
                                material_code: '',
                                material_name: '',
                                material_spec: '',
                                material_unit: '',
                                quote_quantity: 1,
                                unit_price: 0,
                                delivery_date: undefined,
                                notes: '',
                              });
                            }}
                          >
                            添加明细
                          </Button>
                          <Button
                            type="default"
                            icon={<AppstoreAddOutlined />}
                            style={{ flex: 1, minWidth: 120 }}
                            onClick={() => setMaterialPickerOpen(true)}
                          >
                            {t('app.kuaizhizao.common.materialBatchSelect')}
                          </Button>
                        </div>
                      )}
                    />
                  </div>
                </div>
              );
            }}
          </Form.List>
        </Form.Item>
      </div>
      <QuotationFormSummary />
      <ProFormTextArea name="notes" label="备注" fieldProps={{ rows: 2 }} />
      <MaterialBatchPickerModal
        open={materialPickerOpen}
        onCancel={() => setMaterialPickerOpen(false)}
        onConfirm={appendQuotationItemsFromMaterials}
      />
    </>
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          headerTitle="报价单"
          formRef={tableSearchFormRef}
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          toolBarButtonSize="middle"
          showCreateButton
          createButtonText="新建报价单"
          onCreate={handleCreate}
          enableRowSelection
          toolBarRender={() => [
            <Space.Compact key={`batch-btn-${selectedRowKeys.length}`}>
              <Button
                disabled={selectedRowKeys.length === 0}
                danger
                onClick={() => handleBatchDelete(selectedRowKeys)}
              >
                <DeleteOutlined /> 批量删除
              </Button>
              <Dropdown
                disabled={selectedRowKeys.length === 0}
                trigger={['click']}
                menu={{
                  items: [
                    {
                      key: 'submit',
                      label: '批量提交',
                      icon: <SendOutlined />,
                      onClick: () => handleBatchSubmit(selectedRowKeys),
                    },
                    {
                      key: 'approve',
                      label: '批量审核通过',
                      icon: <CheckOutlined />,
                      onClick: () => handleBatchApprove(selectedRowKeys),
                    },
                    {
                      key: 'withdraw',
                      label: '批量撤回',
                      icon: <RollbackOutlined />,
                      onClick: () => handleBatchWithdraw(selectedRowKeys),
                    },
                    {
                      key: 'reopen',
                      label: '批量重新编辑',
                      icon: <EditOutlined />,
                      onClick: () => handleBatchReopen(selectedRowKeys),
                    },
                  ],
                }}
              >
                <Button danger icon={<ArrowDownOutlined />} />
              </Dropdown>
            </Space.Compact>,
          ]}
          showImportButton={true}
          onImport={handleListImport}
          importHeaders={['报价单编号', '客户名称', '报价日期', '物料编号', '数量', '单价', '交货日期', '备注']}
          importExampleRow={['QT001', '客户A', '2025-03-08', 'MAT001', '10', '100', '2025-04-01', '']}
          importFieldMap={{
            '报价单编号': 'quotation_code',
            '客户名称': 'customer_name',
            '报价日期': 'quotation_date',
            '物料编号': 'material_code',
            '数量': 'quote_quantity',
            '单价': 'unit_price',
            '交货日期': 'delivery_date',
            '备注': 'notes',
          }}
          importFieldRules={{
            customer_name: { required: true },
            quotation_date: { required: true },
            material_code: { required: true },
            quote_quantity: { required: true },
          }}
          showExportButton
          onExport={async (type, keys, pageData) => {
            try {
              const res = await listQuotations({ skip: 0, limit: 10000 });
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
              a.download = `quotations-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(`已导出 ${items.length} 条记录`);
            } catch (error: any) {
              messageApi.error(error?.message || '导出失败');
            }
          }}
          showSyncButton
          onSync={() => setSyncModalVisible(true)}
          request={async (params, _sort, _filter, searchFormValues) => {
            try {
              const dr = searchFormValues?.date_range as [unknown, unknown] | undefined;
              let startDate: string | undefined;
              let endDate: string | undefined;
              if (dr && Array.isArray(dr) && dr[0]) {
                startDate = dayjs(dr[0] as string | Date).format('YYYY-MM-DD');
                endDate = dr[1] ? dayjs(dr[1] as string | Date).format('YYYY-MM-DD') : startDate;
              }
              const response = await listQuotations({
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                status: searchFormValues?.status,
                keyword: searchFormValues?.keyword,
                quotation_code: searchFormValues?.quotation_code,
                customer_name: searchFormValues?.customer_name,
                start_date: startDate,
                end_date: endDate,
              });
              setListTotal(response.total ?? 0);
              return {
                data: response.data || [],
                success: true,
                total: response.total ?? 0,
              };
            } catch {
              messageApi.error('获取报价单列表失败');
              setListTotal(0);
              return { data: [], success: false, total: 0 };
            }
          }}
          scroll={{ x: 1280 }}
        />
      </ListPageTemplate>

      {detailDrawerVisible && quotationDetail ? (
        <>
          <div
            role="complementary"
            aria-label={t('components.documentTrackingPanel.relationsFullChainTitle')}
            style={{
              position: 'fixed',
              left: QUOTATION_FULL_CHAIN_FLOAT_MARGIN,
              top: QUOTATION_FULL_CHAIN_FLOAT_MARGIN,
              width: quotationChainPanelWidthCss,
              height: quotationChainHalfHeightCss,
              zIndex: QUOTATION_FULL_CHAIN_OVERLAY_Z_INDEX,
              boxSizing: 'border-box',
              padding: 16,
              borderRadius: token.borderRadiusLG,
              background: 'var(--ant-color-bg-container)',
              borderRight: '1px solid var(--ant-color-border)',
              borderBottom: '1px solid var(--ant-color-border)',
              boxShadow: 'var(--ant-box-shadow-secondary)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div style={{ flexShrink: 0, marginBottom: 8 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 13,
                      color: 'var(--ant-color-text)',
                    }}
                  >
                    {t('components.documentTrackingPanel.relationsFullChainTitle')}
                  </div>
                </div>
                <Button
                  type="default"
                  size="small"
                  icon={<ReloadOutlined />}
                  loading={fullChainTraceLoading}
                  style={{ flexShrink: 0 }}
                  onClick={() => setFullChainRefreshKey((k) => k + 1)}
                >
                  {t('components.documentRelationGraph.refresh')}
                </Button>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <DocumentTrackingRelationsTabsBody
                documentType="quotation"
                documentId={quotationDetail.id}
                refreshKey={fullChainRefreshKey}
                onDocumentClick={onFullChainGraphNodeClick}
                compact
                hideInlineRefresh
                onTraceLoadingChange={setFullChainTraceLoading}
              />
            </div>
          </div>

          <div
            role="complementary"
            aria-label={t('components.documentTrackingPanel.traceBriefTitle')}
            style={{
              position: 'fixed',
              left: QUOTATION_FULL_CHAIN_FLOAT_MARGIN,
              top: quotationBriefPanelTopCss,
              width: quotationChainPanelWidthCss,
              height: quotationChainHalfHeightCss,
              zIndex: QUOTATION_FULL_CHAIN_OVERLAY_Z_INDEX,
              boxSizing: 'border-box',
              padding: 16,
              borderRadius: token.borderRadiusLG,
              background: 'var(--ant-color-bg-container)',
              borderRight: '1px solid var(--ant-color-border)',
              borderBottom: '1px solid var(--ant-color-border)',
              boxShadow: 'var(--ant-box-shadow-secondary)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                fontWeight: 600,
                fontSize: 13,
                marginBottom: 8,
                flexShrink: 0,
                color: 'var(--ant-color-text)',
              }}
            >
              {t('components.documentTrackingPanel.traceBriefTitle')}
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              <TraceLinkedDocumentBrief
                documentType={fullChainBriefDoc?.document_type}
                documentId={fullChainBriefDoc?.document_id}
                compactChrome
              />
            </div>
            {fullChainBriefDoc ? (
              <div
                style={{
                  flexShrink: 0,
                  marginTop: 8,
                  paddingTop: 10,
                  borderTop: '1px solid var(--ant-color-border)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                }}
              >
                <Space wrap>
                  <Button onClick={() => setFullChainBriefDoc(null)}>
                    {t('components.documentTrackingPanel.traceBriefDismiss')}
                  </Button>
                  {fullChainBriefDoc.document_type === 'sales_order' ? (
                    <Button
                      type="primary"
                      onClick={() => openLinkedSalesOrderDrawer(fullChainBriefDoc.document_id)}
                    >
                      {t('components.documentTrackingPanel.traceBriefOpenSalesOrder')}
                    </Button>
                  ) : null}
                </Space>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      <DetailDrawerTemplate
        title={`报价单详情${quotationDetail?.quotation_code ? ` - ${quotationDetail.quotation_code}` : ''}`}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setQuotationDetail(null);
          setFullChainBriefDoc(null);
          closeLinkedSalesOrderDrawer();
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        extra={
          quotationDetail && (
            <Space wrap>
              {quotationDetail.status === '草稿' && (
                <Button icon={<SendOutlined />} onClick={() => handleSubmit(quotationDetail)}>提交</Button>
              )}
              {canWithdrawQuotation(quotationDetail) && (
                <Button icon={<RollbackOutlined />} onClick={() => handleWithdraw(quotationDetail)}>撤回</Button>
              )}
              {canApproveQuotation(quotationDetail) && (
                <Button icon={<CheckOutlined />} onClick={() => handleApprove(quotationDetail)}>审核通过</Button>
              )}
              {canRejectQuotation(quotationDetail) && (
                <Button icon={<CloseCircleOutlined />} onClick={() => openRejectModal(quotationDetail)}>驳回</Button>
              )}
              {canRevokeReviewQuotation(quotationDetail) && (
                <Button icon={<UndoOutlined />} onClick={() => handleRevokeReview(quotationDetail)}>撤回审核</Button>
              )}
              {canConfirmCustomerQuotation(quotationDetail) && (
                <Button icon={<SendOutlined />} onClick={() => handleConfirmCustomer(quotationDetail)}>客户确认</Button>
              )}
              {canReopenQuotation(quotationDetail) && (
                <Button icon={<EditOutlined />} onClick={() => handleReopen(quotationDetail)}>重新编辑</Button>
              )}
              {canDeleteQuotation(quotationDetail) && (
                <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(quotationDetail)}>删除</Button>
              )}
              {canConvertQuotation(quotationDetail) && (
                <Button type="primary" icon={<SwapOutlined />} onClick={() => handleConvert(quotationDetail)}>转销售订单</Button>
              )}
              {canRevokePushQuotation(quotationDetail) && (
                <Button icon={<RollbackOutlined />} onClick={() => handleRevokePush(quotationDetail)}>撤回下推</Button>
              )}
              {canCreateRevision(quotationDetail) && (
                <Button icon={<BranchesOutlined />} onClick={() => handleRevision(quotationDetail)}>
                  {t('app.kuaizhizao.quotation.saveAsRevision')}
                </Button>
              )}
              <Tooltip
                title={
                  canPrintFormalQuotation(quotationDetail)
                    ? t('app.kuaizhizao.quotation.formalPrint')
                    : t('app.kuaizhizao.quotation.formalPrintDenied')
                }
              >
                <Button
                  icon={<PrinterOutlined />}
                  disabled={!canPrintFormalQuotation(quotationDetail)}
                  onClick={() =>
                    canPrintFormalQuotation(quotationDetail) && handlePrint(quotationDetail)
                  }
                >
                  {t('app.kuaizhizao.quotation.formalPrint')}
                </Button>
              </Tooltip>
            </Space>
          )
        }
        basic={
          quotationDetail ? (
            <Descriptions
              column={3}
              size="small"
              items={buildDescriptionItemsFromColumns(quotationDetail, detailBasicColumns)}
            />
          ) : undefined
        }
        collaborationTitleSuffix={
          showQuotationLifecycleNextInTitle ? (
            <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
              {t('components.uniLifecycle.nextStep')}：
              {quotationNextSteps!.join(t('components.uniLifecycle.nextStepSeparator'))}
            </Typography.Text>
          ) : undefined
        }
        collaborationMetrics={
          quotationDetail &&
          quotationDetail.conversion_downstream_missing &&
          quotationNextSteps?.length ? (
            <Alert
              type="warning"
              showIcon
              message="下游销售订单已不存在"
              description={quotationNextSteps.join('；')}
            />
          ) : undefined
        }
        collaborationLifecycle={
          quotationDetail && quotationLifecycleDetail
            ? (() => {
                const lifecycle = quotationLifecycleDetail;
                const mainStages = lifecycle.mainStages ?? [];
                const subStages = lifecycle.subStages ?? [];
                if (mainStages.length === 0 && subStages.length === 0) return undefined;
                return (
                  <>
                    {mainStages.length > 0 && (
                      <UniLifecycleStepper
                        steps={mainStages}
                        status={lifecycle.status}
                        showLabels
                        nextStepSuggestions={lifecycle.nextStepSuggestions}
                        hideNextStepSuggestions={hideQuotationStepperNextRow}
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
                  </>
                );
              })()
            : undefined
        }
        lines={
          quotationDetail ? (
            <>
              {/*
                横滚仅在外层；内层表体覆盖 global.less 的 overflow-x:auto 以免出现竖向滚动条。
                外层 overflow-x:auto + overflow-y:hidden，避免同元素 visible/auto 配对问题。
              */}
              <style>{`
                .quotation-detail-drawer-items .ant-table-wrapper .ant-table-body,
                .quotation-detail-drawer-items .ant-table-wrapper .ant-table-content {
                  overflow: visible !important;
                }
              `}</style>
              {quotationDetail.items && quotationDetail.items.length > 0 ? (
                <div
                  className="quotation-detail-drawer-items"
                  style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', overflowY: 'hidden' }}
                >
                  <Table
                    size="small"
                    rowKey="id"
                    tableLayout="fixed"
                    style={{ minWidth: QUOTATION_DETAIL_ITEMS_SCROLL_X }}
                    columns={[
                      { title: '物料编号', dataIndex: 'material_code', width: 120, ellipsis: true },
                      { title: '物料名称', dataIndex: 'material_name', width: 160, ellipsis: true },
                      { title: '规格', dataIndex: 'material_spec', width: 120, ellipsis: true },
                      {
                        title: '单位',
                        dataIndex: 'material_unit',
                        width: 72,
                        ellipsis: true,
                        render: (v: string) => <DictionaryLabel dictionaryCode="MATERIAL_UNIT" value={v} />,
                      },
                      { title: '报价数量', dataIndex: 'quote_quantity', width: 100, align: 'right' },
                      {
                        title: '单价',
                        dataIndex: 'unit_price',
                        width: 100,
                        align: 'right',
                        render: (v: number) => <AmountDisplay resource="sales_order" value={v} />,
                      },
                      {
                        title: '金额',
                        dataIndex: 'total_amount',
                        width: 100,
                        align: 'right',
                        render: (v: number) => <AmountDisplay resource="sales_order" value={v} />,
                      },
                      { title: '交货日期', dataIndex: 'delivery_date', width: 120, ellipsis: true },
                      { title: '备注', dataIndex: 'notes', width: 160, ellipsis: true },
                    ]}
                    dataSource={quotationDetail.items}
                    pagination={false}
                  />
                </div>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无明细" />
              )}
            </>
          ) : undefined
        }
        timeline={
          quotationDetail?.id != null ? (
            <>
              {quotationTracking.loading && (
                <div style={{ textAlign: 'center', padding: 24 }}>
                  <Spin />
                </div>
              )}
              {quotationTracking.error && !quotationTracking.loading && (
                <Typography.Text type="danger">{quotationTracking.error}</Typography.Text>
              )}
              {quotationTracking.data && !quotationTracking.loading && (
                <DocumentTrackingTimelineBody data={quotationTracking.data} />
              )}
            </>
          ) : undefined
        }
      />

      <DetailDrawerTemplate
        title={`销售订单详情${linkedSalesOrder?.order_code ? ` - ${linkedSalesOrder.order_code}` : ''}`}
        open={linkedSalesOrderDrawerOpen}
        onClose={closeLinkedSalesOrderDrawer}
        width={LINKED_DOCUMENT_DRAWER_WIDTH}
        zIndex={LINKED_DOCUMENT_DRAWER_Z_INDEX}
        extra={
          <Button
            type="link"
            size="small"
            onClick={() => {
              closeLinkedSalesOrderDrawer();
              navigate('/apps/kuaizhizao/sales-management/sales-orders');
            }}
          >
            前往销售订单管理
          </Button>
        }
        plainBody={
          linkedSalesOrder ? (
            <SalesOrderDetailBody order={linkedSalesOrder} onTrackingDocumentClick={onQuotationTrackingDocClick} />
          ) : linkedSalesOrderLoading ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <Spin />
            </div>
          ) : null
        }
      />

      <FormModalTemplate
        title={editingId != null ? '编辑报价单' : '新建报价单'}
        open={modalVisible}
        onClose={() => { setModalVisible(false); setEditingId(null); setEffectiveRuleCode(null); setEffectiveAutoGen(null); }}
        onFinish={async (values) => {
          if (editingId != null) await submitEdit(values);
          else await submitCreate(values);
        }}
        isEdit={editingId != null}
        formRef={formRef}
        width={1200}
        layout="vertical"
        initialValues={editingId == null ? { quotation_date: dayjs(), currency_code: DEFAULT_QUOTATION_CURRENCY } : undefined}
        onValuesChange={(changed, _all) => {
          if ('customer_id' in changed && changed.customer_id != null) {
            const c = customerList.find((x: any) => (x.id ?? x.customer_id) === changed.customer_id);
            if (c) {
              const sId = c.salesmanId ?? c.salesman_id;
              const salesman = userList.find((u) => u.id === sId);
              const sName = c.salesmanName ?? c.salesman_name ?? (salesman ? (salesman.full_name || salesman.username) : '');
              formRef.current?.setFieldsValue({
                customer_name: c.name ?? c.customer_name,
                customer_contact: c.contactPerson ?? c.contact_person ?? c.contact ?? c.customer_contact,
                customer_phone: c.phone ?? c.customer_phone,
                salesman_id: sId,
                salesman_name: sName,
              });
            }
          }
        }}
      >
        {formItemContent}
      </FormModalTemplate>

      <CustomerFormModal
        open={customerCreateVisible}
        onClose={() => setCustomerCreateVisible(false)}
        editUuid={null}
        onSuccess={(customer) => {
          setCustomerList((prev) => [...prev, customer]);
          const sId = customer.salesmanId ?? (customer as any).salesman_id;
          const salesman = userList.find((u) => u.id === sId);
          const sName = customer.salesmanName ?? (customer as any).salesman_name ?? (salesman ? (salesman.full_name || salesman.username) : '');
          formRef.current?.setFieldsValue({
            customer_id: customer.id,
            customer_name: customer.name,
            customer_contact: customer.contactPerson ?? (customer as any).contact_person,
            customer_phone: customer.phone ?? (customer as any).customer_phone,
            salesman_id: sId,
            salesman_name: sName,
          });
          setCustomerCreateVisible(false);
        }}
      />

      <Suspense fallback={null}>
        <LazySyncFromDatasetModal
          open={syncModalVisible}
          onClose={() => setSyncModalVisible(false)}
          onConfirm={handleSyncConfirm}
          title="从数据集同步报价单"
        />

        <LazyUniImport
          visible={importModalVisible}
          onCancel={() => setImportModalVisible(false)}
          onConfirm={handleItemImport}
          title="导入报价明细"
          headers={['物料编号', '规格', '单位', '数量', '单价', '交货日期']}
          exampleRow={['MAT001', 'Spec X', 'PCS', '100', '1.5', '2026-03-01']}
        />
      </Suspense>

      <CustomerFollowUpFormModal
        open={followUpModalOpen}
        editing={null}
        preset={followUpPreset}
        onClose={() => {
          setFollowUpModalOpen(false);
          setFollowUpPreset(null);
        }}
      />

      <Modal
        title="驳回报价单"
        open={rejectModalOpen}
        okText="确认驳回"
        okButtonProps={{ danger: true }}
        onOk={submitReject}
        onCancel={() => {
          setRejectModalOpen(false);
          setRejectingRecord(null);
          setRejectRemarks('');
        }}
        destroyOnHidden
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
          报价单：{rejectingRecord?.quotation_code ?? rejectingRecord?.id ?? '-'}
        </Typography.Paragraph>
        <Input.TextArea
          rows={3}
          value={rejectRemarks}
          onChange={(e) => setRejectRemarks(e.target.value)}
          placeholder="可选：驳回原因"
          maxLength={500}
          showCount
        />
      </Modal>

      <Modal
        open={printModalVisible}
        title="选择打印模板"
        onCancel={() => {
          if (printSubmitting) return;
          setPrintModalVisible(false);
          setPrintingRecord(null);
        }}
        onOk={handleConfirmPrint}
        okText="预览打印"
        confirmLoading={printSubmitting}
        destroyOnHidden
      >
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Typography.Text type="secondary">
            报价单：{printingRecord?.quotation_code ?? printingRecord?.id ?? '-'}
          </Typography.Text>
          <Select
            allowClear
            placeholder="请选择模板（为空则使用后端默认模板）"
            value={selectedPrintTemplateUuid}
            onChange={(v) => setSelectedPrintTemplateUuid(v)}
            options={printTemplates.map((tpl) => ({ label: tpl.name, value: tpl.uuid }))}
          />
          <Typography.Text type="secondary">
            变量预览字段数：{Object.keys(printVariablesPreview?.variables || printVariablesPreview || {}).length}
          </Typography.Text>
        </Space>
      </Modal>

      <Modal
        open={pdfPreviewVisible}
        title={pdfPreviewFileName}
        width="90vw"
        style={{ top: 20 }}
        styles={{ body: { padding: 0, height: '80vh' } }}
        footer={
          <Space>
            <Button
              onClick={() => {
                if (pdfPreviewBlobUrl) {
                  const a = document.createElement('a');
                  a.href = pdfPreviewBlobUrl;
                  a.download = pdfPreviewFileName;
                  a.rel = 'noopener';
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                }
              }}
            >
              保存
            </Button>
            <Button
              onClick={() => {
                const iframe = document.getElementById('quotation-pdf-preview-frame') as HTMLIFrameElement | null;
                try {
                  iframe?.contentWindow?.focus();
                  iframe?.contentWindow?.print();
                } catch {
                  window.print();
                }
              }}
            >
              打印
            </Button>
            <Button type="primary" onClick={() => setPdfPreviewVisible(false)}>
              关闭
            </Button>
          </Space>
        }
        onCancel={() => setPdfPreviewVisible(false)}
        afterClose={() => {
          if (pdfPreviewBlobUrl) {
            URL.revokeObjectURL(pdfPreviewBlobUrl);
            setPdfPreviewBlobUrl(null);
          }
        }}
        destroyOnHidden
      >
        {pdfPreviewBlobUrl && (
          <iframe
            id="quotation-pdf-preview-frame"
            src={pdfPreviewBlobUrl}
            title="PDF 预览"
            style={{ border: 0, width: '100%', height: '100%', background: '#525659' }}
          />
        )}
      </Modal>
    </>
  );
};

export default QuotationsPage;
