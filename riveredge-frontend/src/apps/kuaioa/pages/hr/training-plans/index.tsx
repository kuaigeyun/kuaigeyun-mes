import React from 'react';
import KuaioaCrudListPage from '../../../components/KuaioaCrudListPage';
import {
  createTrainingPlan,
  deleteTrainingPlan,
  listTrainingPlans,
  updateTrainingPlan,
} from '../../../services/training';

const TrainingPlansPage: React.FC = () => (
  <KuaioaCrudListPage
    createButtonKey="app.kuaioa.trainingPlan.createButton"
    resource="kuaioa:training-plan"
    codeField="plan_code"
    nameField="plan_name"
    autoGenerateCode
    fields={[
      { name: 'plan_code', labelKey: 'app.kuaioa.trainingPlan.code', width: 140 },
      { name: 'plan_name', labelKey: 'app.kuaioa.trainingPlan.name', required: true, width: 200 },
      { name: 'plan_type', labelKey: 'app.kuaioa.trainingPlan.type', width: 120 },
      { name: 'department_name', labelKey: 'app.kuaioa.common.department', width: 120 },
      { name: 'status', labelKey: 'app.kuaioa.common.status', width: 100 },
      { name: 'description', labelKey: 'app.kuaioa.common.description', hideInTable: true, type: 'textarea' },
    ]}
    listFn={listTrainingPlans}
    createFn={createTrainingPlan}
    updateFn={updateTrainingPlan}
    deleteFn={deleteTrainingPlan}
  />
);

export default TrainingPlansPage;
