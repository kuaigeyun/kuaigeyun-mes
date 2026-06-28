/**
 * 物料表单组件（多标签页）
 *
 * 实现物料的新建和编辑功能，包含标签页：
 * 1. 基本信息（含物料来源）
 * 2. 属性管理
 * 3. 多单位管理
 * 4. 编号映射
 * 5. 默认值设置
 *
 * Author: Luigi Lu
 * Date: 2026-01-08
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Modal, Tabs, App, Table, Button, Form, Input, Select, Collapse, Row, Col, Alert, Tag, Space, Switch, Card, theme, Upload, Typography, Tooltip } from 'antd';
import { UniTableStackedPrimaryCell } from '../../../components/uni-table/stackedPrimaryColumn';
import { useCustomFields } from '../../../hooks/useCustomFields';
import { CustomFieldsFormSection } from '../../../components/custom-fields';
import { FormModalTemplate } from '../../../components/layout-templates';
import { MODAL_CONFIG, MODAL_NESTED_ABOVE_PARENT_OFFSET } from '../../../components/layout-templates/constants';
import { UniDropdown } from '../../../components/uni-dropdown';
import { PlusOutlined, DeleteOutlined, EditOutlined, LinkOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { ProForm, ProFormInstance, ProFormText, ProFormTextArea, ProFormSwitch, ProFormSelect, ProFormDigit, ProFormDependency, ProFormUploadButton, ProFormItem } from '@ant-design/pro-components';
import {
  formatMaterialGroupLabel,
  type Material,
  type MaterialGroup,
  type MaterialCreate,
  type MaterialUpdate,
  type DepartmentCodeMapping,
  type CustomerCodeMapping,
  type SupplierCodeMapping,
  type MaterialUnit,
  type MaterialCodeMapping,
} from '../types/material';
import type { Customer } from '../types/supply-chain';
import type { Supplier } from '../types/supply-chain';
import { customerApi, supplierApi, unwrapSupplyPagedList } from '../services/supply-chain';
import { warehouseApi, storageLocationApi, storageAreaApi } from '../services/warehouse';
import { processRouteApi, operationApi } from '../services/process';
import { materialCodeMappingApi } from '../services/material';
import { bomApi } from '../services/material';
import type { Warehouse, StorageLocation, StorageArea } from '../types/warehouse';
import type { ProcessRoute, Operation } from '../types/process';
import {
  MaterialVariantCombinationsTable,
  flushPendingVariantCombinations,
  isVariantSkuMaterial,
  normalizeScalarAttrs,
  type PendingVariantCombination,
} from './MaterialVariantCombinationsTable';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../utils/codeRulePage';
import { testGenerateCode } from '../../../services/codeRule';

import DictionarySelect from '../../../components/dictionary-select';
import { getDataDictionaryByCode, getDictionaryItemList } from '../../../services/dataDictionary';
import PriceTypeSwitch, { type PriceTypeValue } from '../../../components/price-type-switch/PriceTypeSwitch';
import { convertUnitPriceByPriceType } from '../utils/resolve-partner-material-price';
import { buildImageUploadFileUrls, getFileByUuid, uploadMultipleFiles } from '../../../services/file';
import { batchRuleApi, serialRuleApi } from '../services/batchSerialRules';
import { saveSuspendedModal } from '../utils/suspendedModal';
import { buildMaterialSourceTypeOptions } from '../utils/materialSourceType';
import { MaterialGroupFormModal } from './MaterialGroupFormModal';
import { RouteFormModal } from './RouteFormModal';
import { SupplierFormModal } from './SupplierFormModal';
import { OperationFormModal } from './OperationFormModal';
import { DEFAULT_MATERIAL_BASE_UNIT } from '../constants/materialDefaults';
import { QualityMasterDataHint } from '../../kuaizhizao/pages/quality-management/components/QualityMasterDataHint';
import {
  InspectionStagesEditor,
  legacyFromStages,
  materialStagesToApiPayload,
  normalizeStagesInput,
  stagesFromLegacy,
} from './InspectionStagesEditor';
const { Panel } = Collapse;

/** 物料附件：图片 + PDF + DWG（与上传校验、后端白名单一致） */
const MATERIAL_ATTACHMENT_EXT = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg',
  'pdf', 'dwg', 'dxf', 'step', 'stp', 'xls', 'xlsx',
]);

