/**
 * KU-AI (kuaiai) APP 入口文件 - 占位
 *
 * 智能建议功能：开启后在相关业务单据提供建议。
 * 未来计划：本地建议、大模型建议。
 * 此应用无实际菜单，配置开启后在各业务页面生效。
 */

import React from 'react';

const PlanningBadge = () => (
  <span
    style={{
      display: 'inline-block',
      marginLeft: 8,
      padding: '2px 8px',
      fontSize: 12,
      color: '#1890ff',
      background: '#e6f7ff',
      borderRadius: 4,
      fontWeight: 'normal',
    }}
  >
    规划中
  </span>
);

const KuaiaiApp: React.FC = () => {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center' }}>
      <h2>KU-AI<PlanningBadge /></h2>
      <p style={{ color: 'var(--color-text-secondary)', marginTop: 8 }}>
        此应用无独立菜单，开启后将在工单、报工、库存、物料等业务单据中提供智能建议。
      </p>
      <p style={{ color: 'var(--color-text-tertiary)', marginTop: 16, fontSize: 14 }}>
        未来计划：本地建议、大模型建议
      </p>
    </div>
  );
};

export default KuaiaiApp;
