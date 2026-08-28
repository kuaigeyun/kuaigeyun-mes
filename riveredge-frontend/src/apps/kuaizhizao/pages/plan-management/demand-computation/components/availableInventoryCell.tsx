/**
 * 需求计算「可用库存」「净需求」列：hover 展示分仓库构成与净需求计算说明。
 * 列表预览弹窗与详情抽屉共用，禁止各写一套。
 */

import React from 'react'
import { Divider, Popover, Table, Typography } from 'antd'
import { useTranslation } from 'react-i18next'

function AvailableInventoryPopoverContent({ detail }: { detail?: Record<string, unknown> | null }) {
  const { t } = useTranslation()
  const bd = detail?.inventory_breakdown as Record<string, unknown> | undefined
  const supply = detail?.supply_calculation as {
    lines_zh?: string[]
    covered_by_supply?: boolean
    in_transit_quantity?: number
  } | undefined
  const lines = supply?.lines_zh?.length ? supply.lines_zh : []
  const inTransit =
    Number(detail?.in_transit_quantity ?? supply?.in_transit_quantity ?? 0) || 0
  const covered =
    Boolean(detail?.covered_by_supply) || Boolean(supply?.covered_by_supply)

  if (!bd && lines.length === 0 && inTransit <= 0 && !covered) {
    return (
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {t('app.kuaizhizao.demandComputation.inventoryNoDetail')}
      </Typography.Text>
    )
  }

  const mainBatch = bd?.main_batch as { label?: string; quantity?: number; note_zh?: string } | undefined
  const lineRows = (bd?.line_side_rows as Array<Record<string, unknown>>) || []
  const formulaZh = (bd?.formula_zh as string[]) || []
  const scopeZh = bd?.line_side_scope_zh as string | undefined

  return (
    <div style={{ maxWidth: 440, fontSize: 12 }}>
      {covered ? (
        <Typography.Paragraph type="warning" style={{ marginBottom: 8, fontSize: 12 }}>
          {t('app.kuaizhizao.demandComputation.netCoveredBySupplyHint')}
        </Typography.Paragraph>
      ) : null}
      {inTransit > 0 ? (
        <div style={{ marginBottom: 8 }}>
          {t('app.kuaizhizao.demandComputation.colInTransitQty')}:
          <strong style={{ marginLeft: 4 }}>{inTransit.toLocaleString()}</strong>
          <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
            {t('app.kuaizhizao.demandComputation.inTransitNotInAvailableCol')}
          </Typography.Text>
        </div>
      ) : null}
      {bd ? (
        <>
          <Typography.Text strong>{t('app.kuaizhizao.demandComputation.inventoryComposition')}</Typography.Text>
          <div style={{ marginTop: 8 }}>
            {mainBatch != null ? (
              <div style={{ marginBottom: 8 }}>
                <div>
                  {mainBatch.label ?? t('app.kuaizhizao.demandComputation.mainBatchDefault')}:
                  <strong>{Number(mainBatch.quantity ?? 0).toLocaleString()}</strong>
                </div>
                {mainBatch.note_zh ? (
                  <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                    {mainBatch.note_zh}
                  </Typography.Text>
                ) : null}
              </div>
            ) : null}
            {scopeZh ? (
              <Typography.Paragraph type="secondary" style={{ marginBottom: 8, fontSize: 11 }}>
                {t('app.kuaizhizao.demandComputation.lineSideScope', { scope: scopeZh })}
              </Typography.Paragraph>
            ) : null}
            {lineRows.length > 0 ? (
              <Table
                size="small"
                pagination={false}
                rowKey={(r) => String(r.warehouse_id)}
                columns={[
                  { title: t('app.kuaizhizao.demandComputation.colWarehouse'), dataIndex: 'warehouse_name', width: 120, ellipsis: true },
                  {
                    title: t('app.kuaizhizao.demandComputation.colOnHand'),
                    dataIndex: 'quantity',
                    width: 72,
                    align: 'right' as const,
                    render: (n: unknown) => Number(n ?? 0).toLocaleString(),
                  },
                  {
                    title: t('app.kuaizhizao.demandComputation.colReserved'),
                    dataIndex: 'reserved',
                    width: 60,
                    align: 'right' as const,
                    render: (n: unknown) => Number(n ?? 0).toLocaleString(),
                  },
                  {
                    title: t('app.kuaizhizao.demandComputation.colAvailable'),
                    dataIndex: 'available',
                    width: 72,
                    align: 'right' as const,
                    render: (n: unknown) => Number(n ?? 0).toLocaleString(),
                  },
                ]}
                dataSource={lineRows}
              />
            ) : (
              <Typography.Text type="secondary">{t('app.kuaizhizao.demandComputation.noLineSideRows')}</Typography.Text>
            )}
            {formulaZh.length > 0 ? (
              <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: 'rgba(0,0,0,0.55)' }}>
                {formulaZh.map((formulaLine, i) => (
                  <li key={i}>{formulaLine}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </>
      ) : null}

      {lines.length > 0 ? (
        <>
          <Divider style={{ margin: '12px 0 8px' }} />
          <Typography.Text strong>{t('app.kuaizhizao.demandComputation.netRequirementHow')}</Typography.Text>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: 'rgba(0,0,0,0.55)' }}>
            {lines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  )
}

function hasSupplyTip(detail: Record<string, unknown> | undefined | null): boolean {
  if (!detail) return false
  const supply = detail.supply_calculation as {
    lines_zh?: string[]
    covered_by_supply?: boolean
    in_transit_quantity?: number
  } | undefined
  const inTransit = Number(detail.in_transit_quantity ?? supply?.in_transit_quantity ?? 0) || 0
  return (
    detail.inventory_breakdown != null ||
    (supply?.lines_zh?.length ?? 0) > 0 ||
    Boolean(detail.covered_by_supply) ||
    Boolean(supply?.covered_by_supply) ||
    inTransit > 0
  )
}

export function renderAvailableInventoryCell(
  val: number | undefined,
  detail: Record<string, unknown> | undefined | null,
) {
  const text = val != null && val !== 0 ? Number(val).toLocaleString() : val === 0 ? '0' : '-'
  if (!hasSupplyTip(detail)) {
    return <span>{text}</span>
  }
  return (
    <Popover
      content={<AvailableInventoryPopoverContent detail={detail} />}
      trigger="hover"
      mouseEnterDelay={0.2}
    >
      <span style={{ cursor: 'help', borderBottom: '1px dashed rgba(0,0,0,0.22)' }}>{text}</span>
    </Popover>
  )
}

/**
 * 净需求列：被供应冲抵时虚线下划线 + 角标提示，hover 同可用库存说明。
 */
export function renderNetRequirementCell(
  val: number | undefined,
  detail: Record<string, unknown> | undefined | null,
  formatQty: (v: number | undefined) => React.ReactNode,
) {
  const supply = detail?.supply_calculation as { covered_by_supply?: boolean } | undefined
  const covered =
    Boolean(detail?.covered_by_supply) || Boolean(supply?.covered_by_supply)
  const text = formatQty(val)
  if (!hasSupplyTip(detail) && !covered) {
    return <span>{text}</span>
  }
  return (
    <Popover
      content={<AvailableInventoryPopoverContent detail={detail} />}
      trigger="hover"
      mouseEnterDelay={0.2}
    >
      <span style={{ cursor: 'help', borderBottom: '1px dashed rgba(0,0,0,0.22)' }}>
        {text}
        {covered ? (
          <Typography.Text type="secondary" style={{ marginLeft: 4, fontSize: 11 }}>
            {/* 文案由父级 t 注入会更干净；此处用短标记避免重复拉 i18n hook 到非组件 */}
            *
          </Typography.Text>
        ) : null}
      </span>
    </Popover>
  )
}
