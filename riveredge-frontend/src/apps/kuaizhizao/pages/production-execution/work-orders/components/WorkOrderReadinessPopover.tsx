/**
 * 工单列表「齐套率」列：点击打开 Modal，展示库位分布与叫料申请（Tab）
 * - 叫料：生产现场 → 仓库；仓库在配料中心备货（仓储关联配置）
 * - 叫料类型：整单（一张单多行明细）/ 单独叫料（自选多物料）；单独叫料原因：MATERIAL_CALL_REASON
 * - 发起叫料为独立 Modal（zIndex 更高），挂在主 Modal 同级，避免嵌套 Dialog 事件问题
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { SelectProps } from 'antd'
import { Spin, Empty, Typography, Table, Space, Modal, Form, Button, InputNumber, Input, App, Select, Tabs } from 'antd'
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { workOrderApi } from '../../../../services/production'
import { warehouseApi } from '../../../../services/warehouse-execution'
import { getMaterialCallLifecycle } from '../../../../utils/materialCallLifecycle'
import UniMaterialSelect from '../../../../../../components/uni-material-select'
import { getDataDictionaryByCode, getDictionaryItemList } from '../../../../../../services/dataDictionary'
import { useInvalidateMenuBadgeCounts } from '../../../../../../hooks/useInvalidateMenuBadgeCounts'

const FALLBACK_CALL_TYPE_OPTIONS = [
  { label: '单独叫料', value: 'CUSTOM_SELECTION' },
  { label: '整单叫料', value: 'FULL_ORDER' },
]

/** 叫料类型码 → 中文（与字典兜底一致；表格内同步展示，不依赖字典异步加载） */
const MATERIAL_CALL_TYPE_ZH: Record<string, string> = {
  ...Object.fromEntries(FALLBACK_CALL_TYPE_OPTIONS.map((o) => [o.value, o.label])),
  SINGLE_MATERIAL: '单独叫料',
}

function formatMaterialCallTypeZh(code: unknown): string {
  const s = String(code ?? '').trim()
  if (!s) return '—'
  return MATERIAL_CALL_TYPE_ZH[s] ?? s
}

/** 主 Modal body：不设 maxHeight/overflow，避免内容未溢出时仍出现内层滚动条；超长内容由 .ant-modal-wrap 整体滚动 */
const READINESS_MAIN_MODAL_BODY_STYLE = {
  paddingTop: 12,
  overflow: 'visible',
  maxHeight: 'none',
} satisfies React.CSSProperties

const FALLBACK_CALL_REASON_OPTIONS = [
  { label: '线边仓缺料', value: 'LINE_SIDE_SHORTAGE' },
  { label: '批量领料未领足', value: 'PICKING_SHORTAGE' },
  { label: '报废/质量异常补料', value: 'SCRAP_REPLENISH' },
  { label: '工艺或设计变更换料', value: 'ENGINEERING_CHANGE' },
  { label: '计划变更/紧急插单', value: 'PLAN_CHANGE' },
  { label: '试制/打样加料', value: 'TRIAL_SAMPLE' },
  { label: '其他', value: 'OTHER' },
]

/** 阻止事件冒泡到 rc-table 行（expandRowByClick 时否则会触发展开/收起） */
function stopRowToggle(e: React.MouseEvent) {
  e.stopPropagation()
}

/** 齐套分析项 required_quantity 展示（与列表数量风格一致，保留 4 位小数） */
function formatKittingRequiredQty(v: unknown): string {
  if (v == null || v === '') return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return String(v)
  return n.toFixed(4)
}

const QTY_CMP_EPS = 1e-9

