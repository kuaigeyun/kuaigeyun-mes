/**
 * 快捷操作组件
 *
 * 提供常用操作的快捷方式，减少操作步骤。
 *
 * @author Auto (AI Assistant)
 * @date 2026-01-27
 */

import React, { useState, useEffect } from 'react';
import { Button, Dropdown, Menu, Space, Tooltip, Modal } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  ExportOutlined,
  ImportOutlined,
  CopyOutlined,
  MoreOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { QuickActionHelper, QuickActionConfig, OperationHistory } from '@/utils/quickActions';
import type { MenuProps } from 'antd';

interface QuickActionsProps {
  /** 模块名称 */
  module: string;
  /** 是否显示创建按钮 */
  showCreate?: boolean;
  /** 是否显示编辑按钮 */
  showEdit?: boolean;
  /** 是否显示删除按钮 */
  showDelete?: boolean;
  /** 是否显示查看按钮 */
  showView?: boolean;
  /** 是否显示导出按钮 */
  showExport?: boolean;
  /** 是否显示导入按钮 */
  showImport?: boolean;
  /** 是否显示复制按钮 */
  showCopy?: boolean;
  /** 是否显示更多操作 */
  showMore?: boolean;
  /** 是否显示操作历史 */
  showHistory?: boolean;
  /** 创建操作处理函数 */
  onCreate?: () => void;
  /** 编辑操作处理函数 */
  onEdit?: () => void;
  /** 删除操作处理函数 */
  onDelete?: () => void;
  /** 查看操作处理函数 */
  onView?: () => void;
  /** 导出操作处理函数 */
  onExport?: () => void;
  /** 导入操作处理函数 */
  onImport?: () => void;
  /** 复制操作处理函数 */
  onCopy?: () => void;
  /** 更多操作菜单项 */
  moreActions?: MenuProps['items'];
  /** 按钮大小 */
  size?: 'small' | 'middle' | 'large';
  /** 按钮类型 */
  type?: 'default' | 'primary' | 'dashed' | 'link' | 'text';
}

/**
 * 快捷操作组件
 */
