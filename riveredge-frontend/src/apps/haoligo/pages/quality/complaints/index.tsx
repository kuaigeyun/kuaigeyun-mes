import React from 'react';
import QualityTicketPage from '../shared/QualityTicketPage';
import {
  confirmCustomerComplaintClose,
  createCustomerComplaint,
  deleteCustomerComplaint,
  getCustomerComplaint,
  listCustomerComplaints,
  submitCustomerComplaintHandleMeasures,
  submitCustomerComplaintRegister,
  updateCustomerComplaint,
} from '../../../services/haoligo';

type CustomerComplaintPageProps = {
  viewMode?: 'all' | 'register' | 'handle';
  title?: string;
  persistenceId?: string;
};

const CustomerComplaintPage: React.FC<CustomerComplaintPageProps> = ({
  viewMode = 'all',
  title = '客户投诉',
  persistenceId = 'apps.haoligo.pages.quality.complaints',
}) => (
  <QualityTicketPage
    title={title}
    persistenceId={persistenceId}
    viewMode={viewMode}
    formProfile="complaint"
    listFn={listCustomerComplaints}
    getFn={getCustomerComplaint}
    createFn={(body) => createCustomerComplaint(body)}
    updateFn={(id, body) => updateCustomerComplaint(id, body)}
    submitFn={(id) => submitCustomerComplaintRegister(id, { responsible_user_ids: [], overdue_notify_user_ids: [] })}
    completeFn={(id) => confirmCustomerComplaintClose(id, {})}
    registerSubmitFn={submitCustomerComplaintRegister}
    combinedHandleMeasures
    submitHandleMeasuresFn={submitCustomerComplaintHandleMeasures}
    confirmCloseFn={confirmCustomerComplaintClose}
    showWorkOrderFields={false}
    deleteFn={deleteCustomerComplaint}
  />
);

export default CustomerComplaintPage;
