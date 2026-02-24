/**
 * 车间新建/编辑弹窗
 */

import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ProFormInstance, ProFormText, ProFormTextArea, ProFormSwitch, ProFormDigit, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Divider, Typography } from 'antd';
import SafeProFormSelect from '../../../components/safe-pro-form-select';
import { FormModalTemplate } from '../../../components/layout-templates';
import { MODAL_CONFIG } from '../../../components/layout-templates/constants';
import { workshopApi, plantApi } from '../services/factory';
import { testGenerateCode, generateCode } from '../../../services/codeRule';
import { getCodeRulePageConfig } from '../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../utils/codeRulePage';
import { getCustomFieldsByTable, getFieldValues, batchSetFieldValues, CustomField } from '../../../services/customField';
import type { Workshop, WorkshopCreate, WorkshopUpdate, Plant } from '../types/factory';
import { SchemaFormRenderer } from '../../../components/schema-form';
import { workshopFormSchema } from '../schemas/workshop';

const PAGE_CODE = 'master-data-factory-workshop';
const CUSTOM_FIELD_TABLE = 'master_data_factory_workshops';

const safeOptions = (options: any): any[] => {
  if (Array.isArray(options)) return options;
  return [];
};

export interface WorkshopFormModalProps {
  open: boolean;
  onClose: () => void;
  editUuid: string | null;
  onSuccess: (workshop: Workshop) => void;
}

