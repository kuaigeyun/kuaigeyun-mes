import React, { useMemo } from 'react';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import KuaioaCrudListPage from '../../../components/KuaioaCrudListPage';
import { runKuaioaListExport } from '../../../utils/kuaioaListExport';
import { buildOaEmployeeStatusEnum } from '../../../utils/oaFormEnums';
import {
  createEmployee,
  deleteEmployee,
  getEmployee,
  listEmployees,
  updateEmployee,
} from '../../../services/employees';

const EmployeesPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();

  const employmentOptions = useMemo(
    () => [
      { label: t('app.kuaioa.employee.employmentType.formal'), value: 'formal' },
      { label: t('app.kuaioa.employee.employmentType.temp'), value: 'temp' },
    ],
    [t],
  );

  const payMethodOptions = useMemo(
    () => [
      { label: t('app.kuaioa.employee.payMethod.piece'), value: 'piece' },
      { label: t('app.kuaioa.employee.payMethod.time'), value: 'time' },
      { label: t('app.kuaioa.employee.payMethod.line'), value: 'line' },
    ],
    [t],
  );

  const statusOptions = useMemo(
    () => [
      { label: t('app.kuaioa.employee.status.active'), value: 'active' },
      { label: t('app.kuaioa.employee.status.left'), value: 'left' },
    ],
    [t],
  );

  const statusEnum = useMemo(() => buildOaEmployeeStatusEnum(t), [t]);

  const fields = useMemo(
    () => [
      { name: 'employee_code', labelKey: 'app.kuaioa.employee.code', width: 140 },
      {
        name: 'full_name',
        labelKey: 'app.kuaioa.employee.fullName',
        required: true,
        width: 120,
      },
      {
        name: 'department_name',
        labelKey: 'app.kuaioa.common.department',
        type: 'department' as const,
        width: 120,
      },
      {
        name: 'workshop_name',
        labelKey: 'app.kuaioa.employee.workshop',
        width: 120,
      },
      {
        name: 'production_line_name',
        labelKey: 'app.kuaioa.employee.productionLine',
        width: 100,
        hideInTable: true,
      },
      {
        name: 'employment_type',
        labelKey: 'app.kuaioa.employee.employmentType',
        type: 'select' as const,
        options: employmentOptions,
        required: true,
        width: 100,
      },
      {
        name: 'pay_method',
        labelKey: 'app.kuaioa.employee.payMethod',
        type: 'select' as const,
        options: payMethodOptions,
        required: true,
        width: 100,
      },
      { name: 'phone', labelKey: 'app.kuaioa.employee.phone', width: 120 },
      {
        name: 'hourly_rate',
        labelKey: 'app.kuaioa.employee.hourlyRate',
        type: 'number' as const,
        width: 100,
        hideInTable: true,
      },
      {
        name: 'hire_date',
        labelKey: 'app.kuaioa.employee.hireDate',
        type: 'date' as const,
        width: 120,
      },
      {
        name: 'leave_date',
        labelKey: 'app.kuaioa.employee.leaveDate',
        type: 'date' as const,
        width: 120,
        hideInTable: true,
      },
      {
        name: 'bank_account',
        labelKey: 'app.kuaioa.employee.bankAccount',
        width: 140,
        hideInTable: true,
      },
      {
        name: 'bank_name',
        labelKey: 'app.kuaioa.employee.bankName',
        width: 120,
        hideInTable: true,
      },
      {
        name: 'bank_branch',
        labelKey: 'app.kuaioa.employee.bankBranch',
        width: 160,
        hideInTable: true,
      },
      {
        name: 'living_allowance',
        labelKey: 'app.kuaioa.employee.livingAllowance',
        type: 'number' as const,
        width: 100,
        hideInTable: true,
      },
      {
        name: 'post_wage',
        labelKey: 'app.kuaioa.employee.postWage',
        type: 'number' as const,
        width: 100,
        hideInTable: true,
      },
      {
        name: 'social_insurance',
        labelKey: 'app.kuaioa.employee.socialInsurance',
        type: 'number' as const,
        width: 100,
        hideInTable: true,
      },
      {
        name: 'housing_fund',
        labelKey: 'app.kuaioa.employee.housingFund',
        type: 'number' as const,
        width: 100,
        hideInTable: true,
      },
      {
        name: 'rent_utility',
        labelKey: 'app.kuaioa.employee.rentUtility',
        type: 'number' as const,
        width: 100,
        hideInTable: true,
      },
      {
        name: 'welfare_dragon_boat',
        labelKey: 'app.kuaioa.employee.welfareDragonBoat',
        type: 'number' as const,
        hideInTable: true,
      },
      {
        name: 'welfare_mid_autumn',
        labelKey: 'app.kuaioa.employee.welfareMidAutumn',
        type: 'number' as const,
        hideInTable: true,
      },
      {
        name: 'welfare_spring_festival',
        labelKey: 'app.kuaioa.employee.welfareSpringFestival',
        type: 'number' as const,
        hideInTable: true,
      },
      {
        name: 'status',
        labelKey: 'common.status',
        type: 'select' as const,
        options: statusOptions,
        width: 100,
      },
      {
        name: 'notes',
        labelKey: 'common.remark',
        type: 'textarea' as const,
        hideInTable: true,
      },
    ],
    [employmentOptions, payMethodOptions, statusOptions],
  );

  return (
    <KuaioaCrudListPage
      createButtonKey="app.kuaioa.employee.createButton"
      resource="kuaioa:employee"
      codeField="employee_code"
      nameField="full_name"
      autoGenerateCode
      statusPresentation="marker"
      statusEnum={statusEnum}
      detailVariant="master"
      getDetailFn={getEmployee}
      columnPersistenceId="apps.kuaioa.employee.list-v2"
      fields={fields}
      listFn={listEmployees}
      createFn={createEmployee}
      updateFn={updateEmployee}
      deleteFn={deleteEmployee}
      showExportButton
      onExport={async (type, keys, pageData) => {
        await runKuaioaListExport({
          type,
          keys,
          pageData,
          listFn: listEmployees,
          columns: [
            { key: 'employee_code', title: t('app.kuaioa.employee.code') },
            { key: 'full_name', title: t('app.kuaioa.employee.fullName') },
            { key: 'workshop_name', title: t('app.kuaioa.attendance.workshop') },
            { key: 'hire_date', title: t('app.kuaioa.employee.hireDate') },
            { key: 'leave_date', title: t('app.kuaioa.employee.leaveDate') },
            { key: 'status', title: t('common.status') },
          ],
          filename: t('app.kuaioa.employee.exportFileName'),
          messageApi,
          noDataText: t('common.exportNoData'),
        });
      }}
    />
  );
};

export default EmployeesPage;
