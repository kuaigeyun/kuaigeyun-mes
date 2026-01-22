/**
 * iOS风格快捷入口网格组件
 * 
 * 提供快捷入口的网格布局和自定义配置功能
 * 
 * Author: Luigi Lu
 * Date: 2026-01-21
 */

import React, { useState, useMemo } from 'react';
import { Card, Row, Col, Button, Modal, Tree, Space, message, theme } from 'antd';
import { SettingOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { DataNode } from 'antd/es/tree';
import { QuickEntryIcon, type QuickEntryIconProps } from './QuickEntryIcon';

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
}

/**
 * iOS风格快捷入口网格组件
 */
export const QuickEntryGrid: React.FC<QuickEntryGridProps> = ({
  items,
  menuTree = [],
  showConfig = true,
  onSave,
  renderMenuIcon,
  title,
}) => {
  const { token } = useToken();
  const navigate = useNavigate();
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [selectedMenuKeys, setSelectedMenuKeys] = useState<React.Key[]>([]);
  const [editingItems, setEditingItems] = useState<QuickEntryItem[]>(items);

  // 打开配置模态框
  const handleOpenConfig = () => {
    setSelectedMenuKeys(items.map(item => item.menu_uuid));
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
    setSelectedMenuKeys(newItems.map(item => item.menu_uuid));
  };

  // 生成渐变色（根据索引生成不同颜色，颜色稍微淡一点）
  const generateGradient = (index: number): string => {
    // 使用更淡的颜色，通过降低饱和度和添加透明度
    const gradients = [
      'linear-gradient(135deg, rgba(102, 126, 234, 0.7) 0%, rgba(118, 75, 162, 0.6) 100%)',
      'linear-gradient(135deg, rgba(240, 147, 251, 0.7) 0%, rgba(245, 87, 108, 0.6) 100%)',
      'linear-gradient(135deg, rgba(79, 172, 254, 0.7) 0%, rgba(0, 242, 254, 0.6) 100%)',
      'linear-gradient(135deg, rgba(67, 233, 123, 0.7) 0%, rgba(56, 249, 215, 0.6) 100%)',
      'linear-gradient(135deg, rgba(250, 112, 154, 0.7) 0%, rgba(254, 225, 64, 0.6) 100%)',
      'linear-gradient(135deg, rgba(48, 207, 208, 0.7) 0%, rgba(51, 8, 103, 0.6) 100%)',
      'linear-gradient(135deg, rgba(168, 237, 234, 0.7) 0%, rgba(254, 214, 227, 0.6) 100%)',
      'linear-gradient(135deg, rgba(255, 154, 158, 0.7) 0%, rgba(254, 207, 239, 0.6) 100%)',
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
          display: 'flex',
          flexDirection: 'column',
          minHeight: '400px',
        }}
        styles={{
          body: {
            flex: 1,
            overflow: 'auto',
          },
        }}
      >
        <Row gutter={[12, 12]}>
          {editingItems.length > 0 ? (
            editingItems.map((item, index) => (
              <Col xs={12} sm={8} md={6} lg={6} key={item.menu_uuid}>
                <QuickEntryIcon
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
                />
              </Col>
            ))
          ) : (
            <Col span={24}>
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
            </Col>
          )}
        </Row>
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
            checkStrictly
            defaultExpandAll
            style={{ maxHeight: 400, overflow: 'auto' }}
          />
        </div>
      </Modal>
    </>
  );
};

export default QuickEntryGrid;
