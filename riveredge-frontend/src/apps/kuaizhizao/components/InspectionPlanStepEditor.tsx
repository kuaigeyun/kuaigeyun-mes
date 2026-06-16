/**
 * 质检方案检验步骤编辑器
 * 支持拖拽排序、添加、删除步骤
 */

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Table, Empty, Modal, Form, Input, Select, message, theme } from 'antd';
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

export const InspectionPlanStepEditor: React.FC<InspectionPlanStepEditorProps> = ({
  value = [],
  onChange,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const [steps, setSteps] = useState<InspectionPlanStepItem[]>(value);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addForm] = Form.useForm();

  const samplingTypeOptions = useMemo(
    () => [
      { label: t('app.kuaizhizao.quality.plans.step.fullInspection'), value: 'full' },
      { label: t('app.kuaizhizao.quality.plans.step.sampling'), value: 'sampling' },
    ],
    [t],
  );

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
      message.success(t('app.kuaizhizao.quality.plans.stepEditor.addSuccess'));
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
                <HolderOutlined style={{ marginRight: 8, color: token.colorPrimary }} />
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
    { title: t('app.kuaizhizao.quality.plans.step.sequence'), key: 'index', width: 80 },
    { title: t('app.kuaizhizao.quality.plans.step.inspectionItem'), dataIndex: 'inspection_item', key: 'inspection_item', ellipsis: true },
    { title: t('app.kuaizhizao.quality.plans.step.inspectionMethod'), dataIndex: 'inspection_method', key: 'inspection_method', width: 120, ellipsis: true },
    { title: t('app.kuaizhizao.quality.plans.step.acceptanceCriteria'), dataIndex: 'acceptance_criteria', key: 'acceptance_criteria', width: 150, ellipsis: true },
    {
      title: t('app.kuaizhizao.quality.plans.step.samplingType'),
      dataIndex: 'sampling_type',
      key: 'sampling_type',
      width: 90,
      render: (v: string) =>
        v === 'sampling'
          ? t('app.kuaizhizao.quality.plans.step.sampling')
          : t('app.kuaizhizao.quality.plans.step.fullInspection'),
    },
    ...(disabled
      ? []
      : [
          {
            title: t('common.actions'),
            key: 'action',
            width: 80,
            render: (_: any, __: InspectionPlanStepItem, index: number) => (
              <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => handleRemove(index)}>
                {t('common.delete')}
              </Button>
            ),
          },
        ]),
  ];

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ color: token.colorTextSecondary, fontSize: 12 }}>
          {t('app.kuaizhizao.quality.plans.stepEditor.dragHint')}
        </span>
        {!disabled && (
          <Button type="dashed" icon={<PlusOutlined />} onClick={() => setAddModalVisible(true)} size="small">
            {t('app.kuaizhizao.quality.plans.stepEditor.addStep')}
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
            background: token.colorFillAlter,
            borderRadius: token.borderRadius,
            border: '1px dashed var(--river-border-color)',
            textAlign: 'center',
            color: token.colorTextSecondary,
          }}
        >
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t('app.kuaizhizao.quality.plans.stepEditor.emptyHint')}
          />
          {!disabled && (
            <Button type="primary" ghost icon={<PlusOutlined />} onClick={() => setAddModalVisible(true)} style={{ marginTop: 12 }}>
              {t('app.kuaizhizao.quality.plans.stepEditor.addStep')}
            </Button>
          )}
        </div>
      )}
      <Modal
        title={t('app.kuaizhizao.quality.plans.stepEditor.modalTitle')}
        open={addModalVisible}
        onOk={handleAdd}
        onCancel={() => {
          addForm.resetFields();
          setAddModalVisible(false);
        }}
        destroyOnHidden
        width={500}
      >
        <Form form={addForm} layout="vertical" initialValues={{ sampling_type: 'full' }}>
          <Form.Item
            name="inspection_item"
            label={t('app.kuaizhizao.quality.plans.step.inspectionItem')}
            rules={[{ required: true, message: t('app.kuaizhizao.quality.plans.stepEditor.validation.requiredInspectionItem') }]}
          >
            <Input placeholder={t('app.kuaizhizao.quality.plans.stepEditor.placeholder.inspectionItem')} />
          </Form.Item>
          <Form.Item name="inspection_method" label={t('app.kuaizhizao.quality.plans.step.inspectionMethod')}>
            <Input placeholder={t('app.kuaizhizao.quality.plans.stepEditor.placeholder.inspectionMethod')} />
          </Form.Item>
          <Form.Item name="acceptance_criteria" label={t('app.kuaizhizao.quality.plans.step.acceptanceCriteria')}>
            <Input.TextArea rows={2} placeholder={t('app.kuaizhizao.quality.plans.stepEditor.placeholder.acceptanceCriteria')} />
          </Form.Item>
          <Form.Item name="sampling_type" label={t('app.kuaizhizao.quality.plans.step.samplingType')}>
            <Select options={samplingTypeOptions} placeholder={t('app.kuaizhizao.quality.plans.stepEditor.placeholder.selectSamplingType')} />
          </Form.Item>
          <Form.Item name="remarks" label={t('app.kuaizhizao.quality.common.form.remarks')}>
            <Input placeholder={t('app.kuaizhizao.quality.plans.stepEditor.placeholder.remarksOptional')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
