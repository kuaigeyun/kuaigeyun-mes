import React from 'react';
import QualityTicketPage from '../shared/QualityTicketPage';
import {
  confirmLineStopFeedbackClose,
  createLineStopFeedback,
  deleteLineStopFeedback,
  getLineStopFeedback,
  listLineStopFeedbacks,
  submitLineStopFeedbackHandleMeasures,
  submitLineStopFeedbackRegister,
  updateLineStopFeedback,
} from '../../../services/haoligo';

type LineStopFeedbackPageProps = {
  viewMode?: 'all' | 'register' | 'handle';
  title?: string;
  persistenceId?: string;
};

const LineStopFeedbackPage: React.FC<LineStopFeedbackPageProps> = ({
  viewMode = 'all',
  title = '停线反馈',
  persistenceId = 'apps.haoligo.pages.quality.line-stops',
}) => (
  <QualityTicketPage
    title={title}
    persistenceId={persistenceId}
    viewMode={viewMode}
    formProfile="line-stop"
    showWorkOrderFields={false}
    listFn={listLineStopFeedbacks}
    getFn={getLineStopFeedback}
    createFn={(body) => createLineStopFeedback(body)}
    updateFn={(id, body) => updateLineStopFeedback(id, body)}
    submitFn={(id) => submitLineStopFeedbackRegister(id, { responsible_user_ids: [], overdue_notify_user_ids: [] })}
    completeFn={(id) => confirmLineStopFeedbackClose(id, {})}
    registerSubmitFn={submitLineStopFeedbackRegister}
    combinedHandleMeasures
    submitHandleMeasuresFn={submitLineStopFeedbackHandleMeasures}
    confirmCloseFn={confirmLineStopFeedbackClose}
    deleteFn={deleteLineStopFeedback}
  />
);

export default LineStopFeedbackPage;
