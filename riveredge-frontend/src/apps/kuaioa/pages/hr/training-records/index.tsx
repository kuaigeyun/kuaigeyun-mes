import React from 'react';
import KuaioaCrudListPage from '../../../components/KuaioaCrudListPage';
import {
  createTrainingRecord,
  deleteTrainingRecord,
  listTrainingRecords,
  updateTrainingRecord,
} from '../../../services/training';

const TrainingRecordsPage: React.FC = () => (
  <KuaioaCrudListPage
    createButtonKey="app.kuaioa.trainingRecord.createButton"
    resource="kuaioa:training-record"
    codeField="record_code"
    nameField="training_name"
    autoGenerateCode
    fields={[
      { name: 'record_code', labelKey: 'app.kuaioa.trainingRecord.code', width: 140 },
      { name: 'training_name', labelKey: 'app.kuaioa.trainingRecord.name', required: true, width: 200 },
      { name: 'trainee_name', labelKey: 'app.kuaioa.trainingRecord.trainee', width: 120 },
      { name: 'training_date', labelKey: 'app.kuaioa.trainingRecord.date', width: 120 },
      { name: 'is_passed', labelKey: 'app.kuaioa.trainingRecord.passed', type: 'switch', width: 80 },
      { name: 'status', labelKey: 'app.kuaioa.common.status', width: 100 },
    ]}
    listFn={listTrainingRecords}
    createFn={createTrainingRecord}
    updateFn={updateTrainingRecord}
    deleteFn={deleteTrainingRecord}
  />
);

export default TrainingRecordsPage;
