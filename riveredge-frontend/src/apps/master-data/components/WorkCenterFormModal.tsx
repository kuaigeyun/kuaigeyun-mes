/**
 * 工作中心新建/编辑弹窗
 */

import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ProFormInstance } from '@ant-design/pro-components';
import { App, theme } from 'antd';
import { FormModalTemplate } from '../../../components/layout-templates';
import { MODAL_CONFIG, MODAL_NESTED_ABOVE_PARENT_OFFSET } from '../../../components/layout-templates/constants';
import { workCenterApi, workstationApi, factoryListItems } from '../services/factory';
import { testGenerateCode, generateCode, getCodeRulePageConfig } from '../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../utils/codeRulePage';
import type { WorkCenter, WorkCenterCreate, WorkCenterUpdate, Workstation } from '../types/factory';
import { SchemaFormRenderer } from '../../../components/schema-form';
import { workCenterFormSchema } from '../schemas/workCenter';
import { useCustomFields } from '../../../hooks/useCustomFields';
import { CustomFieldsFormSection } from '../../../components/custom-fields';
import { WorkstationFormModal } from './WorkstationFormModal';

const PAGE_CODE = 'master-data-factory-work-center';
const CUSTOM_FIELD_TABLE = 'master_data_factory_work_centers';

export interface WorkCenterFormModalProps {
  open: boolean;
  onClose: () => void;
  editUuid: string | null;
  onSuccess: (workCenter: WorkCenter) => void;
  zIndex?: number;
}

