# 制造业图标库使用指南

本项目引入了丰富的制造业相关图标，基于 `react-icons` 库，包含多个图标集（Font Awesome、Material Design、Bootstrap Icons、Heroicons）。

## 安装

图标库已包含在项目依赖中，无需额外安装：

```json
{
  "dependencies": {
    "react-icons": "^5.5.0"
  }
}
```

## 快速开始

### 方式 1: 直接使用图标组件

```tsx
import { ManufacturingIcons } from '@/utils/manufacturingIcons';

// 使用工厂图标
<ManufacturingIcons.factory size={24} color="#1890ff" />

// 使用机器图标
<ManufacturingIcons.machine size={24} />

// 使用仓储图标
<ManufacturingIcons.warehouse size={32} color="#52c41a" />
```

### 方式 2: 使用 getManufacturingIcon 函数

```tsx
import { getManufacturingIcon } from '@/utils/manufacturingIcons';

const ProductionIcon = getManufacturingIcon('production', { size: 24 });
const ShippingIcon = getManufacturingIcon('shipping', { size: 24, color: '#1890ff' });

<ProductionIcon />
<ShippingIcon />
```

### 方式 3: 在按钮中使用

```tsx
import { ManufacturingIcons } from '@/utils/manufacturingIcons';
import { Button } from 'antd';

<Button icon={<ManufacturingIcons.maintenance />}>
  设备维护
</Button>
```

## 可用图标列表

### 工厂和设备
- `factory` - 工厂
- `manufacturing` - 制造业
- `industry` - 工业
- `building` - 建筑
- `factoryBuilding` - 工厂建筑

### 机器和设备
- `machine` - 机器
- `equipment` - 设备
- `gear` - 齿轮
- `cogs` - 多个齿轮
- `robot` - 机器人
- `automation` - 自动化

### 工具和维修
- `tool` - 工具
- `tools` - 工具集
- `toolbox` - 工具箱
- `wrench` - 扳手
- `hammer` - 锤子
- `maintenance` - 维护
- `repair` - 维修

### 生产线和装配
- `productionLine` - 生产线
- `assembly` - 装配
- `conveyorBelt` - 传送带
- `production` - 生产

### 仓储和物流
- `warehouse` - 仓库
- `storage` - 存储
- `inventory` - 库存
- `package` - 包裹
- `box` - 箱子
- `boxes` - 多个箱子
- `pallet` - 托盘
- `storagePallet` - 存储托盘
- `dolly` - 手推车
- `dollyFlatbed` - 平板手推车

### 运输和配送
- `truck` - 卡车
- `truckLoading` - 装货卡车
- `truckMoving` - 移动卡车
- `truckPickup` - 皮卡
- `shipping` - 配送
- `shippingFast` - 快速配送

### 能源和动力
- `power` - 电力
- `electricity` - 电力
- `bolt` - 闪电/电力

### 化学和实验室
- `chemical` - 化学
- `lab` - 实验室
- `flask` - 烧瓶
- `furnace` - 熔炉
- `fire` - 火

### 电子和芯片
- `electronics` - 电子
- `microchip` - 芯片

### 安全和质量
- `safety` - 安全
- `hardHat` - 安全帽
- `quality` - 质量
- `shield` - 盾牌
- `inspection` - 检查

### 订单和交付
- `order` - 订单
- `delivery` - 交付
- `receipt` - 收据
- `invoice` - 发票
- `shoppingCart` - 购物车
- `shoppingBag` - 购物袋
- `boxOpen` - 打开的箱子

### 分析和报告
- `analytics` - 分析
- `report` - 报告
- `chartLine` - 折线图
- `chartBar` - 柱状图
- `chartPie` - 饼图

### 清单和检查
- `checklist` - 清单
- `clipboardCheck` - 剪贴板检查
- `clipboardList` - 剪贴板列表

### 状态图标
- `checkCircle` - 成功圆圈
- `timesCircle` - 错误圆圈
- `exclamationTriangle` - 警告三角形

### Material Design 图标（md 前缀）
- `mdFactory` - 工厂
- `mdManufacturing` - 制造业
- `mdBuild` - 构建
- `mdMaintenance` - 维护
- `mdSettings` - 设置
- `mdConfiguration` - 配置
- `mdConstruction` - 建设
- `mdWorkshop` - 车间
- `mdEngineering` - 工程
- `mdDesign` - 设计
- `mdPrecisionManufacturing` - 精密制造
- `mdPrecision` - 精密

### Bootstrap Icons（bs 前缀）
- `bsGear` - 齿轮
- `bsGearFill` - 填充齿轮
- `bsMachine` - 机器
- `bsWrench` - 扳手
- `bsWrenchAdjustable` - 可调扳手
- `bsTools` - 工具
- `bsToolbox` - 工具箱
- `bsHammer` - 锤子
- `bsRepair` - 维修
- `bsBox` - 箱子
- `bsPackage` - 包裹
- `bsBoxSeam` - 接缝箱子
- `bsInventory` - 库存
- `bsTruck` - 卡车
- `bsShipping` - 配送
- `bsPallet` - 托盘
- `bsBuilding` - 建筑
- `bsWarehouse` - 仓库
- `bsFactory` - 工厂

### Heroicons（hi 前缀）
- `hiCog` - 齿轮
- `hiMachine` - 机器
- `hiGear` - 齿轮
- `hiWrench` - 扳手
- `hiMaintenance` - 维护
- `hiCube` - 立方体
- `hiPackage` - 包裹
- `hiTruck` - 卡车
- `hiShipping` - 配送
- `hiBuilding` - 建筑
- `hiFactory` - 工厂
- `hiWarehouse` - 仓库

## 完整示例

```tsx
import React from 'react';
import { ManufacturingIcons, getManufacturingIcon } from '@/utils/manufacturingIcons';
import { Button, Space, Card } from 'antd';

const ManufacturingPage: React.FC = () => {
  return (
    <div>
      <Space>
        {/* 直接使用 */}
        <ManufacturingIcons.factory size={24} />
        <ManufacturingIcons.production size={24} />
        <ManufacturingIcons.warehouse size={24} />
      </Space>

      {/* 在按钮中使用 */}
      <Button icon={<ManufacturingIcons.maintenance />}>
        设备维护
      </Button>

      {/* 在卡片中使用 */}
      <Card
        title={
          <Space>
            <ManufacturingIcons.quality size={20} />
            质量管理
          </Space>
        }
      >
        内容
      </Card>

      {/* 动态选择图标 */}
      {getManufacturingIcon('shipping')({ size: 32 })}
    </div>
  );
};
```

## 图标属性

所有图标都支持标准的 React 组件属性：

- `size` - 图标大小（数字，单位：px）
- `color` - 图标颜色（字符串，如 `"#1890ff"`）
- `style` - 自定义样式对象
- `className` - CSS 类名

## 注意事项

1. 图标来自不同的图标集，样式可能略有不同
2. 建议在同一页面或模块中使用同一图标集的图标，保持视觉一致性
3. 如果找不到合适的图标，可以使用 `ManufacturingIcons.industry` 作为默认图标
4. 所有图标都是 React 组件，可以直接在 JSX 中使用

## 更多图标

如果需要更多图标，可以：

1. 查看 `react-icons` 官方文档：https://react-icons.github.io/react-icons/
2. 直接使用 `react-icons` 中的其他图标集
3. 在 `manufacturingIcons.tsx` 中添加更多图标映射

