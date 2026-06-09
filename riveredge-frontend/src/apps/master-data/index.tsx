/**
 * 主数据管理 APP 入口文件
 *
 * 路由级代码分割：各页面使用 React.lazy 按需加载
 */

import React, { Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { Routes, Route, Navigate } from 'react-router-dom';
import PageSkeleton from '../../components/page-skeleton';
import SuspendedModalFloatingButton from './components/SuspendedModalFloatingButton';
import PermissionGuard from '../../components/permission/PermissionGuard';

/** 页面懒加载包装：Suspense + Spin fallback */
const withPageSuspense = (LazyComponent: React.LazyExoticComponent<React.ComponentType<any>>) => (
  <Suspense fallback={<PageSkeleton />}><LazyComponent /></Suspense>
);

// 工厂建模页面
const PlantsPage = lazy(() => import('./pages/factory/plants'));
const WorkshopsPage = lazy(() => import('./pages/factory/workshops'));
const ProductionLinesPage = lazy(() => import('./pages/factory/production-lines'));
const WorkstationsPage = lazy(() => import('./pages/factory/workstations'));
const WorkCentersPage = lazy(() => import('./pages/factory/work-centers'));
const WorkGroupsPage = lazy(() => import('./pages/factory/work-groups'));

// 仓库管理页面
const WarehousesPage = lazy(() => import('./pages/warehouse/warehouses'));
const StorageAreasPage = lazy(() => import('./pages/warehouse/storage-areas'));
const StorageLocationsPage = lazy(() => import('./pages/warehouse/storage-locations'));

// 物料管理页面
const MaterialsManagementPage = lazy(() => import('./pages/materials/management'));
const BOMPage = lazy(() => import('./pages/materials/bom'));
const BOMDesignerPage = lazy(() => import('./pages/materials/bom/designer'));
const VariantAttributesPage = lazy(() => import('./pages/materials/variant-attributes'));
const BatchRulesPage = lazy(() => import('./pages/materials/batch-rules'));
const BatchesPage = lazy(() => import('./pages/materials/batches'));
const SerialRulesPage = lazy(() => import('./pages/materials/serial-rules'));
const SerialsPage = lazy(() => import('./pages/materials/serials'));

// 工艺管理页面
const DefectTypesPage = lazy(() => import('./pages/process/defect-types'));
const OperationsPage = lazy(() => import('./pages/process/operations'));
const ProcessRoutesPage = lazy(() => import('./pages/process/routes'));
const ProductProcessPage = lazy(() => import('./pages/process/product-process'));
const DrawingsPage = lazy(() => import('./pages/process/drawings'));
const SOPPage = lazy(() => import('./pages/process/sop'));
const ESOPDesignerPage = lazy(() => import('./pages/process/sop/designer'));
const SOPExecutionPage = lazy(() => import('./pages/process/sop/execution'));

// 供应链页面
const CustomersPage = lazy(() => import('./pages/supply-chain/customers'));
const SuppliersPage = lazy(() => import('./pages/supply-chain/suppliers'));
const CustomerPriceBooksPage = lazy(() => import('./pages/supply-chain/customer-price-books'));
const SupplierPriceBooksPage = lazy(() => import('./pages/supply-chain/supplier-price-books'));

const MasterDataApp: React.FC = () => {
  const { t } = useTranslation();

  return (
    <>
    <Routes>
      {/* 工厂建模路由 */}
      <Route path="factory/plants" element={withPageSuspense(PlantsPage)} />
      <Route path="factory/workshops" element={withPageSuspense(WorkshopsPage)} />
      <Route path="factory/production-lines" element={withPageSuspense(ProductionLinesPage)} />
      <Route path="factory/workstations" element={withPageSuspense(WorkstationsPage)} />
      <Route path="factory/work-centers" element={withPageSuspense(WorkCentersPage)} />
      <Route path="factory/work-groups" element={withPageSuspense(WorkGroupsPage)} />

      {/* 仓库管理路由 */}
      <Route path="warehouse/warehouses" element={withPageSuspense(WarehousesPage)} />
      <Route path="warehouse/storage-areas" element={withPageSuspense(StorageAreasPage)} />
      <Route path="warehouse/storage-locations" element={withPageSuspense(StorageLocationsPage)} />

      {/* 物料管理路由 */}
      <Route path="materials" element={withPageSuspense(MaterialsManagementPage)} />
      <Route path="materials/variant-attributes" element={withPageSuspense(VariantAttributesPage)} />
      <Route path="materials/batch-rules" element={withPageSuspense(BatchRulesPage)} />
      <Route path="materials/batches" element={withPageSuspense(BatchesPage)} />
      <Route path="materials/serial-rules" element={withPageSuspense(SerialRulesPage)} />
      <Route path="materials/serials" element={withPageSuspense(SerialsPage)} />

      {/* 工艺管理路由 */}
      <Route path="process/defect-types" element={withPageSuspense(DefectTypesPage)} />
      <Route path="process/operations" element={withPageSuspense(OperationsPage)} />
      <Route path="process/routes" element={withPageSuspense(ProcessRoutesPage)} />
      <Route path="process/product-process" element={withPageSuspense(ProductProcessPage)} />
      <Route path="process/drawings" element={withPageSuspense(DrawingsPage)} />
      <Route path="process/engineering-bom" element={withPageSuspense(BOMPage)} />
      <Route path="process/engineering-bom/designer" element={
        <PermissionGuard permission="master-data:process:engineering-bom:update" fallback={<Navigate to="../engineering-bom" replace />}>
          {withPageSuspense(BOMDesignerPage)}
        </PermissionGuard>
      } />
      <Route path="process/sop" element={withPageSuspense(SOPPage)} />
      <Route path="process/sop/create" element={<Navigate to="../sop?create=1" replace />} />
      <Route path="process/sop/designer" element={
        <PermissionGuard permission="master-data:process:sop:update" fallback={<Navigate to="../sop" replace />}>
          {withPageSuspense(ESOPDesignerPage)}
        </PermissionGuard>
      } />
      <Route path="process/sop/execution" element={withPageSuspense(SOPExecutionPage)} />

      {/* 供应链路由 */}
      <Route path="supply-chain/customers" element={withPageSuspense(CustomersPage)} />
      <Route path="supply-chain/suppliers" element={withPageSuspense(SuppliersPage)} />
      <Route path="supply-chain/customer-price-books" element={withPageSuspense(CustomerPriceBooksPage)} />
      <Route path="supply-chain/supplier-price-books" element={withPageSuspense(SupplierPriceBooksPage)} />

      {/* 默认路由 - 应用首页 */}
      <Route path="" element={
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <h2>{t('app.master-data.title', '主数据管理应用')}</h2>
          <p>{t('app.master-data.welcome', '欢迎使用主数据管理系统，请从左侧菜单选择功能模块。')}</p>
        </div>
      } />
    </Routes>
    <SuspendedModalFloatingButton />
    </>
  );
};

export default MasterDataApp;
