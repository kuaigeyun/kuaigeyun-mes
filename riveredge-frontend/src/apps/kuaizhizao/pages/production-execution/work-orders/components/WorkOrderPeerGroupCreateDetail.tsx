/**
 * 新建平级组工单 — 明细表（产品 + 数量 + 优先级 + 工艺/跳转/超报）
 */
import React, { useMemo, useState } from 'react'
import { Button, Form, InputNumber, Select, Space, Switch } from 'antd'
import { ThemedSegmented } from '../../../../../../components/themed-segmented'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { UniTableDetail } from '../../../../../../components/uni-table-detail'
import { UniDropdown } from '../../../../../../components/uni-dropdown'
import type { FormInstance } from 'antd/es/form'
import type { Material } from '../../../../../master-data/types/material'
import { processRouteApi } from '../../../../../master-data/services/process'

/** 按物料解析默认工艺路线并写入组内明细行 */
async function applyDefaultProcessRouteToPeerGroupRow(
  form: FormInstance,
  index: number,
  materialUuid: string
): Promise<void> {
  try {
    const route = await processRouteApi.getProcessRouteForMaterial(materialUuid)
    if (!route?.id) {
      form.setFieldValue(['group_items', index, 'process_route_id'], undefined)
      form.setFieldValue(['group_items', index, 'allow_operation_jump'], false)
      return
    }
    let routeJump = false
    if (route.uuid) {
      try {
        const routeDetail = await processRouteApi.get(route.uuid)
        routeJump =
          (routeDetail as { allow_operation_jump?: boolean; allowOperationJump?: boolean })
            ?.allow_operation_jump ??
          (routeDetail as { allowOperationJump?: boolean })?.allowOperationJump ??
          false
      } catch {
        /* 仅填路线 ID */
      }
    }
    form.setFieldValue(['group_items', index, 'process_route_id'], route.id)
    form.setFieldValue(['group_items', index, 'allow_operation_jump'], routeJump)
  } catch {
    form.setFieldValue(['group_items', index, 'process_route_id'], undefined)
    form.setFieldValue(['group_items', index, 'allow_operation_jump'], false)
  }
}

const LazyUniMaterialSelect = React.lazy(
  () =>
    import('../../../../../../components/uni-material-select').then((m) => ({
      default: m.UniMaterialSelect,
    }))
)

function usePriorityOptions() {
  const { t } = useTranslation()
  return useMemo(
    () => [
      { label: t('app.kuaizhizao.workOrder.priorityLow'), value: 'low' },
      { label: t('app.kuaizhizao.workOrder.priorityNormal'), value: 'normal' },
      { label: t('app.kuaizhizao.workOrder.priorityHigh'), value: 'high' },
      { label: t('app.kuaizhizao.workOrder.priorityUrgent'), value: 'urgent' },
    ],
    [t]
  )
}

export const EMPTY_PEER_GROUP_ITEM = {
  product_id: undefined as number | undefined,
  quantity: 1,
  priority: 'normal',
  process_route_id: undefined as number | undefined,
  allow_operation_jump: false,
  over_report_mode: 'none',
  over_report_value: 0,
}

export type WorkOrderPeerGroupCreateDetailProps = {
  processRouteList: Array<{ id: number; uuid?: string; code?: string; name?: string }>
}

const PeerGroupMaterialCell: React.FC<{ index: number; sourceType?: string }> = ({
  index,
  sourceType,
}) => {
  const { t } = useTranslation()
  const form = Form.useFormInstance()
  const row = Form.useWatch(['group_items', index])
  const mid =
    row?.product_id != null && row?.product_id !== '' ? Number(row.product_id) : null
  const fallback =
    mid != null && Number.isFinite(mid) && (row?.product_code || row?.product_name)
      ? {
          value: mid,
          label:
            `${row.product_code || ''} - ${row.product_name || ''}`.trim() || String(mid),
        }
      : undefined

  return (
    <div className="work-order-peer-group-material-cell" style={{ minWidth: 200 }}>
      <React.Suspense fallback={null}>
        <LazyUniMaterialSelect
          name={[index, 'product_id']}
          label=""
          placeholder={t('app.kuaizhizao.workOrder.formSelectProduct')}
          required
          size="small"
          sourceType={sourceType}
          listFieldKey={index}
          listFieldName="group_items"
          fillMapping={{
            product_code: 'mainCode',
            product_name: 'name',
          }}
          fallbackOption={fallback}
          formItemProps={{ style: { margin: 0 } }}
          showQuickCreate
          showAdvancedSearch
          onChange={async (val, material) => {
            if (!val || !material) {
              form.setFieldValue(['group_items', index, 'product_code'], undefined)
              form.setFieldValue(['group_items', index, 'product_name'], undefined)
              form.setFieldValue(['group_items', index, 'process_route_id'], undefined)
              form.setFieldValue(['group_items', index, 'allow_operation_jump'], false)
              return
            }
            const m = material as Material
            form.setFieldValue(['group_items', index, 'product_code'], m.mainCode || (m as { code?: string }).code)
            form.setFieldValue(['group_items', index, 'product_name'], m.name)
            if (m.uuid) {
              await applyDefaultProcessRouteToPeerGroupRow(form, index, m.uuid)
            } else {
              form.setFieldValue(['group_items', index, 'process_route_id'], undefined)
              form.setFieldValue(['group_items', index, 'allow_operation_jump'], false)
            }
          }}
        />
      </React.Suspense>
    </div>
  )
}

