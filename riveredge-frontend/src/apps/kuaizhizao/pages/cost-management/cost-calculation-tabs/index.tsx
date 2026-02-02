/**
 * 成本核算统一页面
 *
 * 将生产成本、委外成本、采购成本、质量成本合并到一个页面的Tabs中。
 *
 * @author Auto (AI Assistant)
 * @date 2026-01-20
 */

import React, { useState, useEffect } from 'react';
import { MultiTabListPageTemplate } from '../../../../../components/layout-templates';
import { useLocation, useNavigate } from 'react-router-dom';
import ProductionCostPage from '../production-cost';
import OutsourceCostPage from '../outsource-cost';
import PurchaseCostPage from '../purchase-cost';
import QualityCostPage from '../quality-cost';

const CostCalculationTabsPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // 根据路由路径确定默认Tab
  const getDefaultTab = () => {
    const path = location.pathname;
    if (path.includes('production-cost')) return 'production';
    if (path.includes('outsource-cost')) return 'outsource';
    if (path.includes('purchase-cost')) return 'purchase';
    if (path.includes('quality-cost')) return 'quality';
    return 'production';
  };

  const [activeTab, setActiveTab] = useState<string>(getDefaultTab());

  // 当路由变化时更新Tab
  useEffect(() => {
    const tab = getDefaultTab();
    setActiveTab(tab);
  }, [location.pathname]);

  // Tab切换处理
  const handleTabChange = (key: string) => {
    setActiveTab(key);
    // 更新URL但不刷新页面
    const basePath = '/apps/kuaizhizao/cost-management';
    const tabRoutes: Record<string, string> = {
      production: `${basePath}/production-cost`,
      outsource: `${basePath}/outsource-cost`,
      purchase: `${basePath}/purchase-cost`,
      quality: `${basePath}/quality-cost`,
    };
    if (tabRoutes[key]) {
      navigate(tabRoutes[key], { replace: true });
    }
  };

  const tabItems = [
    {
      key: 'production',
      label: '生产成本',
      children: <ProductionCostPage />,
    },
    {
      key: 'outsource',
      label: '委外成本',
      children: <OutsourceCostPage />,
    },
    {
      key: 'purchase',
      label: '采购成本',
      children: <PurchaseCostPage />,
    },
    {
      key: 'quality',
      label: '质量成本',
      children: <QualityCostPage />,
    },
  ];

  return (
    <MultiTabListPageTemplate
      activeTabKey={activeTab}
      onTabChange={handleTabChange}
      tabs={tabItems}
    />
  );
};

export default CostCalculationTabsPage;
