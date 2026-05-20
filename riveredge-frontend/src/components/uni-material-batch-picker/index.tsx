/**
 * UniMaterialBatchPicker — 统一多选物料弹窗
 *
 * 标题行集成搜索 / 分类 / 来源筛选；表格跨页多选；请求序号防竞态。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App, Flex, Input, Modal, Select, Table, TreeSelect } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import { materialApi, materialGroupApi } from '../../apps/master-data/services/material';
import type { Material } from '../../apps/master-data/types/material';
import { SecureImage } from '../secure-image';
import { getDataDictionaryByCode, getDictionaryItemList } from '../../services/dataDictionary';
import type { UniMaterialBatchPickerProps } from './types';
import { getMaterialField, mapMaterialGroupTree, type MaterialGroupTreeNode } from './utils';

export type { UniMaterialBatchPickerProps } from './types';

const PAGE_SIZE = 20;
const DEFAULT_WIDTH = 1000;
/** 标题行筛选项宽度（与 common 占位文案匹配，避免省略号截断） */
const FILTER_SEARCH_WIDTH = 236;
const FILTER_GROUP_WIDTH = 136;
const FILTER_SOURCE_WIDTH = 116;

export const UniMaterialBatchPicker: React.FC<UniMaterialBatchPickerProps> = ({
  open,
  onCancel,
  onConfirm,
  zIndex,
  width = DEFAULT_WIDTH,
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [searchText, setSearchText] = useState('');
  const [groupId, setGroupId] = useState<number | undefined>(undefined);
  const [sourceType, setSourceType] = useState<string | undefined>(undefined);
  const [groupTree, setGroupTree] = useState<MaterialGroupTreeNode[]>([]);
  const [unitsMap, setUnitsMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<Material[]>([]);
  const [page, setPage] = useState(1);
  const [totalHint, setTotalHint] = useState(0);
  const [selectedMap, setSelectedMap] = useState<Map<number, Material>>(() => new Map());

  const loadUnits = useCallback(async () => {
    try {
      const dict = await getDataDictionaryByCode('MATERIAL_UNIT');
      const items = await getDictionaryItemList(dict.uuid, true);
      const map: Record<string, string> = {};
      items.forEach((item) => {
        map[item.value] = item.label;
      });
      setUnitsMap(map);
    } catch (error) {
      console.error('Failed to load material units dictionary:', error);
    }
  }, []);

  const loadTree = useCallback(async () => {
    try {
      const tree = await materialGroupApi.tree();
      setGroupTree(mapMaterialGroupTree(Array.isArray(tree) ? tree : []));
    } catch {
      setGroupTree([]);
      message.error(t('app.kuaizhizao.salesOrder.materialPickerLoadGroupFailed'));
    }
  }, [message, t]);

  const fetchSeqRef = useRef(0);

  const fetchList = useCallback(
    async (kw: string, gid: number | undefined, st: string | undefined, p: number) => {
      const seq = ++fetchSeqRef.current;
      setLoading(true);
      try {
        const skip = (p - 1) * PAGE_SIZE;
        const response: unknown = await materialApi.list({
          keyword: kw.trim() || undefined,
          groupId: gid,
          sourceType: st,
          isActive: true,
          skip,
          limit: PAGE_SIZE,
        });
        if (seq !== fetchSeqRef.current) return;
        let arr: Material[] = [];
        let totalFromApi: number | undefined;
        if (Array.isArray(response)) {
          arr = response as Material[];
        } else if (response && typeof response === 'object') {
          const r = response as { items?: Material[]; data?: Material[]; total?: number };
          const rows = r.items ?? r.data;
          arr = Array.isArray(rows) ? rows : [];
          totalFromApi = typeof r.total === 'number' ? r.total : undefined;
        }
        setList(arr);
        if (totalFromApi != null && totalFromApi >= 0) {
          setTotalHint(totalFromApi);
        } else {
          setTotalHint(arr.length < PAGE_SIZE ? skip + arr.length : skip + arr.length + 1);
        }
      } catch {
        if (seq !== fetchSeqRef.current) return;
        setList([]);
        setTotalHint(0);
        message.error(t('app.kuaizhizao.salesOrder.materialPickerLoadListFailed'));
      } finally {
        if (seq === fetchSeqRef.current) {
          setLoading(false);
        }
      }
    },
    [message, t],
  );

  const skipNextFilterFetchRef = useRef(false);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    if (!open) return;
    void loadTree();
    void loadUnits();
  }, [open, loadTree, loadUnits]);

  useEffect(() => {
    if (!open) {
      fetchSeqRef.current += 1;
      return;
    }
    setSearchText((s) => (s ? '' : s));
    setGroupId(undefined);
    setSourceType(undefined);
    setPage(1);
    setSelectedMap(new Map());
    skipNextFilterFetchRef.current = true;
    void fetchList('', undefined, undefined, 1);
  }, [open, fetchList]);

  useEffect(() => {
    if (!openRef.current) return;
    if (skipNextFilterFetchRef.current) {
      skipNextFilterFetchRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      if (!openRef.current) return;
      void fetchList(searchText, groupId, sourceType, page);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchText, groupId, sourceType, page, fetchList]);

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
    [list, selectedRowKeys],
  );

  const columns: ColumnsType<Material> = useMemo(
    () => [
      {
        title: t('app.master-data.materials.productImage'),
        width: 80,
        render: (_, record) => {
          const images = (record as { images?: Array<{ uid?: string; uuid?: string } | string> }).images || [];
          if (images.length > 0) {
            const firstImage = images[0];
            const fileUuid =
              typeof firstImage === 'object' && firstImage != null
                ? (firstImage.uid ?? firstImage.uuid ?? null)
                : typeof firstImage === 'string'
                  ? firstImage
                  : null;
            if (fileUuid) {
              return <SecureImage fileUuid={fileUuid} width={40} height={40} />;
            }
          }
          return '-';
        },
      },
      {
        title: t('app.kuaizhizao.salesOrder.materialCode'),
        width: 120,
        ellipsis: true,
        render: (_, r) => String(getMaterialField(r as Record<string, unknown>, 'mainCode') ?? (r as { code?: string }).code ?? ''),
      },
      {
        title: t('app.kuaizhizao.salesOrder.materialName'),
        width: 180,
        ellipsis: true,
        render: (_, r) => String((r as { name?: string }).name ?? ''),
      },
      {
        title: t('app.kuaizhizao.salesOrder.materialSpec'),
        width: 120,
        ellipsis: true,
        render: (_, r) => String(getMaterialField(r as Record<string, unknown>, 'specification') ?? ''),
      },
      {
        title: t('app.kuaizhizao.salesOrder.unit'),
        width: 72,
        render: (_, r) => {
          const val = String(getMaterialField(r as Record<string, unknown>, 'baseUnit') ?? '');
          return unitsMap[val] || val || '-';
        },
      },
      {
        title: t('app.kuaizhizao.salesOrder.materialPickerSourceType'),
        width: 100,
        ellipsis: true,
        render: (_, r) => {
          const rec = r as Record<string, unknown>;
          const val = (getMaterialField(rec, 'sourceType') ?? rec.source_type) as string;
          const sourceLabels: Record<string, string> = {
            Make: t('app.master-data.materialForm.sourceMake'),
            Buy: t('app.master-data.materialForm.sourceBuy'),
            Outsource: t('app.master-data.materialForm.sourceOutsource'),
            Phantom: t('app.master-data.materialForm.sourcePhantom'),
            Service: t('app.master-data.materialForm.sourceService'),
          };
          return sourceLabels[val] || val || '-';
        },
      },
    ],
    [t, unitsMap],
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

  const popupContainer = (node: HTMLElement) => node.closest('.ant-modal-wrap') ?? document.body;

  const modalTitle = (
    <Flex
      align="center"
      gap={12}
      wrap="wrap"
      style={{ width: '100%', paddingRight: 28, fontWeight: 'normal' }}
    >
      <span style={{ fontWeight: 600, flexShrink: 0 }}>
        {t('app.kuaizhizao.salesOrder.materialPickerTitle')}
      </span>
      <Flex gap={8} wrap="wrap" align="center" style={{ flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>
        <Input.Search
          allowClear
          placeholder={t('app.kuaizhizao.common.materialBatchSearchPlaceholder')}
          style={{ width: FILTER_SEARCH_WIDTH }}
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
          placeholder={t('app.kuaizhizao.common.materialBatchGroupPlaceholder')}
          style={{ width: FILTER_GROUP_WIDTH }}
          treeData={groupTree}
          value={groupId}
          onChange={(v) => {
            setGroupId(v as number | undefined);
            setPage(1);
          }}
          treeNodeFilterProp="title"
          getPopupContainer={popupContainer}
        />
        <Select
          allowClear
          placeholder={t('app.kuaizhizao.common.materialBatchSourcePlaceholder')}
          style={{ width: FILTER_SOURCE_WIDTH }}
          value={sourceType}
          onChange={(v) => {
            setSourceType(v);
            setPage(1);
          }}
          getPopupContainer={popupContainer}
          options={[
            { label: t('app.master-data.materialForm.sourceMake'), value: 'Make' },
            { label: t('app.master-data.materialForm.sourceBuy'), value: 'Buy' },
            { label: t('app.master-data.materialForm.sourceOutsource'), value: 'Outsource' },
            { label: t('app.master-data.materialForm.sourcePhantom'), value: 'Phantom' },
            { label: t('app.master-data.materialForm.sourceService'), value: 'Service' },
          ]}
        />
      </Flex>
    </Flex>
  );

  return (
    <Modal
      title={modalTitle}
      styles={{ header: { marginBottom: 0 }, body: { paddingTop: 12 } }}
      open={open}
      onCancel={handleCancel}
      onOk={handleOk}
      zIndex={zIndex}
      width={width}
      destroyOnHidden
      okText={t('common.confirm')}
      cancelText={t('common.cancel')}
    >
      <div style={{ color: 'var(--ant-color-text-secondary)', fontSize: 13, marginBottom: 12 }}>
        {t('app.kuaizhizao.salesOrder.materialPickerSelectedCount', { count: selectedCount })}
      </div>
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

export default UniMaterialBatchPicker;
