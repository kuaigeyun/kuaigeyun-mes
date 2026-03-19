/**
 * 销售预测页面
 *
 * 独立于需求管理的销售预测功能，使用销售预测专用 API 与服务。
 *
 * @author RiverEdge Team
 * @date 2026-02-02
 */

import React, { useRef, useState, useEffect } from 'react'
import {
  ActionType,
  ProColumns,
  ProForm,
  ProFormText,
  ProFormDatePicker,
  ProFormTextArea,
  ProDescriptions,
  ProFormInstance,
} from '@ant-design/pro-components'
import {
  App,
  Button,
  Space,
  Modal,
  Drawer,
  Table,
  Input,
  InputNumber,
  Form as AntForm,
  DatePicker,
  Row,
  Col,
  Tag,
  Segmented,
  Dropdown,
} from 'antd'
import {
  DeleteOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { UniTable } from '../../../../../components/uni-table'
import { UniMaterialSelect } from '../../../../../components/uni-material-select'
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions'
import { ListPageTemplate, FormModalTemplate } from '../../../../../components/layout-templates'
import {
  listSalesForecasts,
  getSalesForecast,
  getSalesForecastItems,
  createSalesForecast,
  updateSalesForecast,
  deleteSalesForecast,
  submitSalesForecast,
  approveSalesForecast,
  pushSalesForecastToMrp,
  importSalesForecasts,
  exportSalesForecasts,
  type SalesForecast,
  type SalesForecastItem,
} from '../../../services/sales-forecast'
import { materialApi } from '../../../../master-data/services/material'
import type { Material } from '../../../../master-data/types/material'
import dayjs from 'dayjs'
import {
  generateCode,
  testGenerateCode,
  getCodeRulePageConfig,
} from '../../../../../services/codeRule'
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage'
import { getSalesForecastLifecycle } from '../../../utils/salesForecastLifecycle'
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle'
import DocumentTrackingPanel from '../../../../../components/document-tracking-panel'
import { downloadFile } from '../../../services/common'

/** 销售预测状态 */
const SalesForecastStatus = {
  DRAFT: '草稿',
  PENDING_REVIEW: '待审核',
  AUDITED: '已审核',
  REJECTED: '已驳回',
} as const

/** 审核状态 */
const ReviewStatus = {
  PENDING: '待审核',
  APPROVED: '通过',
  REJECTED: '驳回',
} as const

export default function SalesForecastsPage() {
  const { t } = useTranslation();
  const { message: messageApi, modal: modalApi } = App.useApp()
  const formRef = useRef<ProFormInstance>();
  const [modalVisible, setModalVisible] = useState(false);
  const [currentRow, setCurrentRow] = useState<SalesForecast>();
  const tableRef = useRef<ActionType>();
  const [viewMode, setViewMode] = useState<'order' | 'item'>('item');

  /**
   * 将含有 items 的预测单据拍平为明细行，用于“明细视图”
   */
  const toFlatRows = (data: SalesForecast[]) => {
    const rows: (SalesForecast & { item?: SalesForecastItem; itemIndex?: number })[] = [];
    data.forEach((forecast) => {
      if (!forecast.items || forecast.items.length === 0) {
        // 如果没有明细，保留单据行（部分字段空）
        rows.push({ ...forecast });
      } else {
        forecast.items.forEach((item, index) => {
          rows.push({
            ...forecast,
            item,
            itemIndex: index,
          });
        });
      }
    });
    return rows;
  };


  const [isEdit, setIsEdit] = useState(false)
  const [currentId, setCurrentId] = useState<number | null>(null)
  const [previewCode, setPreviewCode] = useState<string | null>(null)
  const [autoCodeEnabled, setAutoCodeEnabled] = useState(false)
  const [materialCodeMap, setMaterialCodeMap] = useState<Record<number, string>>({})
  const [materialList, setMaterialList] = useState<Material[]>([])
  const [materialsLoading, setMaterialsLoading] = useState(false)
  const [effectiveRuleCode, setEffectiveRuleCode] = useState<string | null>(null)
  const [effectiveAutoGen, setEffectiveAutoGen] = useState<boolean | null>(null)

  const [drawerVisible, setDrawerVisible] = useState(false)
  const [currentForecast, setCurrentForecast] = useState<SalesForecast | null>(null)
  useEffect(() => {
    const load = async () => {
      try {
        setMaterialsLoading(true)
        const result = await materialApi.list({ limit: 1000, isActive: true })
        const list = Array.isArray(result) ? result : ((result as any)?.data ?? (result as any)?.items ?? [])
        setMaterialList(list)
        const map: Record<number, string> = {}
        list.forEach((m: Material) => {
          map[m.id!] = m.mainCode || ''
        })
        setMaterialCodeMap(map)
      } catch (e: any) {
        messageApi.error(t('common.loadFailed') + ': ' + e.message)
      } finally {
        setMaterialsLoading(false)
      }
    }
    load()
  }, [])

  /**
   * 处理新建销售预测
   * 参考销售订单：先打开弹窗，再请求 testGenerateCode 预填编码（不占用序号）
   */
  const defaultForecastItem = {
    material_id: undefined,
    material_code: '',
    material_name: '',
    material_spec: '',
    material_unit: '件',
    forecast_quantity: 0,
    forecast_date: dayjs().format('YYYY-MM-DD'),
    confidence_level: 1.0,
    forecast_method: 'MANUAL',
  }

  const handleCreate = async () => {
    setIsEdit(false)
    setCurrentId(null)
    setPreviewCode(null)
    setEffectiveRuleCode(null)
    setEffectiveAutoGen(null)
    setModalVisible(true)

    // 预填单号逻辑
    const ruleCode = getPageRuleCode('forecast_code')
    if (ruleCode) {
      try {
        const res = await testGenerateCode({ rule_code: ruleCode })
        const isAuto = await isAutoGenerateEnabled(ruleCode)
        setEffectiveRuleCode(ruleCode)
        setEffectiveAutoGen(isAuto)
        setPreviewCode(res.code)

        if (formRef.current) {
          formRef.current.setFieldsValue({
            forecast_code: res.code,
            items: [defaultForecastItem],
            forecast_type: 'MTS',
          })
        }
      } catch (err: any) {
        console.error('Test generate code failed:', err)
      }
    } else {
        if (formRef.current) {
          formRef.current.setFieldsValue({
            items: [defaultForecastItem],
            forecast_type: 'MTS',
          })
        }
    }
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
      messageApi.error(t('common.loadFailed') + ': ' + e.message)
    }
  }

  const handleDetail = async (id: number) => {
    try {
      const data = await getSalesForecast(id)
      setCurrentForecast(data)
      setDrawerVisible(true)
    } catch (e: any) {
      messageApi.error(t('common.loadFailed') + ': ' + e.message)
    }
  }

  // 处理批量导入（UniTable 内置）
  const handleImport = async (data: any[][]) => {
    try {
      const result = await importSalesForecasts(data)
      if (result.failure_count > 0) {
        messageApi.warning(
          `导入完成：成功 ${result.success_count} 条，失败 ${result.failure_count} 条`
        )
      } else {
        messageApi.success(`导入成功：成功 ${result.success_count} 条`)
      }
      tableRef.current?.reload()
    } catch (e: any) {
      messageApi.error(e?.message || '导入失败')
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
        messageApi.success('导出成功')
      } else {
        const toExport =
          type === 'selected' && selectedRowKeys?.length
            ? (currentPageData || []).filter(r => r.id != null && selectedRowKeys.includes(r.id))
            : currentPageData || []
        if (toExport.length === 0) {
          messageApi.warning('暂无数据可导出')
          return
        }
        const blob = new Blob([JSON.stringify(toExport, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `销售预测_${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        URL.revokeObjectURL(url)
        messageApi.success(`已导出 ${toExport.length} 条记录`)
      }
    } catch (e: any) {
      messageApi.error((e as Error).message || '导出失败')
    }
  }

  const handleDelete = async (keys: React.Key[]) => {
    if (!keys?.length) {
      messageApi.warning('请选择要删除的记录')
      return
    }
    modalApi.confirm({
      title: '确认删除',
      content: `确定要删除选中的 ${keys.length} 条销售预测吗？此操作不可恢复。`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          for (const k of keys) {
            await deleteSalesForecast(Number(k))
          }
          messageApi.success(`已删除 ${keys.length} 条记录`)
          tableRef.current?.reload()
          if (tableRef.current?.clearSelected) tableRef.current.clearSelected()
        } catch (e: any) {
          messageApi.error(e?.message || '删除失败')
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

  const handleSave = async (values: any) => {
    try {
      const rawItems = values.items ?? []
      if (!rawItems.length) {
        messageApi.warning('请至少添加一条预测明细')
        return
      }
      const items = rawItems
        .map(formatItem)
        .filter((it: any) => it.material_id && it.forecast_quantity > 0 && it.forecast_date)
      if (!items.length) {
        messageApi.warning('请填写完整的预测明细（物料、数量、预测日期）')
        return
      }
      let forecastCode: string | undefined
      if (!isEdit) {
        forecastCode = values.forecast_code
        const ruleCode = effectiveRuleCode || getPageRuleCode('kuaizhizao-sales-forecast')
        const autoGen = effectiveAutoGen ?? isAutoGenerateEnabled('kuaizhizao-sales-forecast')
        if (autoGen && ruleCode && (forecastCode === previewCode || !forecastCode)) {
          try {
            const codeResponse = await generateCode({ rule_code: ruleCode })
            forecastCode = codeResponse.code
          } catch (e) {
            console.warn('销售预测编码正式生成失败，使用当前值:', e)
          }
        }
        if (!forecastCode) forecastCode = undefined
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
      }
      if (isEdit && currentId) {
        const res = await updateSalesForecast(currentId, { ...basePayload, items })
        const syncTip = '已同步至关联需求，若已下推计算请前往需求计算重新执行。'
        messageApi.success(res?.demand_synced ? `更新成功。${syncTip}` : '更新成功')
      } else {
        await createSalesForecast({
          ...basePayload,
          forecast_code: forecastCode,
          items,
        } as SalesForecast)
        messageApi.success('创建成功')
      }
      setModalVisible(false)
      setEffectiveRuleCode(null)
      setEffectiveAutoGen(null)
      tableRef.current?.reload()
    } catch (e: any) {
      messageApi.error(e?.message || '保存失败')
      throw e
    }
  }

  const handlePushToMrp = async (id: number) => {
    modalApi.confirm({
      title: '下推到需求计算',
      content: '确定要将此销售预测下推到需求计算吗？',
      onOk: async () => {
        try {
          await pushSalesForecastToMrp(id)
          messageApi.success('下推成功')
          tableRef.current?.reload()
        } catch (e: any) {
          messageApi.error(e?.message || '下推失败')
        }
      },
    })
  }

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
    // 明细视图字段
    {
      title: t('app.kuaizhizao.salesForecast.materialCode'),
      dataIndex: ['item', 'material_code'],
      width: 140,
      hideInTable: viewMode === 'order',
      render: (text, record) => record.item?.material_code || '-',
    },
    {
      title: t('app.kuaizhizao.salesForecast.materialName'),
      dataIndex: ['item', 'material_name'],
      width: 180,
      ellipsis: true,
      hideInTable: viewMode === 'order',
      render: (text, record) => record.item?.material_name || '-',
    },
    {
      title: t('app.kuaizhizao.salesForecast.materialSpec'),
      dataIndex: ['item', 'material_spec'],
      width: 150,
      ellipsis: true,
      hideInTable: viewMode === 'order',
      render: (text, record) => record.item?.material_spec || '-',
    },
    {
      title: t('app.kuaizhizao.salesForecast.forecastQuantity'),
      dataIndex: ['item', 'forecast_quantity'],
      width: 120,
      valueType: 'digit',
      hideInTable: viewMode === 'order',
      render: (text, record) => record.item?.forecast_quantity || '-',
    },
    {
      title: t('app.kuaizhizao.salesForecast.forecastDate'),
      dataIndex: ['item', 'forecast_date'],
      width: 120,
      valueType: 'date',
      hideInTable: viewMode === 'order',
      render: (text, record) => record.item?.forecast_date || '-',
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
      title: t('app.kuaizhizao.salesForecast.status'),
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        草稿: { text: '草稿', status: 'Default' },
        待审核: { text: '待审核', status: 'Processing' },
        已审核: { text: '已审核', status: 'Success' },
        已下推: { text: '已下推', status: 'Success' },
        已驳回: { text: '已驳回', status: 'Error' },
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
      title: t('common.lifecycle'),
      dataIndex: 'lifecycle',
      width: 120,
      hideInSearch: true,
      render: (lifecycle: any, record) => {
        const isFirst = record.itemIndex === undefined || record.itemIndex === 0;
        if (!isFirst && viewMode === 'item') return { children: null, props: { rowSpan: 0 } };

        if (!lifecycle) return '-';
        const stageName = (lifecycle as any).stageName ?? record.status ?? '草稿'
        const colorMap: Record<string, string> = {
          草稿: 'default',
          待审核: 'warning',
          已审核: 'green',
          已下推: 'blue',
          已驳回: 'error',
        }
        return <Tag color={colorMap[stageName] ?? 'default'}>{stageName}</Tag>;
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
      title: t('common.actions'),
      valueType: 'option',
      fixed: 'right',
      width: 260,
      render: (_, record) => {
        const isFirst = record.itemIndex === undefined || record.itemIndex === 0;
        if (!isFirst && viewMode === 'item') return { children: null, props: { rowSpan: 0 } };

        return (
          <Space>
            <a onClick={() => handleEdit(record.id)}>{t('common.edit')}</a>
            <UniWorkflowActions
              record={record}
              entityName="销售预测"
              actions={{
                submit: (id) => submitSalesForecast(id),
                approve: (id) => approveSalesForecast(id),
                reject: (id, reason) => approveSalesForecast(id, reason),
              }}
              onSuccess={() => tableRef.current?.reload()}
              theme="link"
            />
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'push_to_mrp',
                    label: '下推MRP',
                    disabled: record.status !== '已审核',
                    onClick: () => handlePushToMrp(record.id),
                  },
                  {
                    key: 'print',
                    label: t('common.print'),
                    onClick: () => window.print(),
                  },
                  {
                    key: 'delete',
                    label: (
                      <span style={{ color: 'red' }}>{t('common.delete')}</span>
                    ),
                    onClick: () => handleDelete([record.id]),
                  },
                ]
              }}
            >
              <a onClick={(e) => e.preventDefault()}>...</a>
            </Dropdown>
          </Space>
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
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<any>
          actionRef={tableRef}
          rowKey={(record) => record.item?.id ? `${record.id}-${record.item.id}` : String(record.id)}
          columns={columns}
          request={async (params) => {
            const apiParams = {
              skip: (params.current! - 1) * params.pageSize!,
              limit: params.pageSize,
              status: params.status,
              forecast_period: params.forecast_period,
              start_date: params.start_date,
              end_date: params.end_date,
              keyword: params.forecast_code || params.forecast_name || params._keyword,
              include_items: true,
            };
            const res = await listSalesForecasts(apiParams);
            
            if (viewMode === 'item') {
              const flatData = toFlatRows(res.data);
              return {
                data: flatData,
                total: res.total,
                success: res.success,
              };
            }

            return res;
          }}
          toolBarRender={() => [
            <Segmented
              key="viewMode"
              value={viewMode}
              onChange={(val: any) => setViewMode(val)}
              options={[
                { label: '单据视图', value: 'order' },
                { label: '明细视图', value: 'item' },
              ]}
            />,
            <Button
              key="add"
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
            >
              {t('common.add')}
            </Button>,
          ]}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={isEdit ? '编辑销售预测' : '新建销售预测'}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false)
          setEffectiveRuleCode(null)
          setEffectiveAutoGen(null)
        }}
        onFinish={handleSave}
        isEdit={isEdit}
        formRef={formRef as any}
        width={1200}
        layout="vertical"
      >
        <Row gutter={16}>
          <Col span={12}>
            <ProFormText
              name="forecast_code"
              label="预测编码"
              placeholder={
                isAutoGenerateEnabled('kuaizhizao-sales-forecast')
                  ? '编码将根据编码规则自动生成，可修改'
                  : '请输入预测编码'
              }
              fieldProps={{ disabled: isEdit }}
            />
          </Col>
          <Col span={12}>
            <ProFormText
              name="forecast_name"
              label="预测名称"
              placeholder="请输入预测名称"
              rules={[{ required: true }]}
            />
          </Col>
          <Col span={6}>
            <ProFormText
              name="forecast_period"
              label="预测周期"
              placeholder="如 2026-01"
              rules={[{ required: true }]}
            />
          </Col>
          <Col span={6}>
            <ProFormDatePicker
              name="start_date"
              label="开始日期"
              fieldProps={{ style: { width: '100%' } }}
              rules={[{ required: true }]}
            />
          </Col>
          <Col span={6}>
            <ProFormDatePicker
              name="end_date"
              label="结束日期"
              fieldProps={{ style: { width: '100%' } }}
              rules={[{ required: true }]}
            />
          </Col>
        </Row>

        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <span style={{ fontWeight: 600, color: 'rgba(0, 0, 0, 0.88)' }}>
              <span style={{ color: '#ff4d4f', marginRight: 4, fontFamily: 'SimSun, sans-serif' }}>
                *
              </span>
              预测明细
            </span>
          </div>
          <ProForm.Item
            name="items"
            noStyle
            rules={[{ type: 'array' as const, min: 1, message: '请至少添加一条预测明细' }]}
          >
            <AntForm.List name="items">
              {(fields, { add, remove }) => {
                const cols = [
                  {
                    title: '物料',
                    dataIndex: 'material_id',
                    width: 200,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item
                        noStyle
                        shouldUpdate={(prev: any, curr: any) =>
                          prev?.items?.[index] !== curr?.items?.[index]
                        }
                      >
                        {({ getFieldValue }: any) => {
                          const row = getFieldValue('items')?.[index]
                          const mid = row?.material_id ? Number(row.material_id) : null
                          const fallback =
                            mid && (row?.material_code || row?.material_name)
                              ? {
                                  value: mid,
                                  label:
                                    `${row.material_code || ''} - ${row.material_name || ''}`.trim() ||
                                    String(mid),
                                }
                              : undefined
                          return (
                            <UniMaterialSelect
                              name={[index, 'material_id']}
                              label=""
                              placeholder="请选择物料（支持名称/编码搜索）"
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
                              fallbackOption={fallback}
                              formItemProps={{ style: { margin: 0 } }}
                              showQuickCreate
                              showAdvancedSearch
                              onChange={(val, material) => {
                                formRef.current?.setFieldValue(
                                  ['items', index, '_sourceType'],
                                  material?.sourceType || (material as any)?.source_type
                                )
                              }}
                            />
                          )
                        }}
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: '属性',
                    dataIndex: 'variant_attributes',
                    width: 140,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item
                        noStyle
                        shouldUpdate={(prev: any, curr: any) =>
                          prev?.items?.[index] !== curr?.items?.[index]
                        }
                      >
                        {({ getFieldValue }: any) => {
                          const row = getFieldValue('items')?.[index]
                           const mid = row?.material_id ? Number(row.material_id) : null
                           const st =
                             row?._sourceType ??
                             materialList.find((m: any) => m.id === mid)?.sourceType ??
                             materialList.find((m: any) => m.id === mid)?.source_type
                          const isConfigure = st === 'Configure'
                          if (!isConfigure) return <span style={{ color: '#999' }}>-</span>
                          return (
                            <AntForm.Item
                              name={[index, 'variant_attributes']}
                              style={{ margin: 0 }}
                            >
                              <Input
                                placeholder='配置件需填写，如 {"color":"red","size":"M"}'
                                size="small"
                                allowClear
                              />
                            </AntForm.Item>
                          )
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
                    dataIndex: 'material_unit',
                    width: 80,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'material_unit']} style={{ margin: 0 }}>
                        <Input placeholder="单位" size="small" />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: '预测数量',
                    dataIndex: 'forecast_quantity',
                    width: 110,
                    align: 'right' as const,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item
                        name={[index, 'forecast_quantity']}
                        rules={[
                          { required: true, message: '必填' },
                          { type: 'number' as const, min: 0.01, message: '>0' },
                        ]}
                        style={{ margin: 0 }}
                      >
                        <InputNumber
                          placeholder="数量"
                          min={0}
                          precision={2}
                          style={{ width: '100%' }}
                          size="small"
                        />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: '预测日期',
                    dataIndex: 'forecast_date',
                    width: 120,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item
                        name={[index, 'forecast_date']}
                        rules={[{ required: true, message: '必填' }]}
                        style={{ margin: 0 }}
                      >
                        <DatePicker size="small" style={{ width: '100%' }} format="YYYY-MM-DD" />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: '历史销量',
                    dataIndex: 'historical_sales',
                    width: 100,
                    align: 'right' as const,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'historical_sales']} style={{ margin: 0 }}>
                        <InputNumber
                          placeholder="选填"
                          min={0}
                          precision={2}
                          style={{ width: '100%' }}
                          size="small"
                        />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: '备注',
                    dataIndex: 'notes',
                    width: 100,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'notes']} style={{ margin: 0 }}>
                        <Input placeholder="选填" size="small" />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: '操作',
                    width: 70,
                    fixed: 'right' as const,
                    render: (_: any, __: any, index: number) => (
                      <Button
                        type="link"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => remove(index)}
                      >
                        删除
                      </Button>
                    ),
                  },
                ]
                const totalWidth = cols.reduce((s, c) => s + ((c.width as number) || 0), 0)
                return (
                  <div
                    style={{
                      width: '100%',
                      minWidth: 0,
                      overflow: 'hidden',
                      boxSizing: 'border-box',
                    }}
                  >
                    <style>{`
                        .sales-forecast-detail-table .ant-table-thead > tr > th {
                          background-color: var(--ant-color-fill-alter) !important;
                          font-weight: 600;
                        }
                        .sales-forecast-detail-table .ant-table { border-top: 1px solid var(--ant-color-border); }
                        .sales-forecast-detail-table .ant-table-tbody > tr > td { border-bottom: 1px solid var(--ant-color-border); }
                      `}</style>
                    <div style={{ width: '100%', overflowX: 'auto' }}>
                      <Table
                        className="sales-forecast-detail-table"
                        size="small"
                        dataSource={fields.map((f, i) => ({ ...f, key: f.key ?? i }))}
                        rowKey="key"
                        pagination={false}
                        columns={cols}
                        scroll={{ x: totalWidth }}
                        style={{ width: '100%', margin: 0 }}
                        footer={() => (
                          <Button
                            type="dashed"
                            icon={<PlusOutlined />}
                            onClick={() => {
                              const mainEnd = formRef.current?.getFieldValue('end_date')
                              const defaultDate =
                                mainEnd != null
                                  ? dayjs.isDayjs(mainEnd)
                                    ? mainEnd
                                    : dayjs(mainEnd)
                                  : dayjs()
                              add({
                                material_id: undefined,
                                material_code: '',
                                material_name: '',
                                material_spec: '',
                                material_unit: '',
                                forecast_quantity: undefined,
                                forecast_date: defaultDate,
                                historical_sales: undefined,
                                variant_attributes: '',
                                notes: '',
                              })
                            }}
                            block
                          >
                            添加明细
                          </Button>
                        )}
                      />
                    </div>
                  </div>
                )
              }}
            </AntForm.List>
          </ProForm.Item>
        </div>
        <ProFormTextArea name="notes" label="备注" placeholder="选填" fieldProps={{ rows: 2 }} />
      </FormModalTemplate>

      <Drawer
        title="销售预测详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width="50%"
        styles={{ wrapper: { width: '50%' } }}
      >
        {currentForecast && (
          <>
            <ProDescriptions
              column={1}
              dataSource={currentForecast}
              columns={[
                { title: '预测编码', dataIndex: 'forecast_code' },
                { title: '预测名称', dataIndex: 'forecast_name' },
                { title: '类型', dataIndex: 'forecast_type' },
                { title: '预测周期', dataIndex: 'forecast_period' },
                { title: '开始日期', dataIndex: 'start_date' },
                { title: '结束日期', dataIndex: 'end_date' },
                { title: '状态', dataIndex: 'status' },
                { title: '审核状态', dataIndex: 'review_status' },
                { title: '备注', dataIndex: 'notes' },
              ]}
            />
            {(() => {
              const lifecycle = getSalesForecastLifecycle(currentForecast)
              const mainStages = lifecycle.mainStages ?? []
              const subStages = lifecycle.subStages ?? []
              if (mainStages.length === 0 && subStages.length === 0) return null
              return (
                <div style={{ marginTop: 24, marginBottom: 24 }}>
                  <h4 style={{ marginBottom: 12 }}>生命周期状态</h4>
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
                        <div
                          style={{
                            marginBottom: 8,
                            fontSize: 12,
                            color: 'var(--ant-color-text-secondary)',
                          }}
                        >
                          执行中 · 全链路
                        </div>
                        <UniLifecycleStepper steps={subStages} showLabels />
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}
            {currentForecast.id != null && (
              <>
                <div style={{ marginTop: 16, marginBottom: 8, fontWeight: 600 }}>预测明细</div>
                <Table
                  size="small"
                  rowKey="id"
                  dataSource={currentForecast.items || []}
                  pagination={false}
                  columns={[
                    { title: '物料编码', dataIndex: 'material_code', key: 'material_code', width: 120 },
                    { title: '物料名称', dataIndex: 'material_name', key: 'material_name', width: 140 },
                    { title: '预测数量', dataIndex: 'forecast_quantity', key: 'forecast_quantity', width: 100 },
                    { title: '预测日期', dataIndex: 'forecast_date', key: 'forecast_date', width: 120 },
                  ]}
                />
              </>
            )}
            {currentForecast.id != null && (
              <div style={{ marginTop: 24 }}>
                <div style={{ marginBottom: 8, fontWeight: 600 }}>操作历史</div>
                <DocumentTrackingPanel
                  documentType="sales_forecast"
                  documentId={currentForecast.id}
                />
              </div>
            )}
            <div style={{ marginTop: 24 }}>
              <Space>
                {currentForecast.status === SalesForecastStatus.DRAFT && (
                  <Button
                    onClick={() => {
                      setDrawerVisible(false)
                      handleEdit(currentForecast.id!)
                    }}
                  >
                    编辑
                  </Button>
                )}
                <UniWorkflowActions
                  record={currentForecast}
                  entityName="销售预测"
                  statusField="status"
                  reviewStatusField="review_status"
                  draftStatuses={[SalesForecastStatus.DRAFT]}
                  pendingStatuses={[SalesForecastStatus.PENDING_REVIEW]}
                  approvedStatuses={[SalesForecastStatus.AUDITED]}
                  rejectedStatuses={[SalesForecastStatus.REJECTED]}
                  actions={{
                    submit: id => submitSalesForecast(id),
                    approve: id => approveSalesForecast(id),
                    reject: (id, reason) => {
                      if (!reason?.trim()) throw new Error('请输入驳回原因')
                      return approveSalesForecast(id, reason.trim())
                    },
                  }}
                  onSuccess={() => {
                    tableRef.current?.reload()
                    setDrawerVisible(false)
                  }}
                />
                {currentForecast.status === SalesForecastStatus.AUDITED && (
                  <Button type="primary" onClick={() => handlePushToMrp(currentForecast.id!)}>
                    下推需求计算
                  </Button>
                )}
              </Space>
            </div>
          </>
        )}
      </Drawer>
    </>
  )
}
