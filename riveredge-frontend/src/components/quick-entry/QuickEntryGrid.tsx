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
import { useTranslation } from 'react-i18next';
import type { DataNode } from 'antd/es/tree';
import { QuickEntryIcon } from './QuickEntryIcon';
import { generateQuickEntryGradient, type QuickEntryThemeStyle } from './quickEntryGradients';
import { useThemeStore } from '../../stores/themeStore';

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
  const { t } = useTranslation();
  const { token } = useToken();
  const navigate = useNavigate();
  const themeStyle = useThemeStore((s) => s.resolved.themeStyle) as QuickEntryThemeStyle;
  const isPlain = themeStyle === 'plain';
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
      message.warning(t('pages.dashboard.quickEntryNoSaveCallback'));
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
      message.success(t('pages.dashboard.quickEntrySaved'));
    } catch (error: any) {
      message.error(
        t('pages.dashboard.quickEntrySaveFailed', {
          message: error.message || t('pages.dashboard.unknownError'),
        }),
      );
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
      title: t('pages.dashboard.quickEntryDeleteTitle'),
      content: t('pages.dashboard.quickEntryDeleteConfirm', { name: targetItem.menu_name }),
      okText: t('common.delete'),
      cancelText: t('common.cancel'),
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
        message.success(t('pages.dashboard.quickEntryDeleted'));
      },
    });
  };

  return (
    <>
      <div className="dashboard-section dashboard-quick-entry-section">
        <div className="dashboard-section__head">
          <div className="dashboard-section__title">{title || t('pages.dashboard.quickEntry')}</div>
          {showConfig ? (
            <div className="dashboard-section__extra">
              <Button
                type="link"
                size="small"
                icon={<SettingOutlined />}
                onClick={handleOpenConfig}
              >
                {t('pages.dashboard.quickEntryCustomize')}
              </Button>
            </div>
          ) : null}
        </div>
        <Card
          variant="borderless"
          className="dashboard-section__card"
          style={{
            borderRadius: token.borderRadiusLG,
          }}
        >
        <div className="quick-entry-grid-wrap">
          {loading ? (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Spin size="small" />
            </div>
          ) : displayedItems.length > 0 ? (
            <div
              className="quick-entry-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))',
                gap: '14px 6px',
                minWidth: 0,
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
                  gradient={
                    isPlain
                      ? generateQuickEntryGradient(index, isDark, 'plain')
                      : item.gradient || generateQuickEntryGradient(index, isDark, 'vivid')
                  }
                  plain={isPlain}
                  editable={configModalVisible}
                  onDelete={() => handleDeleteItem(item.menu_uuid)}
                  onContextDelete={() => handleDeleteByContextMenu(item)}
                />
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: token.colorTextSecondary }}>
              <p>{t('pages.dashboard.quickEntryEmpty')}</p>
              <Button
                type="link"
                icon={<PlusOutlined />}
                onClick={handleOpenConfig}
              >
                {t('pages.dashboard.quickEntryAdd')}
              </Button>
            </div>
          )}
        </div>
      </Card>
      </div>

      {/* 配置模态框 */}
      <Modal
        title={t('pages.dashboard.configQuickEntry')}
        open={configModalVisible}
        onOk={handleSaveConfig}
        onCancel={() => setConfigModalVisible(false)}
        okText={t('pages.dashboard.save')}
        cancelText={t('common.cancel')}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <p style={{ color: token.colorTextSecondary, marginBottom: 16 }}>
            {t('pages.dashboard.configQuickEntryHint')}
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
