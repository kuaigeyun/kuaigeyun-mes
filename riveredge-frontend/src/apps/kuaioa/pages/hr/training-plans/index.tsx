import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import KuaioaCrudListPage from '../../../components/KuaioaCrudListPage';
import {
  createTrainingPlan,
  deleteTrainingPlan,
  listTrainingPlans,
  updateTrainingPlan,
} from '../../../services/training';
import { buildTrainingPlanTypeOptions } from '../../../utils/oaFormEnums';

const TrainingPlansPage: React.FC = () => {
  const { t } = useTranslation();
  const planTypeOptions = useMemo(() => buildTrainingPlanTypeOptions(t), [t]);

  return (
    <KuaioaCrudListPage
      createButtonKey="app.kuaioa.trainingPlan.createButton"
      resource="kuaioa:training-plan"
      codeField="plan_code"
      nameField="plan_name"
      autoGenerateCode
      statusPresentation="marker"
      fields={[
        { name: 'plan_code', labelKey: 'app.kuaioa.trainingPlan.code', width: 140 },
        { name: 'plan_name', labelKey: 'app.kuaioa.trainingPlan.name', required: true, width: 200 },
        {
          name: 'plan_type',
          labelKey: 'app.kuaioa.trainingPlan.type',
          width: 120,
          type: 'select',
          options: planTypeOptions,
        },
        { name: 'department_name', labelKey: 'app.kuaioa.common.department', width: 120 },
        { name: 'planned_start_date', labelKey: 'app.kuaioa.trainingPlan.plannedStart', width: 120, type: 'date', hideInTable: true },
        { name: 'planned_end_date', labelKey: 'app.kuaioa.trainingPlan.plannedEnd', width: 120, type: 'date', hideInTable: true },
        { name: 'reminder_days', labelKey: 'app.kuaioa.common.reminderDays', width: 100, type: 'number', hideInTable: true },
        { name: 'status', labelKey: 'common.status', width: 100 },
        { name: 'description', labelKey: 'common.remark', hideInTable: true, type: 'textarea' },
      ]}
      listFn={listTrainingPlans}
      createFn={createTrainingPlan}
      updateFn={updateTrainingPlan}
      deleteFn={deleteTrainingPlan}
    />
  );
};

export default TrainingPlansPage;
