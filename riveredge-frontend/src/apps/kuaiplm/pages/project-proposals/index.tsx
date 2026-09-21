/**
 * 快研发项目建议入口：启用定制 document 替代时渲染 funide-oa 模板页，否则通用中性壳。
 */
import React, { Suspense } from 'react';
import { ListPageTemplate } from '../../../../components/layout-templates';
import PageSkeleton from '../../../../components/page-skeleton';
import { useDocumentReplacement } from '../../../../hooks/useDocumentReplacement';
import ProjectProposalsGenericPage from './ProjectProposalsGenericPage';

const HOST_PATH = '/apps/kuaiplm/project-proposals';

const ProjectProposalsPage: React.FC = () => {
  const { loading, Component } = useDocumentReplacement(HOST_PATH);

  if (loading) {
    return (
      <ListPageTemplate>
        <PageSkeleton />
      </ListPageTemplate>
    );
  }

  if (Component) {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <Component />
      </Suspense>
    );
  }

  return <ProjectProposalsGenericPage />;
};

export default ProjectProposalsPage;
