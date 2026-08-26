/**
 * 资源分类左栏面板逻辑（接口 / 数据集共用）
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Button, Dropdown } from 'antd';
import { DeleteOutlined, EditOutlined, FolderOutlined, PlusOutlined } from '@ant-design/icons';
import type { DataNode, TreeProps } from 'antd/es/tree';
import type { MenuProps } from 'antd';
import type { LeftPanelConfig } from '../../../components/layout-templates/TwoColumnLayout';
import {
  deleteResourceCategory,
  listResourceCategories,
  RESOURCE_CATEGORY_ALL_KEY,
  RESOURCE_CATEGORY_UNCATEGORIZED_KEY,
  resolveResourceCategoryListFilter,
  type ResourceCategory,
  type ResourceCategoryListFilter,
  type ResourceCategoryType,
} from '../../../services/resourceCategory';
import { ResourceCategoryFormModal } from './ResourceCategoryFormModal';

export interface UseResourceCategoryPanelOptions {
  resourceType: ResourceCategoryType;
  /** 分类切换时同步传入下一筛选条件，避免 reload 早于 state 提交导致列表错位 */
  onSelectionChange?: (nextFilter: ResourceCategoryListFilter) => void;
}

export interface UseResourceCategoryPanelResult {
  leftPanel: LeftPanelConfig;
  listFilter: ResourceCategoryListFilter;
  selectedCategoryKey: string;
  categories: ResourceCategory[];
  categorySelectOptions: { label: string; value: string }[];
  reloadCategories: () => Promise<void>;
  categoryFormModal: React.ReactNode;
}

function withCount(label: string, count?: number): string {
  return typeof count === 'number' && Number.isFinite(count) ? `${label} (${count})` : label;
}

