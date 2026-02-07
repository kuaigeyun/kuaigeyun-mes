/**
 * 系统配置组件
 * Wraps GroupedFormView for use in ReportDesigner
 */
import React from 'react';
import { ReportComponent } from '../index';
import GroupedFormView from '../../../pages/system/system-parameters/grouped-form-view';

export interface SystemConfigComponentProps {
  component: ReportComponent;
}

const SystemConfigComponent: React.FC<SystemConfigComponentProps> = ({ component }) => {
  return (
    <div style={{ height: '100%', overflow: 'auto', ...component.style }}>
      <GroupedFormView />
    </div>
  );
};

export default SystemConfigComponent;
