import { renderRowActionsOverflow, rowActionKind } from '../../../../../components/uni-action';
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
import { App, Button, Space, Table, Input, InputNumber, Row, Col, Form as AntForm, DatePicker, Typography, Modal, Descriptions, Tooltip, Card } from 'antd'
import { PlusOutlined, DeleteOutlined, EyeOutlined, EditOutlined, AppstoreAddOutlined, ImportOutlined, ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
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
  salesForecastHasToolbarPushActions,
  useSalesForecastCapabilities,
} from '../../../../../hooks/useDocumentCapabilities'
import { useKuaizhizaoPrintModal } from '../../../hooks/useKuaizhizaoPrintModal'
import {
  ListPageTemplate,
  DetailDrawerTemplate,
  DetailDrawerSection,
  DetailDrawerInlineFullChain,
  DRAWER_CONFIG,
  DocumentFormPageLayout,
  DocumentFormPageHeaderActions,
  DOCUMENT_DETAIL_PAGE_TITLE_STYLE,
  PAGE_SPACING,
  type StatCard,
} from '../../../../../components/layout-templates'
import { setCustomPageTitle, removeCustomPageTitle } from '../../../../../utils/customPageTitle'
import { useSubmitShortcut } from '../../../../../hooks/useSubmitShortcut'
import { buildFutureDateShortcutFieldProps, FutureDatePicker } from '../../../../../utils/futureDatePickerShortcuts'
import { UniTable } from '../../../../../components/uni-table'
import { UniAuditBatchMenuButton, UniCapabilityBatchButton } from '../../../../../components/uni-batch';
import { buildUniPushMenuItems, UniPushToolbarButton } from '../../../../../components/uni-push';
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
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../shared/documentFieldAlignment'
const LazyUniImport = lazy(() =>
  import('../../../../../components/uni-import').then((m) => ({ default: m.UniImport })),
)

