import React from 'react';
import { Navigate } from 'react-router-dom';

const CostComparisonPage: React.FC = () => (
  <Navigate to="/apps/kuaicaiwu/cost-management/cost-calculations?cat=compare" replace />
);

export default CostComparisonPage;
