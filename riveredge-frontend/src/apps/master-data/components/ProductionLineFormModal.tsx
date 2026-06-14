/**
 * 产线新建/编辑弹窗
 */

import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ProFormInstance } from '@ant-design/pro-components';
import { App } from 'antd';
import { FormModalTemplate } from '../../../components/layout-templates';
import { MODAL_CONFIG } from '../../../components/layout-templates/constants';
import { productionLineApi, workshopApi, factoryListItems } from '../services/factory';
import { testGenerateCode, generateCode, getCodeRulePageConfig } from '../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../utils/codeRulePage';
import type { ProductionLine, ProductionLineCreate, ProductionLineUpdate, Workshop } from '../types/factory';
import { SchemaFormRenderer } from '../../../components/schema-form';
import { productionLineFormSchema } from '../schemas/production-line';
import { useCustomFields } from '../../../hooks/useCustomFields';
import { CustomFieldsFormSection } from '../../../components/custom-fields';

const PAGE_CODE = 'master-data-factory-production-line';
const CUSTOM_FIELD_TABLE = 'master_data_factory_production_lines';

export interface ProductionLineFormModalProps {
  open: boolean;
  onClose: () => void;
  editUuid: string | null;
  onSuccess: (productionLine: ProductionLine) => void;
}

export const ProductionLineFormModal: React.FC<ProductionLineFormModalProps> = ({
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
  const [effectiveRuleCode, setEffectiveRuleCode] = useState<string | null>(null);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);

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
    const loadWorkshops = async () => {
      try {
        const result = await workshopApi.list({ limit: 1000, is_active: true });
        setWorkshops(factoryListItems(result));
      } catch (error) {
        console.error('加载车间列表失败:', error);
      }
    };
    loadWorkshops();
  }, []);

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
    productionLineApi
      .get(editUuid)
      .then(async (detail) => {
        formRef.current?.setFieldsValue({
          code: detail.code,
          name: detail.name,
          workshopId: detail.workshopId,
          description: detail.description,
          isActive: detail.isActive ?? true,
        });
        const fieldFormValues = await loadFieldValues(detail.id);
        formRef.current?.setFieldsValue(fieldFormValues);
      })
      .catch((err: any) => {
        messageApi.error(err?.message || t('app.master-data.productionLines.getDetailFailed'));
      });
  }, [open, editUuid]);

  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      const { customData, standardValues } = extractFormValues(values);

      if (isEdit && editUuid) {
        await productionLineApi.update(editUuid, standardValues as ProductionLineUpdate);
        messageApi.success(t('common.updateSuccess'));
        const updated = await productionLineApi.get(editUuid);
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
        const created = await productionLineApi.create(standardValues as ProductionLineCreate);
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

  const optionsMap = {
    workshopId: workshops.map((w) => ({
      label: `${w.code} - ${w.name}`,
      value: w.id,
    })),
  };

  return (
    <FormModalTemplate
      title={isEdit ? t('field.productionLine.editTitle') : t('field.productionLine.createTitle')}
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
        schema={productionLineFormSchema}
        slots={{ customFields: <CustomFieldsFormSection customFields={customFields} customFieldValues={customFieldValues} gridColumns={2} /> }}
        codeField="code"
        codeAutoGenerated={isAutoGenerateEnabled(PAGE_CODE)}
        codeAutoGeneratedKey="field.productionLine.codeAutoGenerated"
        isEdit={isEdit}
        allowEditCodeWhenEdit
        optionsMap={optionsMap}
      />
    </FormModalTemplate>
  );
};
