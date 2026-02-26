/**
 * 质检方案检验步骤编辑器
 * 支持拖拽排序、添加、删除步骤
 */

import React, { useState } from 'react';
import { Button, Table, Empty, Space, Modal, Form, Input, Select, message } from 'antd';
import { PlusOutlined, HolderOutlined, DeleteOutlined } from '@ant-design/icons';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface InspectionPlanStepItem {
  sequence: number;
  inspection_item: string;
  inspection_method?: string;
  acceptance_criteria?: string;
  sampling_type: 'full' | 'sampling';
  quality_standard_id?: number;
  remarks?: string;
}

export interface InspectionPlanStepEditorProps {
  value?: InspectionPlanStepItem[];
  onChange?: (steps: InspectionPlanStepItem[]) => void;
  disabled?: boolean;
}

const SamplingTypeOptions = [
  { label: '全检', value: 'full' },
  { label: '抽检', value: 'sampling' },
];

export const InspectionPlanStepEditor: React.FC<InspectionPlanStepEditorProps> = ({
  value = [],
  onChange,
  disabled = false,
}) => {
  const [steps, setSteps] = useState<InspectionPlanStepItem[]>(value);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addForm] = Form.useForm();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  React.useEffect(() => {
    setSteps(value);
  }, [value]);

  const syncChange = (newSteps: InspectionPlanStepItem[]) => {
    setSteps(newSteps);
    onChange?.(newSteps);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = steps.findIndex((_, i) => `step-${i}` === active.id);
    const newIdx = steps.findIndex((_, i) => `step-${i}` === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(steps, oldIdx, newIdx).map((s, i) => ({ ...s, sequence: i }));
    syncChange(reordered);
  };

  const handleAdd = () => {
    addForm.validateFields().then((vals) => {
      const newStep: InspectionPlanStepItem = {
        sequence: steps.length,
        inspection_item: vals.inspection_item,
        inspection_method: vals.inspection_method,
        acceptance_criteria: vals.acceptance_criteria,
        sampling_type: vals.sampling_type || 'full',
        remarks: vals.remarks,
      };
      syncChange([...steps, newStep]);
      addForm.resetFields();
      setAddModalVisible(false);
      message.success('已添加检验步骤');
    });
  };

  const handleRemove = (index: number) => {
    const next = steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, sequence: i }));
    syncChange(next);
  };

  const SortableRow = ({ children, ...props }: any) => {
    const index = steps.findIndex((_, i) => `step-${i}` === props['data-row-key']);
    const step = steps[index];
    if (!step || disabled) return <tr {...props}>{children}</tr>;
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: props['data-row-key'],
    });
    const style = {
      ...props.style,
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };
    const childArray = React.Children.toArray(children);
    const firstCell = childArray[0];
    const firstCellWithDrag =
      React.isValidElement(firstCell) && firstCell.type === 'td'
        ? React.cloneElement(firstCell as React.ReactElement<{ children?: React.ReactNode }>, {
            children: (
              <span {...attributes} {...listeners} style={{ cursor: disabled ? 'default' : 'move', display: 'inline-flex', alignItems: 'center' }}>
                <HolderOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                {index + 1}
              </span>
            ),
          })
        : firstCell;
    return (
      <tr ref={setNodeRef} style={style} {...props}>
        {[firstCellWithDrag, ...childArray.slice(1)]}
      </tr>
    );
  };

  const columns = [
    { title: '序号', key: 'index', width: 80 },
    { title: '检验项目', dataIndex: 'inspection_item', key: 'inspection_item', ellipsis: true },
    { title: '检验方法', dataIndex: 'inspection_method', key: 'inspection_method', width: 120, ellipsis: true },
    { title: '合格标准', dataIndex: 'acceptance_criteria', key: 'acceptance_criteria', width: 150, ellipsis: true },
    {
      title: '抽样方式',
      dataIndex: 'sampling_type',
      key: 'sampling_type',
      width: 90,
      render: (v: string) => (v === 'sampling' ? '抽检' : '全检'),
    },
    ...(disabled
      ? []
      : [
          {
            title: '操作',
            key: 'action',
            width: 80,
            render: (_: any, __: InspectionPlanStepItem, index: number) => (
              <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => handleRemove(index)}>
                删除
              </Button>
            ),
          },
        ]),
  ];

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ color: '#666', fontSize: 12 }}>支持拖拽排序，点击删除移除步骤</span>
        {!disabled && (
          <Button type="dashed" icon={<PlusOutlined />} onClick={() => setAddModalVisible(true)} size="small">
            添加步骤
          </Button>
        )}
      </div>
      {steps.length > 0 ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={steps.map((_, i) => `step-${i}`)} strategy={verticalListSortingStrategy}>
            <Table
              columns={columns}
              dataSource={steps}
              rowKey={(_, i) => `step-${i}`}
              pagination={false}
              size="small"
              components={{
                body: {
                  row: (props: any) => <SortableRow {...props} />,
                },
              }}
            />
          </SortableContext>
        </DndContext>
      ) : (
        <div
          style={{
            padding: 24,
            background: '#fafafa',
            borderRadius: 4,
            border: '1px dashed #d9d9d9',
            textAlign: 'center',
            color: '#999',
          }}
        >
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无检验步骤，点击下方按钮添加" />
          {!disabled && (
            <Button type="primary" ghost icon={<PlusOutlined />} onClick={() => setAddModalVisible(true)} style={{ marginTop: 12 }}>
              添加步骤
            </Button>
          )}
        </div>
      )}
      <Modal
        title="添加检验步骤"
        open={addModalVisible}
        onOk={handleAdd}
        onCancel={() => {
          addForm.resetFields();
          setAddModalVisible(false);
        }}
        destroyOnClosed
        width={500}
      >
        <Form form={addForm} layout="vertical" initialValues={{ sampling_type: 'full' }}>
          <Form.Item name="inspection_item" label="检验项目" rules={[{ required: true, message: '请输入检验项目' }]}>
            <Input placeholder="请输入检验项目名称" />
          </Form.Item>
          <Form.Item name="inspection_method" label="检验方法">
            <Input placeholder="请输入检验方法" />
          </Form.Item>
          <Form.Item name="acceptance_criteria" label="合格标准">
            <Input.TextArea rows={2} placeholder="请输入合格标准" />
          </Form.Item>
          <Form.Item name="sampling_type" label="抽样方式">
            <Select options={SamplingTypeOptions} placeholder="请选择" />
          </Form.Item>
          <Form.Item name="remarks" label="备注">
            <Input placeholder="备注（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
