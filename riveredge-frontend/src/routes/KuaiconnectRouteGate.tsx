/**
 * 快连接（连接管理四页）路由门禁：已安装启用且授权通过时渲染业务页，否则显示升级/激活提示。
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTenantId } from '../utils/auth';
import { getInstalledApplicationList } from '../services/application';
import { isKuaiconnectReady } from '../utils/kuaiconnectAccess';
import ProUpgradePrompt from '../components/pro-upgrade-prompt';
import PageSkeleton from '../components/page-skeleton';

const KuaiconnectRouteGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const tenantId = getTenantId();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['installedApplications', { is_active: true, tenantId }],
    queryFn: () => getInstalledApplicationList({ is_active: true }),
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return <PageSkeleton variant="content" />;
  }
  if (isError || !isKuaiconnectReady(data)) {
    return <ProUpgradePrompt appName="快连接" appCode="kuaiconnect" />;
  }
  return <>{children}</>;
};

export default KuaiconnectRouteGate;