export const WorkshopFormModal: React.FC<WorkshopFormModalProps> = ({
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
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [plantOptions, setPlantOptions] = useState<Array<{ label: string; value: number }>>([]);

  const isEdit = Boolean(editUuid);

  useEffect(() => {
    if (!open) return;
    const loadPlants = async () => {
      try {
        const list = await plantApi.list({ isActive: true });
        setPlantOptions(list.map((p) => ({ label: `${p.code} - ${p.name}`, value: p.id })));
      } catch (e) {
        console.error('加载厂区列表失败:', e);
      }
    };
    const loadCustomFields = async () => {
      try {
        const fields = await getCustomFieldsByTable(CUSTOM_FIELD_TABLE, true).catch((err) => {
          if (err?.response?.status === 401) return [];
          throw err;
        });
        setCustomFields(fields);
      } catch (e) {
        console.error('加载自定义字段失败:', e);
      }
    };
    loadPlants();
    loadCustomFields();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ isActive: true });
    setCustomFieldValues({});

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
        try {
          const fieldValues = await getFieldValues(CUSTOM_FIELD_TABLE, detail.id);
          setCustomFieldValues(fieldValues);
          Object.keys(fieldValues).forEach((fieldCode) => {
            formRef.current?.setFieldValue(`custom_${fieldCode}`, fieldValues[fieldCode]);
          });
        } catch (e) {
          console.error('加载自定义字段值失败:', e);
        }
      })
      .catch((err: any) => {
        messageApi.error(err?.message || t('app.master-data.workshops.getDetailFailed'));
      });
  }, [open, editUuid]);

  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      const customFieldData: Record<string, any> = {};
      const standardValues: any = {};
      Object.keys(values).forEach((key) => {
        if (key.startsWith('custom_')) {
          customFieldData[key.replace('custom_', '')] = values[key];
        } else {
          standardValues[key] = values[key];
        }
      });

      let workshopId: number;
      if (isEdit && editUuid) {
        const updated = await workshopApi.update(editUuid, standardValues as WorkshopUpdate);
        workshopId = updated.id;
        messageApi.success(t('common.updateSuccess'));
        const detail = await workshopApi.get(editUuid);
        onSuccess(detail);
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
        workshopId = created.id;
        messageApi.success(t('common.createSuccess'));
        onSuccess(created);
      }

      if (Object.keys(customFieldData).length > 0) {
        try {
          const fieldValues = Object.keys(customFieldData)
            .map((fieldCode) => {
              const field = customFields.find((f) => f.code === fieldCode);
              return field ? { field_uuid: field.uuid, value: customFieldData[fieldCode] } : null;
            })
            .filter(Boolean);
          if (fieldValues.length > 0) {
            await batchSetFieldValues({
              record_id: workshopId,
              record_table: CUSTOM_FIELD_TABLE,
              values: fieldValues as any[],
            });
          }
        } catch (e) {
          console.error('保存自定义字段值失败:', e);
        }
      }

      onClose();
      formRef.current?.resetFields();
      setPreviewCode(null);
      setEffectiveRuleCode(null);
      setCustomFieldValues({});
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
    setCustomFieldValues({});
  };

  const optionsMap = { plantId: plantOptions };

  const renderCustomFields = () => {
    if (customFields.length === 0) return null;
    return customFields
      .filter((field) => field.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((field) => {
        const fieldName = `custom_${field.code}`;
        const label = field.label || field.name;
        const placeholder = field.placeholder || `请输入${label}`;
        switch (field.field_type) {
          case 'text':
            return (
              <ProFormText
                key={field.uuid}
                name={fieldName}
                label={label}
                placeholder={placeholder}
                colProps={{ span: 12 }}
                rules={field.is_required ? [{ required: true, message: `请输入${label}` }] : []}
                fieldProps={{ maxLength: field.config?.maxLength }}
                initialValue={customFieldValues[field.code] ?? field.config?.default}
              />
            );
          case 'number':
            return (
              <ProFormDigit
                key={field.uuid}
                name={fieldName}
                label={label}
                placeholder={placeholder}
                colProps={{ span: 12 }}
                rules={field.is_required ? [{ required: true, message: `请输入${label}` }] : []}
                fieldProps={{ min: field.config?.min, max: field.config?.max }}
                initialValue={customFieldValues[field.code] ?? field.config?.default}
              />
            );
          case 'date':
            return (
              <ProFormDatePicker
                key={field.uuid}
                name={fieldName}
                label={label}
                placeholder={placeholder}
                colProps={{ span: 12 }}
                rules={field.is_required ? [{ required: true, message: `请选择${label}` }] : []}
                fieldProps={{ format: field.config?.format || 'YYYY-MM-DD' }}
                initialValue={customFieldValues[field.code] ?? field.config?.default}
              />
            );
          case 'select':
            return (
              <SafeProFormSelect
                key={`${field.uuid}-${JSON.stringify(safeOptions(field.config?.options))}`}
                name={fieldName}
                label={label}
                placeholder={placeholder}
                colProps={{ span: 12 }}
                rules={field.is_required ? [{ required: true, message: `请选择${label}` }] : []}
                options={safeOptions(field.config?.options)}
                initialValue={customFieldValues[field.code] ?? field.config?.default}
              />
            );
          case 'textarea':
            return (
              <ProFormTextArea
                key={field.uuid}
                name={fieldName}
                label={label}
                placeholder={placeholder}
                colProps={{ span: 24 }}
                rules={field.is_required ? [{ required: true, message: `请输入${label}` }] : []}
                fieldProps={{ rows: field.config?.rows || 4 }}
                initialValue={customFieldValues[field.code] ?? field.config?.default}
              />
            );
          default:
            return (
              <ProFormText
                key={field.uuid}
                name={fieldName}
                label={label}
                placeholder={placeholder}
                colProps={{ span: 12 }}
                rules={field.is_required ? [{ required: true, message: `请输入${label}` }] : []}
                initialValue={customFieldValues[field.code] ?? field.config?.default}
              />
            );
        }
      });
  };

  return (
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
    >
      <SchemaFormRenderer
        schema={workshopFormSchema}
        codeField="code"
        codeAutoGenerated={isAutoGenerateEnabled(PAGE_CODE)}
        codeAutoGeneratedKey="field.workshop.codeAutoGenerated"
        isEdit={isEdit}
        optionsMap={optionsMap}
      />
      {customFields.length > 0 && (
        <>
          <div style={{ gridColumn: 'span 24', marginTop: 16, marginBottom: 8, width: '100%' }}>
            <Divider style={{ margin: 0, fontSize: 12 }}>
              <Typography.Text type="secondary" style={{ fontSize: 12, padding: '0 8px' }}>
                {t('app.master-data.customFields')}
              </Typography.Text>
            </Divider>
          </div>
          {renderCustomFields()}
        </>
      )}
    </FormModalTemplate>
  );
};
