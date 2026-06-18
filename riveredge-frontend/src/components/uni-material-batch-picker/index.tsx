/**
 * UniMaterialBatchPicker — 统一多选物料弹窗
 *
 * 内容区集成搜索 / 分类 / 来源筛选；表格跨页多选；请求序号防竞态。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App, Flex, Input, Modal, Select, Table, Tooltip, TreeSelect, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import {
  ReferenceDisplayAccessError,
  searchReferenceDisplay,
} from '../../utils/referenceDisplay';
import { materialGroupApi } from '../../apps/master-data/services/material';
import type { Material } from '../../apps/master-data/types/material';
import { SecureImage } from '../secure-image';
import { UniTableStackedPrimaryCell } from '../uni-table/stackedPrimaryColumn';
import { getDataDictionaryByCode, getDictionaryItemList } from '../../services/dataDictionary';
import type { UniMaterialBatchPickerProps } from './types';
import {
  fetchBatchMaterialHasBom,
  fetchBatchMaterialInventory,
  getMaterialField,
  mapMaterialGroupTree,
  type MaterialGroupTreeNode,
} from './utils';
import { getMaterialSourceTypeLabel } from '../../apps/master-data/utils/materialSourceType';

export type { UniMaterialBatchPickerProps } from './types';

const PAGE_SIZE = 20;
const DEFAULT_WIDTH = 1120;

function resolveMaterialImageFileUuid(raw: unknown): string | null {
  if (typeof raw === 'string') {
    const val = raw.trim();
    return /^[0-9a-fA-F-]{32,36}$/.test(val) ? val : null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as { uuid?: unknown; uid?: unknown };
  const uuid = typeof obj.uuid === 'string' ? obj.uuid.trim() : '';
  if (/^[0-9a-fA-F-]{32,36}$/.test(uuid)) return uuid;
  const uid = typeof obj.uid === 'string' ? obj.uid.trim() : '';
  if (/^[0-9a-fA-F-]{32,36}$/.test(uid)) return uid;
  return null;
}

export const UniMaterialBatchPicker: React.FC<UniMaterialBatchPickerProps> = ({
  open,
  onCancel,
  onConfirm,
  zIndex,
  width = DEFAULT_WIDTH,
  hostResource,
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const [searchDraft, setSearchDraft] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [groupId, setGroupId] = useState<number | undefined>(undefined);
  const [sourceType, setSourceType] = useState<string | undefined>(undefined);
  const [groupTree, setGroupTree] = useState<MaterialGroupTreeNode[]>([]);
  const [unitsMap, setUnitsMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<Material[]>([]);
  const [page, setPage] = useState(1);
  const [totalHint, setTotalHint] = useState(0);
  const [selectedMap, setSelectedMap] = useState<Map<number, Material>>(() => new Map());
  const [bomMap, setBomMap] = useState<Record<number, boolean>>({});
  const [inventoryMap, setInventoryMap] = useState<Record<number, number>>({});
  const [indicatorsLoading, setIndicatorsLoading] = useState(false);

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
  const indicatorSeqRef = useRef(0);

  const fetchList = useCallback(
    async (kw: string, gid: number | undefined, st: string | undefined, p: number) => {
      const seq = ++fetchSeqRef.current;
      setLoading(true);
      try {
        const res = await searchReferenceDisplay({
          resource: 'master-data:material',
          hostResource,
          keyword: kw.trim() || undefined,
          page: p,
          pageSize: PAGE_SIZE,
          groupId: gid,
          sourceType: st,
        });
        if (seq !== fetchSeqRef.current) return;
        const arr: Material[] = res.items.map((item) => ({
          id: item.id as number,
          uuid: item.uuid ?? '',
          name: item.name ?? '',
          code: item.code ?? undefined,
          mainCode: (item.extra?.main_code as string) ?? item.code ?? '',
          specification: (item.extra?.specification as string) ?? undefined,
          baseUnit: (item.extra?.base_unit as string) ?? undefined,
          sourceType: (item.extra?.source_type as string) ?? undefined,
          groupId: item.extra?.group_id as number | undefined,
        }));
        setList(arr);
        setTotalHint(res.total);
      } catch (err) {
        if (seq !== fetchSeqRef.current) return;
        setList([]);
        setTotalHint(0);
        if (err instanceof ReferenceDisplayAccessError) {
          message.warning(err.message);
        } else {
          message.error(t('app.kuaizhizao.salesOrder.materialPickerLoadListFailed'));
        }
      } finally {
        if (seq === fetchSeqRef.current) {
          setLoading(false);
        }
      }
    },
    [hostResource, message, t],
  );

  useEffect(() => {
    if (!open) return;
    void loadTree();
    void loadUnits();
  }, [open, loadTree, loadUnits]);

  /** 打开弹窗：重置筛选与选中；关闭时取消在途请求 */
  useEffect(() => {
    if (!open) {
      fetchSeqRef.current += 1;
      indicatorSeqRef.current += 1;
      return;
    }
    setSearchDraft('');
    setSearchKeyword('');
    setGroupId(undefined);
    setSourceType(undefined);
    setPage(1);
    setSelectedMap(new Map());
  }, [open]);

  /** 筛选 / 分页变化时拉列表（open 纳入依赖，保证首次打开也会请求） */
  useEffect(() => {
    if (!open) return;
    void fetchList(searchKeyword, groupId, sourceType, page);
  }, [open, searchKeyword, groupId, sourceType, page, fetchList]);

  /** 当前页物料：批量拉取 BOM 与可用库存 */
  useEffect(() => {
    if (!open || list.length === 0) {
      setBomMap({});
      setInventoryMap({});
      setIndicatorsLoading(false);
      return;
    }
    const materialIds = list.map((m) => m.id).filter((id) => typeof id === 'number');
    if (materialIds.length === 0) return;

    const seq = ++indicatorSeqRef.current;
    setIndicatorsLoading(true);
    void Promise.all([
      fetchBatchMaterialHasBom(materialIds),
      fetchBatchMaterialInventory(materialIds),
    ]).then(([bom, inventory]) => {
      if (seq !== indicatorSeqRef.current) return;
      setBomMap(bom);
      setInventoryMap(inventory);
      setIndicatorsLoading(false);
    });
  }, [open, list]);

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

  const toggleMaterialRow = useCallback((record: Material) => {
    setSelectedMap((prev) => {
      const next = new Map(prev);
      if (next.has(record.id)) {
        next.delete(record.id);
      } else {
        next.set(record.id, record);
      }
      return next;
    });
  }, []);

  const handleMaterialRowClick = useCallback(
    (record: Material, event: React.MouseEvent<HTMLElement>) => {
      const target = event.target as HTMLElement;
      if (target.closest('.ant-checkbox-wrapper, .ant-checkbox, button, a, input, textarea, select')) {
        return;
      }
      toggleMaterialRow(record);
    },
    [toggleMaterialRow],
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
            const fileUuid = resolveMaterialImageFileUuid(firstImage);
            if (fileUuid) {
              return (
                <SecureImage fileUuid={fileUuid} width={40} height={40} lazyLoad thumbSize={64} />
              );
            }
          }
          return '-';
        },
      },
      {
        title: t('app.kuaizhizao.salesOrder.materialPickerMaterial'),
        width: 200,
        ellipsis: false,
        render: (_, r) => {
          const rec = r as Record<string, unknown>;
          const code = String(
            getMaterialField(rec, 'mainCode') ?? (r as { code?: string }).code ?? '',
          );
          return (
            <UniTableStackedPrimaryCell
              primary={String((r as { name?: string }).name ?? '')}
              secondary={code}
            />
          );
        },
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
        title: t('app.kuaizhizao.salesOrder.materialPickerHasBom'),
        width: 88,
        align: 'center',
        render: (_, r) => {
          const id = r.id;
          if (indicatorsLoading || !(id in bomMap)) {
            return (
              <span style={{ color: 'var(--ant-color-text-tertiary)', fontSize: 12 }}>...</span>
            );
          }
          const hasBom = bomMap[id];
          const text = hasBom
            ? t('app.kuaizhizao.salesOrder.materialPickerHasBomYes')
            : t('app.kuaizhizao.salesOrder.materialPickerHasBomNo');
          const color = hasBom
            ? 'var(--ant-color-success)'
            : 'var(--ant-color-text-tertiary)';
          return (
            <Tooltip
              title={
                hasBom
                  ? t('app.kuaizhizao.salesOrder.materialPickerHasBomConfigured')
                  : t('app.kuaizhizao.salesOrder.materialPickerHasBomNone')
              }
            >
              <span style={{ color, fontSize: 12 }}>{text}</span>
            </Tooltip>
          );
        },
      },
      {
        title: t('app.kuaizhizao.salesOrder.materialPickerAvailableInventory'),
        width: 96,
        align: 'right',
        render: (_, r) => {
          const id = r.id;
          if (indicatorsLoading || !(id in inventoryMap)) {
            return (
              <span style={{ color: 'var(--ant-color-text-tertiary)', fontSize: 12 }}>...</span>
            );
          }
          const qty = inventoryMap[id];
          return qty ? Number(qty).toLocaleString() : '0';
        },
      },
      {
        title: t('app.kuaizhizao.salesOrder.materialPickerSourceType'),
        width: 100,
        ellipsis: true,
        render: (_, r) => {
          const rec = r as Record<string, unknown>;
          const val = (getMaterialField(rec, 'sourceType') ?? rec.source_type) as string;
          return getMaterialSourceTypeLabel(val, t);
        },
      },
    ],
    [t, unitsMap, bomMap, inventoryMap, indicatorsLoading],
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

  const filterBar = (
    <div
      style={{
        padding: 12,
        marginBottom: 12,
        background: token.colorFillAlter,
        borderRadius: token.borderRadius,
        border: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <Flex gap={8} align="center" style={{ width: '100%' }}>
        <Input.Search
          allowClear
          placeholder={t('app.kuaizhizao.common.materialBatchSearchPlaceholder')}
          style={{ flex: 1, minWidth: 0 }}
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          onSearch={(v) => {
            setSearchDraft(v);
            setSearchKeyword(v);
            setPage(1);
          }}
          onClear={() => {
            setSearchDraft('');
            setSearchKeyword('');
            setPage(1);
          }}
        />
        <TreeSelect
          allowClear
          showSearch
          treeLine
          placeholder={t('app.kuaizhizao.common.materialBatchGroupPlaceholder')}
          style={{ flex: 1, minWidth: 0 }}
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
          style={{ flex: 1, minWidth: 0 }}
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
    </div>
  );

  return (
    <Modal
      title={t('app.kuaizhizao.salesOrder.materialPickerTitle')}
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
      {filterBar}
      <Table<Material>
        size="small"
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={list}
        rowSelection={rowSelection}
        onRow={(record) => ({
          onClick: (event) => handleMaterialRowClick(record, event),
          style: { cursor: 'pointer' },
        })}
        pagination={{
          current: page,
          pageSize: PAGE_SIZE,
          total: totalHint,
          showSizeChanger: false,
          onChange: (p) => setPage(p),
          showTotal: (tot) => (
            <Flex gap={16} align="center">
              <span style={{ color: token.colorTextSecondary, fontSize: 13 }}>
                {t('app.kuaizhizao.salesOrder.materialPickerSelectedCount', { count: selectedCount })}
              </span>
              <span style={{ color: token.colorTextSecondary, fontSize: 13 }}>
                {t('app.kuaizhizao.salesOrder.materialPickerPageTotal', { total: tot })}
              </span>
            </Flex>
          ),
        }}
        scroll={{ x: 900, y: 360 }}
      />
    </Modal>
  );
};

export default UniMaterialBatchPicker;
