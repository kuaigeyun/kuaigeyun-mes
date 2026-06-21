/**
 * 工单编辑：批号/序列号（计划 + 确认）
 */

import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, Col, Form, Input } from 'antd'
import { materialApi } from '../../../../../master-data/services/material'
import {
  trackingInfoFromMaterialDetail,
  type WorkOrderTrackingMaterialInfo,
} from './WorkOrderTrackingFields'

type ProductOption = {
  id?: number
  uuid?: string
}

type Props = {
  productId?: number
  productList?: ProductOption[]
  workOrderStatus?: string
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

export const WorkOrderTrackingEditFields: React.FC<Props> = ({
  productId,
  productList = [],
  workOrderStatus,
}) => {
  const { t } = useTranslation()
  const [materialInfo, setMaterialInfo] = useState<WorkOrderTrackingMaterialInfo | null>(null)
  const [loadingMaterial, setLoadingMaterial] = useState(false)

  const trackingMode = useMemo(() => resolveTrackingMode(materialInfo), [materialInfo])
  const showBatch = trackingMode === 'batch' || trackingMode === 'both'
  const showSerial = trackingMode === 'serial' || trackingMode === 'both'
  const readOnly = ['completed', 'cancelled', 'split'].includes(String(workOrderStatus || ''))

  useEffect(() => {
    if (!productId) {
      setMaterialInfo(null)
      return
    }
    let cancelled = false
    const load = async () => {
      setLoadingMaterial(true)
      try {
        const fromList = productList.find((p) => Number(p.id) === Number(productId))
        const uuid = fromList?.uuid
        if (!uuid) {
          if (!cancelled) setMaterialInfo(null)
          return
        }
        const detail = (await materialApi.get(uuid)) as Record<string, unknown>
        if (!cancelled) setMaterialInfo(trackingInfoFromMaterialDetail(detail))
      } catch {
        if (!cancelled) setMaterialInfo(null)
      } finally {
        if (!cancelled) setLoadingMaterial(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [productId, productList])

  if (!productId || loadingMaterial || trackingMode === 'none') {
    return null
  }

  return (
    <Col span={24}>
      <Card size="small" title={t('app.kuaizhizao.workOrder.formTrackingEditSection')} style={{ marginBottom: 24 }}>
        {showBatch && (
          <>
            <Form.Item
              name="planned_batch_no"
              label={t('app.kuaizhizao.workOrder.formPlannedBatchNo')}
              style={{ marginBottom: 16 }}
            >
              <Input disabled={readOnly} placeholder={t('app.kuaizhizao.workOrder.formEnter')} />
            </Form.Item>
            <Form.Item
              name="confirmed_batch_no"
              label={t('app.kuaizhizao.workOrder.msgConfirmBatchNo')}
              style={{ marginBottom: showSerial ? 16 : 0 }}
            >
              <Input disabled={readOnly} placeholder={t('app.kuaizhizao.workOrder.formEnter')} />
            </Form.Item>
          </>
        )}
        {showSerial && (
          <>
            <Form.Item
              name="planned_serial_no"
              label={t('app.kuaizhizao.workOrder.formPlannedSerialNo')}
              style={{ marginBottom: 16 }}
            >
              <Input disabled={readOnly} placeholder={t('app.kuaizhizao.workOrder.formEnter')} />
            </Form.Item>
            <Form.Item
              name="confirmed_serial_no"
              label={t('app.kuaizhizao.workOrder.msgConfirmSerialNo')}
              style={{ marginBottom: 0 }}
            >
              <Input disabled={readOnly} placeholder={t('app.kuaizhizao.workOrder.formEnter')} />
            </Form.Item>
          </>
        )}
      </Card>
    </Col>
  )
}

export default WorkOrderTrackingEditFields
