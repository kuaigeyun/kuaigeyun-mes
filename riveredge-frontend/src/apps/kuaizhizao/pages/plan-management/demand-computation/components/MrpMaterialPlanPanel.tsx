/**
 * 单物料 MRP 分日净算明细（时间分桶 / 计划订单 / 开放供应 / 例外），对齐主流 APS MD04 视图。
 */

import React, { useCallback, useMemo, useState } from 'react'
import { App, Button, Modal, Space, Table, Tabs, Tag, Typography } from 'antd'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { firmPlannedOrders, type DemandComputationItem } from '../../../../services/demand-computation'
import { formatBusinessDateOnly, formatQuantity } from '../../../../../../utils/format'
import {
  mrpExceptionCodeLabel,
  mrpExceptionMessage,
  mrpExceptionTagColor,
  type MrpExceptionRow,
} from './mrpExceptionHelpers'

type PlannedOrderRow = {
  qty?: number
  receipt_date?: string
  release_date?: string
  firm?: boolean
  frozen?: boolean
}

type TimeBucketRow = {
  date?: string
  gross?: number
  scheduled_receipts?: number
  planned_order_receipt?: number
  projected_on_hand?: number
}

type DatedSupplyRow = {
  date?: string
  qty?: number
  source_type?: string
  document_code?: string
}

export type MrpMaterialPlanPanelProps = {
  open: boolean
  onClose: () => void
  computationId: number
  item: DemandComputationItem | null
  computationCompleted?: boolean
  canFirm?: boolean
  onFirmChanged?: () => void
}

function parseDetail(item: DemandComputationItem | null) {
  const detail = (item?.detail_results || {}) as Record<string, unknown>
  const supply = (detail.supply_calculation || {}) as Record<string, unknown>
  return {
    timeBuckets: (detail.time_buckets as TimeBucketRow[]) || [],
    plannedOrders: (supply.planned_orders as PlannedOrderRow[]) || (detail.planned_orders as PlannedOrderRow[]) || [],
    datedSupply: (detail.dated_supply as DatedSupplyRow[]) || [],
    exceptions: (detail.exceptions as MrpExceptionRow[]) || [],
    frozen: Boolean(detail.planned_orders_frozen || supply.frozen),
  }
}

function firmStatusTag(firm: boolean | undefined, frozen: boolean | undefined, t: TFunction) {
  if (frozen) {
    return <Tag color="purple">{t('app.kuaizhizao.demandComputation.mrpPlanFrozen')}</Tag>
  }
  if (firm) {
    return <Tag color="success">{t('app.kuaizhizao.demandComputation.mrpPlanFirmed')}</Tag>
  }
  return <Tag>{t('app.kuaizhizao.demandComputation.mrpPlanOpen')}</Tag>
}

