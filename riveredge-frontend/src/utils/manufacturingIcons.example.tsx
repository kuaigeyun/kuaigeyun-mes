/**
 * 制造业图标使用示例
 * 
 * 本文件展示了如何使用制造业相关图标
 */

import React from 'react';
import { ManufacturingIcons, getManufacturingIcon, ManufacturingIconName } from './manufacturingIcons';
import { Space } from 'antd';

/**
 * 示例 1: 直接使用图标组件
 */
export const Example1: React.FC = () => {
  const FactoryIcon = ManufacturingIcons.factory;
  const MachineIcon = ManufacturingIcons.machine;
  const WarehouseIcon = ManufacturingIcons.warehouse;
  
  return (
    <Space>
      <FactoryIcon size={24} color="#1890ff" />
      <MachineIcon size={24} color="#52c41a" />
      <WarehouseIcon size={24} color="#faad14" />
    </Space>
  );
};

/**
 * 示例 2: 使用 getManufacturingIcon 函数
 */
export const Example2: React.FC = () => {
  const ProductionIcon = getManufacturingIcon('production', { size: 24 });
  const ShippingIcon = getManufacturingIcon('shipping', { size: 24, color: '#1890ff' });
  
  return (
    <Space>
      <ProductionIcon />
      <ShippingIcon />
    </Space>
  );
};

/**
 * 示例 3: 在按钮中使用
 */
export const Example3: React.FC = () => {
  const MaintenanceIcon = ManufacturingIcons.maintenance;
  
  return (
    <button>
      <MaintenanceIcon style={{ marginRight: 8 }} />
      设备维护
    </button>
  );
};

/**
 * 示例 4: 在菜单中使用
 */
export const Example4: React.FC = () => {
  const menuItems = [
    { key: 'factory', label: '工厂管理', icon: ManufacturingIcons.factory },
    { key: 'production', label: '生产管理', icon: ManufacturingIcons.production },
    { key: 'warehouse', label: '仓储管理', icon: ManufacturingIcons.warehouse },
    { key: 'shipping', label: '物流配送', icon: ManufacturingIcons.shipping },
    { key: 'quality', label: '质量管理', icon: ManufacturingIcons.quality },
  ];
  
  return (
    <ul>
      {menuItems.map(item => (
        <li key={item.key}>
          {React.createElement(item.icon, { style: { marginRight: 8 } })}
          {item.label}
        </li>
      ))}
    </ul>
  );
};

/**
 * 示例 5: 动态选择图标
 */
export const Example5: React.FC<{ iconType: ManufacturingIconName }> = ({ iconType }) => {
  const IconComponent = ManufacturingIcons[iconType] || ManufacturingIcons.industry;
  
  return <IconComponent size={32} />;
};

/**
 * 示例 6: 在表格列中使用
 */
export const Example6: React.FC = () => {
  const columns = [
    {
      title: '设备类型',
      dataIndex: 'type',
      render: (type: string) => {
        const iconMap: Record<string, React.ComponentType<any>> = {
          machine: ManufacturingIcons.machine,
          robot: ManufacturingIcons.robot,
          conveyor: ManufacturingIcons.conveyorBelt,
        };
        const Icon = iconMap[type] || ManufacturingIcons.equipment;
        return (
          <Space>
            <Icon />
            {type}
          </Space>
        );
      },
    },
  ];
  
  return null; // 仅作示例
};

