/**
 * 车间新建/编辑弹窗
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ProFormInstance } from '@ant-design/pro-components';
import { App, theme } from 'antd';
import { FormModalTemplate } from '../../../components/layout-templates';
import { MODAL_CONFIG, MODAL_NESTED_ABOVE_PARENT_OFFSET } from '../../../components/layout-templates/constants';
import { workshopApi, plantApi, factoryListItems } from '../services/factory';
import { testGenerateCode, generateCode, getCodeRulePageConfig } from '../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../utils/codeRulePage';
import type { Workshop, WorkshopCreate, WorkshopUpdate, Plant } from '../types/factory';
import { SchemaFormRenderer } from '../../../components/schema-form';
import { workshopFormSchema } from '../schemas/workshop';
import { useCustomFields } from '../../../hooks/useCustomFields';
import { CustomFieldsFormSection } from '../../../components/custom-fields';
import { PlantFormModal } from './PlantFormModal';

const PAGE_CODE = 'master-data-factory-workshop';
const CUSTOM_FIELD_TABLE = 'master_data_factory_workshops';

export interface WorkshopFormModalProps {
  open: boolean;
  onClose: () => void;
  editUuid: string | null;
  onSuccess: (workshop: Workshop) => void;
  zIndex?: number;
}

export const WorkshopFormModal: React.FC<WorkshopFormModalProps> = ({
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
  const [plantOptions, setPlantOptions] = useState<Array<{ label: string; value: number }>>([]);
  const [plantQuickCreateVisible, setPlantQuickCreateVisible] = useState(false);

  const {
    customFields,
    customFieldValues,
    loadFieldValues,
    extractFormValues,
    saveCustomFieldValues,
    resetFieldValues,
  } = useCustomFields({ tableName: CUSTOM_FIELD_TABLE, loadWhenOpen: true, open });

  const isEdit = Boolean(editUuid);

  const reloadPlants = useCallback(async () => {
    try {
      const list = await plantApi.list({ limit: 1000, is_active: true });
      setPlantOptions(factoryListItems(list).map((p) => ({ label: `${p.code} - ${p.name}`, value: p.id })));
    } catch (e) {
      console.error('加载厂区列表失败:', e);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void reloadPlants();
  }, [open, reloadPlants]);

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
    workshopApi
      .get(editUuid)
      .then(async (detail) => {
        formRef.current?.setFieldsValue({
          code: detail.code,
          name: detail.name,
          description: detail.description,
          plantId: detail.plantId,
          isActive: detail.isActive ?? true,
        });
        const fieldFormValues = await loadFieldValues(detail.id);
        formRef.current?.setFieldsValue(fieldFormValues);
      })
      .catch((err: any) => {
        messageApi.error(err?.message || t('app.master-data.workshops.getDetailFailed'));
      });
  }, [open, editUuid]);

  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      const { customData, standardValues } = extractFormValues(values);

      if (isEdit && editUuid) {
        await workshopApi.update(editUuid, standardValues as WorkshopUpdate);
        messageApi.success(t('common.updateSuccess'));
        const updated = await workshopApi.get(editUuid);
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
        const created = await workshopApi.create(standardValues as WorkshopCreate);
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

  const handlePlantQuickCreateSuccess = (plant: Plant) => {
    setPlantOptions((prev) => {
      if (prev.some((p) => p.value === plant.id)) return prev;
      return [...prev, { label: `${plant.code} - ${plant.name}`, value: plant.id }];
    });
    formRef.current?.setFieldsValue({ plantId: plant.id });
    setPlantQuickCreateVisible(false);
    void reloadPlants();
  };

  const optionsMap = { plantId: plantOptions };

  return (
    <>
      <FormModalTemplate
        title={isEdit ? t('field.workshop.editTitle') : t('field.workshop.createTitle')}
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
          schema={workshopFormSchema}
          slots={{ customFields: <CustomFieldsFormSection customFields={customFields} customFieldValues={customFieldValues} gridColumns={2} /> }}
          codeField="code"
          codeAutoGenerated={isAutoGenerateEnabled(PAGE_CODE)}
          codeAutoGeneratedKey="field.workshop.codeAutoGenerated"
          isEdit={isEdit}
          allowEditCodeWhenEdit
          optionsMap={optionsMap}
          dropdownEnhanceMap={{
            plantId: {
              quickCreate: {
                label: t('field.workshop.quickAddPlant'),
                onClick: () => setPlantQuickCreateVisible(true),
              },
            },
          }}
        />
      </FormModalTemplate>

      {plantQuickCreateVisible ? (
        <PlantFormModal
          open={plantQuickCreateVisible}
          editUuid={null}
          onClose={() => setPlantQuickCreateVisible(false)}
          onSuccess={handlePlantQuickCreateSuccess}
          zIndex={
            zIndex != null
              ? zIndex + MODAL_NESTED_ABOVE_PARENT_OFFSET
              : token.zIndexPopupBase + MODAL_NESTED_ABOVE_PARENT_OFFSET
          }
        />
      ) : null}
    </>
  );
};
