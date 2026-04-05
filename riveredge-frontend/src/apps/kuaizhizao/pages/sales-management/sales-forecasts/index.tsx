/**
 * 销售预测页面
 *
 * 独立于需求管理的销售预测功能，使用销售预测专用 API 与服务。
 *
 * @author RiverEdge Team
 * @date 2026-02-02
 */

import React, { useRef, useState, useEffect, useCallback } from 'react'
import { ActionType, ProColumns, ProForm, ProFormText, ProFormDatePicker, ProFormTextArea, ProFormInstance, ProFormSelect } from '@ant-design/pro-components'
import { App, Button, Space, Table, Input, InputNumber, Row, Col, Form as AntForm, DatePicker, Typography, Modal, Dropdown, Descriptions } from 'antd'
import { PlusOutlined, DeleteOutlined, EyeOutlined, EditOutlined, ArrowDownOutlined, ImportOutlined, AppstoreAddOutlined } from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { theme as AntdTheme } from 'antd'
import { StatCardTrendArea } from '../../../../../components/common/StatCardTrendArea'
import { usePageMetrics } from '../../../../../hooks/usePageMetrics'
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, DetailDrawerSection, DRAWER_CONFIG, type StatCard } from '../../../../../components/layout-templates'
import { getBusinessConfig } from '../../../../../services/businessConfig'
import { UniTable } from '../../../../../components/uni-table'
import { UniMaterialSelect } from '../../../../../components/uni-material-select'
import { MaterialBatchPickerModal } from '../../../../../components/material-batch-picker-modal'
import { UniImport } from '../../../../../components/uni-import'
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
  withdrawSalesForecastApproval,
  pushSalesForecastToMrp,
  importSalesForecasts,
  exportSalesForecasts,
  getSalesForecastStatistics,
  type SalesForecast,
  type SalesForecastItem,
} from '../../../services/sales-forecast'
import dayjs from 'dayjs'
import {
  generateCode,
  testGenerateCode,
  getCodeRulePageConfig,
} from '../../../../../services/codeRule'
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage'
import { getSalesForecastLifecycle } from '../../../utils/salesForecastLifecycle'
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle'
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions'
import { DocumentTrackingRelationsBody, DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel'
import { downloadFile } from '../../../services/common'



export default function SalesForecastsPage() {
  const SALES_FORECAST_ROW_ACTIONS_INLINE_MAX = 3;
  const { t } = useTranslation();
  const { message: messageApi, modal: modalApi } = App.useApp()
  const navigate = useNavigate();
  const formRef = useRef<ProFormInstance>();
  /** 表格搜索表单 ref，用于 statCard 点击时设置筛选并刷新 */
  const tableSearchFormRef = useRef<any>(null);
  const [modalVisible, setModalVisible] = useState(false)
  const tableRef = useRef<ActionType>();
  const queryClient = useQueryClient();
  const location = useLocation();

  const invalidateMenuBadge = () => { queryClient.invalidateQueries({ queryKey: ['menuBadgeCounts'] }); };
  const invalidateStatistics = () => {
    queryClient.invalidateQueries({ queryKey: ['salesForecastStatistics'] });
    queryClient.invalidateQueries({ queryKey: ['pageMetrics', location.pathname] });
  };

  const { statCards: pageMetricCards, hasConfig: hasPageMetricConfig } = usePageMetrics();
  const { data: statistics } = useQuery({
    queryKey: ['salesForecastStatistics'],
    queryFn: () => getSalesForecastStatistics(),
  });

  const { token } = AntdTheme.useToken();
  const rowKeyToOrderIdRef = useRef<Map<string, number>>(new Map());

  const [viewType, setViewType] = useState<'table' | 'detailTable'>('detailTable')
  /** 视图模式 ref：切换时同步更新，确保 reload 时 request 使用正确模式 */
  const viewModeRef = useRef<'order' | 'item'>(viewType === 'table' ? 'order' : 'item');
  const viewMode = viewType === 'table' ? 'order' : 'item';
  viewModeRef.current = viewMode;

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
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false)
  const [importModalVisible, setImportModalVisible] = useState(false)
  const [matrixModalVisible, setMatrixModalVisible] = useState(false)
  const [matrixMonths, setMatrixMonths] = useState<dayjs.Dayjs[]>([])
  const [matrixRows, setMatrixRows] = useState<any[]>([])
  const [auditEnabled, setAuditEnabled] = useState(true)
  const [salesNodesEnabled, setSalesNodesEnabled] = useState({
    sales_forecast: true,
    demand_computation: true,
  })
  const forecastTracking = useDocumentTracking(
    drawerVisible && currentForecast ? 'sales_forecast' : undefined,
    currentForecast?.id
  );

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await getBusinessConfig()
        const enabled = config.parameters?.sales?.audit_enabled === true
        setAuditEnabled(enabled)
        const nodes = config?.nodes || {}
        setSalesNodesEnabled({
          sales_forecast: nodes?.sales_forecast?.enabled !== false,
          demand_computation: nodes?.demand_computation?.enabled !== false,
        })
      } catch (error) {
        console.error('Failed to load business config:', error)
        setAuditEnabled(true)
        setSalesNodesEnabled({
          sales_forecast: true,
          demand_computation: true,
        })
      }
    }
    loadConfig()
  }, [])

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
    const wrapped = nodes.map((node, i) => <span key={`${keyPrefix}-${i}`}>{node}</span>);
    if (wrapped.length <= SALES_FORECAST_ROW_ACTIONS_INLINE_MAX) return <Space size="small" wrap>{wrapped}</Space>;
    return (
      <Space size="small" wrap>
        {wrapped.slice(0, SALES_FORECAST_ROW_ACTIONS_INLINE_MAX)}
        <Dropdown
          trigger={['click']}
          menu={{
            items: wrapped.slice(SALES_FORECAST_ROW_ACTIONS_INLINE_MAX).map((node, i) => ({
              key: `${keyPrefix}-more-${i}`,
              label: node,
            })),
          }}
        >
          <Button type="link" size="small">更多</Button>
        </Dropdown>
      </Space>
    );
  };

  useEffect(() => {
    // Basic initialization if needed
  }, [])

  /**
   * 处理新建销售预测
   * 参考销售订单：先打开弹窗，再请求 testGenerateCode 预填编号（不占用序号）
   */
  const defaultForecastItem = {
    material_id: undefined,
    material_code: '',
    material_name: '',
    material_spec: '',
    material_unit: '件',
    forecast_quantity: 0,
    forecast_date: dayjs(),
    confidence_level: 1.0,
    forecast_method: 'MANUAL',
  }

  const appendForecastItemsFromMaterials = useCallback(
    (selected: Material[]) => {
      const current = formRef.current?.getFieldValue('items') ?? []
      const newRows = selected.map((m) => ({
        ...defaultForecastItem,
        material_id: m.id,
        material_code: m.mainCode ?? m.code ?? '',
        material_name: m.name ?? '',
        material_spec: m.specification ?? '',
        material_unit: m.baseUnit ?? '件',
      }))
      // 如果当前只有一行且未选择物料，则替换该行
      if (current.length === 1 && !current[0].material_id && !current[0].material_code) {
        formRef.current?.setFieldsValue({ items: newRows })
      } else {
        formRef.current?.setFieldsValue({ items: [...current, ...newRows] })
      }
      messageApi.success(t('app.kuaizhizao.common.materialBatchAdded', { count: selected.length }))
    },
    [messageApi, t]
  )

  /**
   * 销售预测明细汇总组件
   */
  const SalesForecastFormSummary: React.FC = () => {
    const items = AntForm.useWatch('items');
    const totalQuantity = items?.reduce((sum: number, it: any) => sum + (Number(it?.forecast_quantity) || 0), 0) || 0;

    return (
      <div style={{ marginTop: 12, padding: '12px', background: '#fafafa', borderRadius: '4px', display: 'flex', justifyContent: 'flex-end' }}>
        <span>{t('app.kuaizhizao.salesForecast.totalQuantity') || '总预测数量'}: <Typography.Text strong>{totalQuantity}</Typography.Text></span>
      </div>
    );
  };

  const handleCreate = async () => {
    if (!salesNodesEnabled.sales_forecast) {
      messageApi.warning('销售预测节点未启用，无法新建')
      return
    }
    setIsEdit(false);
    setCurrentId(null);
    setPreviewCode(null);
    setEffectiveRuleCode(null);
    setEffectiveAutoGen(null);
    setModalVisible(true);
    
    // 默认值设置
    setTimeout(() => {
      formRef.current?.setFieldsValue({
        items: [defaultForecastItem],
        forecast_type: 'MTS',
      });
    }, 100);

    // 自动编号逻辑：与销售订单看齐
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
      } catch (error: any) {
        console.warn('销售预测编号预生成失败:', error);
        setPreviewCode(null);
      }
    } else {
      setPreviewCode(null);
      setEffectiveRuleCode(null);
      setEffectiveAutoGen(false);
    }
  };

  const openMatrixEntry = () => {
    const rawItems = formRef.current?.getFieldValue('items') ?? []
    const currentItems = Array.isArray(rawItems) ? rawItems : []
    if (!currentItems.length) {
      messageApi.warning('请先添加至少一个物料明细')
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
          material_unit: it.material_unit ?? '件',
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
      messageApi.warning('当前明细缺少有效物料，无法矩阵录入')
      return
    }

    setMatrixMonths(months)
    setMatrixRows(rows)
    setMatrixModalVisible(true)
  }

  const applyMatrixEntry = () => {
    const rows = Array.isArray(matrixRows) ? matrixRows : []
    if (!rows.length) {
      messageApi.warning('矩阵为空，无法应用')
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
          material_unit: row.material_unit || '件',
          forecast_quantity: qty,
          forecast_date: month.startOf('month'),
          confidence_level: 1.0,
          forecast_method: 'MANUAL',
        })
      })
    })
    if (!nextItems.length) {
      messageApi.warning('请至少录入一个大于0的预测数量')
      return
    }
    formRef.current?.setFieldsValue({ items: nextItems })
    setMatrixModalVisible(false)
    messageApi.success(`已从矩阵生成 ${nextItems.length} 条预测明细`)
  }

  const handleEdit = async (id: number) => {
    setIsEdit(true)
    setCurrentId(id)
    setModalVisible(true)
    try {
      const [data, itemsRes] = await Promise.all([getSalesForecast(id), getSalesForecastItems(id)])
      const items = Array.isArray(itemsRes) ? itemsRes : []
      const itemsForm = items.map((it: SalesForecastItem) => ({
        ...it,
        forecast_date: it.forecast_date ? dayjs(it.forecast_date) : undefined,
      }))
      if (formRef.current) {
        formRef.current.setFieldsValue({
          ...data,
          items: itemsForm,
        })
      }
    } catch (e: any) {
      messageApi.error(t('common.loadFailed') + ': ' + (e.message || ''))
    }
  }

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
      tableRef.current?.reload()
    } catch (e: any) {
      messageApi.error(e?.message || t('common.importFailed'))
    }
  }

  // 处理批量导出（UniTable 内置）
  const handleExport = async (
    type: 'selected' | 'currentPage' | 'all',
    selectedRowKeys?: React.Key[],
    currentPageData?: SalesForecast[]
  ) => {
    try {
      if (type === 'all') {
        const blob = await exportSalesForecasts()
        const filename = `销售预测_${new Date().toISOString().slice(0, 10)}.xlsx`
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
        a.download = `销售预测_${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        URL.revokeObjectURL(url)
        messageApi.success(t('common.exportCountSuccess', { count: toExport.length }))
      }
    } catch (e: any) {
      messageApi.error((e as Error).message || t('common.exportFailed'))
    }
  }

  const handleDelete = async (keys: React.Key[]) => {
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
    const deleteCount = viewMode === 'order' ? keys.length : orderIds.length;
    const finalIds = viewMode === 'order' ? keys.map(k => Number(k)) : orderIds;

    if (finalIds.length === 0) {
      messageApi.warning(t('common.selectToDelete'));
      return;
    }

    modalApi.confirm({
      title: t('common.confirmDelete'),
      content: t('app.kuaizhizao.salesForecast.deleteConfirmContent', { count: deleteCount }),
      okText: t('common.delete'),
      okButtonProps: { danger: true },
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          for (const id of finalIds) {
            await deleteSalesForecast(id);
          }
          messageApi.success(t('common.deleteSuccess', { count: deleteCount }))
          tableRef.current?.reload()
          setSelectedRowKeys([])
          if (tableRef.current?.clearSelected) tableRef.current.clearSelected();
          if (drawerVisible && currentForecast?.id && finalIds.includes(currentForecast.id)) {
            setDrawerVisible(false);
            setCurrentForecast(null);
          }
        } catch (e: any) {
          messageApi.error(t('common.deleteFailed') + ': ' + (e.message || ''))
        }
      },
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
        messageApi.warning('销售预测节点未启用，无法创建')
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
        status: isDraft ? '草稿' : undefined,
      }
      if (isEdit && currentId) {
        const res = await updateSalesForecast(currentId, { ...basePayload, items })
        const syncTip = t('app.kuaizhizao.salesForecast.syncTip')
        messageApi.success(res?.demand_synced ? `${t('common.updateSuccess')}。${syncTip}` : t('common.updateSuccess'))
      } else {
        await createSalesForecast({
          ...basePayload,
          forecast_code: forecastCode,
          items,
        } as SalesForecast)
        messageApi.success(isDraft ? t('app.kuaizhizao.salesForecast.draftSaved') : t('common.createSuccess'))
      }
      setModalVisible(false)
      setEffectiveRuleCode(null)
      setEffectiveAutoGen(null)
      invalidateStatistics();
      invalidateMenuBadge();
      tableRef.current?.reload()
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

  const handlePushToMrp = async (id: number) => {
    if (!salesNodesEnabled.demand_computation) {
      messageApi.warning('需求计算节点未启用，无法下推')
      return
    }
    modalApi.confirm({
      title: t('app.kuaizhizao.salesForecast.pushToMrp'),
      content: t('app.kuaizhizao.salesForecast.pushToMrpConfirm'),
      onOk: async () => {
        try {
          await pushSalesForecastToMrp(id)
          messageApi.success(t('app.kuaizhizao.salesForecast.pushSuccess'))
          invalidateStatistics();
          invalidateMenuBadge();
          tableRef.current?.reload()
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

  const formatForecastStatus = (status?: string, reviewStatus?: string) => {
    const lifecycle = getSalesForecastLifecycle({ status, review_status: reviewStatus } as any);
    if (lifecycle?.stageName) return lifecycle.stageName;
    if (!status) return '-';
    const statusMap: Record<string, string> = {
      DRAFT: '草稿',
      PENDING_REVIEW: '待审核',
      AUDITED: '已审核',
      APPROVED: '已审核',
      REJECTED: '已驳回',
      PUSHED: '已下推',
      CANCELLED: '已取消',
    };
    return statusMap[status] || status;
  };

  const columns: ProColumns<any>[] = [
    {
      title: t('app.kuaizhizao.salesForecast.forecastCode'),
      dataIndex: 'forecast_code',
      copyable: true,
      fixed: 'left',
      width: 160,
      render: (text, record) => {
        const isFirst = record.itemIndex === undefined || record.itemIndex === 0;
        if (!isFirst && viewMode === 'item') return { children: null, props: { rowSpan: 0 } };
        return text;
      },
      onCell: (record) => {
        if (viewMode === 'order') return {};
        const isFirst = record.itemIndex === undefined || record.itemIndex === 0;
        if (isFirst) {
          const rowCount = record.items?.length || 1;
          return { rowSpan: rowCount };
        }
        return { rowSpan: 0 };
      },
    },
    {
      title: t('app.kuaizhizao.salesForecast.forecastName'),
      dataIndex: 'forecast_name',
      ellipsis: true,
      width: 200,
      hideInSearch: true,
      render: (text, record) => {
        const isFirst = record.itemIndex === undefined || record.itemIndex === 0;
        if (!isFirst && viewMode === 'item') return { children: null, props: { rowSpan: 0 } };
        return text;
      },
      onCell: (record) => {
        if (viewMode === 'order') return {};
        const isFirst = record.itemIndex === undefined || record.itemIndex === 0;
        if (isFirst) {
          const rowCount = record.items?.length || 1;
          return { rowSpan: rowCount };
        }
        return { rowSpan: 0 };
      },
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
      render: (text, record) => {
        const isFirst = record.itemIndex === undefined || record.itemIndex === 0;
        if (!isFirst && viewMode === 'item') return { children: null, props: { rowSpan: 0 } };
        return text;
      },
      onCell: (record) => {
        if (viewMode === 'order') return {};
        const isFirst = record.itemIndex === undefined || record.itemIndex === 0;
        if (isFirst) {
          const rowCount = record.items?.length || 1;
          return { rowSpan: rowCount };
        }
        return { rowSpan: 0 };
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
    {
      title: t('common.createdAt'),
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 160,
      hideInSearch: true,
      render: (text, record) => {
        const isFirst = record.itemIndex === undefined || record.itemIndex === 0;
        if (!isFirst && viewMode === 'item') return { children: null, props: { rowSpan: 0 } };
        return text;
      },
      onCell: (record) => {
        if (viewMode === 'order') return {};
        const isFirst = record.itemIndex === undefined || record.itemIndex === 0;
        if (isFirst) {
          const rowCount = record.items?.length || 1;
          return { rowSpan: rowCount };
        }
        return { rowSpan: 0 };
      },
    },
    {
      title: t('app.kuaizhizao.salesForecast.lifecycleStatus'),
      dataIndex: 'lifecycle',
      hideInSearch: true,
      width: 132,
      align: 'center',
      fixed: 'right',
      render: (_, record) => {
        const isFirst = record.itemIndex === undefined || record.itemIndex === 0;
        if (!isFirst && viewMode === 'item') return { children: null, props: { rowSpan: 0 } };
        const lifecycle = getSalesForecastLifecycle(record);
        return (
          <UniLifecycle
            percent={lifecycle.percent}
            stageName={lifecycle.stageName}
            status={lifecycle.status}
            showLabel
            size="small"
            showCircleTooltip={false}
          />
        );
      },
      onCell: (record) => {
        if (viewMode === 'order') return {};
        const isFirst = record.itemIndex === undefined || record.itemIndex === 0;
        if (isFirst) {
          const rowCount = record.items?.length || 1;
          return { rowSpan: rowCount };
        }
        return { rowSpan: 0 };
      },
    },
    {
      title: t('common.actions'),
      valueType: 'option',
      fixed: 'right',
      width: 200,
      render: (_, record) => {
        const isFirst = record.itemIndex === undefined || record.itemIndex === 0;
        if (!isFirst && viewMode === 'item') return { children: null, props: { rowSpan: 0 } };
        
        const lifecycle = getSalesForecastLifecycle(record);
        const canEdit = ['草稿', '待审核', '已驳回'].includes(lifecycle.stageName ?? '');
        const canDelete = ['草稿', '待审核'].includes(lifecycle.stageName ?? '');
        const parts: React.ReactNode[] = [
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>
            {t('common.detail')}
          </Button>,
        ];
        if (canEdit) {
          parts.push(
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record.id)}>
              {t('common.edit')}
            </Button>
          );
        }
        parts.push(
          <UniWorkflowActions
            key="workflow-actions"
            record={record}
            entityName={t('app.kuaizhizao.salesForecast.title')}
            statusField="status"
            reviewStatusField="review_status"
            draftStatuses={['草稿', 'DRAFT']}
            pendingStatuses={['待审核', 'PENDING_REVIEW']}
            approvedStatuses={['已审核', 'AUDITED', 'APPROVED', '审核通过', '通过', '已通过']}
            rejectedStatuses={['已驳回', 'REJECTED', '审核驳回']}
            autoApproveWhenSubmit={!auditEnabled}
            theme="link"
            size="small"
            actions={{
              submit: async (id) => submitSalesForecast(id),
              approve: approveSalesForecast,
              revoke: withdrawSalesForecastApproval,
            }}
            onSuccess={() => {
              invalidateStatistics();
              invalidateMenuBadge();
              tableRef.current?.reload();
            }}
          />
        );
        if (lifecycle.stageName === '已审核') {
          parts.push(
            <Button
              type="link"
              size="small"
              icon={<ArrowDownOutlined />}
              disabled={!salesNodesEnabled.demand_computation}
              onClick={() => handlePushToMrp(record.id)}
            >
              {t('app.kuaizhizao.salesForecast.pushToMrp')}
            </Button>
          );
        }
        if (canDelete) {
          parts.push(
            <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => handleDelete([record.id])}>
              {t('common.delete')}
            </Button>
          );
        }
        return renderSalesForecastRowActions(parts, `sales-forecast-${record.id ?? 'row'}`);
      },
      onCell: (record) => {
        if (viewMode === 'order') return {};
        const isFirst = record.itemIndex === undefined || record.itemIndex === 0;
        if (isFirst) {
          const rowCount = record.items?.length || 1;
          return { rowSpan: rowCount };
        }
        return { rowSpan: 0 };
      },
    },
  ];

  /** 较昨日对比：显示 +x / -x 格式 */
  const renderDOD = (today?: number, yesterday?: number) => {
    if (today === undefined || yesterday === undefined) return null;
    const diff = today - yesterday;
    const color = diff > 0 ? '#cf1322' : diff < 0 ? '#3f8600' : 'rgba(0, 0, 0, 0.45)';
    const text = diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : '0';
    return (
      <span style={{ marginLeft: 8, fontSize: 13, color }}>
        <span style={{ color: 'rgba(0,0,0,0.45)' }}>较昨日</span> {text}
      </span>
    );
  };

  /** 折线图渲染（与 StatCardTrendArea / 销售订单指标卡一致） */
  const renderTrendChart = (data: { date: string; value: number }[] = [], chartColor: string) => {
    if (!data || data.length === 0) return null;
    return <StatCardTrendArea data={data} color={chartColor} />;
  };

  const statCards: StatCard[] = hasPageMetricConfig
    ? pageMetricCards.map((card) => {
        const key = card.key;
        const color = (card.valueStyle as { color?: string } | undefined)?.color ?? '#1890ff';
        if (!key || !statistics) return card;
        const trendMap: Record<string, { date: string; value: number }[] | undefined> = {
          today_new_count: statistics.trend_today_new,
          pending_review_count: statistics.trend_pending_review,
        };
        const yesterdayMap: Record<string, number | undefined> = {
          today_new_count: statistics.yesterday_today_new,
          pending_review_count: statistics.yesterday_pending_review,
        };
        const trend = trendMap[key];
        const yesterday = yesterdayMap[key];
        const val = typeof card.value === 'number' ? card.value : 0;
        let description: React.ReactNode = undefined;
        if (yesterday !== undefined) {
          description = (
            <div>
              今日: {val} {renderDOD(val, yesterday)}
            </div>
          );
        } else if (key === 'pending_review_count' && val > 0) {
          description = <div style={{ color: '#faad14' }}>需即时处理</div>;
        }
        return {
          ...card,
          description,
          backgroundChart: trend?.length ? renderTrendChart(trend, color) : undefined,
          onClick: key === 'pending_review_count' && val > 0 ? () => {
            tableSearchFormRef.current?.setFieldsValue?.({ status: '待审核' });
            tableRef.current?.reload?.();
          } : undefined
        };
      })
    : [
        {
          title: t('app.kuaizhizao.salesForecast.statTodayNew', '今日新增'),
          key: 'today_new_count',
          value: statistics?.active_count ?? 0,
          description: statistics?.active_count !== undefined && statistics?.yesterday_today_new !== undefined ? (
            <div>今日: {statistics.active_count} {renderDOD(statistics.active_count, statistics.yesterday_today_new)}</div>
          ) : undefined,
          valueStyle: { color: token.colorPrimary },
          backgroundChart: renderTrendChart(statistics?.trend_today_new ?? [], token.colorPrimary),
        },
        {
          title: t('app.kuaizhizao.salesForecast.statPending', '待审核'),
          key: 'pending_review_count',
          value: statistics?.pending_review_count ?? 0,
          valueStyle: { color: '#faad14' },
          description: (statistics?.pending_review_count ?? 0) > 0 ? <div style={{ color: '#faad14' }}>需即时处理</div> : undefined,
          backgroundChart: renderTrendChart(statistics?.trend_pending_review ?? [], '#faad14'),
          onClick: (statistics?.pending_review_count ?? 0) > 0 ? () => {
            tableSearchFormRef.current?.setFieldsValue?.({ status: '待审核' });
            tableRef.current?.reload?.();
          } : undefined,
        },
        {
          title: t('app.kuaizhizao.salesForecast.statInProgress', '执行中'),
          key: 'in_progress_count',
          value: statistics?.in_progress_count ?? 0,
          valueStyle: { color: '#52c41a' },
          backgroundChart: renderTrendChart([], '#52c41a'),
          onClick: (statistics?.in_progress_count ?? 0) > 0 ? () => {
            tableSearchFormRef.current?.setFieldsValue?.({ status: '已下推' });
            tableRef.current?.reload?.();
          } : undefined,
        },
        {
          title: t('app.kuaizhizao.salesForecast.statOverdue', '逾期未交'),
          key: 'overdue_count',
          value: statistics?.overdue_count ?? 0,
          valueStyle: { color: '#f5222d' },
          backgroundChart: renderTrendChart([], '#f5222d'),
        }
      ];

  return (
    <>
      <ListPageTemplate statCards={statCards}>
        <UniTable<any>
          actionRef={tableRef}
          formRef={tableSearchFormRef}
          rowKey={viewType === 'table' ? 'id' : '_rowKey'}
          columns={columns}
          viewTypes={['table', 'detailTable']}
          defaultViewType="table"
          onViewTypeChange={(v) => {
            setViewType(v as 'table' | 'detailTable');
            viewModeRef.current = v === 'table' ? 'order' : 'item';
            setTimeout(() => {
              tableRef.current?.reload();
            }, 0);
          }}
          request={async (params) => {
            const currentMode = viewModeRef.current;
            const res = await listSalesForecasts({
              ...params,
              include_items: currentMode === 'item' ? 1 : 0,
            });
            if (currentMode === 'item') {
              return { data: toFlatRows(res.data), total: res.total, success: res.success };
            }
            return res;
          }}
          showAdvancedSearch={true}
          enableRowSelection={true}
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={(keys) => setSelectedRowKeys(keys)}
          showCreateButton={salesNodesEnabled.sales_forecast}
          createButtonText={t('app.kuaizhizao.salesForecast.create')}
          onCreate={handleCreate}
          toolBarRender={() => [
            <Space.Compact key={`batch-btn-${selectedRowKeys.length}`}>
              <Button
                disabled={selectedRowKeys.length === 0}
                danger
                onClick={() => handleDelete(selectedRowKeys)}
              >
                <DeleteOutlined /> {t('common.batchDelete')}
              </Button>
              <Dropdown
                disabled={selectedRowKeys.length === 0}
                trigger={['click']}
                menu={{
                  items: [
                    {
                      key: 'submit',
                      label: '批量提交',
                      onClick: async () => {
                        if (selectedRowKeys.length === 0) return;
                        let success = 0;
                        let failed = 0;
                        for (const k of selectedRowKeys) {
                          try {
                            await submitSalesForecast(Number(k));
                            success += 1;
                          } catch {
                            failed += 1;
                          }
                        }
                        if (success > 0) messageApi.success(`已提交 ${success} 条`);
                        if (failed > 0) messageApi.warning(`提交失败 ${failed} 条`);
                        setSelectedRowKeys([]);
                        tableRef.current?.reload();
                      },
                    },
                  ],
                }}
              >
                <Button danger icon={<ArrowDownOutlined />} />
              </Dropdown>
            </Space.Compact>,
          ]}
          showImportButton={true}
          onImport={() => setImportModalVisible(true)}
          showExportButton={true}
          onExport={handleExport}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={isEdit ? t('app.kuaizhizao.salesForecast.editTitle') : t('app.kuaizhizao.salesForecast.createTitle')}
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        onFinish={(values) => handleSaveInternal(values, false)}
        formRef={formRef as any}
        initialValues={{ items: [defaultForecastItem] }}
        width={1000}
        extraFooter={!isEdit ? <Button onClick={handleSaveDraft}>{t('app.kuaizhizao.salesOrder.saveDraft')}</Button> : undefined}
      >
        <Row gutter={16}>
          <Col span={12}>
            <ProFormText
              name="forecast_code"
              label={
                <span>
                  {t('app.kuaizhizao.salesForecast.forecastCode')}
                  <a
                    href="/system/code-rules"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate('/system/code-rules');
                    }}
                    style={{ marginLeft: 8, fontSize: 12 }}
                  >
                    {t('app.kuaizhizao.codeRule.setting')}
                  </a>
                </span>
              }
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
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
        </Row>

        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontWeight: 600, color: 'rgba(0, 0, 0, 0.88)' }}>
              <span style={{ color: '#ff4d4f', marginRight: 4, fontFamily: 'SimSun, sans-serif' }}>*</span>
              {t('app.kuaizhizao.salesForecast.forecastItems')}
            </span>
            <Space size={8}>
              <Button
                size="small"
                icon={<ImportOutlined />}
                onClick={() => setImportModalVisible(true)}
              >
                导入明细
              </Button>
              <Button size="small" icon={<AppstoreAddOutlined />} onClick={openMatrixEntry}>
                矩阵录入
              </Button>
            </Space>
          </div>
          <ProForm.Item name="items" noStyle rules={[{ type: 'array', min: 1, message: t('app.kuaizhizao.salesForecast.itemsRequired') }]}>
            <AntForm.List name="items">
              {(fields, { add, remove }) => {
                const forecastItemColumns = [
                  {
                    title: t('app.kuaizhizao.salesForecast.material'),
                    dataIndex: 'material_id',
                    width: 260,
                    render: (_: any, __: any, index: number) => (
                      <UniMaterialSelect
                        name={[index, 'material_id']}
                        label=""
                        placeholder={t('common.selectMaterial')}
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
                          size="small"
                          allowClear
                        />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: t('app.kuaizhizao.salesForecast.forecastQuantity'),
                    dataIndex: 'forecast_quantity',
                    width: 100,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item
                        name={[index, 'forecast_quantity']}
                        rules={[{ required: true, message: t('common.required') }]}
                        style={{ margin: 0 }}
                      >
                        <InputNumber min={0.01} precision={2} style={{ width: '100%' }} size="small" />
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
                        <DatePicker size="small" style={{ width: '100%' }} format="YYYY-MM-DD" />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: t('app.kuaizhizao.salesForecast.notes'),
                    dataIndex: 'notes',
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'notes']} style={{ margin: 0 }}>
                        <Input placeholder="-" size="small" />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: t('common.actions'),
                    width: 70,
                    fixed: 'right' as const,
                    render: (_: any, __: any, index: number) => (
                      <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(index)}>
                        {t('common.delete')}
                      </Button>
                    ),
                  },
                ];
                return (
                  <div style={{ width: '100%' }}>
                    <style>{`
                      .forecast-detail-table .ant-table-thead > tr > th {
                        background-color: var(--ant-color-fill-alter) !important;
                        font-weight: 600;
                      }
                      .forecast-detail-table .ant-form-item-explain,
                      .forecast-detail-table .ant-form-item-explain-error {
                        display: none !important;
                      }
                    `}</style>
                    <Table
                      className="forecast-detail-table"
                      size="small"
                      dataSource={fields.map((f, i) => ({ ...f, key: f.key ?? i }))}
                      rowKey="key"
                      pagination={false}
                      columns={forecastItemColumns}
                      footer={() => (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%' }}>
                          <Button
                            type="dashed"
                            icon={<PlusOutlined />}
                            style={{ flex: 1, minWidth: 120 }}
                            onClick={() => add(defaultForecastItem)}
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
                );
              }}
            </AntForm.List>
          </ProForm.Item>
          <SalesForecastFormSummary />
        </div>
        <ProFormTextArea name="notes" label={t('app.kuaizhizao.salesForecast.notes')} placeholder="-" />
      </FormModalTemplate>

      <MaterialBatchPickerModal
        open={materialPickerOpen}
        onCancel={() => setMaterialPickerOpen(false)}
        onConfirm={appendForecastItemsFromMaterials}
      />

      <Modal
        title="销售预测矩阵录入"
        open={matrixModalVisible}
        width={980}
        onCancel={() => setMatrixModalVisible(false)}
        onOk={applyMatrixEntry}
        okText="应用到明细"
      >
        <Table
          size="small"
          rowKey="material_id"
          pagination={false}
          dataSource={matrixRows}
          scroll={{ x: 900 }}
          columns={[
            {
              title: '物料',
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

      <DetailDrawerTemplate
        title={`${t('app.kuaizhizao.salesForecast.detailTitle')}${currentForecast?.forecast_code ? ` - ${currentForecast.forecast_code}` : ''}`}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        dataSource={currentForecast || {}}
        extra={
          currentForecast && (
            <Space size="small">
              {(() => {
                const lifecycle = getSalesForecastLifecycle(currentForecast);
                const canEdit = ['草稿', '待审核', '已驳回'].includes(lifecycle.stageName ?? '');
                const canDelete = ['草稿', '待审核'].includes(lifecycle.stageName ?? '');
                return (
                  <>
                    {canEdit && (
                      <Button icon={<EditOutlined />} onClick={() => { setDrawerVisible(false); handleEdit(currentForecast.id!); }}>
                        {t('common.edit')}
                      </Button>
                    )}
                    {canDelete && (
                      <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete([currentForecast.id!])}>
                        {t('common.delete')}
                      </Button>
                    )}
                  </>
                );
              })()}
              <UniWorkflowActions
                record={currentForecast}
                entityName={t('app.kuaizhizao.salesForecast.title')}
                statusField="status"
                reviewStatusField="review_status"
                draftStatuses={['草稿', 'DRAFT']}
                pendingStatuses={['待审核', 'PENDING_REVIEW']}
                approvedStatuses={['已审核', 'AUDITED', 'APPROVED', '审核通过', '通过', '已通过']}
                rejectedStatuses={['已驳回', 'REJECTED', '审核驳回']}
                autoApproveWhenSubmit={!auditEnabled}
                onSuccess={() => {
                  invalidateStatistics();
                  invalidateMenuBadge();
                  tableRef.current?.reload();
                  setDrawerVisible(false);
                }}
                actions={{
                  submit: (id) => submitSalesForecast(id),
                  approve: approveSalesForecast,
                  revoke: withdrawSalesForecastApproval,
                }}
              />
            </Space>
          )
        }
      >
        {currentForecast && (
          <>
            <DetailDrawerSection title="基本信息">
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

            <DetailDrawerSection title="生命周期">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {(() => {
                  const lifecycle = getSalesForecastLifecycle(currentForecast);
                  if (!lifecycle.mainStages?.length) return null;
                  return (
                    <UniLifecycleStepper
                      steps={lifecycle.mainStages}
                      status={lifecycle.status}
                      showLabels
                      nextStepSuggestions={lifecycle.nextStepSuggestions}
                    />
                  );
                })()}
                <div style={{ paddingTop: 12, borderTop: '1px solid var(--ant-color-border-secondary)' }}>
                  <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13, color: 'var(--ant-color-text)' }}>
                    上下游单据
                  </div>
                  {forecastTracking.data ? (
                    <DocumentTrackingRelationsBody data={forecastTracking.data} />
                  ) : (
                    <Typography.Text type="secondary">暂无上下游关联</Typography.Text>
                  )}
                </div>
              </div>
            </DetailDrawerSection>

            <DetailDrawerSection title="明细信息">
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
                <Typography.Text type="secondary">暂无明细</Typography.Text>
              )}
            </DetailDrawerSection>

            <DetailDrawerSection title="操作记录">
              {forecastTracking.data ? (
                <DocumentTrackingTimelineBody data={forecastTracking.data} />
              ) : (
                <Typography.Text type="secondary">暂无操作记录</Typography.Text>
              )}
            </DetailDrawerSection>
          </>
        )}
      </DetailDrawerTemplate>
    <UniImport
      visible={importModalVisible}
      onCancel={() => setImportModalVisible(false)}
      onConfirm={handleImport}
      title={t('app.kuaizhizao.salesForecast.importTitle') || '导入销售预测明细'}
      headers={['物料编号', '预测数量', '预测日期', '备注']}
      exampleRow={['MAT001', '100', '2026-03-01', '备注说明']}
    />
    </>
  )
}
