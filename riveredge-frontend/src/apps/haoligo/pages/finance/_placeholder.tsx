/**
 * 好力 GO — 财务管理占位页（后续 Phase 接入）
 */

import React from 'react';
import { Alert } from 'antd';
import { ListPageTemplate } from '../../../../components/layout-templates';

type FinancePlaceholderPageProps = {
  title: string;
  description: string;
};

const FinancePlaceholderPage: React.FC<FinancePlaceholderPageProps> = ({ title, description }) => (
  <ListPageTemplate title={title}>
    <Alert type="info" showIcon message={title} description={description} />
  </ListPageTemplate>
);

export default FinancePlaceholderPage;
