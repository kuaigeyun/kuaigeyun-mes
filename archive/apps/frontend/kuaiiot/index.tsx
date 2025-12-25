/**
 * 快格轻IOT APP 入口文件
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';

// 设备数据采集页面
import DeviceDataCollectionsPage from './pages/device-data-collections';

// 传感器配置页面
import SensorConfigurationsPage from './pages/sensor-configurations';

// 传感器数据页面
import SensorDataPage from './pages/sensor-data';

// 实时监控页面
import RealTimeMonitoringsPage from './pages/real-time-monitorings';

// 数据预警页面
import DataAlertsPage from './pages/data-alerts';

const KuaiiotApp: React.FC = () => {
  return (
    <Routes>
      {/* 设备数据采集 */}
      <Route path="device-data-collections" element={<DeviceDataCollectionsPage />} />
      
      {/* 传感器配置 */}
      <Route path="sensor-configurations" element={<SensorConfigurationsPage />} />
      
      {/* 传感器数据 */}
      <Route path="sensor-data" element={<SensorDataPage />} />
      
      {/* 实时监控 */}
      <Route path="real-time-monitorings" element={<RealTimeMonitoringsPage />} />
      
      {/* 数据预警 */}
      <Route path="data-alerts" element={<DataAlertsPage />} />
      
      {/* 默认路由 */}
      <Route index element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>快格轻IOT</div>} />
      <Route path="*" element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>页面未找到</div>} />
    </Routes>
  );
};

export default KuaiiotApp;

