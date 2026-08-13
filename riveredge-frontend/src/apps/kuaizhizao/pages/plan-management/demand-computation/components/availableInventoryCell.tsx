/**
 * 需求计算「可用库存」列：hover 展示分仓库构成与净需求计算说明。
 * 列表预览弹窗与详情抽屉共用，禁止各写一套。
 */

import React from 'react'
import { Divider, Popover, Table, Typography } from 'antd'
import { useTranslation } from 'react-i18next'

function AvailableInventoryPopoverContent({ detail }: { detail?: Record<string, unknown> | null }) {
  const { t } = useTranslation()
  const bd = detail?.inventory_breakdown as Record<string, unknown> | undefined
  const supply = detail?.supply_calculation as { lines_zh?: string[] } | undefined
  const lines = supply?.lines_zh?.length ? supply.lines_zh : []

  if (!bd && lines.length === 0) {
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

export function renderAvailableInventoryCell(
  val: number | undefined,
  detail: Record<string, unknown> | undefined | null,
) {
  const text = val != null && val !== 0 ? Number(val).toLocaleString() : val === 0 ? '0' : '-'
  const supply = detail?.supply_calculation as { lines_zh?: string[] } | undefined
  const hasTip = detail?.inventory_breakdown != null || (supply?.lines_zh?.length ?? 0) > 0
  if (!hasTip) {
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