const PeerGroupOverReportCell: React.FC<{
  index: number
  overReportModeOptions: Array<{ label: string; value: string }>
}> = ({ index, overReportModeOptions }) => {
  const mode = Form.useWatch(['group_items', index, 'over_report_mode']) ?? 'none'

  return (
    <Space.Compact style={{ width: '100%' }}>
      <Form.Item
        name={[index, 'over_report_mode']}
        initialValue="none"
        style={{ margin: 0, flex: 1, minWidth: 88 }}
      >
        <Select options={overReportModeOptions} size="small" />
      </Form.Item>
      <Form.Item name={[index, 'over_report_value']} initialValue={0} style={{ margin: 0, width: 88 }}>
        <InputNumber
          min={0}
          precision={4}
          size="small"
          style={{ width: '100%' }}
          disabled={mode === 'none'}
        />
      </Form.Item>
    </Space.Compact>
  )
}

const PeerGroupProcessRouteCell: React.FC<{
  index: number
  processRouteList: WorkOrderPeerGroupCreateDetailProps['processRouteList']
}> = ({ index, processRouteList }) => {
  const { t } = useTranslation()
  const form = Form.useFormInstance()

  return (
    <Form.Item name={[index, 'process_route_id']} style={{ margin: 0 }}>
      <UniDropdown
        placeholder={t('app.kuaizhizao.workOrder.formOptional')}
        size="small"
        options={processRouteList.map((route) => ({
          label: `${route.code} - ${route.name}`,
          value: route.id,
        }))}
        showSearch
        allowClear
        advancedSearch={{
          label: t('app.kuaizhizao.workOrder.formAdvancedSearch'),
          fields: [
            { name: 'code', label: t('app.kuaizhizao.workOrder.formProcessRouteCode') },
            { name: 'name', label: t('app.kuaizhizao.workOrder.formProcessRouteName') },
          ],
          onSearch: async (values) => {
            try {
              const res = await processRouteApi.list({ ...values, limit: 100 })
              const list = Array.isArray(res) ? res : (res as { data?: unknown[] })?.data || []
              return (list as Array<{ id: number; code?: string; name?: string }>).map((r) => ({
                value: r.id,
                label: `${r.code ?? ''} - ${r.name ?? ''}`.trim() || String(r.id),
              }))
            } catch {
              return []
            }
          },
        }}
        onChange={async (value) => {
          if (!value) {
            form.setFieldValue(['group_items', index, 'allow_operation_jump'], false)
            return
          }
          const route = processRouteList.find((r) => r.id === value)
          if (!route?.uuid) return
          try {
            const routeDetail = await processRouteApi.get(route.uuid)
            const routeJump =
              (routeDetail as { allow_operation_jump?: boolean; allowOperationJump?: boolean })
                ?.allow_operation_jump ??
              (routeDetail as { allowOperationJump?: boolean })?.allowOperationJump ??
              false
            form.setFieldValue(['group_items', index, 'allow_operation_jump'], routeJump)
          } catch {
            /* 路线详情失败时保留用户可手动改跳转开关 */
          }
        }}
      />
    </Form.Item>
  )
}

