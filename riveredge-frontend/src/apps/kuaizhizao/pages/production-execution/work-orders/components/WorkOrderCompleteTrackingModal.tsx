/**
 * 工单完工确认批号/序列号弹窗
 */

import React, { useEffect } from 'react'
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
      title={`指定结束 — ${workOrderCode || ''}`}
      open={open}
      onCancel={onCancel}
      confirmLoading={loading}
      onOk={() => form.submit()}
      destroyOnHidden
    >
      <p style={{ marginBottom: 12, color: 'rgba(0,0,0,0.65)' }}>
        可修改批号/序列号；留空将沿用计划值或在服务端按规则生成。
      </p>
      <Form form={form} layout="vertical" onFinish={onConfirm}>
        {showBatch && (
          <Form.Item name="confirmed_batch_no" label="确认批号">
            <Input placeholder={plannedBatchNo ? `默认：${plannedBatchNo}` : '下达/完工时生成'} />
          </Form.Item>
        )}
        {showSerial && (
          <Form.Item name="confirmed_serial_no" label="确认序列号">
            <Input placeholder={plannedSerialNo ? `默认：${plannedSerialNo}` : '下达/完工时生成'} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}

export default WorkOrderCompleteTrackingModal
