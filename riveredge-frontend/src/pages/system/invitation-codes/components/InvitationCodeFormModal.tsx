/**
 * 邀请码新建/编辑弹窗（Schema 驱动）
 */

import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ProFormInstance } from '@ant-design/pro-components';
import { App } from 'antd';
import { FormModalTemplate } from '../../../../components/layout-templates';
import { MODAL_CONFIG } from '../../../../components/layout-templates/constants';
import { SchemaFormRenderer } from '../../../../components/schema-form';
import { invitationCodeFormSchema } from '../schemas/invitation-code';
import {
  getInvitationCodeByUuid,
  createInvitationCode,
  updateInvitationCode,
  InvitationCode,
  CreateInvitationCodeData,
  UpdateInvitationCodeData,
} from '../../../../services/invitationCode';

export interface InvitationCodeFormModalProps {
  open: boolean;
  onClose: () => void;
  editUuid: string | null;
  onSuccess: () => void;
}

export const InvitationCodeFormModal: React.FC<InvitationCodeFormModalProps> = ({
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
    formRef.current?.setFieldsValue({ is_active: true, max_uses: 1 });
    if (!editUuid) return;
    getInvitationCodeByUuid(editUuid)
      .then((detail: InvitationCode) => {
        formRef.current?.setFieldsValue({
          email: detail.email,
          role_id: detail.role_id,
          max_uses: detail.max_uses,
          expires_at: detail.expires_at,
          is_active: detail.is_active ?? true,
        });
      })
      .catch((err: any) => {
        messageApi.error(err?.message || t('common.loadFailed'));
      });
  }, [open, editUuid, messageApi, t]);

  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      if (isEdit && editUuid) {
        await updateInvitationCode(editUuid, values as UpdateInvitationCodeData);
        messageApi.success(t('pages.system.updateSuccess'));
      } else {
        await createInvitationCode(values as CreateInvitationCodeData);
        messageApi.success(t('pages.system.createSuccess'));
      }
      onClose();
      formRef.current?.resetFields();
      onSuccess();
    } catch (error: any) {
      messageApi.error(error?.message || (isEdit ? t('common.updateFailed') : t('common.saveFailed')));
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
      title={isEdit ? t('field.invitationCode.editTitle') : t('field.invitationCode.createTitle')}
      open={open}
      onClose={handleClose}
      onFinish={handleSubmit}
      isEdit={isEdit}
      loading={formLoading}
      width={MODAL_CONFIG.SMALL_WIDTH}
      formRef={formRef as React.RefObject<ProFormInstance>}
      initialValues={{ is_active: true, max_uses: 1 }}
      layout="vertical"
      grid
    >
      <SchemaFormRenderer schema={invitationCodeFormSchema} isEdit={isEdit} />
    </FormModalTemplate>
  );
};
