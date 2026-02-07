/**
 * 核心配置组件 (站点设置)
 * Wraps SiteSettingsPage for use in ReportDesigner
 */
import React from 'react';
import { ReportComponent } from '../index';
import SiteSettingsPage from '../../../pages/system/site-settings';

export interface CoreConfigComponentProps {
  component: ReportComponent;
}

const CoreConfigComponent: React.FC<CoreConfigComponentProps> = ({ component }) => {
  return (
    <div style={{ height: '100%', overflow: 'auto', ...component.style }}>
      <SiteSettingsPage />
    </div>
  );
};

export default CoreConfigComponent;
