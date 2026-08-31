/**
 * 线边备料：左栏备料建议 + 右栏线边备料单列表
 */
import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { App, Button, Empty, Spin, theme } from 'antd'
import { MarkerTag } from '../../../../../constants/statusBadges'
import { TwoColumnLayout } from '../../../../../components/layout-templates'
import { FEATURE_PAGE_LIST_ITEM_CLASS } from '../../../../../components/layout-templates/constants'
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

function sortByKittingRateDesc(rows: BatchingTaskRow[]): BatchingTaskRow[] {
  return [...rows].sort((a, b) => {
    const rateA = a.kitting_rate ?? -1
    const rateB = b.kitting_rate ?? -1
    return rateB - rateA
  })
}

function canPullBatchingFromSuggestion(row: BatchingTaskRow): boolean {
  return (row.kitting_rate ?? 0) > 0
}

const LineSidePrepSplitView: React.FC<Props> = ({
  onCreate,
  onOpenDetail,
  canRead = true,
  onRefreshBatchingList,
}) => {
  const { t } = useTranslation()
  const { message: messageApi } = App.useApp()
  const { token } = theme.useToken()
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
        const rows = sortByKittingRateDesc(
          ((data as BatchingTaskRow[]) || []).filter(
            (r) => r.task_type === 'proactive_prep',
          ),
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
    <div style={{ padding: 8 }}>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
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
          const showPullAction = canPullBatchingFromSuggestion(row)
          const itemStyle: React.CSSProperties = {
            padding: 12,
            marginBottom: 4,
            borderRadius: token.borderRadius,
            border: active ? `1px solid ${token.colorPrimary}` : '1px solid transparent',
            backgroundColor: active ? token.colorPrimaryBg : undefined,
            transition: 'background-color 0.15s, border-color 0.15s',
            display: showPullAction ? 'flex' : undefined,
            flexDirection: showPullAction ? 'column' : undefined,
            gap: showPullAction ? 8 : undefined,
            cursor: showPullAction ? 'default' : 'pointer',
          }
          const selectRow = () => setSelectedKey(key)
          return (
            <div
              key={key}
              className={`${FEATURE_PAGE_LIST_ITEM_CLASS}${active ? ' is-selected' : ''}`}
              style={itemStyle}
              onClick={showPullAction ? undefined : selectRow}
              onKeyDown={
                showPullAction
                  ? undefined
                  : (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        selectRow()
                      }
                    }
              }
              role={showPullAction ? undefined : 'button'}
              tabIndex={showPullAction ? undefined : 0}
            >
              <div
                style={{ minWidth: 0, cursor: 'pointer' }}
                onClick={showPullAction ? selectRow : undefined}
                onKeyDown={
                  showPullAction
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          selectRow()
                        }
                      }
                    : undefined
                }
                role={showPullAction ? 'button' : undefined}
                tabIndex={showPullAction ? 0 : undefined}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 6,
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: token.colorText,
                      flexShrink: 0,
                    }}
                  >
                    {title}
                  </span>
                  <MarkerTag
                    color="processing"
                    style={{
                      margin: 0,
                      maxWidth: '52%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: 11,
                      lineHeight: '18px',
                    }}
                  >
                    {tagText}
                  </MarkerTag>
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 12,
                    color: token.colorTextSecondary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={subtitle}
                >
                  {subtitle}
                </div>
                {row.shortage_summary && row.product_name ? (
                  <div
                    style={{
                      marginTop: 2,
                      fontSize: 12,
                      color: token.colorTextSecondary,
                      whiteSpace: 'normal',
                      lineHeight: 1.4,
                    }}
                    title={row.shortage_summary}
                  >
                    {row.shortage_summary}
                  </div>
                ) : null}
              </div>
              {showPullAction ? (
                <Button
                  type="primary"
                  size="small"
                  block
                  loading={generatingKey === key}
                  onClick={() => void handleGenerate(row)}
                >
                  {pullFromWorkOrderAction.label}
                </Button>
              ) : null}
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
      layoutPersistenceId="kuaizhizao.batching-center.line-side-prep"
      leftPanel={{
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
