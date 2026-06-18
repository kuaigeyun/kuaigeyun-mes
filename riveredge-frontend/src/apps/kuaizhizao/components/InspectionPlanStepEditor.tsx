/**
 * 质检方案检验步骤编辑器
 * 支持拖拽排序、添加、编辑、删除步骤
 */

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Table, Empty, Modal, Form, Input, Select, message, theme, Space, Tag, Row, Col } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, HolderOutlined } from '@ant-design/icons';
import { SequenceIndexCell, StepDragHandleContext, getSequenceIndexBadgeStyle } from '../../../components/sequence-index-cell';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  DragOverlay,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  applySamplingToValueSpec,
  defaultValueSpec,
  formatAcceptanceCriteriaPreview,
  formatSamplingCriteriaPreview,
  getSamplingSpec,
  normalizeValueType,
  stepSpecIsCritical,
  stepSpecIsDerived,
  type InspectionPlanStepItem,
  type SamplingSpec,
} from '../types/inspectionStepSpec';
import { InspectionStepValueSpecFields, InspectionStepCommonFlagFields, valueTypeOptions } from './InspectionStepValueSpecFields';
import { InspectionSamplingSpecFields } from './InspectionSamplingSpecFields';
import { InspectionSamplingTypeTag, InspectionValueTypeTag } from './inspectionStepTableBadges';

export type { InspectionPlanStepItem } from '../types/inspectionStepSpec';

function stepRowId(step: InspectionPlanStepItem, index: number): string {
  return step.step_key || `step-${index}`;
}

function SortableStepTableRow({
  children,
  disabled = false,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { 'data-row-key'?: string | number; disabled?: boolean }) {
  const { token } = theme.useToken();
  const rowKey = String(props['data-row-key'] ?? '');
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: rowKey,
    disabled: disabled || !rowKey,
  });
  const style: React.CSSProperties = {
    ...props.style,
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? 0.4 : 1,
    backgroundColor: isDragging ? token.colorPrimaryBg : isOver && !isDragging ? token.colorFillSecondary : 'transparent',
    boxShadow: isDragging ? token.boxShadowSecondary : 'none',
    position: 'relative',
  };
  return (
    <StepDragHandleContext.Provider value={{ attributes, listeners, setActivatorNodeRef }}>
      <tr ref={setNodeRef} style={style} {...props}>
        {children}
      </tr>
    </StepDragHandleContext.Provider>
  );
}

const INSERT_LINE_STYLE: React.CSSProperties = {
  height: 2,
  backgroundColor: '#1890ff',
  margin: 0,
  boxShadow: '0 0 4px rgba(24, 144, 255, 0.5)',
};

function InsertLineRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ padding: 0, height: 0, lineHeight: 0 }}>
        <div style={INSERT_LINE_STYLE} />
      </td>
    </tr>
  );
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [stepModalVisible, setStepModalVisible] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [stepForm] = Form.useForm();
  const watchedValueType = Form.useWatch('value_type', stepForm) || 'boolean';
  const watchedSamplingType = Form.useWatch('sampling_type', stepForm) || 'full';
  const watchedValueSpec = Form.useWatch('value_spec', stepForm);

  const formulaRefOptions = useMemo(() => {
    const editingKey = editingIndex !== null ? steps[editingIndex]?.step_key : undefined;
    return steps
      .filter((s) => s.step_key && s.step_key !== editingKey && normalizeValueType(s.value_type) === 'numeric')
      .filter((s) => !stepSpecIsDerived({ ...defaultValueSpec('numeric', t), ...(s.value_spec || {}) }))
      .map((s) => ({
        step_key: s.step_key!,
        label: s.inspection_item || s.step_key!,
      }));
  }, [steps, editingIndex, t]);

  const samplingTypeOptions = useMemo(
    () => [
      { label: t('app.kuaizhizao.quality.plans.step.fullInspection'), value: 'full' },
      { label: t('app.kuaizhizao.quality.plans.step.sampling'), value: 'sampling' },
    ],
    [t],
  );

  const typeLabelMap = useMemo(() => {
    const opts = valueTypeOptions(t);
    return Object.fromEntries(opts.map((o) => [o.value, o.label]));
  }, [t]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  React.useEffect(() => {
    setSteps(value);
  }, [value]);

  const syncChange = (newSteps: InspectionPlanStepItem[]) => {
    setSteps(newSteps);
    onChange?.(newSteps);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over ? (event.over.id as string) : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);
    if (!over || active.id === over.id) return;
    const oldIdx = steps.findIndex((s, i) => stepRowId(s, i) === active.id);
    const newIdx = steps.findIndex((s, i) => stepRowId(s, i) === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(steps, oldIdx, newIdx).map((s, i) => ({ ...s, sequence: i }));
    syncChange(reordered);
  };

  const closeStepModal = () => {
    stepForm.resetFields();
    setEditingIndex(null);
    setStepModalVisible(false);
  };

  const openAddModal = () => {
    setEditingIndex(null);
    stepForm.resetFields();
    stepForm.setFieldsValue({
      value_type: 'boolean',
      value_spec: defaultValueSpec('boolean', t),
      sampling_type: 'full',
    });
    setStepModalVisible(true);
  };

  const openEditModal = (index: number) => {
    const step = steps[index];
    if (!step) return;
    const vt = normalizeValueType(step.value_type);
    setEditingIndex(index);
    stepForm.resetFields();
    stepForm.setFieldsValue({
      inspection_item: step.inspection_item,
      inspection_method: step.inspection_method,
      acceptance_criteria: step.acceptance_criteria,
      value_type: vt,
      value_spec: { ...defaultValueSpec(vt, t), ...(step.value_spec || {}) },
      sampling_type: step.sampling_type || 'full',
      sampling_spec: getSamplingSpec(step),
      remarks: step.remarks,
    });
    setStepModalVisible(true);
  };

  const buildStepFromForm = (vals: Record<string, unknown>, existing?: InspectionPlanStepItem): InspectionPlanStepItem => {
    const vt = normalizeValueType(vals.value_type as string);
    const samplingType = (vals.sampling_type as 'full' | 'sampling') || 'full';
    const spec = applySamplingToValueSpec(
      { ...defaultValueSpec(vt, t), ...((vals.value_spec as object) || {}) },
      samplingType,
      vals.sampling_spec as SamplingSpec | undefined,
    );
    const typeCriteria = formatAcceptanceCriteriaPreview(vt, spec, t);
    const samplingCriteria = formatSamplingCriteriaPreview(samplingType, spec, t);
    const autoCriteria = [typeCriteria, samplingCriteria].filter(Boolean).join(' · ');
    const criteria = (vals.acceptance_criteria as string)?.trim() || autoCriteria || undefined;
    return {
      sequence: existing?.sequence ?? steps.length,
      step_key: existing?.step_key || crypto.randomUUID(),
      inspection_item: vals.inspection_item as string,
      inspection_method: vals.inspection_method as string | undefined,
      acceptance_criteria: criteria,
      value_type: vt,
      value_spec: spec,
      sampling_type: samplingType,
      quality_standard_id: existing?.quality_standard_id,
      remarks: vals.remarks as string | undefined,
    };
  };

  const handleSaveStep = () => {
    stepForm.validateFields().then((vals) => {
      if (editingIndex !== null) {
        const next = steps.map((s, i) =>
          i === editingIndex ? { ...buildStepFromForm(vals, s), sequence: i } : s,
        );
        syncChange(next);
        message.success(t('app.kuaizhizao.quality.plans.stepEditor.editSuccess'));
      } else {
        const newStep = buildStepFromForm(vals);
        newStep.sequence = steps.length;
        syncChange([...steps, newStep]);
        message.success(t('app.kuaizhizao.quality.plans.stepEditor.addSuccess'));
      }
      closeStepModal();
    });
  };

  const handleRemove = (index: number) => {
    const next = steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, sequence: i }));
    syncChange(next);
  };

  const sortableRowIds = useMemo(() => steps.map((s, i) => stepRowId(s, i)), [steps]);
  const tableColSpan = disabled ? 6 : 7;
  const activeStepIndex = activeId ? steps.findIndex((s, i) => stepRowId(s, i) === activeId) : -1;
  const activeStep = activeStepIndex >= 0 ? steps[activeStepIndex] : null;

  const columns = [
    {
      title: t('app.kuaizhizao.quality.plans.step.sequence'),
      key: 'index',
      width: 100,
      render: (_: unknown, __: InspectionPlanStepItem, index: number) => (
        <SequenceIndexCell
          index={index}
          token={token}
          dragSortTitle={t('app.master-data.operationSequence.dragSort')}
          showDragHandle={!disabled}
        />
      ),
    },
    { title: t('app.kuaizhizao.quality.plans.step.inspectionItem'), dataIndex: 'inspection_item', key: 'inspection_item', ellipsis: true,
      render: (text: string, row: InspectionPlanStepItem) => (
        <>
          {text}
          {stepSpecIsCritical({ ...defaultValueSpec(normalizeValueType(row.value_type), t), ...(row.value_spec || {}) }) ? (
            <Tag color="red" style={{ marginLeft: 6 }}>{t('app.kuaizhizao.quality.plans.stepSpec.critical')}</Tag>
          ) : null}
        </>
      ),
    },
    {
      title: t('app.kuaizhizao.quality.plans.stepSpec.valueType'),
      dataIndex: 'value_type',
      key: 'value_type',
      width: 96,
      render: (v: string) => (
        <InspectionValueTypeTag
          valueType={v}
          label={typeLabelMap[normalizeValueType(v)] || v}
        />
      ),
    },
    { title: t('app.kuaizhizao.quality.plans.step.inspectionMethod'), dataIndex: 'inspection_method', key: 'inspection_method', width: 100, ellipsis: true },
    { title: t('app.kuaizhizao.quality.plans.step.acceptanceCriteria'), dataIndex: 'acceptance_criteria', key: 'acceptance_criteria', width: 140, ellipsis: true },
    {
      title: t('app.kuaizhizao.quality.plans.step.samplingType'),
      dataIndex: 'sampling_type',
      key: 'sampling_type',
      width: 88,
      render: (v: string) => <InspectionSamplingTypeTag samplingType={v} t={t} />,
    },
    ...(disabled
      ? []
      : [
          {
            title: t('common.actions'),
            key: 'action',
            width: 72,
            align: 'center' as const,
            render: (_: unknown, __: InspectionPlanStepItem, index: number) => (
              <Space size={4}>
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  title={t('common.edit')}
                  aria-label={t('common.edit')}
                  onClick={() => openEditModal(index)}
                />
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  title={t('common.delete')}
                  aria-label={t('common.delete')}
                  onClick={() => handleRemove(index)}
                />
              </Space>
            ),
          },
        ]),
  ];

  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          marginBottom: 8,
        }}
      >
        <span style={{ color: token.colorTextSecondary, fontSize: 12 }}>
          {t('app.kuaizhizao.quality.plans.stepEditor.dragHint')}
        </span>
        {!disabled && steps.length > 0 ? (
          <Button type="dashed" icon={<PlusOutlined />} onClick={openAddModal} size="small">
            {t('app.kuaizhizao.quality.plans.stepEditor.addStep')}
          </Button>
        ) : null}
      </div>
      {steps.length > 0 ? (
        <div style={{ position: 'relative', width: '100%' }}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sortableRowIds} strategy={verticalListSortingStrategy}>
              <Table
                columns={columns}
                dataSource={steps}
                rowKey={(row, index) => stepRowId(row, index ?? 0)}
                pagination={false}
                size="small"
                scroll={{ x: 800 }}
                components={{
                  body: {
                    wrapper: (wrapperProps: React.HTMLAttributes<HTMLTableSectionElement>) => {
                      const activeIndex = activeId
                        ? steps.findIndex((s, i) => stepRowId(s, i) === activeId)
                        : -1;
                      const overIndex = overId ? steps.findIndex((s, i) => stepRowId(s, i) === overId) : -1;
                      const showInsertLine =
                        activeId && overId && activeId !== overId && activeIndex !== -1 && overIndex !== -1;
                      const insertBefore = showInsertLine && activeIndex < overIndex;
                      const insertAfter = showInsertLine && activeIndex > overIndex;
                      const insertIndex = insertBefore ? overIndex : insertAfter ? overIndex + 1 : -1;
                      const rowChildren = React.Children.toArray(wrapperProps.children);
                      return (
                        <tbody {...wrapperProps}>
                          {rowChildren.map((child, idx) => {
                            const isInsertBefore = showInsertLine && insertIndex === idx && insertBefore;
                            const isInsertAfter = showInsertLine && insertIndex === idx && insertAfter;
                            return (
                              <React.Fragment key={sortableRowIds[idx] ?? idx}>
                                {isInsertBefore ? <InsertLineRow colSpan={tableColSpan} /> : null}
                                {child}
                                {isInsertAfter ? <InsertLineRow colSpan={tableColSpan} /> : null}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      );
                    },
                    row: (props: React.HTMLAttributes<HTMLTableRowElement> & { 'data-row-key'?: string | number }) => (
                      <SortableStepTableRow {...props} disabled={disabled} />
                    ),
                  },
                }}
              />
            </SortableContext>
            <DragOverlay>
              {activeStep ? (
                <div
                  style={{
                    padding: '12px 16px',
                    background: token.colorBgElevated,
                    border: `1px solid ${token.colorPrimary}`,
                    borderRadius: token.borderRadius,
                    boxShadow: token.boxShadowSecondary,
                    minWidth: 280,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <HolderOutlined style={{ color: token.colorPrimary, fontSize: 16 }} />
                    <span style={getSequenceIndexBadgeStyle(token)}>{activeStepIndex + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, color: token.colorText }}>{activeStep.inspection_item}</div>
                      <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <InspectionValueTypeTag
                          valueType={activeStep.value_type}
                          label={typeLabelMap[normalizeValueType(activeStep.value_type)] || activeStep.value_type}
                        />
                        <InspectionSamplingTypeTag samplingType={activeStep.sampling_type} t={t} />
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
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
            <Button type="primary" ghost icon={<PlusOutlined />} onClick={openAddModal} style={{ marginTop: 12 }}>
              {t('app.kuaizhizao.quality.plans.stepEditor.addStep')}
            </Button>
          )}
        </div>
      )}
      <Modal
        title={
          editingIndex !== null
            ? t('app.kuaizhizao.quality.plans.stepEditor.modalEditTitle')
            : t('app.kuaizhizao.quality.plans.stepEditor.modalTitle')
        }
        open={stepModalVisible}
        onOk={handleSaveStep}
        onCancel={closeStepModal}
        destroyOnHidden
        width={560}
      >
        <Form form={stepForm} layout="vertical" initialValues={{ sampling_type: 'full', value_type: 'boolean' }}>
          <Form.Item
            name="inspection_item"
            label={t('app.kuaizhizao.quality.plans.step.inspectionItem')}
            rules={[{ required: true, message: t('app.kuaizhizao.quality.plans.stepEditor.validation.requiredInspectionItem') }]}
          >
            <Input placeholder={t('app.kuaizhizao.quality.plans.stepEditor.placeholder.inspectionItem')} />
          </Form.Item>
          <Row gutter={16} align="bottom">
            <Col span={8}>
              <Form.Item
                name="value_type"
                label={t('app.kuaizhizao.quality.plans.stepSpec.valueType')}
                rules={[{ required: true }]}
              >
                <Select
                  options={valueTypeOptions(t)}
                  onChange={(vt) =>
                    stepForm.setFieldsValue({ value_spec: defaultValueSpec(normalizeValueType(vt), t) })
                  }
                />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item label=" " colon={false}>
                <InspectionStepCommonFlagFields
                  value={watchedValueSpec}
                  onChange={(partial) => {
                    const vt = normalizeValueType(watchedValueType);
                    const current = { ...defaultValueSpec(vt, t), ...(watchedValueSpec || {}) };
                    stepForm.setFieldsValue({ value_spec: { ...current, ...partial } });
                  }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="value_spec" label={t('app.kuaizhizao.quality.plans.stepSpec.specSection')}>
            <InspectionStepValueSpecFields
              valueType={watchedValueType}
              formulaRefOptions={formulaRefOptions}
            />
          </Form.Item>
          <Form.Item name="inspection_method" label={t('app.kuaizhizao.quality.plans.step.inspectionMethod')}>
            <Input placeholder={t('app.kuaizhizao.quality.plans.stepEditor.placeholder.inspectionMethod')} />
          </Form.Item>
          <Form.Item name="acceptance_criteria" label={t('app.kuaizhizao.quality.plans.step.acceptanceCriteria')}>
            <Input.TextArea rows={2} placeholder={t('app.kuaizhizao.quality.plans.stepEditor.placeholder.acceptanceCriteriaAuto')} />
          </Form.Item>
          <Form.Item name="sampling_type" label={t('app.kuaizhizao.quality.plans.step.samplingType')}>
            <Select options={samplingTypeOptions} placeholder={t('app.kuaizhizao.quality.plans.stepEditor.placeholder.selectSamplingType')} />
          </Form.Item>
          {watchedSamplingType === 'sampling' && (
            <Form.Item
              name="sampling_spec"
              label={t('app.kuaizhizao.quality.plans.stepSpec.samplingSection')}
            >
              <InspectionSamplingSpecFields />
            </Form.Item>
          )}
          <Form.Item name="remarks" label={t('app.kuaizhizao.quality.common.form.remarks')}>
            <Input placeholder={t('app.kuaizhizao.quality.plans.stepEditor.placeholder.remarksOptional')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
