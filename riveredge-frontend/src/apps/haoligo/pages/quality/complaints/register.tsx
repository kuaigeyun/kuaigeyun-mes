import React from 'react';
import CustomerComplaintPage from './index';

const CustomerComplaintRegisterPage: React.FC = () => (
  <CustomerComplaintPage
    viewMode="register"
    title="客户投诉登记"
    persistenceId="apps.haoligo.pages.quality.complaints.register"
  />
);

export default CustomerComplaintRegisterPage;
