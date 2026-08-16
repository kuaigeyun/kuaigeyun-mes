import React from 'react';
import KuaioaCrudListPage from '../../../components/KuaioaCrudListPage';
import {
  createWorkLicense,
  deleteWorkLicense,
  listExpiringWorkLicenses,
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
    statusPresentation="marker"
    detailVariant="master"
    columnPersistenceId="apps.kuaioa.work-license.list-v4"
    fields={[
      { name: 'license_code', labelKey: 'app.kuaioa.workLicense.code', width: 140 },
      { name: 'license_name', labelKey: 'app.kuaioa.workLicense.name', required: true, width: 200 },
      { name: 'license_type', labelKey: 'app.kuaioa.workLicense.type', width: 120 },
      { name: 'holder_name', labelKey: 'app.kuaioa.workLicense.holder', width: 120 },
      { name: 'department_name', labelKey: 'app.kuaioa.common.department', width: 120, hideInTable: true },
      { name: 'issue_date', labelKey: 'app.kuaioa.workLicense.issueDate', width: 120, type: 'date', hideInTable: true },
      { name: 'expiry_date', labelKey: 'app.kuaioa.workLicense.expiry', width: 120, type: 'date' },
      { name: 'reminder_days', labelKey: 'app.kuaioa.common.reminderDays', width: 100, type: 'number', hideInTable: true },
      { name: 'status', labelKey: 'app.kuaioa.common.status', width: 100 },
      { name: 'notes', labelKey: 'app.kuaioa.common.notes', hideInTable: true, type: 'textarea' },
    ]}
    listFn={listWorkLicenses}
    expiringListFn={() => listExpiringWorkLicenses(30)}
    createFn={createWorkLicense}
    updateFn={updateWorkLicense}
    deleteFn={deleteWorkLicense}
  />
);

export default WorkLicensesPage;