function materialAttachmentExtLower(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

function isImageAttachmentExt(ext: string): boolean {
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
}

/** 系统默认规则占位值（提交时转为 null） */
const SYSTEM_DEFAULT_RULE_VALUE = '__SYSTEM_DEFAULT__';

/** 每种物料来源类型的合法字段白名单（用于过滤混合字段） */
const SOURCE_CONFIG_FIELDS: Record<string, string[]> = {
  Make: ['manufacturing_mode', 'production_lead_time', 'min_production_batch'],
  Buy: ['purchase_price', 'purchase_lead_time', 'min_purchase_batch', 'default_supplier_id', 'default_supplier_name'],
  Outsource: ['outsource_supplier_id', 'outsource_supplier_name', 'outsource_lead_time', 'min_outsource_batch', 'outsource_operation', 'outsource_price', 'material_provided_by'],
  Phantom: [],
  Service: [],
};

function normalizeSourceTypeValues(
  sourceType?: string | null,
  sourceConfig?: Record<string, any> | null,
): string[] {
  const configValues = Array.isArray(sourceConfig?.source_types)
    ? sourceConfig!.source_types
    : [];
  const merged = [
    ...configValues,
    sourceType,
  ]
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
  return Array.from(new Set(merged));
}

function getPrimarySourceType(sourceTypes: string[]): string | undefined {
  return sourceTypes[0];
}

/**
 * 物料表单组件属性
 */
export interface MaterialFormProps {
  /** 是否显示 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 提交回调 */
  onFinish: (values: MaterialCreate | MaterialUpdate) => Promise<void>;
  /** 是否为编辑模式 */
  isEdit?: boolean;
  /** 当前物料数据（编辑模式） */
  material?: Material;
  /** 物料分组列表 */
  materialGroups?: Array<{ id: number; code: string; name: string }>;
  /** 加载状态 */
  loading?: boolean;
  /** 表单初始值 */
  initialValues?: Partial<MaterialCreate | MaterialUpdate>;
  /** 暂存 Modal 时的返回路径，设置后点击表单内链接会先暂存表单再跳转 */
  suspendedModalReturnPath?: string;
  /** 物料分组列表变更后回调（如快速新增分组后刷新父级列表） */
  onMaterialGroupsChange?: () => void;
}

/**
 * 物料表单组件
 */
export const MaterialForm: React.FC<MaterialFormProps> = ({
  open,
  onClose,
  onFinish,
  isEdit = false,
  material,
  materialGroups = [],
  loading = false,
  initialValues,
  suspendedModalReturnPath,
  onMaterialGroupsChange,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = theme.useToken();
  const formRef = useRef<ProFormInstance>();
  const [localMaterialGroups, setLocalMaterialGroups] = useState<MaterialGroup[]>(materialGroups);
  const [groupFormModalOpen, setGroupFormModalOpen] = useState(false);
  const [routeFormModalOpen, setRouteFormModalOpen] = useState(false);
  const [supplierFormModalOpen, setSupplierFormModalOpen] = useState(false);
  const [operationFormModalOpen, setOperationFormModalOpen] = useState(false);
  const [supplierQuickCreateField, setSupplierQuickCreateField] = useState<
    'default_supplier_id' | 'outsource_supplier_id'
  >('default_supplier_id');
  
  const {
    customFields,
    customFieldValues,
    loadFieldValues,
    extractFormValues,
    saveCustomFieldValues,
    resetFieldValues,
  } = useCustomFields({ tableName: 'master_data_materials', loadWhenOpen: true, open });

  const sourceTypeOptions = useMemo(() => buildMaterialSourceTypeOptions(t), [t]);
  const [activeTab, setActiveTab] = useState<string>('basic');
  const [variantManaged, setVariantManaged] = useState<boolean>(false);
  const [pendingVariantRows, setPendingVariantRows] = useState<PendingVariantCombination[]>([]);

  useEffect(() => {
    setLocalMaterialGroups(materialGroups);
  }, [materialGroups]);

  useEffect(() => {
    if (!open) {
      setPendingVariantRows([]);
      setGroupFormModalOpen(false);
      setRouteFormModalOpen(false);
      setSupplierFormModalOpen(false);
      setOperationFormModalOpen(false);
      deferredCustomersLoadedRef.current = false;
      deferredWarehousesLoadedRef.current = false;
      return;
    }
    setActiveTab('basic');
  }, [open]);

  // 打开表单时同步 variantManaged 状态（编辑已有属性物料时，属性管理标签页需可用）
  useEffect(() => {
    if (open) {
      const iv = initialValues as { variantManaged?: boolean; variant_managed?: boolean } | undefined;
      const vm =
        material?.variantManaged ??
        (material as { variant_managed?: boolean })?.variant_managed ??
        iv?.variantManaged ??
        iv?.variant_managed ??
        false;
      setVariantManaged(!!vm);
    }
  }, [open, isEdit, material, material?.variantManaged, (material as any)?.variant_managed, initialValues]);
  
  // 客户和供应商列表
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [processRoutes, setProcessRoutes] = useState<ProcessRoute[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [warehousesLoading, setWarehousesLoading] = useState(false);
  const [processRoutesLoading, setProcessRoutesLoading] = useState(false);
  const [operationsLoading, setOperationsLoading] = useState(false);

  // 编号映射数据
  const [departmentCodes, setDepartmentCodes] = useState<DepartmentCodeMapping[]>([]);
  const [customerCodes, setCustomerCodes] = useState<CustomerCodeMapping[]>([]);
  const [supplierCodes, setSupplierCodes] = useState<SupplierCodeMapping[]>([]);
  const [externalSystemCodes, setExternalSystemCodes] = useState<MaterialCodeMapping[]>([]);
  const [externalSystemCodesLoading, setExternalSystemCodesLoading] = useState(false);
  const deferredCustomersLoadedRef = useRef(false);
  const deferredWarehousesLoadedRef = useRef(false);

  /** 最后一次自动生成的编号（用于提交时判断是否让后端生成，确保隔离字段生效） */
  const lastAutoGeneratedCodeRef = useRef<string | null>(null);

  /**
   * 加载客户列表
   */
  const loadCustomers = async () => {
    try {
      setCustomersLoading(true);
      const result = await customerApi.list({ limit: 1000, isActive: true });
      setCustomers(unwrapSupplyPagedList(result));
    } catch (error: any) {
      console.error(t('app.master-data.materialForm.fetchCustomersFailed'), error);
    } finally {
      setCustomersLoading(false);
    }
  };

  /**
   * 加载供应商列表
   */
  const loadSuppliers = async () => {
    try {
      setSuppliersLoading(true);
      const result = await supplierApi.list({ limit: 1000, isActive: true });
      setSuppliers(unwrapSupplyPagedList(result));
    } catch (error: any) {
      console.error(t('app.master-data.materialForm.fetchSuppliersFailed'), error);
    } finally {
      setSuppliersLoading(false);
    }
  };

  /**
   * 加载仓库列表
   */
  const loadWarehouses = async () => {
    try {
      setWarehousesLoading(true);
      const result = await warehouseApi.list({ limit: 1000, is_active: true });
      setWarehouses(result.items);
    } catch (error: any) {
      console.error(t('app.master-data.materialForm.fetchWarehousesFailed'), error);
    } finally {
      setWarehousesLoading(false);
    }
  };

  /**
   * 加载工艺路线列表
   */
  const loadProcessRoutes = async () => {
    try {
      setProcessRoutesLoading(true);
      const result = await processRouteApi.list({ limit: 1000, isActive: true });
      setProcessRoutes(Array.isArray(result) ? result : result?.data ?? []);
    } catch (error: any) {
      console.error(t('app.master-data.materialForm.fetchProcessRoutesFailed'), error);
    } finally {
      setProcessRoutesLoading(false);
    }
  };

  /**
   * 加载工序列表（委外工序下拉用）
   */
  const loadOperations = async () => {
    try {
      setOperationsLoading(true);
      const result = await operationApi.list({ limit: 1000, isActive: true });
      setOperations(Array.isArray(result) ? result : result?.data ?? []);
    } catch (error: any) {
      console.error(t('app.master-data.materialForm.fetchOperationsFailed'), error);
    } finally {
      setOperationsLoading(false);
    }
  };

  /**
   * 加载外部系统编号映射
   */
  const loadExternalSystemCodes = async (materialUuid: string) => {
    try {
      setExternalSystemCodesLoading(true);
      const result = await materialCodeMappingApi.list({ materialUuid, page: 1, pageSize: 1000 });
      setExternalSystemCodes(result.items || []);
    } catch (error: any) {
      console.error(t('app.master-data.materialForm.fetchExternalMappingsFailed'), error);
    } finally {
      setExternalSystemCodesLoading(false);
    }
  };

  /**
   * 生成编号的辅助函数
   * 
   * @param groupId - 物料分组ID
   * @param sourceType - 物料来源类型
   * @param name - 物料名称
   * @param forceUpdate - 是否强制更新编号（即使字段已有值）
   */
  const generateCode = useCallback(async (groupId?: number, sourceType?: string, name?: string, forceUpdate: boolean = false) => {
    if (isEdit || !isAutoGenerateEnabled('master-data-material')) {
      return;
    }
    // 未选择物料分组时，将提示文字填入主编号（红色显示）
    if (!groupId) {
      const hint = t('app.master-data.materialForm.mainCodeSelectGroupHint');
      formRef.current?.setFieldsValue({ mainCode: hint });
      return;
    }

    const ruleCode = getPageRuleCode('master-data-material');
    if (!ruleCode) {
      console.warn(t('app.master-data.materialForm.codeRuleNotConfigured'));
      return;
    }
    
    if (ruleCode === 'PROCESS_ROUTE_CODE') {
      console.error('Error: Material page is using process route code rule! Check codeRulePageConfigs in localStorage.');
      messageApi.error(t('app.master-data.materialForm.codeRuleConfigError'));
      return;
    }

    // 构建上下文：仅末级分组编号（与 material.groupId 对应分组的 code 一致）
    const context: Record<string, any> = {};
    
    if (groupId != null && !(typeof groupId === 'string' && groupId === '')) {
      const group = localMaterialGroups.find(g => Number(g.id) === Number(groupId));
      if (group) {
        const leafCode = (group.code ?? '').toString().trim();
        context.leaf_group_code = leafCode;
        context.group_code = leafCode;
        context.group_code_path = leafCode;
        context.group_name = group.name;
      }
    }
    
    // 添加物料来源类型（如果有）
    if (sourceType) {
      context.source_type = sourceType;
    }
    
    // 添加物料名称（如果有）
    if (name) {
      context.name = name;
    }
    
    // 使用测试生成API预览编号（不更新序号，但会检测重复并自动递增）
    try {
      const codeResponse = await testGenerateCode({
        rule_code: ruleCode,
        context: Object.keys(context).length > 0 ? context : undefined,
        check_duplicate: true, // 启用重复检测
        entity_type: 'material', // 指定实体类型为物料
      });
      
      // 如果强制更新，或者字段为空，或者包含占位符，则更新编号
      const currentMainCode = formRef.current?.getFieldValue('mainCode');
      if (forceUpdate || !currentMainCode || currentMainCode.startsWith('[FIELD:') || currentMainCode === '') {
        formRef.current?.setFieldsValue({
          mainCode: codeResponse.code,
        });
        lastAutoGeneratedCodeRef.current = codeResponse.code;
      }
    } catch (error) {
      console.warn(t('app.master-data.materialForm.autoGenerateCodeFailed'), error);
    }
  }, [isEdit, localMaterialGroups, t]);

  /**
   * 当物料分组加载完成且已选择分组时，重新生成编号（确保 scope_fields 隔离计数生效）
   * 场景：用户在选择分组时 materialGroups 可能尚未加载，导致 context 缺少 group_code
   */
  useEffect(() => {
    if (isEdit || !isAutoGenerateEnabled('master-data-material') || localMaterialGroups.length === 0) return;
    const groupId = formRef.current?.getFieldValue('groupId');
    if (groupId == null || groupId === '') return;
    const group = localMaterialGroups.find(g => Number(g.id) === Number(groupId));
    if (group) {
      const sourceType = formRef.current?.getFieldValue('sourceType');
      const name = formRef.current?.getFieldValue('name');
      generateCode(groupId, sourceType, name, true);
    }
  }, [localMaterialGroups, isEdit, generateCode]);

  const handleMaterialGroupQuickCreateSuccess = useCallback(
    (created: MaterialGroup) => {
      setLocalMaterialGroups((prev) => {
        if (prev.some((g) => g.id === created.id)) return prev;
        return [...prev, created];
      });
      formRef.current?.setFieldsValue({ groupId: created.id });
      if (!isEdit && isAutoGenerateEnabled('master-data-material')) {
        const sourceType = formRef.current?.getFieldValue('sourceType');
        const name = formRef.current?.getFieldValue('name');
        void generateCode(created.id, sourceType, name, true);
      }
      onMaterialGroupsChange?.();
    },
    [generateCode, isEdit, onMaterialGroupsChange],
  );

  const handleProcessRouteQuickCreateSuccess = useCallback((created: ProcessRoute) => {
    setProcessRoutes((prev) => {
      if (prev.some((r) => r.uuid === created.uuid)) return prev;
      return [...prev, created];
    });
    const currentDefaults = formRef.current?.getFieldValue('defaults') ?? {};
    formRef.current?.setFieldsValue({
      defaults: { ...currentDefaults, defaultProcessRouteUuid: created.uuid },
      'defaults.defaultProcessRouteUuid': created.uuid,
    });
  }, []);

  const handleSupplierQuickCreateSuccess = useCallback((created: Supplier) => {
    setSuppliers((prev) => {
      if (prev.some((s) => s.id === created.id)) return prev;
      return [...prev, created];
    });
    const currentConfig = formRef.current?.getFieldValue('sourceConfig') ?? {};
    const field = supplierQuickCreateField;
    formRef.current?.setFieldsValue({
      sourceConfig: { ...currentConfig, [field]: created.id },
      [`sourceConfig.${field}`]: created.id,
    });
  }, [supplierQuickCreateField]);

  const handleOperationQuickCreateSuccess = useCallback((created: Operation) => {
    setOperations((prev) => {
      if (prev.some((o) => o.uuid === created.uuid)) return prev;
      return [...prev, created];
    });
    const uuid = created.uuid;
    if (!uuid) return;
    const currentConfig = formRef.current?.getFieldValue('sourceConfig') ?? {};
    formRef.current?.setFieldsValue({
      sourceConfig: { ...currentConfig, outsource_operation: uuid },
      'sourceConfig.outsource_operation': uuid,
    });
  }, []);

  /**
   * 初始化数据
   */
  useEffect(() => {
    if (open) {
      if (!isEdit) lastAutoGeneratedCodeRef.current = null;
      // 基础信息/来源标签页所需数据（打开时加载）
      loadSuppliers();
      loadProcessRoutes();
      loadOperations();

      // 如果是新建模式且启用了自动编号，生成编号
      if (!isEdit) {
        const initialSourceType = (initialValues as any)?.sourceType
          || getPrimarySourceType((initialValues as any)?.sourceTypes || []);
        generateCode(initialValues?.groupId, initialSourceType, initialValues?.name);
      }

      // 如果是编辑模式，加载物料数据
      if (isEdit && material) {
        // 从物料数据中加载编号映射和默认值
        // 兼容处理：后端可能返回 code_aliases 或 codeAliases
        const aliases = (material as any).code_aliases || material.codeAliases || [];
        
        if (aliases && aliases.length > 0) {
          // 分离不同类型的编号
          const deptCodes: DepartmentCodeMapping[] = [];
          const custCodes: CustomerCodeMapping[] = [];
          const suppCodes: SupplierCodeMapping[] = [];
          
          aliases.forEach((alias: any) => {
            // 兼容处理：后端可能返回 snake_case 或 camelCase
            const codeType = alias.code_type || alias.codeType;
            const externalEntityType = alias.external_entity_type || alias.externalEntityType;
            const externalEntityId = alias.external_entity_id || alias.externalEntityId;
            
            if (codeType === 'CUSTOMER' || externalEntityType === 'customer') {
              const rawCustomerId = externalEntityId ?? alias.customerId ?? alias.customer_id;
              const customerId =
                rawCustomerId != null && rawCustomerId !== '' ? Number(rawCustomerId) : undefined;
              custCodes.push({
                customerId: Number.isFinite(customerId) ? customerId! : 0,
                customerUuid: undefined,
                customerName: undefined,
                code: alias.code,
                name: alias.name,
                description: alias.description,
              });
            } else if (codeType === 'SUPPLIER' || externalEntityType === 'supplier') {
              const rawSupplierId = externalEntityId ?? alias.supplierId ?? alias.supplier_id;
              const supplierId =
                rawSupplierId != null && rawSupplierId !== '' ? Number(rawSupplierId) : undefined;
              suppCodes.push({
                supplierId: Number.isFinite(supplierId) ? supplierId! : 0,
                supplierUuid: undefined,
                supplierName: undefined,
                code: alias.code,
                name: alias.name,
                description: alias.description,
              });
            } else if (['SALE', 'DES', 'PUR', 'WH', 'PROD'].includes(codeType)) {
              deptCodes.push({
                code_type: codeType,
                code: alias.code,
                department: alias.department,
                description: alias.description,
              });
            }
          });
          
          setDepartmentCodes(deptCodes);
          setCustomerCodes(custCodes);
          setSupplierCodes(suppCodes);
        } else {
          setDepartmentCodes([]);
          setCustomerCodes([]);
          setSupplierCodes([]);
        }
        
        // 加载外部系统编号映射
        if (material.uuid) {
          loadExternalSystemCodes(material.uuid);
        }
        
        // 附件预填（图片用缩略 URL；PDF/DWG 仅展示文件名与图标，避免 picture-card 当作图片解码）
        const materialImagesRaw = (material as any).images || [];
        const attachmentUuids = materialImagesRaw
          .map((item: unknown) =>
            typeof item === 'string' ? item : (item as { uuid?: string; uid?: string })?.uuid ?? (item as { uid?: string })?.uid
          )
          .filter(Boolean) as string[];
        if (attachmentUuids.length > 0) {
          Promise.all(
            attachmentUuids.map(async (uuid: string) => {
              let name = t('app.master-data.materialForm.images');
              let ext = '';
              try {
                const meta = await getFileByUuid(uuid);
                name = meta.original_name || name;
                ext = materialAttachmentExtLower(meta.original_name || '');
                if (!ext && meta.file_extension) ext = String(meta.file_extension).toLowerCase();
              } catch {
                /* 元数据失败时仍尝试展示为附件 */
              }
              const showAsImage = isImageAttachmentExt(ext);
              if (showAsImage) {
                const { thumbUrl, url } = await buildImageUploadFileUrls(uuid);
                return {
                  uid: uuid,
                  name,
                  status: 'done' as const,
                  url,
                  thumbUrl,
                };
              }
              return {
                uid: uuid,
                name,
                status: 'done' as const,
              };
            })
          ).then((fileList) => {
            setTimeout(() => {
              formRef.current?.setFieldsValue({ images: fileList });
            }, 100);
          });
        }
        
        // 加载默认值（兼容处理：后端可能返回 snake_case 或 camelCase）
        // 将默认值转换为表单字段格式（对象数组转换为 ID 数组）
        const materialDefaults = (material as any).defaults;
        const routeId = (material as any).process_route_id ?? (material as any).processRouteId;
        const formDefaults: any = materialDefaults ? { ...materialDefaults } : {};
        
        if (materialDefaults) {
          // 将对象数组转换为 ID 数组
          if (materialDefaults.defaultSuppliers && Array.isArray(materialDefaults.defaultSuppliers)) {
            formDefaults.defaultSupplierIds = materialDefaults.defaultSuppliers.map((s: any) => s.supplierId || s.supplier_id);
          }
          if (materialDefaults.defaultCustomers && Array.isArray(materialDefaults.defaultCustomers)) {
            formDefaults.defaultCustomerIds = materialDefaults.defaultCustomers.map((c: any) => c.customerId || c.customer_id);
          }
          if (materialDefaults.defaultWarehouses && Array.isArray(materialDefaults.defaultWarehouses)) {
            formDefaults.defaultWarehouseIds = materialDefaults.defaultWarehouses.map((w: any) => w.warehouseId || w.warehouse_id);
          }
          delete formDefaults.defaultSuppliers;
          delete formDefaults.defaultCustomers;
          delete formDefaults.defaultWarehouses;
          delete formDefaults.defaultProcessRoute;
          if (
            formDefaults.defaultSalePrice != null &&
            formDefaults.defaultSalePrice !== '' &&
            (formDefaults.defaultSalePriceType == null || formDefaults.defaultSalePriceType === '')
          ) {
            formDefaults.defaultSalePriceType = 'tax_inclusive';
          }
          if (
            formDefaults.defaultPurchasePrice != null &&
            formDefaults.defaultPurchasePrice !== '' &&
            (formDefaults.defaultPurchasePriceType == null || formDefaults.defaultPurchasePriceType === '')
          ) {
            formDefaults.defaultPurchasePriceType = 'tax_inclusive';
          }
        }
        
        // 工艺路线回填由下方独立 useEffect（150ms 延后）在 processRoutes 加载完成后写入 defaultProcessRouteUuid，
        // 此处不再依赖 processRoutes，避免 processRoutes 入 deps 导致 effect 反复执行、循环调用 loadProcessRoutes
        if (routeId != null && processRoutes.length > 0) {
          const route = processRoutes.find((pr: { id: number }) => pr.id === routeId);
          if (route) formDefaults.defaultProcessRouteUuid = route.uuid;
        }
        
        if (Object.keys(formDefaults).length > 0) {
          setTimeout(() => {
            const fieldsToSet: any = { defaults: formDefaults };
            // ProForm 在 name 使用 "defaults.xxx" 时，需要同步写入扁平 key 才能稳定回显
            Object.keys(formDefaults).forEach((key) => {
              fieldsToSet[`defaults.${key}`] = formDefaults[key];
            });
            formRef.current?.setFieldsValue(fieldsToSet);
          }, 100);
        }
        
        // 加载物料来源数据（兼容处理：后端可能返回 snake_case 或 camelCase）
        const materialSourceType = (material as any).source_type || material.sourceType;
        const materialSourceConfig = (material as any).source_config || material.sourceConfig;
        const materialSourceTypes = normalizeSourceTypeValues(
          materialSourceType,
          materialSourceConfig,
        );
        const primaryMaterialSourceType = getPrimarySourceType(materialSourceTypes);
        
        if (materialSourceType || materialSourceConfig) {
          setTimeout(() => {
            // 关键修复：ProForm 的条件渲染字段使用扁平 key，需要同时设置嵌套对象和扁平 key
            const fieldsToSet: any = {
              sourceTypes: materialSourceTypes,
              sourceType: primaryMaterialSourceType,
              source_type: primaryMaterialSourceType, // 向后兼容
              sourceConfig: materialSourceConfig,
              source_config: materialSourceConfig, // 向后兼容
            };
            
            // 将 sourceConfig 的每个字段展开为扁平 key（如 sourceConfig.manufacturing_mode）
            if (materialSourceConfig && typeof materialSourceConfig === 'object') {
              Object.keys(materialSourceConfig).forEach(key => {
                let val = materialSourceConfig[key];
                if (key === 'bom_variants' && val != null && typeof val === 'object') {
                  val = JSON.stringify(val, null, 2);
                }
                fieldsToSet[`sourceConfig.${key}`] = val;
              });
            }
            
            formRef.current?.setFieldsValue(fieldsToSet);
          }, 100);
        }
      } else {
        // 新建模式，重置数据
        setDepartmentCodes([]);
        setCustomerCodes([]);
        setSupplierCodes([]);
      }
    }
    // 不将 processRoutes 放入 deps：processRoutes 更新会触发本 effect 重跑并再次调用 loadProcessRoutes，
    // 导致循环重新加载。工艺路线回填由下方独立 useEffect（依赖 processRoutes）在 150ms 后完成。
  }, [open, isEdit, material, generateCode, initialValues]);

  /** 编号映射、默认值标签页再加载客户/仓库，避免打开表单时并行拉取过多列表 */
  useEffect(() => {
    if (!open) return;
    if (activeTab === 'mapping' || activeTab === 'defaults') {
      if (!deferredCustomersLoadedRef.current) {
        deferredCustomersLoadedRef.current = true;
        loadCustomers();
      }
    }
    if (activeTab === 'defaults' && !deferredWarehousesLoadedRef.current) {
      deferredWarehousesLoadedRef.current = true;
      loadWarehouses();
    }
  }, [open, activeTab]);

  // 自定义字段数据回填与重置
  useEffect(() => {
    if (!open) {
      resetFieldValues();
      return;
    }
    if (isEdit && material?.id) {
      loadFieldValues(material.id).then((values) => {
        formRef.current?.setFieldsValue(values);
      });
    }
  }, [open, isEdit, material?.id, loadFieldValues, resetFieldValues]);

  /**
   * 编辑时：工艺路线列表加载完成后，用物料的 process_route_id 回填「默认工艺路线」
   * 延后 150ms 执行，避免被主 useEffect 中 100ms 的 defaults 设置覆盖
   * 关键：ProForm 的 name="defaults.defaultProcessRouteUuid" 需要同时设置扁平 key 才能正确显示
   */
  useEffect(() => {
    if (!isEdit || !material || processRoutes.length === 0) return;
    const routeId = (material as any).process_route_id ?? (material as any).processRouteId;
    if (routeId == null) return;
    const route = processRoutes.find(pr => pr.id === routeId);
    if (!route) return;
    const timer = setTimeout(() => {
      if (formRef.current) {
        const currentDefaults = formRef.current.getFieldValue('defaults') || {};
        if (currentDefaults.defaultProcessRouteUuid !== route.uuid) {
          // 同时设置嵌套对象和扁平 key，确保 ProFormSelect（name="defaults.defaultProcessRouteUuid"）能正确显示
          formRef.current.setFieldsValue({
            defaults: { ...currentDefaults, defaultProcessRouteUuid: route.uuid },
            'defaults.defaultProcessRouteUuid': route.uuid,
          });
        }
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [isEdit, material, processRoutes]);

  /**
   * 当客户列表加载完成后，更新客户编号映射中的名称
   */
  useEffect(() => {
    if (customers.length === 0 || customerCodes.length === 0) return;
    const updatedCodes = customerCodes.map((code) => {
      if (!code.customerId) return code;
      const customer = customers.find((c) => c.id === code.customerId);
      if (!customer) return code;
      return {
        ...code,
        customerUuid: customer.uuid,
        customerName: customer.name,
      };
    });
    const hasChanges = updatedCodes.some((code, index) => {
      const oldCode = customerCodes[index];
      return (
        !oldCode
        || code.customerName !== oldCode.customerName
        || code.customerUuid !== oldCode.customerUuid
      );
    });
    if (hasChanges) {
      setCustomerCodes(updatedCodes);
    }
  }, [customers, customerCodes]);
  
  /**
   * 当供应商列表加载完成后，更新供应商编号映射中的名称
   */
  useEffect(() => {
    if (suppliers.length === 0 || supplierCodes.length === 0) return;
    const updatedCodes = supplierCodes.map((code) => {
      if (!code.supplierId) return code;
      const supplier = suppliers.find((s) => s.id === code.supplierId);
      if (!supplier) return code;
      return {
        ...code,
        supplierUuid: supplier.uuid,
        supplierName: supplier.name,
      };
    });
    const hasChanges = updatedCodes.some((code, index) => {
      const oldCode = supplierCodes[index];
      return (
        !oldCode
        || code.supplierName !== oldCode.supplierName
        || code.supplierUuid !== oldCode.supplierUuid
      );
    });
    if (hasChanges) {
      setSupplierCodes(updatedCodes);
    }
  }, [suppliers, supplierCodes]);

  /**
   * 处理表单提交
   */
  const handleSubmit = async (values: any) => {
    try {
      if (customerCodes.some((code) => code.code?.trim() && !(code.customerId > 0))) {
        messageApi.error(t('app.master-data.codeMapping.selectCustomer'));
        throw new Error(t('app.master-data.codeMapping.selectCustomer'));
      }
      if (supplierCodes.some((code) => code.code?.trim() && !(code.supplierId > 0))) {
        messageApi.error(t('app.master-data.codeMapping.selectSupplier'));
        throw new Error(t('app.master-data.codeMapping.selectSupplier'));
      }
      // 处理物料来源数据（兼容处理：同时设置 camelCase 和 snake_case）
      const sourceTypes = normalizeSourceTypeValues(
        values.sourceType || values.source_type,
        { source_types: values.sourceTypes },
      );
      const sourceType = getPrimarySourceType(sourceTypes);
      const originalSourceType = (material as any)?.source_type || (material as any)?.sourceType;
      // 关键修复：仅当 sourceType 未改变时才合并 existingSourceConfig，避免不同类型字段混合
      const existingSourceConfig = (sourceType === originalSourceType) 
        ? ((material as any)?.source_config || (material as any)?.sourceConfig || {})
        : {};
      let formSourceConfig = values.sourceConfig || values.source_config || {};
      // 兼容 ProForm 扁平 key：从 values 中收集 sourceConfig.xxx 构建对象（条件渲染字段常只出现在扁平 key 中）
      if (Object.keys(formSourceConfig).length === 0 && typeof values === 'object') {
        const flat: Record<string, any> = {};
        for (const key of Object.keys(values)) {
          if (key === 'sourceConfig' || key === 'source_config') continue;
          if (key.startsWith('sourceConfig.') && values[key] !== undefined && values[key] !== '') {
            const subKey = key.slice('sourceConfig.'.length);
            flat[subKey] = values[key];
          }
        }
        if (Object.keys(flat).length > 0) formSourceConfig = flat;
      }
      if (Object.keys(formSourceConfig).length === 0 && formRef.current) {
        const directSourceConfig = formRef.current.getFieldValue('sourceConfig');
        if (directSourceConfig && Object.keys(directSourceConfig).length > 0) {
          formSourceConfig = directSourceConfig;
        }
      }
      
      const sourceConfig = { ...existingSourceConfig, ...formSourceConfig };
      
      // 关键修复：过滤掉不属于当前 sourceType 的字段（避免不同类型字段混合）
      const allowedFields = SOURCE_CONFIG_FIELDS[sourceType ?? ''] || [];
      const filteredSourceConfig: Record<string, any> = {};
      for (const key of Object.keys(sourceConfig)) {
        if (allowedFields.includes(key)) {
          let val = sourceConfig[key];
          if (key === 'bom_variants' && typeof val === 'string' && val.trim()) {
            try {
              val = JSON.parse(val);
            } catch {
              messageApi.warning(t('app.master-data.source.bomVariantsLabel') + ': JSON 格式无效');
            }
          }
          filteredSourceConfig[key] = val;
        }
      }
      // 同步多来源值（保留单值 source_type 作为主来源，不破坏现有业务链路）
      if (sourceTypes.length > 0) {
        filteredSourceConfig.source_types = sourceTypes;
      } else {
        delete filteredSourceConfig.source_types;
      }

      // 同步名称字段，便于后端与下游使用
      if (sourceConfig.default_supplier_id && suppliers.length > 0) {
        const supplier = suppliers.find(s => s.id === sourceConfig.default_supplier_id);
        if (supplier) sourceConfig.default_supplier_name = supplier.name;
      }
      if (sourceConfig.outsource_supplier_id && suppliers.length > 0) {
        const supplier = suppliers.find(s => s.id === sourceConfig.outsource_supplier_id);
        if (supplier) sourceConfig.outsource_supplier_name = supplier.name;
      }
      
      // 处理默认值数据转换（合并已有 defaults，避免只改物料来源时覆盖其他默认值）
      const allFormValues = formRef.current?.getFieldsValue?.(true) || {};
      const existingDefaults = (material as any)?.defaults || {};
      let formDefaultsRaw = values.defaults || {};
      // 兼容：若 values 中没有 defaults，尝试从 formRef 直接读取（处理条件渲染字段）
      if (Object.keys(formDefaultsRaw).length === 0 && formRef.current) {
        const directDefaults = formRef.current.getFieldValue('defaults');
        if (directDefaults && Object.keys(directDefaults).length > 0) {
          formDefaultsRaw = directDefaults;
        }
      }
      // 再兜底：有些场景下 defaults 仅存在于 getFieldsValue(true) 中
      if (Object.keys(formDefaultsRaw).length === 0 && allFormValues.defaults) {
        formDefaultsRaw = allFormValues.defaults;
      }
      // ProForm 在 name 使用 "defaults.xxx" 字符串时，可能返回扁平键（如 values["defaults.defaultTaxRate"]）
      // 统一回填到 defaults 对象，避免默认值在提交时被遗漏
      const extractFlatDefaults = (obj: Record<string, any>) =>
        Object.keys(obj).reduce((acc, key) => {
          if (key.startsWith('defaults.')) {
            const nestedKey = key.slice('defaults.'.length);
            acc[nestedKey] = obj[key];
          }
          return acc;
        }, {} as Record<string, any>);
      const flatDefaultsFromValues = {
        ...extractFlatDefaults(values as Record<string, any>),
        ...extractFlatDefaults(allFormValues as Record<string, any>),
      };
      // ProForm 可能用扁平 key 存储嵌套字段，兼容 values['defaults.defaultProcessRouteUuid']
      const formDefaults = {
        ...formDefaultsRaw,
        ...flatDefaultsFromValues,
        ...(values['defaults.defaultProcessRouteUuid'] !== undefined && { defaultProcessRouteUuid: values['defaults.defaultProcessRouteUuid'] }),
      };
      const processedDefaults: any = { ...existingDefaults, ...formDefaults };
      
      // 将 ID 数组转换为对象数组
      if (formDefaults.defaultSupplierIds && Array.isArray(formDefaults.defaultSupplierIds)) {
        processedDefaults.defaultSuppliers = formDefaults.defaultSupplierIds.map((id: number, index: number) => {
          const supplier = suppliers.find(s => s.id === id);
          return {
            supplierId: id,
            supplierUuid: supplier?.uuid,
            supplierName: supplier?.name,
            priority: index + 1,
          };
        });
        delete processedDefaults.defaultSupplierIds;
      }
      
      if (formDefaults.defaultCustomerIds && Array.isArray(formDefaults.defaultCustomerIds)) {
        processedDefaults.defaultCustomers = formDefaults.defaultCustomerIds.map((id: number) => {
          const customer = customers.find(c => c.id === id);
          return {
            customerId: id,
            customerUuid: customer?.uuid,
            customerName: customer?.name,
          };
        });
        delete processedDefaults.defaultCustomerIds;
      }
      
      if (formDefaults.defaultWarehouseIds && Array.isArray(formDefaults.defaultWarehouseIds)) {
        processedDefaults.defaultWarehouses = formDefaults.defaultWarehouseIds.map((id: number, index: number) => {
          const warehouse = warehouses.find(w => w.id === id);
          return {
            warehouseId: id,
            warehouseUuid: warehouse?.uuid,
            warehouseName: warehouse?.name,
            priority: index + 1,
          };
        });
        delete processedDefaults.defaultWarehouseIds;
      }
      
      // 处理默认工艺路线：写入 defaults 供展示，并准备 process_route_id 供后端物料表保存
      let processRouteIdForSubmit: number | null | undefined;
      const defaultProcessRouteUuid = formDefaults.defaultProcessRouteUuid;
      if (defaultProcessRouteUuid) {
        const route = processRoutes.find(pr => pr.uuid === defaultProcessRouteUuid);
        if (route) {
          processedDefaults.defaultProcessRoute = route.id;
          processedDefaults.defaultProcessRouteUuid = route.uuid;
          processRouteIdForSubmit = route.id;
        }
        // 路线列表未加载时仍保留 UUID in defaults，后端会从 defaults 同步 process_route_id
      } else if (sourceType === 'Make') {
        delete processedDefaults.defaultProcessRoute;
        delete processedDefaults.defaultProcessRouteUuid;
        processRouteIdForSubmit = null;
      }
      
      // 过滤空值
      const filteredDefaults: any = {};
      Object.keys(processedDefaults).forEach(key => {
        const value = processedDefaults[key];
        if (value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && value.length === 0)) {
          filteredDefaults[key] = value;
        }
      });
      
      // 处理图片上传结果
      const formImages = values.images || [];
      const imageUuids = formImages.map((file: any) => {
        const response = file.response;
        if (response) {
          if (Array.isArray(response) && response.length > 0) return response[0].uuid;
          if (response.uuid) return response.uuid;
        }
        return file.uid;
      });
      
      // 组装完整的数据，将驼峰命名转换为蛇形命名
      const { defaults: _defaults, ...restValues } = values;
      // 主编码契约（与 management 页约定：列表页不得再删 main_code）：
      // - 新建 + 本页启用自动编号 + 主编码无任何有效字符 → 不传 main_code，后端 generate_code；
      // - 否则传 trim 后的 main_code（预览/手填均视为明确指定）。
      const isAutoGen = !isEdit && isAutoGenerateEnabled('master-data-material');
      const trimmedMainCode = String(restValues.mainCode ?? '').trim();
      const omitMainCodeForRuleEngine = isAutoGen && !trimmedMainCode;
      const submitData: any = {
        // 基础字段转换（驼峰 -> 蛇形）
        main_code: omitMainCodeForRuleEngine ? undefined : trimmedMainCode || undefined,
        name: restValues.name,
        group_id: restValues.groupId,
        process_route_id:
          sourceType === 'Make'
            ? defaultProcessRouteUuid
              ? (processRouteIdForSubmit ??
                (material as any)?.process_route_id ??
                (material as any)?.processRouteId ??
                null)
              : null
            : ((material as any)?.process_route_id ?? (material as any)?.processRouteId),
        specification: restValues.specification,
        base_unit: restValues.baseUnit, // 关键：转换为 base_unit
        units: restValues.units,
        batch_managed: restValues.batchManaged,
        default_batch_rule_id: restValues.batchManaged
          ? (restValues.defaultBatchRuleId === SYSTEM_DEFAULT_RULE_VALUE || restValues.defaultBatchRuleId == null
            ? null
            : restValues.defaultBatchRuleId)
          : null,
        serial_managed: restValues.serialManaged,
        default_serial_rule_id: restValues.serialManaged
          ? (restValues.defaultSerialRuleId === SYSTEM_DEFAULT_RULE_VALUE || restValues.defaultSerialRuleId == null
            ? null
            : restValues.defaultSerialRuleId)
          : null,
        variant_managed: restValues.variantManaged,
        variant_attributes: (() => {
          if (!restValues.variantManaged) return undefined;
          if (isVariantSkuMaterial(material)) {
            const va = material?.variantAttributes ?? (material as any)?.variant_attributes;
            return va && typeof va === 'object' ? normalizeScalarAttrs(va as Record<string, unknown>) : null;
          }
          return null;
        })(),
        description: restValues.description,
        brand: restValues.brand,
        model: restValues.model,
        texture: restValues.texture,
        weight: restValues.weight ?? 0,
        volume: restValues.volume ?? 0,
        barcode: restValues.barcode?.trim() || undefined,
        shelf_life_managed: Boolean(restValues.shelfLifeManaged),
        shelf_life_days: restValues.shelfLifeManaged ? restValues.shelfLifeDays : null,
        reference_cost: restValues.referenceCost ?? undefined,
        country_of_origin: restValues.countryOfOrigin?.trim() || undefined,
        customs_code: restValues.customsCode?.trim() || undefined,
        is_active: restValues.isActive,
        images: imageUuids.length > 0 ? imageUuids : null,
        // 部门编号
        department_codes: departmentCodes.length > 0 ? departmentCodes.map(code => ({
          code_type: code.code_type,
          code: code.code,
          department: code.department,
          description: code.description,
        })) : undefined,
        // 客户编号
        customer_codes: customerCodes.length > 0
          ? customerCodes
              .filter((code) => code.customerId > 0)
              .map((code) => ({
                customer_id: code.customerId,
                code: code.code,
                name: code.name,
                description: code.description,
              }))
          : undefined,
        // 供应商编号
        supplier_codes: supplierCodes.length > 0
          ? supplierCodes
              .filter((code) => code.supplierId > 0)
              .map((code) => ({
                supplier_id: code.supplierId,
                code: code.code,
                name: code.name,
                description: code.description,
              }))
          : undefined,
        // 默认值
        defaults: Object.keys(filteredDefaults).length > 0 ? filteredDefaults : undefined,
        // 物料来源控制
        source_type: sourceType,
        source_config: filteredSourceConfig,
        // 质检选项（分场景 IQC/FQC/OQC + legacy 同步）
        inspection_stages: materialStagesToApiPayload(
          normalizeStagesInput(
            values.inspectionStages ||
              stagesFromLegacy(values.inspectionMode, values.defaultInspectionPlanId),
          ),
        ),
        ...(() => {
          const leg = legacyFromStages(
            normalizeStagesInput(
              values.inspectionStages ||
                stagesFromLegacy(values.inspectionMode, values.defaultInspectionPlanId),
            ),
          );
          return {
            inspection_mode: leg.inspectionMode,
            default_inspection_plan_id: leg.defaultInspectionPlanId ?? null,
          };
        })(),
        over_report_mode: values.overReportMode || 'none',
        over_report_value: values.overReportValue ?? 0,
      };
      
      // 移除 undefined 值
      Object.keys(submitData).forEach(key => {
        if (submitData[key] === undefined) {
          delete submitData[key];
        }
      });

      // extractFormValues 返回 { customData, standardValues }（与 PlantFormModal 等一致）；勿用不存在的 coreData
      const { customData: cfValues, standardValues: coreData } = extractFormValues(submitData);

      const result = await onFinish(coreData as any);

      if (
        !isEdit &&
        restValues.variantManaged &&
        pendingVariantRows.length > 0 &&
        result &&
        typeof result === 'object'
      ) {
        const created = await flushPendingVariantCombinations(result as Material, pendingVariantRows);
        if (created > 0) {
          messageApi.success(
            t('app.master-data.materials.variantCombosFlushed', {
              count: created,
              defaultValue: `已创建 ${created} 条属性组合`,
            }),
          );
          setPendingVariantRows([]);
        }
      }
      
      // 保存自定义字段值（API 要求 record_id 为数字主键，勿传 uuid）
      const recordIdForCustom =
        (result as any)?.id != null ? Number((result as any).id) : (material as any)?.id != null ? Number((material as any).id) : NaN;
      if (Number.isFinite(recordIdForCustom) && recordIdForCustom > 0) {
        await saveCustomFieldValues(recordIdForCustom, cfValues);
      }
      
      // 如果是新建模式，需要等待物料创建完成后再保存外部系统编号映射
      // 如果是编辑模式，外部系统编号映射已经在 CodeMappingTab 中单独管理
      // 这里不需要额外处理，因为外部系统编号映射是独立实体，有自己的API
      
      return result;
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.materialForm.submitFailed'));
      throw error;
    }
  };

  /**
   * 处理属性管理开关变化
   */
  const handleVariantManagedChange = (checked: boolean) => {
    setVariantManaged(checked);
    if (!checked) {
      setPendingVariantRows([]);
    }
  };

  return (
    <>
      <style>{`
        /* ==================== MaterialForm Modal 样式 - 完全重写（按 Ant Design 最佳实践） ==================== */
        /* 备份说明：原样式已移除，以下为按 Ant Design 最佳实践完全重写的样式 */
        
        /* Modal 内的 Tabs 内容区域 - 去除顶部多余 padding */
        .material-form-modal .ant-pro-form .ant-tabs-content-holder {
          padding-top: 0;
        }
        
        /* Modal 内 Tab 内容区：底部留白 16px；左右不设 padding，与模板 Modal 内容区对齐 */
        .material-form-modal .ant-pro-form .ant-tabs-tabpane {
          width: 100%;
          padding: 0 0 16px 0;
          box-sizing: border-box;
        }
        
        /* Modal 内的 Collapse - 确保占满宽度 */
        .material-form-modal .ant-collapse {
          width: 100%;
        }

        .material-form-modal .material-form-basic-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          column-gap: 16px;
          row-gap: 8px;
          width: 100%;
          box-sizing: border-box;
        }

        .material-form-modal .material-form-basic-grid__cell {
          min-width: 0;
        }

        .material-form-modal .material-form-basic-grid__cell--full {
          grid-column: 1 / -1;
        }

        .material-form-modal .material-form-more-collapse {
          width: 100%;
          margin: 4px 0 12px;
          background: rgba(0, 0, 0, 0.02);
          border: 1px solid rgba(0, 0, 0, 0.06);
          border-radius: 8px;
          overflow: hidden;
        }

        .material-form-modal .material-form-more-collapse > .ant-collapse-item {
          border: none !important;
        }

        .material-form-modal .material-form-more-collapse > .ant-collapse-item > .ant-collapse-header {
          padding: 10px 12px !important;
          align-items: center !important;
        }

        .material-form-modal .material-form-more-collapse .ant-collapse-content-box {
          padding: 4px 12px 12px !important;
        }
        
        /* 默认值设置Tab的Collapse - 增加底部margin */
        .material-form-modal .ant-tabs-tabpane .ant-collapse:not(.material-form-more-collapse) {
          margin-bottom: 16px;
        }
        
        /* Modal 内的 Table - 确保占满宽度 */
        .material-form-modal .ant-table-wrapper {
          width: 100%;
        }
        
        /* Modal 内的 Alert - 确保间距合理 */
        .material-form-modal .ant-alert {
          margin-bottom: 16px;
        }
        .material-form-modal .ant-alert:last-child {
          margin-bottom: 0;
        }
        .ant-tabs-nav {
          margin: 0 8px 16px 8px !important;
        }
      `}</style>
      <FormModalTemplate
        className="material-form-modal"
        title={isEdit ? t('app.master-data.materialForm.editMaterial') : t('app.master-data.materialForm.createMaterial')}
        open={open}
        onClose={onClose}
        onFinish={handleSubmit}
        isEdit={isEdit}
        loading={loading}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
        initialValues={(() => {
          let vals = !isEdit && !(initialValues?.baseUnit != null && initialValues?.baseUnit !== '')
            ? { ...initialValues, baseUnit: DEFAULT_MATERIAL_BASE_UNIT }
            : initialValues;
          const normalizedSourceTypes = normalizeSourceTypeValues(
            (vals as any)?.sourceType,
            { source_types: (vals as any)?.sourceTypes },
          );
          const primarySourceType = getPrimarySourceType(normalizedSourceTypes);
          if (normalizedSourceTypes.length > 0) {
            vals = {
              ...(vals as any),
              sourceTypes: normalizedSourceTypes,
              sourceType: primarySourceType,
            } as any;
          }
          // 新建模式：根据来源类型设置默认税率（服务6%，其他13%）
          if (!isEdit && primarySourceType != null && vals?.defaults?.defaultTaxRate == null) {
            vals = {
              ...vals,
              defaults: { ...vals?.defaults, defaultTaxRate: primarySourceType === 'Service' ? 6 : 13 },
            };
          }
          return vals;
        })()}
        layout="vertical"
        grid={false}
        onValuesChange={(changedValues, allValues) => {
          if (!isEdit && isAutoGenerateEnabled('master-data-material')) {
            const groupId = allValues.groupId;
            const sourceType = allValues.sourceType || getPrimarySourceType(allValues.sourceTypes || []);
            const name = allValues.name;
            if (changedValues.groupId !== undefined) {
              // 切换分组时立即刷新编号预览，显示该分组对应的流水号
              generateCode(groupId, sourceType, name, true);
            } else if (
              changedValues.sourceType !== undefined
              || changedValues.sourceTypes !== undefined
              || changedValues.name !== undefined
            ) {
              generateCode(groupId, sourceType, name, false);
            }
          }
        }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          destroyInactiveTabPane
          items={[
            {
              key: 'basic',
              label: t('app.master-data.materialForm.basicInfo'),
              children: (
                <>
                  <BasicInfoTab
                    part={1}
                    formRef={formRef}
                    materialGroups={localMaterialGroups}
                    isEdit={isEdit}
                    suspendedModalReturnPath={suspendedModalReturnPath}
                    customFields={customFields}
                    customFieldValues={customFieldValues}
                    variantManaged={variantManaged}
                    onVariantManagedChange={handleVariantManagedChange}
                    onQuickAddMaterialGroup={() => setGroupFormModalOpen(true)}
                  />

                  <MaterialSourceTab
                    formRef={formRef}
                    material={material}
                    suppliers={suppliers}
                    processRoutes={processRoutes}
                    operations={operations}
                    suppliersLoading={suppliersLoading}
                    processRoutesLoading={processRoutesLoading}
                    operationsLoading={operationsLoading}
                    sourceTypeOptions={sourceTypeOptions}
                    suspendedModalReturnPath={suspendedModalReturnPath}
                    materialUuid={isEdit && material ? material.uuid : undefined}
                    onQuickAddProcessRoute={() => setRouteFormModalOpen(true)}
                    onQuickAddSupplier={() => {
                      setSupplierQuickCreateField('default_supplier_id');
                      setSupplierFormModalOpen(true);
                    }}
                    onQuickAddOutsourceSupplier={() => {
                      setSupplierQuickCreateField('outsource_supplier_id');
                      setSupplierFormModalOpen(true);
                    }}
                    onQuickAddOperation={() => setOperationFormModalOpen(true)}
                  />
                  <BasicInfoTab 
                    part={2} 
                    formRef={formRef} 
                    materialGroups={[]} 
                    variantManaged={variantManaged} 
                    onVariantManagedChange={handleVariantManagedChange} 
                    isEdit={isEdit} 
                    suspendedModalReturnPath={suspendedModalReturnPath}
                    customFields={[]}
                    customFieldValues={{}}
                  />
                </>
              ),
            },
            {
              key: 'variant',
              label: t('app.master-data.materialForm.variantManagement'),
              disabled: !variantManaged,
              children: (
                <MaterialVariantCombinationsTable
                  material={material}
                  variantManaged={variantManaged}
                  isEdit={isEdit}
                  pendingRows={pendingVariantRows}
                  onPendingRowsChange={setPendingVariantRows}
                />
              ),
            },
            {
              key: 'units',
              label: t('app.master-data.materialForm.multiUnit'),
              children: (
                <MaterialUnitsManager />
              ),
            },
            {
              key: 'mapping',
              label: t('app.master-data.materialForm.codeMapping'),
              children: (
                <CodeMappingTab
                  departmentCodes={departmentCodes}
                  customerCodes={customerCodes}
                  supplierCodes={supplierCodes}
                  externalSystemCodes={externalSystemCodes}
                  externalSystemCodesLoading={externalSystemCodesLoading}
                  materialUuid={isEdit && material ? material.uuid : undefined}
                  onExternalSystemCodesChange={setExternalSystemCodes}
                  onReloadExternalSystemCodes={material?.uuid ? () => loadExternalSystemCodes(material.uuid) : undefined}
                  customers={customers}
                  suppliers={suppliers}
                  customersLoading={customersLoading}
                  suppliersLoading={suppliersLoading}
                  onDepartmentCodesChange={setDepartmentCodes}
                  onCustomerCodesChange={setCustomerCodes}
                  onSupplierCodesChange={setSupplierCodes}
                />
              ),
            },
            {
              key: 'inspection',
              label: t('app.master-data.materialForm.inspection'),
              children: (
                <MaterialInspectionTab
                  formRef={formRef}
                  material={material}
                  isEdit={isEdit}
                  suspendedModalReturnPath={suspendedModalReturnPath}
                />
              ),
            },
            {
              key: 'defaults',
              label: t('app.master-data.materialForm.defaults'),
              children: (
                <DefaultsTab
                  customers={customers}
                  suppliers={suppliers}
                  warehouses={warehouses}
                  customersLoading={customersLoading}
                  suppliersLoading={suppliersLoading}
                  warehousesLoading={warehousesLoading}
                />
              ),
            },
          ]}
        />
      </FormModalTemplate>
      {groupFormModalOpen ? (
      <MaterialGroupFormModal
        open
        onClose={() => setGroupFormModalOpen(false)}
        onSuccess={handleMaterialGroupQuickCreateSuccess}
        materialGroups={localMaterialGroups}
        zIndex={token.zIndexPopupBase + MODAL_NESTED_ABOVE_PARENT_OFFSET}
      />
      ) : null}
      {routeFormModalOpen ? (
      <RouteFormModal
        open
        onClose={() => setRouteFormModalOpen(false)}
        editUuid={null}
        onSuccess={handleProcessRouteQuickCreateSuccess}
        zIndex={token.zIndexPopupBase + MODAL_NESTED_ABOVE_PARENT_OFFSET}
      />
      ) : null}
      {supplierFormModalOpen ? (
      <SupplierFormModal
        open
        onClose={() => setSupplierFormModalOpen(false)}
        editUuid={null}
        onSuccess={handleSupplierQuickCreateSuccess}
        zIndex={token.zIndexPopupBase + MODAL_NESTED_ABOVE_PARENT_OFFSET}
      />
      ) : null}
      {operationFormModalOpen ? (
      <OperationFormModal
        open
        onClose={() => setOperationFormModalOpen(false)}
        editUuid={null}
        onSuccess={handleOperationQuickCreateSuccess}
        zIndex={token.zIndexPopupBase + MODAL_NESTED_ABOVE_PARENT_OFFSET}
      />
      ) : null}
    </>
  );
};

/**
 * 物料质检选项标签页
 */
interface MaterialInspectionTabProps {
  formRef: any;
  material?: Material;
  isEdit: boolean;
  suspendedModalReturnPath?: string;
}

interface BasicInfoTabProps {
  part: 1 | 2;
  formRef: any;
  materialGroups: MaterialGroup[];
  isEdit: boolean;
  suspendedModalReturnPath?: string;
  customFields?: CustomField[];
  customFieldValues?: Record<string, any>;
  variantManaged?: boolean;
  onVariantManagedChange?: (checked: boolean) => void;
  onQuickAddMaterialGroup?: () => void;
}

const MaterialInspectionTab: React.FC<MaterialInspectionTabProps> = () => {
  const { t } = useTranslation();

  return (
    <div style={{ padding: '0 0 16px 0' }}>
      <QualityMasterDataHint scope="material" />
      <ProFormItem
        name="inspectionStages"
        label={t('app.master-data.materialForm.inspectionStagesTitle')}
      >
        <InspectionStagesEditor scope="material" />
      </ProFormItem>
      <ProFormItem name="inspectionMode" hidden />
      <ProFormItem name="defaultInspectionPlanId" hidden />
      <ProFormSelect
        name="overReportMode"
        label={t('field.operation.overReportMode')}
        options={[
          { label: t('field.operation.overReportModeNone'), value: 'none' },
          { label: t('field.operation.overReportModeFixed'), value: 'fixed' },
          { label: t('field.operation.overReportModePercent'), value: 'percent' },
        ]}
        fieldProps={{ style: { width: 280 } }}
      />
      <ProFormDigit
        name="overReportValue"
        label={t('field.operation.overReportValue')}
        min={0}
        fieldProps={{ precision: 4, style: { width: 280 } }}
        extra={t('field.operation.overReportValueExtra')}
      />
    </div>
  );
};

/**
 * 多单位管理组件（须在 ProForm 内渲染，通过 Form 上下文订阅字段）
 */
const MaterialUnitsManager: React.FC = () => {
  const { t } = useTranslation();
  const form = Form.useFormInstance();
  const [units, setUnits] = useState<MaterialUnit[]>([]);
  const [scenarios, setScenarios] = useState<{
    purchase?: string;
    sale?: string;
    production?: string;
    inventory?: string;
  }>({});
  const [baseUnit, setBaseUnit] = useState<string>('');
  const [unitOptions, setUnitOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [unitValueToLabel, setUnitValueToLabel] = useState<Record<string, string>>({});

  // 加载数据字典单位选项
  useEffect(() => {
    const loadUnitOptions = async () => {
      try {
        setLoadingUnits(true);
        const dictionary = await getDataDictionaryByCode('MATERIAL_UNIT');
        const items = await getDictionaryItemList(dictionary.uuid, true);
        const options = items
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(item => ({
            label: item.label,
            value: item.value,
          }));
        setUnitOptions(options);
        
        // 创建value到label的映射
        const valueToLabelMap: Record<string, string> = {};
        items.forEach(item => {
          valueToLabelMap[item.value] = item.label;
        });
        setUnitValueToLabel(valueToLabelMap);
      } catch (error: any) {
        console.error('加载单位选项失败:', error);
      } finally {
        setLoadingUnits(false);
      }
    };

    loadUnitOptions();
  }, []);

  // 订阅表单字段变化（须用 Form 上下文实例，formRef.current 在 Modal 重建时可能为 null）
  const watchedUnits = Form.useWatch('units', form);
  const watchedBaseUnit = Form.useWatch('baseUnit', form);

  useEffect(() => {
    if (watchedUnits && (watchedUnits.units || watchedUnits.scenarios)) {
      setUnits(watchedUnits.units || []);
      setScenarios(watchedUnits.scenarios || {});
    } else if (watchedUnits == null) {
      setUnits([]);
      setScenarios({});
    }
  }, [watchedUnits]);

  useEffect(() => {
    if (watchedBaseUnit && watchedBaseUnit !== baseUnit) {
      setBaseUnit(watchedBaseUnit);
    }
  }, [watchedBaseUnit, baseUnit]);

  // 添加辅助单位
  const handleAddUnit = () => {
    const newUnit: MaterialUnit = {
      unit: '',
      numerator: 1,
      denominator: 1,
      scenarios: [],
    };
    setUnits([...units, newUnit]);
  };

  // 删除辅助单位
  const handleDeleteUnit = (index: number) => {
    const newUnits = units.filter((_, i) => i !== index);
    setUnits(newUnits);
    updateFormValue(newUnits, scenarios);
  };

  // 更新单位信息
  const handleUnitChange = (index: number, field: keyof MaterialUnit, value: any) => {
    const newUnits = [...units];
    newUnits[index] = { ...newUnits[index], [field]: value };
    setUnits(newUnits);
    updateFormValue(newUnits, scenarios);
  };

  // 更新场景映射
  const handleScenarioChange = (scenario: string, unit: string) => {
    const newScenarios = { ...scenarios, [scenario]: unit };
    setScenarios(newScenarios);
    updateFormValue(units, newScenarios);
  };

  // 更新表单值
  const updateFormValue = (newUnits: MaterialUnit[], newScenarios: typeof scenarios) => {
    form.setFieldsValue({
      units: {
        units: newUnits,
        scenarios: newScenarios,
      },
    });
  };

  // 所有可用单位（基础单位 + 辅助单位），用于场景单位映射
  const allUnits = baseUnit ? [baseUnit, ...units.map(u => u.unit).filter(Boolean)] : [];

  const columns = [
    {
      title: t('app.master-data.materialForm.unitName'),
      dataIndex: 'unit',
      render: (_: any, record: MaterialUnit, index: number) => (
        <Select
          value={record.unit}
          placeholder={t('app.master-data.materialForm.unitPlaceholder')}
          onChange={(value: string) => handleUnitChange(index, 'unit', value)}
          style={{ width: '100%' }}
          showSearch
          allowClear
          loading={loadingUnits}
          options={unitOptions}
          filterOption={(input, option) =>
            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
        />
      ),
    },
    {
      title: t('app.master-data.materialForm.conversionRelation'),
      dataIndex: 'conversion',
      render: (_: any, record: MaterialUnit, index: number) => {
        const numerator = record.numerator || 1;
        const denominator = record.denominator || 1;
        const conversionRate = numerator / denominator;
        const isInteger = Number.isInteger(conversionRate);
        
        return (
          <div>
            <Input.Group compact style={{ marginBottom: 4 }}>
              <Input
                style={{ width: '28%' }}
                type="number"
                value={numerator}
                placeholder={t('app.master-data.materialForm.numerator')}
                onChange={(e) => {
                  const num = parseInt(e.target.value) || 1;
                  handleUnitChange(index, 'numerator', num);
                }}
                min={1}
                step={1}
              />
              <span style={{ width: '8%', display: 'inline-block', lineHeight: '32px', textAlign: 'center', background: '#f5f5f5' }}>
                /
              </span>
              <Input
                style={{ width: '28%' }}
                type="number"
                value={denominator}
                placeholder={t('app.master-data.materialForm.denominator')}
                onChange={(e) => {
                  const den = parseInt(e.target.value) || 1;
                  handleUnitChange(index, 'denominator', den);
                }}
                min={1}
                step={1}
              />
              <span style={{ width: '36%', display: 'inline-block', lineHeight: '32px', textAlign: 'center', background: '#f5f5f5', fontSize: '12px' }}>
                {baseUnit ? ` = ${isInteger ? conversionRate : `${numerator}/${denominator}`} ${unitValueToLabel[baseUnit] || baseUnit}` : ''}
              </span>
            </Input.Group>
          </div>
        );
      },
    },
    {
      title: t('app.master-data.materialForm.useScenario'),
      dataIndex: 'scenarios',
      render: (_: any, record: MaterialUnit, index: number) => (
        <Select
          mode="multiple"
          value={record.scenarios || []}
          onChange={(value: string[]) => handleUnitChange(index, 'scenarios', value)}
          placeholder={t('app.master-data.materialForm.useScenarioPlaceholder')}
          style={{ width: '100%' }}
          options={[
            { label: t('app.master-data.materialForm.purchase'), value: 'purchase' },
            { label: t('app.master-data.materialForm.sale'), value: 'sale' },
            { label: t('app.master-data.materialForm.production'), value: 'production' },
            { label: t('app.master-data.materialForm.inventory'), value: 'inventory' },
          ]}
        />
      ),
    },
    {
      title: t('app.master-data.materialForm.action'),
      render: (_: any, __: MaterialUnit, index: number) => (
        <Button
          type="link"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDeleteUnit(index)}
        >
          {t('app.master-data.materialForm.delete')}
        </Button>
      ),
    },
  ];

  return (
    <div style={{ width: '100%', display: 'block', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontWeight: 500 }}>{t('app.master-data.materialForm.multiUnit')}</div>
        {baseUnit && (
          <div style={{ 
            padding: '4px 12px', 
            background: '#e6f7ff', 
            borderRadius: '4px', 
            border: '1px solid #91d5ff',
            fontSize: '12px',
            color: '#1890ff'
          }}>
            {t('app.master-data.materialForm.baseUnitColon')}<strong>{unitValueToLabel[baseUnit] || baseUnit}</strong>
          </div>
        )}
      </div>
      <Table
        columns={columns}
        dataSource={units}
        rowKey={(_, index) => `unit-${index}`}
        pagination={false}
        size="small"
        style={{ width: '100%' }}
        footer={() => (
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={handleAddUnit}
            block
          >
            {t('app.master-data.materialForm.addAuxiliaryUnit')}
          </Button>
        )}
      />
      {units.length > 0 && allUnits.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('app.master-data.materialForm.scenarioUnitMappingOptional')}</div>
          <div style={{ marginBottom: 8, color: '#666', fontSize: 12 }}>
            {t('app.master-data.materialForm.scenarioUnitMappingHint')}
          </div>
          <Row gutter={16}>
            <Col span={6}>
              <div style={{ marginBottom: 8 }}>{t('app.master-data.materialForm.purchaseUnit')}</div>
              <Select
                value={scenarios.purchase}
                onChange={(value: string) => handleScenarioChange('purchase', value)}
                placeholder={t('app.master-data.materialForm.selectPurchaseUnit')}
                allowClear
                style={{ width: '100%' }}
                showSearch
                loading={loadingUnits}
                options={unitOptions.filter((opt: { label: string; value: string }) => allUnits.includes(opt.value))}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
            </Col>
            <Col span={6}>
              <div style={{ marginBottom: 8 }}>{t('app.master-data.materialForm.saleUnit')}</div>
              <Select
                value={scenarios.sale}
                onChange={(value: string) => handleScenarioChange('sale', value)}
                placeholder={t('app.master-data.materialForm.selectSaleUnit')}
                allowClear
                style={{ width: '100%' }}
                showSearch
                loading={loadingUnits}
                options={unitOptions.filter((opt: { label: string; value: string }) => allUnits.includes(opt.value))}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
            </Col>
            <Col span={6}>
              <div style={{ marginBottom: 8 }}>{t('app.master-data.materialForm.productionUnit')}</div>
              <Select
                value={scenarios.production}
                onChange={(value: string) => handleScenarioChange('production', value)}
                placeholder={t('app.master-data.materialForm.selectProductionUnit')}
                allowClear
                style={{ width: '100%' }}
                showSearch
                loading={loadingUnits}
                options={unitOptions.filter((opt: { label: string; value: string }) => allUnits.includes(opt.value))}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
            </Col>
            <Col span={6}>
              <div style={{ marginBottom: 8 }}>{t('app.master-data.materialForm.inventoryUnit')}</div>
              <Input
                value={baseUnit ? (unitValueToLabel[baseUnit] || baseUnit) : ''}
                disabled
                placeholder={t('app.master-data.materialForm.baseUnitLabel')}
              />
            </Col>
          </Row>
        </div>
      )}
    </div>
  );
};

/**
 * 基本信息标签页（按字段作用分两段：part1 标识与分类，part2 管理开关与描述；中间为物料来源）
 */
const BasicInfoTab: React.FC<BasicInfoTabProps> = ({
  part,
  formRef,
  materialGroups,
  isEdit,
  suspendedModalReturnPath,
  customFields = [],
  customFieldValues = {},
  variantManaged,
  onVariantManagedChange,
  onQuickAddMaterialGroup,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const [batchRules, setBatchRules] = useState<{ id: number; name: string; code: string }[]>([]);
  const [serialRules, setSerialRules] = useState<{ id: number; name: string; code: string }[]>([]);

  const handleGotoBatchRules = () => {
    if (suspendedModalReturnPath) {
      const values = formRef?.current?.getFieldsValue?.() ?? {};
      saveSuspendedModal(suspendedModalReturnPath, values);
    }
    navigate('/apps/master-data/materials/batch-rules');
  };

  const handleGotoSerialRules = () => {
    if (suspendedModalReturnPath) {
      const values = formRef?.current?.getFieldsValue?.() ?? {};
      saveSuspendedModal(suspendedModalReturnPath, values);
    }
    navigate('/apps/master-data/materials/serial-rules');
  };

  useEffect(() => {
    const loadRules = async () => {
      try {
        const [batchRes, serialRes] = await Promise.all([
          batchRuleApi.list({ pageSize: 200, isActive: true }),
          serialRuleApi.list({ pageSize: 200, isActive: true }),
        ]);
        setBatchRules(batchRes.items.map((r) => ({ id: r.id, name: r.name, code: r.code })));
        setSerialRules(serialRes.items.map((r) => ({ id: r.id, name: r.name, code: r.code })));
      } catch {
        // ignore
      }
    };
    loadRules();
  }, []);

  const groupId = ProForm.useWatch('groupId');
  const shelfLifeManaged = ProForm.useWatch('shelfLifeManaged');

  if (part === 1) {
    const moreFieldsPanel = (
      <Panel
        key="extended"
        header={
          <Space size={8} wrap>
            <span>{t('app.master-data.materialForm.viewMoreFields')}</span>
            <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
              {t('app.master-data.materialForm.viewMoreFieldsHint')}
            </Typography.Text>
          </Space>
        }
      >
        <div className="material-form-basic-grid">
          <div className="material-form-basic-grid__cell">
            <ProFormDigit
              name="weight"
              label={t('app.master-data.materialForm.weight')}
              placeholder={t('app.master-data.materialForm.weightPlaceholder')}
              min={0}
              fieldProps={{ precision: 4 }}
            />
          </div>
          <div className="material-form-basic-grid__cell">
            <ProFormDigit
              name="volume"
              label={t('app.master-data.materialForm.volume')}
              placeholder={t('app.master-data.materialForm.volumePlaceholder')}
              min={0}
              fieldProps={{ precision: 4 }}
            />
          </div>
          <div className="material-form-basic-grid__cell">
            <ProFormText
              name="barcode"
              label={t('app.master-data.materialForm.barcode')}
              placeholder={t('app.master-data.materialForm.barcodePlaceholder')}
              rules={[{ max: 100, message: t('app.master-data.materialForm.barcodeMax') }]}
            />
          </div>
          <div className="material-form-basic-grid__cell">
            <ProFormDigit
              name="referenceCost"
              label={t('app.master-data.materialForm.referenceCost')}
              placeholder={t('app.master-data.materialForm.referenceCostPlaceholder')}
              min={0}
              fieldProps={{ precision: 4 }}
            />
          </div>
          <div className="material-form-basic-grid__cell">
            <ProFormText
              name="countryOfOrigin"
              label={t('app.master-data.materialForm.countryOfOrigin')}
              placeholder={t('app.master-data.materialForm.countryOfOriginPlaceholder')}
              rules={[{ max: 100, message: t('app.master-data.materialForm.textureMax') }]}
            />
          </div>
          <div className="material-form-basic-grid__cell">
            <ProFormText
              name="customsCode"
              label={t('app.master-data.materialForm.customsCode')}
              placeholder={t('app.master-data.materialForm.customsCodePlaceholder')}
              rules={[{ max: 50, message: t('app.master-data.materialForm.barcodeMax') }]}
            />
          </div>
          <div className="material-form-basic-grid__cell">
            <ProFormSwitch
              name="shelfLifeManaged"
              label={t('app.master-data.materialForm.shelfLifeManaged')}
            />
          </div>
          {shelfLifeManaged ? (
            <div className="material-form-basic-grid__cell">
              <ProFormDigit
                name="shelfLifeDays"
                label={t('app.master-data.materialForm.shelfLifeDays')}
                placeholder={t('app.master-data.materialForm.shelfLifeDaysPlaceholder')}
                min={1}
                fieldProps={{ precision: 0 }}
                rules={[
                  {
                    required: true,
                    message: t('app.master-data.materialForm.shelfLifeDaysRequired'),
                  },
                ]}
              />
            </div>
          ) : null}
        </div>
      </Panel>
    );

    return (
      <>
      <div className="material-form-basic-grid">
        <div className="material-form-basic-grid__cell">
          <ProFormText
            name="mainCode"
            label={t('app.master-data.materialForm.mainCode')}
            placeholder={isAutoGenerateEnabled('master-data-material') ? t('app.master-data.materialForm.mainCodeAuto') : t('app.master-data.materialForm.mainCodePlaceholder')}
            rules={[
              { required: true, message: t('app.master-data.materialForm.mainCodeRequired') },
              { max: 50, message: t('app.master-data.materialForm.mainCodeMax') },
              {
                validator: (_, value) => {
                  if (value === t('app.master-data.materialForm.mainCodeSelectGroupHint')) {
                    return Promise.reject(new Error(t('app.master-data.materialForm.mainCodeSelectGroupHint')));
                  }
                  return Promise.resolve();
                },
              },
            ]}
            fieldProps={{
              style: !groupId ? { color: 'red' } : { textTransform: 'uppercase' },
            }}
          />
        </div>
        <div className="material-form-basic-grid__cell">
          <ProFormText
            name="name"
            label={t('app.master-data.materialForm.materialName')}
            placeholder={t('app.master-data.materialForm.materialNamePlaceholder')}
            rules={[
              { required: true, message: t('app.master-data.materialForm.materialNameRequired') },
              { max: 200, message: t('app.master-data.materialForm.materialNameMax') },
            ]}
          />
        </div>
        <div className="material-form-basic-grid__cell">
          <ProFormItem
            name="groupId"
            label={t('app.master-data.materialForm.materialGroup')}
          >
            <UniDropdown
              placeholder={t('app.master-data.materialForm.materialGroupPlaceholder')}
              options={materialGroups.map((g) => ({
                label: formatMaterialGroupLabel(g),
                value: g.id,
              }))}
              showSearch
              allowClear
              style={{ width: '100%' }}
              optionFilterProp="label"
              quickCreate={
                onQuickAddMaterialGroup
                  ? {
                      label: t('app.master-data.materialForm.quickAddMaterialGroup'),
                      onClick: () => onQuickAddMaterialGroup(),
                    }
                  : undefined
              }
            />
          </ProFormItem>
        </div>
        <div className="material-form-basic-grid__cell">
          <DictionarySelect
            dictionaryCode="MATERIAL_UNIT"
            name="baseUnit"
            label={t('app.master-data.materialForm.baseUnit')}
            placeholder={t('app.master-data.materialForm.baseUnitPlaceholder')}
            required
            formRef={formRef}
            valueEqualsLabel
          />
        </div>
        <div className="material-form-basic-grid__cell">
          <ProFormText
            name="specification"
            label={t('app.master-data.materialForm.specification')}
            placeholder={t('app.master-data.materialForm.specificationPlaceholder')}
            rules={[{ max: 500, message: t('app.master-data.materialForm.specificationMax') }]}
          />
        </div>
        <div className="material-form-basic-grid__cell">
          <ProFormText
            name="model"
            label={t('app.master-data.materialForm.model')}
            placeholder={t('app.master-data.materialForm.modelPlaceholder')}
            rules={[{ max: 100, message: t('app.master-data.materialForm.modelMax') }]}
          />
        </div>
        <div className="material-form-basic-grid__cell">
          <ProFormText
            name="brand"
            label={t('app.master-data.materialForm.brand')}
            placeholder={t('app.master-data.materialForm.brandPlaceholder')}
            rules={[{ max: 100, message: t('app.master-data.materialForm.brandMax') }]}
          />
        </div>
        <div className="material-form-basic-grid__cell">
          <ProFormText
            name="texture"
            label={t('app.master-data.materialForm.texture')}
            placeholder={t('app.master-data.materialForm.texturePlaceholder')}
            rules={[{ max: 100, message: t('app.master-data.materialForm.textureMax') }]}
          />
        </div>
      </div>
      <CustomFieldsFormSection
        customFields={customFields}
        customFieldValues={customFieldValues}
        gridColumns={4}
      />
      <Collapse
        bordered={false}
        defaultActiveKey={[]}
        className="material-form-more-collapse"
        expandIconPosition="start"
      >
        {moreFieldsPanel}
      </Collapse>
      </>
    );
  }

  return (
    <>
    <div className="material-form-basic-grid">
      <div className="material-form-basic-grid__cell">
        <ProFormSwitch name="batchManaged" label={t('app.master-data.materialForm.batchManaged')} />
      </div>
      <div className="material-form-basic-grid__cell">
        <ProFormSwitch name="serialManaged" label={t('app.master-data.materialForm.serialManaged')} />
      </div>
      <div className="material-form-basic-grid__cell">
        <ProFormSwitch
          name="variantManaged"
          label={t('app.master-data.materialForm.variantManaged')}
          fieldProps={{ onChange: onVariantManagedChange }}
        />
      </div>
      <div className="material-form-basic-grid__cell">
        <ProFormSwitch name="isActive" label={t('app.master-data.materialForm.isActive')} />
      </div>
    </div>
    <Row gutter={16} style={{ width: '100%' }}>
      <ProFormDependency name={['batchManaged']}>
        {({ batchManaged }) =>
          batchManaged ? (
            <Col span={12}>
              <ProFormSelect
                name="defaultBatchRuleId"
                label={
                  <Space>
                    <span>{t('app.master-data.materialForm.defaultBatchRule')}</span>
                    <Button
                      type="link"
                      size="small"
                      icon={<LinkOutlined />}
                      onClick={handleGotoBatchRules}
                      title={t('app.master-data.materialForm.gotoBatchRules')}
                      style={{ padding: 0, height: 'auto' }}
                    >
                      {t('app.master-data.materialForm.createRule')}
                    </Button>
                  </Space>
                }
                placeholder={t('app.master-data.materialForm.defaultBatchRulePlaceholder')}
                options={[
                  { label: t('app.master-data.materialForm.systemDefaultRule'), value: SYSTEM_DEFAULT_RULE_VALUE },
                  ...batchRules.map((r) => ({ label: `${r.name} (${r.code})`, value: r.id })),
                ]}
                allowClear
              />
            </Col>
          ) : null
        }
      </ProFormDependency>
      <ProFormDependency name={['serialManaged']}>
        {({ serialManaged }) =>
          serialManaged ? (
            <Col span={12}>
              <ProFormSelect
                name="defaultSerialRuleId"
                label={
                  <Space>
                    <span>{t('app.master-data.materialForm.defaultSerialRule')}</span>
                    <Button
                      type="link"
                      size="small"
                      icon={<LinkOutlined />}
                      onClick={handleGotoSerialRules}
                      title={t('app.master-data.materialForm.gotoSerialRules')}
                      style={{ padding: 0, height: 'auto' }}
                    >
                      {t('app.master-data.materialForm.createRule')}
                    </Button>
                  </Space>
                }
                placeholder={t('app.master-data.materialForm.defaultSerialRulePlaceholder')}
                options={[
                  { label: t('app.master-data.materialForm.systemDefaultRule'), value: SYSTEM_DEFAULT_RULE_VALUE },
                  ...serialRules.map((r) => ({ label: `${r.name} (${r.code})`, value: r.id })),
                ]}
                allowClear
              />
            </Col>
          ) : null
        }
      </ProFormDependency>
      <Col span={24}>
        <ProFormUploadButton
          name="images"
          label={t('app.master-data.materialForm.materialImages')}
          extra={t('app.master-data.materialForm.materialAttachmentsHint')}
          max={5}
          fieldProps={{
            multiple: true,
            listType: "picture-card",
            accept: '.jpg,.jpeg,.png,.gif,.webp,.svg,.pdf,.dwg,.dxf,.step,.stp,.xls,.xlsx',
            beforeUpload: (file) => {
              const ext = materialAttachmentExtLower((file as File).name);
              if (!MATERIAL_ATTACHMENT_EXT.has(ext)) {
                messageApi.error(t('app.master-data.materialForm.attachmentInvalidType'));
                return Upload.LIST_IGNORE;
              }
              return true;
            },
            customRequest: async (options) => {
              try {
                const res = await uploadMultipleFiles([options.file as File], { category: 'material_images' });
                if (options.onSuccess) {
                  options.onSuccess(res[0], options.file as any);
                }
              } catch (err) {
                if (options.onError) {
                  options.onError(err as any);
                }
              }
            }
          }}
        />
      </Col>
      <Col span={24}>
        <ProFormTextArea
          name="description"
          label={t('app.master-data.materialForm.description')}
          placeholder={t('app.master-data.materialForm.descriptionPlaceholder')}
          fieldProps={{ rows: 3, maxLength: 500 }}
        />
      </Col>
    </Row>
    </>
  );
};

/**
 * 编号映射标签页
 */
interface CodeMappingTabProps {
  departmentCodes: DepartmentCodeMapping[];
  customerCodes: CustomerCodeMapping[];
  supplierCodes: SupplierCodeMapping[];
  externalSystemCodes: MaterialCodeMapping[];
  externalSystemCodesLoading: boolean;
  materialUuid?: string;
  customers: Customer[];
  suppliers: Supplier[];
  customersLoading: boolean;
  suppliersLoading: boolean;
  onDepartmentCodesChange: (codes: DepartmentCodeMapping[]) => void;
  onCustomerCodesChange: (codes: CustomerCodeMapping[]) => void;
  onSupplierCodesChange: (codes: SupplierCodeMapping[]) => void;
  onExternalSystemCodesChange: (codes: MaterialCodeMapping[]) => void;
  onReloadExternalSystemCodes?: () => void;
}

/** 编号映射统一行类型（用于单表展示） */
type CodeMappingSourceType = 'department' | 'customer' | 'supplier' | 'external';
interface CodeMappingRow {
  key: string;
  sourceType: CodeMappingSourceType;
  sourceIndex?: number;
  externalUuid?: string;
  /** 映射类型展示 */
  typeLabel: string;
  /** 编号（部门/客户/供应商为 code，外部为 externalCode） */
  code: string;
  /** 关联方/类型（部门为编号类型，客户为客户名，供应商为供应商名，外部为外部系统） */
  relation: string;
  name?: string;
  description?: string;
  /** 其他：部门为 department，外部为 isActive */
  extra?: string | React.ReactNode;
}

const CodeMappingTab: React.FC<CodeMappingTabProps> = ({
  departmentCodes,
  customerCodes,
  supplierCodes,
  externalSystemCodes,
  externalSystemCodesLoading,
  materialUuid,
  customers,
  suppliers,
  customersLoading,
  suppliersLoading,
  onDepartmentCodesChange,
  onCustomerCodesChange,
  onSupplierCodesChange,
  onReloadExternalSystemCodes,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [addForm] = Form.useForm();
  const [externalSystemForm] = Form.useForm();

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addModalType, setAddModalType] = useState<CodeMappingSourceType>('department');
  const [editingRow, setEditingRow] = useState<CodeMappingRow | null>(null);
  const [externalSystemModalVisible, setExternalSystemModalVisible] = useState(false);
  const [editingExternalSystemCode, setEditingExternalSystemCode] = useState<MaterialCodeMapping | null>(null);

  const codeMappingTypeOptions = useMemo(() => [
    { label: t('app.master-data.codeMapping.department'), value: 'department' as CodeMappingSourceType },
    { label: t('app.master-data.codeMapping.customer'), value: 'customer' as CodeMappingSourceType },
    { label: t('app.master-data.codeMapping.supplier'), value: 'supplier' as CodeMappingSourceType },
    { label: t('app.master-data.codeMapping.external'), value: 'external' as CodeMappingSourceType },
  ], [t]);

  const departmentCodeTypeLabels = useMemo(() => ({
    SALE: t('app.master-data.codeMapping.sale'),
    DES: t('app.master-data.codeMapping.des'),
    PUR: t('app.master-data.codeMapping.pur'),
    WH: t('app.master-data.codeMapping.wh'),
    PROD: t('app.master-data.codeMapping.prod'),
  }), [t]);

  const departmentCodeTypes = useMemo(() => [
    { label: t('app.master-data.codeMapping.sale'), value: 'SALE' },
    { label: t('app.master-data.codeMapping.des'), value: 'DES' },
    { label: t('app.master-data.codeMapping.pur'), value: 'PUR' },
    { label: t('app.master-data.codeMapping.wh'), value: 'WH' },
    { label: t('app.master-data.codeMapping.prod'), value: 'PROD' },
  ], [t]);

  const resolveCustomerRelation = useCallback(
    (code: CustomerCodeMapping) => {
      if (code.customerName) return code.customerName;
      const customer = customers.find((c) => c.id === code.customerId);
      if (customer) return `${customer.code} - ${customer.name}`;
      return code.customerId > 0 ? `#${code.customerId}` : '';
    },
    [customers],
  );

  const resolveSupplierRelation = useCallback(
    (code: SupplierCodeMapping) => {
      if (code.supplierName) return code.supplierName;
      const supplier = suppliers.find((s) => s.id === code.supplierId);
      if (supplier) return `${supplier.code} - ${supplier.name}`;
      return code.supplierId > 0 ? `#${code.supplierId}` : '';
    },
    [suppliers],
  );

  // 合并为统一表格数据源
  const codeMappingRows: CodeMappingRow[] = useMemo(() => {
    const rows: CodeMappingRow[] = [];
    departmentCodes.forEach((r, i) => {
      rows.push({
        key: `dept-${i}`,
        sourceType: 'department',
        sourceIndex: i,
        typeLabel: t('app.master-data.codeMapping.department'),
        code: r.code,
        relation: (departmentCodeTypeLabels as any)[r.code_type] ?? r.code_type,
        name: r.name,
        description: r.description,
        extra: r.department,
      });
    });
    customerCodes.forEach((r, i) => {
      rows.push({
        key: `cust-${i}`,
        sourceType: 'customer',
        sourceIndex: i,
        typeLabel: t('app.master-data.codeMapping.customer'),
        code: r.code,
        relation: resolveCustomerRelation(r),
        name: r.name,
        description: r.description,
      });
    });
    supplierCodes.forEach((r, i) => {
      rows.push({
        key: `supp-${i}`,
        sourceType: 'supplier',
        sourceIndex: i,
        typeLabel: t('app.master-data.codeMapping.supplier'),
        code: r.code,
        relation: resolveSupplierRelation(r),
        name: r.name,
        description: r.description,
      });
    });
    if (materialUuid) {
      externalSystemCodes.forEach((r) => {
        rows.push({
          key: `ext-${r.uuid}`,
          sourceType: 'external',
          externalUuid: r.uuid,
          typeLabel: t('app.master-data.codeMapping.external'),
          code: r.externalCode,
          relation: r.externalSystem,
          name: r.internalCode,
          description: r.description,
          extra: (
            <Tag color={r.isActive ? 'success' : 'default'}>{r.isActive ? t('app.master-data.codeMapping.enabled') : t('app.master-data.codeMapping.disabled')}</Tag>
          ),
        });
      });
    }
    return rows;
  }, [departmentCodes, customerCodes, supplierCodes, externalSystemCodes, materialUuid, departmentCodeTypeLabels, resolveCustomerRelation, resolveSupplierRelation, t]);

  const closeAddModal = () => {
    setAddModalVisible(false);
    setEditingRow(null);
    addForm.resetFields();
  };

  const handleDeleteRow = (record: CodeMappingRow) => {
    if (record.sourceType === 'department' && record.sourceIndex !== undefined) {
      const newCodes = [...departmentCodes];
      newCodes.splice(record.sourceIndex, 1);
      onDepartmentCodesChange(newCodes);
    } else if (record.sourceType === 'customer' && record.sourceIndex !== undefined) {
      const newCodes = [...customerCodes];
      newCodes.splice(record.sourceIndex, 1);
      onCustomerCodesChange(newCodes);
    } else if (record.sourceType === 'supplier' && record.sourceIndex !== undefined) {
      const newCodes = [...supplierCodes];
      newCodes.splice(record.sourceIndex, 1);
      onSupplierCodesChange(newCodes);
    } else if (record.sourceType === 'external' && record.externalUuid) {
      materialCodeMappingApi.delete(record.externalUuid!).then(() => {
        messageApi.success(t('common.deleteSuccess'));
        onReloadExternalSystemCodes?.();
      }).catch((err: any) => {
        messageApi.error(err.message || t('common.deleteFailed'));
      });
    }
  };

  const handleOpenAddModal = (type?: CodeMappingSourceType) => {
    const nextType = type ?? 'department';
    setEditingRow(null);
    setAddModalType(nextType);
    setAddModalVisible(true);
    addForm.resetFields();
  };

  const handleOpenEditMappingModal = (record: CodeMappingRow) => {
    if (record.sourceType === 'external') return;
    if (record.sourceIndex === undefined) return;
    setEditingRow(record);
    setAddModalType(record.sourceType);
    setAddModalVisible(true);
    addForm.resetFields();
    if (record.sourceType === 'department') {
      const row = departmentCodes[record.sourceIndex];
      addForm.setFieldsValue({
        code_type: row.code_type,
        code: row.code,
        name: row.name,
        department: row.department,
        description: row.description,
      });
      return;
    }
    if (record.sourceType === 'customer') {
      const row = customerCodes[record.sourceIndex];
      addForm.setFieldsValue({
        customerId: row.customerId > 0 ? row.customerId : undefined,
        code: row.code,
        name: row.name,
        description: row.description,
      });
      return;
    }
    if (record.sourceType === 'supplier') {
      const row = supplierCodes[record.sourceIndex];
      addForm.setFieldsValue({
        supplierId: row.supplierId > 0 ? row.supplierId : undefined,
        code: row.code,
        name: row.name,
        description: row.description,
      });
    }
  };

  const handleAddSubmit = () => {
    if (addModalType === 'department') {
      addForm.validateFields().then((values) => {
        if (editingRow?.sourceType === 'department' && editingRow.sourceIndex !== undefined) {
          const newCodes = [...departmentCodes];
          newCodes[editingRow.sourceIndex] = values;
          onDepartmentCodesChange(newCodes);
        } else {
          onDepartmentCodesChange([...departmentCodes, values]);
        }
        closeAddModal();
      }).catch(() => {});
      return;
    }
    if (addModalType === 'customer') {
      addForm.validateFields().then((values) => {
        const customer = customers.find((c) => c.id === values.customerId);
        const nextRow = {
          ...values,
          customerName: customer?.name,
          customerUuid: customer?.uuid,
        };
        if (editingRow?.sourceType === 'customer' && editingRow.sourceIndex !== undefined) {
          const newCodes = [...customerCodes];
          newCodes[editingRow.sourceIndex] = nextRow;
          onCustomerCodesChange(newCodes);
        } else {
          onCustomerCodesChange([...customerCodes, nextRow]);
        }
        closeAddModal();
      }).catch(() => {});
      return;
    }
    if (addModalType === 'supplier') {
      addForm.validateFields().then((values) => {
        const supplier = suppliers.find((s) => s.id === values.supplierId);
        const nextRow = {
          ...values,
          supplierName: supplier?.name,
          supplierUuid: supplier?.uuid,
        };
        if (editingRow?.sourceType === 'supplier' && editingRow.sourceIndex !== undefined) {
          const newCodes = [...supplierCodes];
          newCodes[editingRow.sourceIndex] = nextRow;
          onSupplierCodesChange(newCodes);
        } else {
          onSupplierCodesChange([...supplierCodes, nextRow]);
        }
        closeAddModal();
      }).catch(() => {});
      return;
    }
    if (addModalType === 'external' && materialUuid) {
      addForm.validateFields().then(async (values) => {
        await materialCodeMappingApi.create({
          materialUuid,
          internalCode: values.internalCode || '',
          externalCode: values.externalCode,
          externalSystem: values.externalSystem,
          description: values.description,
          isActive: values.isActive !== false,
        });
        messageApi.success(t('common.createSuccess'));
        closeAddModal();
        onReloadExternalSystemCodes?.();
      }).catch(() => {});
    }
  };

  const openEditExternalModal = (record: MaterialCodeMapping) => {
    setEditingExternalSystemCode(record);
    externalSystemForm.setFieldsValue({
      externalSystem: record.externalSystem,
      externalCode: record.externalCode,
      internalCode: record.internalCode,
      description: record.description,
      isActive: record.isActive,
    });
    setExternalSystemModalVisible(true);
  };

  return (
    <>
      <Table<CodeMappingRow>
        dataSource={codeMappingRows}
        loading={externalSystemCodesLoading}
        columns={[
          { title: t('app.master-data.codeMapping.mappingType'), dataIndex: 'typeLabel', key: 'typeLabel', width: 100 },
          {
            title: `${t('app.master-data.codeMapping.name')} / ${t('app.master-data.codeMapping.code')}`,
            key: 'nameCode',
            width: 180,
            ellipsis: false,
            render: (_, record) => {
              const name = record.name?.trim() ?? '';
              const code = record.code?.trim() ?? '';
              if (name && code) {
                return <UniTableStackedPrimaryCell primary={name} secondary={code} />;
              }
              if (name) {
                return (
                  <UniTableStackedPrimaryCell
                    primary={name}
                    secondary="-"
                    secondaryCopyable={false}
                  />
                );
              }
              return (
                <UniTableStackedPrimaryCell
                  primary={code || '-'}
                  secondary="-"
                  secondaryCopyable={Boolean(code)}
                />
              );
            },
          },
          { title: t('app.master-data.codeMapping.relation'), dataIndex: 'relation', key: 'relation', width: 160, ellipsis: true },
          { title: t('app.master-data.codeMapping.description'), dataIndex: 'description', key: 'description', ellipsis: true },
          { title: t('app.master-data.codeMapping.extra'), dataIndex: 'extra', key: 'extra', width: 100 },
          {
            title: t('app.master-data.materialForm.action'),
            key: 'action',
            width: 72,
            fixed: 'right' as const,
            render: (_, record) => (
              <Space size="small">
                {record.sourceType === 'external' ? (
                  <Button
                    type="link"
                    size="small"
                    icon={<EditOutlined />}
                    title={t('app.master-data.codeMapping.edit')}
                    aria-label={t('app.master-data.codeMapping.edit')}
                    onClick={() => {
                      const ext = externalSystemCodes.find((e) => e.uuid === record.externalUuid);
                      if (ext) openEditExternalModal(ext);
                    }}
                  />
                ) : (
                  <Button
                    type="link"
                    size="small"
                    icon={<EditOutlined />}
                    title={t('app.master-data.codeMapping.edit')}
                    aria-label={t('app.master-data.codeMapping.edit')}
                    onClick={() => handleOpenEditMappingModal(record)}
                  />
                )}
                <Button
                  type="link"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  title={t('app.master-data.materialForm.delete')}
                  aria-label={t('app.master-data.materialForm.delete')}
                  onClick={() => handleDeleteRow(record)}
                />
              </Space>
            ),
          },
        ]}
        pagination={false}
        size="small"
        locale={{ emptyText: t('app.master-data.codeMapping.noMapping') }}
        footer={() => (
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() => handleOpenAddModal()}
            block
          >
            {t('app.master-data.codeMapping.addMapping')}
          </Button>
        )}
      />

      {/* 统一添加编号映射 Modal */}
      <Modal
        title={
          editingRow
            ? `${t('app.master-data.codeMapping.edit')} — ${codeMappingTypeOptions.find((o) => o.value === addModalType)?.label ?? ''}`
            : t('app.master-data.codeMapping.addMapping')
        }
        open={addModalVisible}
        onOk={handleAddSubmit}
        onCancel={closeAddModal}
        width={600}
      >
        <Form form={addForm} layout="vertical">
          <Form.Item label={t('app.master-data.codeMapping.mappingType')}>
            <Select
              value={addModalType}
              disabled={!!editingRow}
              options={codeMappingTypeOptions.filter(o => o.value !== 'external' || materialUuid)}
              onChange={(v) => {
                setAddModalType(v as CodeMappingSourceType);
                addForm.resetFields();
              }}
              style={{ width: '100%' }}
            />
          </Form.Item>
          {addModalType === 'department' && (
            <>
              <Form.Item name="code_type" label={t('app.master-data.codeMapping.codeType')} rules={[{ required: true, message: t('app.master-data.codeMapping.codeTypeRequired') }]}>
                <Select placeholder={t('app.master-data.codeMapping.codeTypePlaceholder')} options={departmentCodeTypes} />
              </Form.Item>
              <Form.Item name="code" label={t('app.master-data.codeMapping.code')} rules={[{ required: true, message: t('app.master-data.codeMapping.codeRequired') }]}>
                <Input placeholder={t('app.master-data.codeMapping.codePlaceholder')} />
              </Form.Item>
              <Form.Item name="name" label={t('app.master-data.codeMapping.nameOptional')}>
                <Input placeholder={t('app.master-data.codeMapping.nameOptional')} />
              </Form.Item>
              <Form.Item name="department" label={t('app.master-data.codeMapping.departmentOptional')}>
                <Input placeholder={t('app.master-data.codeMapping.departmentOptional')} />
              </Form.Item>
              <Form.Item name="description" label={t('app.master-data.codeMapping.descriptionOptional')}>
                <Input.TextArea placeholder={t('app.master-data.codeMapping.descriptionOptional')} rows={3} />
              </Form.Item>
            </>
          )}
          {addModalType === 'customer' && (
            <>
              <Form.Item name="customerId" label={t('app.master-data.codeMapping.customerLabel')} rules={[{ required: true, message: t('app.master-data.codeMapping.selectCustomer') }]}>
                <Select
                  placeholder={t('app.master-data.codeMapping.selectCustomerPlaceholder')}
                  loading={customersLoading}
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={customers.map(c => ({ label: `${c.code} - ${c.name}`, value: c.id }))}
                />
              </Form.Item>
              <Form.Item name="code" label={t('app.master-data.codeMapping.customerCode')} rules={[{ required: true, message: t('field.customer.codeRequired') }]}>
                <Input placeholder={t('field.customer.codePlaceholder')} />
              </Form.Item>
              <Form.Item name="name" label={t('app.master-data.codeMapping.nameOptional')}>
                <Input placeholder={t('app.master-data.codeMapping.nameOptional')} />
              </Form.Item>
              <Form.Item name="description" label={t('app.master-data.codeMapping.descriptionOptional')}>
                <Input.TextArea placeholder={t('app.master-data.codeMapping.descriptionOptional')} rows={3} />
              </Form.Item>
            </>
          )}
          {addModalType === 'supplier' && (
            <>
              <Form.Item name="supplierId" label={t('app.master-data.codeMapping.supplierLabel')} rules={[{ required: true, message: t('app.master-data.codeMapping.selectSupplier') }]}>
                <Select
                  placeholder={t('app.master-data.codeMapping.selectSupplierPlaceholder')}
                  loading={suppliersLoading}
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={suppliers.map(s => ({ label: `${s.code} - ${s.name}`, value: s.id }))}
                />
              </Form.Item>
              <Form.Item name="code" label={t('app.master-data.codeMapping.supplierCode')} rules={[{ required: true, message: t('field.supplier.codeRequired') }]}>
                <Input placeholder={t('field.supplier.codePlaceholder')} />
              </Form.Item>
              <Form.Item name="name" label={t('app.master-data.codeMapping.nameOptional')}>
                <Input placeholder={t('app.master-data.codeMapping.nameOptional')} />
              </Form.Item>
              <Form.Item name="description" label={t('app.master-data.codeMapping.descriptionOptional')}>
                <Input.TextArea placeholder={t('app.master-data.codeMapping.descriptionOptional')} rows={3} />
              </Form.Item>
            </>
          )}
          {addModalType === 'external' && materialUuid && (
            <>
              <Form.Item name="externalSystem" label={t('app.master-data.codeMapping.externalSystem')} rules={[{ required: true, message: t('app.master-data.codeMapping.externalSystemRequired') }]}>
                <Input placeholder={t('app.master-data.codeMapping.externalSystemPlaceholder')} />
              </Form.Item>
              <Form.Item name="externalCode" label={t('app.master-data.codeMapping.externalCode')} rules={[{ required: true, message: t('app.master-data.codeMapping.externalCodeRequired') }]}>
                <Input placeholder={t('app.master-data.codeMapping.externalCodePlaceholder')} />
              </Form.Item>
              <Form.Item name="internalCode" label={t('app.master-data.codeMapping.internalCodeOptional')} tooltip={t('app.master-data.codeMapping.internalCodeTooltip')}>
                <Input placeholder={t('app.master-data.codeMapping.internalCodeOptional')} />
              </Form.Item>
              <Form.Item name="description" label={t('app.master-data.codeMapping.descriptionOptional')}>
                <Input.TextArea placeholder={t('app.master-data.codeMapping.descriptionOptional')} rows={3} />
              </Form.Item>
              <Form.Item name="isActive" label={t('app.master-data.materialForm.isActive')} valuePropName="checked" initialValue={true}>
                <Switch />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      {/* 编辑外部系统编号映射 Modal */}
      {materialUuid && (
        <Modal
          title={t('app.master-data.codeMapping.editExternal')}
          open={externalSystemModalVisible}
          onOk={async () => {
            try {
              const values = await externalSystemForm.validateFields();
              if (editingExternalSystemCode) {
                await materialCodeMappingApi.update(editingExternalSystemCode.uuid, {
                  externalSystem: values.externalSystem,
                  externalCode: values.externalCode,
                  internalCode: values.internalCode || undefined,
                  description: values.description,
                  isActive: values.isActive,
                });
                messageApi.success(t('common.updateSuccess'));
              }
              setExternalSystemModalVisible(false);
              setEditingExternalSystemCode(null);
              externalSystemForm.resetFields();
              onReloadExternalSystemCodes?.();
            } catch (error: any) {
              messageApi.error(error.message || t('common.updateFailed'));
            }
          }}
          onCancel={() => {
            setExternalSystemModalVisible(false);
            setEditingExternalSystemCode(null);
            externalSystemForm.resetFields();
          }}
          width={600}
        >
          <Form form={externalSystemForm} layout="vertical">
            <Form.Item name="externalSystem" label={t('app.master-data.codeMapping.externalSystem')} rules={[{ required: true, message: t('app.master-data.codeMapping.externalSystemRequired') }]}>
              <Input placeholder={t('app.master-data.codeMapping.externalSystemPlaceholder')} />
            </Form.Item>
            <Form.Item name="externalCode" label={t('app.master-data.codeMapping.externalCode')} rules={[{ required: true, message: t('app.master-data.codeMapping.externalCodeRequired') }]}>
              <Input placeholder={t('app.master-data.codeMapping.externalCodePlaceholder')} />
            </Form.Item>
            <Form.Item name="internalCode" label={t('app.master-data.codeMapping.internalCodeOptional')} tooltip={t('app.master-data.codeMapping.internalCodeTooltip')}>
              <Input placeholder={t('app.master-data.codeMapping.internalCodeOptional')} />
            </Form.Item>
            <Form.Item name="description" label={t('app.master-data.codeMapping.descriptionOptional')}>
              <Input.TextArea placeholder={t('app.master-data.codeMapping.descriptionOptional')} rows={3} />
            </Form.Item>
            <Form.Item name="isActive" label={t('app.master-data.materialForm.isActive')} valuePropName="checked">
              <Switch />
            </Form.Item>
          </Form>
        </Modal>
      )}
    </>
  );
};

/**
 * 默认值设置标签页
 */
interface DefaultsTabProps {
  customers: Customer[];
  suppliers: Supplier[];
  warehouses: Warehouse[];
  customersLoading: boolean;
  suppliersLoading: boolean;
  warehousesLoading: boolean;
}

const DefaultsTab: React.FC<DefaultsTabProps> = ({
  customers,
  suppliers,
  warehouses,
  customersLoading,
  suppliersLoading,
  warehousesLoading,
}) => {
  const { t } = useTranslation();
  const [unitOptions, setUnitOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [unitOptionsLoading, setUnitOptionsLoading] = useState(false);
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>([]);
  const [storageLocationsLoading, setStorageLocationsLoading] = useState(false);
  const [storageAreas, setStorageAreas] = useState<StorageArea[]>([]);

  useEffect(() => {
    const loadUnitOptions = async () => {
      try {
        setUnitOptionsLoading(true);
        const dictionary = await getDataDictionaryByCode('MATERIAL_UNIT');
        const items = await getDictionaryItemList(dictionary.uuid, true);
        setUnitOptions(
          items
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((item) => ({ label: item.label, value: item.value })),
        );
      } catch (error) {
        console.error('加载单位选项失败:', error);
      } finally {
        setUnitOptionsLoading(false);
      }
    };
    const loadStorageMaster = async () => {
      try {
        setStorageLocationsLoading(true);
        const [locRes, areaRes] = await Promise.all([
          storageLocationApi.list({ limit: 1000, is_active: true }),
          storageAreaApi.list({ limit: 1000, is_active: true }),
        ]);
        setStorageLocations(locRes.items ?? []);
        setStorageAreas(areaRes.items ?? []);
      } catch (error) {
        console.error('加载库位选项失败:', error);
      } finally {
        setStorageLocationsLoading(false);
      }
    };
    loadUnitOptions();
    loadStorageMaster();
  }, []);

  return (
    <Collapse defaultActiveKey={['finance', 'sale', 'purchase', 'inventory']}>
        <Panel header={t('app.master-data.defaults.finance')} key="finance">
          <Row gutter={16}>
            <Col span={12}>
              <ProFormSelect
                name="defaults.defaultTaxRate"
                label={t('app.master-data.defaults.defaultTaxRate')}
                placeholder={t('app.master-data.defaults.defaultTaxRatePlaceholder')}
                options={[
                  { label: t('app.master-data.defaults.taxRate0'), value: 0 },
                  { label: t('app.master-data.defaults.taxRate3'), value: 3 },
                  { label: t('app.master-data.defaults.taxRate6'), value: 6 },
                  { label: t('app.master-data.defaults.taxRate9'), value: 9 },
                  { label: t('app.master-data.defaults.taxRate13'), value: 13 },
                ]}
              />
            </Col>
          </Row>
        </Panel>

        {/* 销售默认值：单位已在【多单位管理】标签配置 */}
        <Panel header={t('app.master-data.defaults.sale')} key="sale">
          <ProFormText name="defaults.defaultSalePriceType" hidden initialValue="tax_inclusive" />
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label={t('app.master-data.defaults.defaultSalePrice')}
                tooltip={t('app.master-data.defaults.defaultSalePriceTypeHint')}
              >
                <Row gutter={8} align="middle" wrap={false}>
                  <Col flex="auto">
                    <ProFormDigit
                      name="defaults.defaultSalePrice"
                      placeholder={t('app.master-data.defaults.defaultSalePricePlaceholder')}
                      min={0}
                      fieldProps={{ style: { width: '100%' } }}
                      noStyle
                    />
                  </Col>
                  <Col flex="none">
                    <Form.Item
                      noStyle
                      shouldUpdate={(prev, cur) =>
                        prev?.defaults?.defaultSalePriceType !== cur?.defaults?.defaultSalePriceType ||
                        prev?.['defaults.defaultSalePriceType'] !== cur?.['defaults.defaultSalePriceType'] ||
                        prev?.defaults?.defaultSalePrice !== cur?.defaults?.defaultSalePrice ||
                        prev?.['defaults.defaultSalePrice'] !== cur?.['defaults.defaultSalePrice'] ||
                        prev?.defaults?.defaultTaxRate !== cur?.defaults?.defaultTaxRate ||
                        prev?.['defaults.defaultTaxRate'] !== cur?.['defaults.defaultTaxRate']
                      }
                    >
                      {({ getFieldValue, setFieldValue }) => {
                        const priceType = (getFieldValue('defaults.defaultSalePriceType') ??
                          getFieldValue(['defaults', 'defaultSalePriceType']) ??
                          'tax_inclusive') as PriceTypeValue;
                        return (
                          <PriceTypeSwitch
                            checked={priceType === 'tax_inclusive'}
                            onChange={(checked) => {
                              const nextType: PriceTypeValue = checked ? 'tax_inclusive' : 'tax_exclusive';
                              const fromType: PriceTypeValue = checked ? 'tax_exclusive' : 'tax_inclusive';
                              const raw =
                                Number(getFieldValue('defaults.defaultSalePrice')) ||
                                Number(getFieldValue(['defaults', 'defaultSalePrice'])) ||
                                0;
                              const taxR =
                                Number(getFieldValue('defaults.defaultTaxRate')) ||
                                Number(getFieldValue(['defaults', 'defaultTaxRate'])) ||
                                0;
                              if (raw > 0) {
                                const converted = convertUnitPriceByPriceType(raw, taxR, fromType, nextType);
                                setFieldValue('defaults.defaultSalePrice', converted);
                              }
                              setFieldValue('defaults.defaultSalePriceType', nextType);
                            }}
                          />
                        );
                      }}
                    </Form.Item>
                  </Col>
                </Row>
              </Form.Item>
            </Col>
            <Col span={12}>
              <ProFormSelect
                name="defaults.defaultCustomerIds"
                label={t('app.master-data.defaults.defaultCustomers')}
                placeholder={t('app.master-data.defaults.selectCustomers')}
                options={customers.map(c => ({ label: `${c.code} - ${c.name}`, value: c.id }))}
                fieldProps={{
                  mode: 'multiple',
                  loading: customersLoading,
                  showSearch: true,
                  filterOption: (input: string, option: any) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
                }}
              />
            </Col>
          </Row>
        </Panel>

        <Panel header={t('app.master-data.defaults.purchase')} key="purchase">
          <ProFormText name="defaults.defaultPurchasePriceType" hidden initialValue="tax_inclusive" />
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label={t('app.master-data.defaults.defaultPurchasePrice')}
                tooltip={t('app.master-data.defaults.defaultPurchasePriceTypeHint')}
              >
                <Row gutter={8} align="middle" wrap={false}>
                  <Col flex="auto">
                    <ProFormDigit
                      name="defaults.defaultPurchasePrice"
                      placeholder={t('app.master-data.defaults.defaultPurchasePricePlaceholder')}
                      min={0}
                      fieldProps={{ style: { width: '100%' } }}
                      noStyle
                    />
                  </Col>
                  <Col flex="none">
                    <Form.Item
                      noStyle
                      shouldUpdate={(prev, cur) =>
                        prev?.defaults?.defaultPurchasePriceType !== cur?.defaults?.defaultPurchasePriceType ||
                        prev?.['defaults.defaultPurchasePriceType'] !== cur?.['defaults.defaultPurchasePriceType'] ||
                        prev?.defaults?.defaultPurchasePrice !== cur?.defaults?.defaultPurchasePrice ||
                        prev?.['defaults.defaultPurchasePrice'] !== cur?.['defaults.defaultPurchasePrice'] ||
                        prev?.defaults?.defaultTaxRate !== cur?.defaults?.defaultTaxRate ||
                        prev?.['defaults.defaultTaxRate'] !== cur?.['defaults.defaultTaxRate']
                      }
                    >
                      {({ getFieldValue, setFieldValue }) => {
                        const priceType = (getFieldValue('defaults.defaultPurchasePriceType') ??
                          getFieldValue(['defaults', 'defaultPurchasePriceType']) ??
                          'tax_inclusive') as PriceTypeValue;
                        return (
                          <PriceTypeSwitch
                            checked={priceType === 'tax_inclusive'}
                            onChange={(checked) => {
                              const nextType: PriceTypeValue = checked ? 'tax_inclusive' : 'tax_exclusive';
                              const fromType: PriceTypeValue = checked ? 'tax_exclusive' : 'tax_inclusive';
                              const raw =
                                Number(getFieldValue('defaults.defaultPurchasePrice')) ||
                                Number(getFieldValue(['defaults', 'defaultPurchasePrice'])) ||
                                0;
                              const taxR =
                                Number(getFieldValue('defaults.defaultTaxRate')) ||
                                Number(getFieldValue(['defaults', 'defaultTaxRate'])) ||
                                0;
                              if (raw > 0) {
                                const converted = convertUnitPriceByPriceType(raw, taxR, fromType, nextType);
                                setFieldValue('defaults.defaultPurchasePrice', converted);
                              }
                              setFieldValue('defaults.defaultPurchasePriceType', nextType);
                            }}
                          />
                        );
                      }}
                    </Form.Item>
                  </Col>
                </Row>
              </Form.Item>
            </Col>
            <Col span={12}>
              <ProFormSelect
                name="defaults.defaultSupplierIds"
                label={t('app.master-data.defaults.defaultSuppliers')}
                placeholder={t('app.master-data.defaults.selectSuppliers')}
                options={suppliers.map((s) => ({ label: `${s.code} - ${s.name}`, value: s.id }))}
                fieldProps={{
                  mode: 'multiple',
                  loading: suppliersLoading,
                  showSearch: true,
                  filterOption: (input: string, option: any) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
                }}
              />
            </Col>
            <Col span={12}>
              <ProFormDependency name={['baseUnit', 'units']}>
                {({ baseUnit, units }) => {
                  const auxiliaryUnits =
                    units?.units?.map((u: MaterialUnit) => u.unit).filter(Boolean) ?? [];
                  const allowedUnits = baseUnit
                    ? [baseUnit, ...auxiliaryUnits.filter((u: string) => u !== baseUnit)]
                    : auxiliaryUnits;
                  const purchaseUnitOptions =
                    allowedUnits.length > 0
                      ? unitOptions.filter((opt) => allowedUnits.includes(opt.value))
                      : unitOptions;
                  return (
                    <ProFormSelect
                      name="defaults.defaultPurchaseUnit"
                      label={t('app.master-data.defaults.defaultPurchaseUnit')}
                      placeholder={t('app.master-data.materialForm.selectPurchaseUnit')}
                      options={purchaseUnitOptions}
                      fieldProps={{
                        allowClear: true,
                        showSearch: true,
                        loading: unitOptionsLoading,
                        filterOption: (input: string, option: any) =>
                          (option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
                      }}
                    />
                  );
                }}
              </ProFormDependency>
            </Col>
            <Col span={12}>
              <ProFormDigit
                name="defaults.defaultPurchaseLeadTime"
                label={t('app.master-data.defaults.defaultPurchaseLeadTime')}
                placeholder={t('app.master-data.defaults.defaultPurchaseLeadTimePlaceholder')}
                min={0}
                fieldProps={{ precision: 0 }}
              />
            </Col>
          </Row>
        </Panel>

        {/* 库存默认值 */}
        <Panel header={t('app.master-data.defaults.inventory')} key="inventory">
          <Row gutter={16}>
            <Col span={12}>
              <ProFormSelect
                name="defaults.defaultWarehouseIds"
                label={t('app.master-data.defaults.defaultWarehouses')}
                placeholder={t('app.master-data.defaults.selectWarehouses')}
                options={warehouses.map(w => ({ label: `${w.code} - ${w.name}`, value: w.id }))}
                fieldProps={{
                  mode: 'multiple',
                  loading: warehousesLoading,
                  showSearch: true,
                  filterOption: (input: string, option: any) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
                }}
              />
            </Col>
            <Col span={12}>
              <ProFormDependency name={['defaults.defaultWarehouseIds', 'defaults.defaultLocation']}>
                {(values) => {
                  const defaultWarehouseIds: number[] =
                    values['defaults.defaultWarehouseIds'] ?? [];
                  const currentLocation = values['defaults.defaultLocation'];
                  let filteredLocations = storageLocations;
                  if (defaultWarehouseIds.length > 0 && storageAreas.length > 0) {
                    const allowedAreaIds = new Set(
                      storageAreas
                        .filter((area) => defaultWarehouseIds.includes(area.warehouseId))
                        .map((area) => area.id),
                    );
                    filteredLocations = storageLocations.filter((loc) =>
                      allowedAreaIds.has(loc.storageAreaId),
                    );
                  }
                  const locationOptions = filteredLocations.map((loc) => ({
                    label: loc.storageAreaCode
                      ? `${loc.code} - ${loc.name} (${loc.storageAreaCode})`
                      : `${loc.code} - ${loc.name}`,
                    value: loc.code,
                  }));
                  if (
                    currentLocation
                    && !locationOptions.some((opt) => opt.value === currentLocation)
                  ) {
                    locationOptions.unshift({
                      label: String(currentLocation),
                      value: String(currentLocation),
                    });
                  }
                  return (
                    <ProFormSelect
                      name="defaults.defaultLocation"
                      label={t('app.master-data.defaults.defaultLocation')}
                      placeholder={t('app.kuaizhizao.warehouseOtherInbound.field.selectLocation')}
                      options={locationOptions}
                      fieldProps={{
                        allowClear: true,
                        showSearch: true,
                        loading: storageLocationsLoading,
                        filterOption: (input: string, option: any) =>
                          (option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
                      }}
                    />
                  );
                }}
              </ProFormDependency>
            </Col>
            <Col span={12}>
              <ProFormDigit
                name="defaults.safetyStock"
                label={t('app.master-data.defaults.safetyStock')}
                placeholder={t('app.master-data.defaults.safetyStockPlaceholder')}
                min={0}
              />
            </Col>
            <Col span={12}>
              <ProFormDigit
                name="defaults.maxStock"
                label={t('app.master-data.defaults.maxStock')}
                placeholder={t('app.master-data.defaults.maxStockPlaceholder')}
                min={0}
              />
            </Col>
          </Row>
        </Panel>
      </Collapse>
  );
};

/**
 * 物料来源配置标签页
 */
interface MaterialSourceTabProps {
  formRef: any;
  material?: Material;
  suppliers: Supplier[];
  processRoutes: ProcessRoute[];
  operations: Operation[];
  suppliersLoading: boolean;
  processRoutesLoading: boolean;
  operationsLoading: boolean;
  sourceTypeOptions: Array<{ label: string; value: string }>;
  suspendedModalReturnPath?: string;
  materialUuid?: string;
  onQuickAddProcessRoute?: () => void;
  onQuickAddSupplier?: () => void;
  onQuickAddOutsourceSupplier?: () => void;
  onQuickAddOperation?: () => void;
}

const MaterialSourceTab: React.FC<MaterialSourceTabProps> = ({
  formRef,
  material,
  suppliers,
  processRoutes,
  operations,
  suppliersLoading,
  processRoutesLoading,
  operationsLoading,
  sourceTypeOptions,
  suspendedModalReturnPath,
  materialUuid,
  onQuickAddProcessRoute,
  onQuickAddSupplier,
  onQuickAddOutsourceSupplier,
  onQuickAddOperation,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const { token } = theme.useToken();
  const [sourceTypes, setSourceTypes] = useState<string[]>(() =>
    normalizeSourceTypeValues(
      material?.sourceType || material?.source_type,
      ((material as any)?.sourceConfig || (material as any)?.source_config || {}) as Record<string, any>,
    ),
  );
  const manufacturingModeOptions = useMemo(() => [
    { label: t('app.master-data.materialForm.manufacturingFabrication'), value: 'fabrication' },
    { label: t('app.master-data.materialForm.manufacturingAssembly'), value: 'assembly' },
  ], [t]);
  const manufacturingModeHintMap = useMemo(
    (): Record<string, string> => ({
      fabrication: t('app.master-data.materialForm.manufacturingFabricationHint'),
      assembly: t('app.master-data.materialForm.manufacturingAssemblyHint'),
    }),
    [t],
  );

  const materialId = material?.id;
  const [bomVersionRows, setBomVersionRows] = useState<
    Array<{ version: string; uuid: string; isDefault: boolean; bomCode?: string }>
  >([]);
  const [bomVersionsLoading, setBomVersionsLoading] = useState(false);
  const [selectedBomVersion, setSelectedBomVersion] = useState<string | undefined>();

  const loadBomVersions = useCallback(async () => {
    if (!materialId) {
      setBomVersionRows([]);
      setSelectedBomVersion(undefined);
      return;
    }
    setBomVersionsLoading(true);
    try {
      const items = await bomApi.getByMaterial(materialId, undefined, false, true);
      const byVersion = new Map<string, { version: string; uuid: string; isDefault: boolean; bomCode?: string }>();
      for (const item of items) {
        const version = item.version ?? '1.0';
        const existing = byVersion.get(version);
        if (!existing) {
          byVersion.set(version, {
            version,
            uuid: String(item.uuid ?? ''),
            isDefault: Boolean(item.isDefault),
            bomCode: item.bomCode,
          });
        } else if (item.isDefault && item.uuid) {
          existing.isDefault = true;
          existing.uuid = String(item.uuid);
        }
      }
      const rows = [...byVersion.values()].sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
      setBomVersionRows(rows);
      const defaultRow = rows.find((r) => r.isDefault) ?? rows[0];
      setSelectedBomVersion(defaultRow?.version);
    } catch (e: unknown) {
      messageApi.error((e as Error).message || t('app.master-data.materialForm.fetchBomVersionsFailed'));
      setBomVersionRows([]);
      setSelectedBomVersion(undefined);
    } finally {
      setBomVersionsLoading(false);
    }
  }, [materialId, messageApi, t]);

  useEffect(() => {
    if (!sourceTypes.includes('Make')) {
      setBomVersionRows([]);
      setSelectedBomVersion(undefined);
      return;
    }
    void loadBomVersions();
  }, [loadBomVersions, sourceTypes]);

  const goBomDesigner = (version?: string) => {
    if (!materialId) return;
    const p = new URLSearchParams();
    p.set('materialId', String(materialId));
    if (version) p.set('version', version);
    navigate(`/apps/master-data/process/engineering-bom/designer?${p}`);
  };

  const handleDefaultBomVersionChange = async (version: string | undefined) => {
    if (!version || !materialId) return;
    const row = bomVersionRows.find((r) => r.version === version);
    if (!row?.uuid) return;
    try {
      await bomApi.update(row.uuid, { isDefault: true });
      setBomVersionRows((prev) =>
        prev.map((r) => ({ ...r, isDefault: r.version === version })),
      );
      setSelectedBomVersion(version);
      messageApi.success(t('app.master-data.bom.setDefaultSuccess'));
    } catch (e: unknown) {
      messageApi.error((e as Error).message || t('common.operationFailed'));
    }
  };


  useEffect(() => {
    const nextSourceTypes = normalizeSourceTypeValues(
      material?.sourceType || material?.source_type,
      ((material as any)?.sourceConfig || (material as any)?.source_config || {}) as Record<string, any>,
    );
    setSourceTypes(nextSourceTypes);
  }, [material]);

  const handleSourceTypeChange = (values: string[], manufacturingMode?: string) => {
    const nextSourceTypes = Array.isArray(values) ? values : [];
    const value = getPrimarySourceType(nextSourceTypes);
    setSourceTypes(nextSourceTypes);
    formRef.current?.setFieldsValue({
      sourceTypes: nextSourceTypes,
      sourceType: value,
      source_type: value,
      'defaults.defaultTaxRate': value === 'Service' ? 6 : 13,
    });

    const currentConfig = formRef.current?.getFieldValue('sourceConfig') || formRef.current?.getFieldValue('source_config') || {};
    let newConfig = { ...currentConfig };

    if (value === 'Make') {
      newConfig = {
        ...newConfig,
        manufacturing_mode: manufacturingMode ?? newConfig.manufacturing_mode,
        production_lead_time: newConfig.production_lead_time,
        min_production_batch: newConfig.min_production_batch,
      };
    } else if (value === 'Buy') {
      newConfig = {
        ...newConfig,
        default_supplier_id: newConfig.default_supplier_id,
        purchase_lead_time: newConfig.purchase_lead_time,
        min_purchase_batch: newConfig.min_purchase_batch,
        purchase_price: newConfig.purchase_price,
      };
    } else if (value === 'Outsource') {
      newConfig = {
        ...newConfig,
        outsource_supplier_id: newConfig.outsource_supplier_id,
        outsource_operation: newConfig.outsource_operation,
        outsource_lead_time: newConfig.outsource_lead_time,
        outsource_price: newConfig.outsource_price,
        material_provided_by: newConfig.material_provided_by || 'enterprise',
      };
    }

    formRef.current?.setFieldsValue({
      sourceConfig: newConfig,
      source_config: newConfig,
    });
  };

  return (
    <Card
      bordered
      style={{
        marginBottom: 16,
        backgroundColor: '#fafafa',
        borderColor: token.colorBorder,
        borderRadius: token.borderRadius,
      }}
      styles={{ body: { padding: 16 } }}
    >
      <Row gutter={16}>
        <Col span={12}>
          <ProFormSelect
            name="sourceTypes"
            label={t('app.master-data.materialForm.sourceTypeLabel')}
            placeholder={t('app.master-data.materialForm.sourceTypePlaceholder')}
            options={sourceTypeOptions}
            fieldProps={{
              mode: 'multiple',
              value: sourceTypes,
              onChange: (vals: string[]) => handleSourceTypeChange(vals),
              maxTagCount: 'responsive',
            }}
            extra={t('app.master-data.materialForm.sourceTypeExtra')}
          />
        </Col>
      </Row>

      <ProFormDependency name={['sourceType']}>
        {({ sourceType: currentSourceType }) => {
          if (currentSourceType === 'Make') {
            return (
              <Row gutter={16} style={{ marginTop: 0 }}>
                <Col span={4}>
                  <ProFormDependency name={['sourceConfig.manufacturing_mode']}>
                    {({ 'sourceConfig.manufacturing_mode': mode }) => (
                      <ProFormSelect
                        name="sourceConfig.manufacturing_mode"
                        label={t('app.master-data.materialForm.manufacturingMode')}
                        placeholder={t('app.master-data.materialForm.manufacturingModePlaceholder')}
                        options={manufacturingModeOptions}
                        extra={
                          mode && manufacturingModeHintMap[mode as string]
                            ? manufacturingModeHintMap[mode as string]
                            : t('app.master-data.materialForm.manufacturingModeExtra')
                        }
                        fieldProps={{ allowClear: true }}
                      />
                    )}
                  </ProFormDependency>
                </Col>
                <Col span={5}>
                  <ProFormItem
                    name="defaults.defaultProcessRouteUuid"
                    label={
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span>{t('app.master-data.source.defaultProcessRoute')}</span>
                        <Tooltip title={t('app.master-data.source.defaultProcessRouteMaterialHint')}>
                          <QuestionCircleOutlined
                            style={{ color: 'rgba(0,0,0,.45)', fontSize: 14, cursor: 'help' }}
                          />
                        </Tooltip>
                      </span>
                    }
                  >
                    <UniDropdown
                      placeholder={t('app.master-data.source.selectProcessRoute')}
                      options={processRoutes.map((pr) => ({
                        label: `${pr.code} - ${pr.name}`,
                        value: pr.uuid,
                      }))}
                      allowClear
                      showSearch
                      loading={processRoutesLoading}
                      optionFilterProp="label"
                      style={{ width: '100%' }}
                      quickCreate={
                        onQuickAddProcessRoute
                          ? {
                              label: t('app.master-data.materialForm.quickAddProcessRoute'),
                              onClick: () => onQuickAddProcessRoute(),
                            }
                          : undefined
                      }
                    />
                  </ProFormItem>
                </Col>
                <Col span={5}>
                  <ProFormItem
                    label={
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span>{t('app.master-data.source.defaultBomVersion')}</span>
                        <Tooltip title={t('app.master-data.source.defaultBomVersionHint')}>
                          <QuestionCircleOutlined
                            style={{ color: 'rgba(0,0,0,.45)', fontSize: 14, cursor: 'help' }}
                          />
                        </Tooltip>
                      </span>
                    }
                  >
                    <UniDropdown
                      placeholder={
                        materialId
                          ? t('app.master-data.source.selectDefaultBomVersion')
                          : t('app.master-data.source.saveMaterialFirstForBom')
                      }
                      disabled={!materialId}
                      loading={bomVersionsLoading}
                      allowClear={false}
                      showSearch
                      optionFilterProp="label"
                      style={{ width: '100%' }}
                      value={selectedBomVersion}
                      options={bomVersionRows.map((row) => ({
                        value: row.version,
                        label: row.isDefault
                          ? `${row.version} ${t('app.kuaizhizao.demandComputation.bomVersionDefault')}`
                          : row.version,
                      }))}
                      onChange={(val) => handleDefaultBomVersionChange(val as string | undefined)}
                      quickCreate={
                        materialId
                          ? {
                              label: t('app.master-data.materialForm.quickMaintainBom'),
                              onClick: () => goBomDesigner(),
                            }
                          : undefined
                      }
                    />
                  </ProFormItem>
                </Col>
                <Col span={5}>
                  <ProFormDigit
                    name="sourceConfig.production_lead_time"
                    label={t('app.master-data.source.productionLeadTime')}
                    placeholder={t('app.master-data.source.leadTimePlaceholder')}
                    min={0}
                  />
                </Col>
                <Col span={5}>
                  <ProFormDigit
                    name="sourceConfig.min_production_batch"
                    label={t('app.master-data.source.minProductionBatch')}
                    placeholder={t('app.master-data.source.minBatchPlaceholder')}
                    min={0}
                  />
                </Col>
              </Row>
            );
          }
          if (currentSourceType === 'Buy') {
            return (
              <Row gutter={16} style={{ marginTop: 0 }}>
                <Col span={12}>
                  <ProFormItem
                    name="sourceConfig.default_supplier_id"
                    label={t('app.master-data.source.defaultSupplier')}
                  >
                    <UniDropdown
                      placeholder={t('app.master-data.source.selectDefaultSupplier')}
                      options={suppliers.map((s) => ({ label: `${s.code} - ${s.name}`, value: s.id }))}
                      loading={suppliersLoading}
                      showSearch
                      allowClear
                      style={{ width: '100%' }}
                      optionFilterProp="label"
                      quickCreate={
                        onQuickAddSupplier
                          ? {
                              label: t('app.master-data.materialForm.quickAddSupplier'),
                              onClick: () => onQuickAddSupplier(),
                            }
                          : undefined
                      }
                    />
                  </ProFormItem>
                </Col>
                <Col span={4}>
                  <ProFormDigit
                    name="sourceConfig.purchase_lead_time"
                    label={t('app.master-data.source.purchaseLeadTime')}
                    placeholder={t('app.master-data.source.leadTimePlaceholder')}
                    min={0}
                  />
                </Col>
                <Col span={4}>
                  <ProFormDigit
                    name="sourceConfig.min_purchase_batch"
                    label={t('app.master-data.source.minPurchaseBatch')}
                    placeholder={t('app.master-data.source.minBatchPlaceholder')}
                    min={0}
                  />
                </Col>
                <Col span={4}>
                  <ProFormDigit
                    name="sourceConfig.purchase_price"
                    label={t('app.master-data.source.purchasePrice')}
                    placeholder={t('app.master-data.source.pricePlaceholder')}
                    min={0}
                    fieldProps={{ precision: 2 }}
                  />
                </Col>
              </Row>
            );
          }
          if (currentSourceType === 'Outsource') {
            return (
              <Row gutter={16} style={{ marginTop: 0 }}>
                <Col span={6}>
                  <ProFormItem
                    name="sourceConfig.outsource_supplier_id"
                    label={t('app.master-data.source.outsourceSupplier')}
                    rules={[{ required: true, message: t('app.master-data.source.selectOutsourceSupplier') }]}
                  >
                    <UniDropdown
                      placeholder={t('app.master-data.source.selectOutsourceSupplier')}
                      options={suppliers.map((s) => ({ label: `${s.code} - ${s.name}`, value: s.id }))}
                      loading={suppliersLoading}
                      showSearch
                      style={{ width: '100%' }}
                      optionFilterProp="label"
                      quickCreate={
                        onQuickAddOutsourceSupplier
                          ? {
                              label: t('app.master-data.materialForm.quickAddSupplier'),
                              onClick: () => onQuickAddOutsourceSupplier(),
                            }
                          : undefined
                      }
                    />
                  </ProFormItem>
                </Col>
                <Col span={6}>
                  <ProFormItem
                    name="sourceConfig.outsource_operation"
                    label={t('app.master-data.source.outsourceOperation')}
                    rules={[{ required: true, message: t('app.master-data.source.selectOutsourceOperation') }]}
                  >
                    <UniDropdown
                      placeholder={t('app.master-data.source.selectOutsourceOperation')}
                      options={operations.map((op) => ({ label: `${op.code} - ${op.name}`, value: op.uuid }))}
                      loading={operationsLoading}
                      showSearch
                      style={{ width: '100%' }}
                      optionFilterProp="label"
                      quickCreate={
                        onQuickAddOperation
                          ? {
                              label: t('app.master-data.materialForm.quickAddOperation'),
                              onClick: () => onQuickAddOperation(),
                            }
                          : undefined
                      }
                    />
                  </ProFormItem>
                </Col>
                <Col span={4}>
                  <ProFormDigit
                    name="sourceConfig.outsource_lead_time"
                    label={t('app.master-data.source.outsourceLeadTime')}
                    placeholder={t('app.master-data.source.leadTimePlaceholder')}
                    min={0}
                  />
                </Col>
                <Col span={4}>
                  <ProFormDigit
                    name="sourceConfig.outsource_price"
                    label={t('app.master-data.source.outsourcePrice')}
                    placeholder={t('app.master-data.source.pricePlaceholder')}
                    min={0}
                    fieldProps={{ precision: 2 }}
                  />
                </Col>
                <Col span={4}>
                  <ProFormSelect
                    name="sourceConfig.material_provided_by"
                    label={t('app.master-data.source.materialProvidedBy')}
                    placeholder={t('app.master-data.source.selectPlaceholder')}
                    options={[
                      { label: t('app.master-data.source.enterpriseProvide'), value: 'enterprise' },
                      { label: t('app.master-data.source.supplierProvide'), value: 'supplier' },
                    ]}
                    initialValue="enterprise"
                  />
                </Col>
              </Row>
            );
          }
          if (currentSourceType === 'Phantom') {
            return (
              <Row gutter={16} style={{ marginTop: 0 }}>
                <Col span={24}>
                  <Alert
                    message={t('app.master-data.source.phantomTip')}
                    description={t('app.master-data.source.phantomTipDesc')}
                    type="info"
                    showIcon
                  />
                </Col>
              </Row>
            );
          }
          if (currentSourceType === 'Service') {
            return (
              <Row gutter={16} style={{ marginTop: 0 }}>
                <Col span={24}>
                  <Alert
                    message={t('app.master-data.source.serviceTip')}
                    description={t('app.master-data.source.serviceTipDesc')}
                    type="info"
                    showIcon
                  />
                </Col>
              </Row>
            );
          }
          return null;
        }}
      </ProFormDependency>
    </Card>
  );
};

export default MaterialForm;
