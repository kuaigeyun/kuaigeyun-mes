import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import KuaioaCrudListPage from '../../../components/KuaioaCrudListPage';
import { listEmployees } from '../../../services/employees';
import {
  createReward,
  deleteReward,
  getReward,
  listRewards,
  updateReward,
} from '../../../services/payroll';

const RewardsPage: React.FC = () => {
  const { t } = useTranslation();
  const [employeeOptions, setEmployeeOptions] = useState<Array<{ label: string; value: number }>>(
    [],
  );

  useEffect(() => {
    void (async () => {
      const res = await listEmployees({ status: 'active' });
      setEmployeeOptions(
        res.items.map((e) => ({
          label: `${e.employee_code || ''} ${e.full_name}`.trim(),
          value: Number(e.id),
        })),
      );
    })();
  }, []);

  const fields = useMemo(
    () => [
      { name: 'reward_code', labelKey: 'app.kuaioa.reward.code', width: 140 },
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
        name: 'amount',
        labelKey: 'app.kuaioa.reward.amount',
        type: 'number' as const,
        required: true,
        width: 110,
      },
      { name: 'reason', labelKey: 'app.kuaioa.reward.reason', width: 180 },
      { name: 'status', labelKey: 'common.status', width: 90, hideInForm: true },
      { name: 'notes', labelKey: 'common.remark', type: 'textarea' as const, hideInTable: true },
    ],
    [employeeOptions],
  );

  return (
    <KuaioaCrudListPage
      createButtonKey="app.kuaioa.reward.createButton"
      resource="kuaioa:reward"
      codeField="reward_code"
      nameField="employee_name"
      autoGenerateCode
      statusPresentation="marker"
      detailVariant="master"
      getDetailFn={getReward}
      columnPersistenceId="apps.kuaioa.reward.list-v1"
      fields={fields}
      listFn={listRewards}
      createFn={createReward}
      updateFn={updateReward}
      deleteFn={deleteReward}
    />
  );
};

export default RewardsPage;
