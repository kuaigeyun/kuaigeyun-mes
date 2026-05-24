/**
 * 属性 SKU 选择面板（可嵌入 Modal Tab，也可被 UniVariantSkuBatchPicker 包裹）
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App, Flex, Input, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import { materialApi } from '../../apps/master-data/services/material';
import {
  getMaterialVariantAttrs,
  isVariantSkuMaterial,
  normalizeScalarAttrs,
  scalarAttrDisplay,
} from '../../apps/master-data/components/MaterialVariantCombinationsTable';
import { variantAttributeApi } from '../../apps/master-data/services/variant-attribute';
import type { Material } from '../../apps/master-data/types/material';
import type { VariantAttributeDefinition } from '../../apps/master-data/types/variant-attribute';

function attrsKey(attrs: Record<string, unknown>): string {
  return JSON.stringify(normalizeScalarAttrs(attrs));
}

export interface VariantSkuPickerPanelProps {
  masterMaterialUuid?: string | null;
  selectionMode?: 'single' | 'multiple';
  excludeAttrKeys?: Set<string>;
  active?: boolean;
  selectedUuid?: string | null;
  onSelectedUuidChange?: (uuid: string | null) => void;
  /** 单选时返回完整 SKU 行，便于父级确认 */
  onSelectedSkuChange?: (sku: Material | null) => void;
  selectedMap?: Map<string, Material>;
  onSelectedMapChange?: (map: Map<string, Material>) => void;
  tableScrollY?: number;
  showSelectedCount?: boolean;
}

