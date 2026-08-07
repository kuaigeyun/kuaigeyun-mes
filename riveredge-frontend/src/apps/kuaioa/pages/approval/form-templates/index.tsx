import React from 'react';
import KuaioaCrudListPage from '../../../components/KuaioaCrudListPage';
import {
  createFormTemplate,
  deleteFormTemplate,
  listFormTemplates,
  updateFormTemplate,
} from '../../../services/forms';

const FormTemplatesPage: React.FC = () => (
  <KuaioaCrudListPage
    createButtonKey="app.kuaioa.formTemplate.createButton"
    resource="kuaioa:form-template"
    codeField="template_code"
    nameField="template_name"
    fields={[
      { name: 'template_code', labelKey: 'app.kuaioa.formTemplate.code', required: true, width: 140 },
      { name: 'template_name', labelKey: 'app.kuaioa.formTemplate.name', required: true, width: 180 },
      { name: 'category', labelKey: 'app.kuaioa.formTemplate.category', width: 120 },
      { name: 'description', labelKey: 'app.kuaioa.common.description', hideInTable: true, type: 'textarea' },
      { name: 'is_active', labelKey: 'app.kuaioa.common.enabled', type: 'switch' },
    ]}
    listFn={listFormTemplates}
    createFn={createFormTemplate}
    updateFn={updateFormTemplate}
    deleteFn={deleteFormTemplate}
  />
);

export default FormTemplatesPage;