export function useResourceCategoryPanel(
  options: UseResourceCategoryPanelOptions,
): UseResourceCategoryPanelResult {
  const { resourceType, onSelectionChange } = options;
  const { t } = useTranslation();
  const { message: messageApi, modal: modalApi } = App.useApp();

  const [categories, setCategories] = useState<ResourceCategory[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [uncategorizedCount, setUncategorizedCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [selectedCategoryKey, setSelectedCategoryKey] = useState(RESOURCE_CATEGORY_ALL_KEY);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([RESOURCE_CATEGORY_ALL_KEY]);

  const [formOpen, setFormOpen] = useState(false);
  const [formIsEdit, setFormIsEdit] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ResourceCategory | null>(null);

  const reloadCategories = useCallback(async () => {
    try {
      setLoading(true);
      const result = await listResourceCategories(resourceType);
      setCategories(result.items);
      setTotalCount(result.total_count);
      setUncategorizedCount(result.uncategorized_count);
    } catch (error: unknown) {
      const err = error as { message?: string };
      messageApi.error(err?.message || t('pages.system.resourceCategory.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [messageApi, resourceType, t]);

  useEffect(() => {
    void reloadCategories();
  }, [reloadCategories]);

  const handleCreateCategory = useCallback(() => {
    setFormIsEdit(false);
    setEditingCategory(null);
    setFormOpen(true);
  }, []);

  const handleEditCategory = useCallback((category: ResourceCategory) => {
    setFormIsEdit(true);
    setEditingCategory(category);
    setFormOpen(true);
  }, []);

  const handleDeleteCategory = useCallback(
    async (category: ResourceCategory) => {
      try {
        await deleteResourceCategory(resourceType, category.uuid);
        messageApi.success(t('pages.system.resourceCategory.deleteSuccess'));
        if (selectedCategoryKey === category.uuid) {
          const nextKey = RESOURCE_CATEGORY_ALL_KEY;
          setSelectedCategoryKey(nextKey);
          onSelectionChange?.(resolveResourceCategoryListFilter(nextKey));
        }
        await reloadCategories();
      } catch (error: unknown) {
        const err = error as { message?: string };
        messageApi.error(err?.message || t('common.deleteFailed'));
        throw error;
      }
    },
    [messageApi, onSelectionChange, reloadCategories, resourceType, selectedCategoryKey, t],
  );

  const confirmDeleteCategory = useCallback(
    (category: ResourceCategory) => {
      modalApi.confirm({
        title: t('pages.system.resourceCategory.deleteConfirm'),
        okText: t('common.confirm'),
        cancelText: t('common.cancel'),
        okType: 'danger',
        onOk: () => handleDeleteCategory(category),
      });
    },
    [handleDeleteCategory, modalApi, t],
  );

  const getCategoryContextMenu = useCallback(
    (category: ResourceCategory): MenuProps['items'] => [
      {
        key: 'edit',
        icon: <EditOutlined />,
        label: t('common.edit'),
        onClick: () => handleEditCategory(category),
      },
      {
        key: 'delete',
        icon: <DeleteOutlined />,
        label: t('common.delete'),
        danger: true,
        onClick: () => confirmDeleteCategory(category),
      },
    ],
    [confirmDeleteCategory, handleEditCategory, t],
  );

  const treeData = useMemo((): DataNode[] => {
    const keyword = searchValue.trim().toLowerCase();
    const filteredCategories = categories.filter(category => {
      if (!keyword) return true;
      return (
        category.name.toLowerCase().includes(keyword) ||
        category.code.toLowerCase().includes(keyword)
      );
    });

    const allLabel = withCount(t('pages.system.resourceCategory.all'), totalCount);
    const uncategorizedLabel = withCount(
      t('pages.system.resourceCategory.uncategorized'),
      uncategorizedCount,
    );

    return [
      {
        title: allLabel,
        key: RESOURCE_CATEGORY_ALL_KEY,
        icon: <FolderOutlined />,
        children: [
          ...filteredCategories.map(category => ({
            title: withCount(category.name, category.item_count),
            key: category.uuid,
            icon: <FolderOutlined />,
            isLeaf: true,
          })),
          {
            title: uncategorizedLabel,
            key: RESOURCE_CATEGORY_UNCATEGORIZED_KEY,
            icon: <FolderOutlined />,
            isLeaf: true,
          },
        ],
      },
    ];
  }, [categories, searchValue, t, totalCount, uncategorizedCount]);

  const [contextMenuCategory, setContextMenuCategory] = useState<ResourceCategory | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);

  const handleTreeSelect = useCallback<TreeProps['onSelect']>(
    keys => {
      const key = keys[0];
      if (!key) return;
      const nextKey = String(key);
      if (nextKey === selectedCategoryKey) return;
      setSelectedCategoryKey(nextKey);
      onSelectionChange?.(resolveResourceCategoryListFilter(nextKey));
    },
    [onSelectionChange, selectedCategoryKey],
  );

  const listFilter = useMemo(
    () => resolveResourceCategoryListFilter(selectedCategoryKey),
    [selectedCategoryKey],
  );

  const categorySelectOptions = useMemo(
    () =>
      categories.map(category => ({
        label: category.name,
        value: category.uuid,
      })),
    [categories],
  );

  const leftPanel: LeftPanelConfig = {
    width: 300,
    minWidth: 260,
    maxWidth: 420,
    resizable: true,
    search: {
      placeholder: t('pages.system.resourceCategory.searchPlaceholder'),
      value: searchValue,
      onChange: setSearchValue,
      allowClear: true,
    },
    actions: [
      <Button
        key="create-category"
        type="primary"
        icon={<PlusOutlined />}
        block
        onClick={handleCreateCategory}
      >
        {t('pages.system.resourceCategory.createButton')}
      </Button>,
    ],
    tree: {
      treeData,
      selectedKeys: [selectedCategoryKey],
      expandedKeys,
      onExpand: keys => setExpandedKeys(keys),
      onSelect: handleTreeSelect,
      showIcon: true,
      blockNode: true,
      loading,
      loadingTip: t('pages.system.resourceCategory.loading'),
      onRightClick: info => {
        const key = String(info.node.key);
        const category = categories.find(item => item.uuid === key);
        if (!category) return;
        info.event.preventDefault();
        setContextMenuCategory(category);
        setContextMenuPos({ x: info.event.clientX, y: info.event.clientY });
      },
    },
  };

  const categoryFormModal = (
    <>
      <ResourceCategoryFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        resourceType={resourceType}
        isEdit={formIsEdit}
        category={editingCategory}
        onSuccess={() => {
          void reloadCategories();
          onSelectionChange?.(resolveResourceCategoryListFilter(selectedCategoryKey));
        }}
      />
      {contextMenuCategory && contextMenuPos ? (
        <Dropdown
          open
          trigger={['contextMenu']}
          menu={{ items: getCategoryContextMenu(contextMenuCategory) }}
          onOpenChange={open => {
            if (!open) {
              setContextMenuCategory(null);
              setContextMenuPos(null);
            }
          }}
        >
          <div
            style={{
              position: 'fixed',
              left: contextMenuPos.x,
              top: contextMenuPos.y,
              width: 1,
              height: 1,
            }}
          />
        </Dropdown>
      ) : null}
    </>
  );

  return {
    leftPanel,
    listFilter,
    selectedCategoryKey,
    categories,
    categorySelectOptions,
    reloadCategories,
    categoryFormModal,
  };
}
