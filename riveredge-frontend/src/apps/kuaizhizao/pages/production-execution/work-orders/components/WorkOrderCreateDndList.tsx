/**
 * 创建/编辑工单 — 工艺路线工序拖拽排序（独立 chunk，首屏不加载 @dnd-kit）
 */
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Space, theme } from 'antd'
import { HolderOutlined, DeleteOutlined } from '@ant-design/icons'
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

export interface CreateWorkOrderOperationsListProps {
  selectedOperations: any[]
  setSelectedOperations: React.Dispatch<React.SetStateAction<any[]>>
  operationList: any[]
  formRef: React.RefObject<any>
  disabled?: boolean
}

function operationRowKey(operation: any, index: number): string {
  if (operation?.id != null) return `woo-${operation.id}`
  return `new-${operation?.operation_id ?? 'x'}-${index}`
}

const SortableCreateOperationItem: React.FC<{
  operation: any
  index: number
  sortableId: string
  disabled?: boolean
  onDelete: () => void
}> = ({ operation, index, sortableId, disabled, onDelete }) => {
  const { t } = useTranslation()
  const { token } = theme.useToken()
  const reported = Boolean(operation?.has_reporting)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId,
    disabled: disabled || reported,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    padding: '8px 12px',
    background: token.colorBgContainer,
    border: '1px solid var(--river-border-color)',
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  }

  return (
    <div ref={setNodeRef} style={style}>
      {!disabled && !reported && (
        <div {...attributes} {...listeners} style={{ cursor: 'grab', display: 'flex' }}>
          <HolderOutlined style={{ color: token.colorTextSecondary }} />
        </div>
      )}
      <div style={{ flex: 1 }}>
        <Space>
          <span style={{ fontWeight: 'bold', color: token.colorText }}>
            {index + 1}. {operation.operation_name}
          </span>
          <span style={{ color: token.colorTextSecondary, fontSize: 12 }}>({operation.operation_code})</span>
          {reported && (
            <span style={{ color: token.colorTextSecondary, fontSize: 12 }}>
              {t('app.kuaizhizao.workOrder.msgOpReportedLocked')}
            </span>
          )}
        </Space>
      </div>
      {!disabled && !reported && (
        <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={onDelete} />
      )}
    </div>
  )
}

const CreateWorkOrderOperationsList: React.FC<CreateWorkOrderOperationsListProps> = ({
  selectedOperations,
  setSelectedOperations,
  operationList: _operationList,
  formRef,
  disabled,
}) => {
  const { t } = useTranslation()
  const { token } = theme.useToken()
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const rowKeys = selectedOperations.map((op, idx) => operationRowKey(op, idx))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = rowKeys.findIndex((key) => key === String(active.id))
      const newIndex = rowKeys.findIndex((key) => key === String(over.id))
      if (oldIndex < 0 || newIndex < 0) return
      if (selectedOperations[oldIndex]?.has_reporting || selectedOperations[newIndex]?.has_reporting) {
        return
      }

      const newOps = arrayMove(selectedOperations, oldIndex, newIndex).map((op, idx) => ({
        ...op,
        sequence: idx + 1,
      }))

      setSelectedOperations(newOps)
      formRef.current?.setFieldsValue({
        operations: newOps.map((op: any) => op.operation_id),
      })
    }
  }

  const handleDeleteAt = (index: number) => {
    const target = selectedOperations[index]
    if (!target || target.has_reporting) {
      return
    }
    const newOps = selectedOperations
      .filter((_, idx) => idx !== index)
      .map((op, idx) => ({
        ...op,
        sequence: idx + 1,
      }))
    setSelectedOperations(newOps)
    formRef.current?.setFieldsValue({
      operations: newOps.map((op: any) => op.operation_id),
    })
  }

  if (selectedOperations.length === 0) {
    return (
      <div
        style={{
          padding: '24px',
          textAlign: 'center',
          color: token.colorTextSecondary,
          border: '1px dashed var(--river-border-color)',
          borderRadius: 4,
        }}
      >
        {t('app.kuaizhizao.workOrder.msgAddOpsManually')}
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={rowKeys} strategy={verticalListSortingStrategy}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {selectedOperations.map((op, idx) => (
            <SortableCreateOperationItem
              key={rowKeys[idx]}
              sortableId={rowKeys[idx]}
              operation={op}
              index={idx}
              disabled={disabled}
              onDelete={() => handleDeleteAt(idx)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

export default CreateWorkOrderOperationsList
