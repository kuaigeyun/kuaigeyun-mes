/**
 * 物料批量选择弹窗：关键词搜索、物料分组树筛选、表格多选（跨页缓存）
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App, Input, Modal, Space, Table, TreeSelect } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import { materialApi, materialGroupApi } from '../../apps/master-data/services/material';
import type { Material } from '../../apps/master-data/types/material';

function getMaterialField(m: Record<string, unknown>, field: string): unknown {
  let v = m[field];
  if (v !== undefined && v !== null) return v;
  const snake = field.replace(/([A-Z])/g, '_$1').toLowerCase();
  return m[snake];
}

type TreeNode = { title: string; value: number; key: string; children?: TreeNode[] };

function mapGroupTree(nodes: unknown[]): TreeNode[] {
  if (!Array.isArray(nodes)) return [];
  return nodes.map((raw, idx) => {
    const n = raw as Record<string, unknown>;
    const id = (n.id as number) ?? 0;
    const code = String(n.code ?? '');
    const name = String(n.name ?? '');
    const childrenRaw = n.children as unknown[] | undefined;
    const node: TreeNode = {
      value: id,
      key: `g-${id}-${idx}`,
      title: [code, name].filter(Boolean).join(' ') || String(id),
      children: childrenRaw?.length ? mapGroupTree(childrenRaw) : undefined,
    };
    return node;
  });
}

export interface MaterialBatchPickerModalProps {
  open: boolean;
  onCancel: () => void;
  /** 确认返回已选物料（顺序为选择顺序近似：按确认时 Map 迭代顺序） */
  onConfirm: (materials: Material[]) => void;
}

const PAGE_SIZE = 20;