const SALES_FORECAST_RESOURCE = 'kuaizhizao:sales-forecast'
const SALES_FORECAST_LIST_PATH = '/apps/kuaizhizao/sales-management/sales-forecasts'
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
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle'
import { LIST_LIFECYCLE_STAGE_FIELD } from '../../../../../utils/listLifecycleStage'
import { ListUniLifecycleCell } from '../shared/ListUniLifecycleCell'
import { createListAuditPhaseColumn } from '../shared/listAuditPhaseColumn'
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions'
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel'
import { WarehouseTraceBriefPrimaryActions } from '../../warehouse-management/WarehouseTraceBriefFooter'
import { downloadFile } from '../../../services/common'
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField'
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments'
import { resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import { formatDateTime } from '../../../../../utils/format';

export default function SalesForecastsPage() {
  const { t } = useTranslation();
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

  /** 视图切换缓存：始终请求 include_items=true，切换视图时从缓存转换，避免重复请求（与销售订单一致） */
  const lastForecastsCacheRef = useRef<{ forecasts: SalesForecast[]; total: number; paramsKey: string } | null>(null)
  const invalidateForecastCache = () => {
    lastForecastsCacheRef.current = null
  }

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
  const rowKeyToOrderIdRef = useRef<Map<string, number>>(new Map());
  const tableRowsRef = useRef<ForecastTableRow[]>([]);

  // 与 UniTable viewTypes 同步：table=单据维度；明细表格 / 帮助 走明细数据维度
  const [viewTypeState, setViewTypeState] = useState<'table' | 'detailTable' | 'help'>('table');
  const dataViewMode = viewTypeState === 'table' ? 'order' : 'detail';
  const dataViewModeRef = useRef(dataViewMode);

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
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const leaveSalesForecastFormPage = useCallback(() => {
    navigate(SALES_FORECAST_LIST_PATH);
  }, [navigate]);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false)
  const [productScope, setProductScope] = useState<'make' | 'all'>('make')
  const [importModalVisible, setImportModalVisible] = useState(false)
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
    () => createListAuditPhaseColumn<ForecastTableRow>({ t, auditEnabled }),
    [t, auditEnabled],
  )
  const forecastPerms = useResourcePermissions(SALES_FORECAST_RESOURCE)
  const permDeniedTitle = t('common.noPermission')
  const detailCapabilityGates = useSalesForecastCapabilities(currentForecast, forecastPerms, t, permDeniedTitle)
  const salesNodesEnabled = {
    sales_forecast: true,
    demand_computation: true,
  }
  const forecastTracking = useDocumentTracking(
    drawerVisible && currentForecast ? 'sales_forecast' : undefined,
    currentForecast?.id,
    trackingRefreshKey,
  );

  const toFlatRows = (data: SalesForecast[]) => {
    const map = new Map<string, number>();
    const rows: (SalesForecast & { item?: SalesForecastItem; itemIndex?: number; _rowKey?: string })[] = [];
    data.forEach((forecast) => {
      const items = forecast.items || (forecast as any).forecast_items || [];
      if (items.length === 0) {
        const rowKey = `order-${forecast.id}-empty`;
        if (forecast.id) map.set(rowKey, forecast.id);
        rows.push({ ...forecast, _rowKey: rowKey });
      } else {
        items.forEach((item: any, index: number) => {
          const rowKey = item.id ? `order-${forecast.id}-item-${item.id}` : `order-${forecast.id}-idx-${index}`;
          if (forecast.id) map.set(rowKey, forecast.id);
          rows.push({
            ...forecast,
            item,
            itemIndex: index,
            _rowKey: rowKey,
          });
        });
      }
    });
    rowKeyToOrderIdRef.current = map;
    return rows;
  };

  const renderSalesForecastRowActions = (nodes: React.ReactNode[], keyPrefix: string): React.ReactNode => {
    return renderRowActionsOverflow(nodes, keyPrefix);
  };

  useEffect(() => {
    // Basic initialization if needed
  }, [])

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
          const unit = String(row[2] || '').trim();
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
    [defaultForecastItem, defaultUnit, messageApi, t],
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
      navigate(SALES_FORECAST_LIST_PATH);
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
      navigate(SALES_FORECAST_LIST_PATH);
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

  // 处理批量导入（UniTable 内置）
  const handleImport = async (data: any[][]) => {
    try {
      const result = await importSalesForecasts(data)
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
      invalidateForecastCache()
      actionRef.current?.reload()
    } catch (e: any) {
      messageApi.error(e?.message || t('common.importFailed'))
    }
  }

  const handleImportConfirm = useCallback(
    (data: any[][]) => {
      if (isFormPage) {
        handleItemImport(data);
      } else {
        void handleImport(data);
      }
    },
    [isFormPage, handleItemImport],
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
        const filename = `${t('app.kuaizhizao.salesForecast.exportFilename', { date: new Date().toISOString().slice(0, 10) })}.xlsx`
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
        const blob = new Blob([JSON.stringify(toExport, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${t('app.kuaizhizao.salesForecast.exportFilename', { date: new Date().toISOString().slice(0, 10) })}.json`
        a.click()
        URL.revokeObjectURL(url)
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
            const mappedId = rowKeyToOrderIdRef.current.get(String(k));
            if (mappedId != null) return mappedId;
            const numericId = Number(k);
            return Number.isFinite(numericId) ? numericId : undefined;
          })
          .filter((id): id is number => id != null)
      ),
    ];
    const deleteCount = dataViewMode === 'order' ? keys.length : orderIds.length;
    const finalIds = dataViewMode === 'order' ? keys.map(k => Number(k)) : orderIds;

    if (finalIds.length === 0) {
      messageApi.warning(t('common.selectToDelete'));
      return;
    }

    try {
      for (const id of finalIds) {
        await deleteSalesForecast(id);
      }
      messageApi.success(t('common.deleteSuccess', { count: deleteCount }))
      invalidateForecastCache();
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
    const orderIds = [
      ...new Set(
        keys
          .map((k) => {
            const mappedId = rowKeyToOrderIdRef.current.get(String(k));
            if (mappedId != null) return mappedId;
            const numericId = Number(k);
            return Number.isFinite(numericId) ? numericId : undefined;
          })
          .filter((id): id is number => id != null)
      ),
    ];
    const deleteCount = dataViewMode === 'order' ? keys.length : orderIds.length;
    modalApi.confirm({
      title: t('common.confirmDelete'),
      content: t('app.kuaizhizao.salesForecast.deleteConfirmContent', { count: deleteCount }),
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
      invalidateForecastCache();
      invalidateStatistics();
      invalidateMenuBadge();
      setTrackingRefreshKey((k) => k + 1);
      if (isFormPage) {
        navigate(SALES_FORECAST_LIST_PATH)
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

  const handlePushToComputation = async (id: number) => {
    if (!salesNodesEnabled.demand_computation) {
      messageApi.warning(t('app.kuaizhizao.salesForecast.demandComputationDisabled'))
      return
    }
    modalApi.confirm({
      title: pushToComputationAction.label,
      content: t('app.kuaizhizao.salesForecast.pushToComputationConfirm'),
      onOk: async () => {
        try {
          await pushSalesForecastToComputation(id)
          messageApi.success(t('app.kuaizhizao.salesForecast.pushSuccess'))
          invalidateForecastCache();
          invalidateStatistics();
          invalidateMenuBadge();
      setTrackingRefreshKey((k) => k + 1);
      actionRef.current?.reload()
        } catch (e: any) {
          messageApi.error(e?.message || t('app.kuaizhizao.salesForecast.pushFailed'))
        }
      },
    })
  }

  const formatForecastPeriod = (period?: string) => {
    if (!period) return '-';
    const periodMap: Record<string, string> = {
      WEEKLY: t('app.kuaizhizao.salesForecast.period.weekly'),
      MONTHLY: t('app.kuaizhizao.salesForecast.period.monthly'),
      QUARTERLY: t('app.kuaizhizao.salesForecast.period.quarterly'),
    };
    return periodMap[period] || period;
  };

  type ForecastTableRow = SalesForecast & {
    item?: SalesForecastItem;
    itemIndex?: number;
    _rowKey?: string;
  };

  /** 单据级列：明细视图下首行 rowSpan 合并 */
  const orderLevelCellProps = (
    renderContent?: (value: unknown, record: ForecastTableRow) => React.ReactNode,
  ): Pick<ProColumns<ForecastTableRow>, 'render' | 'onCell'> => ({
    render: (text, record) => {
      const isFirst = record.itemIndex === undefined || record.itemIndex === 0;
      if (!isFirst && dataViewMode === 'detail') return { children: null, props: { rowSpan: 0 } };
      const content = renderContent ? renderContent(text, record) : text;
      return content;
    },
    onCell: (record) => {
      if (dataViewMode === 'order') return {};
      const isFirst = record.itemIndex === undefined || record.itemIndex === 0;
      if (isFirst) {
        const rowCount = record.items?.length || 1;
        return { rowSpan: rowCount };
      }
      return { rowSpan: 0 };
    },
  });

  const calcForecastTotalQuantity = (record: ForecastTableRow) => {
    const items = record.items || (record as { forecast_items?: SalesForecastItem[] }).forecast_items || [];
    return items.reduce((sum, item) => sum + Number(item.forecast_quantity ?? 0), 0);
  };

  const formatForecastStatus = (status?: string, reviewStatus?: string) => {
    const lifecycle = getSalesForecastLifecycle({ status, review_status: reviewStatus } as any, auditEnabled);
    if (lifecycle?.stageName) return lifecycle.stageName;
    if (!status) return '-';
    const statusMap: Record<string, string> = {
      DRAFT: t('app.kuaizhizao.salesForecast.statusDraft'),
      PENDING_REVIEW: t('app.kuaizhizao.salesForecast.statusPending'),
      AUDITED: t('app.kuaizhizao.salesForecast.statusApproved'),
      APPROVED: t('app.kuaizhizao.salesForecast.statusApproved'),
      REJECTED: t('app.kuaizhizao.salesForecast.statusRejected'),
      PUSHED: t('app.kuaizhizao.salesForecast.statusPushed'),
      CANCELLED: t('documentStatus.cancelled'),
    };
    return statusMap[status] || status;
  };

  const columns: ProColumns<ForecastTableRow>[] = [
    {
      title: t('app.kuaizhizao.salesForecast.colForecastPrimary'),
      key: 'forecast_code',
      dataIndex: 'forecast_code',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      fixed: 'left',
      fieldProps: { placeholder: t('app.kuaizhizao.salesForecast.enterForecastCode') },
      ...orderLevelCellProps((_text, record) => (
        <UniTableStackedPrimaryCell
          primary={String(record.forecast_name ?? '')}
          secondary={String(record.forecast_code ?? '')}
        />
      )),
    },
    {
      title: t('app.kuaizhizao.salesForecast.forecastName'),
      dataIndex: 'forecast_name',
      ellipsis: true,
      hideInTable: true,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.salesForecast.forecastPeriod'),
      dataIndex: 'forecast_period',
      valueType: 'select',
      width: 100,
      valueEnum: {
        WEEKLY: { text: t('app.kuaizhizao.salesForecast.period.weekly') },
        MONTHLY: { text: t('app.kuaizhizao.salesForecast.period.monthly') },
        QUARTERLY: { text: t('app.kuaizhizao.salesForecast.period.quarterly') },
      },
      ...orderLevelCellProps((_text, record) => formatForecastPeriod(record.forecast_period)),
    },
    {
      title: t('app.kuaizhizao.salesForecast.forecastType'),
      dataIndex: 'forecast_type',
      width: 100,
      hideInSearch: true,
      ...orderLevelCellProps((_text, record) => record.forecast_type || '-'),
    },
    {
      title: t('app.kuaizhizao.salesForecast.startDate'),
      dataIndex: 'start_date',
      key: 'start_end_date_stacked',
      width: 132,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
      ...orderLevelCellProps((_text, record) => {
        const startDateText = record.start_date ? formatDateTime(record.start_date, 'YYYY-MM-DD') : '-';
        const endDateText = record.end_date ? formatDateTime(record.end_date, 'YYYY-MM-DD') : '-';
        return (
          <UniTableStackedPrimaryCell
            primary={startDateText}
            secondary={endDateText}
            secondaryCopyable={false}
            uniformText
          />
        );
      }),
    },
    {
      title: t('app.kuaizhizao.salesForecast.endDate'),
      dataIndex: 'end_date',
      valueType: 'date',
      width: 120,
      hideInSearch: true,
      hideInTable: true,
      ...orderLevelCellProps((_text, record) =>
        record.end_date ? formatDateTime(record.end_date, 'YYYY-MM-DD') : '-',
      ),
    },
    {
      title: t('app.kuaizhizao.salesForecast.totalQuantity'),
      dataIndex: 'total_quantity',
      width: 100,
      align: 'right' as const,
      hideInSearch: true,
      hideInTable: dataViewMode === 'detail',
      ...orderLevelCellProps((_text, record) => calcForecastTotalQuantity(record)),
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
    {
      title: t('app.kuaizhizao.salesForecast.material'),
      key: 'material_name',
      dataIndex: ['item', 'material_name'],
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      hideInSearch: true,
      hideInTable: dataViewMode === 'order',
      render: (_, record) => (
        <MaterialStackedCell
          material_name={record.item?.material_name}
          material_code={record.item?.material_code}
          material_spec={record.item?.material_spec}
        />
      ),
    },
    {
      title: t('app.kuaizhizao.salesForecast.materialCode'),
      dataIndex: ['item', 'material_code'],
      hideInSearch: true,
      hideInTable: true,
    },
    {
      title: t('app.kuaizhizao.salesForecast.materialName'),
      dataIndex: ['item', 'material_name'],
      hideInSearch: true,
      hideInTable: true,
    },
    {
      title: t('app.kuaizhizao.salesForecast.materialSpec'),
      dataIndex: ['item', 'material_spec'],
      hideInSearch: true,
      hideInTable: true,
    },
    {
      title: t('app.kuaizhizao.salesForecast.forecastQuantity'),
      dataIndex: ['item', 'forecast_quantity'],
      width: 100,
      align: 'right' as const,
      hideInSearch: true,
      hideInTable: dataViewMode === 'order',
      render: (_, record) => record.item?.forecast_quantity ?? '-',
    },
    {
      title: t('app.kuaizhizao.salesForecast.forecastDate'),
      dataIndex: ['item', 'forecast_date'],
      width: 120,
      hideInSearch: true,
      hideInTable: dataViewMode === 'order',
      render: (_, record) =>
        record.item?.forecast_date ? formatDateTime(record.item.forecast_date, 'YYYY-MM-DD') : '-',
    },
    {
      title: t('app.kuaizhizao.salesForecast.confidenceLevel'),
      dataIndex: ['item', 'confidence_level'],
      width: 90,
      align: 'right' as const,
      hideInSearch: true,
      hideInTable: dataViewMode === 'order',
      render: (_, record) =>
        record.item?.confidence_level != null ? `${record.item.confidence_level}%` : '-',
    },
    {
      title: t('common.createdAt'),
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 160,
      hideInSearch: true,
      ...orderLevelCellProps(),
    },
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at',
      valueType: 'dateTime',
      width: 160,
      hideInSearch: true,
      ...orderLevelCellProps(),
    },
    ...(salesForecastAuditColumn ? [salesForecastAuditColumn] : []),
    {
      title: t('app.kuaizhizao.salesForecast.lifecycleColumn'),
      dataIndex: LIST_LIFECYCLE_STAGE_FIELD,
      valueType: 'select',
      align: 'left' as const,
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
      ...orderLevelCellProps((_text, record) => (
        <ListUniLifecycleCell
          lifecycle={getSalesForecastLifecycle(record, auditEnabled, t)}
          withSubStages
        />
      )),
    },
    {
      title: t('common.actions'),
      valueType: 'option',
      fixed: 'right',
      width: 200,
      render: (_, record) => {
        const isFirst = record.itemIndex === undefined || record.itemIndex === 0;
        if (!isFirst && dataViewMode === 'detail') return { children: null, props: { rowSpan: 0 } };
        
        const canEdit = record.capabilities?.update?.allowed === true && forecastPerms.canUpdate
        const canDelete = record.capabilities?.delete?.allowed === true && forecastPerms.canDelete
        const parts: React.ReactNode[] = [
          <Button {...rowActionKind('read')} type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>
            {t('common.detail')}
          </Button>,
        ];
        if (canEdit) {
          parts.push(
            <Button
              {...rowActionKind('update')}
              key="edit"
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => record.id != null && handleEdit(record.id)}
            >
              {t('common.edit')}
            </Button>,
          );
        }
        parts.push(
          <UniWorkflowActions {...rowActionKind('skip')}
            key="workflow-actions"
            record={record}
            entityName={t('app.kuaizhizao.salesForecast.title')}
            statusField="status"
            reviewStatusField="review_status"
            draftStatuses={['草稿', 'DRAFT']}
            pendingStatuses={['待审核', 'PENDING_REVIEW']}
            approvedStatuses={['已审核', 'AUDITED', 'APPROVED', '审核通过', '通过', '已通过']}
            rejectedStatuses={['已驳回', 'REJECTED', '审核驳回']}
            theme="link"
            size="small"
            onSuccess={() => {
              invalidateForecastCache();
              invalidateStatistics();
              invalidateMenuBadge();
      setTrackingRefreshKey((k) => k + 1);
      actionRef.current?.reload();
            }}
          />
        );
        if (canDelete) {
          parts.push(
            <Button
              {...rowActionKind('delete')}
              key="del"
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => record.id != null && handleDelete([record.id])}
            >
              {t('common.delete')}
            </Button>,
          );
        }
        return renderSalesForecastRowActions(parts, `sf-${record.id ?? record._rowKey ?? 'row'}`);
      },
      onCell: (record) => {
        if (dataViewMode === 'order') return {};
        const isFirst = record.itemIndex === undefined || record.itemIndex === 0;
        if (isFirst) {
          const rowCount = record.items?.length || 1;
          return { rowSpan: rowCount };
        }
        return { rowSpan: 0 };
      },
    },
  ];
  const alignedColumns = useMemo(
    () => alignProColumns(columns, SALES_DOC_LIST_FIELD_RANK),
    [columns],
  );

  const selectedForecastForToolbar = useMemo(() => {
    if (selectedRowKeys.length !== 1) return null;
    const selectedKey = String(selectedRowKeys[0]);
    return tableRowsRef.current.find((row) => String(row.id ?? row._rowKey ?? '') === selectedKey) ?? null;
  }, [selectedRowKeys]);

  const selectedForecastsForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => tableRowsRef.current.find((row) => String(row.id ?? row._rowKey ?? '') === String(key)))
        .filter((row): row is ForecastTableRow => row != null),
    [selectedRowKeys],
  );

  const toolbarPushDisabledReason = useMemo(() => {
    if (!selectedForecastForToolbar) return '';
    const cap = selectedForecastForToolbar.capabilities?.push_computation;
    if (!cap || cap.allowed) return '';
    return salesForecastCapabilityReasonMessage(cap.reason, t);
  }, [selectedForecastForToolbar, t]);

  const canUseToolbarPush =
    selectedRowKeys.length === 1 &&
    !!selectedForecastForToolbar?.id &&
    salesNodesEnabled.demand_computation &&
    salesForecastHasToolbarPushActions(selectedForecastForToolbar);

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
                    title: t('app.kuaizhizao.salesForecast.unit'),
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
                    title: t('app.kuaizhizao.salesForecast.notes'),
                    dataIndex: 'notes',
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'notes']} style={{ margin: 0 }}>
                        <Input placeholder={t('app.kuaizhizao.salesForecast.notes')} size={DOCUMENT_DETAIL_CONTROL_SIZE} />
                      </AntForm.Item>
                    ),
                  },
                ]}
          disabledAdd
          initialValue={{ ...defaultForecastItem }}
          tableProps={DOCUMENT_DETAIL_TABLE_PROPS}
        />
        <SalesForecastFormSummary />
        <DocumentAttachmentsField category="sales_forecast_attachments" />
        <ProFormTextArea name="notes" label={t('app.kuaizhizao.salesForecast.notes')} placeholder={t('app.kuaizhizao.salesForecast.notesPlaceholder')} />
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

      <Suspense fallback={null}>
        <LazyUniImport
          visible={importModalVisible}
          onCancel={() => setImportModalVisible(false)}
          onConfirm={handleImportConfirm}
          title={isFormPage ? t('app.kuaizhizao.salesForecast.importItemsTitle') : t('app.kuaizhizao.salesForecast.importTitle')}
          headers={isFormPage
            ? [
                t('app.kuaizhizao.salesForecast.importHeaderMaterialCode'),
                t('app.kuaizhizao.salesForecast.importHeaderSpec'),
                t('app.kuaizhizao.salesForecast.importHeaderUnit'),
                t('app.kuaizhizao.salesForecast.importHeaderForecastQuantity'),
                t('app.kuaizhizao.salesForecast.importHeaderForecastDate'),
                t('app.kuaizhizao.salesForecast.importHeaderNotes'),
              ]
            : [
                t('app.kuaizhizao.salesForecast.importHeaderMaterialCode'),
                t('app.kuaizhizao.salesForecast.importHeaderForecastQuantity'),
                t('app.kuaizhizao.salesForecast.importHeaderForecastDate'),
                t('app.kuaizhizao.salesForecast.importHeaderNotes'),
              ]}
          exampleRow={isFormPage
            ? [
                t('app.kuaizhizao.salesForecast.importExampleMaterialCode'),
                t('app.kuaizhizao.salesForecast.importExampleSpec'),
                t('app.kuaizhizao.salesForecast.importExampleUnit'),
                t('app.kuaizhizao.salesForecast.importExampleQuantity'),
                t('app.kuaizhizao.salesForecast.importExampleDate'),
                t('app.kuaizhizao.salesForecast.importExampleNotes'),
              ]
            : [
                t('app.kuaizhizao.salesForecast.importExampleMaterialCode'),
                t('app.kuaizhizao.salesForecast.importExampleQuantity'),
                t('app.kuaizhizao.salesForecast.importExampleDate'),
                t('app.kuaizhizao.salesForecast.importExampleNotes'),
              ]}
        />
      </Suspense>

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
          <Card styles={{ body: { padding: PAGE_SPACING.PADDING } }}>
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
          </Card>
        </DocumentFormPageLayout>
        {forecastFormSecondaryModals}
      </>
    );
  }

  return (
    <>
      <ListPageTemplate statCards={statCards}>
        <UniTable<any>
          columnPersistenceId="apps.kuaizhizao.pages.sales-management.sales-forecasts"
          actionRef={actionRef}
          formRef={tableSearchFormRef}
          rowKey={viewTypeState === 'table' ? 'id' : '_rowKey'}
          columns={alignedColumns}
          viewTypes={['table', 'detailTable', 'help']}
          defaultViewType="table"
          helpViewConfig={{
            content: (
              <div style={{ lineHeight: 1.8 }}>
                <p><strong>{t('app.kuaizhizao.salesForecast.helpViewTable')}</strong>: {t('app.kuaizhizao.salesForecast.helpViewTableDesc')}</p>
                <p><strong>{t('app.kuaizhizao.salesForecast.helpViewDetail')}</strong>: {t('app.kuaizhizao.salesForecast.helpViewDetailDesc')}</p>
              </div>
            ),
          }}
          onViewTypeChange={(v) => {
            const nextMode = v === 'table' ? 'order' : 'detail';
            dataViewModeRef.current = nextMode;
            setViewTypeState(v as 'table' | 'detailTable' | 'help');
            setTimeout(() => actionRef.current?.reload(), 0);
          }}
          request={async (params, _sort, _filter, searchFormValues) => {
            const sf = searchFormValues ?? {};
            const apiParams: SalesForecastListParams = {
              skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
              limit: params.pageSize ?? 20,
              include_items: true,
            };
            if (sf.forecast_period) apiParams.forecast_period = sf.forecast_period as string;
            const fc = sf.forecast_code != null ? String(sf.forecast_code).trim() : '';
            if (fc) apiParams.keyword = fc;
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

            const paramsKey = JSON.stringify(apiParams);

            try {
              const res = await listSalesForecasts(apiParams);
              const forecasts: SalesForecast[] = Array.isArray(res.data) ? res.data : [];
              const total: number = res.total ?? forecasts.length;
              lastForecastsCacheRef.current = { forecasts, total, paramsKey };

              const mode = dataViewModeRef.current;
              if (mode === 'order') {
                const map = new Map<string, number>();
                forecasts.forEach((f) => {
                  if (f.id != null) map.set(String(f.id), f.id);
                });
                rowKeyToOrderIdRef.current = map;
                return { data: forecasts, success: true, total };
              }
              return { data: toFlatRows(forecasts), success: true, total };
            } catch (e: any) {
              messageApi.error(e?.message || t('common.loadFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          showAdvancedSearch={true}
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
              disabled={!canUseToolbarPush}
              disabledTip={toolbarPushDisabledReason || undefined}
              menuItems={buildUniPushMenuItems([
                {
                  key: 'push-to-computation',
                  label: pushToComputationAction.label,
                  onClick: () => {
                    if (!selectedForecastForToolbar?.id) {
                      messageApi.warning(t('app.kuaizhizao.salesForecast.selectOne'));
                      return;
                    }
                    void handlePushToComputation(selectedForecastForToolbar.id);
                  },
                },
              ])}
            />,
          ]}
          showDeleteButton
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
                const raw = rowKeyToOrderIdRef.current.get(String(key));
                const id = raw ?? Number(key);
                return Number.isFinite(id) && id > 0 ? id : null;
              }}
              onSuccess={() => {
                setSelectedRowKeys([]);
                invalidateForecastCache();
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
                const raw = rowKeyToOrderIdRef.current.get(String(key));
                const id = raw ?? Number(key);
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
          onImport={() => setImportModalVisible(true)}
          showExportButton={true}
          onExport={handleExport}
          onTableDataChange={(rows) => {
            tableRowsRef.current = rows;
          }}
        />
      </ListPageTemplate>

      {forecastFormSecondaryModals}

      <DetailDrawerTemplate
        title={`${t('app.kuaizhizao.salesForecast.detailTitle')}${currentForecast?.forecast_code ? ` - ${currentForecast.forecast_code}` : ''}`}
        open={drawerVisible}
        zIndex={forecastDetailDrawerZIndex}
        onClose={() => {
          setDrawerVisible(false)
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        dataSource={currentForecast || {}}
        footer={undefined}
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
              <UniWorkflowActions {...rowActionKind('skip')}
                record={currentForecast}
                entityName={t('app.kuaizhizao.salesForecast.title')}
                statusField="status"
                reviewStatusField="review_status"
                draftStatuses={['草稿', 'DRAFT']}
                pendingStatuses={['待审核', 'PENDING_REVIEW']}
                approvedStatuses={['已审核', 'AUDITED', 'APPROVED', '审核通过', '通过', '已通过']}
                rejectedStatuses={['已驳回', 'REJECTED', '审核驳回']}
                onSuccess={() => {
                  invalidateForecastCache();
                  invalidateStatistics();
                  invalidateMenuBadge();
      setTrackingRefreshKey((k) => k + 1);
      actionRef.current?.reload();
                  setDrawerVisible(false);
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
      >
        {currentForecast && (
          <>
            <DetailDrawerSection title={t('app.uniDetail.sectionBasic')}>
              <Descriptions
                column={3}
                size="small"
                items={[
                  { key: 'forecast_code', label: t('app.kuaizhizao.salesForecast.forecastCode'), children: currentForecast.forecast_code || '-' },
                  { key: 'forecast_name', label: t('app.kuaizhizao.salesForecast.forecastName'), children: currentForecast.forecast_name || '-' },
                  { key: 'forecast_type', label: t('app.kuaizhizao.salesForecast.forecastType'), children: currentForecast.forecast_type || '-' },
                  { key: 'forecast_period', label: t('app.kuaizhizao.salesForecast.forecastPeriod'), children: formatForecastPeriod(currentForecast.forecast_period) },
                  { key: 'start_date', label: t('app.kuaizhizao.salesForecast.startDate'), children: currentForecast.start_date || '-' },
                  { key: 'end_date', label: t('app.kuaizhizao.salesForecast.endDate'), children: currentForecast.end_date || '-' },
                  { key: 'status', label: t('app.kuaizhizao.salesForecast.status'), children: formatForecastStatus(currentForecast.status, currentForecast.review_status) },
                  { key: 'notes', label: t('app.kuaizhizao.salesForecast.notes'), children: currentForecast.notes || '-', span: 3 },
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title={t('app.uniDetail.sectionCollaboration')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {(() => {
                  const lifecycle = getSalesForecastLifecycle(currentForecast, auditEnabled, t);
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
                {currentForecast.id != null ? (
                  <DetailDrawerInlineFullChain
                    documentType="sales_forecast"
                    documentId={currentForecast.id}
                    active={drawerVisible}
                    selfDocumentId={currentForecast.id}
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
                ) : null}
              </div>
            </DetailDrawerSection>

            <DetailDrawerSection title={t('app.uniDetail.sectionLines')}>
              {(currentForecast.items || []).length > 0 ? (
                <div style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden' }}>
                  <Table
                    size="small"
                    rowKey="id"
                    tableLayout="fixed"
                    style={{ minWidth: 760 }}
                    dataSource={currentForecast.items || []}
                    pagination={false}
                    columns={[
                      { title: t('app.kuaizhizao.salesForecast.materialCode'), dataIndex: 'material_code', width: 140 },
                      { title: t('app.kuaizhizao.salesForecast.materialName'), dataIndex: 'material_name', width: 180, ellipsis: true },
                      { title: t('app.kuaizhizao.salesForecast.forecastQuantity'), dataIndex: 'forecast_quantity', width: 120, align: 'right' },
                      { title: t('app.kuaizhizao.salesForecast.forecastDate'), dataIndex: 'forecast_date', width: 120 },
                    ]}
                  />
                </div>
              ) : (
                <Typography.Text type="secondary">{t('app.kuaizhizao.salesForecast.emptyItems')}</Typography.Text>
              )}
            </DetailDrawerSection>

            <DetailDrawerSection title={t('app.uniDetail.sectionTimeline')}>
              {forecastTracking.data ? (
                <DocumentTrackingTimelineBody data={forecastTracking.data} />
              ) : (
                <Typography.Text type="secondary">{t('app.kuaizhizao.salesForecast.emptyTimeline')}</Typography.Text>
              )}
            </DetailDrawerSection>
          </>
        )}
      </DetailDrawerTemplate>
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
      <span>{t('app.kuaizhizao.salesForecast.totalForecastQuantity')}: <Typography.Text strong>{totalQuantity}</Typography.Text></span>
    </div>
  );
};

