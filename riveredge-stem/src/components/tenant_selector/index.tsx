/**
 * 组织选择器组件（占位）
 * 
 * 目前为占位显示，直接显示固定组织名称
 * 后续需要后端配合实现租户切换功能
 */

import React from 'react';

/**
 * 组织选择器组件（占位）
 */
const TenantSelector: React.FC = () => {
  // 占位显示：直接显示固定组织名称
  return (
    <span style={{ color: '#262626', fontSize: 14, fontWeight: 500 }}>
      无锡快格信息技术有限公司
    </span>
  );
};

export default TenantSelector;

