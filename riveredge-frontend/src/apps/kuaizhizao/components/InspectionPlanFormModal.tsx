/**
 * 质检方案新建/编辑弹窗（可复用）
 *
 * 供质检方案管理页、工序表单内「快速新增质检方案」等场景使用。
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ProFormInstance,
  ProFormText,
  ProFormTextArea,
  ProFormItem,
  ProFormSwitch,
  ProFormDependency,
} from '@ant-design/pro-components';
import { App, Modal, Row, Col } from 'antd';
import { FormModalTemplate } from '../../../components/layout-templates';
import { MODAL_CONFIG } from '../../../components/layout-templates/constants';
import CodeField from '../../../components/code-field';
import { UniDropdown } from '../../../components/uni-dropdown';
import { inspectionPlanApi } from '../services/production';
import { InspectionPlanStepEditor, type InspectionPlanStepItem } from './InspectionPlanStepEditor';
import { bumpPlanVersion, stepsFingerprint } from '../types/inspectionStepSpec';
import { getQualityPlanTypeFallback } from '../pages/quality-management/components/qualityMeta';

export interface InspectionPlanRecord {
  id?: number;
  uuid?: string;
  plan_code?: string;
  plan_name?: string;
  plan_type?: string;
  operation_id?: number;
  version?: string;
  is_active?: boolean;
  remarks?: string;
  steps?: InspectionPlanStepItem[];
}

export interface InspectionPlanFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (plan: InspectionPlanRecord) => void;
  editId?: number | string | null;
  /** 新建过程检验方案时预填工序 ID */
  operationId?: number | null;
  zIndex?: number;
}

