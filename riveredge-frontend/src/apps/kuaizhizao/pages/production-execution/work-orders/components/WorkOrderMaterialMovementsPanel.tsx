/**
 * 工单物料履历（时间轴）：采购申请→订单→收货通知→来料检验→采购入库，并合并库存移动。
 * 左栏物料列表，右栏为当前物料履历。用于工单详情抽屉与「库位与补料」Modal Tab。
 */
import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Empty, Spin, Timeline, Typography, Button, Tag, List, theme } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { workOrderApi } from '../../../../services/production'
import { formatDateTimeBySiteSetting, formatQuantity } from '../../../../../../utils/format'
import { getDocumentLifecycleStageTagProps } from '../../../../../../utils/documentLifecycleStatusTag'

/** 履历里后端写入 remark 的单据状态码 → documentStatus.* */
const HISTORY_STATUS_I18N: Record<string, string> = {
  DRAFT: 'documentStatus.draft',
  PENDING_REVIEW: 'documentStatus.pending_review',
  PENDING: 'documentStatus.pending_review',
  SUBMITTED: 'documentStatus.submitted',
  AUDITED: 'documentStatus.audited',
  APPROVED: 'documentStatus.approved',
  REJECTED: 'documentStatus.rejected',
  CONFIRMED: 'documentStatus.confirmed',
  EFFECTIVE: 'documentStatus.effective',
  IN_PROGRESS: 'documentStatus.in_progress',
  COMPLETED: 'documentStatus.completed',
  CANCELLED: 'documentStatus.cancelled',
  CLOSED: 'documentStatus.closed',
  PARTIAL_CONVERTED: 'documentStatus.partial_converted',
  FULL_CONVERTED: 'documentStatus.full_converted',
  草稿: 'documentStatus.draft',
  待审核: 'documentStatus.pending_review',
  已提交: 'documentStatus.submitted',
  已审核: 'documentStatus.audited',
  已通过: 'documentStatus.approved',
  已驳回: 'documentStatus.rejected',
  已确认: 'documentStatus.confirmed',
  已生效: 'documentStatus.effective',
  执行中: 'documentStatus.in_progress',
  已完成: 'documentStatus.completed',
  已取消: 'documentStatus.cancelled',
  已关闭: 'documentStatus.closed',
  部分转单: 'documentStatus.partial_converted',
  全部转单: 'documentStatus.full_converted',
  待检验: 'documentStatus.pending_inspection',
  已检验: 'documentStatus.inspected',
  待收货: 'documentStatus.pending_receipt',
  已通知: 'documentStatus.notified',
  待入库: 'documentStatus.pending_inbound',
  已入库: 'documentStatus.received',
}

export type WorkOrderMaterialMovementsPanelProps = {
  workOrderId: number
  /** 为 false 时不请求（如 Modal 未打开 / Tab 未激活） */
  enabled?: boolean
}

type HistoryItem = {
  id?: number
  source: 'ledger' | 'document'
  movement_type: string
  material_id?: number | null
  material_code?: string
  material_name?: string
  material_spec?: string
  quantity: number | string
  from_warehouse_name?: string
  to_warehouse_name?: string
  source_doc_type?: string
  source_doc_id?: number
  source_doc_code?: string
  operator_name?: string
  remark?: string
  occurred_at?: string
}

type MaterialOption = {
  key: string
  material_id?: number | null
  material_code: string
  material_name: string
}

function materialKeyOf(r: HistoryItem): string {
  if (r.material_id != null && Number(r.material_id) > 0) {
    return `id:${r.material_id}`
  }
  const code = String(r.material_code || '').trim()
  if (code) return `code:${code}`
  return 'unknown'
}

