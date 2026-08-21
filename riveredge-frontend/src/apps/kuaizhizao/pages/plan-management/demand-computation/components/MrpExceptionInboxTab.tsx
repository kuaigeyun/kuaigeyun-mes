import React, { useMemo, useRef, useState } from 'react'
import { ProColumns } from '@ant-design/pro-components'
import { App, Alert, Button, Space } from 'antd'
import { useTranslation } from 'react-i18next'
import { UniTable } from '../../../../../../components/uni-table'
import { rowActionKind } from '../../../../../../components/uni-action'
import { MaterialStackedCell } from '../../../../../../components/uni-table/stackedPrimaryColumn'
import { MarkerTag } from '../../../../../../constants/statusBadges'
import { useOptionalLinkedDocumentDetail } from '../../../../../../components/linked-document-detail/LinkedDocumentDetailContext'
import { formatDateTimeBySiteSetting, formatBusinessDateOnly } from '../../../../../../utils/format'
import { alignProColumns, GLOBAL_DOC_LIST_FIELD_RANK } from '../../../sales-management/shared/documentFieldAlignment'
import {
  getMrpExceptionInbox,
  type MrpExceptionInboxItem,
} from '../../../../services/demand-computation'
import {
  MRP_EXCEPTION_ERROR_CODES,
  MRP_EXCEPTION_WARNING_CODES,
  mrpExceptionCodeLabel,
  mrpExceptionMessage,
  mrpExceptionTagColor,
} from './mrpExceptionHelpers'

const SUPPLY_LINK_CODES = new Set(['RESCHEDULE_IN', 'RESCHEDULE_OUT', 'CANCEL_SUPPLY', 'PAST_DUE_SUPPLY'])

export type MrpExceptionInboxTabProps = {
  onOpenComputationDetail: (computationId: number, itemId: number) => void
  onOpenPushPreview: (computationId: number) => void
}

