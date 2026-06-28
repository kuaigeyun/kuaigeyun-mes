/**
 * 属性组合明细表（Excel 式：每行一条 SKU，每列一个属性标量值）
 */

import React, { useCallback, useEffect, useMemo, useState, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  App,
  Button,
  Form,
  List,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { DeleteOutlined, ImportOutlined, PlusOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { materialApi } from '../services/material';
import type { Material } from '../types/material';
import type { VariantAttributeDefinition } from '../types/variant-attribute';
import { variantAttributeApi } from '../services/variant-attribute';
import { VariantAttributeFields } from './VariantAttributeFields';
import { batchImport } from '../../../utils/batchOperations';
import {
  buildVariantComboImportTemplate,
  parseVariantComboImportRows,
} from '../utils/variantComboImport';
import { DEFAULT_MATERIAL_BASE_UNIT } from '../constants/materialDefaults';

const LazyUniImport = lazy(() =>
  import('../../../components/uni-import').then((m) => ({ default: m.UniImport })),
);

export interface PendingVariantCombination {
  key: string;
  variantAttributes: Record<string, unknown>;
}

export function getMaterialVariantAttrs(material?: Material | null): Record<string, unknown> {
  return (material?.variantAttributes ?? (material as any)?.variant_attributes ?? {}) as Record<
    string,
    unknown
  >;
}

/** 物料是否启用属性管理（兼容 snake_case；表单开关优先于尚未保存的 material 快照） */
export function resolveMaterialVariantManaged(
  material?: Material | null,
  variantManagedOverride?: boolean,
): boolean {
  if (variantManagedOverride !== undefined) return !!variantManagedOverride;
  return !!(material?.variantManaged ?? (material as any)?.variant_managed);
}

/** 旧版在主物料上存多选数组（属性范围），不是单条 SKU */
export function isLegacyScopeAttributes(attrs: Record<string, unknown>): boolean {
  return Object.values(attrs).some((v) => Array.isArray(v) && v.length > 1);
}

export function isVariantMasterMaterial(material?: Material | null): boolean {
  if (!resolveMaterialVariantManaged(material)) return false;
  const attrs = getMaterialVariantAttrs(material);
  if (!attrs || Object.keys(attrs).length === 0) return true;
  return isLegacyScopeAttributes(attrs);
}

export function isVariantSkuMaterial(material?: Material | null): boolean {
  if (!resolveMaterialVariantManaged(material)) return false;
  const attrs = getMaterialVariantAttrs(material);
  if (!attrs || Object.keys(attrs).length === 0) return false;
  return !isLegacyScopeAttributes(attrs);
}

export function scalarAttrDisplay(val: unknown): string {
  if (val == null || val === '') return '';
  if (Array.isArray(val)) return val.length === 1 ? String(val[0]) : '';
  return String(val);
}

export function buildVariantAttributeLabelMap(
  definitions: VariantAttributeDefinition[],
): Map<string, string> {
  return new Map(definitions.map((d) => [d.attribute_name, d.display_name]));
}

export function getVariantAttributeLabel(
  attributeName: string,
  labelMap: Map<string, string>,
): string {
  return labelMap.get(attributeName) ?? attributeName;
}

export function formatVariantAttributesLine(
  attrs: Record<string, unknown>,
  labelMap: Map<string, string>,
  separator = ' · ',
): string {
  const line = Object.entries(attrs)
    .filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && v.length === 0))
    .map(
      ([key, val]) =>
        `${getVariantAttributeLabel(key, labelMap)}: ${scalarAttrDisplay(val)}`,
    )
    .join(separator);
  return line || '—';
}