const QuickActions: React.FC<QuickActionsProps> = ({
  module,
  showCreate = true,
  showEdit = false,
  showDelete = false,
  showView = false,
  showExport = false,
  showImport = false,
  showCopy = false,
  showMore = false,
  showHistory = true,
  onCreate,
  onEdit,
  onDelete,
  onView,
  onExport,
  onImport,
  onCopy,
  moreActions = [],
  size = 'middle',
  type = 'default',
}) => {
  const [recentActions, setRecentActions] = useState<QuickActionConfig[]>([]);
  const [historyVisible, setHistoryVisible] = useState(false);

  useEffect(() => {
    // 加载最近使用的操作
    if (showHistory) {
      const recent = QuickActionHelper.getRecentActions(5);
      setRecentActions(recent);
    }
  }, [showHistory]);

  // 注册快捷操作
  useEffect(() => {
    if (onCreate) {
      QuickActionHelper.register(`${module}_create`, {
        type: 'create',
        name: '创建',
        icon: 'plus',
        handler: onCreate,
      });
    }
    if (onEdit) {
      QuickActionHelper.register(`${module}_edit`, {
        type: 'edit',
        name: '编辑',
        icon: 'edit',
        handler: onEdit,
      });
    }
    if (onDelete) {
      QuickActionHelper.register(`${module}_delete`, {
        type: 'delete',
        name: '删除',
        icon: 'delete',
        handler: onDelete,
      });
    }
    if (onView) {
      QuickActionHelper.register(`${module}_view`, {
        type: 'view',
        name: '查看',
        icon: 'eye',
        handler: onView,
      });
    }
    if (onExport) {
      QuickActionHelper.register(`${module}_export`, {
        type: 'export',
        name: '导出',
        icon: 'export',
        handler: onExport,
      });
    }
    if (onImport) {
      QuickActionHelper.register(`${module}_import`, {
        type: 'import',
        name: '导入',
        icon: 'import',
        handler: onImport,
      });
    }
    if (onCopy) {
      QuickActionHelper.register(`${module}_copy`, {
        type: 'copy',
        name: '复制',
        icon: 'copy',
        handler: onCopy,
      });
    }
  }, [module, onCreate, onEdit, onDelete, onView, onExport, onImport, onCopy]);

  // 获取操作历史
  const getOperationHistory = () => {
    const history = OperationHistory.getRecent(module, 10);
    return history;
  };

  // 显示操作历史
  const showOperationHistory = () => {
    const history = getOperationHistory();
    Modal.info({
      title: '操作历史',
      width: 600,
      content: (
        <div>
          {history.length === 0 ? (
            <p>暂无操作历史</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {history.map((item, index) => (
                <li key={index} style={{ marginBottom: 8, padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>
                      <strong>{item.action}</strong> - {item.module}
                    </span>
                    <span style={{ color: '#999', fontSize: '12px' }}>
                      {new Date(item.timestamp).toLocaleString()}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ),
    });
  };

  // 构建更多操作菜单
  const buildMoreMenu = (): MenuProps['items'] => {
    const items: MenuProps['items'] = [];

    if (showHistory && recentActions.length > 0) {
      items.push({
        key: 'history',
        label: '最近操作',
        icon: <HistoryOutlined />,
        children: recentActions.map((action, index) => ({
          key: `recent_${index}`,
          label: action.name,
          onClick: () => QuickActionHelper.execute(`${module}_${action.type}`),
        })),
      });
      items.push({ type: 'divider' });
    }

    if (moreActions && moreActions.length > 0) {
      items.push(...moreActions);
    }

    if (showHistory) {
      items.push({ type: 'divider' });
      items.push({
        key: 'view_history',
        label: '查看全部历史',
        icon: <HistoryOutlined />,
        onClick: showOperationHistory,
      });
    }

    return items;
  };

  return (
    <Space>
      {showCreate && onCreate && (
        <Tooltip title="创建">
          <Button
            type={type === 'default' ? 'primary' : type}
            icon={<PlusOutlined />}
            size={size}
            onClick={onCreate}
          >
            创建
          </Button>
        </Tooltip>
      )}

      {showEdit && onEdit && (
        <Tooltip title="编辑">
          <Button
            type={type}
            icon={<EditOutlined />}
            size={size}
            onClick={onEdit}
          >
            编辑
          </Button>
        </Tooltip>
      )}

      {showDelete && onDelete && (
        <Tooltip title="删除">
          <Button
            type={type}
            icon={<DeleteOutlined />}
            size={size}
            danger
            onClick={onDelete}
          >
            删除
          </Button>
        </Tooltip>
      )}

      {showView && onView && (
        <Tooltip title="查看">
          <Button
            type={type}
            icon={<EyeOutlined />}
            size={size}
            onClick={onView}
          >
            查看
          </Button>
        </Tooltip>
      )}

      {showExport && onExport && (
        <Tooltip title="导出">
          <Button
            type={type}
            icon={<ExportOutlined />}
            size={size}
            onClick={onExport}
          >
            导出
          </Button>
        </Tooltip>
      )}

      {showImport && onImport && (
        <Tooltip title="导入">
          <Button
            type={type}
            icon={<ImportOutlined />}
            size={size}
            onClick={onImport}
          >
            导入
          </Button>
        </Tooltip>
      )}

      {showCopy && onCopy && (
        <Tooltip title="复制">
          <Button
            type={type}
            icon={<CopyOutlined />}
            size={size}
            onClick={onCopy}
          >
            复制
          </Button>
        </Tooltip>
      )}

      {showMore && (
        <Dropdown menu={{ items: buildMoreMenu() }} trigger={['click']}>
          <Button type={type} icon={<MoreOutlined />} size={size}>
            更多
          </Button>
        </Dropdown>
      )}
    </Space>
  );
};

export default QuickActions;
