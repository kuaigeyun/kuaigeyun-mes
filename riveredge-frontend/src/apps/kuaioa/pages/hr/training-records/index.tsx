import React, { useEffect, useMemo, useState } from 'react';
import KuaioaCrudListPage from '../../../components/KuaioaCrudListPage';
import {
  createTrainingRecord,
  deleteTrainingRecord,
  listTrainingPlans,
  listTrainingRecords,
  updateTrainingRecord,
} from '../../../services/training';

const TrainingRecordsPage: React.FC = () => {
  const [planOptions, setPlanOptions] = useState<Array<{ label: string; value: number }>>([]);

  useEffect(() => {
    void (async () => {
      const res = await listTrainingPlans();
      setPlanOptions(
        res.items.map((plan) => ({
          label: `${plan.plan_code} ${plan.plan_name}`,
          value: plan.id,
        })),
      );
    })();
  }, []);

  const fields = useMemo(
    () => [
      { name: 'record_code', labelKey: 'app.kuaioa.trainingRecord.code', width: 140 },
      { name: 'training_name', labelKey: 'app.kuaioa.trainingRecord.name', required: true, width: 200 },
      {
        name: 'plan_id',
        labelKey: 'app.kuaioa.trainingRecord.plan',
        hideInTable: true,
        type: 'select' as const,
        options: planOptions,
      },
      { name: 'trainee_name', labelKey: 'app.kuaioa.trainingRecord.trainee', width: 120 },
      { name: 'trainer_name', labelKey: 'app.kuaioa.trainingRecord.trainer', hideInTable: true },
      { name: 'training_date', labelKey: 'app.kuaioa.trainingRecord.date', width: 120, type: 'date' as const },
      { name: 'theory_score', labelKey: 'app.kuaioa.trainingRecord.theoryScore', hideInTable: true, type: 'number' as const },
      { name: 'practice_score', labelKey: 'app.kuaioa.trainingRecord.practiceScore', hideInTable: true, type: 'number' as const },
      { name: 'is_passed', labelKey: 'app.kuaioa.trainingRecord.passed', type: 'switch' as const, width: 80 },
      { name: 'status', labelKey: 'app.kuaioa.common.status', width: 100 },
      { name: 'notes', labelKey: 'app.kuaioa.common.notes', hideInTable: true, type: 'textarea' as const },
    ],
    [planOptions],
  );

  return (
    <KuaioaCrudListPage
      createButtonKey="app.kuaioa.trainingRecord.createButton"
      resource="kuaioa:training-record"
      codeField="record_code"
      nameField="training_name"
      autoGenerateCode
      statusPresentation="marker"
      fields={fields}
      listFn={listTrainingRecords}
      createFn={createTrainingRecord}
      updateFn={updateTrainingRecord}
      deleteFn={deleteTrainingRecord}
    />
  );
};

export default TrainingRecordsPage;