export const MrpExceptionInboxTab: React.FC<MrpExceptionInboxTabProps> = ({
  onOpenComputationDetail,
  onOpenPushPreview,
}) => {
  const { t } = useTranslation()
  const { message: messageApi } = App.useApp()
  const linkedDetail = useOptionalLinkedDocumentDetail()
  const actionRef = useRef<{ reload: () => void }>(null)
  const [summary, setSummary] = useState<{
    total: number
    error_count: number
    warning_count: number
    summary_by_code: Record<string, number>
  } | null>(null)

  const exceptionCodeValueEnum = useMemo(() => {
    const codes = [...MRP_EXCEPTION_ERROR_CODES, ...MRP_EXCEPTION_WARNING_CODES]
    return Object.fromEntries(
      codes.map((code) => [code, { text: mrpExceptionCodeLabel(code, t) }]),
    )
  }, [t])

  const severityValueEnum = useMemo(
    () => ({
      error: { text: t('app.kuaizhizao.demandComputation.inboxSeverityError') },
      warning: { text: t('app.kuaizhizao.demandComputation.inboxSeverityWarning') },
      info: { text: t('app.kuaizhizao.demandComputation.inboxSeverityInfo') },
    }),
    [t],
  )

  const handleOpenSupply = (row: MrpExceptionInboxItem) => {
    const docId = row.document_id
    const docType = row.document_source_type
    if (!docId || !docType) {
      messageApi.warning(t('app.kuaizhizao.demandComputation.inboxNoLinkedDocument'))
      return
    }
    const opened = linkedDetail?.openLinkedDocumentDetail(docType, Number(docId))
    if (!opened) {
      messageApi.warning(t('app.kuaizhizao.demandComputation.inboxOpenDocumentFailed'))
    }
  }

  const columns: ProColumns<MrpExceptionInboxItem>[] = useMemo(
    () =>
      alignProColumns<MrpExceptionInboxItem>([
      {
        title: t('app.kuaizhizao.demandComputation.inboxColSeverity'),
        key: 'mrp_inbox_severity',
        dataIndex: 'severity',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        valueType: 'select',
        valueEnum: severityValueEnum,
        render: (_, row) => (
          <MarkerTag color={mrpExceptionTagColor(row)}>
            {mrpExceptionCodeLabel(row.code, t)}
          </MarkerTag>
        ),
      },
      {
        title: t('common.remark'),
        key: 'mrp_inbox_message',
        dataIndex: 'message',
        hideInSearch: true,
        ellipsis: false,
        uniTablePrimaryFlex: true,
        render: (_, row) => mrpExceptionMessage(row),
        onCell: () => ({
          style: { whiteSpace: 'normal', wordBreak: 'break-word' },
        }),
      },
      {
        title: t('app.kuaizhizao.demandComputation.inboxColMaterial'),
        key: 'mrp_inbox_material',
        dataIndex: 'material_code',
        width: 200,
        minWidth: 200,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        render: (_, row) => (
          <MaterialStackedCell material_code={row.material_code} material_name={row.material_name} />
        ),
      },
      {
        title: t('app.kuaizhizao.demandComputation.inboxColComputation'),
        key: 'mrp_inbox_computation',
        dataIndex: 'computation_code',
        width: 148,
        minWidth: 148,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        render: (_, row) => row.computation_code || `#${row.computation_id}`,
      },
      {
        title: t('app.kuaizhizao.demandComputation.inboxColBucketDate'),
        key: 'mrp_inbox_bucket_date',
        dataIndex: 'bucket_date',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        render: (_, row) => (row.bucket_date ? formatBusinessDateOnly(row.bucket_date) : '-'),
      },
      {
        title: t('app.kuaizhizao.demandComputation.inboxColDocument'),
        key: 'mrp_inbox_document',
        dataIndex: 'document_code',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        render: (_, row) => row.document_code || '-',
      },
      {
        title: t('app.kuaizhizao.demandComputation.inboxColComputedAt'),
        key: 'mrp_inbox_computed_at',
        dataIndex: 'computation_end_time',
        width: 160,
        minWidth: 160,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        render: (_, row) =>
          row.computation_end_time ? formatDateTimeBySiteSetting(row.computation_end_time) : '-',
      },
      {
        title: t('app.kuaizhizao.demandComputation.inboxColCode'),
        dataIndex: 'code',
        hideInTable: true,
        valueType: 'select',
        valueEnum: exceptionCodeValueEnum,
      },
      {
        title: t('common.actions'),
        key: 'option',
        valueType: 'option',
        fixed: 'right',
        hideInSearch: true,
        render: (_, row) => {
          const parts: React.ReactNode[] = [
            <Button
              {...rowActionKind('read')}
              key="plan"
              onClick={() => onOpenComputationDetail(row.computation_id, row.item_id)}
            >
              {t('app.kuaizhizao.demandComputation.inboxActionMrpDetail')}
            </Button>,
          ]
          if (row.code === 'NEW_ORDER') {
            parts.push(
              <Button
                {...rowActionKind('execute')}
                key="push"
                onClick={() => onOpenPushPreview(row.computation_id)}
              >
                {t('app.kuaizhizao.demandComputation.inboxActionPushPreview')}
              </Button>,
            )
          }
          if (
            SUPPLY_LINK_CODES.has(String(row.code || '')) &&
            row.document_id &&
            row.document_source_type
          ) {
            parts.push(
              <Button {...rowActionKind('read')} key="doc" onClick={() => handleOpenSupply(row)}>
                {t('app.kuaizhizao.demandComputation.inboxActionOpenSupply')}
              </Button>,
            )
          }
          return parts
        },
      },
    ], GLOBAL_DOC_LIST_FIELD_RANK),
    [exceptionCodeValueEnum, onOpenComputationDetail, onOpenPushPreview, severityValueEnum, t],
  )

  const summaryBanner = summary ? (
    <Alert
      type={summary.error_count > 0 ? 'error' : summary.warning_count > 0 ? 'warning' : 'info'}
      showIcon
      style={{ marginBottom: 12 }}
      title={t('app.kuaizhizao.demandComputation.inboxSummaryTitle', {
        total: summary.total,
        errors: summary.error_count,
        warnings: summary.warning_count,
      })}
      description={
        Object.keys(summary.summary_by_code).length ? (
          <Space size={[8, 8]} wrap>
            {Object.entries(summary.summary_by_code)
              .sort((a, b) => b[1] - a[1])
              .map(([code, count]) => (
                <MarkerTag key={code}>
                  {mrpExceptionCodeLabel(code, t)} {count}
                </MarkerTag>
              ))}
          </Space>
        ) : undefined
      }
    />
  ) : null

  return (
    <>
      {summaryBanner}
      <UniTable<MrpExceptionInboxItem>
        columnPersistenceId="apps.kuaizhizao.pages.plan-management.demand-computation-mrp-exception-inbox-rank-v1"
        actionRef={actionRef}
        columns={columns}
        rowKey="inbox_key"
        search={{ labelWidth: 'auto' }}
        showCreateButton={false}
        request={async (params, _sort, _filter, searchFormValues) => {
          const s = (searchFormValues ?? {}) as Record<string, unknown>
          const result = await getMrpExceptionInbox({
            skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
            limit: params.pageSize ?? 20,
            code: typeof s.code === 'string' && s.code ? s.code : undefined,
            severity: typeof s.severity === 'string' && s.severity ? s.severity : undefined,
          })
          setSummary({
            total: result.total,
            error_count: result.error_count,
            warning_count: result.warning_count,
            summary_by_code: result.summary_by_code,
          })
          return {
            data: result.items,
            success: true,
            total: result.total,
          }
        }}
      />
    </>
  )
}

export default MrpExceptionInboxTab