export const MaterialBatchPickerModal: React.FC<MaterialBatchPickerModalProps> = ({
  open,
  onCancel,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [searchText, setSearchText] = useState('');
  const [groupId, setGroupId] = useState<number | undefined>(undefined);
  const [groupTree, setGroupTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<Material[]>([]);
  const [page, setPage] = useState(1);
  const [totalHint, setTotalHint] = useState(0);
  /** 跨页选中缓存 */
  const [selectedMap, setSelectedMap] = useState<Map<number, Material>>(() => new Map());

  const loadTree = useCallback(async () => {
    try {
      const tree = await materialGroupApi.tree();
      setGroupTree(mapGroupTree(Array.isArray(tree) ? tree : []));
    } catch {
      setGroupTree([]);
      message.error(t('app.kuaizhizao.salesOrder.materialPickerLoadGroupFailed'));
    }
  }, [message, t]);

  const fetchList = useCallback(
    async (kw: string, gid: number | undefined, p: number) => {
      setLoading(true);
      try {
        const skip = (p - 1) * PAGE_SIZE;
        const response: unknown = await materialApi.list({
          keyword: kw.trim() || undefined,
          groupId: gid,
          isActive: true,
          skip,
          limit: PAGE_SIZE,
        });
        const rows = Array.isArray(response)
          ? response
          : (response as { data?: Material[] })?.data ?? [];
        const arr = Array.isArray(rows) ? (rows as Material[]) : [];
        setList(arr);
        setTotalHint(
          arr.length < PAGE_SIZE ? skip + arr.length : skip + arr.length + 1
        );
      } catch {
        setList([]);
        setTotalHint(0);
        message.error(t('app.kuaizhizao.salesOrder.materialPickerLoadListFailed'));
      } finally {
        setLoading(false);
      }
    },
    [message, t]
  );

  const skipNextFilterFetchRef = useRef(false);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    if (!open) return;
    void loadTree();
  }, [open, loadTree]);

  useEffect(() => {
    if (!open) return;
    setSearchText((s) => (s ? '' : s));
    setGroupId(undefined);
    setPage(1);
    setSelectedMap(new Map());
    skipNextFilterFetchRef.current = true;
    void fetchList('', undefined, 1);
  }, [open, fetchList]);

  useEffect(() => {
    if (!openRef.current) return;
    if (skipNextFilterFetchRef.current) {
      skipNextFilterFetchRef.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      if (!openRef.current) return;
      void fetchList(searchText, groupId, page);
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchText, groupId, page, fetchList]);

  const selectedCount = selectedMap.size;

  const selectedRowKeys = useMemo(() => Array.from(selectedMap.keys()), [selectedMap]);

  const rowSelection = useMemo(
    () => ({
      selectedRowKeys,
      onChange: (keys: React.Key[]) => {
        setSelectedMap((prev) => {
          const next = new Map<number, Material>();
          keys.forEach((k) => {
            const id = Number(k);
            const row = list.find((m) => m.id === id) ?? prev.get(id);
            if (row) next.set(id, row);
          });
          return next;
        });
      },
    }),
    [list, selectedRowKeys]
  );

  const columns: ColumnsType<Material> = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.salesOrder.materialCode'),
        width: 120,
        ellipsis: true,
        render: (_, r) => String(getMaterialField(r as any, 'mainCode') ?? (r as any).code ?? ''),
      },
      {
        title: t('app.kuaizhizao.salesOrder.materialName'),
        width: 180,
        ellipsis: true,
        render: (_, r) => String((r as any).name ?? ''),
      },
      {
        title: t('app.kuaizhizao.salesOrder.materialSpec'),
        width: 120,
        ellipsis: true,
        render: (_, r) => String(getMaterialField(r as any, 'specification') ?? ''),
      },
      {
        title: t('app.kuaizhizao.salesOrder.unit'),
        width: 72,
        render: (_, r) => String(getMaterialField(r as any, 'baseUnit') ?? ''),
      },
      {
        title: t('app.kuaizhizao.salesOrder.materialPickerSourceType'),
        width: 100,
        ellipsis: true,
        render: (_, r) =>
          String(
            getMaterialField(r as any, 'sourceType') ??
              (r as any).source_type ??
              ''
          ),
      },
    ],
    [t]
  );

  const handleOk = () => {
    if (selectedMap.size === 0) {
      message.warning(t('app.kuaizhizao.salesOrder.materialPickerNoneSelected'));
      return;
    }
    onConfirm(Array.from(selectedMap.values()));
    setSelectedMap(new Map());
    onCancel();
  };

  const handleCancel = () => {
    setSelectedMap(new Map());
    onCancel();
  };

  return (
    <Modal
      title={t('app.kuaizhizao.salesOrder.materialPickerTitle')}
      open={open}
      onCancel={handleCancel}
      onOk={handleOk}
      width={960}
      destroyOnClose
      okText={t('common.confirm')}
      cancelText={t('common.cancel')}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%', marginBottom: 12 }}>
        <Space wrap style={{ width: '100%' }}>
          <Input.Search
            allowClear
            placeholder={t('app.kuaizhizao.salesOrder.searchMaterialKeyword')}
            style={{ width: 280 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onSearch={(v) => {
              setSearchText(v);
              setPage(1);
            }}
          />
          <TreeSelect
            allowClear
            showSearch
            treeLine
            placeholder={t('app.kuaizhizao.salesOrder.filterByCategory')}
            style={{ minWidth: 260, flex: 1 }}
            treeData={groupTree}
            value={groupId}
            onChange={(v) => {
              setGroupId(v as number | undefined);
              setPage(1);
            }}
            treeNodeFilterProp="title"
          />
        </Space>
        <div style={{ color: 'var(--ant-color-text-secondary)', fontSize: 13 }}>
          {t('app.kuaizhizao.salesOrder.materialPickerSelectedCount', { count: selectedCount })}
        </div>
      </Space>
      <Table<Material>
        size="small"
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={list}
        rowSelection={rowSelection}
        pagination={{
          current: page,
          pageSize: PAGE_SIZE,
          total: totalHint,
          showSizeChanger: false,
          onChange: (p) => setPage(p),
          showTotal: (tot) => t('app.kuaizhizao.salesOrder.materialPickerPageTotal', { total: tot }),
        }}
        scroll={{ x: 720, y: 360 }}
      />
    </Modal>
  );
};

export default MaterialBatchPickerModal;
