/**
 * 物料清单BOM管理页面
 * 
 * 提供物料清单BOM的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSwitch, ProFormDigit, ProFormInstance, ProDescriptionsItemProps, ProFormList, ProFormDateTimePicker, ProFormSelect, ProForm } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../../components/safe-pro-form-select';
import CodeField from '../../../../../components/code-field';
import { App, Button, Tag, Space, Modal, Input, Tree, Spin, Table, Form as AntForm, Select, Switch, InputNumber, Dropdown, Checkbox, Descriptions, theme } from 'antd';
import type { MenuProps } from 'antd';
import type { DataNode } from 'antd/es/tree';
import type { ColumnsType } from 'antd/es/table';
import { EditOutlined, DeleteOutlined, PlusOutlined, MinusCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, UploadOutlined, DiffOutlined, HistoryOutlined, CalculatorOutlined, HighlightOutlined, MoreOutlined, UndoOutlined, StarOutlined, ProductOutlined, UnorderedListOutlined, ClusterOutlined, CopyOutlined, PrinterOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { UniTable, type UniTableRequestMeta} from '../../../../../components/uni-table';
import { useCurrentUser } from '../../../../../hooks/useCurrentUser';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { UniTableDetail } from '../../../../../components/uni-table-detail';
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
import { UniMaterialBatchPicker } from '../../../../../components/uni-material-batch-picker';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { SecureImage } from '../../../../../components/secure-image';
import { ThemedSegmented } from '../../../../../components/themed-segmented';
import { rowActionKind } from '../../../../../components/uni-action';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { openPrintHtmlWindow } from '../../../../../utils/printResponseHelpers';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { formatQuantity, formatDateTimeBySiteSetting } from '../../../../../utils/format';
import { ListPageTemplate, FormModalTemplate, flushDrawerOpen, MODAL_CONFIG, DRAWER_CONFIG, DetailDrawerSection, MODAL_NESTED_ABOVE_PARENT_OFFSET } from '../../../../../components/layout-templates';
import { MODAL_ISOLATE_POINTER_PROPS } from '../../../../../utils/modalEventIsolation';
import { UniDetail, detailDrawerDescriptionItems } from '../../../../../components/uni-detail';
import { bomApi, materialApi } from '../../../services/material';
import type { BOM, BOMCreate, BOMUpdate, Material, BOMBatchCreate, BOMItemCreate, BOMBatchImport, BOMBatchImportItem, BOMVersionCreate, BOMVersionCompare, BOMVersionCompareResult, BOMHierarchy, BOMHierarchyItem, BOMQuantityResult, BOMQuantityComponent, BOMRelationImportEntity, BOMRelationImportWriteStrategy, BOMWhereUsedResult } from '../../../types/material';
import { testGenerateCode, getCodeRulePageConfig } from '../../../../../services/codeRule';
import { batchSetFieldValues } from '../../../../../services/customField';

const BOM_ISSUE_METHOD_VALUES = ['pick', 'backflush', 'none'] as const;
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';
import { downloadFile } from '../../../../../utils';
import { buildFutureDateShortcutFieldProps } from '../../../../../utils/futureDatePickerShortcuts';
import type { User } from '../../../../../services/user';
import { searchUserDisplay } from '../../../../../services/user';
import { useGlobalStore } from '../../../../../stores';
import { displayItemsToUsers } from '../../../../../utils/userDisplay';
import { extractProTableSort } from '../../../../../utils/tableQueryKey';
import {
  buildFactoryImportTemplate,
  resolveFactoryImportHeaderIndexMap,
} from '../../../utils/factoryImportTemplate';
import { getMaterialUnitDisplayMapShared } from '../../../../../utils/materialUnitDisplay';
import { useImportMaterialUnitOptions } from '../../../hooks/useImportMaterialUnitOptions';
import {
  IMPORT_YES_NO_OPTIONS,
  pickImportExampleValue,
} from '../../../../../utils/loadImportDictionaryValues';
import {
  buildMaterialSourceTypeOptions,
  normalizeMaterialSourceType,
} from '../../../utils/materialSourceType';
import { useCustomFields } from '../../../../../hooks/useCustomFields';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import {
  CustomFieldsFormSection,
  CustomFieldsDetailSection,
  hasCustomFieldsDetailContent,
} from '../../../../../components/custom-fields';
import { masterCrudCreatedUpdatedColumns } from '../../../utils/materialListCore';
import { isVariantSkuMaterial } from '../../../components/MaterialVariantCombinationsTable';
import { fetchAllListItems } from '../../../../../utils/fetchAllListPages';
import { downloadRecordsAsXlsx } from '../../../../../utils/exportRecordsXlsx';
import { UNI_TABLE_STATUS_BADGE_COLUMN_WIDTH } from '../../../../../utils/uniTableLayoutColumns';
import { flattenBomGroupsForExport, resolveBomExportGroup } from './utils';

const BOM_CUSTOM_FIELD_TABLE = 'master_data_boms';
const BOM_RESOURCE = 'master-data:process:engineering-bom';

function resolveBomMaterialImageFileUuid(raw: unknown): string | null {
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

function upsertMaterialsById(prev: Material[], incoming: Material[]): Material[] {
  if (!incoming.length) return prev;
  const map = new Map(prev.map((m) => [m.id, m]));
  for (const material of incoming) {
    if (material?.id == null) continue;
    const existing = map.get(material.id);
    map.set(material.id, existing ? { ...existing, ...material } : material);
  }
  return Array.from(map.values());
}

interface BOMVersionHistoryRow {
  version: string;
  materialId: number;
  approvalStatus: BOM['approvalStatus'];
  itemCount: number;
  effectiveDate?: string;
  createdByName?: string;
  createdAt?: string;
  isDefault?: boolean;
  isObsolete?: boolean;
}

/** ProTable 操作列可传 UniTable 扩展：控制溢出菜单 directMax 等 */
type MaterialBOMProColumn = ProColumns<MaterialBOMRow> & {
  uniActionRenderOptions?: { directMax?: number };
};

/**
 * 单位列展示：接收 Form 的 value（单位 code），渲染字典标签，表格渲染前已映射
 */
const UnitDisplayCell: React.FC<{
  value?: string;
  onChange?: (v: string) => void;
  unitValueToLabel: Record<string, string>;
}> = ({ value, unitValueToLabel }) => (
  <span>{value && unitValueToLabel[value] ? unitValueToLabel[value] : (value || '-')}</span>
);

/** 同一 BOM 编号（bomCode + materialId + version）分组后的行，用于树形表格展示 */
type BOMTableTreeNode = BOM & {
  key: string;
  _bomVersion?: string;
  _bomCode?: string;
  _bomApprovalStatus?: BOM['approvalStatus'];
  children?: BOMTableTreeNode[];
};

interface BOMGroupRow {
  groupKey: string;
  bomCode: string;
  version: string;
  materialId: number;
  approvalStatus: BOM['approvalStatus'];
  firstItem: BOM;
  items: BOM[];
  children?: BOMTableTreeNode[]; // 树形数据的子节点
}

interface BomCopySourceOption {
  value: string;
  materialId: number;
  version: string;
  label: string;
}

const buildDefaultBomName = (
  material?: { name?: string; mainCode?: string; code?: string },
  bomCode?: string,
) => {
  const mainLabel = (material?.name || material?.mainCode || material?.code || '').trim();
  const code = (bomCode || '').trim();
  if (mainLabel && code) return `${mainLabel} ${code}`;
  return mainLabel || code;
};

const buildDefaultBomItem = (overrides?: Partial<Record<string, unknown>>) => ({
  componentId: undefined,
  quantity: 1,
  unit: '',
  wasteRate: 0,
  isRequired: true,
  issueMethod: 'pick',
  isAlternative: false,
  alternativeGroupId: undefined,
  priority: 0,
  description: undefined,
  remark: undefined,
  sourceType: undefined,
  ...(overrides ?? {}),
});

const getMaterialSourceTypeFromRecord = (material?: Material | null): string => {
  if (!material) return '';
  return normalizeMaterialSourceType(material.sourceType ?? (material as { source_type?: string }).source_type);
};

/** 按物料分组的行：一物料一行，版本通过下拉切换，默认显示默认版本或最新版本 */
interface MaterialBOMRow extends BOMGroupRow {
  materialId: number;
  versions: BOMGroupRow[];
  selectedVersion: BOMGroupRow;
  createdAt?: string;
  updatedAt?: string;
  createdByName?: string;
  updatedByName?: string;
}

function normalizeBomKeyword(searchFormValues: Record<string, unknown> | undefined): string {
  const k = searchFormValues?.keyword;
  if (k != null && String(k).trim()) return String(k).trim();
  return '';
}

function materialBomRowMatchesKeyword(row: MaterialBOMRow, kw: string, materials: Material[]): boolean {
  if (!kw) return true;
  const lower = kw.toLowerCase();
  const mid = row.materialId;
  const mat = materials.find((m) => m.id === mid);
  const code = String((mat as any)?.mainCode ?? mat?.code ?? '').toLowerCase();
  const name = String(mat?.name ?? '').toLowerCase();
  const bomCode = String(row.bomCode ?? '').toLowerCase();
  const ver = String(row.selectedVersion?.version ?? row.version ?? '').toLowerCase();
  return (
    code.includes(lower) ||
    name.includes(lower) ||
    bomCode.includes(lower) ||
    ver.includes(lower) ||
    String(mid).includes(lower)
  );
}

function sortMaterialBomRows(
  rows: MaterialBOMRow[],
  sortBy: string | undefined,
  sortOrder: 'asc' | 'desc' | undefined,
  materials: Material[],
): MaterialBOMRow[] {
  if (!sortBy || !sortOrder) return rows;
  const dir = sortOrder === 'desc' ? -1 : 1;
  const labelFor = (row: MaterialBOMRow) => {
    const mid = row.materialId;
    const mat = materials.find((m) => m.id === mid);
    switch (sortBy) {
      case 'materialId':
        return `${(mat as any)?.mainCode ?? mat?.code ?? ''} ${mat?.name ?? ''}`.trim().toLowerCase();
      case 'bomCode':
        return String(row.bomCode ?? '').toLowerCase();
      case 'version':
        return String(row.selectedVersion?.version ?? row.version ?? '').toLowerCase();
      case 'approvalStatus':
        return String(row.approvalStatus ?? '').toLowerCase();
      default:
        return String(mid);
    }
  };
  return [...rows].sort((a, b) => {
    const va = labelFor(a);
    const vb = labelFor(b);
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });
}

function pageMaterialBomRows(
  materialRows: MaterialBOMRow[],
  params: { current?: number; pageSize?: number },
  searchFormValues: Record<string, unknown> | undefined,
  sort: Record<string, 'ascend' | 'descend' | null | undefined>,
  materials: Material[],
) {
  let rows = materialRows;
  const kw = normalizeBomKeyword(searchFormValues);
  if (kw) rows = rows.filter((r) => materialBomRowMatchesKeyword(r, kw, materials));
  const { sortBy, sortOrder } = extractProTableSort(sort);
  rows = sortMaterialBomRows(rows, sortBy, sortOrder, materials);
  const pageSize = params.pageSize || 20;
  const current = params.current || 1;
  const start = (current - 1) * pageSize;
  return {
    data: rows.slice(start, start + pageSize),
    success: true as const,
    total: rows.length,
  };
}

/** 详情抽屉「基本信息」不包含的子件行字段（仅在「子物料列表」表格展示） */
const BOM_DETAIL_LINE_ONLY_DATA_INDEX = new Set<string>([
  'componentId',
  'quantity',
  'unit',
  'wasteRate',
  'isRequired',
  'issueMethod',
  'level',
  'path',
  'isAlternative',
  'priority',
  'remark',
]);

/**
 * 基本信息字段顺序：标识与主物料 → 审核状态 → 有效期与启用 → 配置/替代摘要 → 说明 → 审核痕迹 → 时间戳
 */
const BOM_DETAIL_BASIC_FIELD_ORDER: string[] = [
  'bomCode',
  'version',
  'materialId',
  'approvalStatus',
  'effectiveDate',
  'expiryDate',
  'isActive',
  'isConfigurable',
  'alternativeGroupId',
  'description',
  'approvedBy',
  'approvedAt',
  'approvalComment',
  'createdAt',
  'updatedAt',
];

function orderBomDetailBasicColumns(cols: ProDescriptionsItemProps<BOM>[]): ProDescriptionsItemProps<BOM>[] {
  const filtered = cols.filter(
    (c) => c.dataIndex != null && !BOM_DETAIL_LINE_ONLY_DATA_INDEX.has(String(c.dataIndex)),
  );
  const map = new Map(filtered.map((c) => [String(c.dataIndex), c]));
  const ordered: ProDescriptionsItemProps<BOM>[] = [];
  for (const key of BOM_DETAIL_BASIC_FIELD_ORDER) {
    const col = map.get(key);
    if (col) {
      ordered.push(col);
      map.delete(key);
    }
  }
  for (const col of map.values()) {
    ordered.push(col);
  }
  return ordered.map((col) => {
    const di = String(col.dataIndex ?? '');
    if (di === 'description' || di === 'approvalComment') {
      return { ...col, span: 3 };
    }
    return col;
  });
}

/**
 * 物料清单BOM管理列表页面组件
 */
const BOMPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { token } = theme.useToken();
  const bomPerms = useResourcePermissions(BOM_RESOURCE);
  /** 嵌套在 BOM 表单 Modal 内，须高于父弹窗，避免二次打开被挡住 */
  const nestedBomModalZIndex = token.zIndexPopupBase + MODAL_NESTED_ABOVE_PARENT_OFFSET;
  const bomIssueMethodOptions = useMemo(
    () =>
      BOM_ISSUE_METHOD_VALUES.map((value) => ({
        value,
        label:
          value === 'pick'
            ? t('app.master-data.bom.issueMethodPick')
            : value === 'backflush'
              ? t('app.master-data.bom.issueMethodBackflush')
              : t('app.master-data.bom.issueMethodNone'),
      })),
    [t],
  );
  const bomIssueMethodLabel = useMemo(
    () => Object.fromEntries(bomIssueMethodOptions.map((o) => [o.value, o.label])),
    [bomIssueMethodOptions],
  );
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>(null);
  const bomDetailReqRef = useRef(0);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentBOMUuid, setCurrentBOMUuid] = useState<string | null>(null);
  const [bomDetail, setBomDetail] = useState<BOM | null>(null);
  const [bomItems, setBomItems] = useState<BOM[]>([]); // 所有子物料列表
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑BOM）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [copySourceModalVisible, setCopySourceModalVisible] = useState(false);
  const [copySourceLoading, setCopySourceLoading] = useState(false);
  const [copySourceSubmitting, setCopySourceSubmitting] = useState(false);
  const [copySourceOptions, setCopySourceOptions] = useState<BomCopySourceOption[]>([]);
  const [selectedCopySource, setSelectedCopySource] = useState<string>();
  /** 编辑时：按主料+版本定位整份 BOM，保存时 replaceVersionItems */
  const [editContext, setEditContext] = useState<{ materialId: number; version: string; uuidsToReplace: string[] } | null>(null);
  const [editFormInitialValues, setEditFormInitialValues] = useState<Record<string, unknown> | null>(null);
  const [editFormHeaderId, setEditFormHeaderId] = useState<number | null>(null);
  const bomNameTouchedRef = useRef(false);

  const {
    customFields: bomFormCustomFields,
    customFieldValues: bomFormCustomFieldValues,
    loadFieldValues: loadBomFormFieldValues,
    extractFormValues: extractBomFormValues,
    saveCustomFieldValues: saveBomCustomFieldValues,
    resetFieldValues: resetBomFormFieldValues,
  } = useCustomFields({ tableName: BOM_CUSTOM_FIELD_TABLE, loadWhenOpen: true, open: modalVisible });

  const {
    customFields: bomListCustomFields,
    generateCustomFieldColumns: generateBomCustomFieldColumns,
    enrichRecordsWithCustomFields: enrichBomRecordsWithCustomFields,
    customFieldValues: bomDetailCustomFieldValues,
    loadFieldValuesForDetail: loadBomFieldValuesForDetail,
    resetDetailFieldValues: resetBomDetailFieldValues,
  } = useCustomFieldsForList<MaterialBOMRow>({ tableName: BOM_CUSTOM_FIELD_TABLE });
  useEffect(() => {
    if (!modalVisible || !isEdit || editFormHeaderId == null) return;
    loadBomFormFieldValues(editFormHeaderId).then((fieldFormValues) => {
      formRef.current?.setFieldsValue(fieldFormValues);
    });
  }, [modalVisible, isEdit, editFormHeaderId, loadBomFormFieldValues]);
  
  // 审核Modal状态
  const [approvalModalVisible, setApprovalModalVisible] = useState(false);
  const [approvalGroupKey, setApprovalGroupKey] = useState<string | null>(null);
  const [approvalComment, setApprovalComment] = useState<string>('');
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [approvalRecursive, setApprovalRecursive] = useState(false);
  
  // 批量导入加载状态
  const [batchImportLoading, setBatchImportLoading] = useState(false);

  const materialUnitImport = useImportMaterialUnitOptions();
  const materialUnitImportOptions = materialUnitImport.options;

  const bomImportTemplate = useMemo(() => {
    const baseTemplate = buildFactoryImportTemplate(
      t,
      [
        { field: 'bomCode', labelKey: 'app.master-data.bom.importHeaderBomCode' },
        { field: 'bomName', labelKey: 'app.master-data.bom.importHeaderBomName' },
        { field: 'version', labelKey: 'app.master-data.bom.importHeaderVersion' },
        { field: 'baseQuantity', labelKey: 'app.master-data.bom.importHeaderBaseQuantity' },
        {
          field: 'parentCode',
          required: true,
          labelKey: 'app.master-data.bom.importHeaderParentCode',
          aliases: ['产品编号', '父件编码', '父项编号'],
        },
        { field: 'componentCode', required: true, labelKey: 'app.master-data.bom.importHeaderComponentCode' },
        {
          field: 'quantity',
          required: true,
          labelKey: 'app.master-data.bom.importHeaderQuantity',
          aliases: ['数量'],
        },
        { field: 'unit', labelKey: 'app.master-data.bom.importHeaderUnit', aliases: ['单位'], options: materialUnitImportOptions },
        { field: 'wasteRate', labelKey: 'app.master-data.bom.importHeaderWasteRate' },
        {
          field: 'isRequired',
          labelKey: 'app.master-data.bom.importHeaderIsRequired',
          options: [...IMPORT_YES_NO_OPTIONS],
        },
        {
          field: 'isActive',
          labelKey: 'app.master-data.bom.importHeaderIsActive',
          options: [...IMPORT_YES_NO_OPTIONS],
        },
        { field: 'remark', labelKey: 'app.master-data.bom.importHeaderRemark' },
        {
          field: 'materialName',
          labelKey: 'app.master-data.bom.importHeaderMaterialName',
          aliases: ['产品名称', '物料名称'],
        },
        {
          field: 'specification',
          labelKey: 'app.master-data.bom.importHeaderSpecification',
          aliases: ['产品型号', '规格型号', '规格'],
        },
        { field: 'baseUnit', labelKey: 'app.master-data.bom.importHeaderBaseUnit', options: materialUnitImportOptions },
        { field: 'processRouteCode', labelKey: 'app.master-data.bom.importHeaderProcessRouteCode' },
        { field: 'processRouteName', labelKey: 'app.master-data.bom.importHeaderProcessRouteName' },
      ],
      [
        t('app.master-data.bom.importExample.bomCode'),
        t('app.master-data.bom.importExample.bomName'),
        t('app.master-data.bom.importExample.version'),
        t('app.master-data.bom.importExample.baseQuantity'),
        t('app.master-data.bom.importExample.parentCode'),
        t('app.master-data.bom.importExample.componentCode'),
        t('app.master-data.bom.importExample.quantity'),
        pickImportExampleValue(materialUnitImportOptions, t('app.master-data.bom.importExample.unit')),
        t('app.master-data.bom.importExample.wasteRate'),
        pickImportExampleValue([...IMPORT_YES_NO_OPTIONS], t('app.master-data.bom.importExample.isRequired')),
        pickImportExampleValue([...IMPORT_YES_NO_OPTIONS], t('app.master-data.bom.importExample.isActive')),
        '',
        '',
        '',
        '',
        '',
        '',
      ],
    );

    if (!bomListCustomFields.length) return baseTemplate;

    const importHeaders = [...baseTemplate.importHeaders];
    const importExampleRow = [...baseTemplate.importExampleRow];
    const importHeaderMap = { ...baseTemplate.importHeaderMap };
    const importColumnOptions = [...baseTemplate.importColumnOptions];

    const orderedCustomFields = [...bomListCustomFields].sort(
      (a: any, b: any) => Number(a?.sort_order ?? 0) - Number(b?.sort_order ?? 0),
    );

    orderedCustomFields.forEach((field: any) => {
      const label = String(field?.label || field?.name || field?.code || '').trim();
      if (!label || !field?.code) return;
      const customKey = `custom:${field.code}`;
      const header = field?.is_required ? `*${label}` : label;
      importHeaders.push(header);
      importExampleRow.push('');
      importColumnOptions.push(undefined);
      importHeaderMap[header] = customKey;
      importHeaderMap[label] = customKey;
      importHeaderMap[field.code] = customKey;
    });

    return {
      importHeaders,
      importExampleRow,
      importHeaderMap,
      importColumnOptions,
    };
  }, [t, i18n.language, bomListCustomFields, materialUnitImportOptions]);
  
  // 版本管理Modal状态
  const [versionModalVisible, setVersionModalVisible] = useState(false);
  const [versionCompareModalVisible, setVersionCompareModalVisible] = useState(false);
  const [versionHistoryModalVisible, setVersionHistoryModalVisible] = useState(false);
  const [currentMaterialId, setCurrentMaterialId] = useState<number | null>(null);
  const createVersionRecordRef = useRef<BOM | null>(null); // 创建新版本时当前操作的 BOM 记录（用于快速创建）
  const versionFormRef = useRef<ProFormInstance>();
  
  // 递归审核选项Ref（批量操作用）
  const recursiveApprovalRef = useRef<boolean>(false);
  // 单条撤销审核的递归选项Ref
  const recursiveUnapproveRef = useRef<boolean>(false);
  const [versionLoading, setVersionLoading] = useState(false);
  const [versionList, setVersionList] = useState<BOMVersionHistoryRow[]>([]);
  const [selectedVersions, setSelectedVersions] = useState<{ version1: string; version2: string } | null>(null);
  const [versionCompareResult, setVersionCompareResult] = useState<BOMVersionCompareResult | null>(null);

  const [whereUsedModalVisible, setWhereUsedModalVisible] = useState(false);
  const [whereUsedLoading, setWhereUsedLoading] = useState(false);
  const [whereUsedResult, setWhereUsedResult] = useState<BOMWhereUsedResult | null>(null);
  const [whereUsedRecursive, setWhereUsedRecursive] = useState(false);
  const [whereUsedMaterialId, setWhereUsedMaterialId] = useState<number | null>(null);
  
  // 层级结构状态（整合到详情中）
  const [hierarchyLoading, setHierarchyLoading] = useState(false);
  const [hierarchyData, setHierarchyData] = useState<any>(null);
  const [hierarchyTreeData, setHierarchyTreeData] = useState<DataNode[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  
  // 设为失效 Modal 状态
  const [obsoleteModalVisible, setObsoleteModalVisible] = useState(false);
  const [obsoleteRecord, setObsoleteRecord] = useState<BOM | null>(null);
  const [obsoleteReason, setObsoleteReason] = useState('');
  const [obsoleteLoading, setObsoleteLoading] = useState(false);

  // 用量计算Modal状态
  const [quantityModalVisible, setQuantityModalVisible] = useState(false);
  const [quantityLoading, setQuantityLoading] = useState(false);
  const [quantityResult, setQuantityResult] = useState<BOMQuantityResult | null>(null);
  const [parentQuantity, setParentQuantity] = useState<number>(1.0);
  const quantityFormRef = useRef<ProFormInstance>();
  
  // 物料列表（表单下拉 + 列表展示名称；列表展示按 BOM 引用 ID 补齐，不依赖前 1000 条）
  const [materials, setMaterials] = useState<Material[]>([]);
  const materialsRef = useRef<Material[]>([]);
  materialsRef.current = materials;
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const materialsById = useMemo(() => {
    const map = new Map<number, Material>();
    materials.forEach((m) => map.set(m.id, m));
    return map;
  }, [materials]);
  const [mainMaterialScope, setMainMaterialScope] = useState<'make' | 'all'>('make');
  const mainMaterialOptions = useMemo(
    () =>
      materials
        .filter((m) => {
          // BOM 挂在主物料上；变体 SKU 行不作为主物料候选
          if (isVariantSkuMaterial(m)) return false;
          if (mainMaterialScope === 'all') return true;
          const sourceType = String((m as any).sourceType ?? (m as any).source_type ?? '');
          return sourceType === 'Make';
        })
        .map((m) => ({ label: formatMaterialLabel(m), value: m.id })),
    [materials, mainMaterialScope],
  );
  
  const sourceTypeOptions = useMemo(() => buildMaterialSourceTypeOptions(t), [t]);

  const getComponentMaterialSourceType = (componentId?: number | null): string => {
    if (componentId == null) return '';
    return getMaterialSourceTypeFromRecord(materials.find((m) => m.id === componentId));
  };

  const patchLocalMaterialSourcesAfterSave = (
    items: Array<{ componentId?: number; sourceType?: string }>,
  ) => {
    const updates = new Map<number, string>();
    items.forEach((item) => {
      if (!item.componentId || !item.sourceType) return;
      if (getComponentMaterialSourceType(item.componentId)) return;
      const normalized = normalizeMaterialSourceType(item.sourceType);
      if (normalized) updates.set(item.componentId, normalized);
    });
    if (!updates.size) return;
    setMaterials((prev) =>
      prev.map((m) => {
        const nextSource = updates.get(m.id);
        if (!nextSource) return m;
        return { ...m, sourceType: nextSource, source_type: nextSource };
      }),
    );
  };

  // 单位字典映射（value -> label）
  const [unitValueToLabel, setUnitValueToLabel] = useState<Record<string, string>>({});

  // 用户列表（用于渲染审核人姓名）
  const [users, setUsers] = useState<User[]>([]);
  const currentUser = useCurrentUser();

  /** BOM 视图类型（与 UniTable 视图联动）：productBom=成品 | semiProductBom=半成品 | allBom=全部 */
  const bomViewTypeRef = useRef<'productBom' | 'semiProductBom' | 'allBom'>('productBom');

  /** 分组行 groupKey -> 该组内所有 BOM 的 uuid，用于批量删除时解析 */
  const groupKeyToUuidsRef = useRef<Map<string, string[]>>(new Map());

  /** 物料选中的版本 materialId -> groupKey，切换版本时更新并 reload */
  const [selectedVersionByMaterial, setSelectedVersionByMaterial] = useState<Record<number, string>>({});

  /**
   * 加载用户列表
   */
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const result = await searchUserDisplay({ page_size: 200, is_active: true });
        setUsers(displayItemsToUsers(result.items || []));
      } catch (error: unknown) {
        console.error('加载用户列表失败:', error);
      }
    };
    void loadUsers();
  }, [currentUser]);

  /**
   * 加载物料列表（仅创建/编辑弹窗需要；列表名称按当前页 ID 精确补齐）
   */
  useEffect(() => {
    if (!modalVisible) return;
    const loadMaterials = async () => {
      try {
        setMaterialsLoading(true);
        const result = await materialApi.list({ limit: 1000, isActive: true });
        setMaterials(result.items ?? []);
      } catch (error: any) {
        console.error('加载物料列表失败:', error);
      } finally {
        setMaterialsLoading(false);
      }
    };
    loadMaterials();
  }, [modalVisible]);

  const ensureMaterialsByIds = async (ids: Iterable<number>): Promise<Material[]> => {
    const uniqueIds = Array.from(
      new Set(
        Array.from(ids)
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    );
    if (!uniqueIds.length) return materialsRef.current;

    const existing = new Map(materialsRef.current.map((m) => [m.id, m]));
    const missing = uniqueIds.filter((id) => !existing.has(id));
    if (!missing.length) return materialsRef.current;

    const chunkSize = 500;
    const fetched: Material[] = [];
    for (let i = 0; i < missing.length; i += chunkSize) {
      const chunk = missing.slice(i, i + chunkSize);
      const result = await materialApi.list({ ids: chunk, limit: chunk.length });
      fetched.push(...(result.items ?? []));
    }

    const merged = [...materialsRef.current];
    const seen = new Set(merged.map((m) => m.id));
    fetched.forEach((m) => {
      if (!seen.has(m.id)) {
        merged.push(m);
        seen.add(m.id);
      }
    });
    materialsRef.current = merged;
    setMaterials(merged);
    return merged;
  };

  const collectBomMaterialIds = (
    rows: Array<MaterialBOMRow | BOMGroupRow | BOM | Record<string, unknown>>,
  ): number[] => {
    const ids = new Set<number>();
    const walk = (nodes: any[] | undefined) => {
      (nodes ?? []).forEach((node) => {
        if (node?.materialId != null) ids.add(Number(node.materialId));
        if (node?.material_id != null) ids.add(Number(node.material_id));
        if (node?.componentId != null) ids.add(Number(node.componentId));
        if (node?.component_id != null) ids.add(Number(node.component_id));
        if (Array.isArray(node?.children)) walk(node.children);
        if (Array.isArray(node?.items)) walk(node.items);
        if (Array.isArray(node?.versions)) walk(node.versions);
      });
    };
    walk(rows);
    return Array.from(ids);
  };

  useEffect(() => {
    if (!(modalVisible && !isEdit)) return;
    const currentId = Number(formRef.current?.getFieldValue('materialId'));
    if (!currentId) return;
    const existsInScope = mainMaterialOptions.some((opt) => Number(opt.value) === currentId);
    if (!existsInScope) {
      formRef.current?.setFieldValue('materialId', undefined);
    }
  }, [mainMaterialOptions, modalVisible, isEdit]);

  useEffect(() => {
    let cancelled = false;
    getMaterialUnitDisplayMapShared()
      .then((map) => {
        if (!cancelled) setUnitValueToLabel(map);
      })
      .catch((error) => {
        console.error('加载单位主数据失败:', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * 重新生成BOM编号（根据当前表单值）
   */
  const regenerateBOMCode = async () => {
    if (isEdit) {
      return;
    }

    // 直接从后端API获取配置，而不是使用本地配置
    try {
      const config = await getCodeRulePageConfig('master-data-engineering-bom');
      
      if (!config?.autoGenerate || !config?.ruleCode) {
        console.warn('BOM编号自动生成未启用或规则代码不存在:', config);
        return;
      }

      const ruleCode = config.ruleCode;

      // 获取当前表单值
      const formValues = formRef.current?.getFieldsValue();
      const materialId = formValues?.materialId;
      const version = formValues?.version || '1.0';
      
      // 构建编号规则的上下文
      const context: Record<string, any> = {
        version,
      };
      
      // 如果选择了主物料，添加物料信息到上下文
      if (materialId) {
        const selectedMaterial = materials.find(m => m.id === materialId);
        if (selectedMaterial) {
          context.material_code = selectedMaterial.mainCode || selectedMaterial.code;
          context.material_name = selectedMaterial.name;
        }
      }
      
      const codeResponse = await testGenerateCode({ 
        rule_code: ruleCode,
        context,
        check_duplicate: true,
        entity_type: 'bom',
      });
      
      // 如果返回的编号不为空，更新表单字段（总是更新预览）
      if (codeResponse.code) {
        formRef.current?.setFieldsValue({
          bomCode: codeResponse.code,
        });
        regenerateBomName(codeResponse.code);
      }
    } catch (error: any) {
      console.error('获取编号规则配置或生成编号失败:', error?.message || error);
    }
  };

  const regenerateBomName = (bomCodeOverride?: string) => {
    if (bomNameTouchedRef.current || isEdit) return;
    const formValues = formRef.current?.getFieldsValue();
    const materialId = formValues?.materialId;
    const bomCode = bomCodeOverride ?? formValues?.bomCode;
    const selectedMaterial = materialId ? materials.find((m) => m.id === materialId) : undefined;
    const nextName = buildDefaultBomName(selectedMaterial, bomCode);
    formRef.current?.setFieldsValue({ bomName: nextName || undefined });
  };

  /**
   * 处理新建BOM
   */
  const handleCreate = async () => {
    setIsEdit(false);
    setEditContext(null);
    setEditFormInitialValues(null);
    setEditFormHeaderId(null);
    setCurrentBOMUuid(null);
    bomNameTouchedRef.current = false;
    setModalVisible(true);
    resetBomFormFieldValues();
  };

  useNewShortcut(handleCreate);

  const handleBomModalAfterOpenChange = (open: boolean) => {
    if (!open || isEdit) return;
    // Modal + ProForm 挂载完成后再触发自动编号，避免 formRef 未就绪导致回填丢失。
    requestAnimationFrame(() => {
      formRef.current?.setFieldsValue({
        version: formRef.current?.getFieldValue('version') || '1.0',
      });
      void regenerateBOMCode();
      regenerateBomName();
    });
  };

  /**
   * 处理编辑BOM（按主料+版本加载完整 BOM 结构，支持增删改子件）
   * @param record 任意一条该 BOM 下的记录（含 materialId、version），用于定位整份 BOM
   */
  const handleEdit = async (record: BOM) => {
    try {
      const list = await bomApi.getByMaterial(record.materialId, record.version, false);
      if (!list?.length) {
        messageApi.error(t('app.master-data.bom.bomNotFound'));
        return;
      }
      const first = list[0]!;
      // 先按子件/主件 ID 补齐物料主数据，供下拉展示与来源回填（不依赖前 1000 条缓存）
      await ensureMaterialsByIds([
        first.materialId,
        ...list.map((b) => b.componentId),
      ]);
      setIsEdit(true);
      bomNameTouchedRef.current = true;
      setEditContext({
        materialId: first.materialId,
        version: first.version ?? '1.0',
        uuidsToReplace: list.map((b) => b.uuid),
      });
      const bomCodeValue = first.bomCode ?? list.find(b => b.bomCode)?.bomCode ?? '';
      const itemsData = list.map((b) => {
        const compMaterial = materialsRef.current.find((m) => m.id === b.componentId);
        const materialSource = getMaterialSourceTypeFromRecord(compMaterial);
        return {
          componentId: b.componentId,
          quantity: b.quantity,
          unit: b.unit,
          wasteRate: b.wasteRate ?? 0,
          isRequired: b.isRequired !== false,
          issueMethod: b.issueMethod ?? (b as { issue_method?: string }).issue_method ?? 'pick',
          isAlternative: b.isAlternative,
          alternativeGroupId: b.alternativeGroupId,
          priority: b.priority,
          description: b.description,
          remark: b.remark,
          sourceType: materialSource || undefined,
        };
      });
      setEditFormHeaderId(first.id ?? null);
      setEditFormInitialValues({
        materialId: first.materialId,
        version: first.version ?? '1.0',
        baseQuantity: first.baseQuantity ?? 1,
        bomName: first.bomName ?? undefined,
        bomCode: bomCodeValue,
        effectiveDate: first.effectiveDate,
        expiryDate: first.expiryDate,
        approvalStatus: first.approvalStatus,
        description: first.description,
        remark: first.remark,
        isActive: first.isActive,
        items: itemsData,
      });
      setModalVisible(true);
    } catch (error: any) {
      messageApi.error(error?.message || t('app.master-data.bom.getFailed'));
    }
  };
  
  /**
   * 处理单条撤销审核（按组：该 BOM 版本下所有子件行一并撤销审核，支持可选递归子BOM）
   */
  const handleUnapproveGroup = (record: BOMGroupRow) => {
    const uuids = groupKeyToUuidsRef.current.get(record.groupKey);
    if (!uuids?.length) {
      messageApi.error(t('app.master-data.bom.getRecordFailed'));
      return;
    }
    recursiveUnapproveRef.current = false;
    Modal.confirm({
      title: t('app.master-data.bom.unapproveConfirmTitle'),
      content: (
        <div>
          <p>{t('app.master-data.bom.unapproveConfirmContent', { bomCode: record.bomCode, version: record.version })}</p>
          <p style={{ color: '#ff4d4f' }}>{t('app.master-data.bom.unapproveResetDraft')}</p>
          <div style={{ marginTop: 12 }}>
            <Checkbox onChange={(e) => { recursiveUnapproveRef.current = e.target.checked; }}>
              {t('app.master-data.bom.recursiveUnapprove')}
            </Checkbox>
          </div>
        </div>
      ),
      okText: t('app.master-data.bom.okUnapprove'),
      okType: 'danger',
      cancelText: t('app.master-data.bom.cancel'),
      onOk: async () => {
        try {
          await bomApi.batchApprove(uuids, true, t('app.master-data.bom.unapproveComment'), recursiveUnapproveRef.current, true);
          messageApi.success(t('app.master-data.bom.unapproveSuccess'));
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('app.master-data.bom.unapproveFailed'));
        }
      },
    });
  };

  /**
   * 处理打开审核Modal
   */
  const handleOpenApproval = (record: BOMGroupRow) => {
    setApprovalGroupKey(record.groupKey);
    setApprovalComment('');
    setApprovalRecursive(false);
    setApprovalModalVisible(true);
  };

  /**
   * 处理审核BOM（支持递归审核子BOM）
   */
  const handleApprove = async (approved: boolean) => {
    if (!approvalGroupKey) return;
    const uuids = groupKeyToUuidsRef.current.get(approvalGroupKey);
    if (!uuids?.length) {
      messageApi.error(t('app.master-data.bom.getRecordFailed'));
      return;
    }

    try {
      setApprovalLoading(true);
      await bomApi.batchApprove(uuids, approved, approvalComment || undefined, approvalRecursive, false);
      messageApi.success(approved ? t('app.master-data.bom.approvePass') : t('app.master-data.bom.approveReject'));
      setApprovalModalVisible(false);
      setApprovalComment('');
      setApprovalGroupKey(null);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.bom.approveFailed'));
    } finally {
      setApprovalLoading(false);
    }
  };
  
  /**
   * 获取审核状态标签
   */
  const getApprovalStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
      draft: { color: 'default', text: t('app.master-data.bom.statusDraft'), icon: <ClockCircleOutlined /> },
      pending: { color: 'processing', text: t('app.master-data.bom.statusPending'), icon: <ClockCircleOutlined /> },
      approved: { color: 'success', text: t('app.master-data.bom.statusApproved'), icon: <CheckCircleOutlined /> },
      rejected: { color: 'error', text: t('app.master-data.bom.statusRejected'), icon: <CloseCircleOutlined /> },
    };
    
    const statusInfo = statusMap[status] || statusMap.draft;
    return (
      <Tag color={statusInfo.color} icon={statusInfo.icon} variant="solid">
        {statusInfo.text}
      </Tag>
    );
  };

  /**
   * 处理删除单条BOM（子件级，保留供批量删除等场景）
   */
  const handleDelete = async (record: BOM) => {
    try {
      await bomApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  /**
   * 删除整份BOM（主件下全部子件）
   */
  const handleDeleteGroup = (record: BOMGroupRow) => {
    const uuids = record.items.map((i) => i.uuid);
    if (!uuids.length) return;
    Modal.confirm({
      title: t('app.master-data.bom.deleteConfirmTitle'),
      content: t('app.master-data.bom.deleteConfirmContent', { count: uuids.length }),
      okText: t('app.master-data.bom.ok'),
      cancelText: t('app.master-data.bom.cancel'),
      okType: 'danger',
      onOk: async () => {
        try {
          for (const uuid of uuids) await bomApi.delete(uuid);
          messageApi.success(t('common.deleteSuccess'));
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error?.message || t('common.deleteFailed'));
        }
      },
    });
  };

  /**
   * 处理批量删除BOM（支持分组行：groupKey 解析为该组所有 uuid 并删除）
   */
  const handleBatchDelete = async (keys?: React.Key[]) => {
    const targetKeys = keys ?? selectedRowKeys;
    if (targetKeys.length === 0) {
      messageApi.warning(t('common.selectToDelete'));
      return;
    }

    const toDelete: string[] = [];
    for (const key of targetKeys) {
      const k = String(key);
      if (k.startsWith('group:')) {
        const uuids = groupKeyToUuidsRef.current.get(k);
        if (uuids?.length) toDelete.push(...uuids);
      } else {
        toDelete.push(k);
      }
    }
    const count = toDelete.length;
    if (count === 0) {
      messageApi.warning(t('app.master-data.bom.noDeleteRecords'));
      return;
    }

    try {
      let successCount = 0;
      let failCount = 0;
      const errors: string[] = [];
      for (const uuid of toDelete) {
        try {
          await bomApi.delete(uuid);
          successCount++;
        } catch (error: any) {
          failCount++;
          errors.push(error.message || t('app.master-data.bom.deleteFailed'));
        }
      }
      if (successCount > 0) messageApi.success(t('common.batchDeleteSuccess', { count: successCount }));
      if (failCount > 0)
        messageApi.error(
          t('common.batchDeletePartial', {
            count: failCount,
            errors: errors.length ? '：' + errors.join('; ') : '',
          }),
        );
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error((error as any).message || t('common.batchDeleteFailed'));
    }
  };


  /**
   * 处理批量审核BOM
   */
  /**
   * 处理批量审核BOM
   */
  const handleBatchApprove = (keys?: React.Key[]) => {
    const targetKeys = keys ?? selectedRowKeys;
    if (targetKeys.length === 0) {
      messageApi.warning(t('app.master-data.bom.selectToApprove'));
      return;
    }

    const toProcess: string[] = [];
    for (const key of targetKeys) {
      const k = String(key);
      if (k.startsWith('group:')) {
        const uuids = groupKeyToUuidsRef.current.get(k);
        if (uuids?.length) toProcess.push(...uuids);
      } else {
        toProcess.push(k);
      }
    }
    const count = toProcess.length;
    if (count === 0) {
      messageApi.warning(t('app.master-data.bom.noApproveRecords'));
      return;
    }

    // 重置默认值
    recursiveApprovalRef.current = false;

    Modal.confirm({
      title: t('app.master-data.bom.batchApproveTitle'),
      content: (
        <div>
          <p>{t('app.master-data.bom.batchApproveContent', { count })}</p>
          <div style={{ marginTop: 8 }}>
             <Checkbox onChange={(e) => recursiveApprovalRef.current = e.target.checked}>
                {t('app.master-data.bom.recursiveApprove')}
             </Checkbox>
          </div>
        </div>
      ),
      okText: t('app.master-data.bom.okApprove'),
      cancelText: t('app.master-data.bom.cancel'),
      onOk: async () => {
        try {
          // 直接调用批量审核API
          await bomApi.batchApprove(toProcess, true, t('app.master-data.bom.batchApproveComment'), recursiveApprovalRef.current, false);
          messageApi.success(t('app.master-data.bom.approveSuccess', { count }));
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('app.master-data.bom.batchApproveFailed'));
        }
      },
    });
  };

  /**
   * 处理批量撤销审核BOM
   */
  const handleBatchUnapprove = (keys?: React.Key[]) => {
    const targetKeys = keys ?? selectedRowKeys;
    if (targetKeys.length === 0) {
      messageApi.warning(t('app.master-data.bom.selectToOperate'));
      return;
    }

    const toProcess: string[] = [];
    for (const key of targetKeys) {
        const k = String(key);
        if (k.startsWith('group:')) {
            const uuids = groupKeyToUuidsRef.current.get(k);
            if (uuids?.length) toProcess.push(...uuids);
        } else {
            toProcess.push(k);
        }
    }
    const count = toProcess.length;
    if (count === 0) {
        messageApi.warning(t('app.master-data.bom.noOperateRecords'));
        return;
    }

    // 重置默认值
    recursiveApprovalRef.current = false;

    Modal.confirm({
      title: t('app.master-data.bom.batchUnapproveTitle'),
      content: (
          <div>
            <p>{t('app.master-data.bom.batchUnapproveContent', { count })}</p>
            <p style={{ color: '#ff4d4f' }}>{t('app.master-data.bom.unapproveResetDraftTip')}</p>
            <div style={{ marginTop: 8 }}>
                 <Checkbox onChange={(e) => recursiveApprovalRef.current = e.target.checked}>
                    {t('app.master-data.bom.recursiveUnapproveShort')}
                 </Checkbox>
            </div>
          </div>
      ),
      okText: t('app.master-data.bom.okUnapprove'),
      okType: 'danger',
      cancelText: t('app.master-data.bom.cancel'),
      onOk: async () => {
        try {
          await bomApi.batchApprove(toProcess, true, t('app.master-data.bom.batchUnapproveComment'), recursiveApprovalRef.current, true);
          messageApi.success(t('app.master-data.bom.unapproveCountSuccess', { count }));
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('app.master-data.bom.batchUnapproveFailed'));
        }
      },
    });
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: BOM) => {
    const req = ++bomDetailReqRef.current;
    flushDrawerOpen(() => {
      setCurrentBOMUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      setHierarchyLoading(true);
      setBomDetail(null);
      setBomItems([]);
      setHierarchyData(null);
      setHierarchyTreeData([]);
      setExpandedKeys([]);
    });
    try {
      // 获取整个BOM结构（所有子物料）
      const allBomItems = await bomApi.getByMaterial(record.materialId, record.version, false);

      if (bomDetailReqRef.current !== req) return;

      if (!allBomItems || allBomItems.length === 0) {
        messageApi.error(t('app.master-data.bom.bomDataNotFound'));
        return;
      }
      
      // 使用第一条记录作为基本信息（包含BOM编号、版本等）
      const firstItem = allBomItems[0]!;
      setBomDetail(firstItem);
      setBomItems(allBomItems);
      if (firstItem.id != null) {
        await loadBomFieldValuesForDetail(firstItem.id);
      }

      // 并行加载层级结构
      const hierarchy = await bomApi.getHierarchy(record.materialId, record.version).catch(() => null);

      if (bomDetailReqRef.current !== req) return;
      
      // 处理层级结构数据
      if (hierarchy) {
        setHierarchyData(hierarchy);
        
        // 转换为Tree组件需要的格式
        const convertToTreeData = (items: BOMHierarchyItem[], parentPath: string = ''): DataNode[] => {
          return items.map((item, index) => {
            const currentPath = parentPath ? `${parentPath}/${index}` : `${index}`;
            // 直接使用后端返回的 componentCode 和 componentName（与层级接口同源）
            let materialName = '';
            if (item.componentCode && item.componentName) {
              materialName = `${item.componentCode} - ${item.componentName}`;
            } else if (item.componentId) {
              const material = materialsById.get(item.componentId);
              if (material) {
                materialName = `${material.code || material.mainCode || ''} - ${material.name}`;
              } else {
                console.error('[BOM] hierarchy material master missing', item.componentId);
                materialName = t('app.master-data.bom.materialNameMissing', {
                  id: item.componentId,
                  defaultValue: `物料主数据未加载（ID: ${item.componentId}）`,
                });
              }
            } else {
              materialName = t('app.master-data.bom.materialIdUnknown');
            }
            
            // 构建节点标题
            const title = (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 500 }}>{materialName}</span>
                <Tag color="blue">{item.quantity} {item.unit || ''}</Tag>
                {item.wasteRate > 0 && (
                  <Tag color="orange">{t('app.master-data.bom.hierarchyWasteRateLabel')}: {item.wasteRate}%</Tag>
                )}
                {!item.isRequired && (
                  <Tag color="default">{t('app.master-data.bom.optionalLabel')}</Tag>
                )}
                <span style={{ color: '#999', fontSize: '12px' }}>
                  {t('app.master-data.bom.hierarchyLevelLabel')}: {item.level}
                </span>
              </div>
            );
            
            return {
              title,
              key: currentPath,
              children: item.children && item.children.length > 0 ? convertToTreeData(item.children, currentPath) : undefined,
              isLeaf: !item.children || item.children.length === 0,
              data: item,
            };
          });
        };
        
        const treeData = convertToTreeData(hierarchy.items || []);
        setHierarchyTreeData(treeData);
        
        // 默认展开所有节点
        const getAllKeys = (nodes: DataNode[]): React.Key[] => {
          let keys: React.Key[] = [];
          nodes.forEach(node => {
            keys.push(node.key);
            if (node.children && node.children.length > 0) {
              keys = keys.concat(getAllKeys(node.children));
            }
          });
          return keys;
        };
        setExpandedKeys(getAllKeys(treeData));
      } else {
        setHierarchyData(null);
        setHierarchyTreeData([]);
        setExpandedKeys([]);
      }
    } catch (error: any) {
      if (bomDetailReqRef.current === req) {
        messageApi.error(error.message || t('app.master-data.bom.getDetailFailed'));
      }
    } finally {
      if (bomDetailReqRef.current === req) {
        setDetailLoading(false);
        setHierarchyLoading(false);
      }
    }
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setCurrentBOMUuid(null);
    setBomDetail(null);
    setBomItems([]);
    setHierarchyData(null);
    setHierarchyTreeData([]);
    setExpandedKeys([]);
    resetBomDetailFieldValues();
  };

  const enrichBomListPage = async (
    result: { data: MaterialBOMRow[]; success: boolean; total: number },
    options?: { skipEnrich?: boolean },
  ) => {
    if (!result.success || result.data.length === 0) return result;
    if (options?.skipEnrich) return result;
    const data = await enrichBomRecordsWithCustomFields(
      result.data.map((r) => ({ ...r, id: r.selectedVersion?.firstItem?.id }))
    );
    return { ...result, data };
  };

  const formatCyclePath = (path: number[]) =>
    path.map((id) => getMaterialName(id)).join(' → ');

  const detectBomItemCycles = async (materialId: number, items: Array<{ componentId?: number }>) => {
    for (const item of items) {
      if (!item.componentId) continue;
      const result = await bomApi.detectCycle(materialId, item.componentId);
      if (result.hasCycle) {
        throw new Error(
          t('app.master-data.bom.cycleDetected', {
            path: formatCyclePath(result.path ?? []),
          }),
        );
      }
    }
  };

  /**
   * 处理提交表单（创建/更新BOM）
   * 编辑时：replaceVersionItems 原子替换指定版本明细
   */
  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      const { customData, standardValues } = extractBomFormValues(values);
      if (!standardValues.items || standardValues.items.length === 0) {
        messageApi.error(t('app.master-data.bom.addAtLeastOneChild'));
        return;
      }
      if (!standardValues.materialId) {
        messageApi.error(t('app.master-data.bom.selectMainMaterial'));
        return;
      }

      await detectBomItemCycles(standardValues.materialId, standardValues.items);

      const buildBatch = () => {
        return {
          material_id: standardValues.materialId,
          items: standardValues.items.map((item: any) => {
            if (!item.componentId) throw new Error(t('app.master-data.bom.selectChildMaterial'));
            if (!item.quantity || item.quantity <= 0) throw new Error(t('app.master-data.bom.quantityMustBePositive'));
            const unitValue = (item.unit && item.unit.trim()) ? item.unit.trim() : null;
            const materialSource = getComponentMaterialSourceType(item.componentId);
            const formSource = normalizeMaterialSourceType(item.sourceType);
            const sourceTypeForApi = materialSource ? null : (formSource || null);
            return {
              component_id: item.componentId,
              quantity: item.quantity,
              unit: unitValue,
              waste_rate: item.wasteRate ?? 0,
              is_required: item.isRequired !== false,
              issue_method: item.issueMethod ?? 'pick',
              is_alternative: item.isAlternative || false,
              alternative_group_id: item.alternativeGroupId || null,
              priority: item.priority || 0,
              description: item.description || null,
              remark: item.remark || null,
              source_type: sourceTypeForApi,
            };
          }),
          version: standardValues.version || '1.0',
          base_quantity: standardValues.baseQuantity ?? 1,
          bom_name: standardValues.bomName != null ? String(standardValues.bomName).trim() : undefined,
          bom_code: standardValues.bomCode,
          effective_date: standardValues.effectiveDate,
          expiry_date: standardValues.expiryDate,
          description: standardValues.description,
          remark: standardValues.remark,
          is_active: standardValues.isActive !== false,
        };
      };

      let createdList: BOM[] = [];
      if (isEdit && editContext) {
        const batchData = buildBatch();
        createdList = await bomApi.replaceVersionItems(
          editContext.materialId,
          editContext.version,
          batchData as BOMBatchCreate,
        );
        messageApi.success(t('app.master-data.bom.structureUpdated', { count: batchData.items.length }));
        setEditContext(null);
        setEditFormInitialValues(null);
        setEditFormHeaderId(null);
      } else {
        const batchData = buildBatch();
        createdList = await bomApi.create(batchData as any);
        messageApi.success(t('app.master-data.bom.itemsCreated', { count: batchData.items.length }));
      }

      const headerId = createdList[0]?.id;
      if (headerId != null) {
        await saveBomCustomFieldValues(headerId, customData);
      }

      patchLocalMaterialSourcesAfterSave(standardValues.items);

      setModalVisible(false);
      formRef.current?.resetFields();
      resetBomFormFieldValues();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || (isEdit ? t('common.updateFailed') : t('common.createFailed')));
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 处理关闭 Modal
   */
  const handleCloseModal = () => {
    setModalVisible(false);
    setEditContext(null);
    setEditFormInitialValues(null);
    setEditFormHeaderId(null);
    setMaterialPickerOpen(false);
    setCopySourceModalVisible(false);
    setSelectedCopySource(undefined);
    setCopySourceOptions([]);
    formRef.current?.resetFields();
    resetBomFormFieldValues();
  };

  /** 堆叠列用：名称主行、编号次行 */
  const getMaterialParts = (
    materialId: number | undefined | null,
  ): { code: string; name: string; spec: string; missing: boolean } => {
    if (materialId == null) {
      return { code: '', name: '-', spec: '', missing: true };
    }
    const material = materialsById.get(materialId);
    if (!material) {
      console.error('[BOM] material master missing for display', materialId);
      return {
        code: '',
        name: t('app.master-data.bom.materialNameMissing', {
          id: materialId,
          defaultValue: `物料主数据未加载（ID: ${materialId}）`,
        }),
        spec: '',
        missing: true,
      };
    }
    return {
      code: material.code || material.mainCode || '',
      name: material.name || '-',
      spec: material.specification || '',
      missing: false,
    };
  };

  /**
   * 获取物料名称（用于列表主物料/子物料列展示）
   * 列表请求会先按 BOM 引用 ID 精确补齐物料主数据；此处不再用「物料ID」软兜底掩盖未加载。
   */
  const getMaterialName = (materialId: number | undefined | null): string => {
    const parts = getMaterialParts(materialId);
    if (parts.missing) return parts.name;
    const spec = parts.spec ? ` (${parts.spec})` : '';
    return `${parts.code} - ${parts.name}${spec}`;
  };

  /**
   * 格式化物料显示文本（用于下拉选择器）
   */
  function formatMaterialLabel(material: Material): string {
    const code = material.code || material.mainCode || '';
    const spec = material.specification ? ` (${material.specification})` : '';
    return `${code} - ${material.name}${spec}`;
  }

  const getFormItems = (): Record<string, any>[] => {
    const raw = formRef.current?.getFieldValue('items');
    return Array.isArray(raw) ? raw : [];
  };
  const setItemField = (index: number, field: string, value: unknown) => {
    formRef.current?.setFieldValue(['items', index, field], value);
  };

  const getAlternativeGroupOptions = (items: Record<string, any>[]) => {
    const ids = Array.from(
      new Set(
        items
          .map((item) => Number(item?.alternativeGroupId))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    ).sort((a, b) => a - b);
    return ids.map((id) => ({
      value: id,
      label: `${t('app.master-data.bom.alternativeGroupLabelPrefix')} ${id}`,
    }));
  };

  const getNextAlternativeGroupId = (items: Record<string, any>[]) => {
    const used = new Set(
      items
        .map((item) => Number(item?.alternativeGroupId))
        .filter((id) => Number.isFinite(id) && id > 0),
    );
    let next = 1;
    while (used.has(next)) next += 1;
    return next;
  };

  const getNextPriorityInGroup = (
    items: Record<string, any>[],
    groupId: number,
    excludeIndex?: number,
  ) => {
    const maxPriority = items.reduce((max, item, idx) => {
      if (excludeIndex !== undefined && idx === excludeIndex) return max;
      if (!item?.isAlternative || Number(item?.alternativeGroupId) !== groupId) return max;
      const p = Number(item?.priority);
      return Number.isFinite(p) ? Math.max(max, p) : max;
    }, -1);
    return maxPriority + 1;
  };

  const applyAlternativeGroupToRow = (
    index: number,
    groupId: number | undefined,
    opts?: { keepPriority?: boolean },
  ) => {
    const items = getFormItems();
    if (!items[index]) return;
    const snapshot = [...items];
    const previousPriority = Number(snapshot[index]?.priority);
    const keepPriority =
      !!opts?.keepPriority && Number.isFinite(previousPriority) && previousPriority >= 0;
    const nextPriority = keepPriority
      ? previousPriority
      : (groupId ? getNextPriorityInGroup(snapshot, groupId, index) : 0);
    setItemField(index, 'isAlternative', !!groupId);
    setItemField(index, 'alternativeGroupId', groupId);
    setItemField(index, 'priority', nextPriority);
  };

  const handleAlternativeToggle = (index: number, checked: boolean) => {
    const items = getFormItems();
    if (!items[index]) return;
    if (!checked) {
      setItemField(index, 'isAlternative', false);
      setItemField(index, 'alternativeGroupId', undefined);
      setItemField(index, 'priority', 0);
      return;
    }
    const currentGroupId = Number(items[index]?.alternativeGroupId);
    if (Number.isFinite(currentGroupId) && currentGroupId > 0) {
      applyAlternativeGroupToRow(index, currentGroupId, { keepPriority: true });
      return;
    }
    const newGroupId = getNextAlternativeGroupId(items);
    applyAlternativeGroupToRow(index, newGroupId);
  };

  const handleCreateAlternativeGroup = (index: number) => {
    const items = getFormItems();
    const newGroupId = getNextAlternativeGroupId(items);
    applyAlternativeGroupToRow(index, newGroupId);
  };

  const appendBomItemsToForm = (incomingItems: Array<Record<string, unknown>>) => {
    if (!incomingItems.length) return;
    const existingItems = formRef.current?.getFieldValue('items');
    const normalizedExisting = Array.isArray(existingItems) ? existingItems : [];
    formRef.current?.setFieldsValue({
      items: [...normalizedExisting, ...incomingItems] as Record<string, any>[],
    });
    void formRef.current?.validateFields(['items']).catch(() => undefined);
  };

  const appendItemsFromMaterials = (selectedMaterials: Material[]) => {
    setMaterials((prev) => upsertMaterialsById(prev, selectedMaterials));
    const rows = selectedMaterials.map((material) =>
      buildDefaultBomItem({
        componentId: material.id,
        unit: material.baseUnit ?? '',
        sourceType: getMaterialSourceTypeFromRecord(material) || undefined,
      }),
    );
    appendBomItemsToForm(rows);
  };

  const handleOpenCopySourceModal = async () => {
    try {
      setCopySourceLoading(true);
      const groups = (await bomApi.getGroups({ includeObsolete: false })).data;
      const currentMaterialId = Number(formRef.current?.getFieldValue('materialId'));
      const currentVersion = String(formRef.current?.getFieldValue('version') || '1.0');
      const options: BomCopySourceOption[] = groups
        .map((group) => {
          const materialId = Number(group.material_id);
          const version = String(group.version || '1.0');
          return {
            value: `${materialId}::${version}`,
            materialId,
            version,
            label: (() => {
              const sourceMaterial = materials.find((item) => item.id === materialId);
              const code = sourceMaterial?.mainCode || sourceMaterial?.code || `${t('app.master-data.bom.materialIdPrefix')}:${materialId}`;
              const name = sourceMaterial?.name || '-';
              return `${code} - ${name} (${t('app.master-data.bom.versionLabel')} ${version})`;
            })(),
          };
        })
        .filter((option) => !(option.materialId === currentMaterialId && option.version === currentVersion));
      setCopySourceOptions(options);
      setSelectedCopySource(undefined);
      setCopySourceModalVisible(true);
    } catch (error: any) {
      messageApi.error(error?.message || t('app.master-data.bom.getListFailed'));
    } finally {
      setCopySourceLoading(false);
    }
  };

  const handleCopyItemsFromSourceBom = async () => {
    if (!selectedCopySource) {
      messageApi.warning(t('app.master-data.bom.copyOtherBomItemsSelectRequired'));
      return;
    }
    const source = copySourceOptions.find((item) => item.value === selectedCopySource);
    if (!source) return;
    try {
      setCopySourceSubmitting(true);
      const sourceItems = await bomApi.getByMaterial(source.materialId, source.version, false);
      if (!sourceItems.length) {
        messageApi.warning(t('app.master-data.bom.addAtLeastOneChild'));
        return;
      }
      const mappedItems = sourceItems.map((item) => {
        const compMaterial = materials.find((material) => material.id === item.componentId);
        return buildDefaultBomItem({
          componentId: item.componentId,
          quantity: item.quantity,
          unit: item.unit ?? (compMaterial?.baseUnit ?? ''),
          wasteRate: item.wasteRate ?? 0,
          isRequired: item.isRequired !== false,
          issueMethod: item.issueMethod ?? 'pick',
          isAlternative: item.isAlternative ?? false,
          alternativeGroupId: item.alternativeGroupId ?? undefined,
          priority: item.priority ?? 0,
          description: item.description ?? undefined,
          remark: item.remark ?? undefined,
          sourceType: getMaterialSourceTypeFromRecord(compMaterial) || undefined,
        });
      });
      appendBomItemsToForm(mappedItems);
      setCopySourceModalVisible(false);
      setSelectedCopySource(undefined);
    } catch (error: any) {
      messageApi.error(error?.message || t('app.master-data.bom.getListFailed'));
    } finally {
      setCopySourceSubmitting(false);
    }
  };

  /**
   * 按 bomCode + materialId + version 分组，转换为树形数据结构
   */
  const groupBomsByCode = (list: BOM[]): { groupRows: BOMGroupRow[]; keyToUuids: Map<string, string[]> } => {
    const keyToUuids = new Map<string, string[]>();
    const map = new Map<string, BOM[]>();
    for (const b of list) {
      const k = `${b.bomCode ?? '-'}|${b.materialId}|${b.version ?? '1.0'}`;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(b);
    }
    const groupRows: BOMGroupRow[] = [];
    map.forEach((items, k) => {
      const first = items[0]!;
      const uuids = items.map((i) => i.uuid);
      keyToUuids.set(`group:${k}`, uuids);
      // 将子物料作为 children，每个子物料添加唯一 key
      const children = items.map((item, idx) => ({
        ...item,
        key: `${item.uuid}-child-${idx}`, // 树形数据需要唯一 key
      }));
      groupRows.push({
        groupKey: `group:${k}`,
        bomCode: first.bomCode ?? '-',
        version: first.version ?? '1.0',
        materialId: first.materialId,
        approvalStatus: first.approvalStatus,
        firstItem: first,
        items,
        children: children.length > 0 ? children : undefined,
      });
    });
    return { groupRows, keyToUuids };
  };

  /**
   * 按物料分组：一物料一行，版本下拉切换，默认显示默认版本或最新版本
   * @param groupRows 当前视图过滤后的分组行（成品或半成品）
   * @param selectedMap 物料选中的版本
   * @param allGroupRows 全部 BOM 分组行（用于构建半成品 componentId 的版本/编号/审核状态）
   */
  const groupBomsByMaterial = (
    groupRows: BOMGroupRow[],
    selectedMap: Record<number, string>,
    allGroupRows?: BOMGroupRow[]
  ): MaterialBOMRow[] => {
    const byMaterial = new Map<number, BOMGroupRow[]>();
    for (const row of groupRows) {
      const list = byMaterial.get(row.materialId) ?? [];
      list.push(row);
      byMaterial.set(row.materialId, list);
    }
    // 半成品（componentId）的 BOM 信息，用于子行显示版本、BOM 编号、审核状态；需从全部 BOM 构建
    const rowsForBomInfo = allGroupRows ?? groupRows;
    const materialIdToBomInfo = new Map<number, { version: string; bomCode: string; approvalStatus: BOM['approvalStatus'] }>();
    const byMaterialAll = new Map<number, BOMGroupRow[]>();
    for (const row of rowsForBomInfo) {
      const list = byMaterialAll.get(row.materialId) ?? [];
      list.push(row);
      byMaterialAll.set(row.materialId, list);
    }
    byMaterialAll.forEach((versionRows, mid) => {
      const defaultRow = versionRows.find((v) => v.firstItem?.isDefault) ?? versionRows[0]!;
      if (defaultRow) {
        materialIdToBomInfo.set(mid, {
          version: defaultRow.version ?? '1.0',
          bomCode: defaultRow.bomCode ?? '-',
          approvalStatus: defaultRow.approvalStatus ?? 'draft',
        });
      }
    });

    /** 按物料编号排序子件；同编号时按 path / priority / id 稳定排序，避免乱序 */
    const getComponentCode = (componentId: number) => {
      const mat = materialsRef.current.find((m) => m.id === componentId);
      return mat?.mainCode || mat?.code || '';
    };
    const sortItemsByCode = (items: BOM[] | undefined): BOM[] => {
      const list = [...(items ?? [])];
      return list.sort((a, b) => {
        const codeA = getComponentCode(a.componentId);
        const codeB = getComponentCode(b.componentId);
        const cmp = codeA.localeCompare(codeB, undefined, { numeric: true });
        if (cmp !== 0) return cmp;
        const pathA = (a as any).path ?? a.path ?? '';
        const pathB = (b as any).path ?? b.path ?? '';
        if (pathA !== pathB) return pathA.localeCompare(pathB, undefined, { numeric: true });
        const prioA = (a as any).priority ?? a.priority ?? 0;
        const prioB = (b as any).priority ?? b.priority ?? 0;
        if (prioA !== prioB) return prioA - prioB;
        return (a.id ?? 0) - (b.id ?? 0);
      });
    };

    /** 递归构建子项（含半成品展开）：半成品作为 componentId 时，将其 BOM 子件作为 children */
    const buildItemWithChildren = (
      item: BOM,
      idx: number,
      parentKey: string,
      depth: number,
      visitedIds: Set<number>
    ): BOMTableTreeNode => {
      const bomInfo = materialIdToBomInfo.get(item.componentId);
      const base: BOMTableTreeNode = {
        ...item,
        key: `${parentKey}-${item.uuid}-${idx}`,
        ...(bomInfo && {
          _bomVersion: bomInfo.version,
          _bomCode: bomInfo.bomCode,
          _bomApprovalStatus: bomInfo.approvalStatus,
        }),
      };
      if (!bomInfo || depth >= 20 || visitedIds.has(item.componentId)) return base;
      const versionRows = byMaterialAll.get(item.componentId);
      if (!versionRows?.length) return base;
      const defaultRow = versionRows.find((v) => v.firstItem?.isDefault) ?? versionRows[0]!;
      const nextVisited = new Set(visitedIds).add(item.componentId);
      const sortedSubItems = sortItemsByCode(defaultRow.items);
      base.children = sortedSubItems.map((sub, subIdx) =>
        buildItemWithChildren(sub, subIdx, base.key, depth + 1, nextVisited)
      );
      return base;
    };

    const result: MaterialBOMRow[] = [];
    Array.from(byMaterial.entries())
      .sort(([a], [b]) => a - b)
      .forEach(([materialId, versionRows]) => {
        versionRows.sort((a, b) => (a.version || '').localeCompare(b.version || ''));
        const defaultVer = versionRows.find((v) => v.firstItem?.isDefault) ?? versionRows[versionRows.length - 1]!;
        const selectedKey = selectedMap[materialId];
        const selectedVersion =
          (selectedKey ? versionRows.find((v) => v.groupKey === selectedKey) : null) ?? defaultVer;
        const sortedItems = sortItemsByCode(selectedVersion.items);
        result.push({
          ...selectedVersion,
          materialId,
          versions: versionRows,
          selectedVersion,
          createdAt: selectedVersion.firstItem?.createdAt,
          updatedAt: selectedVersion.firstItem?.updatedAt,
          createdByName: selectedVersion.firstItem?.createdByName,
          updatedByName: selectedVersion.firstItem?.updatedByName,
          children: sortedItems.map((item, idx) =>
            buildItemWithChildren(item, idx, `root-${materialId}`, 0, new Set())
          ),
        });
      });
    return result;
  };

  /**
   * 成品BOM视图：主件没有上级主件的 BOM 视为成品
   * 即主件（materialId）不作为任何其他 BOM 的子件（componentId）出现
   */
  const filterToProductBomView = (groupRows: BOMGroupRow[], allBomList: BOM[]): BOMGroupRow[] => {
    const componentIds = new Set(allBomList.map((b) => b.componentId));
    return groupRows.filter((row) => !componentIds.has(row.materialId));
  };

  /**
   * 半成品BOM视图：主件有上级主件的 BOM 视为半成品
   * 即主件（materialId）作为其他 BOM 的子件（componentId）出现
   */
  const filterToSemiProductBomView = (groupRows: BOMGroupRow[], allBomList: BOM[]): BOMGroupRow[] => {
    const componentIds = new Set(allBomList.map((b) => b.componentId));
    return groupRows.filter((row) => componentIds.has(row.materialId));
  };

  /**
   * 处理批量导入（UniTable导入功能）
   */
  const handleBatchImportConfirm = async (data: any[][]) => {
    try {
      setBatchImportLoading(true);

      // 验证数据格式
      if (!data || data.length < 2) {
        messageApi.error(t('app.master-data.bom.fillAtLeastOneRow'));
        return;
      }

      const headers = (data[0] || []).map((h: any) => String(h || '').trim());
      const rows = data.slice(2).filter((row: any[]) =>
        row?.some((c: any) => c != null && String(c).trim() !== ''),
      );

      const headerIndexMap = resolveFactoryImportHeaderIndexMap(
        headers,
        bomImportTemplate.importHeaderMap,
      );

      if (
        headerIndexMap['parentCode'] === undefined ||
        headerIndexMap['componentCode'] === undefined ||
        headerIndexMap['quantity'] === undefined
      ) {
        messageApi.error(t('app.master-data.bom.importHeadersRequired'));
        return;
      }

      // 解析数据行
      const importItems: BOMBatchImportItem[] = [];
      const importItemCustomFieldValues: Array<Record<string, any>> = [];
      const errors: string[] = [];
      const customFieldCodeToIndex: Record<string, number> = {};
      Object.entries(headerIndexMap).forEach(([fieldKey, colIndex]) => {
        if (typeof fieldKey === 'string' && fieldKey.startsWith('custom:')) {
          customFieldCodeToIndex[fieldKey.replace('custom:', '')] = colIndex;
        }
      });

      rows.forEach((row, rowIndex) => {
        if (!row || row.length === 0 || !row[headerIndexMap['parentCode']]) {
          return;
        }

        const parentCode = row[headerIndexMap['parentCode']]?.toString().trim();
        const versionStr =
          headerIndexMap['version'] !== undefined
            ? row[headerIndexMap['version']]?.toString().trim()
            : undefined;
        const bomCodeStr =
          headerIndexMap['bomCode'] !== undefined
            ? row[headerIndexMap['bomCode']]?.toString().trim()
            : undefined;
        const bomNameStr =
          headerIndexMap['bomName'] !== undefined
            ? row[headerIndexMap['bomName']]?.toString().trim()
            : undefined;
        const baseQuantityStr =
          headerIndexMap['baseQuantity'] !== undefined
            ? row[headerIndexMap['baseQuantity']]?.toString().trim()
            : undefined;
        const componentCode = row[headerIndexMap['componentCode']]?.toString().trim();
        const quantityStr = row[headerIndexMap['quantity']]?.toString().trim();
        const unitRaw =
          headerIndexMap['unit'] !== undefined
            ? row[headerIndexMap['unit']]?.toString().trim()
            : undefined;
        const unit = unitRaw
          ? materialUnitImport.parse(unitRaw) ?? unitRaw
          : undefined;
        const wasteRateStr =
          headerIndexMap['wasteRate'] !== undefined
            ? row[headerIndexMap['wasteRate']]?.toString().trim()
            : undefined;
        const isRequiredStr =
          headerIndexMap['isRequired'] !== undefined
            ? row[headerIndexMap['isRequired']]?.toString().trim()
            : undefined;
        const isActiveStr =
          headerIndexMap['isActive'] !== undefined
            ? row[headerIndexMap['isActive']]?.toString().trim()
            : undefined;
        const remark =
          headerIndexMap['remark'] !== undefined
            ? row[headerIndexMap['remark']]?.toString().trim()
            : undefined;

        // 验证必填字段
        if (!parentCode) {
          errors.push(`第 ${rowIndex + 3} 行：父件编号不能为空`);
          return;
        }
        if (!componentCode) {
          errors.push(`第 ${rowIndex + 3} 行：子件编号不能为空`);
          return;
        }
        if (!quantityStr) {
          errors.push(`第 ${rowIndex + 3} 行：子件数量不能为空`);
          return;
        }

        // 解析数量
        const quantity = parseFloat(quantityStr);
        if (isNaN(quantity) || quantity <= 0) {
          errors.push(`第 ${rowIndex + 3} 行：子件数量必须是大于0的数字`);
          return;
        }

        // 解析损耗率（支持百分比格式，如：5% 或 5）
        let wasteRate: number | undefined = undefined;
        if (wasteRateStr) {
          const wasteRateValue = parseFloat(wasteRateStr.replace('%', ''));
          if (!isNaN(wasteRateValue)) {
            if (wasteRateValue < 0 || wasteRateValue > 100) {
              errors.push(`第 ${rowIndex + 3} 行：损耗率必须在0-100之间`);
              return;
            }
            wasteRate = wasteRateValue;
          }
        }

        // 解析是否必选（支持：是/否、true/false、1/0）
        let isRequired: boolean | undefined = undefined;
        if (isRequiredStr) {
          const isRequiredLower = isRequiredStr.toLowerCase();
          if (isRequiredLower === '是' || isRequiredLower === 'true' || isRequiredLower === '1' || isRequiredLower === 'yes') {
            isRequired = true;
          } else if (isRequiredLower === '否' || isRequiredLower === 'false' || isRequiredLower === '0' || isRequiredLower === 'no') {
            isRequired = false;
          }
        }

        let isActive: boolean | undefined = undefined;
        if (isActiveStr) {
          const isActiveLower = isActiveStr.toLowerCase();
          if (isActiveLower === '是' || isActiveLower === 'true' || isActiveLower === '1' || isActiveLower === 'yes') {
            isActive = true;
          } else if (isActiveLower === '否' || isActiveLower === 'false' || isActiveLower === '0' || isActiveLower === 'no') {
            isActive = false;
          }
        }

        // 解析基准数量
        let baseQuantity: number | undefined = undefined;
        if (baseQuantityStr) {
          const parsedBaseQty = parseFloat(baseQuantityStr.replace(/,/g, ''));
          if (isNaN(parsedBaseQty) || parsedBaseQty <= 0) {
            errors.push(`第 ${rowIndex + 3} 行：基准数量必须是大于0的数字`);
            return;
          }
          baseQuantity = parsedBaseQty;
        }

        importItems.push({
          parentCode,
          version: versionStr || undefined,
          bomCode: bomCodeStr || undefined,
          bomName: bomNameStr !== undefined ? bomNameStr : undefined,
          baseQuantity,
          componentCode,
          quantity,
          unit: unit || undefined,
          wasteRate: wasteRate !== undefined ? wasteRate : undefined,
          isRequired: isRequired !== undefined ? isRequired : true,
          isActive: isActive !== undefined ? isActive : true,
          remark: remark || undefined,
        });

        const rowCustomValues: Record<string, any> = {};
        bomListCustomFields.forEach((field: any) => {
          const colIdx = customFieldCodeToIndex[field.code];
          if (colIdx === undefined) return;
          const raw = row[colIdx];
          const value = raw == null ? '' : String(raw).trim();
          if (value === '') return;

          if (field.field_type === 'number' || field.field_type === 'formula') {
            const num = Number(value.replace(/,/g, ''));
            if (Number.isFinite(num)) {
              rowCustomValues[field.code] = num;
            } else {
              errors.push(`第 ${rowIndex + 3} 行：自定义字段 ${field.name || field.code} 不是有效数字`);
            }
            return;
          }

          if (field.field_type === 'multiselect') {
            rowCustomValues[field.code] = value
              .split(/[,，]/)
              .map((item) => item.trim())
              .filter(Boolean);
            return;
          }

          rowCustomValues[field.code] = value;
        });
        importItemCustomFieldValues.push(rowCustomValues);
      });

      // 如果有错误，显示错误信息
      if (errors.length > 0) {
        messageApi.error(t('app.master-data.bom.importValidationFailed', { errors: errors.join('\n') }));
        return;
      }

      // 如果没有有效数据，提示
      if (importItems.length === 0) {
        messageApi.error(t('app.master-data.bom.noValidImportData'));
        return;
      }

      // 调用批量导入API
      const batchImportData: BOMBatchImport = {
        items: importItems,
      };

      const createdBoms = await bomApi.batchImport(batchImportData);
      const hasCustomFieldImportData = importItemCustomFieldValues.some((row) => Object.keys(row).length > 0);

      if (hasCustomFieldImportData && createdBoms.length > 0) {
        // 与后端 batch_import_bom 的分组逻辑保持一致：按 parentCode 首次出现顺序分组，组内保持原顺序
        const parentOrder: string[] = [];
        const groupedIndexes = new Map<string, number[]>();
        importItems.forEach((item, idx) => {
          if (!groupedIndexes.has(item.parentCode)) {
            groupedIndexes.set(item.parentCode, []);
            parentOrder.push(item.parentCode);
          }
          groupedIndexes.get(item.parentCode)!.push(idx);
        });
        const backendOrderedImportIndexes = parentOrder.flatMap((parentCode) => groupedIndexes.get(parentCode) || []);

        const fieldUuidByCode = new Map<string, string>();
        bomListCustomFields.forEach((f: any) => {
          if (f?.code && f?.uuid) fieldUuidByCode.set(String(f.code), String(f.uuid));
        });

        await Promise.all(
          createdBoms.map(async (bomRow, createdIdx) => {
            const importIdx = backendOrderedImportIndexes[createdIdx];
            if (importIdx === undefined) return;
            const rowValues = importItemCustomFieldValues[importIdx];
            if (!rowValues || Object.keys(rowValues).length === 0) return;
            const values = Object.entries(rowValues)
              .map(([fieldCode, value]) => {
                const fieldUuid = fieldUuidByCode.get(fieldCode);
                if (!fieldUuid) return null;
                return { field_uuid: fieldUuid, value };
              })
              .filter(Boolean) as Array<{ field_uuid: string; value: any }>;
            if (!values.length) return;
            await batchSetFieldValues({
              record_id: bomRow.id,
              record_table: BOM_CUSTOM_FIELD_TABLE,
              values,
            });
          }),
        );
      }
      messageApi.success(t('app.master-data.bom.importSuccess', { count: importItems.length }));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.bom.batchImportFailed'));
    } finally {
      setBatchImportLoading(false);
    }
  };

  const handleRelationImportPrecheck = async (payload: {
    rawRows: string[][];
    entities: BOMRelationImportEntity[];
    writeStrategy: BOMRelationImportWriteStrategy;
  }) => {
    return bomApi.relationImportPrecheck({
      rows: payload.rawRows,
      entities: payload.entities,
      writeStrategy: payload.writeStrategy,
    });
  };

  const handleRelationImportSubmit = async (payload: {
    rawRows: string[][];
    entities: BOMRelationImportEntity[];
    writeStrategy: BOMRelationImportWriteStrategy;
  }) => {
    const result = await bomApi.relationImport({
      rows: payload.rawRows,
      entities: payload.entities,
      writeStrategy: payload.writeStrategy,
    });
    if (result.success) {
      messageApi.success(result.message || t('app.master-data.bom.importSuccess', { count: result.summary.created + result.summary.updated + result.summary.linked }));
      actionRef.current?.reload();
    }
    return result;
  };


  /**
   * 打开创建新版本弹窗（整合原升版、复制、手工新建版本）
   */
  const handleCreateVersion = async (record: BOM) => {
    try {
      setCurrentMaterialId(record.materialId);
      createVersionRecordRef.current = record;
      setVersionModalVisible(true);
      // 获取当前版本号，建议新版本号
      const currentVersion = record.version;
      const versionMatch = currentVersion.match(/v?(\d+)\.(\d+)/);
      if (versionMatch) {
        const major = parseInt(versionMatch[1]);
        const minor = parseInt(versionMatch[2]);
        const suggestedVersion = `v${major}.${minor + 1}`;
        versionFormRef.current?.setFieldsValue({
          version: suggestedVersion,
          applyStrategy: 'new_only',
        });
      }
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.bom.openVersionCreateFailed'));
    }
  };

  /**
   * 快速创建新版本：基于当前版本一键复制（原升版/复制逻辑）
   */
  const handleQuickCreateVersion = async () => {
    const record = createVersionRecordRef.current;
    if (!record) {
      messageApi.error(t('app.master-data.bom.getRecordFailed'));
      return;
    }
    try {
      setVersionLoading(true);
      await bomApi.copy(record.uuid);
      messageApi.success(t('app.master-data.bom.copySuccess'));
      setVersionModalVisible(false);
      createVersionRecordRef.current = null;
      versionFormRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.bom.copyFailed'));
    } finally {
      setVersionLoading(false);
    }
  };

  /**
   * 打开「设为失效」弹窗
   */
  const handleOpenSetObsolete = (record: BOM) => {
    if (record.isObsolete) {
      messageApi.info(t('app.master-data.bom.alreadyObsolete'));
      return;
    }
    setObsoleteRecord(record);
    setObsoleteReason('');
    setObsoleteModalVisible(true);
  };

  /**
   * 提交设为失效
   */
  const handleSetObsoleteSubmit = async () => {
    if (!obsoleteRecord) return;
    try {
      setObsoleteLoading(true);
      await bomApi.setVersionObsolete(obsoleteRecord.materialId, obsoleteRecord.version, obsoleteReason.trim() || undefined);
      messageApi.success(t('app.master-data.bom.obsoleteSuccess'));
      setObsoleteModalVisible(false);
      setObsoleteRecord(null);
      setObsoleteReason('');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.master-data.bom.operationFailed'));
    } finally {
      setObsoleteLoading(false);
    }
  };

  /**
   * 设为默认版本
   */
  const handleSetAsDefault = async (record: BOM) => {
    if (record.isDefault) {
      messageApi.info(t('app.master-data.bom.alreadyDefaultVersion'));
      return;
    }
    Modal.confirm({
      title: t('app.master-data.bom.setDefaultVersionTitle'),
      content: t('app.master-data.bom.setDefaultVersionContent', { bomCode: record.bomCode, version: record.version }),
      okText: t('app.master-data.bom.ok'),
      cancelText: t('app.master-data.bom.cancel'),
      onOk: async () => {
        try {
          await bomApi.update(record.uuid, { isDefault: true });
          messageApi.success(t('app.master-data.bom.setDefaultSuccess'));
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('app.master-data.bom.operationFailed'));
        }
      },
    });
  };

  /**
   * 处理版本创建提交
   */
  const handleVersionCreateSubmit = async (values: BOMVersionCreate) => {
    if (!currentMaterialId) {
      messageApi.error(t('app.master-data.bom.materialIdNotExist'));
      return;
    }

    try {
      setVersionLoading(true);
      await bomApi.createVersion(currentMaterialId, values);
      messageApi.success(t('app.master-data.bom.versionCreateSuccess'));
      setVersionModalVisible(false);
      createVersionRecordRef.current = null;
      versionFormRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.bom.versionCreateFailed'));
    } finally {
      setVersionLoading(false);
    }
  };

  /**
   * 处理查看版本历史
   */
  const handleViewVersionHistory = async (record: BOM) => {
    try {
      setCurrentMaterialId(record.materialId);
      const versions = await bomApi.getByMaterial(record.materialId, undefined, false, true);
      const byVersion = new Map<string, BOM[]>();
      for (const bom of versions) {
        const key = bom.version;
        if (!byVersion.has(key)) byVersion.set(key, []);
        byVersion.get(key)!.push(bom);
      }
      const aggregated: BOMVersionHistoryRow[] = Array.from(byVersion.entries()).map(([version, items]) => {
        const first = items[0]!;
        return {
          version,
          materialId: first.materialId,
          approvalStatus: first.approvalStatus,
          itemCount: items.length,
          effectiveDate: first.effectiveDate,
          createdByName: first.createdByName ?? first.updatedByName,
          createdAt: first.createdAt,
          isDefault: first.isDefault,
          isObsolete: first.isObsolete,
        };
      });
      aggregated.sort((a, b) => {
        const aMatch = a.version.match(/v?(\d+)\.(\d+)/);
        const bMatch = b.version.match(/v?(\d+)\.(\d+)/);
        if (aMatch && bMatch) {
          const aMajor = parseInt(aMatch[1], 10);
          const aMinor = parseInt(aMatch[2], 10);
          const bMajor = parseInt(bMatch[1], 10);
          const bMinor = parseInt(bMatch[2], 10);
          if (aMajor !== bMajor) return bMajor - aMajor;
          return bMinor - aMinor;
        }
        return b.version.localeCompare(a.version);
      });
      setVersionList(aggregated);
      setVersionHistoryModalVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.bom.getVersionHistoryFailed'));
    }
  };

  const handlePrintBom = async (materialId: number, version?: string) => {
    try {
      const result = await bomApi.print(materialId, version);
      if (!result.content?.trim()) {
        messageApi.error(result.message || t('app.master-data.bom.printFailed'));
        return;
      }
      const win = openPrintHtmlWindow(result.content, t('app.master-data.bom.printBom'));
      if (!win) {
        messageApi.error(t('app.master-data.bom.printFailed'));
      }
    } catch (error: any) {
      messageApi.error(error?.message || t('app.master-data.bom.printFailed'));
    }
  };

  const loadWhereUsed = async (materialId: number, recursive: boolean) => {
    setWhereUsedLoading(true);
    try {
      const result = await bomApi.whereUsed(materialId, { recursive });
      setWhereUsedResult(result);
    } catch (error: any) {
      messageApi.error(error?.message || t('app.master-data.bom.getFailed'));
      setWhereUsedResult(null);
    } finally {
      setWhereUsedLoading(false);
    }
  };

  const handleOpenWhereUsed = async (materialId: number) => {
    setWhereUsedMaterialId(materialId);
    setWhereUsedRecursive(false);
    setWhereUsedModalVisible(true);
    await loadWhereUsed(materialId, false);
  };

  const handleWhereUsedRecursiveChange = async (checked: boolean) => {
    setWhereUsedRecursive(checked);
    if (whereUsedMaterialId != null) {
      await loadWhereUsed(whereUsedMaterialId, checked);
    }
  };

  const navigateToParentBom = (item: BOMWhereUsedResult['items'][number]) => {
    const p = new URLSearchParams();
    p.set('materialId', String(item.materialId));
    if (item.version) p.set('version', item.version);
    navigate(`/apps/master-data/process/engineering-bom/designer?${p}`);
    setWhereUsedModalVisible(false);
  };

  /**
   * 处理版本对比
   */
  const handleCompareVersions = async (version1: string, version2: string) => {
    if (!currentMaterialId) {
      messageApi.error(t('app.master-data.bom.materialIdNotExist'));
      return;
    }

    try {
      setVersionLoading(true);
      const compareData: BOMVersionCompare = {
        version1,
        version2,
      };
      const result = await bomApi.compareVersions(currentMaterialId, compareData);
      setVersionCompareResult(result);
      setSelectedVersions({ version1, version2 });
      setVersionCompareModalVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.bom.versionCompareFailed'));
    } finally {
      setVersionLoading(false);
    }
  };


  /**
   * 处理查看用量计算
   */
  const handleCalculateQuantity = async (record: BOM) => {
    try {
      setCurrentMaterialId(record.materialId);
      setParentQuantity(1.0);
      setQuantityModalVisible(true);
      quantityFormRef.current?.setFieldsValue({
        parentQuantity: 1.0,
        version: record.version,
      });
      // 自动计算一次
      await handleQuantityCalculate(record.materialId, 1.0, record.version);
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.bom.openQuantityCalcFailed'));
    }
  };

  /**
   * 处理用量计算
   */
  const handleQuantityCalculate = async (materialId: number, parentQty: number, version?: string) => {
    try {
      setQuantityLoading(true);
      const result = await bomApi.calculateQuantity(materialId, parentQty, version);
      setQuantityResult(result);
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.bom.quantityCalcFailed'));
    } finally {
      setQuantityLoading(false);
    }
  };

  /**
   * 处理用量计算提交
   */
  const handleQuantityCalculateSubmit = async (values: { parentQuantity: number; version?: string }) => {
    if (!currentMaterialId) {
      messageApi.error(t('app.master-data.bom.materialIdNotExist'));
      return;
    }
    await handleQuantityCalculate(currentMaterialId, values.parentQuantity, values.version);
  };

  /**
   * 分组行表格列（同一 BOM 编号折叠为一行）
   */
  const isRootRow = (r: any) => 'versions' in r && Array.isArray(r.versions);
  const isBomItemRow = (r: any) => !isRootRow(r);
  const bomCustomFieldColumns = generateBomCustomFieldColumns() as MaterialBOMProColumn[];

  const groupColumns: MaterialBOMProColumn[] = [
    { 
      title: t('app.master-data.bom.materialTitle'), 
      dataIndex: 'materialId',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      hideInSearch: true,
      sorter: true,
      render: (_, r: any) => {
        if (isRootRow(r)) {
          const parts = getMaterialParts(r.materialId);
          return (
            <UniTableStackedPrimaryCell
              primary={parts.name}
              secondary={parts.code}
              secondaryCopyable={!parts.missing && Boolean(parts.code)}
            />
          );
        }
        const fromRowCode = String(r.componentCode ?? '').trim();
        const fromRowName = String(r.componentName ?? '').trim();
        if (fromRowCode || fromRowName) {
          return (
            <UniTableStackedPrimaryCell
              primary={fromRowName || '-'}
              secondary={fromRowCode}
              secondaryCopyable={Boolean(fromRowCode)}
            />
          );
        }
        const parts = getMaterialParts(r.componentId);
        return (
          <UniTableStackedPrimaryCell
            primary={parts.name}
            secondary={parts.code}
            secondaryCopyable={!parts.missing && Boolean(parts.code)}
          />
        );
      }
    },
    { 
      title: t('app.master-data.bom.versionTitle'), 
      dataIndex: 'version', 
      width: 140, 
      hideInSearch: true,
      sorter: true,
      render: (_, r: any) => {
        if (isRootRow(r)) {
          const versions = r.versions as BOMGroupRow[];
          if (!versions?.length) return '-';
          const defaultTagText = t('app.master-data.bom.defaultTag');
          const obsoleteTagText = t('app.master-data.bom.obsoleteTag');
          const versionMetaByGroupKey: Record<
            string,
            { version: string; isDefault: boolean; isObsolete: boolean }
          > = {};
          const versionOptions = versions.map((v) => {
            const isDefault = v.firstItem?.isDefault ?? v.items?.some((i) => i.isDefault);
            const isObsolete = v.firstItem?.isObsolete ?? v.items?.some((i: any) => i.isObsolete);
            const label = [v.version, isDefault ? `(${defaultTagText})` : null, isObsolete ? `(${obsoleteTagText})` : null].filter(Boolean).join(' ');
            versionMetaByGroupKey[v.groupKey] = {
              version: v.version,
              isDefault: !!isDefault,
              isObsolete: !!isObsolete,
            };
            return {
              value: v.groupKey,
              label,
            };
          });
          return (
            <Select
              value={r.selectedVersion?.groupKey}
              size="middle"
              style={{ width: '100%', minWidth: 100 }}
              options={versionOptions}
              optionRender={(option, info) => {
                const groupKey = (option as { value?: string })?.value ?? versionOptions[info?.index ?? 0]?.value;
                const meta = (groupKey ? versionMetaByGroupKey[groupKey] : undefined) ?? {
                  version: '',
                  isDefault: false,
                  isObsolete: false,
                };
                return (
                  <Space size={4}>
                    <span>{meta.version}</span>
                    {meta.isDefault && <Tag color="gold">{defaultTagText}</Tag>}
                    {meta.isObsolete && <Tag color="default">{obsoleteTagText}</Tag>}
                  </Space>
                );
              }}
              onChange={(groupKey) => {
                setSelectedVersionByMaterial((prev) => ({ ...prev, [r.materialId]: groupKey }));
                actionRef.current?.reload();
              }}
            />
          );
        }
        if (r._bomVersion) return <Tag>{r._bomVersion}</Tag>;
        return '-';
      }
    },
    { 
      title: t('app.master-data.bom.bomName'), 
      dataIndex: 'bomName',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      minWidth: 180,
      hideInSearch: true,
      sorter: true,
      render: (_, r: any) => {
        if (isRootRow(r)) {
          const name = r.bomName || r.firstItem?.bomName || '';
          const code = r.bomCode || r.firstItem?.bomCode || '';
          return (
            <UniTableStackedPrimaryCell
              primary={name || '-'}
              secondary={code}
              secondaryCopyable={Boolean(code && code !== '-')}
            />
          );
        }
        const code = r._bomCode || '';
        if (!code || code === '-') return '-';
        return (
          <UniTableStackedPrimaryCell
            primary="-"
            secondary={code}
            secondaryCopyable
          />
        );
      }
    },
    {
      title: t('app.master-data.bom.bomCode'),
      dataIndex: 'bomCode',
      hideInTable: true,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('app.master-data.materials.processRoute'),
      dataIndex: 'processRoute',
      width: 140,
      hideInSearch: true,
      render: (_: any, r: any) => {
        // 根行：显示主件工艺路线；子件行（含半成品、工艺型等）：显示该行对应物料的工艺路线（componentId）
        const materialId = isRootRow(r) ? r.materialId : (r.componentId ?? r.materialId);
        if (materialId == null) return '-';
        const material = materials.find((m) => m.id === materialId);
        const name = material?.processRouteName ?? (material as any)?.process_route_name;
        return name ?? '-';
      },
    },
    { 
      title: t('app.master-data.bom.quantityTitle'), 
      dataIndex: 'quantity', 
      width: 100, 
      hideInSearch: true,
      render: (_, r: any) => {
        if (isRootRow(r)) return '-';
        const unitLabel = r.unit ? (unitValueToLabel[r.unit] || r.unit) : '';
        return `${r.quantity} ${unitLabel}`.trim() || '-';
      }
    },
    { 
      title: t('app.master-data.bom.unitTitle'), 
      dataIndex: 'unit', 
      width: 80, 
      hideInSearch: true,
      render: (_, r: any) => {
        if (isRootRow(r)) return '-';
        return (r.unit && unitValueToLabel[r.unit]) ? unitValueToLabel[r.unit] : (r.unit || '-');
      }
    },
    { 
      title: t('app.master-data.bom.wasteRateTitle'), 
      dataIndex: 'wasteRate', 
      width: 90, 
      hideInSearch: true,
      render: (_, r: any) => {
        if (isRootRow(r)) return '-';
        return r.wasteRate ? `${r.wasteRate}%` : '0%';
      }
    },
    {
      title: t('app.master-data.bom.includeObsolete'),
      dataIndex: 'includeObsolete',
      valueType: 'switch',
      hideInTable: true,
      initialValue: false,
      search: { transform: (v: boolean) => (v ? true : undefined) },
      fieldProps: { checkedChildren: '', unCheckedChildren: '' },
    },
    ...bomCustomFieldColumns,
    ...masterCrudCreatedUpdatedColumns<MaterialBOMRow>(t),
    {
      title: t('app.master-data.bom.approvalStatusTitle'),
      dataIndex: 'approvalStatus',
      width: UNI_TABLE_STATUS_BADGE_COLUMN_WIDTH,
      fixed: 'right' as const,
      align: 'center' as const,
      valueType: 'select',
      sorter: false,
      valueEnum: {
        draft: { text: t('app.master-data.bom.statusDraft'), status: 'Default' },
        pending: { text: t('app.master-data.bom.statusPending'), status: 'Processing' },
        approved: { text: t('app.master-data.bom.statusApproved'), status: 'Success' },
        rejected: { text: t('app.master-data.bom.statusRejected'), status: 'Error' },
      },
      render: (_, r: any) => {
        if (isRootRow(r)) return getApprovalStatusTag(r.approvalStatus);
        if (r._bomApprovalStatus) return getApprovalStatusTag(r._bomApprovalStatus);
        return '-';
      },
    },
    {
      title: t('app.master-data.bom.actionTitle'),
      valueType: 'option',
      width: 300,
      fixed: 'right',
      /** 主行直出详情/编辑/设计/审核；页面自管「更多」由 uni-action 钉住，不再二次折叠 */
      uniActionRenderOptions: { directMax: 5 },
      render: (_, record: any) => {
        if (isBomItemRow(record)) return null;
        const r = record.selectedVersion?.firstItem ?? record.firstItem;
        const goDesigner = () => {
          const p = new URLSearchParams();
          p.set('materialId', String(r.materialId));
          if (r.version) p.set('version', r.version);
          navigate(`/apps/master-data/process/engineering-bom/designer?${p}`);
        };
        const isApproved = r.approvalStatus === 'approved';
        // 更多菜单：按逻辑分组，查看类 → 版本管理 → 其他 → 危险操作
        const moreItems: MenuProps['items'] = [
          {
            type: 'group',
            label: t('app.master-data.bom.view'),
            children: [
              { key: 'calculateQuantity', icon: <CalculatorOutlined />, label: t('app.master-data.bom.calculateQuantity'), onClick: () => handleCalculateQuantity(r) },
              { key: 'whereUsed', label: t('app.master-data.bom.whereUsed'), onClick: () => handleOpenWhereUsed(r.materialId) },
            ],
          },
          {
            type: 'group',
            label: t('app.master-data.bom.versionManage'),
            children: [
              { key: 'setDefault', icon: <StarOutlined />, label: t('app.master-data.bom.setDefault'), onClick: () => handleSetAsDefault(r), disabled: r.isDefault },
              { key: 'createNewVersion', icon: <PlusOutlined />, label: t('app.master-data.bom.createNewVersion'), onClick: () => handleCreateVersion(r) },
              { key: 'versionHistory', icon: <HistoryOutlined />, label: t('app.master-data.bom.versionHistory'), onClick: () => handleViewVersionHistory(r) },
              { key: 'setObsolete', icon: <CloseCircleOutlined />, label: t('app.master-data.bom.setObsolete'), onClick: () => handleOpenSetObsolete(r), disabled: r.isObsolete },
            ],
          },
          ...(bomPerms.canDelete ? [{ type: 'divider' as const }] : []),
          ...(bomPerms.canDelete ? [{
            key: 'delete',
            icon: <DeleteOutlined />,
            label: t('app.master-data.bom.delete'),
            danger: true,
            onClick: () => handleDeleteGroup(record),
            disabled: isApproved,
          }] : []),
        ];
        /** 返回数组，交给 UniTable → renderUniTableOperationCell → normalizeActionTree；顺序：详情 → 编辑 → … */
        return [
          <Button
            key="detail"
            {...rowActionKind('read')}
            type="link"
            size="small"
            onClick={() => handleOpenDetail(r)}
            title={t('app.master-data.bom.detail')}
            data-action-priority={0}
          >
            {t('app.master-data.bom.detail')}
          </Button>,
          bomPerms.canUpdate ? (
          <Button
            key="edit"
            {...rowActionKind('update')}
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(r)}
            disabled={isApproved}
            title={isApproved ? t('app.master-data.bom.approvedCannotEditTitle') : t('app.master-data.bom.editTitle')}
            data-action-priority={1}
            {...(isApproved ? { 'data-row-action-visible-when-disabled': true } : {})}
          >
            {t('app.master-data.bom.editTitle')}
          </Button>
          ) : null,
          bomPerms.canUpdate ? (
          <Button
            key="design"
            {...rowActionKind('update')}
            type="link"
            size="small"
            icon={<HighlightOutlined />}
            onClick={goDesigner}
            title={t('app.master-data.bom.designerTitle')}
            data-action-priority={2}
          >
            {t('app.master-data.bom.design')}
          </Button>
          ) : null,
          r.approvalStatus !== 'approved' ? (
            bomPerms.canAction?.('audit') ? (
            <Button
              key="approve"
              {...rowActionKind('audit')}
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleOpenApproval(record)}
              title={t('app.master-data.bom.approvePassTitle')}
              data-action-priority={3}
            >
              {t('app.master-data.bom.approve')}
            </Button>
            ) : null
          ) : (
            bomPerms.canAction?.('revoke') ? (
            <Button
              key="unapprove"
              {...rowActionKind('revoke')}
              type="link"
              size="small"
              icon={<UndoOutlined />}
              onClick={() => handleUnapproveGroup(record)}
              title={t('app.master-data.bom.unapproveTitle')}
              data-action-priority={3}
            >
              {t('app.master-data.bom.unapprove')}
            </Button>
            ) : null
          ),
          <Dropdown key="more" {...rowActionKind('skip')} menu={{ items: moreItems }} trigger={['click']} data-action-priority={4}>
            <Button type="text" className="ant-btn-row-action" icon={<MoreOutlined />}>
              {t('app.master-data.bom.more')}
            </Button>
          </Dropdown>,
        ].filter(Boolean);

      },
    },
  ];


  /**
   * 详情 Drawer 的列定义
   */
  const detailColumns: ProDescriptionsItemProps<BOM>[] = [
    {
      title: t('app.master-data.bom.bomCode'),
      dataIndex: 'bomCode',
      render: (_, record) => record.bomCode || '-',
    },
    {
      title: t('app.master-data.bom.versionTitle'),
      dataIndex: 'version',
      render: (_, record) => (
        <Space size={4}>
          <Tag>{record.version}</Tag>
          {record.isDefault && <Tag color="gold">{t('app.master-data.bom.defaultTag')}</Tag>}
        </Space>
      ),
    },
    {
      title: t('app.master-data.bom.approvalStatusTitle'),
      dataIndex: 'approvalStatus',
      render: (_, record) => getApprovalStatusTag(record.approvalStatus),
    },
    {
      title: t('app.master-data.bom.mainMaterialTitle'),
      dataIndex: 'materialId',
      render: (_, record) => getMaterialName(record.materialId),
    },
    {
      title: t('app.master-data.bom.childMaterialTitle'),
      dataIndex: 'componentId',
      render: (_, record) => getMaterialName(record.componentId),
    },
    {
      title: t('app.master-data.bom.quantityTitle'),
      dataIndex: 'quantity',
    },
    {
      title: t('app.master-data.bom.unitTitle'),
      dataIndex: 'unit',
      render: (_, record) => record.unit || '-',
    },
    {
      title: t('app.master-data.bom.wasteRateTitle'),
      dataIndex: 'wasteRate',
      render: (_, record) => record.wasteRate ? `${record.wasteRate}%` : '0%',
    },
    {
      title: t('app.master-data.bom.isRequiredTitle'),
      dataIndex: 'isRequired',
      render: (_, record) => (
        <Tag color={record.isRequired !== false ? 'success' : 'default'}>
          {record.isRequired !== false ? t('app.master-data.bom.yes') : t('app.master-data.bom.no')}
        </Tag>
      ),
    },
    {
      title: t('app.master-data.bom.issueMethod'),
      dataIndex: 'issueMethod',
      render: (_, record) => {
        const v =
          record.issueMethod ?? (record as { issue_method?: string }).issue_method ?? 'pick';
        return bomIssueMethodLabel[v] ?? v;
      },
    },
    {
      title: t('app.master-data.bom.levelTitle'),
      dataIndex: 'level',
      render: (_, record) => record.level ?? 0,
    },
    {
      title: t('app.master-data.bom.levelPathTitle'),
      dataIndex: 'path',
      render: (_, record) => record.path || '-',
    },
    {
      title: t('app.master-data.bom.effectiveDateTitle'),
      dataIndex: 'effectiveDate',
      valueType: 'dateTime',
    },
    {
      title: t('app.master-data.bom.expiryDateTitle'),
      dataIndex: 'expiryDate',
      valueType: 'dateTime',
    },
    {
      title: t('app.master-data.bom.alternativeTitle'),
      dataIndex: 'isAlternative',
      render: (_, record) => (
        <Tag color={record.isAlternative ? 'orange' : 'default'}>
          {record.isAlternative ? t('app.master-data.bom.yes') : t('app.master-data.bom.no')}
        </Tag>
      ),
    },
    {
      title: t('app.master-data.bom.isConfigurableColumn'),
      dataIndex: 'isConfigurable',
      render: (_, record) => {
        const manualCfg = record.isConfigurable === true;
        const componentMaterial = materials.find((m) => m.id === record.componentId);
        const autoCfg = !!componentMaterial?.variantManaged;
        const isConfigurableItem = manualCfg || autoCfg;
        return (
          <Tag color={isConfigurableItem ? 'cyan' : 'default'}>
            {isConfigurableItem ? t('app.master-data.bom.yes') : t('app.master-data.bom.no')}
          </Tag>
        );
      },
    },
    {
      title: t('app.master-data.bom.alternativeGroupIdLabel'),
      dataIndex: 'alternativeGroupId',
      render: (_, record) => (record.isAlternative && record.alternativeGroupId != null) ? record.alternativeGroupId : '-',
    },
    {
      title: t('app.master-data.bom.priorityTitle'),
      dataIndex: 'priority',
    },
    {
      title: t('app.master-data.bom.descTitle'),
      dataIndex: 'description',
      span: 3,
    },
    {
      title: t('app.master-data.bom.remarkTitle'),
      dataIndex: 'remark',
      span: 2,
    },
    {
      title: t('app.master-data.bom.approverTitle'),
      dataIndex: 'approvedBy',
      render: (_, record) => {
        if (!record.approvedBy) return '-';
        const user = users.find(u => u.id === record.approvedBy);
        return user ? (user.full_name || user.username) : `${t('app.master-data.bom.approverTitle')}: ${record.approvedBy}`;
      },
    },
    {
      title: t('app.master-data.bom.approvalTimeTitle'),
      dataIndex: 'approvedAt',
      valueType: 'dateTime',
    },
    {
      title: t('app.master-data.bom.approvalCommentTitle'),
      dataIndex: 'approvalComment',
      span: 3,
    },
    {
      title: t('app.master-data.bom.enabledStatusTitle'),
      dataIndex: 'isActive',
      render: (_, record) => (
        <Tag color={record.isActive ? 'success' : 'default'} variant="solid">
          {record.isActive ? t('app.master-data.bom.enabled') : t('app.master-data.bom.disabled')}
        </Tag>
      ),
    },
    {
      title: t('app.master-data.bom.createTimeTitle'),
      dataIndex: 'createdAt',
      valueType: 'dateTime',
    },
    {
      title: t('app.master-data.bom.updateTimeTitle'),
      dataIndex: 'updatedAt',
      valueType: 'dateTime',
    },
  ];

  const bomDetailChildItemsColumns = useMemo<ColumnsType<BOM>>(
    () => [
      {
        title: t('app.master-data.bom.serialNo'),
        key: 'index',
        width: 50,
        align: 'center',
        render: (_, __, index) => index + 1,
      },
      {
        title: t('app.master-data.bom.childMaterialTitle'),
        dataIndex: 'componentId',
        minWidth: 200,
        render: (_, record) => getMaterialName(record.componentId),
      },
      {
        title: t('app.master-data.bom.quantityTitle'),
        dataIndex: 'quantity',
        width: 80,
        align: 'right',
      },
      {
        title: t('app.master-data.bom.unitTitle'),
        dataIndex: 'unit',
        width: 60,
        align: 'center',
        render: (_, record) => {
          const unitValue = record.unit;
          return unitValueToLabel[unitValue || ''] || unitValue || '-';
        },
      },
      {
        title: t('app.master-data.bom.wasteRateTitle'),
        dataIndex: 'wasteRate',
        width: 80,
        align: 'right',
        render: (_, record) => (record.wasteRate ? `${record.wasteRate}%` : '0%'),
      },
      {
        title: t('app.master-data.bom.isRequiredTitle'),
        dataIndex: 'isRequired',
        width: 70,
        align: 'center',
        render: (_, record) => (
          <Tag color={record.isRequired !== false ? 'success' : 'default'} style={{ marginRight: 0 }}>
            {record.isRequired !== false ? t('app.master-data.bom.yes') : t('app.master-data.bom.no')}
          </Tag>
        ),
      },
      {
        title: t('app.master-data.bom.issueMethod'),
        dataIndex: 'issueMethod',
        width: 90,
        align: 'center',
        render: (_, record) => {
          const v =
            record.issueMethod ?? (record as { issue_method?: string }).issue_method ?? 'pick';
          return bomIssueMethodLabel[v] ?? v;
        },
      },
      {
        title: t('app.master-data.bom.levelTitle'),
        dataIndex: 'level',
        width: 50,
        align: 'center',
        render: (_, record) => record.level ?? 0,
      },
      {
        title: t('app.master-data.bom.alternativeTitle'),
        dataIndex: 'isAlternative',
        width: 70,
        align: 'center',
        render: (_, record) => (
          <Tag color={record.isAlternative ? 'orange' : 'default'} style={{ marginRight: 0 }}>
            {record.isAlternative ? t('app.master-data.bom.yes') : t('app.master-data.bom.no')}
          </Tag>
        ),
      },
      {
        title: t('app.master-data.bom.isConfigurableColumn'),
        dataIndex: 'isConfigurable',
        width: 70,
        align: 'center',
        render: (_, record) => {
          const manualCfg = record.isConfigurable === true;
          const componentMaterial = materials.find((m) => m.id === record.componentId);
          const autoCfg = !!componentMaterial?.variantManaged;
          const isConfigurableItem = manualCfg || autoCfg;
          return (
            <Tag color={isConfigurableItem ? 'cyan' : 'default'} style={{ marginRight: 0 }}>
              {isConfigurableItem ? t('app.master-data.bom.yes') : t('app.master-data.bom.no')}
            </Tag>
          );
        },
      },
      {
        title: t('app.master-data.bom.alternativeGroupIdLabel'),
        dataIndex: 'alternativeGroupId',
        width: 80,
        align: 'center',
        render: (_, record) =>
          record.isAlternative && record.alternativeGroupId != null ? record.alternativeGroupId : '-',
      },
      {
        title: t('app.master-data.bom.priorityTitle'),
        dataIndex: 'priority',
        width: 60,
        align: 'center',
        render: (_, record) => record.priority ?? 0,
      },
      {
        title: t('app.master-data.bom.descTitle'),
        dataIndex: 'description',
        width: 150,
        ellipsis: true,
        render: (_, record) => record.description || '-',
      },
    ],
    [t, materials, unitValueToLabel],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<MaterialBOMRow>
        permissionResource={BOM_RESOURCE}
        columnPersistenceId="apps.master-data.pages.materials.bom.stacked-v2"
        actionRef={actionRef}
        columns={groupColumns}
        viewTypes={['productBom', 'semiProductBom', 'allBom', 'help']}
        defaultViewType="productBom"
        tableViewTypes={['productBom', 'semiProductBom', 'allBom']}
        customViews={[
          { key: 'productBom', label: t('app.master-data.bom.viewProductBom'), icon: ProductOutlined, render: () => null },
          { key: 'semiProductBom', label: t('app.master-data.bom.viewSemiProductBom'), icon: ClusterOutlined, render: () => null },
          { key: 'allBom', label: t('app.master-data.bom.viewAllBom'), icon: UnorderedListOutlined, render: () => null },
        ]}
        onViewTypeChange={(key) => {
          if (key === 'productBom' || key === 'semiProductBom' || key === 'allBom') {
            bomViewTypeRef.current = key;
            actionRef.current?.reload();
          }
        }}
        request={async (params, sort, _filter, searchFormValues, meta?: UniTableRequestMeta) => {
          const includeObsolete = searchFormValues?.includeObsolete === true;
          try {
            const pageSize = params.pageSize || 20;
            const current = params.current || 1;
            const skip = (current - 1) * pageSize;
            const materialIdRaw = searchFormValues?.materialId;
            const materialId =
              materialIdRaw !== undefined && materialIdRaw !== '' && materialIdRaw != null
                ? Number(materialIdRaw)
                : undefined;
            const approvalStatus =
              searchFormValues?.approvalStatus !== undefined &&
              searchFormValues?.approvalStatus !== '' &&
              searchFormValues?.approvalStatus != null
                ? String(searchFormValues.approvalStatus)
                : undefined;
            const keyword = normalizeBomKeyword(searchFormValues as Record<string, unknown>);
            const { data: groups, total } = await bomApi.getGroups({
              includeObsolete,
              skip,
              limit: pageSize,
              view: bomViewTypeRef.current,
              materialId: materialId != null && !Number.isNaN(materialId) ? materialId : undefined,
              approvalStatus,
              keyword: keyword || undefined,
            });
            if (groups.length === 0) {
              groupKeyToUuidsRef.current = new Map();
              return { data: [], success: true, total: total ?? 0 };
            }
            const batchItems = await bomApi.getBatchItems(
              groups.map((g) => ({ material_id: g.material_id, version: g.version })),
              includeObsolete
            );
            // 3) 将摘要 + 明细组装成 BOMGroupRow[]（与 groupBomsByCode 产出结构一致）
            const keyToUuids = new Map<string, string[]>();
            const buildGroupRow = (
              g: (typeof groups)[0],
              items: BOM[]
            ): BOMGroupRow => {
              const firstItem = items[0];
              const syntheticFirst: BOM = firstItem ?? ({
                id: 0,
                uuid: '',
                tenantId: 0,
                materialId: g.material_id,
                componentId: 0,
                quantity: 0,
                isRequired: true,
                level: 0,
                version: g.version,
                bomCode: g.bom_code ?? '-',
                isDefault: g.is_default,
                approvalStatus: (g.approval_status as BOM['approvalStatus']) ?? 'draft',
                isAlternative: false,
                priority: 0,
                isActive: true,
                createdAt: '',
                updatedAt: '',
                isObsolete: g.is_obsolete,
              } as BOM);
              const groupKey = `group:${g.bom_code ?? '-'}|${g.material_id}|${g.version}`;
              keyToUuids.set(groupKey, items.map((i) => i.uuid));
              const children = items.map((item, idx) => ({ ...item, key: `${item.uuid}-child-${idx}` }));
              return {
                groupKey,
                bomCode: g.bom_code ?? '-',
                version: g.version,
                materialId: g.material_id,
                approvalStatus: (g.approval_status as BOM['approvalStatus']) ?? 'draft',
                firstItem: syntheticFirst,
                items,
                children: children.length > 0 ? children : undefined,
              };
            };
            const displayGroupRows: BOMGroupRow[] = groups.map((g) => {
              const k = `${g.material_id}|${g.version}`;
              const items: BOM[] = batchItems[k] ?? [];
              return buildGroupRow(g, items);
            });
            let allGroupRowsForNesting: BOMGroupRow[] = displayGroupRows;
            const mergedBatchItems: Record<string, BOM[]> = { ...batchItems };
            const existingGroupKeys = new Set(
              groups.map((g) => `${g.material_id}|${g.version}`)
            );
            let frontierSemiIds = new Set<number>();
            for (const g of groups) {
              const items = mergedBatchItems[`${g.material_id}|${g.version}`] ?? [];
              for (const it of items) {
                if (it.componentId) frontierSemiIds.add(it.componentId);
              }
            }
            const processedSemiIds = new Set<number>();
            while (frontierSemiIds.size > 0) {
              const ids = Array.from(frontierSemiIds).filter((id) => !processedSemiIds.has(id));
              ids.forEach((id) => processedSemiIds.add(id));
              frontierSemiIds = new Set();
              if (ids.length === 0) break;
              const { data: semiGroups } = await bomApi.getGroups({
                includeObsolete,
                materialIds: ids,
              });
              const byMid = new Map<number, (typeof groups)[0]>();
              for (const x of semiGroups) {
                const cur = byMid.get(x.material_id);
                if (!cur || x.is_default) byMid.set(x.material_id, x);
              }
              const needFetch = Array.from(byMid.values()).filter(
                (g) => !existingGroupKeys.has(`${g.material_id}|${g.version}`)
              );
              if (needFetch.length === 0) continue;
              const semiBatch = await bomApi.getBatchItems(
                needFetch.map((g) => ({ material_id: g.material_id, version: g.version })),
                includeObsolete
              );
              Object.assign(mergedBatchItems, semiBatch);
              const semiRows: BOMGroupRow[] = needFetch.map((g) => {
                const key = `${g.material_id}|${g.version}`;
                existingGroupKeys.add(key);
                const items = semiBatch[key] ?? [];
                return buildGroupRow(g, items);
              });
              allGroupRowsForNesting = [...allGroupRowsForNesting, ...semiRows];
              for (const g of needFetch) {
                const items = semiBatch[`${g.material_id}|${g.version}`] ?? [];
                for (const it of items) {
                  if (it.componentId && !processedSemiIds.has(it.componentId)) {
                    frontierSemiIds.add(it.componentId);
                  }
                }
              }
            }
            groupKeyToUuidsRef.current = keyToUuids;
            const resolvedMaterials = await ensureMaterialsByIds(
              collectBomMaterialIds([...displayGroupRows, ...allGroupRowsForNesting]),
            );
            const materialRows = groupBomsByMaterial(displayGroupRows, selectedVersionByMaterial, allGroupRowsForNesting);
            const { sortBy, sortOrder } = extractProTableSort(sort);
            const sortedRows = sortMaterialBomRows(materialRows, sortBy, sortOrder, resolvedMaterials);
            return enrichBomListPage(
              { data: sortedRows, success: true, total: total ?? 0 },
              { skipEnrich: meta?.purpose === 'prefetch' },
            );
          } catch (error: any) {
            console.error('获取BOM列表失败:', error);
            messageApi.error(error?.message || t('app.master-data.bom.getListFailed'));
            return { data: [], success: false, total: 0 };
          }
        }}
        rowKey={(record: any) =>
          record.groupKey ?? record.key ?? record.uuid ?? `row-${record.materialId ?? 'x'}-${record.version ?? 'v'}`
        }
        defaultExpandAllRows={true}
        showAdvancedSearch={true}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
        }}
        showCreateButton
        createButtonText={t('app.master-data.bom.createTitle') + NEW_SHORTCUT_HINT}
        onCreate={handleCreate}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteConfirmTitle={t('app.master-data.bom.batchDeleteConfirmTitle')}
        deleteConfirmDescription={(count) =>
          t('app.master-data.bom.batchDeleteConfirmContent', { count })
        }
        toolBarActionsAfterDelete={[
          ...(bomPerms.canAction?.('audit') || bomPerms.canAction?.('revoke') ? [
          <UniBatchMenuButton
            key="bom-batch-actions"
            selectedRowKeys={selectedRowKeys}
            buttonText={t('components.uniBatch.batchActions')}
            menuItems={[
              ...(bomPerms.canAction?.('audit') ? [{
                key: 'batch-approve',
                label: t('app.master-data.bom.batchApproveBtn'),
                onClick: handleBatchApprove,
                icon: <CheckCircleOutlined />,
              }] : []),
              ...(bomPerms.canAction?.('revoke') ? [{
                key: 'batch-unapprove',
                label: t('app.master-data.bom.batchUnapproveBtn'),
                onClick: handleBatchUnapprove,
                icon: <UndoOutlined />,
              }] : []),
            ]}
          />,
          ] : []),
        ]}
        showImportButton={true}
        onImport={handleBatchImportConfirm}
        enableCustomImport={true}
        enableRelationImport={true}
        relationImportConfig={{
          entities: ['material', 'processRoute'],
          defaultWriteStrategy: 'upsert',
          supportedStrategies: ['upsert', 'create_only', 'link_only', 'strict_fail'],
          requiredFieldKeys: ['parentCode', 'componentCode', 'quantity'],
          entityRequiredFieldKeys: {
            material: ['componentCode'],
            processRoute: ['processRouteCode'],
          },
        }}
        onRelationImportPrecheck={handleRelationImportPrecheck}
        onRelationImportSubmit={handleRelationImportSubmit}
        importHeaders={bomImportTemplate.importHeaders}
        importExampleRow={bomImportTemplate.importExampleRow}
        importColumnOptions={bomImportTemplate.importColumnOptions}
        importFieldMap={bomImportTemplate.importHeaderMap}
        showExportButton={true}
        showPrintButton={bomPerms.canPrint}
        onPrint={(keys, pageData) => {
          if (keys.length !== 1 || !pageData?.length) {
            messageApi.warning(t('app.master-data.bom.selectToOperate'));
            return;
          }
          const row = pageData.find((r: any) => (r.groupKey ?? r.key) === keys[0]);
          if (!row || isBomItemRow(row)) {
            messageApi.warning(t('app.master-data.bom.selectToOperate'));
            return;
          }
          const item = (row as MaterialBOMRow).selectedVersion?.firstItem
            ?? (row as BOMGroupRow).firstItem;
          if (!item?.materialId) {
            messageApi.warning(t('app.master-data.bom.selectToOperate'));
            return;
          }
          void handlePrintBom(item.materialId, item.version);
        }}
        onExport={async (type, selectedRowKeys, currentPageData) => {
          try {
            let toExport: (BOMGroupRow | MaterialBOMRow)[] = [];
            if (type === 'selected' && selectedRowKeys?.length && currentPageData) {
              toExport = currentPageData.filter((r: any) => selectedRowKeys.includes(r.groupKey));
            } else if (type === 'currentPage' && currentPageData) {
              toExport = currentPageData;
            } else {
              const result = await fetchAllListItems((p) => bomApi.list(p));
              let { groupRows } = groupBomsByCode(result);
              if (bomViewTypeRef.current === 'productBom') {
                groupRows = filterToProductBomView(groupRows, result);
              } else if (bomViewTypeRef.current === 'semiProductBom') {
                groupRows = filterToSemiProductBomView(groupRows, result);
              }
              toExport = groupRows;
            }
            if (toExport.length === 0) {
              messageApi.warning(t('app.master-data.noExportData'));
              return;
            }

            const resolvedGroups = toExport
              .map((row) => resolveBomExportGroup(row))
              .filter((g): g is NonNullable<ReturnType<typeof resolveBomExportGroup>> => g != null);
            if (!resolvedGroups.length) {
              messageApi.warning(t('app.master-data.noExportData'));
              return;
            }

            const lineItems = resolvedGroups.flatMap((g) => g.items);
            const enrichedLines = lineItems.length
              ? await enrichBomRecordsWithCustomFields(
                  lineItems.map((it) => ({
                    ...it,
                    id: Number((it as { id?: unknown }).id),
                  })) as Array<BOM & { id?: number }>,
                )
              : [];
            const enrichedById = new Map<number, Record<string, unknown>>();
            enrichedLines.forEach((it) => {
              const id = Number((it as { id?: unknown }).id);
              if (Number.isFinite(id) && id > 0) {
                enrichedById.set(id, it as unknown as Record<string, unknown>);
              }
            });
            const groupsForFlat = resolvedGroups.map((g) => ({
              groupKey: `export:${g.materialId}|${g.version}|${g.bomCode}`,
              materialId: g.materialId,
              bomCode: g.bomCode,
              version: g.version,
              bomName: g.bomName,
              approvalStatus: g.approvalStatus as BOM['approvalStatus'],
              firstItem: (g.items[0] as unknown as BOM) ?? ({} as BOM),
              items: g.items.map((it) => {
                const id = Number((it as { id?: unknown }).id);
                return (Number.isFinite(id) && enrichedById.has(id) ? enrichedById.get(id)! : it) as BOM;
              }),
            }));

            const materialsForExport = await ensureMaterialsByIds(collectBomMaterialIds(groupsForFlat));
            const flatRows = flattenBomGroupsForExport(groupsForFlat, materialsForExport, {
              unitValueToLabel,
              yesLabel: IMPORT_YES_NO_OPTIONS[0],
              noLabel: IMPORT_YES_NO_OPTIONS[1],
              approvalStatusLabels: {
                draft: t('app.master-data.bom.statusDraft'),
                pending: t('app.master-data.bom.statusPending'),
                approved: t('app.master-data.bom.statusApproved'),
                rejected: t('app.master-data.bom.statusRejected'),
              },
            });
            if (!flatRows.length) {
              messageApi.warning(t('app.master-data.noExportData'));
              return;
            }

            const exportColumns = [
              { key: 'bomCode', title: t('app.master-data.bom.importHeaderBomCode') },
              { key: 'bomName', title: t('app.master-data.bom.importHeaderBomName') },
              { key: 'version', title: t('app.master-data.bom.importHeaderVersion') },
              { key: 'approvalStatus', title: t('app.master-data.bom.approvalStatusTitle') },
              { key: 'baseQuantity', title: t('app.master-data.bom.importHeaderBaseQuantity') },
              { key: 'parentCode', title: t('app.master-data.bom.importHeaderParentCode') },
              { key: 'componentCode', title: t('app.master-data.bom.importHeaderComponentCode') },
              { key: 'quantity', title: t('app.master-data.bom.importHeaderQuantity') },
              { key: 'unit', title: t('app.master-data.bom.importHeaderUnit') },
              { key: 'wasteRate', title: t('app.master-data.bom.importHeaderWasteRate') },
              { key: 'isRequired', title: t('app.master-data.bom.importHeaderIsRequired') },
              { key: 'isActive', title: t('app.master-data.bom.importHeaderIsActive') },
              { key: 'remark', title: t('app.master-data.bom.importHeaderRemark') },
              { key: 'materialName', title: t('app.master-data.bom.importHeaderMaterialName') },
              { key: 'specification', title: t('app.master-data.bom.importHeaderSpecification') },
              { key: 'baseUnit', title: t('app.master-data.bom.importHeaderBaseUnit') },
              { key: 'processRouteCode', title: t('app.master-data.bom.importHeaderProcessRouteCode') },
              { key: 'processRouteName', title: t('app.master-data.bom.importHeaderProcessRouteName') },
              ...[...bomListCustomFields]
                .filter((f) => f?.is_active !== false && f?.code)
                .sort((a, b) => Number(a?.sort_order ?? 0) - Number(b?.sort_order ?? 0))
                .map((f) => ({
                  key: `custom_${f.code}`,
                  title: String(f.label || f.name || f.code),
                })),
            ];

            await downloadRecordsAsXlsx(
              flatRows as Array<Record<string, unknown>>,
              `BOM_${new Date().toISOString().slice(0, 10)}.xlsx`,
              { columns: exportColumns },
            );
            messageApi.success(t('common.exportSuccess', { count: flatRows.length }));
          } catch (error: any) {
            messageApi.error(error?.message || t('app.master-data.exportFailed'));
          }
        }}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        rowSelection={{
          getCheckboxProps: (record: any) => ({
            disabled: isBomItemRow(record),
          }),
        }}
      />
      </ListPageTemplate>

      {/* 详情 Drawer：基本信息（三列）→ 子物料列表 → 层级结构 */}
      <UniDetail
        title={t('app.master-data.bom.bomDetailTitle')}
        open={drawerVisible}
        onClose={handleCloseDetail}
        loading={detailLoading}
        width={DRAWER_CONFIG.HALF_WIDTH}
        extra={
          bomDetail ? (
            <Space>
              <Button
                size="small"
                onClick={() => handleOpenWhereUsed(bomDetail.materialId)}
              >
                {t('app.master-data.bom.whereUsed')}
              </Button>
              {bomPerms.canPrint ? (
                <Button
                  size="small"
                  icon={<PrinterOutlined />}
                  onClick={() => handlePrintBom(bomDetail.materialId, bomDetail.version)}
                >
                  {t('app.master-data.bom.printBom')}
                </Button>
              ) : null}
            </Space>
          ) : null
        }
        basic={
          bomDetail ? (
            <Descriptions
              column={3}
              items={detailDrawerDescriptionItems(orderBomDetailBasicColumns(detailColumns) as any, bomDetail)}
            />
          ) : null
        }
        collaborationTitle={t('app.master-data.bom.childMaterialListWithCount', { count: bomItems.length })}
        collaborationVisible={bomItems.length > 0}
        collaboration={
          bomDetail && bomItems.length > 0 ? (
            <Table<BOM>
              dataSource={bomItems}
              rowKey="uuid"
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
              columns={bomDetailChildItemsColumns}
            />
          ) : null
        }
        linesTitle={t('app.master-data.bom.hierarchyStructure')}
        lines={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {hasCustomFieldsDetailContent(bomListCustomFields, bomDetailCustomFieldValues) ? (
              <DetailDrawerSection title={t('app.master-data.customFields')}>
                <CustomFieldsDetailSection
                  customFields={bomListCustomFields}
                  customFieldValues={bomDetailCustomFieldValues}
                />
              </DetailDrawerSection>
            ) : null}
            <Spin spinning={hierarchyLoading}>
            {hierarchyTreeData.length === 0 && !hierarchyLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                {t('app.master-data.bom.noHierarchyData')}
              </div>
            ) : (
              <div>
                {hierarchyData && (
                  <div
                    style={{
                      marginBottom: 16,
                      padding: '12px',
                      backgroundColor: '#f0f9ff',
                      borderRadius: '4px',
                      border: '1px solid #91d5ff',
                    }}
                  >
                    <Space>
                      <span style={{ fontWeight: 500 }}>{t('app.master-data.bom.mainMaterial')}</span>
                      <span>
                        {hierarchyData.materialCode && hierarchyData.materialName
                          ? `${hierarchyData.materialCode} - ${hierarchyData.materialName}`
                          : hierarchyData.materialCode ||
                            hierarchyData.materialName ||
                            getMaterialName(hierarchyData.materialId) ||
                            '-'}
                      </span>
                      <span style={{ color: '#999' }}>
                        {t('app.master-data.bom.version')}
                        {hierarchyData.version || ''}
                      </span>
                    </Space>
                  </div>
                )}
                <Tree
                  treeData={hierarchyTreeData}
                  expandedKeys={expandedKeys}
                  onExpand={setExpandedKeys}
                  blockNode
                  showLine={{ showLeafIcon: false }}
                  defaultExpandAll={false}
                />
              </div>
            )}
          </Spin>
          </div>
        }
      />

      {/* 创建/编辑BOM Modal - 两栏网格：基础字段每行两列，子物料列表通栏 */}
      <FormModalTemplate
        key={isEdit && editContext ? `edit-${editContext.materialId}-${editContext.version}` : 'create-bom'}
        title={(isEdit ? t('app.master-data.bom.editBom') : t('app.master-data.bom.createBom')).replace(/\s*[（(][^）)]*[）)]\s*$/u, '')}
        open={modalVisible}
        onClose={handleCloseModal}
        afterOpenChange={handleBomModalAfterOpenChange}
        onFinish={handleSubmit}
        isEdit={isEdit}
        loading={formLoading}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        grid={true}
        formRef={formRef}
        initialValues={
          isEdit && editFormInitialValues
            ? editFormInitialValues
            : {
                isActive: true,
                version: '1.0',
                baseQuantity: 1,
                approvalStatus: 'draft',
                items: [buildDefaultBomItem()],
              }
        }
        className="bom-form-modal"
      >
        <style>{`
          .bom-form-modal .bom-items-list-form-item .ant-form-item-label {
            padding-left: 8px;
            padding-right: 8px;
          }
          .bom-form-modal .bom-items-detail-table .ant-table-thead > tr > th,
          .bom-form-modal .bom-items-detail-table .ant-table-thead > tr > th .ant-table-cell,
          .bom-form-modal .bom-items-detail-table .ant-table-thead > tr > th .ant-table-column-title {
            white-space: nowrap !important;
          }
          .bom-form-modal .bom-alternative-group-compact {
            height: 24px !important;
          }
          .bom-form-modal .bom-alternative-group-compact .ant-space-compact-item {
            height: 24px !important;
            min-height: 24px !important;
          }
          .bom-form-modal .bom-alternative-group-compact .ant-select {
            height: 24px !important;
          }
          .bom-form-modal .bom-alternative-group-compact .ant-select-single.ant-select-sm .ant-select-selector {
            height: 24px !important;
            min-height: 24px !important;
            line-height: 22px !important;
            display: flex;
            align-items: center;
          }
          .bom-form-modal .bom-alternative-group-compact .ant-select-single.ant-select-sm .ant-select-selection-item,
          .bom-form-modal .bom-alternative-group-compact .ant-select-single.ant-select-sm .ant-select-selection-placeholder {
            line-height: 22px !important;
          }
          .bom-form-modal .bom-alternative-group-compact .bom-alternative-group-plus.ant-btn.ant-btn-sm {
            height: 24px !important;
            min-height: 24px !important;
            line-height: 22px !important;
            padding-top: 0 !important;
            padding-bottom: 0 !important;
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }
        `}</style>
        <ProForm.Item noStyle shouldUpdate={(prevValues, currentValues) => prevValues.materialId !== currentValues.materialId || prevValues.version !== currentValues.version}>
          {({ getFieldValue }) => {
            const materialId = getFieldValue('materialId');
            const version = getFieldValue('version') || '1.0';
            const context: Record<string, any> = { version };
            if (materialId) {
              const selectedMaterial = materials.find(m => m.id === materialId);
              if (selectedMaterial) {
                context.material_code = selectedMaterial.mainCode || selectedMaterial.code;
                context.material_name = selectedMaterial.name;
              }
            }
            return (
              <CodeField
                pageCode="master-data-engineering-bom"
                name="bomCode"
                label={t('app.master-data.bom.bomCode')}
                colProps={{ span: 12 }}
                autoGenerateOnCreate={!isEdit}
                showGenerateButton={false}
                context={context}
                fieldProps={{
                  maxLength: 100,
                  onChange: () => { if (!isEdit) regenerateBomName(); },
                }}
              />
            );
          }}
        </ProForm.Item>
        <ProFormText
          name="bomName"
          label={t('app.master-data.bom.bomName')}
          colProps={{ span: 12 }}
          placeholder={t('app.master-data.bom.bomNamePlaceholder')}
          fieldProps={{
            maxLength: 200,
            allowClear: true,
            onChange: () => { bomNameTouchedRef.current = true; },
          }}
          extra={t('app.master-data.bom.bomNameExtra')}
        />
        <SafeProFormSelect
          name="materialId"
          label={(
            <Space size={10} align="center">
              <span>{t('app.master-data.bom.mainMaterialLabel')}</span>
              <ThemedSegmented
                size="small"
                value={mainMaterialScope}
                onChange={(v) => setMainMaterialScope(v as 'make' | 'all')}
                disabled={isEdit}
                options={[
                  { label: t('app.master-data.bom.mainMaterialScopeMake'), value: 'make' },
                  { label: t('app.master-data.bom.mainMaterialScopeAll'), value: 'all' },
                ]}
              />
            </Space>
          )}
          placeholder={t('app.master-data.bom.mainMaterialPlaceholder')}
          colProps={{ span: 12 }}
          options={mainMaterialOptions}
          rules={[{ required: true, message: t('app.master-data.bom.mainMaterialRequired') }]}
          fieldProps={{
            disabled: isEdit,
            loading: materialsLoading,
            showSearch: true,
            filterOption: (input, option) => (option?.label as string || '').toLowerCase().includes(input.toLowerCase()),
            onChange: () => { if (!isEdit) { setTimeout(() => regenerateBOMCode(), 300); setTimeout(() => regenerateBomName(), 350); } },
          }}
        />
        <ProFormText
          name="version"
          label={t('app.master-data.bom.versionLabel')}
          placeholder={t('app.master-data.bom.versionPlaceholder')}
          colProps={{ span: 12 }}
          rules={[
            { required: true, message: t('app.master-data.bom.versionRequired') },
            { max: 50, message: t('app.master-data.bom.versionMax') },
          ]}
          fieldProps={{
            disabled: isEdit,
            onChange: (e) => { if (!isEdit && e?.target?.value) { setTimeout(() => regenerateBOMCode(), 300); setTimeout(() => regenerateBomName(), 350); } },
          }}
        />
        <ProFormDigit
          name="baseQuantity"
          label={t('app.master-data.bom.baseQuantity')}
          colProps={{ span: 12 }}
          min={0.0001}
          rules={[
            { required: true, message: t('app.master-data.bom.baseQuantityRequired') },
          ]}
          fieldProps={{
            precision: 4,
            style: { width: '100%' },
          }}
          extra={t('app.master-data.bom.baseQuantityTooltip')}
          initialValue={1}
        />
        <ProFormSelect
          name="approvalStatus"
          label={t('app.master-data.bom.approvalStatusLabel')}
          colProps={{ span: 12 }}
          options={[
            { label: t('app.master-data.bom.statusDraft'), value: 'draft' },
            { label: t('app.master-data.bom.statusPending'), value: 'pending' },
            { label: t('app.master-data.bom.statusApproved'), value: 'approved' },
            { label: t('app.master-data.bom.statusRejected'), value: 'rejected' },
          ]}
        />
        <ProFormDateTimePicker
          name="effectiveDate"
          label={t('app.master-data.bom.effectiveDateLabel')}
          colProps={{ span: 12 }}
          fieldProps={{ style: { width: '100%' } }}
        />
        <ProFormDateTimePicker
          name="expiryDate"
          label={t('app.master-data.bom.expiryDateLabel')}
          colProps={{ span: 12 }}
          fieldProps={buildFutureDateShortcutFieldProps({
            getForm: () => formRef.current,
            fieldName: 'expiryDate',
            baseFieldName: 'effectiveDate',
            t,
            fieldProps: { style: { width: '100%' } },
          })}
        />
        <CustomFieldsFormSection
          customFields={bomFormCustomFields}
          customFieldValues={bomFormCustomFieldValues}
          gridColumns={2}
        />
        <ProForm.Item colProps={{ span: 24 }} style={{ width: '100%' }} className="bom-items-list-form-item">
          <UniTableDetail
            name="items"
            title={t('app.master-data.bom.childMaterialList')}
            required
            requiredMessage={t('app.master-data.bom.childMaterialListRequired')}
            addText={t('app.master-data.bom.addChildMaterial')}
            initialValue={buildDefaultBomItem}
            onBatchSelect={() => setMaterialPickerOpen(true)}
            batchSelectText={t('app.kuaizhizao.common.materialBatchSelect')}
            headerExtra={(
              <Button
                type="default"
                icon={<CopyOutlined />}
                onClick={() => void handleOpenCopySourceModal()}
                loading={copySourceLoading}
              >
                {t('app.master-data.bom.copyOtherBomItems')}
              </Button>
            )}
            containerStyle={{
              width: '100%',
              paddingLeft: 8,
              paddingRight: 8,
              boxSizing: 'border-box',
            }}
            tableProps={{ className: 'bom-items-detail-table', size: 'small' }}
            columns={[
              {
                title: t('app.master-data.bom.childMaterialTitleCol'),
                dataIndex: 'componentId',
                width: 210,
                render: (_, __, index) => {
                  const componentId = Number(getFormItems()[index]?.componentId);
                  const material =
                    Number.isFinite(componentId) && componentId > 0
                      ? materialsById.get(componentId)
                      : undefined;
                  const fallbackOption = material
                    ? {
                        value: material.id,
                        label: formatMaterialLabel(material),
                      }
                    : undefined;
                  return (
                  <UniMaterialSelect
                    name={[index, 'componentId']}
                    label=""
                    placeholder={t('app.master-data.bom.childMaterialPlaceholder')}
                    required
                    size="small"
                    formItemProps={{ style: { margin: 0 } }}
                    listFieldKey={index}
                    listFieldName="items"
                    showQuickCreate
                    showAdvancedSearch
                    fallbackOption={fallbackOption}
                    fillMapping={{
                      unit: 'baseUnit',
                    }}
                    onChange={(_val, material) => {
                      const items = getFormItems();
                      if (!items[index]) return;
                      setItemField(index, 'unit', material?.baseUnit ?? '');
                      const materialSource = getMaterialSourceTypeFromRecord(material as Material | null);
                      setItemField(index, 'sourceType', materialSource || undefined);
                      if (material?.id != null) {
                        setMaterials((prev) => upsertMaterialsById(prev, [material as Material]));
                      }
                    }}
                  />
                  );
                },
              },
              {
                title: t('app.master-data.bom.materialImage'),
                dataIndex: 'materialImage',
                width: 72,
                align: 'center' as const,
                render: (_, __, index) => {
                  const componentId = Number(getFormItems()[index]?.componentId);
                  const material =
                    Number.isFinite(componentId) && componentId > 0
                      ? materialsById.get(componentId)
                      : undefined;
                  const images = material?.images || [];
                  if (!images.length) return '-';
                  const fileUuid = resolveBomMaterialImageFileUuid(images[0]);
                  if (!fileUuid) return '-';
                  return (
                    <SecureImage
                      fileUuid={fileUuid}
                      width={36}
                      height={36}
                      lazyLoad
                      thumbSize={64}
                      alt={material?.name || t('app.master-data.bom.materialImage')}
                    />
                  );
                },
              },
              {
                title: t('app.master-data.bom.quantityLabel'),
                dataIndex: 'quantity',
                width: 100,
                render: (_, __, index) => (
                  <AntForm.Item
                    name={[index, 'quantity']}
                    rules={[
                      { required: true, message: t('app.master-data.bom.quantityRequiredMsg') },
                      { type: 'number', min: 0.0001, message: t('app.master-data.bom.quantityMinMsg') },
                    ]}
                    style={{ margin: 0 }}
                  >
                    <InputNumber
                      placeholder={t('app.master-data.bom.quantityPlaceholderShort')}
                      precision={4}
                      size="small"
                      style={{ width: '100%' }}
                      min={0.0001}
                    />
                  </AntForm.Item>
                ),
              },
              {
                title: t('app.master-data.bom.unitTitle'),
                dataIndex: 'unit',
                width: 80,
                render: (_, __, index) => (
                  <AntForm.Item
                    name={[index, 'unit']}
                    rules={[{ max: 20, message: t('app.master-data.bom.unitMax') }]}
                    style={{ margin: 0 }}
                  >
                    <UnitDisplayCell unitValueToLabel={unitValueToLabel} />
                  </AntForm.Item>
                ),
              },
              {
                title: t('app.master-data.bom.wasteRateLabel'),
                dataIndex: 'wasteRate',
                width: 116,
                render: (_, __, index) => (
                  <AntForm.Item
                    name={[index, 'wasteRate']}
                    rules={[
                      { type: 'number', min: 0, max: 100, message: t('app.master-data.bom.wasteRateRangeMsg') },
                    ]}
                    style={{ margin: 0 }}
                  >
                    <InputNumber
                      placeholder={t('app.master-data.bom.wasteRatePlaceholderShort')}
                      precision={2}
                      size="small"
                      style={{ width: '100%' }}
                      min={0}
                      max={100}
                    />
                  </AntForm.Item>
                ),
              },
              {
                title: t('app.master-data.bom.materialSource'),
                dataIndex: 'sourceType',
                width: 120,
                render: (_, __, index) => (
                  <AntForm.Item noStyle shouldUpdate>
                    {() => {
                      const items = getFormItems();
                      const componentId = items[index]?.componentId;
                      const materialSource = getComponentMaterialSourceType(componentId);
                      const locked = !!materialSource;
                      if (locked) {
                        return (
                          <Select
                            size="small"
                            disabled
                            value={materialSource}
                            options={sourceTypeOptions}
                            style={{ width: '100%' }}
                          />
                        );
                      }
                      return (
                        <AntForm.Item name={[index, 'sourceType']} style={{ margin: 0 }}>
                          <Select
                            size="small"
                            allowClear
                            placeholder={t('app.master-data.bom.materialSourcePlaceholder')}
                            options={sourceTypeOptions}
                            style={{ width: '100%' }}
                          />
                        </AntForm.Item>
                      );
                    }}
                  </AntForm.Item>
                ),
              },
              {
                title: t('app.master-data.bom.issueMethod'),
                dataIndex: 'issueMethod',
                width: 120,
                render: (_, __, index) => (
                  <AntForm.Item
                    name={[index, 'issueMethod']}
                    initialValue="pick"
                    style={{ margin: 0 }}
                  >
                    <Select size="small" options={bomIssueMethodOptions} />
                  </AntForm.Item>
                ),
              },
              {
                title: t('app.master-data.bom.isRequiredTitle'),
                dataIndex: 'isRequired',
                width: 88,
                render: (_, __, index) => (
                  <AntForm.Item
                    name={[index, 'isRequired']}
                    valuePropName="checked"
                    style={{ margin: 0 }}
                  >
                    <Switch size="small" />
                  </AntForm.Item>
                ),
              },
              {
                title: t('app.master-data.bom.alternativeLabel'),
                dataIndex: 'isAlternative',
                width: 100,
                render: (_, __, index) => (
                  <AntForm.Item
                    name={[index, 'isAlternative']}
                    valuePropName="checked"
                    style={{ margin: 0 }}
                  >
                    <Switch
                      size="small"
                      onChange={(checked) => handleAlternativeToggle(index, checked)}
                    />
                  </AntForm.Item>
                ),
              },
              {
                title: t('app.master-data.bom.alternativeGroupIdLabel'),
                dataIndex: 'alternativeGroupId',
                width: 170,
                render: (_, __, index) => (
                  <AntForm.Item noStyle shouldUpdate>
                    {() => {
                      const items = getFormItems();
                      const item = items[index] || {};
                      const isAlternative = !!item?.isAlternative;
                      const groupOptions = getAlternativeGroupOptions(items);
                      return (
                        <Space.Compact
                          className="bom-alternative-group-compact"
                          style={{ width: '100%', height: 24 }}
                          block
                        >
                          <AntForm.Item
                            noStyle
                            name={[index, 'alternativeGroupId']}
                            rules={[
                              {
                                validator: async (_, value) => {
                                  const all = getFormItems();
                                  const current = all[index];
                                  if (
                                    current?.isAlternative &&
                                    (value === undefined || value === null || value === '')
                                  ) {
                                    throw new Error(t('app.master-data.bom.alternativeGroupIdRequired'));
                                  }
                                },
                              },
                            ]}
                          >
                            <Select
                              size="small"
                              style={{ width: '100%' }}
                              disabled={!isAlternative}
                              placeholder={t('app.master-data.bom.alternativeGroupIdPlaceholder')}
                              options={groupOptions}
                              onChange={(val) => applyAlternativeGroupToRow(index, Number(val))}
                            />
                          </AntForm.Item>
                          <Button
                            className="bom-alternative-group-plus"
                            size="small"
                            icon={<PlusOutlined />}
                            title={t('app.master-data.bom.createAlternativeGroup')}
                            disabled={!isAlternative}
                            onClick={() => handleCreateAlternativeGroup(index)}
                          />
                        </Space.Compact>
                      );
                    }}
                  </AntForm.Item>
                ),
              },
              {
                title: t('app.master-data.bom.priorityLabel'),
                dataIndex: 'priority',
                width: 80,
                render: (_, __, index) => (
                  <AntForm.Item
                    name={[index, 'priority']}
                    rules={[
                      { type: 'number', min: 0, message: t('app.master-data.bom.priorityMin') },
                    ]}
                    style={{ margin: 0 }}
                  >
                    <InputNumber
                      placeholder={t('app.master-data.bom.priorityPlaceholder')}
                      precision={0}
                      size="small"
                      style={{ width: '100%' }}
                      min={0}
                    />
                  </AntForm.Item>
                ),
              },
              {
                title: t('app.master-data.bom.descLabel'),
                dataIndex: 'description',
                width: 150,
                render: (_, __, index) => (
                  <AntForm.Item
                    name={[index, 'description']}
                    style={{ margin: 0 }}
                  >
                    <Input.TextArea
                      placeholder={t('app.master-data.bom.descPlaceholder')}
                      rows={1}
                      size="small"
                      maxLength={500}
                      autoSize={{ minRows: 1, maxRows: 2 }}
                    />
                  </AntForm.Item>
                ),
              },
            ]}
          />
        </ProForm.Item>
        <ProFormTextArea
          name="description"
          label={t('app.master-data.bom.descFormLabel')}
          placeholder={t('app.master-data.bom.descFormPlaceholder')}
          colProps={{ span: 24 }}
          fieldProps={{ rows: 2, maxLength: 500, showCount: true }}
        />
        <ProFormSwitch
          name="isActive"
          label={t('app.master-data.bom.isEnabledLabel')}
          colProps={{ span: 12 }}
        />
      </FormModalTemplate>

      <Modal
        title={t('app.master-data.bom.copyOtherBomItemsTitle')}
        open={copySourceModalVisible}
        confirmLoading={copySourceSubmitting}
        destroyOnHidden
        zIndex={nestedBomModalZIndex}
        maskProps={{ ...MODAL_ISOLATE_POINTER_PROPS }}
        wrapProps={{ ...MODAL_ISOLATE_POINTER_PROPS }}
        onCancel={() => {
          setCopySourceModalVisible(false);
          setSelectedCopySource(undefined);
        }}
        onOk={() => void handleCopyItemsFromSourceBom()}
      >
        <Select
          showSearch
          loading={copySourceLoading}
          value={selectedCopySource}
          style={{ width: '100%' }}
          placeholder={t('app.master-data.bom.copyOtherBomItemsPlaceholder')}
          options={copySourceOptions}
          onChange={(value) => setSelectedCopySource(value)}
          filterOption={(input, option) =>
            String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
        />
      </Modal>

      <UniMaterialBatchPicker
        hostResource="master-data:bom"
        open={materialPickerOpen}
        zIndex={nestedBomModalZIndex}
        onCancel={() => setMaterialPickerOpen(false)}
        onConfirm={appendItemsFromMaterials}
      />

      {/* 审核Modal */}
      <Modal
        title={t('app.master-data.bom.approveBomTitle')}
        open={approvalModalVisible}
        onCancel={() => {
          setApprovalModalVisible(false);
          setApprovalComment('');
          setApprovalGroupKey(null);
        }}
        footer={[
          <Button {...rowActionKind('reject')}
            key="reject"
            danger
            loading={approvalLoading}
            onClick={() => handleApprove(false)}
          >
            {t('app.master-data.bom.reject')}
          </Button>,
          <Button {...rowActionKind('audit')}
            key="approve"
            type="primary"
            loading={approvalLoading}
            onClick={() => handleApprove(true)}
          >
            {t('app.master-data.bom.pass')}
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8 }}>{t('app.master-data.bom.approvalCommentOptional')}</div>
          <Input.TextArea
            rows={4}
            value={approvalComment}
            onChange={(e) => setApprovalComment(e.target.value)}
            placeholder={t('app.master-data.bom.approvalCommentPlaceholder')}
            maxLength={500}
          />
          <div style={{ marginTop: 12 }}>
            <Checkbox
              checked={approvalRecursive}
              onChange={(e) => setApprovalRecursive(e.target.checked)}
            >
              {t('app.master-data.bom.recursiveApprove')}
            </Checkbox>
          </div>
        </div>
      </Modal>


      {/* 创建新版本Modal */}
      <FormModalTemplate
        title={t('app.master-data.bom.createVersionTitle')}
        open={versionModalVisible}
        onClose={() => {
          setVersionModalVisible(false);
          createVersionRecordRef.current = null;
          versionFormRef.current?.resetFields();
        }}
        onFinish={handleVersionCreateSubmit}
        isEdit={false}
        loading={versionLoading}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={versionFormRef}
        initialValues={{
          applyStrategy: 'new_only',
        }}
        extraFooter={
          <Button onClick={handleQuickCreateVersion} loading={versionLoading}>
            {t('app.master-data.bom.createVersionQuickCreate')}
          </Button>
        }
      >
        <div style={{ marginBottom: 16, color: 'var(--ant-color-text-secondary)', fontSize: 13 }}>
          {t('app.master-data.bom.createVersionHint')}
        </div>
        <ProFormText
          name="version"
          label={t('app.master-data.bom.versionLabel')}
          placeholder={t('app.master-data.bom.versionPlaceholderNew')}
          rules={[
            { required: true, message: t('app.master-data.bom.versionRequired') },
            { max: 50, message: t('app.master-data.bom.versionMax') },
          ]}
        />
        <ProFormTextArea
          name="versionDescription"
          label={t('app.master-data.bom.versionDescLabel')}
          placeholder={t('app.master-data.bom.versionDescPlaceholder')}
          fieldProps={{
            rows: 3,
            maxLength: 500,
          }}
        />
        <ProFormDateTimePicker
          name="effectiveDate"
          label={t('app.master-data.bom.effectiveDateLabel')}
          placeholder={t('app.master-data.bom.effectiveDatePlaceholder')}
          fieldProps={{
            style: { width: '100%' },
          }}
        />
        <ProFormSelect
          name="applyStrategy"
          label={t('app.master-data.bom.versionStrategyLabel')}
          options={[
            { label: t('app.master-data.bom.versionStrategyNewOnly'), value: 'new_only' },
            { label: t('app.master-data.bom.versionStrategyAll'), value: 'all' },
          ]}
          rules={[
            { required: true, message: t('app.master-data.bom.versionStrategyRequired') },
          ]}
          extra={t('app.master-data.bom.versionStrategyExtra')}
        />
      </FormModalTemplate>

      {/* 版本历史Modal */}
      <Modal
        title={t('app.master-data.bom.versionHistoryTitle')}
        open={versionHistoryModalVisible}
        onCancel={() => {
          setVersionHistoryModalVisible(false);
          setVersionList([]);
        }}
        footer={[
          <Button {...rowActionKind('close')} key="close" onClick={() => {
            setVersionHistoryModalVisible(false);
            setVersionList([]);
          }}>
            {t('common.close')}
          </Button>,
        ]}
        width={1000}
      >
        <div style={{ marginTop: 16 }}>
          {versionList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              {t('app.master-data.bom.noVersionHistory')}
            </div>
          ) : (
            <Space orientation="vertical" style={{ width: '100%' }} size="middle">
              {versionList.map((row, index) => (
                <div
                  key={`${row.materialId}-${row.version}`}
                  style={{
                    padding: '12px',
                    border: '1px solid var(--river-border-color)',
                    borderRadius: '4px',
                    backgroundColor: index === 0 ? '#f0f9ff' : '#fff',
                  }}
                >
                  <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                    <div>
                      <Tag color={index === 0 ? 'blue' : 'default'}>{row.version}</Tag>
                      {row.isDefault && <Tag color="gold">{t('app.master-data.bom.defaultTag')}</Tag>}
                      {row.isObsolete && <Tag color="default">{t('app.master-data.bom.obsoleteTag')}</Tag>}
                      {getApprovalStatusTag(row.approvalStatus)}
                      <span style={{ marginLeft: 8, color: '#666' }}>
                        {t('app.master-data.bom.versionHistoryItemCount')}: {row.itemCount}
                      </span>
                      {row.effectiveDate && (
                        <span style={{ marginLeft: 8, color: '#999' }}>
                          {t('app.master-data.bom.effectiveDateLabel')}: {formatDateTimeBySiteSetting(row.effectiveDate)}
                        </span>
                      )}
                      {row.createdByName && (
                        <span style={{ marginLeft: 8, color: '#999' }}>
                          {t('app.master-data.bom.versionHistoryOperator')}: {row.createdByName}
                        </span>
                      )}
                    </div>
                    <Space>
                      {index < versionList.length - 1 && (
                        <Button
                          type="link"
                          size="small"
                          icon={<DiffOutlined />}
                          onClick={() => handleCompareVersions(versionList[index + 1]!.version, row.version)}
                        >
                          {t('app.master-data.bom.versionCompareDo')}
                        </Button>
                      )}
                      {row.createdAt && (
                        <span style={{ color: '#999', fontSize: '12px' }}>
                          {formatDateTimeBySiteSetting(row.createdAt)}
                        </span>
                      )}
                    </Space>
                  </Space>
                </div>
              ))}
            </Space>
          )}
        </div>
      </Modal>

      {/* 设为失效 Modal */}
      <Modal
        title={t('app.master-data.bom.setObsoleteTitle')}
        open={obsoleteModalVisible}
        onCancel={() => {
          setObsoleteModalVisible(false);
          setObsoleteRecord(null);
          setObsoleteReason('');
        }}
        onOk={handleSetObsoleteSubmit}
        confirmLoading={obsoleteLoading}
        okText={t('app.master-data.bom.ok')}
        cancelText={t('app.master-data.bom.cancel')}
      >
        <p style={{ marginBottom: 8 }}>{t('app.master-data.bom.setObsoleteConfirm')}</p>
        {obsoleteRecord && (
          <p style={{ marginBottom: 12, color: '#666' }}>
            {obsoleteRecord.bomCode} - {t('app.master-data.bom.versionTitle')} {obsoleteRecord.version}
          </p>
        )}
        <AntForm.Item label={t('app.master-data.bom.obsoleteReason')}>
          <Input.TextArea
            rows={3}
            value={obsoleteReason}
            onChange={(e) => setObsoleteReason(e.target.value)}
            placeholder={t('app.master-data.bom.obsoleteReason')}
          />
        </AntForm.Item>
      </Modal>

      {/* 版本对比Modal */}
      <Modal
        title={t('app.master-data.bom.versionCompareModalTitle', {
          version1: selectedVersions?.version1 ?? '',
          version2: selectedVersions?.version2 ?? '',
        })}
        open={versionCompareModalVisible}
        onCancel={() => {
          setVersionCompareModalVisible(false);
          setVersionCompareResult(null);
          setSelectedVersions(null);
        }}
        footer={[
          <Button {...rowActionKind('close')} key="close" onClick={() => {
            setVersionCompareModalVisible(false);
            setVersionCompareResult(null);
            setSelectedVersions(null);
          }}>
            {t('common.close')}
          </Button>,
        ]}
        width={1200}
      >
        {versionCompareResult && (
          <div style={{ marginTop: 16 }}>
            {versionCompareResult.added && versionCompareResult.added.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ color: '#52c41a', marginBottom: 12 }}>
                  {t('app.master-data.bom.versionCompareAddedSection', {
                    count: versionCompareResult.added.length,
                  })}
                </h4>
                <Space orientation="vertical" style={{ width: '100%' }} size="small">
                  {versionCompareResult.added.map((item, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: '#f6ffed',
                        border: '1px solid #b7eb8f',
                        borderRadius: '4px',
                      }}
                    >
                      <Space>
                        <span>{getMaterialName(item.componentId)}</span>
                        <span style={{ color: '#999' }}>
                          {item.quantity} {item.unit || ''}
                          {item.wasteRate
                            ? ` ${t('app.master-data.bom.wasteRateInCompare', { rate: item.wasteRate })}`
                            : ''}
                        </span>
                      </Space>
                    </div>
                  ))}
                </Space>
              </div>
            )}

            {versionCompareResult.removed && versionCompareResult.removed.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ color: '#ff4d4f', marginBottom: 12 }}>
                  {t('app.master-data.bom.versionCompareRemovedSection', {
                    count: versionCompareResult.removed.length,
                  })}
                </h4>
                <Space orientation="vertical" style={{ width: '100%' }} size="small">
                  {versionCompareResult.removed.map((item, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: '#fff1f0',
                        border: '1px solid #ffccc7',
                        borderRadius: '4px',
                      }}
                    >
                      <Space>
                        <span>{getMaterialName(item.componentId)}</span>
                        <span style={{ color: '#999' }}>
                          {item.quantity} {item.unit || ''}
                          {item.wasteRate
                            ? ` ${t('app.master-data.bom.wasteRateInCompare', { rate: item.wasteRate })}`
                            : ''}
                        </span>
                      </Space>
                    </div>
                  ))}
                </Space>
              </div>
            )}

            {versionCompareResult.modified && versionCompareResult.modified.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ color: '#1890ff', marginBottom: 12 }}>
                  {t('app.master-data.bom.versionCompareModifiedSection', {
                    count: versionCompareResult.modified.length,
                  })}
                </h4>
                <Space orientation="vertical" style={{ width: '100%' }} size="small">
                  {versionCompareResult.modified.map((item, index) => {
                    const v1 = item.version1 ?? {};
                    const v2 = item.version2 ?? {};
                    return (
                      <div
                        key={index}
                        style={{
                          padding: '12px',
                          backgroundColor: '#e6f7ff',
                          border: '1px solid #91d5ff',
                          borderRadius: '4px',
                        }}
                      >
                        <div style={{ marginBottom: 8 }}>
                          <strong>{getMaterialName(item.componentId)}</strong>
                        </div>
                        <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                          {v1.quantity !== v2.quantity && (
                            <div style={{ paddingLeft: 16 }}>
                              {t('app.master-data.bom.quantityTitle')}：
                              <span style={{ textDecoration: 'line-through', color: '#ff4d4f', marginLeft: 8 }}>{v1.quantity}</span>
                              {' → '}
                              <span style={{ color: '#52c41a', fontWeight: 500 }}>{v2.quantity}</span>
                            </div>
                          )}
                          {v1.unit !== v2.unit && (
                            <div style={{ paddingLeft: 16 }}>
                              {t('app.master-data.bom.unitTitle')}：
                              <span style={{ textDecoration: 'line-through', color: '#ff4d4f', marginLeft: 8 }}>{v1.unit ?? '-'}</span>
                              {' → '}
                              <span style={{ color: '#52c41a', fontWeight: 500 }}>{v2.unit ?? '-'}</span>
                            </div>
                          )}
                          {(v1.wasteRate ?? 0) !== (v2.wasteRate ?? 0) && (
                            <div style={{ paddingLeft: 16 }}>
                              {t('app.master-data.bom.wasteRateTitle')}：
                              <span style={{ textDecoration: 'line-through', color: '#ff4d4f', marginLeft: 8 }}>{v1.wasteRate ?? 0}%</span>
                              {' → '}
                              <span style={{ color: '#52c41a', fontWeight: 500 }}>{v2.wasteRate ?? 0}%</span>
                            </div>
                          )}
                          {v1.isRequired !== v2.isRequired && (
                            <div style={{ paddingLeft: 16 }}>
                              {t('app.master-data.bom.isRequiredTitle')}：
                              <span style={{ textDecoration: 'line-through', color: '#ff4d4f', marginLeft: 8 }}>
                                {v1.isRequired ? t('app.master-data.bom.yes') : t('app.master-data.bom.no')}
                              </span>
                              {' → '}
                              <span style={{ color: '#52c41a', fontWeight: 500 }}>
                                {v2.isRequired ? t('app.master-data.bom.yes') : t('app.master-data.bom.no')}
                              </span>
                            </div>
                          )}
                        </Space>
                      </div>
                    );
                  })}
                </Space>
              </div>
            )}

            {(!versionCompareResult.added || versionCompareResult.added.length === 0) &&
              (!versionCompareResult.removed || versionCompareResult.removed.length === 0) &&
              (!versionCompareResult.modified || versionCompareResult.modified.length === 0) && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                  {t('app.master-data.bom.noVersionDiff')}
                </div>
              )}
          </div>
        )}
      </Modal>


      {/* 用量计算Modal */}
      <Modal
        title={t('app.master-data.bom.quantityModalTitle')}
        open={quantityModalVisible}
        onCancel={() => {
          setQuantityModalVisible(false);
          setQuantityResult(null);
          setParentQuantity(1.0);
          quantityFormRef.current?.resetFields();
        }}
        footer={null}
        width={900}
      >
        <ProForm
          formRef={quantityFormRef}
          layout="vertical"
          submitter={false}
          initialValues={{
            parentQuantity: 1.0,
          }}
        >
          <ProFormDigit
            name="parentQuantity"
            label={t('app.master-data.bom.parentQuantityLabel')}
            placeholder={t('app.master-data.bom.parentQuantityPlaceholder')}
            rules={[
              { required: true, message: t('app.master-data.bom.parentQuantityRequired') },
              { type: 'number', min: 0.0001, message: t('app.master-data.bom.parentQuantityMin') },
            ]}
            fieldProps={{
              precision: 4,
              style: { width: '100%' },
            }}
            extra={t('app.master-data.bom.parentQuantityExtra')}
          />
          <ProFormText
            name="version"
            label={t('app.master-data.bom.versionLabelForQuantity')}
            placeholder={t('app.master-data.bom.versionPlaceholderOptional')}
            extra={t('app.master-data.bom.versionPlaceholderExtra')}
          />
          <div style={{ marginTop: 16 }}>
            <Button
              type="primary"
              icon={<CalculatorOutlined />}
              onClick={async () => {
                const values = quantityFormRef.current?.getFieldsValue();
                if (values && currentMaterialId) {
                  await handleQuantityCalculate(currentMaterialId, values.parentQuantity || 1.0, values.version);
                }
              }}
              loading={quantityLoading}
            >
              {t('app.master-data.bom.calculateBtn')}
            </Button>
          </div>
        </ProForm>

        {quantityResult && (
          <div style={{ marginTop: 24 }}>
            <div style={{ marginBottom: 16, padding: '12px', backgroundColor: '#f0f9ff', borderRadius: '4px', border: '1px solid #91d5ff' }}>
              <Space orientation="vertical" size="small">
                <Space>
                  <span style={{ fontWeight: 500 }}>{t('app.master-data.bom.parentQuantityResultLabel')}：</span>
                  <span>{quantityResult.parentQuantity}</span>
                </Space>
                <Space>
                  <span style={{ fontWeight: 500 }}>{t('app.master-data.bom.baseQuantity')}：</span>
                  <span>{quantityResult.baseQuantity ?? 1}</span>
                </Space>
              </Space>
            </div>
            
            <div style={{ marginBottom: 8 }}>
              <h4>{t('app.master-data.bom.childComponentListTitle')}</h4>
            </div>
            
            {quantityResult.components && quantityResult.components.length > 0 ? (
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                  {quantityResult.components
                    .sort((a, b) => a.level - b.level || a.componentCode.localeCompare(b.componentCode))
                    .map((component, index) => {
                      const material = materials.find(m => m.id === component.componentId);
                      const materialName = material ? `${component.componentCode} - ${component.componentName}` : `${component.componentCode} - ${component.componentName}`;
                      
                      return (
                        <div
                          key={index}
                          style={{
                            padding: '12px',
                            border: '1px solid var(--river-border-color)',
                            borderRadius: '4px',
                            backgroundColor: component.level === 0 ? '#f0f9ff' : '#fff',
                          }}
                        >
                          <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start">
                            <div style={{ flex: 1 }}>
                              <div style={{ marginBottom: 8 }}>
                                <Space>
                                  <span style={{ fontWeight: 500 }}>{materialName}</span>
                                  <Tag color={component.level === 0 ? 'blue' : 'default'}>
                                    {t('app.master-data.bom.hierarchyLevelLabel')} {component.level}
                                  </Tag>
                                </Space>
                              </div>
                              <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                                <div>
                                  <span style={{ color: '#999' }}>{t('app.master-data.bom.lineQuantityLabel')}</span>
                                  <span style={{ marginLeft: 8 }}>{component.lineQuantity} {component.unit || ''}</span>
                                </div>
                                <div>
                                  <span style={{ color: '#999' }}>{t('app.master-data.bom.baseQuantityLabel')}</span>
                                  <span style={{ marginLeft: 8 }}>{component.baseQuantity}</span>
                                </div>
                                <div>
                                  <span style={{ color: '#999' }}>{t('app.master-data.bom.unitQuantityLabel')}</span>
                                  <span style={{ marginLeft: 8 }}>{formatQuantity(component.unitQuantity)} {component.unit || ''}</span>
                                </div>
                                {component.wasteRate > 0 && (
                                  <div>
                                    <span style={{ color: '#999' }}>{t('app.master-data.bom.hierarchyWasteRateLabel')}：</span>
                                    <Tag color="orange" style={{ marginLeft: 8 }}>{component.wasteRate}%</Tag>
                                  </div>
                                )}
                                <div>
                                  <span style={{ color: '#999' }}>{t('app.master-data.bom.actualQuantityLabel')}</span>
                                  <span style={{ marginLeft: 8, fontWeight: 500, color: '#52c41a', fontSize: '16px' }}>
                                    {formatQuantity(component.actualQuantity)} {component.unit || ''}
                                  </span>
                                </div>
                                {(component.wasteRate > 0 || (quantityResult.baseQuantity ?? 1) !== 1) && (
                                  <div style={{ fontSize: '12px', color: '#999', marginTop: 4 }}>
                                    {t('app.master-data.bom.quantityCalcFormula', {
                                      line: component.lineQuantity,
                                      base: component.baseQuantity,
                                      unit: formatQuantity(component.unitQuantity),
                                      parent: quantityResult.parentQuantity,
                                      rate: component.wasteRate,
                                      actual: formatQuantity(component.actualQuantity),
                                    })}
                                  </div>
                                )}
                              </Space>
                            </div>
                          </Space>
                        </div>
                      );
                    })}
                </Space>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                {t('app.master-data.bom.noChildMaterialQuantityData')}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title={t('app.master-data.bom.whereUsedTitle')}
        open={whereUsedModalVisible}
        onCancel={() => {
          setWhereUsedModalVisible(false);
          setWhereUsedResult(null);
          setWhereUsedMaterialId(null);
        }}
        footer={[
          <Button {...rowActionKind('close')} key="close" onClick={() => {
            setWhereUsedModalVisible(false);
            setWhereUsedResult(null);
            setWhereUsedMaterialId(null);
          }}>
            {t('common.close')}
          </Button>,
        ]}
        width={900}
      >
        <div style={{ marginBottom: 12 }}>
          <Checkbox
            checked={whereUsedRecursive}
            onChange={(e) => void handleWhereUsedRecursiveChange(e.target.checked)}
          >
            {t('app.master-data.bom.whereUsedRecursive')}
          </Checkbox>
        </div>
        <Spin spinning={whereUsedLoading}>
          {!whereUsedLoading && (!whereUsedResult?.items || whereUsedResult.items.length === 0) ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
              {t('app.master-data.bom.whereUsedEmpty')}
            </div>
          ) : (
            <Table
              dataSource={whereUsedResult?.items ?? []}
              rowKey={(row) => `${row.bomUuid}-${row.materialId}-${row.version}`}
              pagination={false}
              size="small"
              columns={[
                {
                  title: t('app.master-data.bom.mainMaterialTitle'),
                  render: (_, row) =>
                    row.materialCode && row.materialName
                      ? `${row.materialCode} - ${row.materialName}`
                      : getMaterialName(row.materialId),
                },
                {
                  title: t('app.master-data.bom.versionTitle'),
                  dataIndex: 'version',
                  width: 100,
                },
                {
                  title: t('app.master-data.bom.bomCode'),
                  dataIndex: 'bomCode',
                  width: 120,
                  render: (v) => v || '-',
                },
                {
                  title: t('app.master-data.bom.quantityTitle'),
                  width: 100,
                  render: (_, row) => `${row.quantity} ${row.unit || ''}`.trim(),
                },
                {
                  title: t('app.master-data.bom.approvalStatusTitle'),
                  dataIndex: 'approvalStatus',
                  width: 100,
                  render: (status) => (status ? getApprovalStatusTag(String(status)) : '-'),
                },
                {
                  title: t('app.master-data.bom.actionTitle'),
                  width: 80,
                  render: (_, row) => (
                    <Button type="link" size="small" onClick={() => navigateToParentBom(row)}>
                      {t('app.master-data.bom.design')}
                    </Button>
                  ),
                },
              ]}
            />
          )}
        </Spin>
      </Modal>
    </>
  );
};

export default BOMPage;

