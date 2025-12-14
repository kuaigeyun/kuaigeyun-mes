/**
 * 主数据管理 APP 入口文件
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';

// 工厂建模页面
import WorkshopsPage from './pages/factory/workshops';
import ProductionLinesPage from './pages/factory/production-lines';
import WorkstationsPage from './pages/factory/workstations';

// 仓库管理页面
import WarehousesPage from './pages/warehouse/warehouses';
import StorageAreasPage from './pages/warehouse/storage-areas';
import StorageLocationsPage from './pages/warehouse/storage-locations';

// 物料管理页面
import MaterialsManagementPage from './pages/materials/management';
import BOMPage from './pages/materials/bom';

// 工艺管理页面
import DefectTypesPage from './pages/process/defect-types';
import OperationsPage from './pages/process/operations';
import ProcessRoutesPage from './pages/process/routes';
import SOPPage from './pages/process/sop';
import ESOPDesignerPage from './pages/process/sop/designer';
import SOPExecutionPage from './pages/process/sop/execution';

// 供应链页面
import CustomersPage from './pages/supply-chain/customers';
import SuppliersPage from './pages/supply-chain/suppliers';

// 绩效管理页面
import HolidaysPage from './pages/performance/holidays';
import SkillsPage from './pages/performance/skills';

const MasterDataApp: React.FC = () => {
  return (
    <Routes>
      {/* 工厂建模 */}
      <Route path="factory/workshops" element={<WorkshopsPage />} />
      <Route path="factory/production-lines" element={<ProductionLinesPage />} />
      <Route path="factory/workstations" element={<WorkstationsPage />} />
      
      {/* 仓库管理 */}
      <Route path="warehouse/warehouses" element={<WarehousesPage />} />
      <Route path="warehouse/storage-areas" element={<StorageAreasPage />} />
      <Route path="warehouse/storage-locations" element={<StorageLocationsPage />} />
      
      {/* 物料管理 */}
      <Route path="materials" element={<MaterialsManagementPage />} />
      <Route path="materials/list" element={<MaterialsManagementPage />} />
      <Route path="materials/materials" element={<MaterialsManagementPage />} />
      <Route path="materials/bom" element={<BOMPage />} />
      
      {/* 工艺管理 */}
      <Route path="process/defect-types" element={<DefectTypesPage />} />
      <Route path="process/operations" element={<OperationsPage />} />
      <Route path="process/routes" element={<ProcessRoutesPage />} />
      <Route path="process/sop" element={<SOPPage />} />
      <Route path="process/sop/designer" element={<ESOPDesignerPage />} />
      <Route path="process/sop/execution" element={<SOPExecutionPage />} />
      
      {/* 供应链 */}
      <Route path="supply-chain/customers" element={<CustomersPage />} />
      <Route path="supply-chain/suppliers" element={<SuppliersPage />} />
      
      {/* 绩效管理 */}
      <Route path="performance/holidays" element={<HolidaysPage />} />
      <Route path="performance/skills" element={<SkillsPage />} />
      
      {/* 默认路由 */}
      <Route index element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>主数据管理</div>} />
      <Route path="*" element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>页面未找到</div>} />
    </Routes>
  );
};

export default MasterDataApp;

