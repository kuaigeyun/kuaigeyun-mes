import React, { useEffect, useMemo, useState } from 'react';
import { Descriptions, Divider } from 'antd';
import { useTranslation } from 'react-i18next';
import { MODAL_CONFIG } from '../../../../../components/layout-templates';
import KuaioaCrudListPage from '../../../components/KuaioaCrudListPage';
import FormRequestModalBody from '../../../components/FormRequestModalBody';
import {
  renderDynamicFieldReadonly,
  serializeDynamicFormValues,
  dynamicFormValuesFromRecord,
} from '../../../components/OaDynamicFormFields';
import {
  createFormRequest,
  deleteFormRequest,
  getFormRequest,
  listFormRequests,
  listFormTemplates,
  updateFormRequest,
  type FormTemplate,
} from '../../../services/forms';
import { normalizeFieldsSchema } from '../../../utils/oaFormSchema';
import { buildOaApprovalStatusEnum } from '../../../utils/oaFormEnums';

const FormRequestsPage: React.FC = () => {
  const { t } = useTranslation();
  const statusEnum = useMemo(() => buildOaApprovalStatusEnum(t), [t]);
  const [templates, setTemplates] = useState<FormTemplate[]>([]);

  useEffect(() => {
    void listFormTemplates().then((res) => setTemplates(res.items));
  }, []);

  const templateById = useMemo(
    () => new Map(templates.map((item) => [item.id, item])),
    [templates],
  );

  return (
    <KuaioaCrudListPage
      createButtonKey="app.kuaioa.formRequest.createButton"
      resource="kuaioa:form-request"
      codeField="request_code"
      nameField="title"
      autoGenerateCode
      modalWidth={MODAL_CONFIG.STANDARD_WIDTH}
      statusEnum={statusEnum}
      statusPresentation="lifecycle"
      detailVariant="approval"
      getDetailFn={getFormRequest}
      auditWorkflow={{
        entityType: 'kuaioa_form_request',
        resourcePrefix: 'kuaioa:form-request',
        auditNodeKey: 'kuaioa_form_request',
        entityNameKey: 'app.kuaioa.formRequest.entityName',
      }}
      fields={[
        { name: 'request_code', labelKey: 'app.kuaioa.formRequest.code', width: 150 },
        { name: 'title', labelKey: 'app.kuaioa.formRequest.title', required: true, width: 200 },
        { name: 'template_code', labelKey: 'app.kuaioa.formTemplate.code', width: 120 },
        { name: 'applicant_name', labelKey: 'app.kuaioa.common.applicant', width: 100 },
        { name: 'department_name', labelKey: 'app.kuaioa.common.department', hideInTable: true },
        { name: 'status', labelKey: 'common.status', width: 100 },
        { name: 'notes', labelKey: 'common.remark', hideInTable: true, type: 'textarea' },
      ]}
      listFn={listFormRequests}
      createFn={createFormRequest}
      updateFn={updateFormRequest}
      deleteFn={deleteFormRequest}
      mapRecordToFormValues={(record) => {
        const template = templateById.get(Number(record.template_id));
        const schema = normalizeFieldsSchema(template?.fields_schema);
        return {
          template_id: record.template_id ?? undefined,
          title: record.title,
          department_name: record.department_name,
          notes: record.notes,
          ...dynamicFormValuesFromRecord(schema, record),
        };
      }}
      mapFormValuesToPayload={(values) => {
        const template = templateById.get(Number(values.template_id));
        const schema = normalizeFieldsSchema(template?.fields_schema);
        return {
          template_id: values.template_id,
          title: values.title,
          department_name: values.department_name,
          notes: values.notes,
          form_data: serializeDynamicFormValues(schema, values),
        };
      }}
      renderModalBody={(form, editing) => (
        <FormRequestModalBody form={form} editing={editing} templates={templates} />
      )}
      renderDetailExtra={(record) => {
        const template = templateById.get(Number(record.template_id));
        const schema = normalizeFieldsSchema(template?.fields_schema);
        if (!schema.length) return null;
        const formData =
          record.form_data && typeof record.form_data === 'object'
            ? (record.form_data as Record<string, unknown>)
            : {};
        return (
          <>
            <Divider orientation="horizontal">{t('app.kuaioa.formRequest.formData')}</Divider>
            <Descriptions
              column={2}
              size="small"
              items={schema.map((field) => ({
                key: field.name,
                label: field.label,
                children: renderDynamicFieldReadonly(field, formData[field.name]),
              }))}
            />
          </>
        );
      }}
    />
  );
};

export default FormRequestsPage;
