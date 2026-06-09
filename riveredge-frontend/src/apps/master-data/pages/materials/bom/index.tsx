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
import { App, Button, Tag, Space, Modal, Input, Tree, Spin, Table, Form as AntForm, Select, Switch, InputNumber, Dropdown, Checkbox, Descriptions } from 'antd';
import type { MenuProps } from 'antd';
import type { DataNode } from 'antd/es/tree';
import type { ColumnsType } from 'antd/es/table';
import { EditOutlined, DeleteOutlined, PlusOutlined, MinusCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, UploadOutlined, DiffOutlined, HistoryOutlined, CalculatorOutlined, HighlightOutlined, MoreOutlined, UndoOutlined, StarOutlined, ProductOutlined, UnorderedListOutlined, ClusterOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { UniTable } from '../../../../../components/uni-table';
import { rowActionKind } from '../../../../../components/uni-action';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { ListPageTemplate, FormModalTemplate, flushDrawerOpen, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { UniDetail, detailDrawerDescriptionItems } from '../../../../../components/uni-detail';
import { bomApi, materialApi } from '../../../services/material';
import type { BOM, BOMCreate, BOMUpdate, Material, BOMBatchCreate, BOMItemCreate, BOMBatchImport, BOMBatchImportItem, BOMVersionCreate, BOMVersionCompare, BOMVersionCompareResult, BOMHierarchy, BOMHierarchyItem, BOMQuantityResult, BOMQuantityComponent } from '../../../types/material';
import { testGenerateCode, getCodeRulePageConfig } from '../../../../../services/codeRule';

const BOM_ISSUE_METHOD_OPTIONS = [
  { label: '领料配料', value: 'pick' },
  { label: '倒冲', value: 'backflush' },
  { label: '不发料', value: 'none' },
] as const;

const BOM_ISSUE_METHOD_LABEL: Record<string, string> = Object.fromEntries(
  BOM_ISSUE_METHOD_OPTIONS.map((o) => [o.value, o.label]),
);
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';
import { getDataDictionaryByCode, getDictionaryItemList } from '../../../../../services/dataDictionary';
import { downloadFile } from '../../../../../utils';
import type { User } from '../../../../../services/user';
import { searchUserDisplay } from '../../../../../services/user';
import { useGlobalStore } from '../../../../../stores';
import { displayItemsToUsers } from '../../../../../utils/userDisplay';
import { extractProTableSort } from '../../../../../utils/tableQueryKey';
import {
  buildFactoryImportTemplate,
  resolveFactoryImportHeaderIndexMap,
} from '../../../utils/factoryImportTemplate';

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

/** 按物料分组的行：一物料一行，版本通过下拉切换，默认显示默认版本或最新版本 */
interface MaterialBOMRow extends BOMGroupRow {
  materialId: number;
  versions: BOMGroupRow[];
  selectedVersion: BOMGroupRow;
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
  /** 编辑时：按主料+版本定位整份 BOM，保存时先删后批量创建 */
  const [editContext, setEditContext] = useState<{ materialId: number; version: string; uuidsToReplace: string[] } | null>(null);
  
  // 审核Modal状态
  const [approvalModalVisible, setApprovalModalVisible] = useState(false);
  const [approvalGroupKey, setApprovalGroupKey] = useState<string | null>(null);
  const [approvalComment, setApprovalComment] = useState<string>('');
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [approvalRecursive, setApprovalRecursive] = useState(false);
  
  // 批量导入加载状态
  const [batchImportLoading, setBatchImportLoading] = useState(false);

  const bomImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          { field: 'parentCode', required: true, labelKey: 'app.master-data.bom.importHeaderParentCode' },
          { field: 'componentCode', required: true, labelKey: 'app.master-data.bom.importHeaderComponentCode' },
          { field: 'quantity', required: true, labelKey: 'app.master-data.bom.importHeaderQuantity' },
          { field: 'unit', labelKey: 'app.master-data.bom.importHeaderUnit' },
          { field: 'wasteRate', labelKey: 'app.master-data.bom.importHeaderWasteRate' },
          { field: 'isRequired', labelKey: 'app.master-data.bom.importHeaderIsRequired' },
          { field: 'remark', labelKey: 'app.master-data.bom.importHeaderRemark' },
        ],
        [
          t('app.master-data.bom.importExample.parentCode'),
          t('app.master-data.bom.importExample.componentCode'),
          t('app.master-data.bom.importExample.quantity'),
          t('app.master-data.bom.importExample.unit'),
          t('app.master-data.bom.importExample.wasteRate'),
          t('app.master-data.bom.importExample.isRequired'),
          '',
        ],
      ),
    [t, i18n.language],
  );
  
  // 版本管理Modal状态
  const [versionModalVisible, setVersionModalVisible] = useState(false);
  const [versionCompareModalVisible, setVersionCompareModalVisible] = useState(false);
  const [versionHistoryModalVisible, setVersionHistoryModalVisible] = useState(false);
  const [currentMaterialId, setCurrentMaterialId] = useState<number | null>(null);
  const createVersionRecordRef = useRef<BOM | null>(null); // 创建新版本时当前操作的 BOM 记录（用于快速创建）
  const versionFormRef = useRef<ProFormInstance>();
  
  // 递归审核选项Ref（批量操作用）
  const recursiveApprovalRef = useRef<boolean>(false);
  // 单条反审核的递归选项Ref
  const recursiveUnapproveRef = useRef<boolean>(false);
  const [versionLoading, setVersionLoading] = useState(false);
  const [versionList, setVersionList] = useState<BOM[]>([]);
  const [selectedVersions, setSelectedVersions] = useState<{ version1: string; version2: string } | null>(null);
  const [versionCompareResult, setVersionCompareResult] = useState<any>(null);
  
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
  
  // 物料列表（用于下拉选择）
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  
  // 单位字典映射（value -> label）
  const [unitValueToLabel, setUnitValueToLabel] = useState<Record<string, string>>({});

  // 用户列表（用于渲染审核人姓名）
  const [users, setUsers] = useState<User[]>([]);
  const currentUser = useGlobalStore((s) => s.currentUser);

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
   * 加载物料列表
   */
  useEffect(() => {
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
  }, []);

  /**
   * 加载单位字典
   */
  useEffect(() => {
    const loadUnitDictionary = async () => {
      try {
        const dictionary = await getDataDictionaryByCode('MATERIAL_UNIT');
        const items = await getDictionaryItemList(dictionary.uuid, true);
        
        // 创建value到label的映射
        const valueToLabelMap: Record<string, string> = {};
        items.forEach(item => {
          valueToLabelMap[item.value] = item.label;
        });
        setUnitValueToLabel(valueToLabelMap);
      } catch (error: any) {
        console.error('加载单位字典失败:', error);
      }
    };
    loadUnitDictionary();
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
      }
    } catch (error: any) {
      console.error('获取编号规则配置或生成编号失败:', error?.message || error);
    }
  };

  /**
   * 处理新建BOM
   */
  const handleCreate = async () => {
    setIsEdit(false);
    setEditContext(null);
    setCurrentBOMUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      isActive: true,
      isAlternative: false,
      priority: 0,
    });

    // 如果启用了自动编号，获取预览编号
    // 直接从后端API获取配置，确保配置是最新的
    try {
      const config = await getCodeRulePageConfig('master-data-engineering-bom');
      
      console.log('BOM编号自动生成检查 - 后端配置:', config);
      
      if (config?.autoGenerate && config?.ruleCode) {
        const ruleCode = config.ruleCode;
        
        try {
          // 构建基础context（版本号默认值）
          const context: Record<string, any> = {
            version: '1.0',
          };
          
          console.log('调用testGenerateCode:', { rule_code: ruleCode, context, entity_type: 'bom' });
          
          const codeResponse = await testGenerateCode({ 
            rule_code: ruleCode,
            context,
            check_duplicate: true,
            entity_type: 'bom',
          });
          
          console.log('testGenerateCode响应:', codeResponse);
          
          // 如果返回的编号为空，说明规则不存在或未启用，静默处理
          if (codeResponse.code) {
            formRef.current?.setFieldsValue({
              bomCode: codeResponse.code,
            });
          } else {
            console.warn(`编号规则 ${ruleCode} 不存在或未启用，跳过自动生成。响应:`, codeResponse);
            messageApi.warning(t('app.master-data.bom.codeRuleNotFound', { ruleCode }));
          }
        } catch (error: any) {
          // 处理其他错误（网络错误等）
          console.error('自动生成编号失败:', error?.message || error, error);
          messageApi.error(`${t('app.master-data.bom.autoCodeFailed')}: ${error?.message || error}`);
        }
      } else {
        console.warn('BOM编号自动生成未启用或规则代码不存在:', config);
      }
    } catch (error: any) {
      console.error('获取编号规则配置失败:', error);
    }
  };

  useNewShortcut(handleCreate);

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
      console.log('编辑BOM - 获取到的数据:', { 
        bomCode: first.bomCode, 
        materialId: first.materialId, 
        version: first.version,
        allBomCodes: list.map(b => b.bomCode)
      });
      setIsEdit(true);
      setEditContext({
        materialId: first.materialId,
        version: first.version ?? '1.0',
        uuidsToReplace: list.map((b) => b.uuid),
      });
      // 确保 BOM 编号正确设置：优先使用第一个记录的 bomCode，如果不存在则尝试从其他记录中获取
      const bomCodeValue = first.bomCode ?? list.find(b => b.bomCode)?.bomCode ?? '';
      const itemsData = list.map((b) => ({
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
      }));
      
      setModalVisible(true);
      // 使用 setTimeout 确保 Modal 和表单完全渲染后再设置值
      // 对于 AntForm.List，需要更长的延迟确保组件已完全初始化
      setTimeout(() => {
        if (formRef.current) {
          formRef.current.setFieldsValue({
            materialId: first.materialId,
            version: first.version ?? '1.0',
            bomCode: bomCodeValue,
            effectiveDate: first.effectiveDate,
            expiryDate: first.expiryDate,
            approvalStatus: first.approvalStatus,
            description: first.description,
            remark: first.remark,
            isActive: first.isActive,
          });
          // 单独设置 items，确保 AntForm.List 能正确接收数据
          setTimeout(() => {
            formRef.current?.setFieldValue('items', itemsData);
          }, 50);
        }
      }, 150);
    } catch (error: any) {
      messageApi.error(error?.message || t('app.master-data.bom.getFailed'));
    }
  };
  
  /**
   * 处理单条反审核（按组：该 BOM 版本下所有子件行一并反审核，支持可选递归子BOM）
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
      <Tag color={statusInfo.color} icon={statusInfo.icon}>
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
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('common.selectToDelete'));
      return;
    }

    const toDelete: string[] = [];
    for (const key of selectedRowKeys) {
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

    Modal.confirm({
      title: t('app.master-data.bom.batchDeleteConfirmTitle'),
      content: t('app.master-data.bom.batchDeleteConfirmContent', { count }),
      okText: t('app.master-data.bom.ok'),
      cancelText: t('app.master-data.bom.cancel'),
      okType: 'danger',
      onOk: async () => {
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
          if (failCount > 0) messageApi.error(t('common.batchDeletePartial', { count: failCount, errors: errors.length ? '：' + errors.join('; ') : '' }));
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('common.batchDeleteFailed'));
        }
      },
    });
  };


  /**
   * 处理批量审核BOM
   */
  /**
   * 处理批量审核BOM
   */
  const handleBatchApprove = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('app.master-data.bom.selectToApprove'));
      return;
    }

    const toProcess: string[] = [];
    for (const key of selectedRowKeys) {
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
   * 处理批量反审核BOM
   */
  const handleBatchUnapprove = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('app.master-data.bom.selectToOperate'));
      return;
    }

    const toProcess: string[] = [];
    for (const key of selectedRowKeys) {
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

      // 并行加载层级结构
      const hierarchy = await bomApi.getHierarchy(record.materialId, record.version).catch(() => null);

      if (bomDetailReqRef.current !== req) return;
      
      // 处理层级结构数据
      if (hierarchy) {
        console.log('层级结构原始数据:', hierarchy);
        console.log('层级结构items:', hierarchy.items);
        setHierarchyData(hierarchy);
        
        // 转换为Tree组件需要的格式
        const convertToTreeData = (items: BOMHierarchyItem[], parentPath: string = ''): DataNode[] => {
          return items.map((item, index) => {
            const currentPath = parentPath ? `${parentPath}/${index}` : `${index}`;
            // 直接使用后端返回的 componentCode 和 componentName，如果不存在则尝试从 materials 中查找
            let materialName = '';
            if (item.componentCode && item.componentName) {
              materialName = `${item.componentCode} - ${item.componentName}`;
            } else if (item.componentId) {
              const material = materials.find(m => m.id === item.componentId);
              materialName = material ? `${material.code} - ${material.name}` : `${t('app.master-data.bom.materialIdPrefix')}: ${item.componentId}`;
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
  };

  /**
   * 处理提交表单（创建/更新BOM）
   * 编辑时：先删除原主料+版本下全部 BOM 记录，再按表单批量创建，形成完整主料–子件关系
   */
  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      if (!values.items || values.items.length === 0) {
        messageApi.error(t('app.master-data.bom.addAtLeastOneChild'));
        return;
      }
      if (!values.materialId) {
        messageApi.error(t('app.master-data.bom.selectMainMaterial'));
        return;
      }

      const buildBatch = () => {
        return {
          material_id: values.materialId,
          items: values.items.map((item: any) => {
            if (!item.componentId) throw new Error(t('app.master-data.bom.selectChildMaterial'));
            if (!item.quantity || item.quantity <= 0) throw new Error(t('app.master-data.bom.quantityMustBePositive'));
            const unitValue = (item.unit && item.unit.trim()) ? item.unit.trim() : null;
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
            };
          }),
          version: values.version || '1.0',
          bom_code: values.bomCode,
          effective_date: values.effectiveDate,
          expiry_date: values.expiryDate,
          approval_status: values.approvalStatus || 'draft',
          description: values.description,
          remark: values.remark,
          is_active: values.isActive !== false,
        };
      };

      if (isEdit && editContext) {
        for (const uuid of editContext.uuidsToReplace) {
          await bomApi.delete(uuid);
        }
        const batchData = buildBatch();
        await bomApi.create(batchData as any);
        messageApi.success(t('app.master-data.bom.structureUpdated', { count: batchData.items.length }));
        setEditContext(null);
      } else {
        const batchData = buildBatch();
        await bomApi.create(batchData as any);
        messageApi.success(t('app.master-data.bom.itemsCreated', { count: batchData.items.length }));
      }

      setModalVisible(false);
      formRef.current?.resetFields();
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
    formRef.current?.resetFields();
  };

  /**
   * 获取物料名称（用于列表主物料/子物料列展示）
   */
  const getMaterialName = (materialId: number | undefined | null): string => {
    if (materialId == null) return '-';
    const material = materials.find(m => m.id === materialId);
    if (!material) return `物料ID: ${materialId}`;
    const code = material.code || material.mainCode || '';
    const spec = material.specification ? ` (${material.specification})` : '';
    return `${code} - ${material.name}${spec}`;
  };

  /**
   * 格式化物料显示文本（用于下拉选择器）
   */
  const formatMaterialLabel = (material: Material): string => {
    const code = material.code || material.mainCode || '';
    const spec = material.specification ? ` (${material.specification})` : '';
    return `${code} - ${material.name}${spec}`;
  };

  /**
   * 子物料选择/更新时：根据物料 baseUnit 回填单位，表单存 value，表格展示用字典标签
   * 使用回调的 componentId 更新，避免覆盖 Form 尚未写入的选项
   */
  const handleSubMaterialChange = (index: number, componentId: number | undefined) => {
    const unit = componentId ? (materials.find(m => m.id === componentId)?.baseUnit ?? '') : '';
    const items = formRef.current?.getFieldValue('items') ?? [];
    const next = [...items];
    if (next[index]) {
      const patch: Record<string, unknown> = { unit };
      if (componentId !== undefined) patch.componentId = componentId;
      next[index] = { ...next[index], ...patch };
      formRef.current?.setFieldsValue({ items: next });
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
    const getComponentCode = (componentId: number) =>
      materials.find((m) => m.id === componentId)?.mainCode ||
      materials.find((m) => m.id === componentId)?.code ||
      '';
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
      const errors: string[] = [];

      rows.forEach((row, rowIndex) => {
        if (!row || row.length === 0 || !row[headerIndexMap['parentCode']]) {
          return;
        }

        const parentCode = row[headerIndexMap['parentCode']]?.toString().trim();
        const componentCode = row[headerIndexMap['componentCode']]?.toString().trim();
        const quantityStr = row[headerIndexMap['quantity']]?.toString().trim();
        const unit =
          headerIndexMap['unit'] !== undefined
            ? row[headerIndexMap['unit']]?.toString().trim()
            : undefined;
        const wasteRateStr =
          headerIndexMap['wasteRate'] !== undefined
            ? row[headerIndexMap['wasteRate']]?.toString().trim()
            : undefined;
        const isRequiredStr =
          headerIndexMap['isRequired'] !== undefined
            ? row[headerIndexMap['isRequired']]?.toString().trim()
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

        importItems.push({
          parentCode,
          componentCode,
          quantity,
          unit: unit || undefined,
          wasteRate: wasteRate !== undefined ? wasteRate : undefined,
          isRequired: isRequired !== undefined ? isRequired : true,
          remark: remark || undefined,
        });
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
        version: '1.0', // 默认版本
      };

      await bomApi.batchImport(batchImportData);
      messageApi.success(t('app.master-data.bom.importSuccess', { count: importItems.length }));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.bom.batchImportFailed'));
    } finally {
      setBatchImportLoading(false);
    }
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
      // 获取该物料的所有BOM版本（含失效版本）
      const versions = await bomApi.getByMaterial(record.materialId, undefined, false, true);
      // 按版本号排序（降序）
      const sortedVersions = versions.sort((a, b) => {
        const aMatch = a.version.match(/v?(\d+)\.(\d+)/);
        const bMatch = b.version.match(/v?(\d+)\.(\d+)/);
        if (aMatch && bMatch) {
          const aMajor = parseInt(aMatch[1]);
          const aMinor = parseInt(aMatch[2]);
          const bMajor = parseInt(bMatch[1]);
          const bMinor = parseInt(bMatch[2]);
          if (aMajor !== bMajor) {
            return bMajor - aMajor;
          }
          return bMinor - aMinor;
        }
        return b.version.localeCompare(a.version);
      });
      setVersionList(sortedVersions);
      setVersionHistoryModalVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.bom.getVersionHistoryFailed'));
    }
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

  const groupColumns: MaterialBOMProColumn[] = [
    { 
      title: t('app.master-data.bom.materialTitle'), 
      dataIndex: 'materialId', 
      width: 200, 
      hideInSearch: true,
      sorter: true,
      render: (_, r: any) => {
        if (isRootRow(r)) return <span style={{ fontWeight: 500 }}>{getMaterialName(r.materialId)}</span>;
        return getMaterialName(r.componentId);
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
          const versionOptions = versions.map((v) => {
            const isDefault = v.firstItem?.isDefault ?? v.items?.some((i) => i.isDefault);
            const isObsolete = v.firstItem?.isObsolete ?? v.items?.some((i: any) => i.isObsolete);
            const label = [v.version, isDefault ? `(${defaultTagText})` : null, isObsolete ? `(${obsoleteTagText})` : null].filter(Boolean).join(' ');
            return {
              value: v.groupKey,
              label,
              version: v.version,
              isDefault: !!isDefault,
              isObsolete: !!isObsolete,
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
                const verRow = versions.find((v) => v.groupKey === groupKey);
                const ver = verRow?.version ?? (option as { version?: string })?.version ?? '';
                const isDef = verRow?.firstItem?.isDefault ?? (option as { isDefault?: boolean })?.isDefault ?? false;
                const isObs = verRow?.firstItem?.isObsolete ?? (option as { isObsolete?: boolean })?.isObsolete ?? false;
                return (
                  <Space size={4}>
                    <span>{ver}</span>
                    {isDef && <Tag color="gold">{defaultTagText}</Tag>}
                    {isObs && <Tag color="default">{obsoleteTagText}</Tag>}
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
      title: 'BOM编号', 
      dataIndex: 'bomCode', 
      width: 150, 
      hideInSearch: true,
      sorter: true,
      render: (_, r: any) => {
        if (isRootRow(r)) return r.bomCode || '-';
        if (r._bomCode) return r._bomCode;
        return '-';
      }
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
      title: t('app.master-data.bom.alternativeTitle'),
      dataIndex: 'isAlternative',
      width: 90,
      hideInSearch: true,
      render: (_, r: any) => {
        if (isRootRow(r)) return '-';
        return (
          <Tag color={r.isAlternative ? 'orange' : 'default'}>
            {r.isAlternative ? t('app.master-data.bom.yes') : t('app.master-data.bom.no')}
          </Tag>
        );
      },
    },
    {
      title: t('app.master-data.bom.isConfigurableColumn'),
      dataIndex: 'isConfigurable',
      width: 100,
      hideInSearch: true,
      render: (_, r: any) => {
        if (isRootRow(r)) return '-';
        const manualCfg = r.isConfigurable === true;
        const componentMaterial = materials.find((m) => m.id === r.componentId);
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
      width: 110,
      hideInSearch: true,
      render: (_, r: any) => {
        if (isRootRow(r)) return '-';
        return (r.isAlternative && r.alternativeGroupId != null) ? r.alternativeGroupId : '-';
      },
    },
    {
      title: t('app.master-data.bom.approvalStatusTitle'),
      dataIndex: 'approvalStatus',
      width: 120,
      valueType: 'select',
      sorter: true,
      valueEnum: { draft: { text: t('app.master-data.bom.statusDraft'), status: 'Default' }, pending: { text: t('app.master-data.bom.statusPending'), status: 'Processing' }, approved: { text: t('app.master-data.bom.statusApproved'), status: 'Success' }, rejected: { text: t('app.master-data.bom.statusRejected'), status: 'Error' } },
      render: (_, r: any) => {
        if (isRootRow(r)) return getApprovalStatusTag(r.approvalStatus);
        if (r._bomApprovalStatus) return getApprovalStatusTag(r._bomApprovalStatus);
        return '-';
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
    {
      title: t('app.master-data.bom.actionTitle'),
      valueType: 'option',
      width: 300,
      fixed: 'right',
      /** 主行含「详情 + 编辑 + 设计 + 审核 + 分组更多」共 5 项，提高 directMax 避免自定义 Dropdown 被塞进二级溢出 */
      uniActionRenderOptions: { directMax: 6 },
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
          { type: 'divider' },
          {
            key: 'delete',
            icon: <DeleteOutlined />,
            label: t('app.master-data.bom.delete'),
            danger: true,
            onClick: () => handleDeleteGroup(record),
            disabled: isApproved,
          },
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
          </Button>,
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
          </Button>,
          r.approvalStatus !== 'approved' ? (
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
          ) : (
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
          ),
          <Dropdown key="more" {...rowActionKind('skip')} menu={{ items: moreItems }} trigger={['click']} data-action-priority={4}>
            <Button type="text" className="ant-btn-row-action" icon={<MoreOutlined />}>
              {t('app.master-data.bom.more')}
            </Button>
          </Dropdown>,
        ];

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
      title: '发料方式',
      dataIndex: 'issueMethod',
      render: (_, record) => {
        const v =
          record.issueMethod ?? (record as { issue_method?: string }).issue_method ?? 'pick';
        return BOM_ISSUE_METHOD_LABEL[v] ?? v;
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
        <Tag color={record.isActive ? 'success' : 'default'}>
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
        title: '发料方式',
        dataIndex: 'issueMethod',
        width: 90,
        align: 'center',
        render: (_, record) => {
          const v =
            record.issueMethod ?? (record as { issue_method?: string }).issue_method ?? 'pick';
          return BOM_ISSUE_METHOD_LABEL[v] ?? v;
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
        columnPersistenceId="apps.master-data.pages.materials.bom"
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
        request={async (params, sort, _filter, searchFormValues) => {
          const includeObsolete = searchFormValues?.includeObsolete === true;
          const is404 = (e: any) =>
            e?.response?.status === 404 ||
            (typeof e?.message === 'string' && (e.message.includes('404') || e.message.includes('不存在')));
          try {
            // 1) 拉取分组摘要 + 作为子件出现的物料 ID（区分成品/半成品），无 limit 问题
            let groups: Array<{ material_id: number; version: string; bom_code?: string; approval_status: string; is_default: boolean; is_obsolete: boolean }>;
            let componentIds: number[];
            try {
              const [g, c] = await Promise.all([
                bomApi.getGroups(includeObsolete),
                bomApi.getComponentIds(includeObsolete),
              ]);
              groups = g;
              componentIds = c;
            } catch (apiErr: any) {
              if (is404(apiErr)) {
                // 后端未提供 groups/component-ids 接口时回退：用 list 全量拉取再分组
                const listResult = await bomApi.list({ skip: 0, limit: 10000, includeObsolete });
                const { groupRows, keyToUuids } = groupBomsByCode(listResult);
                let filteredGroupRows = groupRows;
                if (bomViewTypeRef.current === 'productBom') {
                  filteredGroupRows = filterToProductBomView(groupRows, listResult);
                } else if (bomViewTypeRef.current === 'semiProductBom') {
                  filteredGroupRows = filterToSemiProductBomView(groupRows, listResult);
                }
                if (searchFormValues?.materialId !== undefined && searchFormValues.materialId !== '' && searchFormValues.materialId != null) {
                  const mid = Number(searchFormValues.materialId);
                  if (!Number.isNaN(mid)) filteredGroupRows = filteredGroupRows.filter((r) => r.materialId === mid);
                }
                if (searchFormValues?.approvalStatus !== undefined && searchFormValues.approvalStatus !== '' && searchFormValues.approvalStatus != null) {
                  filteredGroupRows = filteredGroupRows.filter((r) => r.approvalStatus === searchFormValues.approvalStatus);
                }
                groupKeyToUuidsRef.current = keyToUuids;
                // 传入完整 groupRows 作为 allGroupRows，否则成品下的半成品无法展开
                const materialRows = groupBomsByMaterial(filteredGroupRows, selectedVersionByMaterial, groupRows);
                return pageMaterialBomRows(materialRows, params, searchFormValues as Record<string, unknown>, sort, materials);
              }
              throw apiErr;
            }
            const componentIdSet = new Set(componentIds);
            // 按视图过滤：成品 = material_id 不在 componentIdSet；半成品 = 在
            let filteredGroups = groups;
            if (bomViewTypeRef.current === 'productBom') {
              filteredGroups = groups.filter((g) => !componentIdSet.has(g.material_id));
            } else if (bomViewTypeRef.current === 'semiProductBom') {
              filteredGroups = groups.filter((g) => componentIdSet.has(g.material_id));
            }
            // 主物料筛选
            if (searchFormValues?.materialId !== undefined && searchFormValues.materialId !== '' && searchFormValues.materialId != null) {
              const mid = Number(searchFormValues.materialId);
              if (!Number.isNaN(mid)) filteredGroups = filteredGroups.filter((g) => g.material_id === mid);
            }
            // 审核状态筛选
            if (searchFormValues?.approvalStatus !== undefined && searchFormValues.approvalStatus !== '' && searchFormValues.approvalStatus != null) {
              filteredGroups = filteredGroups.filter((g) => g.approval_status === searchFormValues.approvalStatus);
            }
            if (filteredGroups.length === 0) {
              groupKeyToUuidsRef.current = new Map();
              const pageSize = params.pageSize || 20;
              const current = params.current || 1;
              return { data: [], success: true, total: 0 };
            }
            // 2) 批量拉取所有分组对应的 BOM 子件明细，一次请求构建完整树
            let batchItems: Record<string, BOM[]>;
            try {
              batchItems = await bomApi.getBatchItems(
                filteredGroups.map((g) => ({ material_id: g.material_id, version: g.version })),
                includeObsolete
              );
            } catch (batchErr: any) {
              if (is404(batchErr)) {
                const listResult = await bomApi.list({ skip: 0, limit: 10000, includeObsolete });
                const { groupRows, keyToUuids } = groupBomsByCode(listResult);
                let filteredGroupRows = groupRows;
                if (bomViewTypeRef.current === 'productBom') {
                  filteredGroupRows = filterToProductBomView(groupRows, listResult);
                } else if (bomViewTypeRef.current === 'semiProductBom') {
                  filteredGroupRows = filterToSemiProductBomView(groupRows, listResult);
                }
                if (searchFormValues?.materialId !== undefined && searchFormValues.materialId !== '' && searchFormValues.materialId != null) {
                  const mid = Number(searchFormValues.materialId);
                  if (!Number.isNaN(mid)) filteredGroupRows = filteredGroupRows.filter((r) => r.materialId === mid);
                }
                if (searchFormValues?.approvalStatus !== undefined && searchFormValues.approvalStatus !== '' && searchFormValues.approvalStatus != null) {
                  filteredGroupRows = filteredGroupRows.filter((r) => r.approvalStatus === searchFormValues.approvalStatus);
                }
                groupKeyToUuidsRef.current = keyToUuids;
                const materialRows = groupBomsByMaterial(filteredGroupRows, selectedVersionByMaterial, groupRows);
                return pageMaterialBomRows(materialRows, params, searchFormValues as Record<string, unknown>, sort, materials);
              }
              throw batchErr;
            }
            // 3) 将摘要 + 明细组装成 BOMGroupRow[]（与 groupBomsByCode 产出结构一致）
            const keyToUuids = new Map<string, string[]>();
            const buildGroupRow = (
              g: typeof filteredGroups[0],
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
            const displayGroupRows: BOMGroupRow[] = filteredGroups.map((g) => {
              const k = `${g.material_id}|${g.version}`;
              const items: BOM[] = batchItems[k] ?? [];
              return buildGroupRow(g, items);
            });
            // 成品视图下：递归补拉半成品 BOM（如 010001→020001→020002），否则嵌套半成品无法展开
            let allGroupRowsForNesting: BOMGroupRow[] = displayGroupRows;
            const mergedBatchItems: Record<string, BOM[]> = { ...batchItems };
            const existingGroupKeys = new Set(
              filteredGroups.map((g) => `${g.material_id}|${g.version}`)
            );
            let frontierSemiIds = new Set<number>();
            for (const g of filteredGroups) {
              const items = mergedBatchItems[`${g.material_id}|${g.version}`] ?? [];
              for (const it of items) {
                if (componentIdSet.has(it.componentId)) frontierSemiIds.add(it.componentId);
              }
            }
            const processedSemiIds = new Set<number>();
            while (frontierSemiIds.size > 0) {
              const nextFrontier = new Set<number>();
              const semiFinishedGroupSummaries = groups.filter((x) => frontierSemiIds.has(x.material_id));
              const byMid = new Map<number, typeof groups[0]>();
              for (const x of semiFinishedGroupSummaries) {
                const cur = byMid.get(x.material_id);
                if (!cur) byMid.set(x.material_id, x);
                else if (x.is_default) byMid.set(x.material_id, x);
              }
              const needFetch = Array.from(byMid.values()).filter(
                (g) => !existingGroupKeys.has(`${g.material_id}|${g.version}`)
              );
              if (needFetch.length > 0) {
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
                    if (componentIdSet.has(it.componentId) && !processedSemiIds.has(it.componentId)) {
                      nextFrontier.add(it.componentId);
                    }
                  }
                }
              }
              frontierSemiIds.forEach((id) => processedSemiIds.add(id));
              frontierSemiIds = nextFrontier;
            }
            groupKeyToUuidsRef.current = keyToUuids;
            const materialRows = groupBomsByMaterial(displayGroupRows, selectedVersionByMaterial, allGroupRowsForNesting);
            return pageMaterialBomRows(materialRows, params, searchFormValues as Record<string, unknown>, sort, materials);
          } catch (error: any) {
            console.error('获取BOM列表失败:', error);
            messageApi.error(error?.message || t('app.master-data.bom.getListFailed'));
            return { data: [], success: false, total: 0 };
          }
        }}
        rowKey={(record: any) => record.groupKey ?? record.key ?? record.uuid ?? String(Math.random())}
        defaultExpandAllRows={true}
        showAdvancedSearch={true}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
        }}
        headerActions={
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
            >
              {'新建BOM' + NEW_SHORTCUT_HINT}
            </Button>
            <Button
              disabled={selectedRowKeys.length === 0}
              icon={<CheckCircleOutlined />}
              onClick={handleBatchApprove}
            >
              批量审核
            </Button>
            <Button
              disabled={selectedRowKeys.length === 0}
              icon={<UndoOutlined />}
              onClick={handleBatchUnapprove}
            >
              {t('app.master-data.bom.batchUnapproveBtn')}
            </Button>
            <Button
              danger
              disabled={selectedRowKeys.length === 0}
              icon={<DeleteOutlined />}
              onClick={handleBatchDelete}
            >
              {t('common.batchDelete')}
            </Button>
          </Space>
        }
        showImportButton={true}
        onImport={handleBatchImportConfirm}
        importHeaders={bomImportTemplate.importHeaders}
        importExampleRow={bomImportTemplate.importExampleRow}
        importFieldMap={bomImportTemplate.importHeaderMap}
        showExportButton={true}
        onExport={async (type, selectedRowKeys, currentPageData) => {
          try {
            let toExport: (BOMGroupRow | MaterialBOMRow)[] = [];
            if (type === 'selected' && selectedRowKeys?.length && currentPageData) {
              toExport = currentPageData.filter((r: any) => selectedRowKeys.includes(r.groupKey));
            } else if (type === 'currentPage' && currentPageData) {
              toExport = currentPageData;
            } else {
              const result = await bomApi.list({ skip: 0, limit: 10000 });
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
            const blob = new Blob(['\ufeff' + JSON.stringify(toExport, null, 2)], { type: 'application/json;charset=utf-8' });
            const filename = `BOM_${new Date().toISOString().slice(0, 10)}.json`;
            downloadFile(blob, filename);
            messageApi.success(t('common.exportSuccess', { count: toExport.length }));
          } catch (error: any) {
            messageApi.error(error?.message || t('app.master-data.exportFailed'));
          }
        }}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
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
                      <span style={{ fontWeight: 500 }}>主物料：</span>
                      <span>
                        {hierarchyData.materialCode && hierarchyData.materialName
                          ? `${hierarchyData.materialCode} - ${hierarchyData.materialName}`
                          : hierarchyData.materialCode ||
                            hierarchyData.materialName ||
                            getMaterialName(hierarchyData.materialId) ||
                            '-'}
                      </span>
                      <span style={{ color: '#999' }}>版本：{hierarchyData.version || ''}</span>
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
        }
      />

      {/* 创建/编辑BOM Modal - 两栏网格：基础字段每行两列，子物料列表通栏 */}
      <FormModalTemplate
        title={isEdit ? t('app.master-data.bom.editBom') : t('app.master-data.bom.createBom')}
        open={modalVisible}
        onClose={handleCloseModal}
        onFinish={handleSubmit}
        isEdit={isEdit}
        loading={formLoading}
        width={MODAL_CONFIG.LARGE_WIDTH}
        grid={true}
        formRef={formRef}
        initialValues={isEdit ? undefined : {
          isActive: true,
          version: '1.0',
          approvalStatus: 'draft',
          items: [{ 
            isAlternative: false, 
            priority: 0,
            wasteRate: 0,
            isRequired: true,
            issueMethod: 'pick',
          }],
        }}
        className="bom-form-modal"
      >
        <style>{`
          .bom-form-modal .bom-items-list-form-item .ant-form-item-label {
            padding-left: 8px;
            padding-right: 8px;
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
                fieldProps={{ maxLength: 100 }}
              />
            );
          }}
        </ProForm.Item>
        <SafeProFormSelect
          name="materialId"
          label={t('app.master-data.bom.mainMaterialLabel')}
          placeholder={t('app.master-data.bom.mainMaterialPlaceholder')}
          colProps={{ span: 12 }}
          options={materials.map(m => ({ label: formatMaterialLabel(m), value: m.id }))}
          rules={[{ required: true, message: t('app.master-data.bom.mainMaterialRequired') }]}
          fieldProps={{
            disabled: isEdit,
            loading: materialsLoading,
            showSearch: true,
            filterOption: (input, option) => (option?.label as string || '').toLowerCase().includes(input.toLowerCase()),
            onChange: () => { if (!isEdit) setTimeout(() => regenerateBOMCode(), 300); },
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
            onChange: (e) => { if (!isEdit && e?.target?.value) setTimeout(() => regenerateBOMCode(), 300); },
          }}
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
          fieldProps={{ style: { width: '100%' } }}
        />
        <ProForm.Item
            label={t('app.master-data.bom.childMaterialList')}
            colProps={{ span: 24 }}
            rules={[
              { required: true, message: t('app.master-data.bom.childMaterialListRequired') },
            ]}
            style={{ width: '100%' }}
            className="bom-items-list-form-item"
          >
            <ProForm.Item name="items" noStyle style={{ width: '100%' }}>
              <AntForm.List name="items">
                {(fields, { add, remove }) => {
                  const tableColumns: ColumnsType<any> = [
                    {
                      title: t('app.master-data.bom.childMaterialTitleCol'),
                      dataIndex: 'componentId',
                      width: 210,
                      render: (_, record, index) => (
                        <AntForm.Item
                          name={[index, 'componentId']}
                          rules={[{ required: true, message: t('app.master-data.bom.childMaterialRequired') }]}
                          style={{ margin: 0 }}
                        >
                          <Select
                            placeholder={t('app.master-data.bom.childMaterialPlaceholder')}
                            showSearch
                            loading={materialsLoading}
                            size="small"
                            filterOption={(input, option) => {
                              const label = option?.label as string || '';
                              return label.toLowerCase().includes(input.toLowerCase());
                            }}
                            options={materials.map(m => ({
                              label: formatMaterialLabel(m),
                              value: m.id,
                            }))}
                            onChange={(val) => handleSubMaterialChange(index, val)}
                          />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: t('app.master-data.bom.quantityLabel'),
                      dataIndex: 'quantity',
                      width: 100,
                      render: (_, record, index) => (
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
                      render: (_, record, index) => (
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
                      width: 100,
                      render: (_, record, index) => (
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
                      title: '发料方式',
                      dataIndex: 'issueMethod',
                      width: 110,
                      render: (_, record, index) => (
                        <AntForm.Item
                          name={[index, 'issueMethod']}
                          initialValue="pick"
                          style={{ margin: 0 }}
                        >
                          <Select size="small" options={[...BOM_ISSUE_METHOD_OPTIONS]} />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: t('app.master-data.bom.isRequiredTitle'),
                      dataIndex: 'isRequired',
                      width: 80,
                      render: (_, record, index) => (
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
                      width: 80,
                      render: (_, record, index) => (
                        <AntForm.Item
                          name={[index, 'isAlternative']}
                          valuePropName="checked"
                          style={{ margin: 0 }}
                        >
                          <Switch size="small" />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: t('app.master-data.bom.alternativeGroupIdLabel'),
                      dataIndex: 'alternativeGroupId',
                      width: 100,
                      render: (_, record, index) => (
                        <AntForm.Item
                          name={[index, 'alternativeGroupId']}
                          style={{ margin: 0 }}
                          rules={[
                            {
                              validator: async (_, value) => {
                                const items = formRef.current?.getFieldValue('items') || [];
                                const item = items[index];
                                if (item?.isAlternative && (value === undefined || value === null || value === '')) {
                                  throw new Error(t('app.master-data.bom.alternativeGroupIdRequired'));
                                }
                              },
                            },
                          ]}
                        >
                          <InputNumber
                            placeholder={t('app.master-data.bom.alternativeGroupIdPlaceholder')}
                            precision={0}
                            size="small"
                            style={{ width: '100%' }}
                            min={0}
                          />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: t('app.master-data.bom.priorityLabel'),
                      dataIndex: 'priority',
                      width: 80,
                      render: (_, record, index) => (
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
                      render: (_, record, index) => (
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
                    {
                      title: t('app.master-data.bom.actionLabel'),
                      width: 70,
                      fixed: 'right',
                      render: (_, record, index) => (
                        <Button
                          type="link"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => remove(index)}
                        >
                          {t('app.master-data.bom.delete')}
                        </Button>
                      ),
                    },
                  ];

                  // 计算表格总宽度
                  const totalWidth = tableColumns.reduce(
                    (sum, col) => sum + (typeof col.width === 'number' ? col.width : Number(col.width) || 0),
                    0
                  );

                  return (
                    <div 
                      className="bom-items-table-container"
                      style={{ 
                        width: '100%',
                        overflow: 'hidden',
                        position: 'relative',
                        paddingLeft: '8px',
                        paddingRight: '8px',
                        boxSizing: 'border-box',
                      }}
                    >
                      <div 
                        className="bom-items-table-scroll"
                        style={{ 
                          width: '100%', 
                          overflowX: 'auto',
                          overflowY: 'visible',
                          WebkitOverflowScrolling: 'touch',
                        }}
                      >
                        <Table
                          columns={tableColumns}
                          dataSource={fields.map((field, index) => ({ ...field, key: index }))}
                          rowKey="key"
                          size="small"
                          pagination={false}
                          scroll={{ x: totalWidth }}
                          style={{ 
                            width: totalWidth,
                            margin: 0,
                          }}
                          footer={() => (
                            <Button
                              type="dashed"
                              icon={<PlusOutlined />}
                              onClick={() => add({
                                quantity: 1,
                                wasteRate: 0,
                                isRequired: true,
                                issueMethod: 'pick',
                                isAlternative: false,
                                alternativeGroupId: undefined,
                                priority: 0,
                              })}
                              block
                            >
                              {t('app.master-data.bom.addChildMaterial')}
                            </Button>
                          )}
                        />
                      </div>
                    </div>
                  );
                }}
              </AntForm.List>
            </ProForm.Item>
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
            关闭
          </Button>,
        ]}
        width={1000}
      >
        <div style={{ marginTop: 16 }}>
          {versionList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              暂无版本历史
            </div>
          ) : (
            <Space orientation="vertical" style={{ width: '100%' }} size="middle">
              {versionList.map((bom, index) => (
                <div
                  key={bom.uuid}
                  style={{
                    padding: '12px',
                    border: '1px solid var(--river-border-color)',
                    borderRadius: '4px',
                    backgroundColor: index === 0 ? '#f0f9ff' : '#fff',
                  }}
                >
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <div>
                      <Tag color={index === 0 ? 'blue' : 'default'}>{bom.version}</Tag>
                      {bom.isObsolete && <Tag color="default">{t('app.master-data.bom.obsoleteTag')}</Tag>}
                      <span style={{ marginLeft: 8 }}>
                        {getMaterialName(bom.materialId)} → {getMaterialName(bom.componentId)}
                      </span>
                      <span style={{ marginLeft: 8, color: '#999' }}>
                        {bom.quantity} {bom.unit || ''}
                      </span>
                    </div>
                    <Space>
                      {index < versionList.length - 1 && (
                        <Button
                          type="link"
                          size="small"
                          icon={<DiffOutlined />}
                          onClick={() => handleCompareVersions(versionList[index + 1].version, bom.version)}
                        >
                          对比
                        </Button>
                      )}
                      <span style={{ color: '#999', fontSize: '12px' }}>
                        {new Date(bom.createdAt).toLocaleString()}
                      </span>
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
            {obsoleteRecord.bomCode} · {t('app.master-data.bom.versionTitle')} {obsoleteRecord.version}
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
        title={`BOM版本对比：${selectedVersions?.version1} vs ${selectedVersions?.version2}`}
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
            关闭
          </Button>,
        ]}
        width={1200}
      >
        {versionCompareResult && (
          <div style={{ marginTop: 16 }}>
            {/* 新增的子件 */}
            {versionCompareResult.added_items && versionCompareResult.added_items.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ color: '#52c41a', marginBottom: 12 }}>新增子件（{versionCompareResult.added_items.length}项）</h4>
                <Space orientation="vertical" style={{ width: '100%' }} size="small">
                  {versionCompareResult.added_items.map((item: any, index: number) => (
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
                          {item.wasteRate ? ` (损耗率: ${item.wasteRate}%)` : ''}
                        </span>
                      </Space>
                    </div>
                  ))}
                </Space>
              </div>
            )}

            {/* 删除的子件 */}
            {versionCompareResult.removed_items && versionCompareResult.removed_items.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ color: '#ff4d4f', marginBottom: 12 }}>删除子件（{versionCompareResult.removed_items.length}项）</h4>
                <Space orientation="vertical" style={{ width: '100%' }} size="small">
                  {versionCompareResult.removed_items.map((item: any, index: number) => (
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
                          {item.wasteRate ? ` (损耗率: ${item.wasteRate}%)` : ''}
                        </span>
                      </Space>
                    </div>
                  ))}
                </Space>
              </div>
            )}

            {/* 修改的子件 */}
            {versionCompareResult.modified_items && versionCompareResult.modified_items.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ color: '#1890ff', marginBottom: 12 }}>修改子件（{versionCompareResult.modified_items.length}项）</h4>
                <Space orientation="vertical" style={{ width: '100%' }} size="small">
                  {versionCompareResult.modified_items.map((item: any, index: number) => (
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
                        <strong>{getMaterialName(item.item.componentId)}</strong>
                      </div>
                      <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                        {Object.entries(item.changes || {}).map(([field, change]: [string, any]) => (
                          <div key={field} style={{ paddingLeft: 16 }}>
                            <span style={{ fontWeight: 500 }}>{field === 'quantity' ? t('app.master-data.bom.quantityTitle') : field === 'unit' ? t('app.master-data.bom.unitTitle') : field === 'wasteRate' ? t('app.master-data.bom.wasteRateTitle') : field === 'isRequired' ? t('app.master-data.bom.isRequiredTitle') : field}</span>
                            {'：'}
                            <span style={{ textDecoration: 'line-through', color: '#ff4d4f', marginLeft: 8 }}>
                              {field === 'isRequired' ? (change.old ? t('app.master-data.bom.yes') : t('app.master-data.bom.no')) : change.old}
                            </span>
                            {' → '}
                            <span style={{ color: '#52c41a', fontWeight: 500 }}>
                              {field === 'isRequired' ? (change.new ? t('app.master-data.bom.yes') : t('app.master-data.bom.no')) : change.new}
                            </span>
                          </div>
                        ))}
                      </Space>
                    </div>
                  ))}
                </Space>
              </div>
            )}

            {/* 无差异提示 */}
            {(!versionCompareResult.added_items || versionCompareResult.added_items.length === 0) &&
              (!versionCompareResult.removed_items || versionCompareResult.removed_items.length === 0) &&
              (!versionCompareResult.modified_items || versionCompareResult.modified_items.length === 0) && (
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
              <Space>
                <span style={{ fontWeight: 500 }}>{t('app.master-data.bom.parentQuantityResultLabel')}：</span>
                <span>{quantityResult.parentQuantity}</span>
                <span style={{ color: '#999' }}>个</span>
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
                                  <Tag color={component.level === 0 ? 'blue' : 'default'}>层级 {component.level}</Tag>
                                </Space>
                              </div>
                              <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                                <div>
                                  <span style={{ color: '#999' }}>基础用量：</span>
                                  <span style={{ marginLeft: 8 }}>{component.baseQuantity} {component.unit || ''}</span>
                                </div>
                                {component.wasteRate > 0 && (
                                  <div>
                                    <span style={{ color: '#999' }}>损耗率：</span>
                                    <Tag color="orange" style={{ marginLeft: 8 }}>{component.wasteRate}%</Tag>
                                  </div>
                                )}
                                <div>
                                  <span style={{ color: '#999' }}>实际用量：</span>
                                  <span style={{ marginLeft: 8, fontWeight: 500, color: '#52c41a', fontSize: '16px' }}>
                                    {component.actualQuantity.toFixed(4)} {component.unit || ''}
                                  </span>
                                </div>
                                {component.wasteRate > 0 && (
                                  <div style={{ fontSize: '12px', color: '#999', marginTop: 4 }}>
                                    计算公式：{component.baseQuantity} × (1 + {component.wasteRate}%) = {component.actualQuantity.toFixed(4)}
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
                暂无子物料数据
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
};

export default BOMPage;

