/**
 * iOS风格快捷入口网格组件
 * 
 * 提供快捷入口的网格布局和自定义配置功能
 * 
 * Author: Luigi Lu
 * Date: 2026-01-21
 */

import React, { useState } from 'react';
import { Card, Button, Modal, Tree, message, theme, Spin } from 'antd';
import { SettingOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { DataNode } from 'antd/es/tree';
import { QuickEntryIcon } from './QuickEntryIcon';

const { useToken } = theme;

export interface QuickEntryItem {
  /** 菜单UUID */
  menu_uuid: string;
  /** 菜单名称 */
  menu_name: string;
  /** 菜单路径 */
  menu_path: string;
  /** 菜单图标 */
  menu_icon?: React.ReactNode;
  /** 排序顺序 */
  sort_order: number;
  /** 背景渐变色（可选） */
  gradient?: string;
}

export interface QuickEntryGridProps {
  /** 快捷入口列表 */
  items: QuickEntryItem[];
  /** 是否处于加载中 */
  loading?: boolean;
  /** 菜单树数据（用于配置选择） */
  menuTree?: DataNode[];
  /** 是否显示配置按钮 */
  showConfig?: boolean;
  /** 保存配置回调 */
  onSave?: (items: QuickEntryItem[]) => Promise<void>;
  /** 渲染菜单图标函数 */
  renderMenuIcon?: (menuUuid: string) => React.ReactNode;
  /** 标题（支持ReactNode，用于添加图标） */
  title?: React.ReactNode;
  /** 是否为深色模式 */
  isDark?: boolean;
}

/**
 * iOS风格快捷入口网格组件
 */
export const QuickEntryGrid: React.FC<QuickEntryGridProps> = ({
  items,
  loading = false,
  menuTree = [],
  showConfig = true,
  onSave,
  renderMenuIcon,
  title,
  isDark = false,
}) => {
  const { token } = useToken();
  const navigate = useNavigate();
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [selectedMenuKeys, setSelectedMenuKeys] = useState<React.Key[]>([]);

  const [editingItems, setEditingItems] = useState<QuickEntryItem[]>(items);
  const displayedItems = configModalVisible ? editingItems : items;

  // 打开配置模态框
  const handleOpenConfig = () => {
    const keys = items.map(item => item.menu_uuid);
    setSelectedMenuKeys(keys);
    setEditingItems([...items]);
    setConfigModalVisible(true);
  };

  // 保存配置
  const handleSaveConfig = async () => {
    if (!onSave) {
      message.warning('未提供保存回调函数');
      return;
    }

    // 从选中的菜单项构建快捷入口列表
    const newItems: QuickEntryItem[] = selectedMenuKeys
      .map((key, index) => {
        // 查找菜单树中的对应项
        const findMenuInTree = (nodes: DataNode[], uuid: string): DataNode | null => {
          for (const node of nodes) {
            if (node.key === uuid) {
              return node;
            }
            if (node.children) {
              const found = findMenuInTree(node.children, uuid);
              if (found) return found;
            }
          }
          return null;
        };

        const menu = findMenuInTree(menuTree, key as string);
        if (!menu || !(menu as any).path) return null; // 必须有path才能添加

        // 检查是否已存在
        const existing = editingItems.find(item => item.menu_uuid === key);
        if (existing) {
          return { ...existing, sort_order: index };
        }

        return {
          menu_uuid: key as string,
          menu_name: (menu.title as string) || '',
          menu_path: (menu as any).path || '',
          menu_icon: renderMenuIcon ? renderMenuIcon(key as string) : undefined,
          sort_order: index,
        };
      })
      .filter((item): item is QuickEntryItem => item !== null);

    try {
      await onSave(newItems);
      setEditingItems(newItems);
      setConfigModalVisible(false);
      message.success('快捷入口配置已保存');
    } catch (error: any) {
      message.error(`保存失败: ${error.message || '未知错误'}`);
    }
  };

  // 删除快捷入口（编辑模式下）
  const handleDeleteItem = (menuUuid: string) => {
    const newItems = editingItems.filter(item => item.menu_uuid !== menuUuid);
    setEditingItems(newItems);
    const keys = newItems.map(item => item.menu_uuid);
    setSelectedMenuKeys(keys);
  };

  // 右键快捷删除（非编辑态）
  const handleDeleteByContextMenu = (targetItem: QuickEntryItem) => {
    Modal.confirm({
      title: '删除快捷方式',
      content: `确定要删除“${targetItem.menu_name}”吗？`,
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        const newItems = displayedItems
          .filter(item => item.menu_uuid !== targetItem.menu_uuid)
          .map((item, index) => ({ ...item, sort_order: index }));

        if (onSave) {
          await onSave(newItems);
        }
        setEditingItems(newItems);
        const keys = newItems.map(item => item.menu_uuid);
        setSelectedMenuKeys(keys);
        message.success('快捷方式已删除');
      },
    });
  };

  // 生成渐变色（深浅色模式分别优化）
  const generateGradient = (index: number): string => {
    if (isDark) {
      // 深色模式：使用略带透明度或更深邃、低饱和度的渐变，呈现“发光”感而非“色块”感
      const darkGradients = [
        'linear-gradient(135deg, #0A4A8F 0%, #06305C 100%)', // 深蓝
        'linear-gradient(135deg, #3C3A8F 0%, #29285C 100%)', // 深靛
        'linear-gradient(135deg, #7A3A9F 0%, #52286B 100%)', // 深紫
        'linear-gradient(135deg, #8F1A35 0%, #5C1122 100%)', // 深粉
        'linear-gradient(135deg, #A1223C 0%, #691627 100%)', // 深玫
        'linear-gradient(135deg, #8F5906 0%, #5C3A04 100%)', // 深橙
        'linear-gradient(135deg, #8F7200 0%, #5C4A00 100%)', // 深黄
        'linear-gradient(135deg, #1A6B3E 0%, #114528 100%)', // 深绿
        'linear-gradient(135deg, #006B66 0%, #004542 100%)', // 深薄荷
        'linear-gradient(135deg, #2D6B82 0%, #1D4554 100%)', // 深天空
        'linear-gradient(135deg, #6B5941 0%, #453A2A 100%)', // 深沙金
        'linear-gradient(135deg, #3E4E8F 0%, #28325C 100%)', // 深冷紫
        'linear-gradient(135deg, #1D6B30 0%, #13451F 100%)', // 深青草
        'linear-gradient(135deg, #8F3C3C 0%, #5C2626 100%)', // 深珊瑚
        'linear-gradient(135deg, #21457A 0%, #152C4D 100%)', // 深海洋
      ];
      return darkGradients[index % darkGradients.length];
    }
    
    const gradients = [
      'linear-gradient(135deg, #0A84FF 0%, #5AC8FA 100%)', // iOS 蓝
      'linear-gradient(135deg, #5E5CE6 0%, #7D7AFF 100%)', // iOS 靛蓝
      'linear-gradient(135deg, #BF5AF2 0%, #DA8FFF 100%)', // iOS 紫
      'linear-gradient(135deg, #FF2D55 0%, #FF6482 100%)', // iOS 粉红
      'linear-gradient(135deg, #FF375F 0%, #FF7A95 100%)', // 玫红
      'linear-gradient(135deg, #FF9F0A 0%, #FFC15A 100%)', // iOS 橙
      'linear-gradient(135deg, #FFCC00 0%, #FFE066 100%)', // iOS 黄
      'linear-gradient(135deg, #30D158 0%, #6DE28A 100%)', // iOS 绿
      'linear-gradient(135deg, #00C7BE 0%, #5EDFD7 100%)', // iOS 薄荷
      'linear-gradient(135deg, #64D2FF 0%, #9BE4FF 100%)', // 天空蓝
      'linear-gradient(135deg, #AC8E68 0%, #C8A983 100%)', // 沙金
      'linear-gradient(135deg, #6C8CF5 0%, #9AAEF9 100%)', // 冷紫蓝
      'linear-gradient(135deg, #34C759 0%, #7FDF95 100%)', // 青草绿
      'linear-gradient(135deg, #FF6B6B 0%, #FF9A8B 100%)', // 珊瑚红
      'linear-gradient(135deg, #3A7BD5 0%, #6FB1FC 100%)', // 海洋蓝
    ];
    return gradients[index % gradients.length];
  };

  return (
    <>
      <Card
        title={title || "快捷入口"}
        extra={
          showConfig && (
            <Button
              type="text"
              size="small"
              icon={<SettingOutlined />}
              onClick={handleOpenConfig}
            >
              自定义
            </Button>
          )
        }
        style={{
          width: '100%',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: token.borderRadiusLG,
          boxShadow: token.boxShadowTertiary,
        }}
        styles={{
          body: {
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <div style={{ width: '100%', flex: 1, minHeight: 0 }}>
          {loading ? (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Spin size="small" />
            </div>
          ) : displayedItems.length > 0 ? (
            <div 
              style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))',
                gap: '16px 8px' 
              }}
            >
              {displayedItems.map((item, index) => (
                <QuickEntryIcon
                  key={item.menu_uuid}
                  icon={item.menu_icon || <PlusOutlined />}
                  title={item.menu_name}
                  onClick={() => {
                    if (item.menu_path) {
                      navigate(item.menu_path);
                    }
                  }}
                  gradient={item.gradient || generateGradient(index)}
                  editable={configModalVisible}
                  onDelete={() => handleDeleteItem(item.menu_uuid)}
                  onContextDelete={() => handleDeleteByContextMenu(item)}
                />
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: token.colorTextSecondary }}>
              <p>暂无快捷入口</p>
              <Button
                type="link"
                icon={<PlusOutlined />}
                onClick={handleOpenConfig}
              >
                添加快捷入口
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* 配置模态框 */}
      <Modal
        title="自定义快捷入口"
        open={configModalVisible}
        onOk={handleSaveConfig}
        onCancel={() => setConfigModalVisible(false)}
        okText="保存"
        cancelText="取消"
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <p style={{ color: token.colorTextSecondary, marginBottom: 16 }}>
            请选择要添加到快捷入口的菜单项。只能选择有路径的菜单项。
          </p>
          <Tree
            checkable
            checkedKeys={selectedMenuKeys}
            onCheck={(checkedKeys) => {
              setSelectedMenuKeys(checkedKeys as React.Key[]);
            }}
            treeData={menuTree}
            defaultExpandAll
            style={{ maxHeight: 400, overflow: 'auto' }}
          />
        </div>
      </Modal>
    </>
  );
};

export default QuickEntryGrid;