export const WorkOrderPeerGroupCreateDetail: React.FC<WorkOrderPeerGroupCreateDetailProps> = ({
  processRouteList,
}) => {
  const { t } = useTranslation()
  const form = Form.useFormInstance()
  const priorityOptions = usePriorityOptions()
  const [onlyShowMake, setOnlyShowMake] = useState(true)
  const materialSourceType = onlyShowMake ? 'Make' : undefined

  const appendRow = () => {
    const items = form.getFieldValue('group_items') || []
    form.setFieldValue('group_items', [...items, { ...EMPTY_PEER_GROUP_ITEM }])
  }

  const overReportModeOptions = useMemo(
    () => [
      { label: t('field.operation.overReportModeNone'), value: 'none' },
      { label: t('field.operation.overReportModeFixed'), value: 'fixed' },
      { label: t('field.operation.overReportModePercent'), value: 'percent' },
    ],
    [t]
  )

  const columns = useMemo<ColumnsType<Record<string, unknown>>>(
    () => [
      {
        title: t('app.kuaizhizao.workOrder.colProduct'),
        key: 'product_id',
        width: 240,
        fixed: 'left',
        render: (_: unknown, __: unknown, index: number) => (
          <PeerGroupMaterialCell index={index} sourceType={materialSourceType} />
        ),
      },
      {
        title: t('app.kuaizhizao.workOrder.colPlannedQty'),
        key: 'quantity',
        width: 100,
        render: (_: unknown, __: unknown, index: number) => (
          <Form.Item
            name={[index, 'quantity']}
            rules={[{ required: true, message: t('common.required') }]}
            style={{ margin: 0 }}
          >
            <InputNumber min={0.0001} precision={2} style={{ width: '100%' }} size="small" />
          </Form.Item>
        ),
      },
      {
        title: t('app.kuaizhizao.workOrder.colPriority'),
        key: 'priority',
        width: 96,
        render: (_: unknown, __: unknown, index: number) => (
          <Form.Item name={[index, 'priority']} initialValue="normal" style={{ margin: 0 }}>
            <Select options={priorityOptions} size="small" />
          </Form.Item>
        ),
      },
      {
        title: t('app.kuaizhizao.workOrder.colProcessRoute'),
        key: 'process_route_id',
        width: 200,
        render: (_: unknown, __: unknown, index: number) => (
          <PeerGroupProcessRouteCell index={index} processRouteList={processRouteList} />
        ),
      },
      {
        title: t('app.kuaizhizao.workOrder.colAllowOpJump'),
        key: 'allow_operation_jump',
        width: 110,
        align: 'center',
        render: (_: unknown, __: unknown, index: number) => (
          <Form.Item
            name={[index, 'allow_operation_jump']}
            valuePropName="checked"
            initialValue={false}
            style={{ margin: 0 }}
          >
            <Switch size="small" />
          </Form.Item>
        ),
      },
      {
        title: t('app.kuaizhizao.workOrder.colOverReport'),
        key: 'over_report',
        width: 200,
        render: (_: unknown, __: unknown, index: number) => (
          <PeerGroupOverReportCell index={index} overReportModeOptions={overReportModeOptions} />
        ),
      },
    ],
    [t, materialSourceType, overReportModeOptions, priorityOptions, processRouteList]
  )

  return (
    <>
      <style>{`
        .work-order-peer-group-detail-table .work-order-peer-group-material-cell .ant-form-item,
        .work-order-peer-group-detail-table .work-order-peer-group-material-cell .ant-select {
          width: 100% !important;
          min-width: 0;
        }
      `}</style>
      <UniTableDetail
        name="group_items"
        title={t('app.kuaizhizao.workOrder.formGroupItemsTitle')}
        required
        requiredMessage={t('app.kuaizhizao.workOrder.formGroupItemsRequired')}
        leftExtra={
          <ThemedSegmented
            value={onlyShowMake ? 'make' : 'all'}
            onChange={(v) => setOnlyShowMake(v === 'make')}
            options={[
              { label: t('app.kuaizhizao.workOrder.formSegmentMake'), value: 'make' },
              { label: t('app.kuaizhizao.workOrder.formSegmentAll'), value: 'all' },
            ]}
          />
        }
        disabledAdd
        minRows={2}
        headerExtra={
          <Space size={8}>
            <Button type="dashed" icon={<PlusOutlined />} onClick={appendRow}>
              {t('app.kuaizhizao.workOrder.actionAddDetail')}
            </Button>
          </Space>
        }
        initialValue={EMPTY_PEER_GROUP_ITEM}
        columns={columns}
        tableProps={{
          className: 'work-order-peer-group-detail-table',
          size: 'small',
          scroll: { x: 1100 },
          style: { width: '100%', margin: 0 },
        }}
      />
    </>
  )
}

export default WorkOrderPeerGroupCreateDetail