export const MrpMaterialPlanPanel: React.FC<MrpMaterialPlanPanelProps> = ({
  open,
  onClose,
  computationId,
  item,
  computationCompleted = false,
  canFirm = false,
  onFirmChanged,
}) => {
  const { t } = useTranslation()
  const { message: messageApi } = App.useApp()
  const [firmLoading, setFirmLoading] = useState(false)

  const parsed = useMemo(() => parseDetail(item), [item])
  const hasAnyData =
    parsed.timeBuckets.length > 0 ||
    parsed.plannedOrders.length > 0 ||
    parsed.datedSupply.length > 0 ||
    parsed.exceptions.length > 0

  const allFirmed = parsed.plannedOrders.length > 0 && parsed.plannedOrders.every((po) => po.firm)
  const anyFrozen = parsed.frozen || parsed.plannedOrders.some((po) => po.frozen)

  const handleFirm = useCallback(
    async (firm: boolean, frozen: boolean) => {
      if (!item?.id) return
      setFirmLoading(true)
      try {
        await firmPlannedOrders(computationId, item.id, { firm, frozen })
        messageApi.success(
          firm
            ? frozen
              ? t('app.kuaizhizao.demandComputation.mrpFirmFreezeSuccess')
              : t('app.kuaizhizao.demandComputation.mrpFirmSuccess')
            : t('app.kuaizhizao.demandComputation.mrpUnfirmSuccess'),
        )
        onFirmChanged?.()
      } catch (e: unknown) {
        const err = e as { response?: { data?: { detail?: string } }; message?: string }
        messageApi.error(err?.response?.data?.detail || err?.message || t('common.operationFailed'))
      } finally {
        setFirmLoading(false)
      }
    },
    [computationId, item?.id, messageApi, onFirmChanged, t],
  )

  const title = item
    ? t('app.kuaizhizao.demandComputation.mrpPlanPanelTitle', {
        code: item.material_code,
        name: item.material_name,
      })
    : t('app.kuaizhizao.demandComputation.mrpPlanPanelTitleFallback')

  const tabItems = [
    {
      key: 'buckets',
      label: t('app.kuaizhizao.demandComputation.mrpTabTimeBuckets', { count: parsed.timeBuckets.length }),
      children: (
        <Table<TimeBucketRow>
          size="small"
          rowKey={(r, i) => `${r.date}-${i}`}
          pagination={false}
          scroll={{ y: 280 }}
          dataSource={parsed.timeBuckets}
          columns={[
            {
              title: t('app.kuaizhizao.demandComputation.mrpColDate'),
              dataIndex: 'date',
              width: 108,
              render: (v: string) => formatBusinessDateOnly(v) || v || '-',
            },
            {
              title: t('app.kuaizhizao.demandComputation.mrpColGross'),
              dataIndex: 'gross',
              width: 88,
              align: 'right',
              render: formatQuantity,
            },
            {
              title: t('app.kuaizhizao.demandComputation.mrpColScheduledReceipts'),
              dataIndex: 'scheduled_receipts',
              width: 96,
              align: 'right',
              render: formatQuantity,
            },
            {
              title: t('app.kuaizhizao.demandComputation.mrpColPlannedReceipt'),
              dataIndex: 'planned_order_receipt',
              width: 96,
              align: 'right',
              render: formatQuantity,
            },
            {
              title: t('app.kuaizhizao.demandComputation.mrpColProjectedOnHand'),
              dataIndex: 'projected_on_hand',
              width: 96,
              align: 'right',
              render: formatQuantity,
            },
          ]}
        />
      ),
    },
    {
      key: 'planned',
      label: t('app.kuaizhizao.demandComputation.mrpTabPlannedOrders', { count: parsed.plannedOrders.length }),
      children: (
        <Table<PlannedOrderRow>
          size="small"
          rowKey={(r, i) => `${r.receipt_date}-${r.release_date}-${i}`}
          pagination={false}
          scroll={{ y: 280 }}
          dataSource={parsed.plannedOrders}
          columns={[
            {
              title: t('common.quantity'),
              dataIndex: 'qty',
              width: 88,
              align: 'right',
              render: formatQuantity,
            },
            {
              title: t('app.kuaizhizao.demandComputation.mrpColReleaseDate'),
              dataIndex: 'release_date',
              width: 108,
              render: (v: string) => formatBusinessDateOnly(v) || v || '-',
            },
            {
              title: t('app.kuaizhizao.demandComputation.mrpColReceiptDate'),
              dataIndex: 'receipt_date',
              width: 108,
              render: (v: string) => formatBusinessDateOnly(v) || v || '-',
            },
            {
              title: t('app.kuaizhizao.demandComputation.mrpColPlanStatus'),
              key: 'status',
              width: 96,
              render: (_: unknown, row: PlannedOrderRow) => firmStatusTag(row.firm, row.frozen, t),
            },
          ]}
        />
      ),
    },
    {
      key: 'supply',
      label: t('app.kuaizhizao.demandComputation.mrpTabOpenSupply', { count: parsed.datedSupply.length }),
      children: (
        <Table<DatedSupplyRow>
          size="small"
          rowKey={(r, i) => `${r.document_code}-${r.date}-${i}`}
          pagination={false}
          scroll={{ y: 280 }}
          dataSource={parsed.datedSupply}
          columns={[
            {
              title: t('app.kuaizhizao.demandComputation.mrpColDate'),
              dataIndex: 'date',
              width: 108,
              render: (v: string) => formatBusinessDateOnly(v) || v || '-',
            },
            {
              title: t('common.quantity'),
              dataIndex: 'qty',
              width: 88,
              align: 'right',
              render: formatQuantity,
            },
            {
              title: t('app.kuaizhizao.demandComputation.mrpColSourceType'),
              dataIndex: 'source_type',
              width: 96,
            },
            {
              title: t('app.kuaizhizao.demandComputation.mrpColDocument'),
              dataIndex: 'document_code',
              ellipsis: true,
            },
          ]}
        />
      ),
    },
    {
      key: 'exceptions',
      label: t('app.kuaizhizao.demandComputation.mrpTabExceptions', { count: parsed.exceptions.length }),
      children: parsed.exceptions.length ? (
        <ul style={{ maxHeight: 320, overflow: 'auto', paddingLeft: 18, margin: 0 }}>
          {parsed.exceptions.map((ex, idx) => (
            <li key={idx} style={{ marginBottom: 8 }}>
              <Tag color={mrpExceptionTagColor(ex)}>{mrpExceptionCodeLabel(ex.code, t)}</Tag>
              <span>{mrpExceptionMessage(ex)}</span>
              {ex.document_code ? (
                <Typography.Text type="secondary" style={{ marginLeft: 6 }}>
                  [{ex.document_code}]
                </Typography.Text>
              ) : null}
              {ex.qty != null ? (
                <Typography.Text type="secondary" style={{ marginLeft: 6 }}>
                  ({ex.qty})
                </Typography.Text>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <Typography.Text type="secondary">{t('app.kuaizhizao.demandComputation.mrpNoExceptions')}</Typography.Text>
      ),
    },
  ]

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      width={720}
      destroyOnHidden
      footer={
        <Space wrap>
          {canFirm && computationCompleted && parsed.plannedOrders.length > 0 ? (
            <>
              {!allFirmed ? (
                <Button loading={firmLoading} type="primary" onClick={() => void handleFirm(true, false)}>
                  {t('app.kuaizhizao.demandComputation.mrpActionFirm')}
                </Button>
              ) : null}
              {allFirmed && !anyFrozen ? (
                <Button loading={firmLoading} onClick={() => void handleFirm(true, true)}>
                  {t('app.kuaizhizao.demandComputation.mrpActionFreeze')}
                </Button>
              ) : null}
              {allFirmed ? (
                <Button loading={firmLoading} onClick={() => void handleFirm(false, false)}>
                  {t('app.kuaizhizao.demandComputation.mrpActionUnfirm')}
                </Button>
              ) : null}
            </>
          ) : null}
          <Button onClick={onClose}>{t('common.close')}</Button>
        </Space>
      }
    >
      {!hasAnyData ? (
        <Typography.Text type="secondary">{t('app.kuaizhizao.demandComputation.mrpPlanPanelEmpty')}</Typography.Text>
      ) : (
        <Tabs items={tabItems} size="small" />
      )}
    </Modal>
  )
}
