/**
 * 工位新建/编辑弹窗
 */

import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ProFormInstance } from '@ant-design/pro-components';
import { App } from 'antd';
import { FormModalTemplate } from '../../../components/layout-templates';
import { MODAL_CONFIG } from '../../../components/layout-templates/constants';
import { workstationApi, productionLineApi } from '../services/factory';
import { testGenerateCode, generateCode, getCodeRulePageConfig } from '../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../utils/codeRulePage';
import type { Workstation, WorkstationCreate, WorkstationUpdate, ProductionLine } from '../types/factory';
import { SchemaFormRenderer } from '../../../components/schema-form';
import { workstationFormSchema } from '../schemas/workstation';

const PAGE_CODE = 'master-data-factory-workstation';

export interface WorkstationFormModalProps {
  open: boolean;
  onClose: () => void;
  editUuid: string | null;
  onSuccess: (workstation: Workstation) => void;
}

export const WorkstationFormModal: React.FC<WorkstationFormModalProps> = ({
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
  const [productionLines, setProductionLines] = useState<ProductionLine[]>([]);

  const isEdit = Boolean(editUuid);

  useEffect(() => {
    const loadProductionLines = async () => {
      try {
        const result = await productionLineApi.list({ limit: 1000, isActive: true });
        setProductionLines(result);
      } catch (error) {
        console.error('加载产线列表失败:', error);
      }
    };
    loadProductionLines();
  }, []);

  useEffect(() => {
    if (!open) return;
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ isActive: true });
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
      .then((detail) => {
        formRef.current?.setFieldsValue({
          code: detail.code,
          name: detail.name,
          productionLineId: detail.productionLineId,
          description: detail.description,
          isActive: detail.isActive ?? true,
        });
      })
      .catch((err: any) => {
        messageApi.error(err?.message || t('app.master-data.workstations.getDetailFailed'));
      });
  }, [open, editUuid]);

  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      if (isEdit && editUuid) {
        await workstationApi.update(editUuid, values as WorkstationUpdate);
        messageApi.success(t('common.updateSuccess'));
        const updated = await workstationApi.get(editUuid);
        onSuccess(updated);
      } else {
        const ruleCodeToUse = effectiveRuleCode || getPageRuleCode(PAGE_CODE);
        if (
          ruleCodeToUse &&
          (isAutoGenerateEnabled(PAGE_CODE) || effectiveRuleCode) &&
          (values.code === previewCode || !values.code)
        ) {
          try {
            const codeResponse = await generateCode({ rule_code: ruleCodeToUse });
            values.code = codeResponse.code;
          } catch {
            // keep form code
          }
        }
        if (values.isActive === undefined) {
          values.isActive = true;
        }
        const created = await workstationApi.create(values as WorkstationCreate);
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

  const optionsMap = {
    productionLineId: productionLines.map((p) => ({
      label: `${p.code} - ${p.name}`,
      value: p.id,
    })),
  };

  return (
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
    >
      <SchemaFormRenderer
        schema={workstationFormSchema}
        codeField="code"
        codeAutoGenerated={isAutoGenerateEnabled(PAGE_CODE)}
        codeAutoGeneratedKey="field.workstation.codeAutoGenerated"
        isEdit={isEdit}
        optionsMap={optionsMap}
      />
    </FormModalTemplate>
  );
};
