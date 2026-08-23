import { rowActionKind } from '../../../../../components/uni-action';
/**
 * 销售预测页面
 *
 * 独立于需求管理的销售预测功能，使用销售预测专用 API 与服务。
 *
 * @author RiverEdge Team
 * @date 2026-02-02
 */

import React, { useRef, useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react'
import { ActionType, ProColumns, ProForm, ProFormText, ProFormDatePicker, ProFormTextArea, ProFormInstance, ProFormSelect } from '@ant-design/pro-components'
import { App, Button, Space, Table, Input, InputNumber, Row, Col, Form as AntForm, DatePicker, Typography, Modal, Tooltip, Alert, Empty, Spin, Switch, Tag } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined, AppstoreAddOutlined, ImportOutlined, ArrowLeftOutlined, PrinterOutlined, ArrowDownOutlined } from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useLeaveFormTab } from '../../../../../components/uni-tabs/navigateClosingTab'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts'
import { useDeferAfterPaint } from '../../../../../hooks/useDeferAfterPaint'
import { theme as AntdTheme } from 'antd'
import { StatCardTrendArea } from '../../../../../components/common/StatCardTrendArea'
import { useAuditRequired } from '../../../../../hooks/useAuditRequired'
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions'
import {
  salesForecastCapabilityReasonMessage,
  useSalesForecastCapabilities,
} from '../../../../../hooks/useDocumentCapabilities'
import { useKuaizhizaoPrintModal } from '../../../hooks/useKuaizhizaoPrintModal'
import {
  ListPageTemplate,
  DetailDrawerSection,
  DocumentFormPageLayout,
  DocumentFormPageHeaderActions,
  DOCUMENT_DETAIL_PAGE_TITLE_STYLE,
  type StatCard,
} from '../../../../../components/layout-templates'
import { setCustomPageTitle, removeCustomPageTitle } from '../../../../../utils/customPageTitle'
import { useSubmitShortcut } from '../../../../../hooks/useSubmitShortcut'
import { buildFutureDateShortcutFieldProps, FutureDatePicker } from '../../../../../utils/futureDatePickerShortcuts'
import { UniTable, readPersistedUniTableViewType } from '../../../../../components/uni-table'
import { buildDocumentListHelpViewConfig, DOCUMENT_LIST_HELP_KEYS } from '../../../../../components/page-help-wiki'
import { buildFactoryImportTemplate } from '../../../../../utils/spreadsheetImportTemplate'
import { useImportMaterialUnitOptions } from '../../../../master-data/hooks/useImportMaterialUnitOptions'
import { pickImportExampleValue } from '../../../../../utils/loadImportDictionaryValues'
import { UniAuditBatchMenuButton, UniCapabilityBatchButton } from '../../../../../components/uni-batch';
import { buildUniPushMenuItems, buildUniPushToolbarDisabledReason, UniPushToolbarButton } from '../../../../../components/uni-push';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
  MaterialStackedCell,
} from '../../../../../components/uni-table/stackedPrimaryColumn'
import { UniMaterialSelect } from '../../../../../components/uni-material-select'
import { UniMaterialBatchPicker } from '../../../../../components/uni-material-batch-picker'
import { ThemedSegmented } from '../../../../../components/themed-segmented'
import { MaterialUnitSelect } from '../../../../../components/material-unit-select'
import { UniTableDetail } from '../../../../../components/uni-table-detail'
import {
  DOCUMENT_DETAIL_CONTROL_SIZE,
  DOCUMENT_DETAIL_TABLE_PROPS,
} from '../../../components/document-detail-table/documentDetailTable'
import {
  alignProColumns,
  GLOBAL_DOC_DETAIL_TABLE_FIELD_RANK,
  SALES_DOC_LIST_FIELD_RANK,
} from '../shared/documentFieldAlignment'
import { DocumentPushProgressBar, DOCUMENT_PROGRESS_COLUMN_DEFAULTS } from '../shared/DocumentPushProgressBar'
import {
  collectComputationPushDocuments,
  salesForecastComputationPushPercent,
} from '../shared/pushProgress'
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns'
import { flattenDocumentDetailRows, resolveDetailTableViewMode } from '../../shared/detailTableFlatRows';
const LazyUniImport = lazy(() =>
  import('../../../../../components/uni-import').then((m) => ({ default: m.UniImport })),
)

const SALES_FORECAST_RESOURCE = 'kuaizhizao:sales-forecast'
const SALES_FORECAST_LIST_PATH = '/apps/kuaizhizao/sales-management/sales-forecasts'
const SALES_FORECAST_LIST_PERSISTENCE_ID =
  'apps.kuaizhizao.pages.sales-management.sales-forecasts.v2'
