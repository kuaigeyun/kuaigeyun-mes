/**
 * 技能新建/编辑弹窗
 */

import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ProFormInstance } from '@ant-design/pro-components';
import { App } from 'antd';
import { FormModalTemplate } from '../../../components/layout-templates';
import { MODAL_CONFIG } from '../../../components/layout-templates/constants';
import { skillApi } from '../services/performance';
import type { Skill, SkillCreate, SkillUpdate } from '../types/performance';
import { SchemaFormRenderer } from '../../../components/schema-form';
import { skillFormSchema } from '../schemas/skill';
import { useCustomFields } from '../../../hooks/useCustomFields';
import { CustomFieldsFormSection } from '../../../components/custom-fields';
import { PERFORMANCE_FORM_MODAL_CLASS } from '../utils/performanceFormLayout';

const CUSTOM_FIELD_TABLE = 'master_data_skills';

export interface SkillFormModalProps {
  open: boolean;
  onClose: () => void;
  editUuid: string | null;
  onSuccess: (skill: Skill) => void;
}

export const SkillFormModal: React.FC<SkillFormModalProps> = ({
  open,
  onClose,
  editUuid,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const formRef = useRef<ProFormInstance>();
  const [formLoading, setFormLoading] = useState(false);

  const {
    customFields,
    customFieldValues,
    loadFieldValues,
    extractFormValues,
    saveCustomFieldValues,
    resetFieldValues,
  } = useCustomFields({ tableName: CUSTOM_FIELD_TABLE, loadWhenOpen: true, open });

  const isEdit = Boolean(editUuid);

  useEffect(() => {
    if (!open) return;
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ isActive: true });
    resetFieldValues();
    if (!editUuid) return;
    skillApi
      .get(editUuid)
      .then(async (detail) => {
        formRef.current?.setFieldsValue({
          code: detail.code,
          name: detail.name,
          category: detail.category,
          description: detail.description,
          isActive: detail.isActive ?? true,
        });
        const fieldFormValues = await loadFieldValues(detail.id);
        formRef.current?.setFieldsValue(fieldFormValues);
      })
      .catch((err: any) => {
        messageApi.error(err?.message || t('app.master-data.skills.getDetailFailed'));
      });
  }, [open, editUuid]);

  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      const { customData, standardValues } = extractFormValues(values);
      if (isEdit && editUuid) {
        await skillApi.update(editUuid, standardValues as SkillUpdate);
        messageApi.success(t('common.updateSuccess'));
        const updated = await skillApi.get(editUuid);
        await saveCustomFieldValues(updated.id, customData);
        onSuccess(updated);
      } else {
        if (standardValues.isActive === undefined) {
          standardValues.isActive = true;
        }
        const created = await skillApi.create(standardValues as SkillCreate);
        await saveCustomFieldValues(created.id, customData);
        messageApi.success(t('common.createSuccess'));
        onSuccess(created);
      }
      onClose();
      formRef.current?.resetFields();
      resetFieldValues();
    } catch (error: any) {
      messageApi.error(error?.message || (isEdit ? t('common.updateFailed') : t('common.createFailed')));
    } finally {
      setFormLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    formRef.current?.resetFields();
    resetFieldValues();
  };

  return (
    <FormModalTemplate
      title={isEdit ? t('field.skill.editTitle') : t('field.skill.createTitle')}
      open={open}
      onClose={handleClose}
      onFinish={handleSubmit}
      isEdit={isEdit}
      loading={formLoading}
      width={MODAL_CONFIG.STANDARD_WIDTH}
      className={PERFORMANCE_FORM_MODAL_CLASS}
      formRef={formRef as React.RefObject<ProFormInstance>}
      initialValues={{ isActive: true }}
      layout="vertical"
      grid={false}
    >
      <SchemaFormRenderer
        schema={skillFormSchema}
        codeField="code"
        isEdit={isEdit}
        modalHalfWidthLayout
        slots={{
          customFields: (
            <CustomFieldsFormSection customFields={customFields} customFieldValues={customFieldValues} gridColumns={2} />
          ),
        }}
      />
    </FormModalTemplate>
  );
};