export function cartesianProductFromScope(
  scope: Record<string, unknown>,
): Record<string, unknown>[] {
  const entries = Object.keys(scope)
    .sort()
    .map((key) => {
      const raw = scope[key];
      const values = (Array.isArray(raw) ? raw : [raw]).filter(
        (v) => v != null && v !== '' && v !== undefined,
      );
      return [key, values] as const;
    })
    .filter(([, values]) => values.length > 0);

  if (!entries.length) return [];

  let rows: Record<string, unknown>[] = [{}];
  for (const [key, values] of entries) {
    const next: Record<string, unknown>[] = [];
    for (const row of rows) {
      for (const val of values) {
        next.push({ ...row, [key]: val });
      }
    }
    rows = next;
  }
  return rows;
}

/** 自动批量生成：仅属性少、组合数可控时可用 */
export const MAX_AUTO_GENERATE_ATTR_COUNT = 3;
export const MAX_AUTO_GENERATE_COMBO_COUNT = 100;

export function getEnumDefinitionsForAutoGenerate(
  definitions: VariantAttributeDefinition[],
): VariantAttributeDefinition[] {
  return definitions.filter(
    (d) => d.attribute_type === 'enum' && (d.enum_values?.length ?? 0) > 0,
  );
}

export function estimateAutoComboCount(definitions: VariantAttributeDefinition[]): number {
  const enumDefs = getEnumDefinitionsForAutoGenerate(definitions);
  if (!enumDefs.length) return 0;
  return enumDefs.reduce((acc, d) => acc * (d.enum_values?.length ?? 1), 1);
}

export function canUseAutoGenerate(definitions: VariantAttributeDefinition[]): boolean {
  const enumDefs = getEnumDefinitionsForAutoGenerate(definitions);
  if (!enumDefs.length || enumDefs.length > MAX_AUTO_GENERATE_ATTR_COUNT) return false;
  return estimateAutoComboCount(definitions) <= MAX_AUTO_GENERATE_COMBO_COUNT;
}

export function normalizeScalarAttrs(attrs: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === '') continue;
    if (Array.isArray(v)) {
      if (v.length === 1) cleaned[k] = v[0];
      continue;
    }
    cleaned[k] = v;
  }
  return Object.fromEntries(Object.entries(cleaned).sort(([a], [b]) => a.localeCompare(b)));
}

function attrsKey(attrs: Record<string, unknown>): string {
  return JSON.stringify(normalizeScalarAttrs(attrs));
}

async function resolveMasterMaterial(material: Material): Promise<Material | null> {
  if (isVariantMasterMaterial(material)) return material;
  const mainCode = material.mainCode ?? (material as any).main_code;
  if (!mainCode) return null;
  try {
    const res = await materialApi.list({ keyword: mainCode, limit: 200 });
    const items = res.items ?? [];
    return (
      items.find(
        (m) =>
          (m.mainCode ?? (m as any).main_code) === mainCode && isVariantMasterMaterial(m),
      ) ?? null
    );
  } catch {
    return null;
  }
}

interface MaterialVariantCombinationsTableProps {
  material?: Material | null;
  /** 表单内属性管理开关（未保存前 material 快照可能仍为 false） */
  variantManaged?: boolean;
  isEdit?: boolean;
  pendingRows?: PendingVariantCombination[];
  onPendingRowsChange?: (rows: PendingVariantCombination[]) => void;
  onVariantsChanged?: () => void;
}

type TableRow = {
  key: string;
  uuid?: string;
  materialName: string;
  variantAttributes: Record<string, unknown>;
  isActive: boolean;
  isPending: boolean;
  isCurrent?: boolean;
};

