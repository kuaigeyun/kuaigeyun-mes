/**
 * 创建/编辑工单 — 工艺路线工序拖拽排序（独立 chunk，首屏不加载 @dnd-kit）
 */
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Space } from 'antd'
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

const SortableCreateOperationItem: React.FC<{
  operation: any
  index: number
  disabled?: boolean
  onDelete: () => void
}> = ({ operation, index, disabled, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: operation.operation_id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    padding: '8px 12px',
    background: '#fff',
    border: '1px solid var(--river-border-color)',
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  }

  return (
    <div ref={setNodeRef} style={style}>
      {!disabled && (
        <div {...attributes} {...listeners} style={{ cursor: 'grab', display: 'flex' }}>
          <HolderOutlined style={{ color: '#999' }} />
        </div>
      )}
      <div style={{ flex: 1 }}>
        <Space>
          <span style={{ fontWeight: 'bold' }}>
            {index + 1}. {operation.operation_name}
          </span>
          <span style={{ color: '#999', fontSize: 12 }}>({operation.operation_code})</span>
        </Space>
      </div>
      {!disabled && (
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
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = selectedOperations.findIndex(op => op.operation_id === active.id)
      const newIndex = selectedOperations.findIndex(op => op.operation_id === over.id)

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

  const handleDelete = (operationId: number) => {
    const newOps = selectedOperations
      .filter(op => op.operation_id !== operationId)
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
          color: '#999',
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
      <SortableContext
        items={selectedOperations.map(op => op.operation_id)}
        strategy={verticalListSortingStrategy}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {selectedOperations.map((op, idx) => (
            <SortableCreateOperationItem
              key={op.operation_id}
              operation={op}
              index={idx}
              disabled={disabled}
              onDelete={() => handleDelete(op.operation_id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

export default CreateWorkOrderOperationsList
