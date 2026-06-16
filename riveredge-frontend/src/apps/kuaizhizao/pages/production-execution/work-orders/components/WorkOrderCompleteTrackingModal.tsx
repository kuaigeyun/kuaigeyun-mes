/**
 * 工单完工确认批号/序列号弹窗
 */

import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Form, Input, Modal } from 'antd'

export type WorkOrderTrackingConfirmValues = {
  confirmed_batch_no?: string
  confirmed_serial_no?: string
}

type Props = {
  open: boolean
  loading?: boolean
  workOrderCode?: string
  trackingMode?: string
  plannedBatchNo?: string | null
  plannedSerialNo?: string | null
  onCancel: () => void
  onConfirm: (values: WorkOrderTrackingConfirmValues) => void | Promise<void>
}

export const WorkOrderCompleteTrackingModal: React.FC<Props> = ({
  open,
  loading,
  workOrderCode,
  trackingMode = 'none',
  plannedBatchNo,
  plannedSerialNo,
  onCancel,
  onConfirm,
}) => {
  const { t } = useTranslation()
  const [form] = Form.useForm<WorkOrderTrackingConfirmValues>()

  useEffect(() => {
    if (!open) return
    form.setFieldsValue({
      confirmed_batch_no: plannedBatchNo || undefined,
      confirmed_serial_no: plannedSerialNo || undefined,
    })
  }, [open, plannedBatchNo, plannedSerialNo, form])

  const showBatch = trackingMode === 'batch' || trackingMode === 'both'
  const showSerial = trackingMode === 'serial' || trackingMode === 'both'

  return (
    <Modal
      title={`${t('app.kuaizhizao.workOrder.modalCompleteTrackingTitle')} — ${workOrderCode || ''}`}
      open={open}
      onCancel={onCancel}
      confirmLoading={loading}
      onOk={() => form.submit()}
      destroyOnHidden
    >
      <p style={{ marginBottom: 12, color: 'rgba(0,0,0,0.65)' }}>
        {t('app.kuaizhizao.workOrder.msgCompleteTrackingHint')}
      </p>
      <Form form={form} layout="vertical" onFinish={onConfirm}>
        {showBatch && (
          <Form.Item name="confirmed_batch_no" label={t('app.kuaizhizao.workOrder.msgConfirmBatchNo')}>
            <Input
              placeholder={
                plannedBatchNo
                  ? `${t('app.kuaizhizao.workOrder.msgDefaultPrefix')}${plannedBatchNo}`
                  : t('app.kuaizhizao.workOrder.msgGenerateOnRelease')
              }
            />
          </Form.Item>
        )}
        {showSerial && (
          <Form.Item name="confirmed_serial_no" label={t('app.kuaizhizao.workOrder.msgConfirmSerialNo')}>
            <Input
              placeholder={
                plannedSerialNo
                  ? `${t('app.kuaizhizao.workOrder.msgDefaultPrefix')}${plannedSerialNo}`
                  : t('app.kuaizhizao.workOrder.msgGenerateOnRelease')
              }
            />
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}

export default WorkOrderCompleteTrackingModal