const SALES_FORECAST_CREATE_PATH = `${SALES_FORECAST_LIST_PATH}/new`
const salesForecastEditPath = (id: number) => `${SALES_FORECAST_LIST_PATH}/${id}/edit`
import type { Material } from '../../../../master-data/types/material'
import {
  listSalesForecasts,
  getSalesForecast,
  getSalesForecastItems,
  createSalesForecast,
  updateSalesForecast,
  deleteSalesForecast,
  submitSalesForecast,
  approveSalesForecast,
  withdrawSalesForecast,
  withdrawSalesForecastApproval,
  pushSalesForecastToComputation,
  previewPushSalesForecastToComputation,
  importSalesForecasts,
  exportSalesForecasts,
  getSalesForecastStatistics,
  type SalesForecast,
  type SalesForecastItem,
  type SalesForecastListParams,
} from '../../../services/sales-forecast'
import dayjs from 'dayjs'
import {
  generateCode,
  testGenerateCode,
  getCodeRulePageConfig,
} from '../../../../../services/codeRule'
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage'
import { getSalesForecastLifecycle } from '../../../utils/salesForecastLifecycle'
import { LIST_LIFECYCLE_STAGE_FIELD } from '../../../../../utils/listLifecycleStage'
import { ListUniLifecycleCell } from '../shared/ListUniLifecycleCell'
import { createListAuditPhaseColumn } from '../shared/listAuditPhaseColumn'
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions'
import { WarehouseTraceBriefPrimaryActions } from '../../warehouse-management/WarehouseTraceBriefFooter'
import { SalesForecastDetailDrawer } from './components/SalesForecastDetailDrawer'
import { downloadFile } from '../../../services/common'
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField'
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments'
import { resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import { formatDateTime, formatQuantity, todaySiteDateString } from '../../../../../utils/format';
import { extractProTableSort } from '../../../../../utils/tableQueryKey';
import { downloadRecordsAsXlsx } from '../../../../../utils/exportRecordsXlsx';
import { importExcelMatrixInChunks } from '../../../../../utils/chunkedBulkImport';

export default function SalesForecastsPage() {
  const { t, i18n } = useTranslation();
  const pushToComputationAction = resolveKuaizhizaoDocumentAction(t, 'demand_computation.pull_from_sales_forecast');
  const { openPrint, PrintModal } = useKuaizhizaoPrintModal();
  const { message: messageApi, modal: modalApi } = App.useApp()
  const navigate = useNavigate();
  const location = useLocation();
  const isCreatePage = location.pathname.endsWith('/sales-forecasts/new');
  const editRouteMatch = location.pathname.match(/\/sales-forecasts\/(\d+)\/edit$/);
  const editRouteId = editRouteMatch ? Number(editRouteMatch[1]) : null;
  const isEditPage = editRouteId != null && Number.isFinite(editRouteId) && editRouteId > 0;
  const isFormPage = isCreatePage || isEditPage;
  const formPageInitializedRef = useRef(false);
  const formRef = useRef<ProFormInstance>();
  /** 表格搜索表单 ref，用于 statCard 点击时设置筛选并刷新 */
  const tableSearchFormRef = useRef<any>(null);
  const actionRef = useRef<ActionType>();
  const queryClient = useQueryClient();

  const invalidateMenuBadge = useInvalidateMenuBadgeCounts();
  const invalidateStatistics = () => {
    queryClient.invalidateQueries({ queryKey: ['salesForecastStatistics'] });
  };

  const secondaryStatsReady = useDeferAfterPaint();
  const { data: statistics } = useQuery({
    queryKey: ['salesForecastStatistics', location.pathname],
    queryFn: () => getSalesForecastStatistics(),
    enabled: secondaryStatsReady,
  });

  const { token } = AntdTheme.useToken()
  const forecastDetailDrawerZIndex = token.zIndexPopupBase
  const tableRowsRef = useRef<SalesForecast[]>([]);

  // 与 UniTable viewTypes 同步：table=单据维度；detailTable=明细数据维度
  const [viewTypeState, setViewTypeState] = useState<'table' | 'detailTable' | 'help'>(() =>
    readPersistedUniTableViewType(SALES_FORECAST_LIST_PERSISTENCE_ID, 'table', [
      'table',
      'detailTable',
      'help',
    ]) as 'table' | 'detailTable' | 'help',
  )
  const dataViewMode = resolveDetailTableViewMode(viewTypeState);
  const dataViewModeRef = useRef(dataViewMode);
  useEffect(() => {
    dataViewModeRef.current = dataViewMode;
  }, [dataViewMode]);

  /**
   * 将含有 items 的预测单据拍平为明细行，用于“明细视图”
   */
  const [currentForecast, setCurrentForecast] = useState<SalesForecast | null>(null)
  const [isEdit, setIsEdit] = useState(false)
  const [currentId, setCurrentId] = useState<number | null>(null)
  const [previewCode, setPreviewCode] = useState<string | null>(null)
  const [effectiveRuleCode, setEffectiveRuleCode] = useState<string | null>(null)
  const [effectiveAutoGen, setEffectiveAutoGen] = useState<boolean | null>(null)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [trackingRefreshKey, setTrackingRefreshKey] = useState(0)
  const [pushPreviewOpen, setPushPreviewOpen] = useState(false)
  const [pushPreviewLoading, setPushPreviewLoading] = useState(false)
  const [pushPreviewConfirming, setPushPreviewConfirming] = useState(false)
  const [pushPreviewData, setPushPreviewData] = useState<any>(null)
  const [pushPreviewForecastId, setPushPreviewForecastId] = useState<number | null>(null)
  const [pushSelectedItemIds, setPushSelectedItemIds] = useState<number[]>([])
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const leaveSalesForecastFormPage = useLeaveFormTab(SALES_FORECAST_LIST_PATH);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false)
  const [productScope, setProductScope] = useState<'make' | 'all'>('make')
  const [importModalVisible, setImportModalVisible] = useState(false)
  const materialUnitImport = useImportMaterialUnitOptions()
  const forecastLineUnitOptions = materialUnitImport.options
  const forecastLineImportColumnOptions = useMemo(
    () => [undefined, undefined, forecastLineUnitOptions, undefined, undefined, undefined],
    [forecastLineUnitOptions],
  )
  const forecastTypeImportOptions = useMemo(
    () => [
      t('app.kuaizhizao.demandManagement.businessModeMtsShort'),
      t('app.kuaizhizao.demandManagement.businessModeMtoShort'),
    ],
    [t, i18n.language],
  )
  const forecastPeriodImportOptions = useMemo(
    () => [
      t('app.kuaizhizao.salesForecast.period.weekly'),
      t('app.kuaizhizao.salesForecast.period.monthly'),
      t('app.kuaizhizao.salesForecast.period.quarterly'),
    ],
    [t, i18n.language],
  )
  const parseForecastTypeImport = useCallback(
    (raw?: string | null) => {
      const v = String(raw ?? '').trim()
      if (!v) return undefined
      if (v === 'MTS' || v === 'MTO') return v
      if (v === t('app.kuaizhizao.demandManagement.businessModeMtsShort') ||
          v === t('app.kuaizhizao.demandManagement.businessModeMts')) {
        return 'MTS'
      }
      if (v === t('app.kuaizhizao.demandManagement.businessModeMtoShort') ||
          v === t('app.kuaizhizao.demandManagement.businessModeMto')) {
        return 'MTO'
      }
      return v
    },
    [t, i18n.language],
  )
  const parseForecastPeriodImport = useCallback(
    (raw?: string | null) => {
      const v = String(raw ?? '').trim()
      if (!v) return undefined
      const upper = v.toUpperCase()
      if (upper === 'WEEKLY' || upper === 'MONTHLY' || upper === 'QUARTERLY') return upper
      if (v === t('app.kuaizhizao.salesForecast.period.weekly')) return 'WEEKLY'
      if (v === t('app.kuaizhizao.salesForecast.period.monthly')) return 'MONTHLY'
      if (v === t('app.kuaizhizao.salesForecast.period.quarterly')) return 'QUARTERLY'
      return v
    },
    [t, i18n.language],
  )
  /** 列表导入模板（与后端 sales-forecasts/import header_map 字段一致） */
  const forecastListImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          {
            field: 'forecast_name',
            required: true,
            labelKey: 'app.kuaizhizao.salesForecast.forecastName',
            aliases: ['预测名称', '*预测名称'],
          },
          {
            field: 'forecast_type',
            labelKey: 'app.kuaizhizao.salesForecast.forecastType',
            aliases: ['预测类型'],
            options: forecastTypeImportOptions,
          },
          {
            field: 'forecast_period',
            required: true,
            labelKey: 'app.kuaizhizao.salesForecast.forecastPeriod',
            aliases: ['预测周期', '*预测周期'],
            options: forecastPeriodImportOptions,
          },
          {
            field: 'start_date',
            required: true,
            labelKey: 'app.kuaizhizao.salesForecast.startDate',
            aliases: ['开始日期', '*开始日期'],
          },
          {
            field: 'end_date',
            required: true,
            labelKey: 'app.kuaizhizao.salesForecast.endDate',
            aliases: ['结束日期', '*结束日期'],
          },
          {
            field: 'notes',
            labelKey: 'common.remark',
            aliases: ['备注'],
          },
        ],
        [
          'FC-DEMO',
          pickImportExampleValue(
            forecastTypeImportOptions,
            t('app.kuaizhizao.demandManagement.businessModeMtsShort'),
          ),
          pickImportExampleValue(
            forecastPeriodImportOptions,
            t('app.kuaizhizao.salesForecast.period.monthly'),
          ),
          '2026-01-01',
          '2026-03-31',
          '',
        ],
      ),
    [t, i18n.language, forecastTypeImportOptions, forecastPeriodImportOptions],
  )
  const materialSourceType = productScope === 'make' ? 'Make' : undefined
  const productColumnTitle = (
    <Space size={8} align="center">
      <span>{t('app.kuaizhizao.salesForecast.material')}</span>
      <ThemedSegmented
        size="small"
        value={productScope}
        options={[
          { label: t('app.kuaizhizao.sales.common.productScopeMake'), value: 'make' },
          { label: t('app.kuaizhizao.sales.common.productScopeAll'), value: 'all' },
        ]}
        onChange={(val) => setProductScope((val as 'make' | 'all') ?? 'make')}
      />
    </Space>
  )

  const [matrixModalVisible, setMatrixModalVisible] = useState(false)
  const [matrixMonths, setMatrixMonths] = useState<dayjs.Dayjs[]>([])
  const [matrixRows, setMatrixRows] = useState<any[]>([])
  const auditEnabled = useAuditRequired('sales_forecast', false)
  const salesForecastAuditColumn = useMemo(
    () => createListAuditPhaseColumn<SalesForecast>({ t, auditEnabled }),
    [t, auditEnabled],
  )
  const forecastPerms = useResourcePermissions(SALES_FORECAST_RESOURCE)
  const permDeniedTitle = t('common.noPermission')
  const detailCapabilityGates = useSalesForecastCapabilities(currentForecast, forecastPerms, t, permDeniedTitle)
  const salesNodesEnabled = {
    sales_forecast: true,
    demand_computation: true,
  }

  type SalesForecastItemRow = SalesForecastItem & {
    _rowKey: string;
    forecast_id: number;
    forecast_code?: string;
    forecast_name?: string;
    forecast_type?: string;
    forecast_period?: string;
    start_date?: string;
    end_date?: string;
    status?: string;
    review_status?: string;
    planning_pushed_to_computation?: boolean;
    capabilities?: SalesForecast['capabilities'];
    audit?: SalesForecast['audit'];
    created_at?: string;
    updated_at?: string;
    created_by_name?: string;
    updated_by_name?: string;
  };

  const salesForecastWorkflowProps = useMemo(
    () => ({
      entityName: t('app.kuaizhizao.salesForecast.title'),
      entityType: 'sales_forecast' as const,
      auditNodeKey: 'sales_forecast',
      resourcePrefix: 'kuaizhizao:sales-forecast',
      unifiedAudit: true,
      theme: 'default' as const,
      statusField: 'status' as const,
      reviewStatusField: 'review_status' as const,
      draftStatuses: ['草稿', 'DRAFT'],
      pendingStatuses: ['待审核', 'PENDING_REVIEW'],
      approvedStatuses: ['已审核', 'AUDITED', 'APPROVED', '审核通过', '通过', '已通过'],
      rejectedStatuses: ['已驳回', 'REJECTED', '审核驳回'],
    }),
    [t],
  );

  /**
   * 处理新建销售预测
   * 参考销售订单：先打开弹窗，再请求 testGenerateCode 预填编号（不占用序号）
   */
  const defaultUnit = t('app.kuaizhizao.salesForecast.defaultUnit')
  const defaultForecastItem = useMemo(
    () => ({
      material_id: undefined,
      material_code: '',
      material_name: '',
      material_spec: '',
      material_unit: defaultUnit,
      forecast_quantity: 0,
      forecast_date: dayjs(),
      confidence_level: 1.0,
      forecast_method: 'MANUAL',
    }),
    [defaultUnit],
  )

  const appendForecastItemsFromMaterials = useCallback(
    (selected: Material[]) => {
      const current = formRef.current?.getFieldValue('items') ?? []
      const newRows = selected.map((m) => ({
        ...defaultForecastItem,
        material_id: m.id,
        material_code: m.mainCode ?? m.code ?? '',
        material_name: m.name ?? '',
        material_spec: m.specification ?? '',
        material_unit: m.baseUnit ?? defaultUnit,
      }))
      // 如果当前只有一行且未选择产品，则替换该行
      if (current.length === 1 && !current[0].material_id && !current[0].material_code) {
        formRef.current?.setFieldsValue({ items: newRows })
      } else {
        formRef.current?.setFieldsValue({ items: [...current, ...newRows] })
      }
      messageApi.success(t('app.kuaizhizao.common.materialBatchAdded', { count: selected.length }))
    },
    [defaultForecastItem, defaultUnit, messageApi, t]
  )

  const handleItemImport = useCallback(
    (data: any[][]) => {
      const rows = data.slice(2);
      const newItems = rows
        .map((row) => {
          const materialCode = String(row[0] || '').trim();
          const spec = String(row[1] || '').trim();
          const unitRaw = String(row[2] || '').trim();
          const unit = materialUnitImport.parse(unitRaw) || unitRaw;
          const quantity = parseFloat(row[3]) || 0;
          const forecastDate = row[4];
          const notes = String(row[5] || '').trim();

          if (!materialCode) return null;

          return {
            ...defaultForecastItem,
            material_code: materialCode,
            material_spec: spec,
            material_unit: unit || defaultUnit,
            forecast_quantity: quantity || 1,
            forecast_date: forecastDate && dayjs(forecastDate).isValid() ? dayjs(forecastDate) : dayjs(),
            notes: notes || undefined,
          };
        })
        .filter((it): it is NonNullable<typeof it> => it !== null);

      if (newItems.length === 0) {
        messageApi.warning(t('app.kuaizhizao.salesForecast.noValidImportData'));
        return;
      }

      const currentItems = formRef.current?.getFieldValue('items') || [];
      formRef.current?.setFieldsValue({ items: [...currentItems, ...newItems] });
      messageApi.success(t('app.kuaizhizao.salesForecast.importItemsSuccess', { count: newItems.length }));
      setImportModalVisible(false);
    },
    [defaultForecastItem, defaultUnit, materialUnitImport, messageApi, t],
  );


    async function initSalesForecastCreateForm() {
    setIsEdit(false);
    setCurrentId(null);
    setPreviewCode(null);
    setEffectiveRuleCode(null);
    setEffectiveAutoGen(null);
    formRef.current?.resetFields();
    setTimeout(() => {
      formRef.current?.setFieldsValue({
        items: [defaultForecastItem],
        forecast_type: 'MTS',
      });
    }, 100);

    let ruleCode = getPageRuleCode('kuaizhizao-sales-forecast');
    let autoGenerate = isAutoGenerateEnabled('kuaizhizao-sales-forecast');
    try {
      const pageConfig = await getCodeRulePageConfig('kuaizhizao-sales-forecast');
      if (pageConfig?.ruleCode) {
        ruleCode = pageConfig.ruleCode;
        autoGenerate = !!pageConfig.autoGenerate;
      }
    } catch {}

    if (autoGenerate && ruleCode) {
      setEffectiveRuleCode(ruleCode);
      setEffectiveAutoGen(true);
      try {
        const codeResponse = await testGenerateCode({ rule_code: ruleCode });
        const preview = codeResponse.code;
        setPreviewCode(preview ?? null);
        formRef.current?.setFieldsValue({ forecast_code: preview ?? '' });
      } catch (error: unknown) {
        console.warn('销售预测编号预生成失败:', error);
        setPreviewCode(null);
      }
    } else {
      setPreviewCode(null);
      setEffectiveRuleCode(null);
      setEffectiveAutoGen(false);
    }
  }

  const handleCreate = () => {
    if (!salesNodesEnabled.sales_forecast) {
      messageApi.warning(t('app.kuaizhizao.salesForecast.nodeDisabledCreate'))
      return
    }
    navigate(SALES_FORECAST_CREATE_PATH)
  };

  useEffect(() => {
    if (!isFormPage) {
      formPageInitializedRef.current = false;
      return;
    }
    const titleKey = isCreatePage
      ? 'app.kuaizhizao.menu.sales-management.sales-forecasts.new'
      : 'app.kuaizhizao.menu.sales-management.sales-forecasts.edit';
    const title = t(titleKey);
    const sp = new URLSearchParams(location.search || '');
    sp.delete('_refresh');
    const cleanSearch = sp.toString();
    const tabKey = location.pathname + (cleanSearch ? `?${cleanSearch}` : '');
    setCustomPageTitle(location.pathname, title);
    setCustomPageTitle(tabKey, title);
    window.dispatchEvent(
      new CustomEvent('riveredge:update-tab-title', {
        detail: { key: tabKey, path: location.pathname, title },
      }),
    );
    return () => {
      removeCustomPageTitle(location.pathname);
      removeCustomPageTitle(tabKey);
    };
  }, [isFormPage, isCreatePage, location.pathname, location.search, t]);

  useEffect(() => {
    if (!isFormPage || formPageInitializedRef.current) return;
    if (isCreatePage && !salesNodesEnabled.sales_forecast) {
      messageApi.warning(t('app.kuaizhizao.salesForecast.nodeDisabledCreate'));
      leaveSalesForecastFormPage();
      return;
    }
    formPageInitializedRef.current = true;
    if (isCreatePage) {
      void initSalesForecastCreateForm();
    } else if (editRouteId) {
      void initSalesForecastEditForm(editRouteId);
    }
  }, [isFormPage, isCreatePage, editRouteId, salesNodesEnabled.sales_forecast, navigate, messageApi]);

  const openMatrixEntry = () => {
    const rawItems = formRef.current?.getFieldValue('items') ?? []
    const currentItems = Array.isArray(rawItems) ? rawItems : []
    if (!currentItems.length) {
      messageApi.warning(t('app.kuaizhizao.salesForecast.addItemsFirst'))
      return
    }

    const startDateRaw = formRef.current?.getFieldValue('start_date')
    const baseMonth = dayjs(startDateRaw || dayjs()).startOf('month')
    const months = Array.from({ length: 6 }).map((_, idx) => baseMonth.add(idx, 'month'))
    const monthKeys = months.map((m) => m.format('YYYY-MM'))
    const materialMap = new Map<number, any>()

    currentItems.forEach((it: any) => {
      const materialId = Number(it?.material_id) || 0
      if (!materialId) return
      if (!materialMap.has(materialId)) {
        materialMap.set(materialId, {
          material_id: materialId,
          material_code: it.material_code ?? '',
          material_name: it.material_name ?? '',
          material_spec: it.material_spec ?? '',
          material_unit: it.material_unit ?? defaultUnit,
          values: {},
        })
      }
      const fd = it?.forecast_date ? dayjs(it.forecast_date) : null
      const monthKey = fd?.isValid?.() ? fd.startOf('month').format('YYYY-MM') : ''
      if (!monthKey || !monthKeys.includes(monthKey)) return
      const row = materialMap.get(materialId)
      row.values[monthKey] = Number(row.values[monthKey] || 0) + (Number(it?.forecast_quantity) || 0)
    })

    const rows = Array.from(materialMap.values())
    if (!rows.length) {
      messageApi.warning(t('app.kuaizhizao.salesForecast.matrixNoValidMaterial'))
      return
    }

    setMatrixMonths(months)
    setMatrixRows(rows)
    setMatrixModalVisible(true)
  }

  const applyMatrixEntry = () => {
    const rows = Array.isArray(matrixRows) ? matrixRows : []
    if (!rows.length) {
      messageApi.warning(t('app.kuaizhizao.salesForecast.matrixEmpty'))
      return
    }
    const nextItems: any[] = []
    rows.forEach((row: any) => {
      matrixMonths.forEach((month) => {
        const key = month.format('YYYY-MM')
        const qty = Number(row?.values?.[key]) || 0
        if (qty <= 0) return
        nextItems.push({
          material_id: row.material_id,
          material_code: row.material_code,
          material_name: row.material_name,
          material_spec: row.material_spec,
          material_unit: row.material_unit || defaultUnit,
          forecast_quantity: qty,
          forecast_date: month.startOf('month'),
          confidence_level: 1.0,
          forecast_method: 'MANUAL',
        })
      })
    })
    if (!nextItems.length) {
      messageApi.warning(t('app.kuaizhizao.salesForecast.matrixQtyRequired'))
      return
    }
    formRef.current?.setFieldsValue({ items: nextItems })
    setMatrixModalVisible(false)
    messageApi.success(t('app.kuaizhizao.salesForecast.matrixApplySuccess', { count: nextItems.length }))
  }

  async function initSalesForecastEditForm(forecastId: number) {
    setIsEdit(true);
    setCurrentId(forecastId);
    setPreviewCode(null);
    setEffectiveRuleCode(null);
    setEffectiveAutoGen(null);
    formRef.current?.resetFields();
    try {
      const [data, itemsRes] = await Promise.all([getSalesForecast(forecastId), getSalesForecastItems(forecastId)]);
      const items = Array.isArray(itemsRes) ? itemsRes : [];
      const itemsForm = items.map((it: SalesForecastItem) => ({
        ...it,
        forecast_date: it.forecast_date ? dayjs(it.forecast_date) : undefined,
      }));
      setTimeout(() => {
        formRef.current?.setFieldsValue({
          ...data,
          attachments: mapAttachmentsToUploadList(data.attachments),
          start_date: data.start_date ? dayjs(data.start_date) : undefined,
          end_date: data.end_date ? dayjs(data.end_date) : undefined,
          items: itemsForm.length > 0 ? itemsForm : [defaultForecastItem],
        });
      }, 100);
    } catch (e: any) {
      messageApi.error(t('common.loadFailed') + ': ' + (e.message || ''));
      leaveSalesForecastFormPage();
    }
  }

  const handleEdit = (id: number) => {
    navigate(salesForecastEditPath(id));
  };

  const handleDetail = async (record: SalesForecast) => {
    try {
      const id = record.id!
      const res = await getSalesForecast(id)
      let items = res.items?.length ? res.items : undefined
      if (!items?.length) {
        const loaded = await getSalesForecastItems(id)
        items = Array.isArray(loaded) ? loaded : []
      }
      if (!items?.length) {
        items = record.items || (record as any).forecast_items || []
      }
      setCurrentForecast({ ...res, items: Array.isArray(items) ? items : [] })
      setDrawerVisible(true)
    } catch (e: any) {
      messageApi.error(t('common.fetchDetailFailed'))
    }
  }

  // 处理批量导入（UniTable 列表：提交矩阵，表头规范化为后端字段名；分片避免大文件超时）
  const handleImport = async (data: any[][]) => {
    try {
      const headers = (data[0] || []).map((h) => String(h ?? '').trim())
      const normalizedHeaders = headers.map((header) => {
        const mapped =
          forecastListImportTemplate.importHeaderMap[header] ||
          forecastListImportTemplate.importHeaderMap[header.replace(/^\*+/, '').trim()]
        return mapped || header.replace(/^\*+/, '').trim()
      })
      const typeIdx = normalizedHeaders.indexOf('forecast_type')
      const periodIdx = normalizedHeaders.indexOf('forecast_period')
      const bodyRows = data.slice(1).map((row) => {
        if (!Array.isArray(row)) return row
        const next = [...row]
        if (typeIdx >= 0 && next[typeIdx] != null) {
          next[typeIdx] = parseForecastTypeImport(String(next[typeIdx])) ?? next[typeIdx]
        }
        if (periodIdx >= 0 && next[periodIdx] != null) {
          next[periodIdx] = parseForecastPeriodImport(String(next[periodIdx])) ?? next[periodIdx]
        }
        return next
      })
      const payload = [normalizedHeaders, ...bodyRows]
      const result = await importExcelMatrixInChunks({
        data: payload,
        hasExampleRow: true,
        title: t('common.importing', { defaultValue: '正在导入数据' }),
        importChunk: (matrix) => importSalesForecasts(matrix),
      })
      if (result.failure_count > 0) {
        messageApi.warning(
          t('common.importResult', {
            success_count: result.success_count,
            failure_count: result.failure_count,
          })
        )
      } else {
        messageApi.success(t('common.importSuccess', { count: result.success_count }))
      }
      actionRef.current?.reload()
    } catch (e: any) {
      messageApi.error(e?.message || t('common.importFailed'))
    }
  }

  const handleItemImportConfirm = useCallback(
    (data: any[][]) => {
      handleItemImport(data)
    },
    [handleItemImport],
  )

  // 处理批量导出（UniTable 内置）
  const handleExport = async (
    type: 'selected' | 'currentPage' | 'all',
    selectedRowKeys?: React.Key[],
    currentPageData?: SalesForecast[]
  ) => {
    try {
      if (type === 'all') {
        const blob = await exportSalesForecasts()
        const filename = `${t('app.kuaizhizao.salesForecast.exportFilename', { date: todaySiteDateString() })}.xlsx`
        downloadFile(blob, filename)
        messageApi.success(t('common.exportSuccess'))
      } else {
        const toExport =
          type === 'selected' && selectedRowKeys?.length
            ? (currentPageData || []).filter(r => r.id != null && selectedRowKeys.includes(r.id))
            : currentPageData || []
        if (toExport.length === 0) {
          messageApi.warning(t('common.noDataToExport'))
          return
        }
        await downloadRecordsAsXlsx(
          toExport as Array<Record<string, unknown>>,
          `${t('app.kuaizhizao.salesForecast.exportFilename', { date: todaySiteDateString() })}.xlsx`,
        );
        messageApi.success(t('common.exportCountSuccess', { count: toExport.length }))
      }
    } catch (e: any) {
      messageApi.error((e as Error).message || t('common.exportFailed'))
    }
  }

  const executeDeleteByKeys = async (keys: React.Key[]) => {
    if (keys.length === 0) {
      messageApi.warning(t('common.selectToDelete'))
      return
    }

    const orderIds = [
      ...new Set(
        keys
          .map((k) => {
            const numericId = Number(k);
            return Number.isFinite(numericId) ? numericId : undefined;
          })
          .filter((id): id is number => id != null)
      ),
    ];
    const deleteCount = keys.length;
    const finalIds = orderIds;

    if (finalIds.length === 0) {
      messageApi.warning(t('common.selectToDelete'));
      return;
    }

    try {
      for (const id of finalIds) {
        await deleteSalesForecast(id);
      }
      messageApi.success(t('common.deleteSuccess', { count: deleteCount }))
      actionRef.current?.reload()
      setSelectedRowKeys([])
      if (actionRef.current?.clearSelected) actionRef.current.clearSelected();
      if (drawerVisible && currentForecast?.id && finalIds.includes(currentForecast.id)) {
        setDrawerVisible(false);
        setCurrentForecast(null);
      }
    } catch (e: any) {
      messageApi.error(t('common.deleteFailed') + ': ' + (e.message || ''))
    }
  }

  const handleDelete = async (keys: React.Key[]) => {
    modalApi.confirm({
      title: t('common.confirmDelete'),
      content: t('app.kuaizhizao.salesForecast.deleteConfirmContent', { count: keys.length }),
      okText: t('common.delete'),
      okButtonProps: { danger: true },
      cancelText: t('common.cancel'),
      onOk: () => executeDeleteByKeys(keys),
    })
  }

  const formatItem = (it: any) => {
    const fd = it.forecast_date
    const forecastDateStr =
      fd == null
        ? undefined
        : typeof fd?.format === 'function'
          ? fd.format('YYYY-MM-DD')
          : typeof fd === 'string'
            ? fd.slice(0, 10)
            : undefined
    return {
      material_id: it.material_id,
      material_code: it.material_code ?? '',
      material_name: it.material_name ?? '',
      material_spec: it.material_spec ?? undefined,
      material_unit: it.material_unit ?? '',
      forecast_quantity: Number(it.forecast_quantity) || 0,
      forecast_date: forecastDateStr,
      historical_sales: it.historical_sales != null ? Number(it.historical_sales) : undefined,
      variant_attributes: (() => {
        const va = (it as any).variant_attributes
        if (va == null) return undefined
        if (typeof va === 'object') return va
        try {
          return va ? JSON.parse(va) : undefined
        } catch {
          return undefined
        }
      })(),
      notes: it.notes ?? undefined,
    }
  }

  const handleSaveInternal = async (values: any, isDraft: boolean = false) => {
    try {
      if (!isEdit && !salesNodesEnabled.sales_forecast) {
        messageApi.warning(t('app.kuaizhizao.salesForecast.nodeDisabledSave'))
        return
      }
      const rawItems = values.items ?? []
      if (!rawItems.length) {
        messageApi.warning(t('app.kuaizhizao.salesForecast.itemsRequired'))
        return
      }
      const items = rawItems
        .map(formatItem)
        .filter((it: any) => it.material_id && it.forecast_quantity > 0 && it.forecast_date)
      if (!items.length) {
        messageApi.warning(t('app.kuaizhizao.salesForecast.incompleteItems'))
        return
      }
      // 自动编号逻辑：与销售订单看齐
      let forecastCode = values.forecast_code;
      if (!isEdit) {
        const ruleCodeToUse = effectiveRuleCode || getPageRuleCode('kuaizhizao-sales-forecast');
        const autoGen = effectiveAutoGen ?? isAutoGenerateEnabled('kuaizhizao-sales-forecast');
        if (autoGen && ruleCodeToUse && (forecastCode === previewCode || !forecastCode)) {
          try {
            const codeResponse = await generateCode({ rule_code: ruleCodeToUse });
            forecastCode = codeResponse.code;
          } catch (e) {
            console.warn('销售预测编号正式生成失败，使用预览值:', e);
          }
        }
      }
      const basePayload = {
        forecast_name: values.forecast_name,
        forecast_type: values.forecast_type ?? 'MTS',
        forecast_period: values.forecast_period,
        start_date:
          typeof values.start_date?.format === 'function'
            ? values.start_date.format('YYYY-MM-DD')
            : values.start_date,
        end_date:
          typeof values.end_date?.format === 'function'
            ? values.end_date.format('YYYY-MM-DD')
            : values.end_date,
        notes: values.notes,
        attachments: normalizeDocumentAttachments(values.attachments),
        status: isDraft ? '草稿' : undefined,
      }
      if (isEdit && currentId) {
        const res = await updateSalesForecast(currentId, { ...basePayload, items: items as any[] })
        const syncTip = t('app.kuaizhizao.salesForecast.syncTip')
        messageApi.success(res?.demand_synced ? `${t('common.updateSuccess')}。${syncTip}` : t('common.updateSuccess'))
      } else {
        await createSalesForecast({
          ...basePayload,
          forecast_code: forecastCode,
          items: items as any[],
        } as SalesForecast)
        messageApi.success(isDraft ? t('app.kuaizhizao.salesForecast.draftSaved') : t('common.createSuccess'))
      }
      setPreviewCode(null)
      setEffectiveRuleCode(null)
      setEffectiveAutoGen(null)
      invalidateStatistics();
      invalidateMenuBadge();
      setTrackingRefreshKey((k) => k + 1);
      if (isFormPage) {
        leaveSalesForecastFormPage()
      } else {
        actionRef.current?.reload()
      }
    } catch (e: any) {
      messageApi.error(e?.message || t('common.saveFailed'))
      throw e
    }
  }

  const handleSaveDraft = () => {
    formRef.current?.validateFields().then((values: any) => {
      handleSaveInternal(values, true);
    });
  };

  const handlePushToComputation = useCallback(
    (id: number) => {
      if (!salesNodesEnabled.demand_computation) {
        messageApi.warning(t('app.kuaizhizao.salesForecast.demandComputationDisabled'))
        return
      }
      setPushPreviewOpen(true)
      setPushPreviewLoading(true)
      setPushPreviewConfirming(false)
      setPushPreviewData(null)
      setPushPreviewForecastId(id)
      setPushSelectedItemIds([])
      previewPushSalesForecastToComputation(id)
        .then((res) => {
          setPushPreviewData(res)
          const ids = (res.items || [])
            .filter((row: any) => Number(row.max_push_quantity ?? 0) > 0)
            .map((row: any) => Number(row.item_id))
          setPushSelectedItemIds(ids)
        })
        .catch((error: any) => {
          messageApi.error(error?.message || error?.detail || t('app.kuaizhizao.salesForecast.pushPreviewFailed'))
          setPushPreviewOpen(false)
          setPushPreviewForecastId(null)
          setPushPreviewData(null)
          setPushSelectedItemIds([])
        })
        .finally(() => setPushPreviewLoading(false))
    },
    [messageApi, salesNodesEnabled.demand_computation, t],
  )

  const resetPushPreviewModal = useCallback(() => {
    setPushPreviewOpen(false)
    setPushPreviewForecastId(null)
    setPushPreviewData(null)
    setPushSelectedItemIds([])
  }, [])

  const refreshForecastAfterPush = useCallback(
    (forecastId: number) => {
      invalidateStatistics()
      invalidateMenuBadge()
      setTrackingRefreshKey((k) => k + 1)
      actionRef.current?.reload()
      if (drawerVisible && currentForecast?.id === forecastId) {
        void getSalesForecast(forecastId)
          .then(setCurrentForecast)
          .catch(() => {})
      }
    },
    [currentForecast?.id, drawerVisible],
  )

  const handlePushPreviewConfirm = useCallback(async () => {
    if (!pushPreviewForecastId || !pushPreviewData) return
    if (pushPreviewData.has_blocking_issues) return
    const pushableIds = (pushPreviewData.items || [])
      .filter((row: any) => Number(row.max_push_quantity ?? 0) > 0)
      .map((row: any) => Number(row.item_id))
    if (!pushableIds.length) {
      messageApi.warning(t('app.kuaizhizao.salesForecast.pushPreviewSelectAtLeastOne'))
      return
    }
    if (
      pushSelectedItemIds.length !== pushableIds.length ||
      !pushableIds.every((id) => pushSelectedItemIds.includes(id))
    ) {
      messageApi.warning(t('app.kuaizhizao.salesForecast.pushPreviewRequiresAllLines'))
      return
    }
    setPushPreviewConfirming(true)
    try {
      const res = await pushSalesForecastToComputation(pushPreviewForecastId)
      const code = res?.computation_code || res?.demand_computation?.computation_code
      messageApi.success(
        code
          ? t('app.kuaizhizao.demandComputation.createdTarget', {
              target: pushToComputationAction.targetLabel,
              code,
            })
          : res?.message || t('app.kuaizhizao.salesForecast.pushSuccess'),
      )
      refreshForecastAfterPush(pushPreviewForecastId)
      resetPushPreviewModal()
    } catch (error: any) {
      messageApi.error(error?.message || error?.response?.data?.detail || t('app.kuaizhizao.salesForecast.pushFailed'))
    } finally {
      setPushPreviewConfirming(false)
    }
  }, [
    messageApi,
    pushPreviewData,
    pushPreviewForecastId,
    pushSelectedItemIds,
    pushToComputationAction.targetLabel,
    refreshForecastAfterPush,
    resetPushPreviewModal,
    t,
  ])

  const formatForecastPeriod = (period?: string) => {
    if (!period) return '-';
    const periodMap: Record<string, string> = {
      WEEKLY: t('app.kuaizhizao.salesForecast.period.weekly'),
      MONTHLY: t('app.kuaizhizao.salesForecast.period.monthly'),
      QUARTERLY: t('app.kuaizhizao.salesForecast.period.quarterly'),
    };
    return periodMap[period] || period;
  };
  const getForecastPeriodTagColor = (period?: string): string => {
    if (period === 'WEEKLY') return 'blue';
    if (period === 'MONTHLY') return 'purple';
    if (period === 'QUARTERLY') return 'gold';
    return 'default';
  };

  const calcForecastTotalQuantity = (record: SalesForecast) => {
    const fromApi = Number(record.total_quantity);
    if (Number.isFinite(fromApi) && record.total_quantity != null) {
      return fromApi;
    }
    const items = record.items || (record as { forecast_items?: SalesForecastItem[] }).forecast_items || [];
    return items.reduce((sum, item) => sum + Number(item.forecast_quantity ?? 0), 0);
  };

  const columns: ProColumns<SalesForecast>[] = [
    {
      title: t('app.kuaizhizao.salesForecast.colForecastPrimary'),
      key: 'forecast_code',
      dataIndex: 'forecast_code',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      fixed: 'left',
      sorter: true,
      fieldProps: { placeholder: t('app.kuaizhizao.salesForecast.enterForecastCode') },
      render: (_text, record) => (
        <UniTableStackedPrimaryCell
          primary={String(record.forecast_name ?? '')}
          secondary={String(record.forecast_code ?? '')}
        />
      ),
    },
    {
      title: t('app.kuaizhizao.salesForecast.forecastName'),
      dataIndex: 'forecast_name',
      ellipsis: true,
      hideInTable: true,
      fieldProps: { placeholder: t('app.kuaizhizao.salesForecast.forecastName') },
    },
    {
      title: t('app.kuaizhizao.salesForecast.forecastPeriod'),
      dataIndex: 'forecast_period',
      valueType: 'select',
      width: 120,
      sorter: true,
      valueEnum: {
        WEEKLY: { text: t('app.kuaizhizao.salesForecast.period.weekly') },
        MONTHLY: { text: t('app.kuaizhizao.salesForecast.period.monthly') },
        QUARTERLY: { text: t('app.kuaizhizao.salesForecast.period.quarterly') },
      },
      render: (_text, record) => (
        <Tag color={getForecastPeriodTagColor(record.forecast_period)} bordered={false}>
          {formatForecastPeriod(record.forecast_period)}
        </Tag>
      ),
    },
    {
      title: t('app.kuaizhizao.salesForecast.startDate'),
      dataIndex: 'start_date',
      key: 'start_end_date_stacked',
      width: 132,
      uniTableKeepWidth: true,
      resizable: false,
      sorter: true,
      hideInSearch: true,
      render: (_text, record) => {
        const startDateText = record.start_date ? formatDateTime(record.start_date, 'YYYY-MM-DD') : '-';
        const endDateText = record.end_date ? formatDateTime(record.end_date, 'YYYY-MM-DD') : '-';
        return (
          <UniTableStackedPrimaryCell
            primary={startDateText}
            secondary={endDateText}
            secondaryCopyable={false}
            uniformText
            primaryBadge={t('common.start')}
            secondaryBadge={t('common.end')}
          />
        );
      },
    },
    {
      title: t('app.kuaizhizao.salesForecast.endDate'),
      dataIndex: 'end_date',
      valueType: 'date',
      width: 132,
      uniTableKeepWidth: true,
      hideInSearch: true,
      hideInTable: true,
      render: (_text, record) =>
        record.end_date ? formatDateTime(record.end_date, 'YYYY-MM-DD') : '-',
    },
    {
      title: t('app.kuaizhizao.salesForecast.colProductKinds'),
      dataIndex: 'items_count',
      width: 96,
      align: 'right' as const,
      hideInSearch: true,
      render: (_text, record) => {
        if (record.items_count != null && Number.isFinite(Number(record.items_count))) {
          return String(record.items_count);
        }
        const items = record.items || record.forecast_items || [];
        const kindCount = new Set(
          items.map((it) => it.material_id).filter((id): id is number => id != null),
        ).size;
        return String(kindCount);
      },
    },
    {
      title: t('app.kuaizhizao.salesForecast.totalQuantity'),
      dataIndex: 'total_quantity',
      width: 100,
      align: 'right' as const,
      hideInSearch: true,
      render: (_text, record) => formatQuantity(calcForecastTotalQuantity(record)),
    },
    {
      title: t('app.kuaizhizao.salesManagement.pushProgress.title'),
      dataIndex: 'computation_push_progress',
      ...DOCUMENT_PROGRESS_COLUMN_DEFAULTS,
      render: (_text, record) => {
        const percent = salesForecastComputationPushPercent(record.planning_pushed_to_computation);
        return (
          <DocumentPushProgressBar
            percent={percent}
            tooltip={t('app.kuaizhizao.salesManagement.pushProgress.computationTooltip', {
              percent,
              status: percent >= 100
                ? t('app.kuaizhizao.salesManagement.pushProgress.pushed')
                : t('app.kuaizhizao.salesManagement.pushProgress.notPushed'),
            })}
            documents={collectComputationPushDocuments(
              record.planning_computation_code,
              t('components.documentTrackingPanel.docType.demand_computation'),
            )}
            formatMoreDocs={(count) =>
              t('app.kuaizhizao.salesManagement.pushProgress.moreDocs', { count })
            }
          />
        );
      },
    },
    {
      title: t('common.dateRange'),
      dataIndex: 'dateRange',
      valueType: 'dateRange',
      hideInTable: true,
      search: {
        transform: (value) => ({
          start_date: value[0],
          end_date: value[1],
        }),
      },
    },
    ...buildDocumentAuditColumns<SalesForecast>(t),
    ...(salesForecastAuditColumn ? [salesForecastAuditColumn] : []),
    {
      title: t('app.kuaizhizao.salesForecast.lifecycleColumn'),
      dataIndex: LIST_LIFECYCLE_STAGE_FIELD,
      valueType: 'select',
      fixed: 'right' as const,
      valueEnum: {
        草稿: { text: t('app.kuaizhizao.salesForecast.statusDraft') },
        已下推: { text: t('app.kuaizhizao.salesForecast.statusPushed') },
        已生效: { text: t('app.kuaizhizao.salesForecast.lifecycleEffective') },
        执行中: { text: t('app.kuaizhizao.salesForecast.lifecycleExecuting') },
        已完成: { text: t('app.kuaizhizao.salesForecast.lifecycleCompleted') },
        已驳回: { text: t('app.kuaizhizao.salesForecast.statusRejected') },
        已取消: { text: t('documentStatus.cancelled') },
      },
      render: (_text, record) => (
        <ListUniLifecycleCell
          lifecycle={getSalesForecastLifecycle(record, auditEnabled, t)}
          withSubStages
        />
      ),
    },
    {
      title: t('common.actions'),
      valueType: 'option',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => {
        const canEdit = record.capabilities?.update?.allowed === true && forecastPerms.canUpdate;
        const canDelete = record.capabilities?.delete?.allowed === true && forecastPerms.canDelete;
        const parts: React.ReactNode[] = [
          <Button {...rowActionKind('read')} key="d" onClick={() => handleDetail(record)}>
            {t('common.detail')}
          </Button>,
        ];
        if (canEdit) {
          parts.push(
            <Button
              {...rowActionKind('update')}
              key="e"
              onClick={() => record.id != null && handleEdit(record.id)}
            >
              {t('common.edit')}
            </Button>,
          );
        }
        if (canDelete) {
          parts.push(
            <Button
              {...rowActionKind('delete')}
              key="del"
              onClick={() => record.id != null && handleDelete([record.id])}
            >
              {t('common.delete')}
            </Button>,
          );
        }
        parts.push(
          <UniWorkflowActions
            {...rowActionKind('skip')}
            key="workflow-actions"
            record={record}
            {...salesForecastWorkflowProps}
            onSuccess={() => {
              if (record.id != null) {
                refreshForecastAfterPush(record.id);
              } else {
                invalidateStatistics();
                invalidateMenuBadge();
                setTrackingRefreshKey((k) => k + 1);
                actionRef.current?.reload();
              }
            }}
          />,
        );
        return parts;
      },
    },
  ];

  const detailTableColumns: ProColumns<SalesForecastItemRow>[] = useMemo(
    () =>
      alignProColumns<SalesForecastItemRow>(
        [
      {
        title: t('app.kuaizhizao.salesForecast.colForecastPrimary'),
        key: 'forecast_code',
        dataIndex: 'forecast_code',
        ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
        fixed: 'left',
        hideInSearch: false,
        fieldProps: { placeholder: t('app.kuaizhizao.salesForecast.enterForecastCode') },
        render: (_, record) => (
          <UniTableStackedPrimaryCell
            primary={String(record.forecast_name ?? '')}
            secondary={String(record.forecast_code ?? '')}
          />
        ),
      },
      {
        title: t('app.kuaizhizao.salesForecast.forecastName'),
        dataIndex: 'forecast_name',
        hideInTable: true,
      },
      {
        title: t('app.kuaizhizao.salesForecast.material'),
        key: 'material_name',
        dataIndex: 'material_name',
        ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
        hideInSearch: true,
        render: (_, record) => (
          <MaterialStackedCell
            material_name={record.material_name}
            material_code={record.material_code}
            material_spec={record.material_spec}
          />
        ),
      },
      {
        title: t('app.kuaizhizao.salesForecast.materialCode'),
        dataIndex: 'material_code',
        hideInTable: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.salesForecast.forecastPeriod'),
        dataIndex: 'forecast_period',
        width: 120,
        hideInSearch: true,
        render: (_, record) => (
          <Tag color={getForecastPeriodTagColor(record.forecast_period)} bordered={false}>
            {formatForecastPeriod(record.forecast_period)}
          </Tag>
        ),
      },
      {
        title: t('app.kuaizhizao.salesForecast.forecastQuantity'),
        dataIndex: 'forecast_quantity',
        width: 100,
        align: 'right' as const,
        hideInSearch: true,
        render: (_, record) => formatQuantity(record.forecast_quantity),
      },
      {
        title: t('app.kuaizhizao.salesForecast.forecastDate'),
        dataIndex: 'forecast_date',
        width: 132,
        uniTableKeepWidth: true,
        hideInSearch: true,
        render: (_, record) =>
          record.forecast_date ? formatDateTime(record.forecast_date, 'YYYY-MM-DD') : '-',
      },
      ...buildDocumentAuditColumns<SalesForecastItemRow>(t),
      ...(salesForecastAuditColumn
        ? [salesForecastAuditColumn as ProColumns<SalesForecastItemRow>]
        : []),
      {
        title: t('app.kuaizhizao.salesForecast.lifecycleColumn'),
        dataIndex: LIST_LIFECYCLE_STAGE_FIELD,
        fixed: 'right' as const,
        hideInSearch: false,
        valueType: 'select',
        valueEnum: {
          草稿: { text: t('app.kuaizhizao.salesForecast.statusDraft') },
          已下推: { text: t('app.kuaizhizao.salesForecast.statusPushed') },
          已生效: { text: t('app.kuaizhizao.salesForecast.lifecycleEffective') },
          执行中: { text: t('app.kuaizhizao.salesForecast.lifecycleExecuting') },
          已完成: { text: t('app.kuaizhizao.salesForecast.lifecycleCompleted') },
          已驳回: { text: t('app.kuaizhizao.salesForecast.statusRejected') },
          已取消: { text: t('documentStatus.cancelled') },
        },
        render: (_text, record) => (
          <ListUniLifecycleCell
            lifecycle={getSalesForecastLifecycle(
              {
                status: record.status,
                review_status: record.review_status,
                planning_pushed_to_computation: record.planning_pushed_to_computation,
              } as SalesForecast,
              auditEnabled,
              t,
            )}
            withSubStages
          />
        ),
      },
      {
        title: t('common.actions'),
        valueType: 'option',
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) => {
          const header: SalesForecast = {
            id: record.forecast_id,
            forecast_code: record.forecast_code,
            forecast_name: record.forecast_name,
            status: record.status,
            review_status: record.review_status,
            capabilities: record.capabilities,
            audit: record.audit,
            planning_pushed_to_computation: record.planning_pushed_to_computation,
          };
          const canEdit = record.capabilities?.update?.allowed === true && forecastPerms.canUpdate;
          const canDelete = record.capabilities?.delete?.allowed === true && forecastPerms.canDelete;
          const parts: React.ReactNode[] = [
            <Button
              {...rowActionKind('read')}
              key="d"
              onClick={() => {
                if (record.forecast_id) void handleDetail(header);
              }}
            >
              {t('common.detail')}
            </Button>,
          ];
          if (canEdit) {
            parts.push(
              <Button
                {...rowActionKind('update')}
                key="e"
                onClick={() => handleEdit(record.forecast_id)}
              >
                {t('common.edit')}
              </Button>,
            );
          }
          if (canDelete) {
            parts.push(
              <Button
                {...rowActionKind('delete')}
                key="del"
                onClick={() => handleDelete([record.forecast_id])}
              >
                {t('common.delete')}
              </Button>,
            );
          }
          parts.push(
            <UniWorkflowActions
              {...rowActionKind('skip')}
              key="workflow-actions"
              record={header}
              {...salesForecastWorkflowProps}
              onSuccess={() => {
                if (record.forecast_id) {
                  refreshForecastAfterPush(record.forecast_id);
                } else {
                  invalidateStatistics();
                  invalidateMenuBadge();
                  setTrackingRefreshKey((k) => k + 1);
                  actionRef.current?.reload();
                }
              }}
            />,
          );
          return parts;
        },
      },
        ],
        GLOBAL_DOC_DETAIL_TABLE_FIELD_RANK,
      ),
    [
      auditEnabled,
      forecastPerms.canDelete,
      forecastPerms.canUpdate,
      salesForecastAuditColumn,
      salesForecastWorkflowProps,
      t,
    ],
  );

  const alignedColumns = useMemo(
    () => alignProColumns(columns, SALES_DOC_LIST_FIELD_RANK),
    [columns, salesForecastAuditColumn, auditEnabled, t],
  );

  const selectedForecastForToolbar = useMemo(() => {
    if (selectedRowKeys.length !== 1) return null;
    const selectedKey = String(selectedRowKeys[0]);
    return tableRowsRef.current.find((row) => String(row.id) === selectedKey) ?? null;
  }, [selectedRowKeys]);

  const selectedForecastsForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => tableRowsRef.current.find((row) => String(row.id) === String(key)))
        .filter((row): row is SalesForecast => row != null),
    [selectedRowKeys],
  );

  const toolbarPushDisabledReason = useMemo(
    () =>
      buildUniPushToolbarDisabledReason(t, {
        selectedCount: selectedRowKeys.length,
        hasSelectedRecord: !!selectedForecastForToolbar,
      }),
    [selectedForecastForToolbar, selectedRowKeys.length, t],
  );

  const toolbarPushItemDisabledReason = useMemo(() => {
    if (!selectedForecastForToolbar) return undefined;
    if (!salesNodesEnabled.demand_computation) {
      return t('app.kuaizhizao.salesForecast.demandComputationDisabled');
    }
    const cap = selectedForecastForToolbar.capabilities?.push_computation;
    if (!cap || cap.allowed) return undefined;
    return salesForecastCapabilityReasonMessage(cap.reason, t);
  }, [salesNodesEnabled.demand_computation, selectedForecastForToolbar, t]);

  /** 较昨日对比：显示 +x / -x 格式 */
  const renderDOD = (today?: number, yesterday?: number) => {
    if (today === undefined || yesterday === undefined) return null;
    const diff = today - yesterday;
    const color = diff > 0 ? '#cf1322' : diff < 0 ? '#3f8600' : 'rgba(0, 0, 0, 0.45)';
    const text = diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : '0';
    return (
      <span style={{ marginLeft: 8, fontSize: 13, color }}>
        <span style={{ color: 'rgba(0,0,0,0.45)' }}>{t('app.kuaizhizao.workOrder.statVsYesterday')}</span> {text}
      </span>
    );
  };

  /** 折线图渲染（与 StatCardTrendArea / 销售订单指标卡一致） */
  const renderTrendChart = (data: { date: string; value: number }[] = [], chartColor: string) => {
    if (!data || data.length === 0) return null;
    return <StatCardTrendArea data={data} color={chartColor} />;
  };

  const statCards: StatCard[] = [
        {
          title: t('app.kuaizhizao.salesForecast.statTodayNew'),
          key: 'today_new_count',
          value: statistics?.today_new_count ?? 0,
          description: statistics?.today_new_count !== undefined && statistics?.yesterday_today_new !== undefined ? (
            <div>{t('app.kuaizhizao.workOrder.statTodayPrefix')}: {statistics.today_new_count} {renderDOD(statistics.today_new_count, statistics.yesterday_today_new)}</div>
          ) : undefined,
          valueStyle: { color: token.colorPrimary },
          backgroundChart: renderTrendChart(statistics?.trend_today_new ?? [], token.colorPrimary),
        },
        ...(auditEnabled
          ? [{
              title: t('app.kuaizhizao.salesForecast.statPending'),
              key: 'pending_review_count',
              value: statistics?.pending_review_count ?? 0,
              valueStyle: { color: '#faad14' },
              description: (statistics?.pending_review_count ?? 0) > 0 ? <div style={{ color: '#faad14' }}>{t('app.kuaizhizao.salesForecast.statPendingAction')}</div> : undefined,
              backgroundChart: renderTrendChart(statistics?.trend_pending_review ?? [], '#faad14'),
              onClick: (statistics?.pending_review_count ?? 0) > 0 ? () => {
                tableSearchFormRef.current?.setFieldsValue?.({ status: 'PENDING_REVIEW' });
                actionRef.current?.reload?.();
              } : undefined,
            }]
          : []),
        {
          title: t('app.kuaizhizao.salesForecast.statInProgress'),
          key: 'in_progress_count',
          value: statistics?.in_progress_count ?? 0,
          valueStyle: { color: '#52c41a' },
          backgroundChart: renderTrendChart([], '#52c41a'),
          onClick: (statistics?.in_progress_count ?? 0) > 0 ? () => {
            tableSearchFormRef.current?.setFieldsValue?.({ lifecycle: '执行中' });
            actionRef.current?.reload?.();
          } : undefined,
        },
        {
          title: t('app.kuaizhizao.salesForecast.statOverdue'),
          key: 'overdue_count',
          value: statistics?.overdue_count ?? 0,
          valueStyle: { color: '#f5222d' },
          backgroundChart: renderTrendChart([], '#f5222d'),
        }
      ];

  const renderForecastForm = () => (
    <>
      <DetailDrawerSection titleAccent title={t('app.uniDetail.sectionBasic')}>
        <div className="document-form-untitled-groups">
          <div className="document-form-untitled-group">
        <Row gutter={16}>
          <Col span={12}>
            <ProFormText
              name="forecast_code"
              label={t('app.kuaizhizao.salesForecast.forecastCode')}
              placeholder={
                isAutoGenerateEnabled('kuaizhizao-sales-forecast')
                  ? t('common.autoCodePlaceholder')
                  : t('app.kuaizhizao.salesForecast.enterForecastCode')
              }
              rules={[{ required: true, message: t('app.kuaizhizao.salesForecast.enterForecastCode') }]}
              fieldProps={{ disabled: isEdit }}
            />
          </Col>
          <Col span={12}>
            <ProFormText
              name="forecast_name"
              label={t('app.kuaizhizao.salesForecast.forecastName')}
              placeholder={t('app.kuaizhizao.salesForecast.enterForecastName')}
              required
              rules={[{ required: true, message: t('app.kuaizhizao.salesForecast.enterForecastName') }]}
            />
          </Col>
        </Row>
          </div>
          <div className="document-form-untitled-group">
        <Row gutter={16}>
          <Col span={8}>
            <ProFormSelect
              name="forecast_period"
              label={t('app.kuaizhizao.salesForecast.forecastPeriod')}
              placeholder={t('app.kuaizhizao.salesForecast.forecastPeriodPlaceholder')}
              required
              options={[
                { label: t('app.kuaizhizao.salesForecast.period.weekly'), value: 'WEEKLY' },
                { label: t('app.kuaizhizao.salesForecast.period.monthly'), value: 'MONTHLY' },
                { label: t('app.kuaizhizao.salesForecast.period.quarterly'), value: 'QUARTERLY' },
              ]}
              rules={[{ required: true, message: t('app.kuaizhizao.salesForecast.forecastPeriodPlaceholder') }]}
            />
          </Col>
          <Col span={8}>
            <ProFormDatePicker
              name="start_date"
              label={t('app.kuaizhizao.salesForecast.startDate')}
              required
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={8}>
            <ProFormDatePicker
              name="end_date"
              label={t('app.kuaizhizao.salesForecast.endDate')}
              required
              fieldProps={buildFutureDateShortcutFieldProps({
                getForm: () => formRef.current,
                fieldName: 'end_date',
                baseFieldName: 'start_date',
                t,
              })}
            />
          </Col>
        </Row>
          </div>
        </div>
      </DetailDrawerSection>

      <DetailDrawerSection titleAccent title={t('app.uniDetail.sectionLines')}>
        <UniTableDetail
          name="items"
          title={t('app.kuaizhizao.salesForecast.forecastItems')}
          required
          requiredMessage={t('app.kuaizhizao.salesForecast.itemsRequired')}
          headerExtra={(
            <Space size={8}>
              <Button
                type="default"
                icon={<ImportOutlined />}
                onClick={() => setImportModalVisible(true)}
              >
                {t('app.kuaizhizao.salesForecast.importItems')}
              </Button>
              <Button
                type="default"
                icon={<PlusOutlined />}
                onClick={() => {
                  const items = [...(formRef.current?.getFieldValue('items') ?? [])]
                  items.push({ ...defaultForecastItem })
                  formRef.current?.setFieldsValue({ items })
                }}
              >
                {t('app.kuaizhizao.salesForecast.addItem')}
              </Button>
              <Button
                type="default"
                icon={<AppstoreAddOutlined />}
                onClick={() => setMaterialPickerOpen(true)}
              >
                {t('app.kuaizhizao.sales.common.productBatchSelect')}
              </Button>
              <Button
                type="default"
                icon={<AppstoreAddOutlined />}
                onClick={openMatrixEntry}
              >
                {t('app.kuaizhizao.salesForecast.matrixEntry')}
              </Button>
            </Space>
          )}
          columns={[
                  {
                    title: productColumnTitle,
                    dataIndex: 'material_id',
                    width: 260,
                    render: (_: any, __: any, index: number) => (
                      <UniMaterialSelect
                        name={[index, 'material_id']}
                        label=""
                        placeholder={t('common.selectMaterial')}
                        required
                        size={DOCUMENT_DETAIL_CONTROL_SIZE}
                        listFieldKey={index}
                        listFieldName="items"
                        fillMapping={{
                          material_code: 'mainCode',
                          material_name: 'name',
                          material_spec: 'specification',
                          material_unit: 'baseUnit',
                        }}
                        sourceType={materialSourceType}
                        formItemProps={{ style: { margin: 0 } }}
                        showAdvancedSearch
                      skipFuzzyPinyinClientFilter
                      />
                    ),
                  },
                  {
                    title: t('app.kuaizhizao.salesForecast.variantAttributes'),
                    dataIndex: 'variant_attributes',
                    width: 140,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'variant_attributes']} style={{ margin: 0 }}>
                        <Input
                          placeholder={t('app.kuaizhizao.salesForecast.attributePlaceholder')}
                          size={DOCUMENT_DETAIL_CONTROL_SIZE}
                          allowClear
                        />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: t('app.kuaizhizao.salesForecast.spec'),
                    dataIndex: 'material_spec',
                    width: 120,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'material_spec']} style={{ margin: 0 }}>
                        <Input placeholder={t('app.kuaizhizao.salesForecast.specPlaceholder')} size={DOCUMENT_DETAIL_CONTROL_SIZE} />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: t('common.unit'),
                    dataIndex: 'material_unit',
                    width: 100,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item
                        noStyle
                        shouldUpdate={(prev: any, curr: any) =>
                          prev?.items?.[index]?.material_id !== curr?.items?.[index]?.material_id
                        }
                      >
                        {({ getFieldValue }) => {
                          const materialId = getFieldValue(['items', index, 'material_id']);
                          return (
                            <AntForm.Item name={[index, 'material_unit']} style={{ margin: 0 }}>
                              <MaterialUnitSelect materialId={materialId} size={DOCUMENT_DETAIL_CONTROL_SIZE} noStyle />
                            </AntForm.Item>
                          );
                        }}
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: t('app.kuaizhizao.salesForecast.forecastQuantity'),
                    dataIndex: 'forecast_quantity',
                    width: 100,
                    align: 'right' as const,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item
                        name={[index, 'forecast_quantity']}
                        rules={[{ required: true, message: t('common.required') }]}
                        style={{ margin: 0 }}
                      >
                        <InputNumber min={0.01} precision={2} style={{ width: '100%' }} size={DOCUMENT_DETAIL_CONTROL_SIZE} />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: t('app.kuaizhizao.salesForecast.forecastDate'),
                    dataIndex: 'forecast_date',
                    width: 140,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item
                        name={[index, 'forecast_date']}
                        rules={[{ required: true, message: t('common.required') }]}
                        style={{ margin: 0 }}
                      >
                        <FutureDatePicker
                          size={DOCUMENT_DETAIL_CONTROL_SIZE}
                          style={{ width: '100%' }}
                          format="YYYY-MM-DD"
                          getForm={() => formRef.current}
                          baseFieldName="start_date"
                          t={t}
                          onApply={(date) =>
                            formRef.current?.setFieldValue?.(['items', index, 'forecast_date'], date)
                          }
                        />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: t('common.remark'),
                    dataIndex: 'notes',
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'notes']} style={{ margin: 0 }}>
                        <Input placeholder={t('common.remark')} size={DOCUMENT_DETAIL_CONTROL_SIZE} />
                      </AntForm.Item>
                    ),
                  },
                ]}
          disabledAdd
          initialValue={{ ...defaultForecastItem }}
          tableProps={DOCUMENT_DETAIL_TABLE_PROPS}
        />
        <SalesForecastFormSummary />
        <ProFormTextArea name="notes" label={t('common.remark')} placeholder={t('app.kuaizhizao.salesForecast.notesPlaceholder')} />
      </DetailDrawerSection>

      <DetailDrawerSection titleAccent title={t('app.uniDetail.sectionAttachments')} marginBottom={0}>
        <DocumentAttachmentsField category="sales_forecast_attachments" label={false} />
      </DetailDrawerSection>
    </>
  );

  const forecastFormSecondaryModals = (
    <>
      <UniMaterialBatchPicker
        open={materialPickerOpen}
        onCancel={() => setMaterialPickerOpen(false)}
        onConfirm={appendForecastItemsFromMaterials}
      />

      <Modal
        title={t('app.kuaizhizao.salesForecast.matrixTitle')}
        open={matrixModalVisible}
        width={980}
        onCancel={() => setMatrixModalVisible(false)}
        onOk={applyMatrixEntry}
        okText={t('app.kuaizhizao.salesForecast.matrixApplyOk')}
      >
        <Table
          size="small"
          rowKey="material_id"
          pagination={false}
          dataSource={matrixRows}
          scroll={{ x: 900 }}
          columns={[
            {
              title: t('app.kuaizhizao.salesForecast.material'),
              dataIndex: 'material_name',
              width: 240,
              fixed: 'left',
              render: (_: any, row: any) => (
                <div>
                  <div>{row.material_name || '-'}</div>
                  <Typography.Text type="secondary">
                    {row.material_code || '-'} / {row.material_unit || '-'}
                  </Typography.Text>
                </div>
              ),
            },
            ...matrixMonths.map((month) => {
              const key = month.format('YYYY-MM')
              return {
                title: key,
                dataIndex: key,
                width: 110,
                render: (_: any, row: any, rowIndex: number) => (
                  <InputNumber
                    min={0}
                    precision={2}
                    style={{ width: '100%' }}
                    value={Number(row?.values?.[key]) || 0}
                    onChange={(val) => {
                      const numVal = Number(val ?? 0)
                      setMatrixRows((prev) =>
                        prev.map((r, idx) =>
                          idx !== rowIndex
                            ? r
                            : {
                                ...r,
                                values: {
                                  ...(r.values || {}),
                                  [key]: numVal,
                                },
                              }
                        )
                      )
                    }}
                  />
                ),
              }
            }),
          ]}
        />
      </Modal>

      {isFormPage && (
        <Suspense fallback={null}>
          <LazyUniImport
            visible={importModalVisible}
            onCancel={() => setImportModalVisible(false)}
            onConfirm={handleItemImportConfirm}
            title={t('app.kuaizhizao.salesForecast.importItemsTitle')}
            headers={[
              t('app.kuaizhizao.salesForecast.importHeaderMaterialCode'),
              t('app.kuaizhizao.salesForecast.importHeaderSpec'),
              t('common.unit'),
              t('app.kuaizhizao.salesForecast.importHeaderForecastQuantity'),
              t('app.kuaizhizao.salesForecast.importHeaderForecastDate'),
              t('common.remark'),
            ]}
            exampleRow={[
              t('app.kuaizhizao.salesForecast.importExampleMaterialCode'),
              t('app.kuaizhizao.salesForecast.importExampleSpec'),
              pickImportExampleValue(forecastLineUnitOptions, t('app.kuaizhizao.salesForecast.importExampleUnit')),
              t('app.kuaizhizao.salesForecast.importExampleQuantity'),
              t('app.kuaizhizao.salesForecast.importExampleDate'),
              t('app.kuaizhizao.salesForecast.importExampleNotes'),
            ]}
            columnOptions={forecastLineImportColumnOptions}
            enableXlsxTemplate
            enableMappingImport
            enableImportPreview
          />
        </Suspense>
      )}

    </>
  );

  const triggerForecastFormSubmit = () => formRef.current?.submit?.();

  useSubmitShortcut(() => triggerForecastFormSubmit(), isFormPage);

  if (isFormPage) {
    return (
      <>
        <DocumentFormPageLayout
          header={
            <>
            <Space align="center" size={8}>
              <Button
                type="text"
                icon={<ArrowLeftOutlined />}
                aria-label={t('common.back')}
                onClick={leaveSalesForecastFormPage}
              />
              <Typography.Title level={4} style={DOCUMENT_DETAIL_PAGE_TITLE_STYLE}>
                {isCreatePage
                  ? t('app.kuaizhizao.menu.sales-management.sales-forecasts.new')
                  : t('app.kuaizhizao.menu.sales-management.sales-forecasts.edit')}
              </Typography.Title>
            </Space>
            <DocumentFormPageHeaderActions
              onCancel={leaveSalesForecastFormPage}
              onSaveDraft={() => void handleSaveDraft()}
              onPrimarySubmit={triggerForecastFormSubmit}
              isCreatePage={isCreatePage}
              showSaveDraft={isCreatePage}
              canSubmitAfterSave={isCreatePage}
            />
            </>
          }
        >
          <div className="form-modal-content-inner">
              <ProForm
                formRef={formRef}
                layout="vertical"
                submitter={false}
                scrollToFirstError
                onFinish={(values) => handleSaveInternal(values, false)}
                onFinishFailed={({ errorFields }) => {
                  const first = errorFields?.[0];
                  const errText = first?.errors?.filter(Boolean)[0];
                  messageApi.error(errText || t('components.layoutTemplates.formModal.checkFormHint'));
                }}
                initialValues={isCreatePage ? { items: [defaultForecastItem] } : undefined}
              >
                {renderForecastForm()}
              </ProForm>
            </div>
        </DocumentFormPageLayout>
        {forecastFormSecondaryModals}
      </>
    );
  }

  return (
    <>
      <ListPageTemplate statCards={statCards}>
        <UniTable<any>
          columnPersistenceId={SALES_FORECAST_LIST_PERSISTENCE_ID}
          actionRef={actionRef}
          formRef={tableSearchFormRef}
          rowKey={dataViewMode === 'detail' ? '_rowKey' : 'id'}
          columns={alignedColumns}
          detailTableColumns={detailTableColumns}
          viewTypes={['table', 'detailTable', 'help']}
          defaultViewType={viewTypeState === 'help' ? 'table' : viewTypeState}
          helpViewConfig={buildDocumentListHelpViewConfig(DOCUMENT_LIST_HELP_KEYS.salesForecast)}
          onViewTypeChange={(v) => {
            dataViewModeRef.current = resolveDetailTableViewMode(v as 'table' | 'detailTable' | 'help');
            setViewTypeState(v as 'table' | 'detailTable' | 'help');
            setSelectedRowKeys([]);
            setTimeout(() => actionRef.current?.reload(), 0);
          }}
          request={async (params, sort, _filter, searchFormValues) => {
            const sf = searchFormValues ?? {};
            const { sortBy, sortOrder } = extractProTableSort(sort);
            const orderBy =
              sortBy && sortOrder ? (sortOrder === 'desc' ? `-${sortBy}` : sortBy) : undefined;
            const needItems = dataViewModeRef.current === 'detail';
            const apiParams: SalesForecastListParams = {
              skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
              limit: params.pageSize ?? 20,
              include_items: needItems,
              order_by: orderBy,
            };
            if (sf.forecast_period) apiParams.forecast_period = sf.forecast_period as string;
            const fuzzyKeyword =
              typeof sf.keyword === 'string' ? sf.keyword.trim() : '';
            const fc = sf.forecast_code != null ? String(sf.forecast_code).trim() : '';
            if (fuzzyKeyword) {
              apiParams.keyword = fuzzyKeyword;
            } else if (fc) {
              apiParams.forecast_code = fc;
            }
            const fn = sf.forecast_name != null ? String(sf.forecast_name).trim() : '';
            if (fn) apiParams.forecast_name = fn;
            if (sf.lifecycle) {
              const lifecycleToStatus: Record<string, string> = {
                草稿: 'DRAFT',
                待审核: 'PENDING_REVIEW',
                已审核: 'AUDITED',
                已下推: 'PUSHED',
                已生效: 'EFFECTIVE',
                执行中: 'IN_PROGRESS',
                已完成: 'COMPLETED',
                已驳回: 'REJECTED',
                已取消: 'CANCELLED',
              };
              apiParams.status = lifecycleToStatus[String(sf.lifecycle)] ?? String(sf.lifecycle);
            } else if (sf.status) {
              apiParams.status = sf.status as string;
            }
            if (sf.start_date)
              apiParams.start_date = formatDateTime(sf.start_date, 'YYYY-MM-DD');
            if (sf.end_date) apiParams.end_date = formatDateTime(sf.end_date, 'YYYY-MM-DD');

            const formatListResponse = (forecasts: SalesForecast[], total: number) => {
              // 行缓存唯一真源：onTableDataChange（prefetch 会走本 request，禁止在此覆盖）
              if (dataViewModeRef.current === 'order') {
                return { data: forecasts, success: true, total };
              }
              const flatRows = flattenDocumentDetailRows<SalesForecast, SalesForecastItem>({
                headers: forecasts,
                getHeaderId: (h) => h.id,
                getItems: (h) => h.items ?? (h as { forecast_items?: SalesForecastItem[] }).forecast_items,
                buildRowKey: (h, item, index) =>
                  item?.id
                    ? `forecast-${h.id}-item-${item.id}`
                    : `forecast-${h.id}-idx-${index}`,
                mapItemRow: (h, item) => ({
                  ...item,
                  forecast_id: h.id ?? 0,
                  forecast_code: h.forecast_code,
                  forecast_name: h.forecast_name,
                  forecast_type: h.forecast_type,
                  forecast_period: h.forecast_period,
                  start_date: h.start_date,
                  end_date: h.end_date,
                  status: h.status,
                  review_status: h.review_status,
                  planning_pushed_to_computation: h.planning_pushed_to_computation,
                  capabilities: h.capabilities,
                  audit: h.audit,
                  created_at: h.created_at,
                  updated_at: h.updated_at,
                  created_by_name: h.created_by_name,
                  updated_by_name: h.updated_by_name,
                }),
                mapEmptyHeaderRow: (h) => ({
                  forecast_id: h.id ?? 0,
                  forecast_code: h.forecast_code,
                  forecast_name: h.forecast_name,
                  forecast_type: h.forecast_type,
                  forecast_period: h.forecast_period,
                  start_date: h.start_date,
                  end_date: h.end_date,
                  status: h.status,
                  review_status: h.review_status,
                  planning_pushed_to_computation: h.planning_pushed_to_computation,
                  capabilities: h.capabilities,
                  audit: h.audit,
                  created_at: h.created_at,
                  updated_at: h.updated_at,
                  created_by_name: h.created_by_name,
                  updated_by_name: h.updated_by_name,
                  material_code: '-',
                  material_name: '-',
                  forecast_quantity: 0,
                }),
              }) as SalesForecastItemRow[];
              return { data: flatRows, success: true, total };
            };

            try {
              const res = await listSalesForecasts(apiParams);
              const forecasts: SalesForecast[] = Array.isArray(res.data) ? res.data : [];
              const total: number = res.total ?? forecasts.length;
              return formatListResponse(forecasts, total);
            } catch (e: any) {
              messageApi.error(e?.message || t('common.loadFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          showAdvancedSearch={true}
          skipFuzzyPinyinClientFilter
          enableRowSelection={viewTypeState !== 'detailTable'}
          toolBarButtonSize="middle"
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={(keys) => setSelectedRowKeys(keys)}
          showCreateButton={salesNodesEnabled.sales_forecast}
          createButtonText={t('app.kuaizhizao.salesForecast.create')}
          onCreate={handleCreate}
          toolBarActionsAfterCreate={[
            <UniPushToolbarButton
              key={`sales-forecast-push-toolbar-${selectedRowKeys.join('-') || 'none'}`}
              disabled={selectedRowKeys.length !== 1 || !selectedForecastForToolbar}
              disabledReason={toolbarPushDisabledReason}
              menuItems={buildUniPushMenuItems([
                {
                  key: 'push-to-computation',
                  label: pushToComputationAction.label,
                  disabled: !!toolbarPushItemDisabledReason,
                  title: toolbarPushItemDisabledReason,
                  onClick: () => {
                    if (!selectedForecastForToolbar?.id || toolbarPushItemDisabledReason) return;
                    void handlePushToComputation(selectedForecastForToolbar.id);
                  },
                },
              ])}
            />,
          ]}
          showDeleteButton={viewTypeState !== 'detailTable'}
          onDelete={executeDeleteByKeys}
          deleteConfirmTitle={(count) => t('common.confirmBatchDeleteContent', { count })}
          toolBarActionsAfterDelete={[
            <UniAuditBatchMenuButton
              key="sales-forecast-batch-menu"
              selectedRowKeys={selectedRowKeys}
              selectedRecords={selectedForecastsForBatch}
              auditEnabled={auditEnabled}
              permGates={forecastPerms}
              handlers={{
                submit: submitSalesForecast,
                withdraw: withdrawSalesForecast,
                approve: approveSalesForecast,
                revoke: withdrawSalesForecastApproval,
              }}
              resolveIdFromKey={(key) => {
                const id = Number(key);
                return Number.isFinite(id) && id > 0 ? id : null;
              }}
              onSuccess={() => {
                setSelectedRowKeys([]);
                actionRef.current?.reload();
              }}
              toolBarButtonSize="middle"
            />,
            <UniCapabilityBatchButton
              key="sales-forecast-batch-print"
              selectedRowKeys={selectedRowKeys}
              selectedRecords={selectedForecastsForBatch}
              capabilityKey="print"
              permAllowed={forecastPerms.canPrint}
              batchAllowed={(records, perm) =>
                Boolean(perm) && records.some((record) => record.capabilities?.print?.allowed === true)
              }
              singleOnly
              onRun={async (id) => {
                openPrint({ documentType: 'sales_forecast', documentId: id });
              }}
              resolveId={(key) => {
                const id = Number(key);
                return Number.isFinite(id) && id > 0 ? id : null;
              }}
              labels={{
                single: t('components.uniAction.print'),
                batch: t('components.uniAction.print'),
              }}
              icon={<PrinterOutlined />}
              size="middle"
            />,
          ]}
          showImportButton={true}
          onImport={handleImport}
          importHeaders={forecastListImportTemplate.importHeaders}
          importExampleRow={forecastListImportTemplate.importExampleRow}
          importColumnOptions={forecastListImportTemplate.importColumnOptions}
          importFieldMap={forecastListImportTemplate.importHeaderMap}
          showExportButton={true}
          onExport={handleExport}
          onTableDataChange={(rows) => {
            if (dataViewModeRef.current === 'order') {
              tableRowsRef.current = rows as SalesForecast[];
            }
          }}
        />
      </ListPageTemplate>

      {forecastFormSecondaryModals}

      <SalesForecastDetailDrawer
        open={drawerVisible}
        zIndex={forecastDetailDrawerZIndex}
        onClose={() => {
          setDrawerVisible(false)
        }}
        forecast={currentForecast}
        auditRequired={auditEnabled}
        trackingRefreshKey={trackingRefreshKey}
        extra={
          currentForecast && (
            <Space size="small">
              <Tooltip title={detailCapabilityGates.update.title}>
                <span>
                  <Button
                    icon={<EditOutlined />}
                    disabled={detailCapabilityGates.update.disabled || currentForecast.id == null}
                    onClick={() => {
                      const fid = currentForecast.id;
                      if (detailCapabilityGates.update.disabled || fid == null) return;
                      setDrawerVisible(false);
                      navigate(salesForecastEditPath(fid));
                    }}
                  >
                    {t('common.edit')}
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title={detailCapabilityGates.delete.title}>
                <span>
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    disabled={detailCapabilityGates.delete.disabled || currentForecast.id == null}
                    onClick={() => {
                      const fid = currentForecast.id;
                      if (detailCapabilityGates.delete.disabled || fid == null) return;
                      handleDelete([fid]);
                    }}
                  >
                    {t('common.delete')}
                  </Button>
                </span>
              </Tooltip>
              <UniWorkflowActions
                {...rowActionKind('skip')}
                record={currentForecast}
                {...salesForecastWorkflowProps}
                onSuccess={() => {
                  if (currentForecast.id != null) {
                    refreshForecastAfterPush(currentForecast.id);
                  } else {
                    invalidateStatistics();
                    invalidateMenuBadge();
                    setTrackingRefreshKey((k) => k + 1);
                    actionRef.current?.reload();
                  }
                }}
              />
              {currentForecast.id != null && !detailCapabilityGates.print.disabled && (
                <Button
                  icon={<PrinterOutlined />}
                  onClick={() => openPrint({ documentType: 'sales_forecast', documentId: currentForecast.id! })}
                >
                  {t('components.uniAction.print')}
                </Button>
              )}
            </Space>
          )
        }
        renderBriefActions={(doc) => (
          <WarehouseTraceBriefPrimaryActions
            doc={doc}
            t={t}
            navigate={navigate}
            closeDrawer={() => {
              setDrawerVisible(false);
            }}
          />
        )}
      />

      <Modal
        title={t('app.kuaizhizao.salesOrder.pushPreviewTitle')}
        open={pushPreviewOpen}
        width={1100}
        onCancel={resetPushPreviewModal}
        okText={t('app.kuaizhizao.salesOrder.confirmPush')}
        cancelText={t('common.cancel')}
        confirmLoading={pushPreviewConfirming}
        onOk={handlePushPreviewConfirm}
        okButtonProps={{
          disabled: pushPreviewLoading || !pushPreviewData || !!pushPreviewData?.has_blocking_issues,
        }}
      >
        {pushPreviewLoading ? (
          <div style={{ minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <Spin />
            <div style={{ color: 'var(--ant-color-primary)' }}>{t('app.kuaizhizao.salesOrder.loadingPreview')}</div>
          </div>
        ) : pushPreviewData ? (
          <div>
            <p style={{ marginBottom: 12, fontWeight: 500 }}>{pushPreviewData.summary}</p>
            {pushPreviewData.has_blocking_issues ? (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message={
                  salesForecastCapabilityReasonMessage(pushPreviewData.blocking_reason, t) ||
                  t('app.kuaizhizao.salesForecast.pushBlockedStatus')
                }
              />
            ) : null}
            {pushPreviewData.items?.length > 0 ? (
              <Table
                size="small"
                dataSource={pushPreviewData.items}
                rowKey={(row) => String(row.item_id)}
                pagination={false}
                scroll={{ x: 960 }}
                columns={[
                  {
                    title: t('common.select'),
                    dataIndex: 'item_id',
                    width: 64,
                    render: (_: unknown, row: any) => {
                      const itemId = Number(row.item_id)
                      const maxQty = Number(row.max_push_quantity ?? 0)
                      const disabled =
                        !Number.isFinite(maxQty) || maxQty <= 0 || !!pushPreviewData.has_blocking_issues
                      return (
                        <Switch
                          size="small"
                          disabled={disabled}
                          checked={pushSelectedItemIds.includes(itemId)}
                        />
                      )
                    },
                  },
                  { title: t('app.kuaizhizao.quotation.colMaterialCode'), dataIndex: 'material_code', width: 120, ellipsis: true },
                  { title: t('app.kuaizhizao.quotation.colMaterialName'), dataIndex: 'material_name', width: 140, ellipsis: true },
                  { title: t('app.kuaizhizao.salesForecast.forecastQuantity'), dataIndex: 'quantity', width: 88, align: 'right', render: formatQuantity },
                  { title: t('app.kuaizhizao.salesOrder.colPushedQty'), dataIndex: 'pushed_quantity', width: 88, align: 'right', render: formatQuantity },
                  { title: t('app.kuaizhizao.salesOrder.colPushableQty'), dataIndex: 'max_push_quantity', width: 88, align: 'right', render: formatQuantity },
                  {
                    title: t('app.kuaizhizao.salesForecast.forecastDate'),
                    dataIndex: 'forecast_date',
                    width: 112,
                    render: (_: unknown, row: any) => {
                      const v = row.forecast_date || row.forecast_month
                      return v ? String(v).slice(0, 10) : '-'
                    },
                  },
                ]}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.salesForecast.pushPreviewNoLines')} />
            )}
            {pushPreviewData.tip ? (
              <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                {pushPreviewData.tip}
              </Typography.Paragraph>
            ) : null}
          </div>
        ) : null}
      </Modal>

      {PrintModal}
    </>
  )
}

/**
 * 销售预测明细汇总组件
 */
const SalesForecastFormSummary: React.FC = () => {
  const { t } = useTranslation();
  const items = AntForm.useWatch('items');
  const totalQuantity = items?.reduce((sum: number, it: any) => sum + (Number(it?.forecast_quantity) || 0), 0) || 0;

  return (
    <div style={{ marginTop: 12, padding: '12px', background: '#fafafa', borderRadius: '4px', display: 'flex', justifyContent: 'flex-end' }}>
      <span>{t('app.kuaizhizao.salesForecast.totalForecastQuantity')}: <Typography.Text strong>{formatQuantity(totalQuantity)}</Typography.Text></span>
    </div>
  );
};

