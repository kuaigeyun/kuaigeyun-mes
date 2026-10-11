import React from 'react';
import ProUpgradePrompt from '../../components/pro-upgrade-prompt';

/** 未组装 kuaiconnect 专业包时的系统数据中心占位 */
const ProDataCenterUpgradePage: React.FC = () => (
  <ProUpgradePrompt appName="快连接" appCode="kuaiconnect" />
);

export default ProDataCenterUpgradePage;
