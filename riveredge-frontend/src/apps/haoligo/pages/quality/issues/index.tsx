import React from 'react';
import QualityTicketPage from '../shared/QualityTicketPage';
import {
  confirmQualityIssueClose,
  createQualityIssue,
  deleteQualityIssue,
  getQualityIssue,
  listQualityIssues,
  submitQualityIssueHandleMeasures,
  submitQualityIssueRegister,
  updateQualityIssue,
} from '../../../services/haoligo';

type QualityIssuePageProps = {
  viewMode?: 'all' | 'register' | 'handle';
  title?: string;
  persistenceId?: string;
};

const QualityIssuePage: React.FC<QualityIssuePageProps> = ({
  viewMode = 'all',
  title = '品质问题反馈',
  persistenceId = 'apps.haoligo.pages.quality.issues',
}) => (
  <QualityTicketPage
    title={title}
    persistenceId={persistenceId}
    viewMode={viewMode}
    listFn={listQualityIssues}
    getFn={getQualityIssue}
    createFn={(body) => createQualityIssue(body)}
    updateFn={(id, body) => updateQualityIssue(id, body)}
    submitFn={(id) => submitQualityIssueRegister(id, { responsible_user_ids: [], overdue_notify_user_ids: [] })}
    completeFn={(id) => confirmQualityIssueClose(id, {})}
    registerSubmitFn={submitQualityIssueRegister}
    combinedHandleMeasures
    submitHandleMeasuresFn={submitQualityIssueHandleMeasures}
    confirmCloseFn={confirmQualityIssueClose}
    deleteFn={deleteQualityIssue}
  />
);

export default QualityIssuePage;
