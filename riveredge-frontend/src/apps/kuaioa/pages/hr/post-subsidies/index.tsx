import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import KuaioaCrudListPage from '../../../components/KuaioaCrudListPage';
import { listEmployees } from '../../../services/employees';
import { loadOaWorkshopNameOptions } from '../../../utils/oaWorkshopOptions';
import {
  createPostSubsidy,
  deletePostSubsidy,
  getPostSubsidy,
  listPostSubsidies,
  updatePostSubsidy,
} from '../../../services/postSubsidy';

const PostSubsidiesPage: React.FC = () => {
  const { t } = useTranslation();
  const [employeeOptions, setEmployeeOptions] = useState<Array<{ label: string; value: number }>>(
    [],
  );
  const [workshopOptions, setWorkshopOptions] = useState<Array<{ label: string; value: string }>>(
    [],
  );
  const [employeeWorkshop, setEmployeeWorkshop] = useState<Record<number, string>>({});

  useEffect(() => {
    void (async () => {
      const [emps, workshops] = await Promise.all([
        listEmployees({ status: 'active' }),
        loadOaWorkshopNameOptions(),
      ]);
      setWorkshopOptions(workshops);
      setEmployeeOptions(
        emps.items.map((e) => ({
          label: `${e.employee_code || ''} ${e.full_name}`.trim(),
          value: Number(e.id),
        })),
      );
      const map: Record<number, string> = {};
      for (const e of emps.items) {
        if (e.workshop_name) map[Number(e.id)] = String(e.workshop_name);
      }
      setEmployeeWorkshop(map);
    })();
  }, []);

  const itemOptions = useMemo(
    () => [
      {
        label: t('app.kuaioa.payroll.nightSubsidy'),
        value: t('app.kuaioa.payroll.nightSubsidy'),
      },
      {
        label: t('app.kuaioa.payroll.heatSubsidy'),
        value: t('app.kuaioa.payroll.heatSubsidy'),
      },
      {
        label: t('app.kuaioa.payroll.postAllowance'),
        value: t('app.kuaioa.payroll.postAllowance'),
      },
    ],
    [t],
  );

  const fields = useMemo(
    () => [
      { name: 'subsidy_code', labelKey: 'app.kuaioa.postSubsidy.code', width: 140 },
      {
        name: 'year_month',
        labelKey: 'app.kuaioa.payroll.yearMonth',
        type: 'month' as const,
        required: true,
        width: 100,
      },
      {
        name: 'employee_id',
        labelKey: 'app.kuaioa.employee.fullName',
        type: 'select' as const,
        options: employeeOptions,
        required: true,
        hideInTable: true,
      },
      { name: 'employee_name', labelKey: 'app.kuaioa.employee.fullName', width: 120, hideInForm: true },
      {
        name: 'workshop_name',
        labelKey: 'app.kuaioa.attendance.workshop',
        type: 'select' as const,
        options: workshopOptions,
        readonly: true,
        width: 120,
      },
      {
        name: 'item_name',
        labelKey: 'app.kuaioa.postSubsidy.itemName',
        type: 'select' as const,
        options: itemOptions,
        required: true,
        width: 140,
      },
      {
        name: 'amount',
        labelKey: 'app.kuaioa.postSubsidy.amount',
        type: 'number' as const,
        required: true,
        width: 100,
      },
      { name: 'notes', labelKey: 'common.remark', type: 'textarea' as const, hideInTable: true },
    ],
    [employeeOptions, itemOptions, workshopOptions],
  );

  return (
    <KuaioaCrudListPage
      createButtonKey="app.kuaioa.postSubsidy.createButton"
      resource="kuaioa:post-subsidy"
      codeField="subsidy_code"
      nameField="employee_name"
      autoGenerateCode
      statusPresentation="marker"
      detailVariant="master"
      getDetailFn={getPostSubsidy}
      columnPersistenceId="apps.kuaioa.post-subsidy.list-v2"
      fields={fields}
      listFn={listPostSubsidies}
      createFn={createPostSubsidy}
      updateFn={updatePostSubsidy}
      deleteFn={deletePostSubsidy}
      onFormValuesChange={(changed, _all, form) => {
        if ('employee_id' in changed) {
          const ws = employeeWorkshop[Number(changed.employee_id)];
          form.setFieldValue('workshop_name', ws || undefined);
        }
      }}
      mapFormValuesToPayload={(values) => {
        const { workshop_name: _w, employee_name: _n, subsidy_code: _c, ...rest } = values;
        return rest;
      }}
    />
  );
};

export default PostSubsidiesPage;
