import React, { useCallback } from 'react';
import { FormOutlined } from '@ant-design/icons';
import { Descriptions, Divider } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { MODAL_CONFIG } from '../../../../../components/layout-templates';
import KuaioaCrudListPage from '../../../components/KuaioaCrudListPage';
import FormTemplateModalBody from '../../../components/FormTemplateModalBody';
import {
  createFormTemplate,
  deleteFormTemplate,
  listFormTemplates,
  updateFormTemplate,
} from '../../../services/forms';
import { normalizeFieldsSchema } from '../../../utils/oaFormSchema';

const designerPath = (id: number | string) =>
  `/apps/kuaioa/approval/form-templates/designer?id=${id}`;

const FormTemplatesPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const openDesigner = useCallback(
    (record: Record<string, unknown>) => {
      if (record.id == null) return;
      navigate(designerPath(record.id));
    },
    [navigate],
  );

  return (
    <KuaioaCrudListPage
      createButtonKey="app.kuaioa.formTemplate.createButton"
      resource="kuaioa:form-template"
      codeField="template_code"
      nameField="template_name"
      modalWidth={MODAL_CONFIG.STANDARD_WIDTH}
      modalGrid={false}
      fields={[
        { name: 'template_code', labelKey: 'app.kuaioa.formTemplate.code', required: true, width: 140 },
        { name: 'template_name', labelKey: 'app.kuaioa.formTemplate.name', required: true, width: 180 },
        {
          name: 'category',
          labelKey: 'app.kuaioa.formTemplate.category',
          width: 120,
          type: 'select',
          options: [{ label: t('app.kuaioa.formTemplate.category.general'), value: 'general' }],
        },
        {
          name: 'show_in_menu',
          labelKey: 'app.kuaioa.formTemplate.showInMenu',
          width: 100,
          type: 'switch',
        },
        { name: 'description', labelKey: 'common.remark', hideInTable: true, type: 'textarea' },
        { name: 'is_active', labelKey: 'common.enabled', type: 'switch' },
      ]}
      listFn={listFormTemplates}
      createFn={createFormTemplate}
      updateFn={updateFormTemplate}
      deleteFn={deleteFormTemplate}
      onCreateSuccess={openDesigner}
      createFormDefaults={{ category: 'general', is_active: true, show_in_menu: false }}
      extraActions={[
        {
          key: 'design',
          labelKey: 'app.kuaioa.formTemplate.designAction',
          icon: <FormOutlined />,
          requireUpdate: true,
          deferSuccess: true,
          onClick: async (record) => {
            openDesigner(record);
          },
        },
      ]}
      columnPersistenceId="apps.kuaioa.form-template.list-v3"
      renderModalBody={(form, editing) => (
        <FormTemplateModalBody form={form} editing={editing} />
      )}
      renderDetailExtra={(record) => {
        const schema = normalizeFieldsSchema(record.fields_schema);
        if (!schema.length) return null;
        return (
          <>
            <Divider orientation="horizontal">{t('app.kuaioa.formSchema.title')}</Divider>
            <Descriptions
              column={2}
              size="small"
              items={schema.map((field) => ({
                key: field.name,
                label: field.label,
                children: field.type,
              }))}
            />
          </>
        );
      }}
    />
  );
};

export default FormTemplatesPage;
