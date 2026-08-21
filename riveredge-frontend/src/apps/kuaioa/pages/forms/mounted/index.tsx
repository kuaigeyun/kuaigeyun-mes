import React, { useEffect, useMemo, useState } from 'react';
import { Result, Spin } from 'antd';
import { Descriptions, Divider } from 'antd';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
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
  getFormTemplateByCode,
  listFormRequests,
  updateFormRequest,
  type FormTemplate,
} from '../../../services/forms';
import { normalizeFieldsSchema } from '../../../utils/oaFormSchema';
import { buildOaApprovalStatusEnum } from '../../../utils/oaFormEnums';

const MountedFormRequestsPage: React.FC = () => {
  const { t } = useTranslation();
  const { templateCode = '' } = useParams<{ templateCode: string }>();
  const statusEnum = useMemo(() => buildOaApprovalStatusEnum(t), [t]);
  const [template, setTemplate] = useState<FormTemplate | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!templateCode) return;
    void getFormTemplateByCode(templateCode)
      .then((row) => {
        setTemplate(row);
        setLoadError(null);
      })
      .catch((error: { message?: string }) => {
        setTemplate(null);
        setLoadError(error?.message || t('common.operationFailed'));
      });
  }, [t, templateCode]);

  const schema = useMemo(
    () => normalizeFieldsSchema(template?.fields_schema),
    [template?.fields_schema],
  );

  if (loadError) {
    return <Result status="404" title={loadError} />;
  }

  if (!template) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spin description={t('app.kuaioa.common.loading')} />
      </div>
    );
  }

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
        { name: 'applicant_name', labelKey: 'app.kuaioa.common.applicant', width: 100 },
        { name: 'department_name', labelKey: 'app.kuaioa.common.department', hideInTable: true },
        { name: 'status', labelKey: 'common.status', width: 100 },
        { name: 'notes', labelKey: 'common.remark', hideInTable: true, type: 'textarea' },
      ]}
      listFn={(params) =>
        listFormRequests({
          ...params,
          template_id: template.id,
        })
      }
      createFn={createFormRequest}
      updateFn={updateFormRequest}
      deleteFn={deleteFormRequest}
      mapRecordToFormValues={(record) => ({
        template_id: template.id,
        title: record.title,
        department_name: record.department_name,
        notes: record.notes,
        ...dynamicFormValuesFromRecord(schema, record),
      })}
      mapFormValuesToPayload={(values) => ({
        template_id: template.id,
        title: values.title,
        department_name: values.department_name,
        notes: values.notes,
        form_data: serializeDynamicFormValues(schema, values),
      })}
      renderModalBody={(form, editing) => (
        <FormRequestModalBody
          form={form}
          editing={editing}
          templates={[template]}
          hideTemplateSelect
          fixedTemplateId={template.id}
        />
      )}
      renderDetailExtra={(record) => {
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

export default MountedFormRequestsPage;
