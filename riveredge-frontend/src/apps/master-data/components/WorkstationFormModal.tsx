/**
 * 工位新建/编辑弹窗
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ProFormInstance } from '@ant-design/pro-components';
import { App, theme } from 'antd';
import { FormModalTemplate } from '../../../components/layout-templates';
import { MODAL_CONFIG, MODAL_NESTED_ABOVE_PARENT_OFFSET } from '../../../components/layout-templates/constants';
import { workstationApi, productionLineApi, factoryListItems } from '../services/factory';
import { testGenerateCode, generateCode, getCodeRulePageConfig } from '../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../utils/codeRulePage';
import type { Workstation, WorkstationCreate, WorkstationUpdate, ProductionLine } from '../types/factory';
import { SchemaFormRenderer } from '../../../components/schema-form';
import { workstationFormSchema } from '../schemas/workstation';
import { useCustomFields } from '../../../hooks/useCustomFields';
import { CustomFieldsFormSection } from '../../../components/custom-fields';
import { ProductionLineFormModal } from './ProductionLineFormModal';

const PAGE_CODE = 'master-data-factory-workstation';
const CUSTOM_FIELD_TABLE = 'master_data_factory_workstations';

export interface WorkstationFormModalProps {
  open: boolean;
  onClose: () => void;
  editUuid: string | null;
  onSuccess: (workstation: Workstation) => void;
  /** 嵌套于其他 Modal 时使用，确保叠层正确 */
  zIndex?: number;
}

export const WorkstationFormModal: React.FC<WorkstationFormModalProps> = ({
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
  const [productionLines, setProductionLines] = useState<ProductionLine[]>([]);
  const [productionLineQuickCreateVisible, setProductionLineQuickCreateVisible] = useState(false);

  const {
    customFields,
    customFieldValues,
    loadFieldValues,
    extractFormValues,
    saveCustomFieldValues,
    resetFieldValues,
  } = useCustomFields({ tableName: CUSTOM_FIELD_TABLE, loadWhenOpen: true, open });

  const isEdit = Boolean(editUuid);

  const nestedModalZIndex =
    zIndex != null
      ? zIndex + MODAL_NESTED_ABOVE_PARENT_OFFSET
      : token.zIndexPopupBase + MODAL_NESTED_ABOVE_PARENT_OFFSET;

  const reloadProductionLines = useCallback(async () => {
    try {
      const result = await productionLineApi.list({ limit: 1000, is_active: true });
      setProductionLines(factoryListItems(result));
    } catch (error) {
      console.error('加载产线列表失败:', error);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void reloadProductionLines();
  }, [open, reloadProductionLines]);

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
    workstationApi
      .get(editUuid)
      .then(async (detail) => {
        formRef.current?.setFieldsValue({
          code: detail.code,
          name: detail.name,
          productionLineId: detail.productionLineId,
          description: detail.description,
          isActive: detail.isActive ?? true,
        });
        const fieldFormValues = await loadFieldValues(detail.id);
        formRef.current?.setFieldsValue(fieldFormValues);
      })
      .catch((err: any) => {
        messageApi.error(err?.message || t('app.master-data.workstations.getDetailFailed'));
      });
  }, [open, editUuid]);

  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      const { customData, standardValues } = extractFormValues(values);

      if (isEdit && editUuid) {
        await workstationApi.update(editUuid, standardValues as WorkstationUpdate);
        messageApi.success(t('common.updateSuccess'));
        const updated = await workstationApi.get(editUuid);
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
        const created = await workstationApi.create(standardValues as WorkstationCreate);
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

  const handleProductionLineQuickCreateSuccess = (productionLine: ProductionLine) => {
    setProductionLines((prev) => {
      if (prev.some((p) => p.id === productionLine.id)) return prev;
      return [...prev, productionLine];
    });
    formRef.current?.setFieldsValue({ productionLineId: productionLine.id });
    setProductionLineQuickCreateVisible(false);
    void reloadProductionLines();
  };

  const optionsMap = {
    productionLineId: productionLines.map((p) => ({
      label: `${p.code} - ${p.name}`,
      value: p.id,
    })),
  };

  return (
    <>
      <FormModalTemplate
        title={isEdit ? t('field.workstation.editTitle') : t('field.workstation.createTitle')}
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
          schema={workstationFormSchema}
          slots={{ customFields: <CustomFieldsFormSection customFields={customFields} customFieldValues={customFieldValues} gridColumns={2} /> }}
          codeField="code"
          codeAutoGenerated={isAutoGenerateEnabled(PAGE_CODE)}
          codeAutoGeneratedKey="field.workstation.codeAutoGenerated"
          isEdit={isEdit}
          allowEditCodeWhenEdit
          optionsMap={optionsMap}
          dropdownEnhanceMap={{
            productionLineId: {
              quickCreate: {
                label: t('field.workstation.quickAddProductionLine'),
                onClick: () => setProductionLineQuickCreateVisible(true),
              },
            },
          }}
        />
      </FormModalTemplate>

      {productionLineQuickCreateVisible ? (
        <ProductionLineFormModal
          open={productionLineQuickCreateVisible}
          editUuid={null}
          onClose={() => setProductionLineQuickCreateVisible(false)}
          onSuccess={handleProductionLineQuickCreateSuccess}
          zIndex={nestedModalZIndex}
        />
      ) : null}
    </>
  );
};
