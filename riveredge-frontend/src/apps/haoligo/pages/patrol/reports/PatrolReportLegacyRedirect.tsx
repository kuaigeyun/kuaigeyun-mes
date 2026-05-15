/**
 * 将旧单图路径 /patrol/reports/:reportKey 重定向到合并后的分组页
 */

import React from 'react';
import { Navigate, useParams } from 'react-router-dom';

const REPORT_TO_GROUP: Record<string, string> = {
  'issue-type-share': 'volume',
  'monthly-volume': 'volume',
  'status-distribution': 'volume',
  'node-completion-trend': 'completion',
  'monthly-completion-rate': 'completion',
  'monthly-overdue-rate': 'completion',
  'overdue-ranking': 'completion',
  'area-volume-trend': 'area',
  'dept-headcount-trend': 'area',
  'keyword-cloud': 'insights',
  summary: 'volume',
};

const PatrolReportLegacyRedirect: React.FC = () => {
  const { reportKey = '' } = useParams<{ reportKey: string }>();
  if (reportKey === 'group') {
    return <Navigate to="/apps/haoligo/patrol/reports/group/volume" replace />;
  }
  const slug = REPORT_TO_GROUP[reportKey] ?? 'volume';
  return <Navigate to={`/apps/haoligo/patrol/reports/group/${slug}`} replace />;
};

export default PatrolReportLegacyRedirect;
