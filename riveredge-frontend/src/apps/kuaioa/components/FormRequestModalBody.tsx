import React, { useEffect, useMemo } from 'react';
import { Form } from 'antd';
import type { FormInstance } from 'antd';
import { ProForm, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import type { FormTemplate } from '../services/forms';
import OaDynamicFormFields from './OaDynamicFormFields';
import { OaDepartmentSelect } from './OaLookupField';
import { normalizeFieldsSchema } from '../utils/oaFormSchema';

type Props = {
  form: FormInstance;
  editing: Record<string, unknown> | null;
  templates: FormTemplate[];
  hideTemplateSelect?: boolean;
  fixedTemplateId?: number;
};

const FormRequestModalBody: React.FC<Props> = ({
  form,
  editing,
  templates,
  hideTemplateSelect = false,
  fixedTemplateId,
}) => {
  const { t } = useTranslation();
  const templateId = Form.useWatch('template_id', form);

  const activeTemplates = useMemo(
    () => templates.filter((item) => item.is_active !== false),
    [templates],
  );

  const selectedTemplate = useMemo(() => {
    const id = fixedTemplateId ?? templateId;
    return activeTemplates.find((item) => item.id === id);
  }, [activeTemplates, fixedTemplateId, templateId]);

  useEffect(() => {
    if (fixedTemplateId != null) {
      form.setFieldValue('template_id', fixedTemplateId);
    }
  }, [fixedTemplateId, form]);

  const schema = useMemo(
    () => normalizeFieldsSchema(selectedTemplate?.fields_schema),
    [selectedTemplate],
  );

  const templateLocked = Boolean(editing?.id);

  return (
    <>
      {!hideTemplateSelect ? (
        <ProFormSelect
          name="template_id"
          label={t('app.kuaioa.formRequest.template')}
          rules={[{ required: true, message: t('app.kuaioa.common.required') }]}
          colProps={{ span: 12 }}
          disabled={templateLocked}
          placeholder={t('app.kuaioa.formRequest.templatePlaceholder')}
          options={activeTemplates.map((item) => ({
            label: `${item.template_name} (${item.template_code})`,
            value: item.id,
          }))}
        />
      ) : (
        <ProForm.Item name="template_id" hidden>
          <input type="hidden" />
        </ProForm.Item>
      )}
      <ProFormText
        name="title"
        label={t('app.kuaioa.formRequest.title')}
        rules={[{ required: true, message: t('app.kuaioa.common.required') }]}
        colProps={{ span: 12 }}
      />
      <OaDepartmentSelect
        name="department_name"
        label={t('app.kuaioa.common.department')}
        colProps={{ span: 12 }}
      />
      {schema.length > 0 ? (
        <OaDynamicFormFields
          schema={schema}
          disabled={templateLocked && editing?.status !== 'draft' && editing?.status !== 'rejected'}
        />
      ) : (fixedTemplateId ?? templateId) ? (
        <ProForm.Item label={t('app.kuaioa.formSchema.title')} colProps={{ span: 24 }}>
          <span style={{ color: 'rgba(0,0,0,0.45)' }}>{t('app.kuaioa.formSchema.empty')}</span>
        </ProForm.Item>
      ) : null}
      <ProFormTextArea name="notes" label={t('app.kuaioa.common.notes')} colProps={{ span: 24 }} fieldProps={{ rows: 2 }} />
    </>
  );
};

export default FormRequestModalBody;
