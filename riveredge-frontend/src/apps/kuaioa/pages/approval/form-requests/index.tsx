import React from 'react';
import KuaioaCrudListPage from '../../../components/KuaioaCrudListPage';
import {
  createFormRequest,
  deleteFormRequest,
  listFormRequests,
  revokeFormRequest,
  submitFormRequest,
  updateFormRequest,
} from '../../../services/forms';

const STATUS_ENUM = {
  draft: { text: '草稿', status: 'Default' },
  pending: { text: '待审批', status: 'Processing' },
  approved: { text: '已通过', status: 'Success' },
  rejected: { text: '已驳回', status: 'Error' },
  cancelled: { text: '已撤销', status: 'Warning' },
};

const FormRequestsPage: React.FC = () => (
  <KuaioaCrudListPage
    createButtonKey="app.kuaioa.formRequest.createButton"
    resource="kuaioa:form-request"
    codeField="request_code"
    nameField="title"
    autoGenerateCode
    statusEnum={STATUS_ENUM}
    statusPresentation="lifecycle"
    fields={[
      { name: 'request_code', labelKey: 'app.kuaioa.formRequest.code', width: 150 },
      { name: 'title', labelKey: 'app.kuaioa.formRequest.title', required: true, width: 200 },
      { name: 'template_code', labelKey: 'app.kuaioa.formTemplate.code', width: 120 },
      { name: 'applicant_name', labelKey: 'app.kuaioa.common.applicant', width: 100 },
      { name: 'department_name', labelKey: 'app.kuaioa.common.department', hideInTable: true },
      { name: 'status', labelKey: 'app.kuaioa.common.status', width: 100 },
      { name: 'notes', labelKey: 'app.kuaioa.common.notes', hideInTable: true, type: 'textarea' },
    ]}
    listFn={listFormRequests}
    createFn={createFormRequest}
    updateFn={updateFormRequest}
    deleteFn={deleteFormRequest}
    extraActions={[
      {
        key: 'submit',
        labelKey: 'app.kuaioa.common.submit',
        visible: (r) => r.status === 'draft' || r.status === 'rejected',
        onClick: async (r) => {
          await submitFormRequest(Number(r.id));
        },
      },
      {
        key: 'revoke',
        labelKey: 'app.kuaioa.common.revoke',
        visible: (r) => r.status === 'pending',
        onClick: async (r) => {
          await revokeFormRequest(Number(r.id));
        },
      },
    ]}
  />
);

export default FormRequestsPage;
