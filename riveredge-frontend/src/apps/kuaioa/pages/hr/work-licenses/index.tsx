import React from 'react';
import KuaioaCrudListPage from '../../../components/KuaioaCrudListPage';
import {
  createWorkLicense,
  deleteWorkLicense,
  listWorkLicenses,
  updateWorkLicense,
} from '../../../services/training';

const WorkLicensesPage: React.FC = () => (
  <KuaioaCrudListPage
    createButtonKey="app.kuaioa.workLicense.createButton"
    resource="kuaioa:work-license"
    codeField="license_code"
    nameField="license_name"
    autoGenerateCode
    fields={[
      { name: 'license_code', labelKey: 'app.kuaioa.workLicense.code', width: 140 },
      { name: 'license_name', labelKey: 'app.kuaioa.workLicense.name', required: true, width: 200 },
      { name: 'holder_name', labelKey: 'app.kuaioa.workLicense.holder', width: 120 },
      { name: 'expiry_date', labelKey: 'app.kuaioa.workLicense.expiry', width: 120 },
      { name: 'status', labelKey: 'app.kuaioa.common.status', width: 100 },
    ]}
    listFn={listWorkLicenses}
    createFn={createWorkLicense}
    updateFn={updateWorkLicense}
    deleteFn={deleteWorkLicense}
  />
);

export default WorkLicensesPage;
