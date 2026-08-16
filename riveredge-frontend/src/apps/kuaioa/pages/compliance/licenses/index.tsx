import React from 'react';
import KuaioaCrudListPage from '../../../components/KuaioaCrudListPage';
import {
  createComplianceLicense,
  deleteComplianceLicense,
  getComplianceLicense,
  listComplianceLicenses,
  listExpiringLicenses,
  updateComplianceLicense,
} from '../../../services/licenses';

const LicensesPage: React.FC = () => (
  <KuaioaCrudListPage
    createButtonKey="app.kuaioa.license.createButton"
    resource="kuaioa:license"
    codeField="license_code"
    nameField="license_name"
    autoGenerateCode
    statusPresentation="marker"
    detailVariant="master"
    getDetailFn={getComplianceLicense}
    columnPersistenceId="apps.kuaioa.license.list-v4"
    fields={[
      { name: 'license_code', labelKey: 'app.kuaioa.license.code', width: 140 },
      { name: 'license_name', labelKey: 'app.kuaioa.license.name', required: true, width: 200 },
      { name: 'license_type', labelKey: 'app.kuaioa.license.type', width: 120 },
      { name: 'holder_name', labelKey: 'app.kuaioa.license.holder', width: 120 },
      { name: 'issue_date', labelKey: 'app.kuaioa.license.issueDate', width: 120, type: 'date', hideInTable: true },
      { name: 'expiry_date', labelKey: 'app.kuaioa.license.expiry', width: 120, type: 'date' },
      { name: 'reminder_days', labelKey: 'app.kuaioa.common.reminderDays', width: 100, type: 'number', hideInTable: true },
      { name: 'file_uuid', labelKey: 'app.kuaioa.license.attachment', type: 'file', hideInTable: true },
      { name: 'status', labelKey: 'app.kuaioa.common.status', width: 100 },
      { name: 'issuing_authority', labelKey: 'app.kuaioa.license.authority', hideInTable: true },
      { name: 'notes', labelKey: 'app.kuaioa.common.notes', hideInTable: true, type: 'textarea' },
    ]}
    listFn={listComplianceLicenses}
    expiringListFn={() => listExpiringLicenses(30)}
    createFn={createComplianceLicense}
    updateFn={updateComplianceLicense}
    deleteFn={deleteComplianceLicense}
  />
);

export default LicensesPage;