export const MaterialVariantCombinationsTable: React.FC<MaterialVariantCombinationsTableProps> = ({
  material,
  variantManaged: variantManagedOverride,
  isEdit = false,
  pendingRows = [],
  onPendingRowsChange,
  onVariantsChanged,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const effectiveVariantManaged = resolveMaterialVariantManaged(material, variantManagedOverride);
  const [definitions, setDefinitions] = useState<VariantAttributeDefinition[]>([]);
  const [definitionsLoading, setDefinitionsLoading] = useState(false);
  const [masterMaterial, setMasterMaterial] = useState<Material | null>(null);
  const [variants, setVariants] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [addForm] = Form.useForm<Record<string, unknown>>();

  const legacyScope = useMemo(() => {
    if (!material || !isVariantMasterMaterial(material)) return null;
    const attrs = getMaterialVariantAttrs(material);
    if (!isLegacyScopeAttributes(attrs)) return null;
    return attrs;
  }, [material]);

  const masterSaved = isEdit && !!masterMaterial?.uuid;
  const productName =
    masterMaterial?.name ?? material?.name ?? t('app.master-data.materialForm.materialName', '物料');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setDefinitionsLoading(true);
      try {
        const list = await variantAttributeApi.list({ is_active: true });
        list.sort((a, b) => a.display_order - b.display_order);
        if (!cancelled) setDefinitions(list);
      } catch (e: any) {
        messageApi.error(e?.message || t('app.master-data.materialForm.loadVariantDefFailed'));
      } finally {
        if (!cancelled) setDefinitionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [messageApi, t]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!effectiveVariantManaged) {
        setMasterMaterial(null);
        return;
      }
      if (!material) {
        if (!cancelled) setMasterMaterial(null);
        return;
      }
      if (isVariantSkuMaterial(material)) {
        const master = await resolveMasterMaterial(material);
        if (!cancelled) setMasterMaterial(master);
        return;
      }
      if (!cancelled) setMasterMaterial(material);
    })();
    return () => {
      cancelled = true;
    };
  }, [material, effectiveVariantManaged]);

  const loadVariants = useCallback(async () => {
    if (!masterSaved || !masterMaterial?.uuid) {
      setVariants([]);
      return;
    }
    setLoading(true);
    try {
      const list = await materialApi.listVariants(masterMaterial.uuid);
      setVariants(list);
    } catch {
      messageApi.error(t('app.master-data.materials.loadVariantsFailed', '加载属性组合失败'));
    } finally {
      setLoading(false);
    }
  }, [masterSaved, masterMaterial?.uuid, messageApi, t]);

  useEffect(() => {
    loadVariants();
  }, [loadVariants]);

  const tableRows: TableRow[] = useMemo(() => {
    const name = productName;
    const currentUuid = material?.uuid;

    if (masterSaved) {
      return variants.map((v) => ({
        key: v.uuid,
        uuid: v.uuid,
        materialName: name,
        variantAttributes: normalizeScalarAttrs(
          getMaterialVariantAttrs(v) as Record<string, unknown>,
        ),
        isActive: v.isActive ?? true,
        isPending: false,
        isCurrent: currentUuid === v.uuid,
      }));
    }

    return pendingRows.map((row) => ({
      key: row.key,
      materialName: name,
      variantAttributes: normalizeScalarAttrs(row.variantAttributes),
      isActive: true,
      isPending: true,
      isCurrent: false,
    }));
  }, [masterSaved, variants, pendingRows, productName, material?.uuid]);

  const existingKeys = useMemo(() => {
    const keys = new Set<string>();
    tableRows.forEach((r) => keys.add(attrsKey(r.variantAttributes)));
    return keys;
  }, [tableRows]);

  const legacyPreviewCount = legacyScope ? cartesianProductFromScope(legacyScope).length : 0;
  const autoComboEstimate = estimateAutoComboCount(definitions);
  const autoGenerateAllowed = canUseAutoGenerate(definitions);
  const legacySplitAllowed =
    legacyPreviewCount > 0 && legacyPreviewCount <= MAX_AUTO_GENERATE_COMBO_COUNT;

  const importTemplate = useMemo(
    () => buildVariantComboImportTemplate(definitions),
    [definitions],
  );

  const buildSkuCreatePayload = useCallback(
    (variantAttributes: Record<string, unknown>, isActive = true) => {
      const base = masterMaterial ?? material;
      return {
        mainCode: base?.mainCode ?? (base as any)?.main_code,
        name: base?.name,
        groupId: base?.groupId ?? (base as any)?.group_id,
        specification: base?.specification,
        baseUnit: base?.baseUnit ?? (base as any)?.base_unit ?? DEFAULT_MATERIAL_BASE_UNIT,
        variantManaged: true,
        variantAttributes,
        sourceType: base?.sourceType ?? (base as any)?.source_type,
        isActive,
      };
    },
    [masterMaterial, material],
  );

  const handleVariantComboImport = async (data: unknown[][]) => {
    const keySet = new Set(existingKeys);
    const { rows, errors } = parseVariantComboImportRows(data, definitions, keySet);

    const validationErrors = errors.filter((e) => !e.message.includes('已存在'));
    if (validationErrors.length > 0) {
      Modal.warning({
        title: t('app.master-data.dataValidationFailed', '数据校验失败'),
        width: 560,
        content: (
          <List
            size="small"
            dataSource={validationErrors}
            renderItem={(e) => (
              <List.Item>
                <Typography.Text type="danger">
                  {t('app.master-data.rowError', {
                    row: e.row,
                    message: e.message,
                    defaultValue: `第 ${e.row} 行：${e.message}`,
                  })}
                </Typography.Text>
              </List.Item>
            )}
          />
        ),
      });
      return;
    }

    if (!rows.length) {
      messageApi.warning(
        t('app.master-data.materials.variantComboImportEmpty', {
          defaultValue: '没有可导入的新组合（可能全部重复或为空）',
        }),
      );
      return;
    }

    for (const row of rows) {
      for (const [attrName, attrValue] of Object.entries(row.variantAttributes)) {
        const result = await variantAttributeApi.validate({
          attribute_name: attrName,
          attribute_value: attrValue,
        });
        if (!result.is_valid) {
          Modal.warning({
            title: t('app.master-data.dataValidationFailed', '数据校验失败'),
            content: t('app.master-data.rowError', {
              row: row.rowNum,
              message: result.error_message || attrName,
              defaultValue: `第 ${row.rowNum} 行：${result.error_message || attrName}`,
            }),
          });
          return;
        }
      }
    }

    setImporting(true);
    try {
      const skipped = errors.filter((e) => e.message.includes('已存在')).length;

      if (masterSaved && (masterMaterial ?? material)) {
        const result = await batchImport({
          items: rows,
          importFn: async (row) =>
            materialApi.create(buildSkuCreatePayload(row.variantAttributes, row.isActive) as any),
          title: t('app.master-data.materials.variantComboImportTitle', {
            defaultValue: '正在导入属性组合',
          }),
          concurrency: 1,
          retryCount: 1,
        });
        if (result.failureCount > 0) {
          Modal.warning({
            title: t('app.master-data.importPartialResultTitle', '导入完成（部分失败）'),
            width: 560,
            content: (
              <List
                size="small"
                dataSource={result.errors.map((e) => ({
                  row: rows[e.row - 1]?.rowNum ?? e.row,
                  message: e.error,
                }))}
                renderItem={(e) => (
                  <List.Item>
                    <Typography.Text type="danger">
                      {t('app.master-data.rowError', {
                        row: e.row,
                        message: e.message,
                      })}
                    </Typography.Text>
                  </List.Item>
                )}
              />
            ),
          });
        } else {
          messageApi.success(
            t('app.master-data.materials.variantComboImportSuccess', {
              count: result.successCount,
              skipped,
              defaultValue: `已导入 ${result.successCount} 条组合${skipped ? `，跳过 ${skipped} 条重复` : ''}`,
            }),
          );
        }
        await loadVariants();
        onVariantsChanged?.();
      } else {
        const newPending: PendingVariantCombination[] = rows.map((row, i) => ({
          key: `pending-import-${Date.now()}-${i}`,
          variantAttributes: row.variantAttributes,
        }));
        onPendingRowsChange?.([...pendingRows, ...newPending]);
        messageApi.success(
          t('app.master-data.materials.variantComboImportPending', {
            count: rows.length,
            defaultValue: `已加入 ${rows.length} 条待保存组合`,
          }),
        );
      }
      setImportOpen(false);
    } catch (e: unknown) {
      messageApi.error(e instanceof Error ? e.message : t('app.common.operationFailed'));
    } finally {
      setImporting(false);
    }
  };

  const handleGenerateFromScope = async () => {
    if (!legacyScope || !material?.uuid) return;
    if (!legacySplitAllowed) {
      messageApi.warning(
        t('app.master-data.materials.autoGenerateTooMany', {
          count: legacyPreviewCount,
          max: MAX_AUTO_GENERATE_COMBO_COUNT,
          defaultValue: `拆分后将产生 ${legacyPreviewCount} 条组合，超过上限 ${MAX_AUTO_GENERATE_COMBO_COUNT}，请使用「新增行」手工维护`,
        }),
      );
      return;
    }
    const combos = cartesianProductFromScope(legacyScope);
    if (!combos.length) return;
    setMigrating(true);
    try {
      let created = 0;
      let skipped = 0;
      for (const combo of combos) {
        const key = attrsKey(combo);
        if (existingKeys.has(key)) {
          skipped += 1;
          continue;
        }
        await materialApi.create({
          mainCode: material.mainCode ?? (material as any).main_code,
          name: material.name,
          groupId: material.groupId ?? (material as any).group_id,
          specification: material.specification,
          baseUnit: material.baseUnit ?? (material as any).base_unit ?? DEFAULT_MATERIAL_BASE_UNIT,
          variantManaged: true,
          variantAttributes: combo,
          sourceType: material.sourceType ?? (material as any).source_type,
          isActive: material.isActive ?? true,
        } as any);
        created += 1;
      }
      await materialApi.update(material.uuid, {
        variantManaged: true,
        variantAttributes: null,
      } as any);
      messageApi.success(
        t('app.master-data.materials.legacyScopeMigrated', {
          created,
          skipped,
          defaultValue: `已生成 ${created} 条组合${skipped ? `，跳过 ${skipped} 条重复` : ''}；主物料已转为组合明细模式`,
        }),
      );
      onVariantsChanged?.();
      await loadVariants();
    } catch (e: any) {
      messageApi.error(e?.message || t('app.common.operationFailed'));
    } finally {
      setMigrating(false);
    }
  };

  const handleGenerate = () => {
    if (!masterMaterial?.uuid) return;
    if (!autoGenerateAllowed) {
      messageApi.warning(
        t('app.master-data.materials.autoGenerateNotAvailable', {
          attrs: getEnumDefinitionsForAutoGenerate(definitions).length,
          count: autoComboEstimate,
          maxAttrs: MAX_AUTO_GENERATE_ATTR_COUNT,
          maxCount: MAX_AUTO_GENERATE_COMBO_COUNT,
          defaultValue: `当前 ${getEnumDefinitionsForAutoGenerate(definitions).length} 个枚举属性、约 ${autoComboEstimate} 条组合，超出自动生成为止（≤${MAX_AUTO_GENERATE_ATTR_COUNT} 个属性且 ≤${MAX_AUTO_GENERATE_COMBO_COUNT} 条）。请使用「新增行」手工维护。`,
        }),
      );
      return;
    }
    Modal.confirm({
      title: t('app.master-data.materials.generateVariantsTitle', '批量自动生成'),
      content: t('app.master-data.materials.generateVariantsConfirmLimited', {
        count: autoComboEstimate,
        defaultValue: `将按 ${getEnumDefinitionsForAutoGenerate(definitions).length} 个枚举属性生成约 ${autoComboEstimate} 条组合（已存在会自动跳过）。属性较多或组合量大时请改用手工「新增行」。是否继续？`,
      }),
      onOk: async () => {
        setGenerating(true);
        try {
          const res = await materialApi.generateVariants(masterMaterial.uuid, { skipExisting: true });
          messageApi.success(res.message);
          await loadVariants();
          onVariantsChanged?.();
        } catch (e: any) {
          messageApi.error(e?.message || t('app.common.operationFailed'));
        } finally {
          setGenerating(false);
        }
      },
    });
  };

  const handleAddSubmit = async () => {
    const values = await addForm.validateFields();
    const normalized = normalizeScalarAttrs(values as Record<string, unknown>);
    if (Object.keys(normalized).length === 0) {
      messageApi.warning(t('app.master-data.materials.variantComboRequired', '请至少选择一项属性'));
      return;
    }
    if (existingKeys.has(attrsKey(normalized))) {
      messageApi.warning(t('app.master-data.materials.variantComboDuplicate', '该属性组合已存在'));
      return;
    }

    for (const [attrName, attrValue] of Object.entries(normalized)) {
      const result = await variantAttributeApi.validate({
        attribute_name: attrName,
        attribute_value: attrValue,
      });
      if (!result.is_valid) {
        messageApi.error(result.error_message || t('app.master-data.materialForm.attrValidationFailed'));
        return;
      }
    }

    const base = masterMaterial ?? material;
    if (masterSaved && base) {
      try {
        await materialApi.create({
          mainCode: base.mainCode ?? (base as any).main_code,
          name: base.name,
          groupId: base.groupId ?? (base as any).group_id,
          specification: base.specification,
          baseUnit: base.baseUnit ?? (base as any).base_unit ?? DEFAULT_MATERIAL_BASE_UNIT,
          variantManaged: true,
          variantAttributes: normalized,
          sourceType: base.sourceType ?? (base as any).source_type,
          isActive: base.isActive ?? true,
        } as any);
        messageApi.success(t('app.master-data.materials.variantComboAdded', '已添加属性组合'));
        setAddOpen(false);
        addForm.resetFields();
        await loadVariants();
        onVariantsChanged?.();
      } catch (e: any) {
        messageApi.error(e?.message || t('app.common.operationFailed'));
      }
      return;
    }

    onPendingRowsChange?.([
      ...pendingRows,
      { key: `pending-${Date.now()}`, variantAttributes: normalized },
    ]);
    messageApi.success(t('app.master-data.materials.variantComboPending', '已加入待保存列表'));
    setAddOpen(false);
    addForm.resetFields();
  };

  const handleDelete = async (record: TableRow) => {
    if (record.isPending) {
      onPendingRowsChange?.(pendingRows.filter((r) => r.key !== record.key));
      return;
    }
    if (!record.uuid) return;
    try {
      await materialApi.delete(record.uuid);
      messageApi.success(t('app.common.deleteSuccess', '删除成功'));
      await loadVariants();
      onVariantsChanged?.();
    } catch (e: any) {
      messageApi.error(e?.message || t('app.common.operationFailed'));
    }
  };

  const columns: ColumnsType<TableRow> = [
    {
      title: t('app.master-data.materials.materialName', '产品名称'),
      dataIndex: 'materialName',
      width: 120,
      fixed: 'left',
      ellipsis: true,
    },
    ...definitions.map((def) => ({
      title: def.display_name,
      key: def.attribute_name,
      width: 110,
      ellipsis: true,
      render: (_: unknown, record: TableRow) => {
        const val = record.variantAttributes[def.attribute_name];
        const text = scalarAttrDisplay(val);
        if (!text) return '—';
        if (Array.isArray(val) && val.length > 1) {
          return <Typography.Text type="danger">{t('app.master-data.materials.invalidMultiValue', '多值')}</Typography.Text>;
        }
        return text;
      },
    })),
    {
      title: t('app.master-data.materials.enabledStatusLabel'),
      dataIndex: 'isActive',
      width: 72,
      render: (v: boolean) => (
        <Tag color={v ? 'success' : 'default'}>
          {v ? t('app.master-data.materials.enabled') : t('app.master-data.materials.disabled')}
        </Tag>
      ),
    },
    {
      title: t('app.common.actions', '操作'),
      key: 'actions',
      width: 72,
      fixed: 'right',
      render: (_: unknown, record: TableRow) => (
        <Popconfirm
          title={t('app.master-data.materials.deleteVariantComboConfirm', '确定删除该属性组合？')}
          onConfirm={() => handleDelete(record)}
        >
          <Button type="link" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  if (definitionsLoading) {
    return <Typography.Text type="secondary">{t('app.master-data.materialForm.loading')}</Typography.Text>;
  }

  if (definitions.length === 0) {
    return (
      <Typography.Text type="secondary">
        {t('app.master-data.materialForm.configVariantFirst')}
      </Typography.Text>
    );
  }

  if (!effectiveVariantManaged) {
    return (
      <Typography.Text type="secondary">
        {t('app.master-data.materials.notVariantMaster', '请先开启属性管理')}
      </Typography.Text>
    );
  }

  if (isVariantSkuMaterial(material) && !masterMaterial) {
    return (
      <Typography.Text type="secondary">
        {t('app.master-data.materials.masterNotFound', '未找到对应主物料，无法加载组合明细')}
      </Typography.Text>
    );
  }

  return (
    <div>
      {legacyScope && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message={t('app.master-data.materials.legacyScopeTitle', '检测到旧版属性范围数据')}
          description={
            legacySplitAllowed
              ? t('app.master-data.materials.legacyScopeDesc', {
                  count: legacyPreviewCount,
                  defaultValue: `可拆分为 ${legacyPreviewCount} 条组合行；也可清空旧数据后改用「新增行」手工维护。`,
                })
              : t('app.master-data.materials.legacyScopeTooMany', {
                  count: legacyPreviewCount,
                  max: MAX_AUTO_GENERATE_COMBO_COUNT,
                  defaultValue: `旧数据展开后将产生 ${legacyPreviewCount} 条组合，数量过多。请使用「新增行」逐条手工维护，勿一次性拆分。`,
                })
          }
          action={
            legacySplitAllowed ? (
              <Button size="small" loading={migrating} onClick={() => void handleGenerateFromScope()}>
                {t('app.master-data.materials.migrateLegacyScope', '拆分为组合明细')}
              </Button>
            ) : undefined
          }
        />
      )}

      {isVariantSkuMaterial(material) && masterMaterial && (
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          {t(
            'app.master-data.materials.viewMasterCombosHint',
            '以下为同主编码下的全部属性组合明细（当前编辑的 SKU 行已高亮）',
          )}
        </Typography.Paragraph>
      )}

      {!legacyScope || !legacySplitAllowed ? (
        <Space orientation="vertical" size={8} style={{ marginBottom: 12, width: '100%' }}>
          <Space wrap>
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
              {t('app.master-data.materials.addVariantCombo', '新增行')}
            </Button>
            <Button
              size="small"
              icon={<ImportOutlined />}
              loading={importing}
              onClick={() => setImportOpen(true)}
            >
              {t('app.master-data.materials.variantComboImport', '批量导入')}
            </Button>
            {masterSaved && autoGenerateAllowed && (
              <Button
                size="small"
                icon={<ThunderboltOutlined />}
                loading={generating}
                onClick={handleGenerate}
              >
                {t('app.master-data.materials.generateVariants', '批量自动生成')}
              </Button>
            )}
            <Typography.Text type="secondary">
              {masterSaved
                ? t('app.master-data.materials.variantSkuCount', {
                    count: tableRows.length,
                    defaultValue: `共 ${tableRows.length} 条`,
                  })
                : t(
                    'app.master-data.materials.variantComboPendingHint',
                    '保存主物料后可写入系统；当前为待保存列表',
                  )}
            </Typography.Text>
          </Space>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t('app.master-data.materials.manualComboHint', '默认请使用「新增行」手工维护组合。')}
            {t('app.master-data.materials.variantComboImportHint', {
              defaultValue: ' 也可使用「批量导入」按属性列粘贴 Excel 组合（仅导入当前物料下的 SKU 行）。',
            })}
            {masterSaved && !autoGenerateAllowed
              ? t('app.master-data.materials.autoGenerateHiddenHint', {
                  maxAttrs: MAX_AUTO_GENERATE_ATTR_COUNT,
                  maxCount: MAX_AUTO_GENERATE_COMBO_COUNT,
                  defaultValue: ` 批量自动生成仅当枚举属性≤${MAX_AUTO_GENERATE_ATTR_COUNT} 且组合数≤${MAX_AUTO_GENERATE_COMBO_COUNT} 时可用。`,
                })
              : masterSaved && autoGenerateAllowed
                ? t('app.master-data.materials.autoGenerateAvailableHint', {
                    count: autoComboEstimate,
                    defaultValue: ` 当前约 ${autoComboEstimate} 条组合，可使用批量自动生成。`,
                  })
                : null}
          </Typography.Text>
        </Space>
      ) : null}

      <Table
        rowKey="key"
        size="small"
        loading={loading}
        dataSource={tableRows}
        columns={columns}
        pagination={tableRows.length > 10 ? { pageSize: 10, showSizeChanger: false } : false}
        scroll={{ x: Math.max(720, 140 + definitions.length * 110) }}
        rowClassName={(record) => (record.isCurrent ? 'variant-combo-row-current' : '')}
        locale={{
          emptyText: t('app.master-data.materials.noVariantCombos', '暂无组合，请点击「新增行」手工添加'),
        }}
      />

      <style>{`
        .variant-combo-row-current > td {
          background: rgba(22, 119, 255, 0.08) !important;
        }
      `}</style>

      <Modal
        title={t('app.master-data.materials.addVariantCombo', '新增组合行')}
        open={addOpen}
        onCancel={() => {
          setAddOpen(false);
          addForm.resetFields();
        }}
        onOk={() => void handleAddSubmit()}
        destroyOnHidden
        width={560}
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          {t('app.master-data.materials.addComboRowHint', '每列选择一个属性值，保存后为一条独立组合行（与 Excel 每行一致）')}
        </Typography.Paragraph>
        <Form form={addForm} layout="vertical">
          <VariantAttributeFields
            definitions={definitions}
            singleValueOnly
            colSpan={{ xs: 24, sm: 12, md: 12 }}
          />
        </Form>
      </Modal>

      {importOpen && (
        <Suspense fallback={null}>
          <LazyUniImport
            open={importOpen}
            onCancel={() => !importing && setImportOpen(false)}
            onConfirm={(data) => void handleVariantComboImport(data)}
            title={t('app.master-data.materials.variantComboImportTitle', '导入属性组合')}
            headers={importTemplate.headers}
            exampleRow={importTemplate.exampleRow}
            templateDocumentName={t('app.master-data.materials.variantComboImportTemplate', {
              defaultValue: '属性组合导入',
            })}
            width={960}
            height={520}
          />
        </Suspense>
      )}
    </div>
  );
};

export async function flushPendingVariantCombinations(
  master: Material,
  pendingRows: PendingVariantCombination[],
): Promise<number> {
  if (!pendingRows.length) return 0;
  let created = 0;
  for (const row of pendingRows) {
    await materialApi.create({
      mainCode: master.mainCode ?? (master as any).main_code,
      name: master.name,
      groupId: master.groupId ?? (master as any).group_id,
      specification: master.specification,
      baseUnit: master.baseUnit ?? (master as any).base_unit ?? DEFAULT_MATERIAL_BASE_UNIT,
      variantManaged: true,
      variantAttributes: normalizeScalarAttrs(row.variantAttributes),
      sourceType: master.sourceType ?? (master as any).source_type,
      isActive: master.isActive ?? true,
    } as any);
    created += 1;
  }
  return created;
}
