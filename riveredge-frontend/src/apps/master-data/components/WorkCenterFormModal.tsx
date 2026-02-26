/**
 * 工作中心新建/编辑弹窗
 */

import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ProFormInstance } from '@ant-design/pro-components';
import { App } from 'antd';
import { FormModalTemplate } from '../../../components/layout-templates';
import { MODAL_CONFIG } from '../../../components/layout-templates/constants';
import { workCenterApi, workstationApi } from '../services/factory';
import { testGenerateCode, generateCode } from '../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../utils/codeRulePage';
import type { WorkCenter, WorkCenterCreate, WorkCenterUpdate, Workstation } from '../types/factory';
import { SchemaFormRenderer } from '../../../components/schema-form';
import { workCenterFormSchema } from '../schemas/workCenter';

const PAGE_CODE = 'master-data-factory-work-center';

export interface WorkCenterFormModalProps {
  open: boolean;
  onClose: () => void;
  editUuid: string | null;
  onSuccess: (workCenter: WorkCenter) => void;
}

export const WorkCenterFormModal: React.FC<WorkCenterFormModalProps> = ({
  open,
  onClose,
  editUuid,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const formRef = useRef<ProFormInstance>();
  const [formLoading, setFormLoading] = useState(false);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [workstations, setWorkstations] = useState<Workstation[]>([]);

  const isEdit = Boolean(editUuid);

  useEffect(() => {
    const loadWorkstations = async () => {
      try {
        const result = await workstationApi.list({ limit: 1000, isActive: true });
        setWorkstations(result);
      } catch (error) {
        console.error('加载工位列表失败:', error);
      }
    };
    loadWorkstations();
  }, []);

  useEffect(() => {
    if (!open) return;
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ isActive: true });
    if (!editUuid) {
      if (isAutoGenerateEnabled(PAGE_CODE)) {
        const ruleCode = getPageRuleCode(PAGE_CODE);
        if (ruleCode) {
          testGenerateCode({ rule_code: ruleCode })
            .then((res) => {
              setPreviewCode(res.code);
              formRef.current?.setFieldsValue({ code: res.code });
            })
            .catch(() => setPreviewCode(null));
        } else {
          setPreviewCode(null);
        }
      } else {
        setPreviewCode(null);
      }
      return;
    }
    setPreviewCode(null);
    workCenterApi
      .get(editUuid)
      .then((detail) => {
        formRef.current?.setFieldsValue({
          code: detail.code,
          name: detail.name,
          description: detail.description,
          workstationIds: detail.workstationIds ?? [],
          isActive: detail.isActive ?? true,
        });
      })
      .catch((err: any) => {
        messageApi.error(err?.message || t('app.master-data.workCenters.getDetailFailed'));
      });
  }, [open, editUuid]);

  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      if (isEdit && editUuid) {
        await workCenterApi.update(editUuid, values as WorkCenterUpdate);
        messageApi.success(t('common.updateSuccess'));
        const updated = await workCenterApi.get(editUuid);
        onSuccess(updated);
      } else {
        if (isAutoGenerateEnabled(PAGE_CODE)) {
          const ruleCode = getPageRuleCode(PAGE_CODE);
          const currentCode = values.code;
          if (ruleCode && (currentCode === previewCode || !currentCode)) {
            try {
              const codeResponse = await generateCode({ rule_code: ruleCode });
              values.code = codeResponse.code;
            } catch {
              // keep form code
            }
          }
        }
        if (values.isActive === undefined) {
          values.isActive = true;
        }
        const created = await workCenterApi.create(values as WorkCenterCreate);
        messageApi.success(t('common.createSuccess'));
        onSuccess(created);
      }
      onClose();
      formRef.current?.resetFields();
      setPreviewCode(null);
    } catch (error: any) {
      messageApi.error(error?.message || (isEdit ? t('common.updateFailed') : t('common.createFailed')));
    } finally {
      setFormLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    formRef.current?.resetFields();
    setPreviewCode(null);
  };

  return (
    <FormModalTemplate
      title={isEdit ? t('field.workCenter.editTitle') : t('field.workCenter.createTitle')}
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
      <SchemaFormRenderer
        schema={workCenterFormSchema}
        codeField="code"
        codeAutoGenerated={isAutoGenerateEnabled(PAGE_CODE)}
        codeAutoGeneratedKey="field.workCenter.codeAutoGenerated"
        isEdit={isEdit}
        optionsMap={{
          workstationIds: workstations.map((ws) => ({
            label: `${ws.code} - ${ws.name}`,
            value: ws.id,
          })),
        }}
      />
    </FormModalTemplate>
  );
};
