import React from 'react';
import { IframePageTemplate } from '../../../components/layout-templates';

const InngestDashboard: React.FC = () => {
  return (
    <IframePageTemplate
      src={`http://${import.meta.env.VITE_INNGEST_HOST || '127.0.0.1'}:${import.meta.env.VITE_INNGEST_PORT || '8288'}/`}
      title="Inngest Dashboard"
    />
  );
};

export default InngestDashboard;

