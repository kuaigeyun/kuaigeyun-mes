/**
 * 工单开单批号/序列号表单项
 * 投产方式决定开普通工单（批号）或按件拆分子工单（序列号 / 批号+序列号）。
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { App, Button, Card, Col, Form, Input, Select, Typography } from 'antd'
import { ThunderboltOutlined } from '@ant-design/icons'
import { ProFormDependency, ProFormSwitch } from '@ant-design/pro-components'
import { ThemedSegmented } from '../../../../../../components/themed-segmented'
import { batchRuleApi, serialRuleApi } from '../../../../../master-data/services/batchSerialRules'
import { materialApi, materialBatchApi, materialSerialApi } from '../../../../../master-data/services/material'

export type WorkOrderTrackingMaterialInfo = {
  batchManaged?: boolean
  serialManaged?: boolean
  defaultBatchRuleId?: number | null
  defaultSerialRuleId?: number | null
}

type RuleOption = { id: number; name: string; code: string }

type ProductOption = {
  id?: number
  uuid?: string
}

type Props = {
  formRef: React.RefObject<any>
  productId?: number
  productList?: ProductOption[]
  disabled?: boolean
}

type TrackingAssignMode = 'batch' | 'serial' | 'both'

const TRACKING_FIELD_NAMES = [
  'enable_production_tracking',
  'tracking_assign_mode',
  'batch_rule_id',
  'serial_rule_id',
  'planned_batch_no',
  'planned_serial_nos',
] as const

export function trackingInfoFromMaterialDetail(materialDetail: Record<string, unknown>): WorkOrderTrackingMaterialInfo {
  return {
    batchManaged: Boolean(
      materialDetail.batchManaged ?? (materialDetail as { batch_managed?: boolean }).batch_managed
    ),
    serialManaged: Boolean(
      materialDetail.serialManaged ?? (materialDetail as { serial_managed?: boolean }).serial_managed
    ),
    defaultBatchRuleId:
      (materialDetail.defaultBatchRuleId as number | null | undefined) ??
      (materialDetail as { default_batch_rule_id?: number | null }).default_batch_rule_id ??
      null,
    defaultSerialRuleId:
      (materialDetail.defaultSerialRuleId as number | null | undefined) ??
      (materialDetail as { default_serial_rule_id?: number | null }).default_serial_rule_id ??
      null,
  }
}

function resolveTrackingMode(info: WorkOrderTrackingMaterialInfo | null): string {
  if (!info) return 'none'
  const batch = !!info.batchManaged
  const serial = !!info.serialManaged
  if (batch && serial) return 'both'
  if (serial) return 'serial'
  if (batch) return 'batch'
  return 'none'
}

function defaultTrackingAssignMode(mode: string): TrackingAssignMode {
  if (mode === 'serial') return 'serial'
  if (mode === 'both') return 'batch'
  return 'batch'
}

function trackingAssignModeOptions(
  mode: string,
  t: (key: string) => string
): { label: string; value: TrackingAssignMode }[] {
  if (mode === 'both') {
    return [
      { label: t('app.kuaizhizao.workOrder.formTrackingBatch'), value: 'batch' },
      { label: t('app.kuaizhizao.workOrder.formTrackingSerial'), value: 'serial' },
      { label: t('app.kuaizhizao.workOrder.formTrackingBoth'), value: 'both' },
    ]
  }
  if (mode === 'serial') {
    return [{ label: t('app.kuaizhizao.workOrder.formTrackingSerial'), value: 'serial' }]
  }
  return [{ label: t('app.kuaizhizao.workOrder.formTrackingBatch'), value: 'batch' }]
}

function assignModeHint(mode: TrackingAssignMode, t: (key: string) => string): string {
  if (mode === 'batch') return t('app.kuaizhizao.workOrder.formTrackingBatchHint')
  if (mode === 'serial') return t('app.kuaizhizao.workOrder.formTrackingSerialHint')
  return t('app.kuaizhizao.workOrder.formTrackingBothHint')
}

function trackingPromptLabel(mode: string, t: (key: string) => string): string {
  if (mode === 'batch') return t('app.kuaizhizao.workOrder.formTrackingBatchLabel')
  if (mode === 'serial') return t('app.kuaizhizao.workOrder.formTrackingSerialLabel')
  return t('app.kuaizhizao.workOrder.formTrackingBothLabel')
}

export const WorkOrderTrackingFields: React.FC<Props> = ({
  formRef,
  productId,
  productList = [],
  disabled,
}) => {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [materialInfo, setMaterialInfo] = useState<WorkOrderTrackingMaterialInfo | null>(null)
  const [materialUuid, setMaterialUuid] = useState<string | null>(null)
  const [loadingMaterial, setLoadingMaterial] = useState(false)
  const [enableProductionTracking, setEnableProductionTracking] = useState(false)
  const trackingMode = useMemo(() => resolveTrackingMode(materialInfo), [materialInfo])
  const [batchRules, setBatchRules] = useState<RuleOption[]>([])
  const [serialRules, setSerialRules] = useState<RuleOption[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [trackingAssignMode, setTrackingAssignMode] = useState<TrackingAssignMode>('batch')
  const assignModeOptions = useMemo(() => trackingAssignModeOptions(trackingMode, t), [trackingMode, t])
  const showBatchFields = trackingAssignMode === 'batch' || trackingAssignMode === 'both'
  const showSerialFields = trackingAssignMode === 'serial' || trackingAssignMode === 'both'

  const clearTrackingFields = useCallback(() => {
    formRef.current?.setFieldsValue({
      enable_production_tracking: false,
      tracking_assign_mode: undefined,
      batch_rule_id: undefined,
      serial_rule_id: undefined,
      planned_batch_no: undefined,
      planned_serial_nos: undefined,
    })
  }, [formRef])

  const applyDefaultRules = useCallback(
    (info: WorkOrderTrackingMaterialInfo, mode: TrackingAssignMode) => {
      const patch: Record<string, unknown> = {}
      if (mode === 'batch' || mode === 'both') {
        patch.batch_rule_id = info.defaultBatchRuleId ?? undefined
      }
      if (mode === 'serial' || mode === 'both') {
        patch.serial_rule_id = info.defaultSerialRuleId ?? undefined
      }
      formRef.current?.setFieldsValue(patch)
    },
    [formRef]
  )

  const syncAssignMode = useCallback(
    (mode: TrackingAssignMode) => {
      setTrackingAssignMode(mode)
      formRef.current?.setFieldValue('tracking_assign_mode', mode)
      if (mode === 'batch') {
        formRef.current?.setFieldsValue({
          planned_serial_nos: undefined,
          serial_rule_id: undefined,
        })
        if (materialInfo) {
          formRef.current?.setFieldValue('batch_rule_id', materialInfo.defaultBatchRuleId ?? undefined)
        }
      } else if (mode === 'serial') {
        formRef.current?.setFieldsValue({
          planned_batch_no: undefined,
          batch_rule_id: undefined,
        })
        if (materialInfo) {
          formRef.current?.setFieldValue('serial_rule_id', materialInfo.defaultSerialRuleId ?? undefined)
        }
      } else if (materialInfo) {
        applyDefaultRules(materialInfo, mode)
      }
    },
    [applyDefaultRules, formRef, materialInfo]
  )

  useEffect(() => {
    setEnableProductionTracking(false)
    clearTrackingFields()
    if (!productId) {
      setMaterialInfo(null)
      setMaterialUuid(null)
      return
    }
    let cancelled = false
    const load = async () => {
      setLoadingMaterial(true)
      try {
        const fromList = productList.find((p) => Number(p.id) === Number(productId))
        const uuid = fromList?.uuid
        if (!uuid) {
          if (!cancelled) {
            setMaterialInfo(null)
            setMaterialUuid(null)
          }
          return
        }
        const detail = (await materialApi.get(uuid)) as Record<string, unknown>
        if (cancelled) return
        const info = trackingInfoFromMaterialDetail(detail)
        setMaterialInfo(info)
        setMaterialUuid(uuid)
      } catch {
        if (!cancelled) {
          setMaterialInfo(null)
          setMaterialUuid(null)
        }
      } finally {
        if (!cancelled) setLoadingMaterial(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [productId, productList, formRef, clearTrackingFields])

  useEffect(() => {
    const nextMode = defaultTrackingAssignMode(trackingMode)
    setTrackingAssignMode(nextMode)
    formRef.current?.setFieldValue('tracking_assign_mode', nextMode)
  }, [trackingMode, productId, formRef])

  useEffect(() => {
    if (!enableProductionTracking || trackingMode === 'none') return
    let cancelled = false
    ;(async () => {
      try {
        const [batchRes, serialRes] = await Promise.all([
          trackingMode === 'batch' || trackingMode === 'both'
            ? batchRuleApi.list({ pageSize: 200, isActive: true })
            : Promise.resolve({ data: [] }),
          trackingMode === 'serial' || trackingMode === 'both'
            ? serialRuleApi.list({ pageSize: 200, isActive: true })
            : Promise.resolve({ data: [] }),
        ])
        if (cancelled) return
        setBatchRules((batchRes?.data || batchRes?.items || []) as RuleOption[])
        setSerialRules((serialRes?.data || serialRes?.items || []) as RuleOption[])
      } catch {
        if (!cancelled) {
          setBatchRules([])
          setSerialRules([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [trackingMode, enableProductionTracking])

  const handleEnableChange = useCallback(
    (checked: boolean) => {
      setEnableProductionTracking(checked)
      if (!checked) {
        formRef.current?.setFieldsValue({
          tracking_assign_mode: undefined,
          batch_rule_id: undefined,
          serial_rule_id: undefined,
          planned_batch_no: undefined,
          planned_serial_nos: undefined,
        })
      } else if (materialInfo) {
        const mode = defaultTrackingAssignMode(trackingMode)
        syncAssignMode(mode)
      }
    },
    [formRef, materialInfo, syncAssignMode, trackingMode]
  )

  const handlePreview = useCallback(async () => {
    if (!materialUuid) return
    const quantityRaw = formRef.current?.getFieldValue('quantity')
    const quantity = Number(quantityRaw)
    const previewQty = Number.isFinite(quantity) && quantity > 0 ? quantity : 1

    if (showSerialFields) {
      if (!Number.isFinite(quantity) || quantity <= 0) {
        message.warning(t('app.kuaizhizao.workOrder.msgPreviewQtyFirst'))
        return
      }
      if (!Number.isInteger(quantity)) {
        message.warning(t('app.kuaizhizao.workOrder.msgSerialQtyMustBeInteger'))
        return
      }
    }

    setPreviewLoading(true)
    try {
      let batchNo: string | undefined
      let serialNos: string[] | undefined

      if (showBatchFields) {
        const batchRuleId = formRef.current?.getFieldValue('batch_rule_id')
        const res = await materialBatchApi.generate(materialUuid, {
          ruleId: batchRuleId ?? materialInfo?.defaultBatchRuleId ?? undefined,
          preview: true,
        })
        batchNo = res.batch_no
        formRef.current?.setFieldValue('planned_batch_no', batchNo)
      }

      if (showSerialFields) {
        const serialRuleId = formRef.current?.getFieldValue('serial_rule_id')
        const res = await materialSerialApi.generate(materialUuid, Math.floor(previewQty), {
          ruleId: serialRuleId ?? materialInfo?.defaultSerialRuleId ?? undefined,
        })
        serialNos = res.serial_nos || []
        formRef.current?.setFieldValue('planned_serial_nos', serialNos)
      }

      if (batchNo && serialNos?.length) {
        message.success(`已预览批号 ${batchNo} 及 ${serialNos.length} 个序列号`)
      } else if (batchNo) {
        message.success(`已预览批号：${batchNo}`)
      } else if (serialNos?.length) {
        message.success(`已预览 ${serialNos.length} 个序列号`)
      } else {
        message.warning(t('app.kuaizhizao.workOrder.msgPreviewNoNumbers'))
      }
    } catch (e: unknown) {
      const err = e as { message?: string; response?: { data?: { detail?: string } } }
      message.error(err?.response?.data?.detail || err?.message || '预览生成失败')
    } finally {
      setPreviewLoading(false)
    }
  }, [formRef, materialUuid, materialInfo, message, showBatchFields, showSerialFields])

  if (!productId || loadingMaterial || trackingMode === 'none') {
    return (
      <>
        {TRACKING_FIELD_NAMES.map((name) => (
          <Form.Item key={name} name={name} hidden>
            <Input />
          </Form.Item>
        ))}
      </>
    )
  }

  return (
    <>
      <ProFormSwitch
        name="enable_production_tracking"
        label={trackingPromptLabel(trackingMode, t)}
        initialValue={false}
        colProps={{ span: 12 }}
        fieldProps={{
          disabled,
          onChange: (checked: boolean) => handleEnableChange(checked),
        }}
      />
      {enableProductionTracking && (
        <Col span={24}>
          <Card size="small" style={{ marginBottom: 24 }}>
            <Form.Item name="tracking_assign_mode" hidden initialValue="batch">
              <Input />
            </Form.Item>
            <Form.Item label="投产方式" style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                <ThemedSegmented
                  className="form-field-segmented"
                  style={{ width: 'fit-content', maxWidth: '100%' }}
                  value={trackingAssignMode}
                  onChange={(v) => syncAssignMode(v as TrackingAssignMode)}
                  options={assignModeOptions}
                />
                {!disabled && (
                  <Button
                    type="primary"
                    ghost
                    icon={<ThunderboltOutlined />}
                    loading={previewLoading}
                    onClick={() => void handlePreview()}
                  >
                    预览生成
                  </Button>
                )}
              </div>
            </Form.Item>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 12 }}>
              {assignModeHint(trackingAssignMode, t)}
            </Typography.Text>

            <ProFormDependency name={['quantity']}>
              {({ quantity }) => (
                <div>
                  {showBatchFields && (
                    <>
                      <Form.Item name="batch_rule_id" label="批号规则" style={{ marginBottom: 16 }}>
                        <Select
                          allowClear
                          disabled={disabled}
                          placeholder="默认使用物料规则"
                          options={batchRules.map((r) => ({ label: `${r.name} (${r.code})`, value: r.id }))}
                        />
                      </Form.Item>
                      <Form.Item name="planned_batch_no" label="投产批号" style={{ marginBottom: 16 }}>
                        <Input disabled={disabled} placeholder="可手工录入或预览生成" />
                      </Form.Item>
                    </>
                  )}
                  {showSerialFields && (
                    <>
                      <Form.Item name="serial_rule_id" label="序列号规则" style={{ marginBottom: 16 }}>
                        <Select
                          allowClear
                          disabled={disabled}
                          placeholder="默认使用物料规则"
                          options={serialRules.map((r) => ({ label: `${r.name} (${r.code})`, value: r.id }))}
                        />
                      </Form.Item>
                      <Form.Item
                        name="planned_serial_nos"
                        label={`投产序列号（${Number(quantity) || 0} 件）`}
                        style={{ marginBottom: 16 }}
                        tooltip="数量须与计划数量一致；留空则下达时按规则生成"
                      >
                        <Select
                          mode="tags"
                          disabled={disabled}
                          placeholder="输入或预览生成，每件一个序列号"
                          tokenSeparators={[',', ' ']}
                        />
                      </Form.Item>
                    </>
                  )}
                </div>
              )}
            </ProFormDependency>
          </Card>
        </Col>
      )}
    </>
  )
}

export default WorkOrderTrackingFields