export const WorkCenterFormModal: React.FC<WorkCenterFormModalProps> = ({
  open,
  onClose,
  editUuid,
  onSuccess,
  zIndex,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = theme.useToken();
  const formRef = useRef<ProFormInstance>();
  const [formLoading, setFormLoading] = useState(false);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [effectiveRuleCode, setEffectiveRuleCode] = useState<string | null>(null);
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [workstationQuickCreateVisible, setWorkstationQuickCreateVisible] = useState(false);

  const {
    customFields,
    customFieldValues,
    loadFieldValues,
    extractFormValues,
    saveCustomFieldValues,
    resetFieldValues,
  } = useCustomFields({ tableName: CUSTOM_FIELD_TABLE, loadWhenOpen: true, open });

  const isEdit = Boolean(editUuid);

  const reloadWorkstations = React.useCallback(async () => {
    try {
      const result = await workstationApi.list({ limit: 1000, is_active: true });
      setWorkstations(factoryListItems(result));
    } catch (error) {
      console.error('加载工位列表失败:', error);
    }
  }, []);

  useEffect(() => {
    reloadWorkstations();
  }, [reloadWorkstations]);

  useEffect(() => {
    if (!open) return;
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ isActive: true });
    resetFieldValues();
    if (!editUuid) {
      (async () => {
        let ruleCode = getPageRuleCode(PAGE_CODE);
        let autoGenerate = isAutoGenerateEnabled(PAGE_CODE);
        try {
          const pageConfig = await getCodeRulePageConfig(PAGE_CODE);
          if (pageConfig?.ruleCode) {
            ruleCode = pageConfig.ruleCode;
            autoGenerate = !!pageConfig.autoGenerate;
          }
        } catch {}
        if (autoGenerate && ruleCode) {
          setEffectiveRuleCode(ruleCode);
          testGenerateCode({ rule_code: ruleCode })
            .then((res) => {
              setPreviewCode(res.code);
              formRef.current?.setFieldsValue({ code: res.code, isActive: true });
            })
            .catch(() => {
              setPreviewCode(null);
              formRef.current?.setFieldsValue({ isActive: true });
            });
        } else {
          setPreviewCode(null);
          setEffectiveRuleCode(null);
          formRef.current?.setFieldsValue({ isActive: true });
        }
      })();
      return;
    }
    setPreviewCode(null);
    setEffectiveRuleCode(null);
    workCenterApi
      .get(editUuid)
      .then(async (detail) => {
        formRef.current?.setFieldsValue({
          code: detail.code,
          name: detail.name,
          description: detail.description,
          workstationIds: detail.workstationIds ?? [],
          isActive: detail.isActive ?? true,
        });
        const fieldFormValues = await loadFieldValues(detail.id);
        formRef.current?.setFieldsValue(fieldFormValues);
      })
      .catch((err: any) => {
        messageApi.error(err?.message || t('app.master-data.workCenters.getDetailFailed'));
      });
  }, [open, editUuid]);

  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      const { customData, standardValues } = extractFormValues(values);

      if (isEdit && editUuid) {
        await workCenterApi.update(editUuid, standardValues as WorkCenterUpdate);
        messageApi.success(t('common.updateSuccess'));
        const updated = await workCenterApi.get(editUuid);
        await saveCustomFieldValues(updated.id, customData);
        onSuccess(updated);
      } else {
        const ruleCodeToUse = effectiveRuleCode || getPageRuleCode(PAGE_CODE);
        if (
          ruleCodeToUse &&
          (isAutoGenerateEnabled(PAGE_CODE) || effectiveRuleCode) &&
          (standardValues.code === previewCode || !standardValues.code)
        ) {
          try {
            const codeResponse = await generateCode({ rule_code: ruleCodeToUse });
            standardValues.code = codeResponse.code;
          } catch {}
        }
        if (standardValues.isActive === undefined) {
          standardValues.isActive = true;
        }
        const created = await workCenterApi.create(standardValues as WorkCenterCreate);
        await saveCustomFieldValues(created.id, customData);
        messageApi.success(t('common.createSuccess'));
        onSuccess(created);
      }
      onClose();
      formRef.current?.resetFields();
      setPreviewCode(null);
      setEffectiveRuleCode(null);
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
    setPreviewCode(null);
    setEffectiveRuleCode(null);
    resetFieldValues();
  };

  const handleWorkstationQuickCreateSuccess = (workstation: Workstation) => {
    setWorkstations((prev) => {
      if (prev.some((ws) => ws.id === workstation.id)) return prev;
      return [...prev, workstation];
    });
    const currentIds: number[] = formRef.current?.getFieldValue('workstationIds') ?? [];
    const nextIds = currentIds.includes(workstation.id)
      ? currentIds
      : [...currentIds, workstation.id];
    formRef.current?.setFieldsValue({ workstationIds: nextIds });
    setWorkstationQuickCreateVisible(false);
    void reloadWorkstations();
  };

  return (
    <>
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
      zIndex={zIndex}
    >
      <SchemaFormRenderer
        schema={workCenterFormSchema}
        slots={{ customFields: <CustomFieldsFormSection customFields={customFields} customFieldValues={customFieldValues} gridColumns={2} /> }}
        codeField="code"
        codeAutoGenerated={isAutoGenerateEnabled(PAGE_CODE)}
        codeAutoGeneratedKey="field.workCenter.codeAutoGenerated"
        isEdit={isEdit}
        allowEditCodeWhenEdit
        optionsMap={{
          workstationIds: workstations.map((ws) => ({
            label: `${ws.code} - ${ws.name}`,
            value: ws.id,
          })),
        }}
        dropdownEnhanceMap={{
          workstationIds: {
            quickCreate: {
              label: t('field.workCenter.quickAddWorkstation'),
              onClick: () => setWorkstationQuickCreateVisible(true),
            },
          },
        }}
      />
    </FormModalTemplate>

    <WorkstationFormModal
      open={workstationQuickCreateVisible}
      editUuid={null}
      onClose={() => setWorkstationQuickCreateVisible(false)}
      onSuccess={handleWorkstationQuickCreateSuccess}
      zIndex={
        zIndex != null
          ? zIndex + MODAL_NESTED_ABOVE_PARENT_OFFSET
          : token.zIndexPopupBase + MODAL_NESTED_ABOVE_PARENT_OFFSET
      }
    />
    </>
  );
};
