import React from 'react';
import { Navigate } from 'react-router-dom';

/** 巡查根路径默认进入「问题登记」 */
const PatrolIndexRedirect: React.FC = () => <Navigate to="/apps/haoligo/patrol/daily/form" replace />;

export default PatrolIndexRedirect;
