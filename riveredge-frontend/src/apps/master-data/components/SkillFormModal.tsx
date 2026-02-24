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

  const isEdit = Boolean(editUuid);

  useEffect(() => {
    if (!open) return;
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ isActive: true });
    if (!editUuid) return;
    skillApi
      .get(editUuid)
      .then((detail) => {
        formRef.current?.setFieldsValue({
          code: detail.code,
          name: detail.name,
          category: detail.category,
          description: detail.description,
          isActive: detail.isActive ?? true,
        });
      })
      .catch((err: any) => {
        messageApi.error(err?.message || '获取技能详情失败');
      });
  }, [open, editUuid]);

  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      if (isEdit && editUuid) {
        await skillApi.update(editUuid, values as SkillUpdate);
        messageApi.success('更新成功');
        const updated = await skillApi.get(editUuid);
        onSuccess(updated);
      } else {
        if (values.isActive === undefined) {
          values.isActive = true;
        }
        const created = await skillApi.create(values as SkillCreate);
        messageApi.success('创建成功');
        onSuccess(created);
      }
      onClose();
      formRef.current?.resetFields();
    } catch (error: any) {
      messageApi.error(error?.message || (isEdit ? '更新失败' : '创建失败'));
    } finally {
      setFormLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    formRef.current?.resetFields();
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
      formRef={formRef as React.RefObject<ProFormInstance>}
      initialValues={{ isActive: true }}
      layout="vertical"
      grid
    >
      <SchemaFormRenderer schema={skillFormSchema} codeField="code" isEdit={isEdit} />
    </FormModalTemplate>
  );
};
