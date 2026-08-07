import React from 'react';
import KuaioaCrudListPage from '../../../components/KuaioaCrudListPage';
import {
  createComplianceLicense,
  deleteComplianceLicense,
  listComplianceLicenses,
  updateComplianceLicense,
} from '../../../services/licenses';

const LicensesPage: React.FC = () => (
  <KuaioaCrudListPage
    createButtonKey="app.kuaioa.license.createButton"
    resource="kuaioa:license"
    codeField="license_code"
    nameField="license_name"
    autoGenerateCode
    fields={[
      { name: 'license_code', labelKey: 'app.kuaioa.license.code', width: 140 },
      { name: 'license_name', labelKey: 'app.kuaioa.license.name', required: true, width: 200 },
      { name: 'license_type', labelKey: 'app.kuaioa.license.type', width: 120 },
      { name: 'holder_name', labelKey: 'app.kuaioa.license.holder', width: 120 },
      { name: 'expiry_date', labelKey: 'app.kuaioa.license.expiry', width: 120 },
      { name: 'status', labelKey: 'app.kuaioa.common.status', width: 100 },
      { name: 'issuing_authority', labelKey: 'app.kuaioa.license.authority', hideInTable: true },
      { name: 'notes', labelKey: 'app.kuaioa.common.notes', hideInTable: true, type: 'textarea' },
    ]}
    listFn={listComplianceLicenses}
    createFn={createComplianceLicense}
    updateFn={updateComplianceLicense}
    deleteFn={deleteComplianceLicense}
  />
);

export default LicensesPage;