export const InspectionPlanFormModal: React.FC<InspectionPlanFormModalProps> = ({
  open,
  onClose,
  editId = null,
  onSuccess,
  operationId,
  zIndex,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const formRef = useRef<ProFormInstance>();
  const [formLoading, setFormLoading] = useState(false);
  const [steps, setSteps] = useState<InspectionPlanStepItem[]>([]);
  const [stepsBaseline, setStepsBaseline] = useState('');
  const [currentPlan, setCurrentPlan] = useState<InspectionPlanRecord | null>(null);
  const planTypeOptions = useMemo(() => getQualityPlanTypeFallback(t), [t]);
  const isEdit = editId != null && editId !== '';

  useEffect(() => {
    if (!open) return;
    if (!isEdit) {
      formRef.current?.resetFields();
      setSteps([]);
      setStepsBaseline('');
      setCurrentPlan(null);
      const initial: Record<string, unknown> = {
        plan_type: operationId != null ? 'process' : undefined,
        version: '1.0',
        is_active: true,
      };
      if (operationId != null) {
        initial.operation_id = operationId;
      }
      formRef.current?.setFieldsValue(initial);
      return;
    }
    void (async () => {
      try {
        setFormLoading(true);
        const detail = await inspectionPlanApi.get(String(editId));
        setCurrentPlan(detail);
        const stepItems: InspectionPlanStepItem[] = (detail.steps || []).map((s: any) => ({
          sequence: s.sequence ?? 0,
          step_key: s.step_key,
          inspection_item: s.inspection_item || '',
          inspection_method: s.inspection_method,
          acceptance_criteria: s.acceptance_criteria,
          value_type: s.value_type,
          value_spec: s.value_spec,
          sampling_type: (s.sampling_type as 'full' | 'sampling') || 'full',
          quality_standard_id: s.quality_standard_id,
          remarks: s.remarks,
        }));
        setSteps(stepItems);
        setStepsBaseline(stepsFingerprint(stepItems));
        formRef.current?.setFieldsValue({
          plan_code: detail.plan_code,
          plan_name: detail.plan_name,
          plan_type: detail.plan_type,
          version: detail.version,
          is_active: detail.is_active,
          remarks: detail.remarks,
          operation_id: detail.operation_id,
        });
      } catch {
        messageApi.error(t('app.kuaizhizao.quality.plans.messages.loadDetailFailed'));
      } finally {
        setFormLoading(false);
      }
    })();
  }, [open, isEdit, editId, operationId, messageApi, t]);

  const submitPlan = async (values: any) => {
    const planCode = typeof values.plan_code === 'string' ? values.plan_code.trim() : values.plan_code;
    const submitData = {
      ...values,
      plan_code: planCode,
      material_id: null,
      material_code: null,
      material_name: null,
      steps: steps.map((s, i) => ({ ...s, sequence: i })),
    };

    if (isEdit && currentPlan?.id) {
      await inspectionPlanApi.update(String(currentPlan.id), submitData);
      messageApi.success(t('app.kuaizhizao.quality.plans.messages.updateSuccess'));
      const updated = await inspectionPlanApi.get(String(currentPlan.id));
      onSuccess(updated);
    } else {
      const created = await inspectionPlanApi.create(submitData);
      messageApi.success(t('app.kuaizhizao.quality.plans.messages.createSuccess'));
      onSuccess(created);
    }
    handleClose();
  };

  const handleClose = () => {
    onClose();
    formRef.current?.resetFields();
    setSteps([]);
    setStepsBaseline('');
    setCurrentPlan(null);
  };

  const handleSubmit = async (values: any): Promise<void> => {
    try {
      setFormLoading(true);
      const stepsChanged = isEdit && stepsFingerprint(steps) !== stepsBaseline;
      if (stepsChanged) {
        const nextVersion = bumpPlanVersion(values.version || currentPlan?.version);
        Modal.confirm({
          title: t('app.kuaizhizao.quality.plans.versionBump.title'),
          content: t('app.kuaizhizao.quality.plans.versionBump.content', {
            from: values.version || currentPlan?.version || '1.0',
            to: nextVersion,
          }),
          okText: t('app.kuaizhizao.quality.plans.versionBump.confirm'),
          cancelText: t('common.cancel'),
          onOk: async () => {
            await submitPlan({ ...values, version: nextVersion });
          },
        });
        return;
      }
      await submitPlan(values);
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.quality.plans.messages.operationFailed'));
      throw error;
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <FormModalTemplate
      title={
        isEdit
          ? t('app.kuaizhizao.quality.plans.modal.editTitle')
          : t('app.kuaizhizao.quality.plans.modal.createTitle')
      }
      open={open}
      onClose={handleClose}
      onFinish={handleSubmit}
      isEdit={isEdit}
      loading={formLoading}
      width={MODAL_CONFIG.LARGE_WIDTH}
      formRef={formRef as React.RefObject<ProFormInstance>}
      className="inspection-plan-modal"
      grid={false}
      zIndex={zIndex}
    >
      <ProFormItem name="operation_id" hidden>
        <input type="hidden" />
      </ProFormItem>
      <Row gutter={16}>
        <ProFormDependency name={['plan_type']}>
          {({ plan_type }) => (
            <Col span={12}>
              <CodeField
                pageCode="kuaizhizao-quality-inspection-plan"
                name="plan_code"
                label={t('app.kuaizhizao.quality.plans.form.planCode')}
                required
                autoGenerateOnCreate={!isEdit}
                showGenerateButton={false}
                disabled={isEdit}
                context={{
                  plan_type: plan_type || '',
                }}
              />
            </Col>
          )}
        </ProFormDependency>
        <Col span={12}>
          <ProFormText
            name="plan_name"
            label={t('app.kuaizhizao.quality.plans.form.planName')}
            rules={[{ required: true, message: t('app.kuaizhizao.quality.plans.validation.requiredPlanName') }]}
            placeholder={t('app.kuaizhizao.quality.plans.placeholder.enterPlanName')}
          />
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <ProFormItem
            name="plan_type"
            label={t('app.kuaizhizao.quality.plans.form.planType')}
            rules={[{ required: true, message: t('app.kuaizhizao.quality.plans.validation.requiredPlanType') }]}
          >
            <UniDropdown
              placeholder={t('app.kuaizhizao.quality.plans.placeholder.selectPlanType')}
              showSearch
              allowClear
              options={planTypeOptions}
              style={{ width: '100%' }}
            />
          </ProFormItem>
        </Col>
        <Col span={12}>
          <ProFormText
            name="version"
            label={t('app.kuaizhizao.quality.plans.form.version')}
            initialValue="1.0"
            extra={t('app.kuaizhizao.quality.plans.form.versionHint')}
          />
        </Col>
      </Row>

      <ProFormItem label={t('app.kuaizhizao.quality.plans.form.steps')} style={{ width: '100%' }}>
        <InspectionPlanStepEditor value={steps} onChange={setSteps} disabled={false} />
      </ProFormItem>

      <Row gutter={16}>
        <Col span={24}>
          <ProFormTextArea
            name="remarks"
            label={t('app.kuaizhizao.quality.common.form.remarks')}
            placeholder={t('app.kuaizhizao.quality.plans.placeholder.optional')}
          />
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <ProFormSwitch
            name="is_active"
            label={t('app.kuaizhizao.quality.plans.form.isActive')}
            initialValue={true}
          />
        </Col>
      </Row>
    </FormModalTemplate>
  );
};

export default InspectionPlanFormModal;
