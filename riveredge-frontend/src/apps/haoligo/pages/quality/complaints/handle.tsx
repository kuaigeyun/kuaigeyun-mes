import React from 'react';
import CustomerComplaintPage from './index';

const CustomerComplaintHandlePage: React.FC = () => (
  <CustomerComplaintPage
    viewMode="handle"
    title="客户投诉处理"
    persistenceId="apps.haoligo.pages.quality.complaints.handle"
  />
);

export default CustomerComplaintHandlePage;
