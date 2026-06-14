import React from 'react';
import { Navigate, useParams } from 'react-router-dom';

const KnowledgeArticleDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  if (!id) {
    return <Navigate to="/apps/kuaiplm/knowledge-base" replace />;
  }
  return <Navigate to={`/apps/kuaiplm/knowledge-base?articleId=${id}`} replace />;
};

export default KnowledgeArticleDetailPage;