export const WorkOrderMaterialMovementsPanel: React.FC<WorkOrderMaterialMovementsPanelProps> = ({
  workOrderId,
  enabled = true,
}) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { token } = theme.useToken()
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['work-order-material-history', workOrderId],
    queryFn: () => workOrderApi.getMaterialHistory(String(workOrderId)),
    enabled: Boolean(enabled && workOrderId),
  })

  const items = (query.data?.items || []) as HistoryItem[]
  const catalogMaterials = query.data?.materials || []

  const materials = useMemo(() => {
    const map = new Map<string, MaterialOption>()
    // 左栏以 BOM 目录为准（即使尚无履历事件），再并入履历中出现的物料
    for (const m of catalogMaterials) {
      if (m.material_id == null || Number(m.material_id) <= 0) continue
      const key = `id:${m.material_id}`
      map.set(key, {
        key,
        material_id: m.material_id,
        material_code: String(m.material_code || '').trim() || '—',
        material_name: String(m.material_name || '').trim(),
      })
    }
    for (const r of items) {
      const key = materialKeyOf(r)
      const existing = map.get(key)
      if (existing) {
        if (!existing.material_name && r.material_name) {
          existing.material_name = String(r.material_name)
        }
        if (!existing.material_code && r.material_code) {
          existing.material_code = String(r.material_code)
        }
        continue
      }
      map.set(key, {
        key,
        material_id: r.material_id,
        material_code: String(r.material_code || '').trim() || '—',
        material_name: String(r.material_name || '').trim(),
      })
    }
    return Array.from(map.values()).sort((a, b) =>
      a.material_code.localeCompare(b.material_code, 'zh-CN'),
    )
  }, [catalogMaterials, items])

  useEffect(() => {
    if (materials.length === 0) {
      setSelectedKey(null)
      return
    }
    if (!selectedKey || !materials.some((m) => m.key === selectedKey)) {
      setSelectedKey(materials[0].key)
    }
  }, [materials, selectedKey])

  const filteredItems = useMemo(() => {
    if (!selectedKey) return []
    return items.filter((r) => materialKeyOf(r) === selectedKey)
  }, [items, selectedKey])

  const timelineItems = useMemo(
    () =>
      filteredItems.map((r, index) => {
        const typeLabel = t(`app.kuaizhizao.workOrder.movementType.${r.movement_type}`, {
          defaultValue: r.movement_type,
        })
        const from = r.from_warehouse_name
        const to = r.to_warehouse_name
        const warehouseLine =
          from || to ? `${from || '—'} → ${to || '—'}` : null
        const docCode = r.source_doc_code

        const openDoc = () => {
          if (r.source_doc_id == null) return
          if (r.source_doc_type === 'purchase_requisition') {
            navigate(
              `/apps/kuaizhizao/purchase-management/purchase-requisitions?highlight=${r.source_doc_id}`,
            )
            return
          }
          if (r.source_doc_type === 'purchase_order') {
            navigate(
              `/apps/kuaizhizao/purchase-management/purchase-orders?highlight=${r.source_doc_id}`,
            )
            return
          }
          if (r.source_doc_type === 'receipt_notice') {
            navigate(
              `/apps/kuaizhizao/purchase-management/receipt-notices?highlight=${r.source_doc_id}`,
            )
            return
          }
          if (r.source_doc_type === 'incoming_inspection') {
            navigate(
              `/apps/kuaizhizao/quality-management/incoming-inspection?highlight=${r.source_doc_id}`,
            )
            return
          }
          if (r.source_doc_type === 'purchase_receipt') {
            navigate(
              `/apps/kuaizhizao/warehouse-management/inbound?highlight=${r.source_doc_id}`,
            )
          }
        }

        const canOpenDoc =
          r.source_doc_id != null &&
          (
            r.source_doc_type === 'purchase_requisition' ||
            r.source_doc_type === 'purchase_order' ||
            r.source_doc_type === 'receipt_notice' ||
            r.source_doc_type === 'incoming_inspection' ||
            r.source_doc_type === 'purchase_receipt'
          )

        return {
          key: String(r.id ?? `${r.source_doc_type}-${r.source_doc_code}-${index}`),
          children: (
            <div style={{ paddingBottom: 4 }}>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', minWidth: 0 }}>
                  <Typography.Text strong>{typeLabel}</Typography.Text>
                  {docCode ? (
                    canOpenDoc ? (
                      <Button type="link" size="small" style={{ padding: 0, height: 'auto' }} onClick={openDoc}>
                        {docCode}
                      </Button>
                    ) : (
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {docCode}
                      </Typography.Text>
                    )
                  ) : null}
                  {r.remark ? (
                    <Tag {...getDocumentLifecycleStageTagProps(r.remark)}>
                      {(() => {
                        const raw = String(r.remark).trim()
                        const key = HISTORY_STATUS_I18N[raw] || HISTORY_STATUS_I18N[raw.toUpperCase()]
                        return key ? t(key) : raw
                      })()}
                    </Tag>
                  ) : null}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
                  {r.operator_name ? (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {r.operator_name}
                    </Typography.Text>
                  ) : null}
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {/* 后端 BaseSchema 已输出站点墙钟；无 tz 字符串按站点解释，禁止再手工切片 */}
                    {formatDateTimeBySiteSetting(r.occurred_at, '—')}
                  </Typography.Text>
                </div>
              </div>
              {(r.material_name || r.material_spec || (r.quantity != null && String(r.quantity) !== '')) ? (
                <div style={{ marginTop: 2 }}>
                  <Typography.Text>
                    {[r.material_name, r.material_spec].filter(Boolean).join(' ')}
                  </Typography.Text>
                  {r.quantity != null && String(r.quantity) !== '' ? (
                    <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
                      × {formatQuantity(r.quantity)}
                    </Typography.Text>
                  ) : null}
                </div>
              ) : null}
              {warehouseLine ? (
                <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                  {warehouseLine}
                </Typography.Text>
              ) : null}
            </div>
          ),
        }
      }),
    [filteredItems, navigate, t],
  )

  if (query.isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 24 }}>
        <Spin />
      </div>
    )
  }

  if (query.isError) {
    return (
      <Typography.Text type="danger">
        {(query.error as Error)?.message || t('app.kuaizhizao.workOrder.materialMovementsLoadFailed')}
      </Typography.Text>
    )
  }

  if (materials.length === 0 && items.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={t('app.kuaizhizao.workOrder.materialMovementsEmpty')}
        style={{ margin: '12px 0' }}
      />
    )
  }

  return (
    <>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 12, fontSize: 12 }}>
        {t('app.kuaizhizao.workOrder.materialMovementsDocumentHint')}
      </Typography.Paragraph>
      <div
        style={{
          display: 'flex',
          gap: 0,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadiusLG,
          minHeight: 280,
          maxHeight: 440,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: 240,
            flexShrink: 0,
            borderRight: `1px solid ${token.colorBorderSecondary}`,
            overflow: 'auto',
            background: token.colorFillQuaternary,
          }}
        >
          <div
            style={{
              padding: '8px 12px',
              fontSize: 12,
              color: token.colorTextSecondary,
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            {t('app.kuaizhizao.workOrder.materialMovementsMaterialList')}
          </div>
          <List
            size="small"
            dataSource={materials}
            renderItem={(m) => {
              const selected = m.key === selectedKey
              return (
                <List.Item
                  onClick={() => setSelectedKey(m.key)}
                  style={{
                    cursor: 'pointer',
                    padding: '8px 12px',
                    background: selected ? token.colorPrimaryBg : undefined,
                    borderInlineStart: selected
                      ? `3px solid ${token.colorPrimary}`
                      : '3px solid transparent',
                  }}
                >
                  <div style={{ width: '100%', minWidth: 0 }}>
                    <Typography.Text strong ellipsis style={{ display: 'block' }}>
                      {m.material_name || m.material_code}
                    </Typography.Text>
                    {m.material_name ? (
                      <Typography.Text type="secondary" ellipsis style={{ display: 'block', fontSize: 12 }}>
                        {m.material_code}
                      </Typography.Text>
                    ) : null}
                  </div>
                </List.Item>
              )
            }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0, padding: '12px 16px', overflow: 'auto' }}>
          {timelineItems.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                selectedKey
                  ? t('app.kuaizhizao.workOrder.materialMovementsNoHistoryForMaterial')
                  : t('app.kuaizhizao.workOrder.materialMovementsSelectMaterial')
              }
              style={{ margin: '24px 0' }}
            />
          ) : (
            <Timeline items={timelineItems} />
          )}
        </div>
      </div>
    </>
  )
}

export default WorkOrderMaterialMovementsPanel
