/**
 * 线边备料：产品工艺同款两栏
 * - 左：仅备料建议（proactive_prep）；无数据 Empty
 * - 右：线边备料单常驻（batching_draft）
 */
import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { App, Button, Empty, Spin, Tag } from 'antd'
import { TwoColumnLayout } from '../../../../../components/layout-templates'
import { resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry'
import { batchingOrderApi } from '../../../services/batching-order'
import { normalizeWarehouseListResponse } from '../../../utils/warehouseListCore'
import BatchingTaskQueue, { type BatchingTaskRow } from './BatchingTaskQueue'
import type { MaterialCenterDetailRequest } from './materialCenterDetail'
import { useBatchingPullFromWorkOrder } from './useBatchingPullFromWorkOrder'

type Props = {
  onCreate?: () => void
  onOpenDetail?: (request: MaterialCenterDetailRequest) => void
  canRead?: boolean
  onRefreshBatchingList?: () => void
}

function itemKey(row: BatchingTaskRow): string {
  return `${row.task_type}-${row.task_id}`
}

const LineSidePrepSplitView: React.FC<Props> = ({
  onCreate,
  onOpenDetail,
  canRead = true,
  onRefreshBatchingList,
}) => {
  const { t } = useTranslation()
  const { message: messageApi } = App.useApp()
  const pullFromWorkOrderAction = resolveKuaizhizaoDocumentAction(
    t,
    'batching_order.pull_from_work_order',
  )

  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [generatingKey, setGeneratingKey] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<BatchingTaskRow[]>([])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [listReloadKey, setListReloadKey] = useState(0)

  const loadSuggestions = useCallback(
    async (searchKeyword = '') => {
      setLoading(true)
      try {
        const kw = searchKeyword.trim()
        const res = await batchingOrderApi.listTasks({
          skip: 0,
          limit: 200,
          task_type: 'proactive_prep',
          ...(kw ? { keyword: kw } : {}),
        })
        const { data } = normalizeWarehouseListResponse(res)
        const rows = ((data as BatchingTaskRow[]) || []).filter(
          (r) => r.task_type === 'proactive_prep',
        )
        setSuggestions(rows)
      } catch (e: unknown) {
        messageApi.error((e as Error)?.message || t('common.loadFailed'))
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    },
    [messageApi, t],
  )

  useEffect(() => {
    void loadSuggestions()
  }, [loadSuggestions])

  useEffect(() => {
    if (selectedKey && !suggestions.some((r) => itemKey(r) === selectedKey)) {
      setSelectedKey(null)
    }
  }, [suggestions, selectedKey])

  const refreshAll = useCallback(async () => {
    await loadSuggestions(keyword)
    setListReloadKey((k) => k + 1)
    onRefreshBatchingList?.()
  }, [keyword, loadSuggestions, onRefreshBatchingList])

  const { pullFromWorkOrder, lineSideWarehouseModal } = useBatchingPullFromWorkOrder({
    onSuccess: refreshAll,
  })

  const handleGenerate = async (row: BatchingTaskRow) => {
    if (!row.work_order_id) return
    const key = itemKey(row)
    setGeneratingKey(key)
    try {
      await pullFromWorkOrder({
        work_order_id: Number(row.work_order_id),
        allow_existing_draft: true,
      })
    } catch (e: unknown) {
      messageApi.error(
        (e as Error)?.message || t('app.kuaizhizao.batchingCenter.generateBatchingFailed'),
      )
    } finally {
      setGeneratingKey((current) => (current === key ? null : current))
    }
  }

  const leftList = (
    <div className="product-process-material-list">
      {loading ? (
        <div className="product-process-material-list__loading">
          <Spin />
        </div>
      ) : suggestions.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('app.kuaizhizao.batchingCenter.panel.noPrepSuggestions')}
        />
      ) : (
        suggestions.map((row) => {
          const key = itemKey(row)
          const active = selectedKey === key
          const title = row.work_order_code || row.doc_code || String(row.task_id)
          const subtitle = row.product_name || row.shortage_summary || '—'
          const tagText =
            row.kitting_rate != null
              ? `${Math.round(row.kitting_rate)}%`
              : t('app.kuaizhizao.batchingCenter.taskType.proactivePrep')
          return (
            <div
              key={key}
              className={`product-process-material-list__item product-process-material-list__item--with-action${
                active ? ' product-process-material-list__item--active' : ''
              }`}
            >
              <div
                className="product-process-material-list__body"
                role="button"
                tabIndex={0}
                onClick={() => setSelectedKey(key)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelectedKey(key)
                  }
                }}
              >
                <div className="product-process-material-list__row">
                  <span className="product-process-material-list__code">{title}</span>
                  <Tag
                    variant="filled"
                    color="processing"
                    className="product-process-material-list__tag"
                  >
                    {tagText}
                  </Tag>
                </div>
                <div className="product-process-material-list__name" title={subtitle}>
                  {subtitle}
                </div>
                {row.shortage_summary && row.product_name ? (
                  <div
                    className="product-process-material-list__name product-process-material-list__name--wrap"
                    title={row.shortage_summary}
                  >
                    {row.shortage_summary}
                  </div>
                ) : null}
              </div>
              <Button
                type="primary"
                size="small"
                block
                className="product-process-material-list__action"
                loading={generatingKey === key}
                onClick={() => void handleGenerate(row)}
              >
                {pullFromWorkOrderAction.label}
              </Button>
            </div>
          )
        })
      )}
    </div>
  )

  const rightContent = (
    <BatchingTaskQueue
      taskType="batching_draft"
      onCreate={onCreate}
      listReloadKey={listReloadKey}
      onTasksChanged={() => void refreshAll()}
      onOpenDetail={onOpenDetail}
      canRead={canRead}
      onRefreshBatchingList={onRefreshBatchingList}
    />
  )

  return (
    <>
      <TwoColumnLayout
      style={{ flex: 1, minHeight: 0, height: '100%' }}
      leftPanel={{
        width: 280,
        minWidth: 220,
        search: {
          placeholder: t('app.kuaizhizao.batchingCenter.panel.searchPlaceholder'),
          value: keyword,
          onChange: setKeyword,
          onSearch: (v) => void loadSuggestions(v),
          allowClear: true,
        },
        leftContent: leftList,
      }}
      rightPanel={{
        contentPadding: 12,
        content: rightContent,
        footer: <span>{suggestions.length}</span>,
      }}
      />
      {lineSideWarehouseModal}
    </>
  )
}

export default LineSidePrepSplitView