export const VariantSkuPickerPanel: React.FC<VariantSkuPickerPanelProps> = ({
  masterMaterialUuid,
  selectionMode = 'multiple',
  excludeAttrKeys,
  active = true,
  selectedUuid = null,
  onSelectedUuidChange,
  onSelectedSkuChange,
  selectedMap,
  onSelectedMapChange,
  tableScrollY = 360,
  showSelectedCount = true,
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [searchDraft, setSearchDraft] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [definitions, setDefinitions] = useState<VariantAttributeDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<Material[]>([]);
  const fetchSeqRef = useRef(0);
  const isSingle = selectionMode === 'single';

  const loadDefinitions = useCallback(async () => {
    try {
      const defs = await variantAttributeApi.list({ is_active: true });
      defs.sort((a, b) => a.display_order - b.display_order);
      setDefinitions(defs);
    } catch {
      setDefinitions([]);
    }
  }, []);

  const fetchVariants = useCallback(async () => {
    if (!masterMaterialUuid) {
      setList([]);
      return;
    }
    const seq = ++fetchSeqRef.current;
    setLoading(true);
    try {
      const variants = await materialApi.listVariants(masterMaterialUuid);
      if (seq !== fetchSeqRef.current) return;
      const skus = (variants ?? []).filter((m) => isVariantSkuMaterial(m));
      setList(skus);
    } catch {
      if (seq !== fetchSeqRef.current) return;
      setList([]);
      message.error(t('app.master-data.materials.loadVariantsFailed', '加载属性组合失败'));
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false);
    }
  }, [masterMaterialUuid, message, t]);

  useEffect(() => {
    if (!active) {
      fetchSeqRef.current += 1;
      return;
    }
    setSearchDraft('');
    setSearchKeyword('');
    void loadDefinitions();
    void fetchVariants();
  }, [active, loadDefinitions, fetchVariants]);

  const filteredList = useMemo(() => {
    const kw = searchKeyword.trim().toLowerCase();
    return list.filter((row) => {
      const attrs = normalizeScalarAttrs(getMaterialVariantAttrs(row) as Record<string, unknown>);
      if (excludeAttrKeys?.has(attrsKey(attrs))) return false;
      if (!kw) return true;
      const code = String(row.code ?? row.mainCode ?? '').toLowerCase();
      const name = String(row.name ?? '').toLowerCase();
      const attrText = Object.entries(attrs)
        .map(([k, v]) => `${k}${v}`)
        .join(' ')
        .toLowerCase();
      return code.includes(kw) || name.includes(kw) || attrText.includes(kw);
    });
  }, [list, searchKeyword, excludeAttrKeys]);

  const selectedCount = isSingle ? (selectedUuid ? 1 : 0) : (selectedMap?.size ?? 0);
  const selectedRowKeys = useMemo(() => {
    if (isSingle) return selectedUuid ? [selectedUuid] : [];
    return selectedMap ? Array.from(selectedMap.keys()) : [];
  }, [isSingle, selectedMap, selectedUuid]);

  const rowSelection = useMemo(
    () => ({
      type: (isSingle ? 'radio' : 'checkbox') as 'radio' | 'checkbox',
      selectedRowKeys,
      onChange: (keys: React.Key[]) => {
        if (isSingle) {
          const uuid = keys.length ? String(keys[keys.length - 1]) : null;
          onSelectedUuidChange?.(uuid);
          if (uuid) {
            const row =
              filteredList.find((m) => String(m.uuid) === uuid) ??
              list.find((m) => String(m.uuid) === uuid) ??
              null;
            onSelectedSkuChange?.(row);
          } else {
            onSelectedSkuChange?.(null);
          }
          return;
        }
        const base = selectedMap ?? new Map<string, Material>();
        const next = new Map<string, Material>();
        keys.forEach((k) => {
          const key = String(k);
          const row = filteredList.find((m) => String(m.uuid) === key) ?? base.get(key);
          if (row) next.set(key, row);
        });
        onSelectedMapChange?.(next);
      },
    }),
    [filteredList, isSingle, list, onSelectedMapChange, onSelectedSkuChange, onSelectedUuidChange, selectedMap, selectedRowKeys],
  );

  const columns: ColumnsType<Material> = useMemo(
    () => [
      {
        title: t('app.master-data.materialForm.mainCode', '物料编号'),
        width: 120,
        ellipsis: true,
        render: (_, r) => r.mainCode ?? r.code ?? '—',
      },
      ...definitions.map((def) => ({
        title: def.display_name,
        key: def.attribute_name,
        width: 110,
        ellipsis: true,
        render: (_: unknown, record: Material) => {
          const attrs = getMaterialVariantAttrs(record) as Record<string, unknown>;
          const text = scalarAttrDisplay(attrs[def.attribute_name]);
          return text || '—';
        },
      })),
      {
        title: t('app.master-data.priceBook.skuCode', 'SKU 编码'),
        width: 120,
        ellipsis: true,
        render: (_, r) => r.code ?? '—',
      },
    ],
    [definitions, t],
  );

  if (!masterMaterialUuid) {
    return (
      <div style={{ color: 'var(--ant-color-text-secondary)', padding: '24px 0', textAlign: 'center' }}>
        {t('app.master-data.priceBook.selectMaterialFirst', '请先选择内部物料')}
      </div>
    );
  }

  return (
    <>
      <Flex justify="space-between" align="center" gap={12} wrap="wrap" style={{ marginBottom: 12 }}>
        {showSelectedCount ? (
          <span style={{ color: 'var(--ant-color-text-secondary)', fontSize: 13 }}>
            {t('app.kuaizhizao.salesOrder.materialPickerSelectedCount', { count: selectedCount })}
          </span>
        ) : (
          <span />
        )}
        <Input.Search
          allowClear
          placeholder={t('app.master-data.priceBook.batchSelectSkuSearch', '搜索 SKU 编码或属性')}
          style={{ width: 260 }}
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          onSearch={(v) => {
            setSearchDraft(v);
            setSearchKeyword(v);
          }}
          onClear={() => {
            setSearchDraft('');
            setSearchKeyword('');
          }}
        />
      </Flex>
      <Table<Material>
        size="small"
        rowKey="uuid"
        loading={loading}
        columns={columns}
        dataSource={filteredList}
        rowSelection={rowSelection}
        pagination={filteredList.length > 20 ? { pageSize: 20, showSizeChanger: false } : false}
        scroll={{ x: 'max-content', y: tableScrollY }}
        locale={{
          emptyText: t(
            'app.master-data.priceBook.batchSelectSkuEmpty',
            '该物料暂无属性 SKU，请先在物料主数据维护组合',
          ),
        }}
      />
    </>
  );
};

export default VariantSkuPickerPanel;
