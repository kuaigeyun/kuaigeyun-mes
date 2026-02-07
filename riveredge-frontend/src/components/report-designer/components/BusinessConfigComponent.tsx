/**
 * 业务配置组件
 * Wraps BusinessConfigPage for use in ReportDesigner
 */
import React from 'react';
import { ReportComponent } from '../index';
import BusinessConfigPage from '../../../pages/system/business-config';

export interface BusinessConfigComponentProps {
  component: ReportComponent;
}

const BusinessConfigComponent: React.FC<BusinessConfigComponentProps> = ({ component }) => {
  return (
    <div style={{ height: '100%', overflow: 'auto', ...component.style }}>
      <BusinessConfigPage />
    </div>
  );
};

export default BusinessConfigComponent;