function parseRequiredNumber(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** 当前可用数量是否覆盖需求（用于数量/库位列绿/红） */
function isAvailableMeetsRequirement(available: number, required: number | null): boolean | null {
  if (required == null) return null
  return available + QTY_CMP_EPS >= required
}

/** 数量按需精度：去无意义尾零，最多 6 位小数 */
function formatQtyAdaptive(v: unknown): string {
  const n = Number(v ?? 0)
  if (!Number.isFinite(n)) return String(v ?? '')
  return String(Number(n.toFixed(6)))
}

/** 叫料列表「已/需」：已送达/需求，单行不换行 */
function formatCallDeliveredRequested(delivered: unknown, requested: unknown): string {
  return `${formatQtyAdaptive(delivered)}/${formatQtyAdaptive(requested)}`
}

function isDeliveredMeetsRequested(delivered: unknown, requested: unknown): boolean {
  const d = Number(delivered ?? 0)
  const q = Number(requested ?? 0)
  if (!Number.isFinite(d) || !Number.isFinite(q)) return false
  return d + QTY_CMP_EPS >= q
}

/** 未处理：待处理且尚无送达数量，可调用撤回接口 */
function canWithdrawMaterialCall(r: Record<string, unknown>): boolean {
  const st = String((r.status as string) ?? '').trim()
  if (st !== 'pending') return false
  const d = Number(r.delivered_quantity ?? 0)
  return Number.isFinite(d) && d <= 0
}

const CALL_TABLE_CELL_NOWRAP: React.HTMLAttributes<HTMLTableCellElement> = {
  style: { whiteSpace: 'nowrap' },
}

/** 下拉层挂在 Modal 内容区内，避免默认挂 body 时与页面滚动条锁竞争导致背后列表横向抖动 */
function getPopupContainerInModal(trigger: HTMLElement): HTMLElement {
  const el = trigger.closest('.ant-modal-content') ?? trigger.closest('.ant-modal-wrap')
  return (el as HTMLElement) ?? document.body
}

/** Modal 内 Select 下拉选项左对齐（避免弹层继承居中导致选项文字居中） */
const materialCallSelectPopupStyles: NonNullable<SelectProps['styles']> = {
  popup: {
    list: { textAlign: 'left' },
    listItem: { justifyContent: 'flex-start', textAlign: 'left' },
  },
}

export type WorkOrderReadinessPopoverProps = {
  workOrderId: number
  /** 列表行工单编号，用于叫料创建；未传时尝试用齐套分析返回的 work_order_code */
  workOrderCode?: string
  children: React.ReactNode
}

/** 发起叫料：独立 Modal，与主面板同级挂载 */
const WorkOrderMaterialCallModal: React.FC<{
  open: boolean
  onClose: () => void
  workOrderId: number
  workOrderCode?: string
}> = ({ open, onClose, workOrderId, workOrderCode: workOrderCodeProp }) => {
  const { message: messageApi } = App.useApp()
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  const { data: kittingData } = useQuery({
    queryKey: ['workOrderKittingAnalysis', workOrderId],
    queryFn: () => workOrderApi.getKittingAnalysis(String(workOrderId)),
    staleTime: 30_000,
    enabled: open,
  })

  const { data: callTypeDictOptions } = useQuery({
    queryKey: ['dictionaryItems', 'MATERIAL_CALL_TYPE'],
    queryFn: async () => {
      const dict = await getDataDictionaryByCode('MATERIAL_CALL_TYPE')
      const items = await getDictionaryItemList(dict.uuid, true)
      return items
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((i) => ({ label: i.label, value: i.value }))
    },
    staleTime: 60_000,
    retry: false,
    enabled: open,
  })

  const callTypeOptions = useMemo(
    () => (callTypeDictOptions?.length ? callTypeDictOptions : FALLBACK_CALL_TYPE_OPTIONS),
    [callTypeDictOptions]
  )

  const { data: callReasonDictOptions } = useQuery({
    queryKey: ['dictionaryItems', 'MATERIAL_CALL_REASON'],
    queryFn: async () => {
      try {
        const dict = await getDataDictionaryByCode('MATERIAL_CALL_REASON')
        const items = await getDictionaryItemList(dict.uuid, true)
        return items
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((i) => ({ label: i.label, value: i.value }))
      } catch {
        return FALLBACK_CALL_REASON_OPTIONS
      }
    },
    staleTime: 60_000,
    retry: false,
    enabled: open,
  })

  const callReasonOptions = useMemo(
    () => (callReasonDictOptions?.length ? callReasonDictOptions : FALLBACK_CALL_REASON_OPTIONS),
    [callReasonDictOptions]
  )

  const callTypeWatch = Form.useWatch('call_type', form)
  const callType = callTypeWatch ?? 'CUSTOM_SELECTION'

  const kittingWoCode = String((kittingData as { work_order_code?: string } | undefined)?.work_order_code ?? '')

  useEffect(() => {
    if (!open) return
    form.resetFields()
    form.setFieldsValue({ call_type: 'CUSTOM_SELECTION', items: [{}] })
  }, [open, form])

  const closeModal = useCallback(() => {
    onClose()
    form.resetFields()
  }, [form, onClose])

  const resolveWorkOrderCode = async (): Promise<string> => {
    const fromProp = (workOrderCodeProp ?? '').trim()
    if (fromProp) return fromProp
    if (kittingWoCode) return kittingWoCode
    try {
      const wo: any = await workOrderApi.get(String(workOrderId))
      return String(wo?.code ?? wo?.work_order_code ?? '')
    } catch {
      return ''
    }
  }

  const handleSubmitCall = async () => {
    const ct = (form.getFieldValue('call_type') as string) || 'CUSTOM_SELECTION'
    if (ct === 'FULL_ORDER') {
      await form.validateFields(['call_type'])
      setSubmitting(true)
      try {
        const res = (await warehouseApi.materialCall.batchFromWorkOrder({
          work_order_id: workOrderId,
        })) as { code?: string }
        messageApi.success(
          res?.code ? `整单叫料已生成：${res.code}（含多行明细）` : '整单叫料已生成（一张叫料单）'
        )
        queryClient.invalidateQueries({ queryKey: ['materialCallsByWorkOrder', workOrderId] })
        queryClient.invalidateQueries({ queryKey: ['workOrderKittingAnalysis', workOrderId] })
        closeModal()
      } catch (e: any) {
        messageApi.error(e?.message ?? '整单叫料失败')
      } finally {
        setSubmitting(false)
      }
      return
    }

    const values = await form.validateFields()
    const woCode = await resolveWorkOrderCode()
    if (!woCode) {
      messageApi.error('无法获取工单编号，请稍后重试')
      return
    }
    const rawItems = (values.items ?? []) as Array<Record<string, unknown>>
    const items = rawItems
      .filter((it) => it?.material_id != null && it?.requested_quantity != null)
      .map((it) => ({
        material_id: Number(it.material_id),
        material_code: String(it.material_code ?? ''),
        material_name: String(it.material_name ?? ''),
        material_unit: it.material_unit != null ? String(it.material_unit) : undefined,
        requested_quantity: Number(it.requested_quantity),
      }))
    if (!items.length) {
      messageApi.error('请至少添加一行物料并填写数量')
      return
    }
    setSubmitting(true)
    try {
      await warehouseApi.materialCall.create({
        work_order_id: workOrderId,
        work_order_code: woCode,
        call_type: 'CUSTOM_SELECTION',
        call_reason: String(values.call_reason ?? ''),
        priority: 'normal',
        remarks: '生产现场通过工单列表齐套率发起叫料',
        items,
      })
      messageApi.success('叫料申请已提交')
      queryClient.invalidateQueries({ queryKey: ['materialCallsByWorkOrder', workOrderId] })
      closeModal()
    } catch (e: any) {
      messageApi.error(e?.message ?? '发起叫料失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title="发起叫料申请"
      open={open}
      onCancel={closeModal}
      okText="提交申请"
      confirmLoading={submitting}
      onOk={() => handleSubmitCall()}
      destroyOnHidden
      width={480}
      getContainer={() => document.body}
      /** 高于 Popover 浮层，避免被遮挡导致无法点击关闭 */
      zIndex={1200}
      styles={{ body: { paddingBottom: 12 } }}
      maskClosable={false}
      centered
    >
      <Form form={form} layout="vertical" preserve={false} initialValues={{ call_type: 'CUSTOM_SELECTION', items: [{}] }}>
        <Form.Item name="call_type" label="叫料类型" rules={[{ required: true, message: '请选择叫料类型' }]}>
          <Select
            options={callTypeOptions}
            placeholder="请选择"
            getPopupContainer={getPopupContainerInModal}
            styles={materialCallSelectPopupStyles}
            onChange={(v) => {
              if (v === 'FULL_ORDER') {
                form.setFieldsValue({
                  call_reason: undefined,
                  items: [{}],
                })
              }
            }}
          />
        </Form.Item>
        {callType === 'FULL_ORDER' ? (
          <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
            将按工单齐套分析，对缺料数量大于 0 的物料生成<strong>一张</strong>叫料单，每行一种缺料物料（整单叫料）。
          </Typography.Paragraph>
        ) : (
          <>
            <Form.Item
              name="call_reason"
              label="叫料原因"
              rules={[{ required: true, message: '请选择叫料原因' }]}
              style={{ marginBottom: 16 }}
            >
              <Select
                options={callReasonOptions}
                placeholder="请选择叫料原因"
                getPopupContainer={getPopupContainerInModal}
                styles={materialCallSelectPopupStyles}
                allowClear={false}
              />
            </Form.Item>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
              可添加多行，自选物料与数量。
            </Typography.Text>
            <Form.List
              name="items"
              rules={[
                {
                  validator: async (_, rows) => {
                    const arr = (rows ?? []) as unknown[]
                    if (!arr.length) {
                      throw new Error('至少保留一行物料')
                    }
                  },
                },
              ]}
            >
              {(fields, { add, remove }) => (
                <Space orientation="vertical" size={10} style={{ width: '100%' }}>
                  {fields.map((field, index) => (
                    <Space key={field.key} align="start" wrap style={{ width: '100%' }}>
                      <UniMaterialSelect
                        name={[field.name, 'material_id']}
                        label={index === 0 ? '物料' : ' '}
                        required
                        showQuickCreate={false}
                        fillMapping={{
                          material_code: 'mainCode',
                          material_name: 'name',
                          material_unit: 'baseUnit',
                        }}
                        formItemProps={{
                          style: { marginBottom: 0, minWidth: 220 },
                          ...(index > 0 ? { label: ' ', colon: false } : {}),
                        }}
                      />
                      <Form.Item name={[field.name, 'material_code']} hidden>
                        <Input />
                      </Form.Item>
                      <Form.Item name={[field.name, 'material_name']} hidden>
                        <Input />
                      </Form.Item>
                      <Form.Item name={[field.name, 'material_unit']} hidden>
                        <Input />
                      </Form.Item>
                      <Form.Item
                        name={[field.name, 'requested_quantity']}
                        label={index === 0 ? '数量' : ' '}
                        colon={index > 0 ? false : undefined}
                        rules={[{ required: true, message: '必填' }]}
                        style={{ marginBottom: 0 }}
                      >
                        <InputNumber min={0.0001} style={{ width: 128 }} placeholder="数量" />
                      </Form.Item>
                      {fields.length > 1 ? (
                        <Button
                          type="text"
                          danger
                          icon={<MinusCircleOutlined />}
                          onClick={() => remove(field.name)}
                          style={{ marginTop: index === 0 ? 30 : 4 }}
                        />
                      ) : null}
                    </Space>
                  ))}
                  <Button type="dashed" onClick={() => add({})} block icon={<PlusOutlined />}>
                    添加物料
                  </Button>
                </Space>
              )}
            </Form.List>
          </>
        )}
      </Form>
    </Modal>
  )
}

const WorkOrderReadinessPopoverContent: React.FC<{
  workOrderId: number
  setCallModalOpen: (v: boolean) => void
}> = ({ workOrderId, setCallModalOpen }) => {
  const { message: messageApi } = App.useApp()
  const queryClient = useQueryClient()
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts()
  const {
    data: kittingData,
    isLoading: kittingLoading,
    isError: kittingError,
    error,
  } = useQuery({
    queryKey: ['workOrderKittingAnalysis', workOrderId],
    queryFn: () => workOrderApi.getKittingAnalysis(String(workOrderId)),
    staleTime: 30_000,
  })

  const { data: calls, isLoading: callsLoading } = useQuery({
    queryKey: ['materialCallsByWorkOrder', workOrderId],
    queryFn: () =>
      warehouseApi.materialCall.list({
        work_order_id: workOrderId,
        limit: 50,
        skip: 0,
      }),
    staleTime: 30_000,
  })

  const loading = kittingLoading || callsLoading

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', minWidth: 480 }}>
        <Spin size="small" />
      </div>
    )
  }

  const items = (kittingData as { items?: unknown[] } | undefined)?.items ?? []

  type WhRow = {
    key: string
    material: string
    requiredQty: string
    warehouse: string
    qty: string
    /** 数量相对需求：够=绿，不够=红，无法比较=默认色 */
    qtyVsRequired: 'ok' | 'short' | 'neutral'
  }
  const warehouseRows: WhRow[] = []
  if (!kittingError) {
    for (const raw of items) {
      const it = raw as Record<string, unknown>
      const materialId = it.material_id
      const code = String(it.material_code ?? '')
      const name = String(it.material_name ?? '')
      const materialLabel = [code, name].filter(Boolean).join(' ')
      const locs = (it.locations as Record<string, unknown>[] | undefined) ?? []
      const requiredQty = formatKittingRequiredQty(it.required_quantity ?? it.requiredQuantity)
      const requiredNum = parseRequiredNumber(it.required_quantity ?? it.requiredQuantity)
      if (locs.length === 0) {
        const main = it.main_warehouse_available ?? it.mainWarehouseAvailable ?? 0
        const line = it.line_side_available ?? it.lineSideAvailable ?? 0
        const mainN = Number(main)
        const lineN = Number(line)
        const totalAvail =
          (Number.isFinite(mainN) ? mainN : 0) + (Number.isFinite(lineN) ? lineN : 0)
        const cmp = isAvailableMeetsRequirement(totalAvail, requiredNum)
        warehouseRows.push({
          key: `${materialId}-summary`,
          material: materialLabel || '—',
          requiredQty,
          warehouse: '主仓 / 线边',
          qty: `主仓 ${main} / 线边 ${line}`,
          qtyVsRequired: cmp === null ? 'neutral' : cmp ? 'ok' : 'short',
        })
      } else {
        for (const loc of locs) {
          const wh = String(loc.warehouse_name ?? loc.warehouseName ?? '—')
          const qty = loc.quantity ?? 0
          const slot = loc.storage_location_code ?? loc.storageLocationCode
          const qn = Number(qty)
          const locAvail = Number.isFinite(qn) ? qn : 0
          const cmp = isAvailableMeetsRequirement(locAvail, requiredNum)
          warehouseRows.push({
            key: `${materialId}-${wh}-${String(slot ?? '')}`,
            material: materialLabel || '—',
            requiredQty,
            warehouse: wh,
            qty: slot ? `${qty}（${slot}）` : String(qty),
            qtyVsRequired: cmp === null ? 'neutral' : cmp ? 'ok' : 'short',
          })
        }
      }
    }
  }

  const callList = Array.isArray(calls) ? calls : []

  const tabItems = [
    {
      key: 'warehouse',
      label: '物料所在仓库',
      children: (
        <>
          {kittingError ? (
            <Typography.Text type="danger" style={{ display: 'block' }}>
              {(error as Error)?.message ?? '齐套分析加载失败'}
            </Typography.Text>
          ) : warehouseRows.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无库位分布" style={{ margin: '8px 0' }} />
          ) : (
            <Table<WhRow>
              size="small"
              pagination={false}
              rowKey="key"
              dataSource={warehouseRows}
              columns={[
                { title: '物料', dataIndex: 'material', key: 'material', ellipsis: true, width: 220 },
                { title: '需求数量', dataIndex: 'requiredQty', key: 'requiredQty', ellipsis: true, width: 112 },
                { title: '仓库', dataIndex: 'warehouse', key: 'warehouse', ellipsis: true, width: 100 },
                {
                  title: '数量/库位',
                  dataIndex: 'qty',
                  key: 'qty',
                  ellipsis: true,
                  width: 108,
                  render: (text: string, row: WhRow) =>
                    row.qtyVsRequired === 'neutral' ? (
                      text
                    ) : (
                      <Typography.Text type={row.qtyVsRequired === 'ok' ? 'success' : 'danger'}>
                        {text}
                      </Typography.Text>
                    ),
                },
              ]}
            />
          )}
        </>
      ),
    },
    {
      key: 'calls',
      label: '叫料申请',
      children: (
        <Space orientation="vertical" size={8} style={{ width: '100%' }}>
          <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
            由生产现场向仓库发起；仓库部门在<strong>配料中心</strong>主动备货、配送。配料中心及可用仓库范围以<strong>仓储关联</strong>中的配置为准。
          </Typography.Paragraph>
          <Button type="primary" size="small" onClick={() => setCallModalOpen(true)}>
            发起叫料申请
          </Button>
          {callList.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本工单暂无叫料申请" style={{ margin: '8px 0' }} />
          ) : (
            <Table
              size="small"
              pagination={false}
              rowKey={(r) => String((r as { id?: number }).id)}
              dataSource={callList}
              tableLayout="fixed"
              expandable={{
                rowExpandable: (r) => {
                  const items = (r as { items?: unknown[] }).items
                  return Array.isArray(items) && items.length > 0
                },
                expandedRowRender: (r) => {
                  const items = ((r as { items?: Record<string, unknown>[] }).items ?? []) as Record<
                    string,
                    unknown
                  >[]
                  return (
                    <Table<Record<string, unknown>>
                      size="small"
                      pagination={false}
                      rowKey={(it) => String(it.id ?? `${it.material_id}-${it.line_no}`)}
                      dataSource={items}
                      columns={[
                        {
                          title: '行',
                          key: 'line_no',
                          width: 48,
                          render: (_: unknown, it) => String(it.line_no ?? '—'),
                        },
                        {
                          title: '物料',
                          key: 'mn',
                          ellipsis: true,
                          render: (_: unknown, it) =>
                            `${String(it.material_code ?? '')} ${String(it.material_name ?? '')}`.trim() || '—',
                        },
                        {
                          title: '已/需',
                          key: 'dq',
                          width: 120,
                          align: 'right',
                          render: (_: unknown, it) =>
                            formatCallDeliveredRequested(it.delivered_quantity, it.requested_quantity),
                        },
                      ]}
                    />
                  )
                },
              }}
              columns={[
                {
                  title: '单号',
                  dataIndex: 'code',
                  key: 'code',
                  width: '20%',
                  ellipsis: true,
                },
                {
                  title: '类型',
                  key: 'call_type',
                  width: '12%',
                  ellipsis: false,
                  onCell: () => CALL_TABLE_CELL_NOWRAP,
                  render: (_: unknown, r: Record<string, unknown>) => formatMaterialCallTypeZh(r.call_type),
                },
                {
                  title: '物料',
                  key: 'material',
                  width: '34%',
                  ellipsis: true,
                  render: (_: unknown, r: Record<string, unknown>) => String(r.material_name ?? ''),
                },
                {
                  title: '已/需',
                  key: 'qty',
                  width: '14%',
                  align: 'right',
                  ellipsis: false,
                  onCell: () => CALL_TABLE_CELL_NOWRAP,
                  render: (_: unknown, r: Record<string, unknown>) => {
                    const text = formatCallDeliveredRequested(r.delivered_quantity, r.requested_quantity)
                    const ok = isDeliveredMeetsRequested(r.delivered_quantity, r.requested_quantity)
                    return (
                      <Typography.Text type={ok ? 'success' : 'danger'} style={{ whiteSpace: 'nowrap' }}>
                        {text}
                      </Typography.Text>
                    )
                  },
                },
                {
                  title: '状态',
                  key: 'status',
                  width: '16%',
                  ellipsis: false,
                  onCell: () => CALL_TABLE_CELL_NOWRAP,
                  render: (_: unknown, r: Record<string, unknown>) =>
                    getMaterialCallLifecycle(r).stageName ?? String(r.status ?? ''),
                },
                {
                  title: '操作',
                  key: 'actions',
                  width: 72,
                  align: 'center',
                  render: (_: unknown, r: Record<string, unknown>) => {
                    const id = r.id as number | undefined
                    if (id == null || !canWithdrawMaterialCall(r)) return null
                    return (
                      <Button
                        type="link"
                        size="small"
                        danger
                        onClick={(e) => {
                          stopRowToggle(e)
                          Modal.confirm({
                            title: '确认撤回叫料',
                            content: '确定撤回该叫料申请吗？仅仓库未开始处理时可撤回。',
                            okText: '撤回',
                            okButtonProps: { danger: true },
                            cancelText: '取消',
                            onOk: async () => {
                              try {
                                await warehouseApi.materialCall.cancel(id)
                                messageApi.success('已撤回叫料申请')
                                await queryClient.invalidateQueries({
                                  queryKey: ['materialCallsByWorkOrder', workOrderId],
                                })
                                invalidateMenuBadgeCounts()
                              } catch (err: unknown) {
                                const msg =
                                  (err as { response?: { data?: { detail?: string } }; message?: string })?.response
                                    ?.data?.detail ??
                                  (err as Error)?.message ??
                                  '撤回失败'
                                messageApi.error(String(msg))
                                throw err
                              }
                            },
                          })
                        }}
                      >
                        撤回
                      </Button>
                    )
                  },
                },
              ]}
            />
          )}
        </Space>
      ),
    },
  ]

  return <Tabs size="small" items={tabItems} />
}

