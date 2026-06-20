/**
 * 工单详情 — 工序列表拖拽排序（独立 chunk，首屏不加载 @dnd-kit）
 */
import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { App, Button, Modal, Popconfirm, Space, Tag } from 'antd'
import { HolderOutlined } from '@ant-design/icons'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { workOrderApi } from '../../../../services/production'
import { formatDateTime } from '../../../../../../utils/format'

export interface WorkOrderOperationsListProps {
  workOrderId?: number
  operations: any[]
  workOrderStatus?: string
  onUpdate: () => Promise<void>
  onEdit: (operation: any) => void
}

interface SortableOperationItemProps {
  operation: any
  canEdit: boolean
  isReported: boolean
  onEdit: () => void
  onDelete: () => void
  statusMap: Record<string, { text: string; color: string }>
}

const SortableOperationItem: React.FC<SortableOperationItemProps> = ({
  operation,
  canEdit,
  isReported,
  onEdit,
  onDelete,
  statusMap,
}) => {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: operation.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: isReported ? '#f5f5f5' : '#fff',
    border: '1px solid var(--river-border-color)',
    borderRadius: '4px',
    padding: '12px',
    marginBottom: '8px',
    cursor: canEdit && !isReported ? 'grab' : 'not-allowed',
  }

  const statusConfig = statusMap[operation.status] || { text: operation.status, color: 'default' }

  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {canEdit && (
          <div
            {...attributes}
            {...listeners}
            style={{
              cursor: 'grab',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <HolderOutlined style={{ color: '#999' }} />
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontWeight: 'bold', color: isReported ? '#999' : '#000' }}>
              {operation.sequence}. {operation.operation_name || operation.name}
            </span>
            <Tag color={statusConfig.color}>{statusConfig.text}</Tag>
            {isReported && <Tag color="warning">{t('app.kuaizhizao.workOrder.tagReported')}</Tag>}
          </div>
          <div style={{ fontSize: '12px', color: '#999' }}>
            <Space separator={<span>|</span>}>
              <span>
                {t('app.kuaizhizao.workOrder.colCodeShort')}: {operation.operation_code || operation.code}
              </span>
              {operation.workshop_name && (
                <span>
                  {t('app.kuaizhizao.workOrder.colWorkshop')}: {operation.workshop_name}
                </span>
              )}
              {operation.standard_time > 0 && (
                <span>
                  {t('app.kuaizhizao.workOrder.colStandardTime')}: {operation.standard_time}h
                </span>
              )}
              {operation.planned_start_date && (
                <span>
                  {t('app.kuaizhizao.workOrder.labelPlan')}:{' '}
                  {formatDateTime(operation.planned_start_date, 'YYYY-MM-DD HH:mm')}
                </span>
              )}
            </Space>
          </div>
        </div>
        {canEdit && (
          <Space>
            <Button type="link" size="small" onClick={onEdit}>
              {t('app.kuaizhizao.workOrder.actionEdit')}
            </Button>
            <Popconfirm
              title={t('app.kuaizhizao.workOrder.modalConfirmDeleteOp')}
              description={t('app.kuaizhizao.workOrder.msgOpDeleteConfirm', {
                name: operation.operation_name || operation.name,
              })}
              onConfirm={onDelete}
            >
              <Button type="link" size="small" danger>
                {t('app.kuaizhizao.workOrder.actionDelete')}
              </Button>
            </Popconfirm>
          </Space>
        )}
      </div>
    </div>
  )
}

const WorkOrderOperationsList: React.FC<WorkOrderOperationsListProps> = ({
  workOrderId,
  operations,
  workOrderStatus,
  onUpdate,
  onEdit,
}) => {
  const { t } = useTranslation()
  const { message: messageApi } = App.useApp()
  const [localOperations, setLocalOperations] = useState<any[]>(operations)
  const [, setSaving] = useState(false)

  const statusMap = useMemo(
    () => ({
      pending: { text: t('app.kuaizhizao.workOrder.opStatusPending'), color: 'default' },
      in_progress: { text: t('app.kuaizhizao.workOrder.opStatusInProgress'), color: 'processing' },
      completed: { text: t('app.kuaizhizao.workOrder.opStatusCompleted'), color: 'success' },
      cancelled: { text: t('app.kuaizhizao.workOrder.opStatusCancelled'), color: 'error' },
    }),
    [t]
  )

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    setLocalOperations(operations)
  }, [operations])

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = localOperations.findIndex(op => op.id === active.id)
      const newIndex = localOperations.findIndex(op => op.id === over.id)

      if (oldIndex === -1 || newIndex === -1) return

      const movedOperation = localOperations[oldIndex]
      if (movedOperation.status !== 'pending' && movedOperation.status !== 'in_progress') {
        messageApi.warning(t('app.kuaizhizao.workOrder.msgOpCannotReorderReported'))
        return
      }

      const newOperations = arrayMove(localOperations, oldIndex, newIndex)
      const sortedOperations = newOperations.map((op, index) => ({
        ...op,
        sequence: index + 1,
      }))

      setLocalOperations(sortedOperations)

      if (workOrderId) {
        try {
          setSaving(true)
          await workOrderApi.updateOperations(workOrderId.toString(), {
            operations: sortedOperations,
          })
          messageApi.success(t('app.kuaizhizao.workOrder.msgOpOrderUpdated'))
          await onUpdate()
        } catch (error: any) {
          messageApi.error(error.message || t('common.updateFailed'))
          setLocalOperations(operations)
        } finally {
          setSaving(false)
        }
      }
    }
  }

  const handleDelete = async (operation: any) => {
    if (operation.status !== 'pending' && operation.status !== 'in_progress') {
      messageApi.warning(t('app.kuaizhizao.workOrder.msgOpCannotDeleteReported'))
      return
    }

    Modal.confirm({
      title: t('app.kuaizhizao.workOrder.modalConfirmDeleteOp'),
      content: t('app.kuaizhizao.workOrder.msgOpDeleteConfirm', { name: operation.operation_name }),
      onOk: async () => {
        try {
          if (!workOrderId) return

          const updatedOperations = localOperations
            .filter(op => op.id !== operation.id)
            .map((op, index) => ({
              ...op,
              sequence: index + 1,
            }))

          await workOrderApi.updateOperations(workOrderId.toString(), {
            operations: updatedOperations,
          })

          messageApi.success(t('app.kuaizhizao.workOrder.msgOpDeleteSuccess'))
          await onUpdate()
        } catch (error: any) {
          messageApi.error(error.message || t('common.deleteFailed'))
        }
      },
    })
  }

  const canEdit = workOrderStatus && ['draft', 'released'].includes(workOrderStatus)

  if (localOperations.length === 0) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center', color: '#999' }}>
        {t('app.kuaizhizao.workOrder.msgNoOperations')}
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext
        items={localOperations.map(op => op.id)}
        strategy={verticalListSortingStrategy}
      >
        <div>
          {localOperations.map(operation => {
            const isReported = operation.status !== 'pending' && operation.status !== 'in_progress'
            return (
              <SortableOperationItem
                key={operation.id}
                operation={operation}
                canEdit={!!(canEdit && !isReported)}
                isReported={isReported}
                onEdit={() => onEdit(operation)}
                onDelete={() => handleDelete(operation)}
                statusMap={statusMap}
              />
            )
          })}
        </div>
      </SortableContext>
    </DndContext>
  )
}

export default WorkOrderOperationsList
