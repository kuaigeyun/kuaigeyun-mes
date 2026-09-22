import React, { useEffect, useMemo, useState } from 'react';
import KuaioaCrudListPage from '../../../components/KuaioaCrudListPage';
import { useCurrentUser } from '../../../../../hooks/useCurrentUser';
import { listEmployees } from '../../../services/employees';
import {
  createLivingAdvance,
  deleteLivingAdvance,
  getLivingAdvance,
  listLivingAdvances,
  updateLivingAdvance,
} from '../../../services/payroll';

type EmpSnap = {
  bank_name: string;
  bank_account: string;
  workshop_name: string;
  base_living: number;
};

const LivingAdvancesPage: React.FC = () => {
  const currentUser = useCurrentUser();
  const [employeeOptions, setEmployeeOptions] = useState<Array<{ label: string; value: number }>>(
    [],
  );
  const [empSnap, setEmpSnap] = useState<Record<number, EmpSnap>>({});

  const registrarName = useMemo(() => {
    if (!currentUser) return '';
    return String(currentUser.full_name || currentUser.username || '');
  }, [currentUser]);

  useEffect(() => {
    void (async () => {
      const res = await listEmployees({ status: 'active' });
      setEmployeeOptions(
        res.items.map((e) => ({
          label: `${e.employee_code || ''} ${e.full_name}`.trim(),
          value: Number(e.id),
        })),
      );
      const map: Record<number, EmpSnap> = {};
      for (const e of res.items) {
        map[Number(e.id)] = {
          bank_name: String(e.bank_name || ''),
          bank_account: String(e.bank_account || ''),
          workshop_name: String(e.workshop_name || ''),
          base_living: Number(e.living_allowance || 0),
        };
      }
      setEmpSnap(map);
    })();
  }, []);

  const fillExcelFields = (
    form: { setFieldsValue: (v: Record<string, unknown>) => void },
    eid: number,
    amount?: number,
  ) => {
    const snap = empSnap[eid];
    const fixed = snap?.base_living ?? 0;
    const adv = amount ?? 0;
    form.setFieldsValue({
      bank_name: snap?.bank_name || '',
      bank_account: snap?.bank_account || '',
      workshop_name: snap?.workshop_name || '',
      base_living: fixed,
      payout_amount: fixed + adv,
      registrar_name: registrarName,
    });
  };

  const fields = useMemo(
    () => [
      { name: 'advance_code', labelKey: 'app.kuaioa.livingAdvance.code', width: 140 },
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
      {
        name: 'employee_name',
        labelKey: 'app.kuaioa.employee.fullName',
        width: 100,
        hideInForm: true,
      },
      {
        name: 'bank_name',
        labelKey: 'app.kuaioa.livingPayout.bank',
        hideInTable: true,
      },
      {
        name: 'bank_account',
        labelKey: 'app.kuaioa.employee.bankAccount',
        hideInTable: true,
      },
      {
        name: 'workshop_name',
        labelKey: 'app.kuaioa.attendance.workshop',
        width: 120,
      },
      {
        name: 'base_living',
        labelKey: 'app.kuaioa.livingPayout.fixedAmount',
        type: 'number' as const,
        width: 100,
      },
      {
        name: 'amount',
        labelKey: 'app.kuaioa.livingPayout.advanceAmount',
        type: 'number' as const,
        required: true,
        width: 100,
      },
      {
        name: 'payout_amount',
        labelKey: 'app.kuaioa.livingPayout.payout',
        type: 'number' as const,
        hideInTable: true,
      },
      {
        name: 'registrar_name',
        labelKey: 'app.kuaioa.livingAdvance.registrar',
        hideInTable: true,
      },
      {
        name: 'created_by_name',
        labelKey: 'app.kuaioa.livingAdvance.registrar',
        width: 100,
        hideInForm: true,
      },
      { name: 'status', labelKey: 'common.status', width: 90, hideInForm: true },
    ],
    [employeeOptions],
  );

  return (
    <KuaioaCrudListPage
      createButtonKey="app.kuaioa.livingAdvance.createButton"
      resource="kuaioa:living-advance"
      codeField="advance_code"
      nameField="employee_name"
      autoGenerateCode
      statusPresentation="marker"
      detailVariant="master"
      getDetailFn={getLivingAdvance}
      columnPersistenceId="apps.kuaioa.living-advance.list-v3"
      fields={fields}
      listFn={listLivingAdvances}
      createFn={createLivingAdvance}
      updateFn={updateLivingAdvance}
      deleteFn={deleteLivingAdvance}
      onFormValuesChange={(changed, allValues, form) => {
        if ('employee_id' in changed && changed.employee_id != null) {
          fillExcelFields(form, Number(changed.employee_id), Number(allValues.amount || 0));
          return;
        }
        if ('amount' in changed || 'base_living' in changed) {
          const fixed = Number(
            ('base_living' in changed ? changed.base_living : allValues.base_living) || 0,
          );
          const adv = Number(('amount' in changed ? changed.amount : allValues.amount) || 0);
          form.setFieldValue('payout_amount', fixed + adv);
        }
        if (!allValues.registrar_name && registrarName) {
          form.setFieldValue('registrar_name', registrarName);
        }
      }}
      mapRecordToFormValues={(record) => {
        const eid = Number(record.employee_id);
        const snap = empSnap[eid];
        const fixed = Number(record.base_living ?? snap?.base_living ?? 0);
        const adv = Number(record.amount || 0);
        return {
          ...record,
          bank_name: snap?.bank_name || '',
          bank_account: snap?.bank_account || '',
          workshop_name: record.workshop_name || snap?.workshop_name || '',
          base_living: fixed,
          payout_amount: fixed + adv,
          registrar_name: String(record.created_by_name || registrarName),
        };
      }}
      mapFormValuesToPayload={(values) => {
        const {
          payout_amount: _p,
          registrar_name: _r,
          employee_name: _n,
          created_by_name: _c,
          advance_code: _code,
          status: _s,
          ...rest
        } = values;
        return rest;
      }}
    />
  );
};

export default LivingAdvancesPage;