export const WorkOrderReadinessPopover: React.FC<WorkOrderReadinessPopoverProps> = ({
  workOrderId,
  workOrderCode,
  children,
}) => {
  const [mainModalOpen, setMainModalOpen] = useState(false)
  const [callModalOpen, setCallModalOpen] = useState(false)

  const handleCloseCallModal = useCallback(() => {
    setCallModalOpen(false)
  }, [])

  return (
    <>
      <span
        role="button"
        tabIndex={0}
        style={{ display: 'inline-block', width: '100%', cursor: 'pointer' }}
        onClick={(e) => {
          stopRowToggle(e)
          setMainModalOpen(true)
        }}
        onMouseDown={stopRowToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            e.stopPropagation()
            setMainModalOpen(true)
          }
        }}
      >
        {children}
      </span>
      <Modal
        title="库位与叫料"
        open={mainModalOpen}
        onCancel={() => {
          setMainModalOpen(false)
          setCallModalOpen(false)
        }}
        footer={null}
        width={760}
        destroyOnHidden
        zIndex={1100}
        styles={{ body: { ...READINESS_MAIN_MODAL_BODY_STYLE } }}
        getContainer={() => document.body}
      >
        {mainModalOpen ? (
          <WorkOrderReadinessPopoverContent workOrderId={workOrderId} setCallModalOpen={setCallModalOpen} />
        ) : null}
      </Modal>
      {callModalOpen && (
        <WorkOrderMaterialCallModal
          open
          onClose={handleCloseCallModal}
          workOrderId={workOrderId}
          workOrderCode={workOrderCode}
        />
      )}
    </>
  )
}

export default WorkOrderReadinessPopover
