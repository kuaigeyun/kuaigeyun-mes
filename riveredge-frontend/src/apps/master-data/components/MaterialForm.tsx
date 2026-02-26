/**
 * 物料表单组件（多标签页）
 *
 * 实现物料的新建和编辑功能，包含标签页：
 * 1. 基本信息（含物料来源）
 * 2. 变体管理
 * 3. 多单位管理
 * 4. 编码映射
 * 5. 默认值设置
 *
 * Author: Luigi Lu
 * Date: 2026-01-08
 */

import React, { useState, useEffect, useRef, useCallback, useMemo, useImperativeHandle, forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Modal, Tabs, App, Table, Button, Form, Input, Select, Collapse, Row, Col, Alert, Tag, Space, Switch } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, LinkOutlined } from '@ant-design/icons';
import { ProForm, ProFormInstance, ProFormText, ProFormTextArea, ProFormSwitch, ProFormSelect, ProFormDigit, ProFormDependency, ProFormUploadButton } from '@ant-design/pro-components';
import type { Material, MaterialCreate, MaterialUpdate, DepartmentCodeMapping, CustomerCodeMapping, SupplierCodeMapping, MaterialDefaults, MaterialUnits, MaterialUnit, MaterialCodeMapping } from '../types/material';
import type { Customer } from '../types/supply-chain';
import type { Supplier } from '../types/supply-chain';
import SafeProFormSelect from '../../../components/safe-pro-form-select';
import { customerApi } from '../services/supply-chain';
import { supplierApi } from '../services/supply-chain';
import { warehouseApi } from '../services/warehouse';
import { processRouteApi, operationApi } from '../services/process';
import { materialSourceApi, materialCodeMappingApi } from '../services/material';
import type { Warehouse } from '../types/warehouse';
import type { ProcessRoute, Operation } from '../types/process';
import type { VariantAttributeDefinition } from '../types/variant-attribute';
import { variantAttributeApi } from '../services/variant-attribute';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../utils/codeRulePage';
import { testGenerateCode } from '../../../services/codeRule';
import DictionarySelect from '../../../components/dictionary-select';
import { getDataDictionaryByCode, getDictionaryItemList } from '../../../services/dataDictionary';
import SmartSuggestionFloatPanel from '../../../components/smart-suggestion-float-panel';
import { getFileDownloadUrl, uploadMultipleFiles } from '../../../services/file';
import { batchRuleApi, serialRuleApi } from '../services/batchSerialRules';

const { Panel } = Collapse;

/** 每种物料来源类型的合法字段白名单（用于过滤混合字段） */
const SOURCE_CONFIG_FIELDS: Record<string, string[]> = {
  Make: ['manufacturing_mode', 'production_lead_time', 'min_production_batch', 'production_waste_rate'],
  Buy: ['purchase_price', 'purchase_lead_time', 'min_purchase_batch', 'default_supplier_id', 'default_supplier_name'],
  Outsource: ['outsource_supplier_id', 'outsource_supplier_name', 'outsource_lead_time', 'min_outsource_batch', 'outsource_operation', 'outsource_price', 'material_provided_by'],
  Phantom: [],
  Configure: [],
};

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
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const formRef = useRef<ProFormInstance>();
  const sourceTypeOptions = useMemo(() => [
    { label: t('app.master-data.materialForm.sourceMake'), value: 'Make' },
    { label: t('app.master-data.materialForm.sourceBuy'), value: 'Buy' },
    { label: t('app.master-data.materialForm.sourcePhantom'), value: 'Phantom' },
    { label: t('app.master-data.materialForm.sourceOutsource'), value: 'Outsource' },
    { label: t('app.master-data.materialForm.sourceConfigure'), value: 'Configure' },
  ], [t]);
  const [activeTab, setActiveTab] = useState<string>('basic');
  const [variantManaged, setVariantManaged] = useState<boolean>(false);
  
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

  // 编码映射数据
  const [departmentCodes, setDepartmentCodes] = useState<DepartmentCodeMapping[]>([]);
  const [customerCodes, setCustomerCodes] = useState<CustomerCodeMapping[]>([]);
  const [supplierCodes, setSupplierCodes] = useState<SupplierCodeMapping[]>([]);
  const [externalSystemCodes, setExternalSystemCodes] = useState<MaterialCodeMapping[]>([]);
  const [externalSystemCodesLoading, setExternalSystemCodesLoading] = useState(false);

  // 智能建议状态（用于物料来源标签页，悬浮面板展示）
  const [suggestionResult, setSuggestionResult] = useState<{
    suggested_type: string | null;
    confidence: number;
    reasons: string[];
  } | null>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const materialSourceTabRef = useRef<{
    applySuggestion: (type: string, manufacturingMode?: string) => void;
  } | null>(null);

  // 验证与完整性检查状态（用于物料来源标签页，悬浮面板展示）
  const [validationResult, setValidationResult] = useState<{
    is_valid: boolean;
    errors: string[];
    warnings: string[];
  } | null>(null);
  const [completenessResult, setCompletenessResult] = useState<{
    is_complete: boolean;
    missing_configs: string[];
    warnings: string[];
  } | null>(null);
  const [loadingValidation, setLoadingValidation] = useState(false);
  const [loadingCompleteness, setLoadingCompleteness] = useState(false);

  // 多单位管理提示（用于多单位管理标签页，悬浮面板展示）
  const [unitMessages, setUnitMessages] = useState<Array<{ text: string; title?: string }>>([]);

  /**
   * 加载客户列表
   */
  const loadCustomers = async () => {
    try {
      setCustomersLoading(true);
      const result = await customerApi.list({ limit: 1000, isActive: true });
      setCustomers(result);
    } catch (error: any) {
      console.error('加载客户列表失败:', error);
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
      setSuppliers(result);
    } catch (error: any) {
      console.error('加载供应商列表失败:', error);
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
      const result = await warehouseApi.list({ limit: 1000, isActive: true });
      setWarehouses(result);
    } catch (error: any) {
      console.error('加载仓库列表失败:', error);
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
      setProcessRoutes(result);
    } catch (error: any) {
      console.error('加载工艺路线列表失败:', error);
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
      const result = await operationApi.list({ limit: 1000, is_active: true });
      setOperations(result);
    } catch (error: any) {
      console.error('加载工序列表失败:', error);
    } finally {
      setOperationsLoading(false);
    }
  };

  /**
   * 加载外部系统编码映射
   */
  const loadExternalSystemCodes = async (materialUuid: string) => {
    try {
      setExternalSystemCodesLoading(true);
      const result = await materialCodeMappingApi.list({ materialUuid, page: 1, pageSize: 1000 });
      setExternalSystemCodes(result.items || []);
    } catch (error: any) {
      console.error('加载外部系统编码映射失败:', error);
    } finally {
      setExternalSystemCodesLoading(false);
    }
  };

  /**
   * 加载物料来源智能建议
   */
  const loadSuggestion = useCallback(async () => {
    if (!material?.uuid) return;
    try {
      setLoadingSuggestion(true);
      const result = await materialSourceApi.suggest(material.uuid);
      setSuggestionResult(result);
    } catch (error: any) {
      messageApi.error(t('app.master-data.materialForm.getSuggestionFailedWithError', { error: error.message || t('common.unknownError') }));
    } finally {
      setLoadingSuggestion(false);
    }
  }, [material?.uuid, messageApi]);

  const validateSourceConfig = useCallback(async () => {
    if (!material?.uuid) return;
    try {
      setLoadingValidation(true);
      const result = await materialSourceApi.validate(material.uuid);
      setValidationResult(result);
    } catch (error: any) {
      messageApi.error(t('app.master-data.materialForm.validationFailedWithError', { error: error.message || t('common.unknownError') }));
    } finally {
      setLoadingValidation(false);
    }
  }, [material?.uuid, messageApi]);

  const checkCompleteness = useCallback(async () => {
    if (!material?.uuid) return;
    try {
      setLoadingCompleteness(true);
      const result = await materialSourceApi.checkCompleteness(material.uuid);
      setCompletenessResult(result);
    } catch (error: any) {
      messageApi.error(t('app.master-data.materialForm.checkFailedWithError', { error: error.message || t('common.unknownError') }));
    } finally {
      setLoadingCompleteness(false);
    }
  }, [material?.uuid, messageApi]);

  useEffect(() => {
    if (open && activeTab === 'basic' && material?.uuid) {
      loadSuggestion();
      validateSourceConfig();
      checkCompleteness();
    } else if (!open || activeTab !== 'basic') {
      setSuggestionResult(null);
      setValidationResult(null);
      setCompletenessResult(null);
    }
  }, [open, activeTab, material?.uuid, loadSuggestion, validateSourceConfig, checkCompleteness]);

  /**
   * 生成编码的辅助函数
   * 
   * @param groupId - 物料分组ID
   * @param materialType - 物料类型
   * @param name - 物料名称
   * @param forceUpdate - 是否强制更新编码（即使字段已有值）
   */
  const generateCode = useCallback(async (groupId?: number, materialType?: string, name?: string, forceUpdate: boolean = false) => {
    if (isEdit || !isAutoGenerateEnabled('master-data-material')) {
      return;
    }

    const ruleCode = getPageRuleCode('master-data-material');
    if (!ruleCode) {
      console.warn('物料编码规则未配置');
      return;
    }
    
    // 调试信息：检查规则代码是否正确
    if (ruleCode === 'PROCESS_ROUTE_CODE') {
      console.error('错误：物料页面使用了工艺路线的编码规则！请检查 localStorage 中的 codeRulePageConfigs 配置。');
      messageApi.error(t('app.master-data.materialForm.codeRuleConfigError'));
      return;
    }

    // 构建上下文（用于编码规则）
    const context: Record<string, any> = {};
    
    // 如果提供了物料分组ID，获取分组信息
    if (groupId) {
      const group = materialGroups.find(g => g.id === groupId);
      if (group) {
        context.group_code = group.code;
        context.group_name = group.name;
      }
    }
    
    // 添加物料类型（如果有）
    if (materialType) {
      context.material_type = materialType;
    }
    
    // 添加物料名称（如果有）
    if (name) {
      context.name = name;
    }
    
    // 使用测试生成API预览编码（不更新序号，但会检测重复并自动递增）
    try {
      const codeResponse = await testGenerateCode({
        rule_code: ruleCode,
        context: Object.keys(context).length > 0 ? context : undefined,
        check_duplicate: true, // 启用重复检测
        entity_type: 'material', // 指定实体类型为物料
      });
      
      // 如果强制更新，或者字段为空，或者包含占位符，则更新编码
      const currentMainCode = formRef.current?.getFieldValue('mainCode');
      if (forceUpdate || !currentMainCode || currentMainCode.startsWith('[FIELD:') || currentMainCode === '') {
        formRef.current?.setFieldsValue({
          mainCode: codeResponse.code,
        });
      }
    } catch (error) {
      console.warn('自动生成编码失败:', error);
    }
  }, [isEdit, materialGroups]);

  /**
   * 初始化数据
   */
  useEffect(() => {
    if (open) {
      // 加载所有需要的数据
      loadCustomers();
      loadSuppliers();
      loadWarehouses();
      loadProcessRoutes();
      loadOperations();

      // 如果是新建模式且启用了自动编码，生成编码
      if (!isEdit) {
        generateCode(initialValues?.groupId, initialValues?.materialType, initialValues?.name);
      }

      // 如果是编辑模式，加载物料数据
      if (isEdit && material) {
        // 从物料数据中加载编码映射和默认值
        // 兼容处理：后端可能返回 code_aliases 或 codeAliases
        const aliases = (material as any).code_aliases || material.codeAliases || [];
        
        if (aliases && aliases.length > 0) {
          // 分离不同类型的编码
          const deptCodes: DepartmentCodeMapping[] = [];
          const custCodes: CustomerCodeMapping[] = [];
          const suppCodes: SupplierCodeMapping[] = [];
          
          aliases.forEach((alias: any) => {
            // 兼容处理：后端可能返回 snake_case 或 camelCase
            const codeType = alias.code_type || alias.codeType;
            const externalEntityType = alias.external_entity_type || alias.externalEntityType;
            const externalEntityId = alias.external_entity_id || alias.externalEntityId;
            
            if (codeType === 'CUSTOMER' || externalEntityType === 'customer') {
              const customerId = externalEntityId || 0;
              // 注意：这里 customers 可能还没有加载完成，所以先设置ID，后续再更新名称
              custCodes.push({
                customerId,
                customerUuid: undefined,
                customerName: undefined,
                code: alias.code,
                description: alias.description,
              });
            } else if (codeType === 'SUPPLIER' || externalEntityType === 'supplier') {
              const supplierId = externalEntityId || 0;
              // 注意：这里 suppliers 可能还没有加载完成，所以先设置ID，后续再更新名称
              suppCodes.push({
                supplierId,
                supplierUuid: undefined,
                supplierName: undefined,
                code: alias.code,
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
        
        // 加载外部系统编码映射
        if (material.uuid) {
          loadExternalSystemCodes(material.uuid);
        }
        
        // 处理图片预填
        const materialImages = (material as any).images || [];
        if (materialImages.length > 0) {
          setTimeout(() => {
            formRef.current?.setFieldsValue({
              images: materialImages.map((uuid: string) => ({
                uid: uuid,
                name: t('app.master-data.materialForm.images'),
                status: 'done',
                url: getFileDownloadUrl(uuid),
              }))
            });
          }, 100);
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
            // ProForm 的 name="defaults.defaultProcessRouteUuid" 需要扁平 key 才能正确显示
            if (formDefaults.defaultProcessRouteUuid != null) {
              fieldsToSet['defaults.defaultProcessRouteUuid'] = formDefaults.defaultProcessRouteUuid;
            }
            formRef.current?.setFieldsValue(fieldsToSet);
          }, 100);
        }
        
        // 加载物料来源数据（兼容处理：后端可能返回 snake_case 或 camelCase）
        const materialSourceType = (material as any).source_type || material.sourceType;
        const materialSourceConfig = (material as any).source_config || material.sourceConfig;
        
        if (materialSourceType || materialSourceConfig) {
          setTimeout(() => {
            // 关键修复：ProForm 的条件渲染字段使用扁平 key，需要同时设置嵌套对象和扁平 key
            const fieldsToSet: any = {
              sourceType: materialSourceType,
              source_type: materialSourceType, // 向后兼容
              sourceConfig: materialSourceConfig,
              source_config: materialSourceConfig, // 向后兼容
            };
            
            // 将 sourceConfig 的每个字段展开为扁平 key（如 sourceConfig.manufacturing_mode）
            if (materialSourceConfig && typeof materialSourceConfig === 'object') {
              Object.keys(materialSourceConfig).forEach(key => {
                fieldsToSet[`sourceConfig.${key}`] = materialSourceConfig[key];
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
   * 当客户列表加载完成后，更新客户编码映射中的名称
   */
  useEffect(() => {
    if (customers.length > 0 && customerCodes.length > 0) {
      const updatedCodes = customerCodes.map(code => {
        const customer = customers.find(c => c.id === code.customerId);
        if (customer) {
          return {
            ...code,
            customerUuid: customer.uuid,
            customerName: customer.name,
          };
        }
        return code;
      });
      // 检查是否有变化
      const hasChanges = updatedCodes.some((code, index) => {
        const oldCode = customerCodes[index];
        return !oldCode || code.customerName !== oldCode.customerName;
      });
      if (hasChanges) {
        setCustomerCodes(updatedCodes);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers.length]); // 只依赖 customers 的长度变化
  
  /**
   * 当供应商列表加载完成后，更新供应商编码映射中的名称
   */
  useEffect(() => {
    if (suppliers.length > 0 && supplierCodes.length > 0) {
      const updatedCodes = supplierCodes.map(code => {
        const supplier = suppliers.find(s => s.id === code.supplierId);
        if (supplier) {
          return {
            ...code,
            supplierUuid: supplier.uuid,
            supplierName: supplier.name,
          };
        }
        return code;
      });
      // 检查是否有变化
      const hasChanges = updatedCodes.some((code, index) => {
        const oldCode = supplierCodes[index];
        return !oldCode || code.supplierName !== oldCode.supplierName;
      });
      if (hasChanges) {
        setSupplierCodes(updatedCodes);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suppliers.length]); // 只依赖 suppliers 的长度变化

  /**
   * 处理表单提交
   */
  const handleSubmit = async (values: any) => {
    try {
      // 处理物料来源数据（兼容处理：同时设置 camelCase 和 snake_case）
      const sourceType = values.sourceType || values.source_type;
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
      const allowedFields = SOURCE_CONFIG_FIELDS[sourceType] || [];
      const filteredSourceConfig: Record<string, any> = {};
      for (const key of Object.keys(sourceConfig)) {
        if (allowedFields.includes(key)) {
          filteredSourceConfig[key] = sourceConfig[key];
        }
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
      const existingDefaults = (material as any)?.defaults || {};
      let formDefaultsRaw = values.defaults || {};
      // 兼容：若 values 中没有 defaults，尝试从 formRef 直接读取（处理条件渲染字段）
      if (Object.keys(formDefaultsRaw).length === 0 && formRef.current) {
        const directDefaults = formRef.current.getFieldValue('defaults');
        if (directDefaults && Object.keys(directDefaults).length > 0) {
          formDefaultsRaw = directDefaults;
        }
      }
      // ProForm 可能用扁平 key 存储嵌套字段，兼容 values['defaults.defaultProcessRouteUuid']
      const formDefaults = {
        ...formDefaultsRaw,
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
      let processRouteIdForSubmit: number | undefined;
      const defaultProcessRouteUuid = formDefaults.defaultProcessRouteUuid;
      if (defaultProcessRouteUuid && processRoutes.length > 0) {
        const route = processRoutes.find(pr => pr.uuid === defaultProcessRouteUuid);
        if (route) {
          processedDefaults.defaultProcessRoute = route.id;
          processedDefaults.defaultProcessRouteUuid = route.uuid;
          processRouteIdForSubmit = route.id;
        }
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
      const submitData: any = {
        // 基础字段转换（驼峰 -> 蛇形）
        main_code: restValues.mainCode,
        name: restValues.name,
        group_id: restValues.groupId,
        process_route_id: sourceType === 'Make' ? (processRouteIdForSubmit ?? (material as any)?.process_route_id ?? (material as any)?.processRouteId ?? null) : ((material as any)?.process_route_id ?? (material as any)?.processRouteId),
        material_type: restValues.materialType,
        specification: restValues.specification,
        base_unit: restValues.baseUnit, // 关键：转换为 base_unit
        units: restValues.units,
        batch_managed: restValues.batchManaged,
        default_batch_rule_id: restValues.defaultBatchRuleId || null,
        serial_managed: restValues.serialManaged,
        default_serial_rule_id: restValues.defaultSerialRuleId || null,
        variant_managed: restValues.variantManaged,
        variant_attributes: restValues.variantAttributes,
        description: restValues.description,
        brand: restValues.brand,
        model: restValues.model,
        is_active: restValues.isActive,
        images: imageUuids.length > 0 ? imageUuids : null,
        // 部门编码
        department_codes: departmentCodes.length > 0 ? departmentCodes.map(code => ({
          code_type: code.code_type,
          code: code.code,
          department: code.department,
          description: code.description,
        })) : undefined,
        // 客户编码
        customer_codes: customerCodes.length > 0 ? customerCodes.map(code => ({
          customer_id: code.customerId,
          code: code.code,
          description: code.description,
        })) : undefined,
        // 供应商编码
        supplier_codes: supplierCodes.length > 0 ? supplierCodes.map(code => ({
          supplier_id: code.supplierId,
          code: code.code,
          description: code.description,
        })) : undefined,
        // 默认值
        defaults: Object.keys(filteredDefaults).length > 0 ? filteredDefaults : undefined,
        // 物料来源控制
        source_type: sourceType,
        source_config: filteredSourceConfig,
      };
      
      // 移除 undefined 值
      Object.keys(submitData).forEach(key => {
        if (submitData[key] === undefined) {
          delete submitData[key];
        }
      });

      const result = await onFinish(submitData);
      
      // 如果是新建模式，需要等待物料创建完成后再保存外部系统编码映射
      // 如果是编辑模式，外部系统编码映射已经在 CodeMappingTab 中单独管理
      // 这里不需要额外处理，因为外部系统编码映射是独立实体，有自己的API
      
      return result;
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.materialForm.submitFailed'));
      throw error;
    }
  };

  /**
   * 处理变体管理开关变化
   */
  const handleVariantManagedChange = (checked: boolean) => {
    setVariantManaged(checked);
    if (!checked) {
      // 如果关闭变体管理，清空变体属性
      formRef.current?.setFieldsValue({
        variantAttributes: undefined,
      });
    }
  };

  const handleApplySuggestion = useCallback(() => {
    if (suggestionResult?.suggested_type) {
      const manufacturingMode = (suggestionResult as any).suggested_manufacturing_mode;
      materialSourceTabRef.current?.applySuggestion(
        suggestionResult.suggested_type,
        manufacturingMode
      );
    }
  }, [suggestionResult]);

  const suggestionForPanel = useMemo(
    () =>
      suggestionResult?.suggested_type
        ? {
            suggested_type: suggestionResult.suggested_type,
            confidence: suggestionResult.confidence,
            reasons: suggestionResult.reasons || [],
          }
        : null,
    [suggestionResult]
  );

  const showSourcePanel =
    open &&
    activeTab === 'basic' &&
    !!material?.uuid &&
    (loadingSuggestion ||
      loadingValidation ||
      loadingCompleteness ||
      !!(suggestionResult?.suggested_type) ||
      !!validationResult ||
      (!!completenessResult && !completenessResult.is_complete));

  const showUnitsPanel = open && activeTab === 'units' && unitMessages.length > 0;

  return (
    <>
      <SmartSuggestionFloatPanel
        visible={showSourcePanel || showUnitsPanel}
        loading={
          activeTab === 'basic'
            ? loadingSuggestion || loadingValidation || loadingCompleteness
            : false
        }
        anchorSelector="[data-smart-suggestion-anchor='material-form']"
        suggestion={activeTab === 'basic' ? suggestionForPanel : null}
        validationResult={activeTab === 'basic' ? validationResult : null}
        completenessResult={activeTab === 'basic' ? completenessResult : null}
        messages={activeTab === 'units' ? unitMessages : undefined}
        sourceTypeOptions={sourceTypeOptions}
        onApply={activeTab === 'basic' ? handleApplySuggestion : undefined}
        onRevalidate={activeTab === 'basic' ? validateSourceConfig : undefined}
        loadingValidation={activeTab === 'basic' ? loadingValidation : false}
      />
      <style>{`
        /* ==================== MaterialForm Modal 样式 - 完全重写（按 Ant Design 最佳实践） ==================== */
        /* 备份说明：原样式已移除，以下为按 Ant Design 最佳实践完全重写的样式 */
        
        /* Modal 内的 Tabs 内容区域 - 去除顶部多余 padding */
        .material-form-modal .ant-pro-form .ant-tabs-content-holder {
          padding-top: 0;
        }
        
        /* Modal 内的 Tab 内容 - 确保占满宽度并统一边距（使用硬编码宽度） */
        .material-form-modal .ant-pro-form .ant-tabs-tabpane {
          width: 968px;
          padding: 0 8px 16px 8px;
          box-sizing: border-box;
        }
        
        /* 基本信息 和 变体管理 Tab - 移除左右padding（使用:has()选择器，基于内容特征） */
        /* 基本信息Tab和变体管理Tab都直接包含.ant-row.gutter，而多单位管理和编码映射Tab不直接包含 */
        .material-form-modal .ant-pro-form .ant-tabs-tabpane:has(> .ant-row[class*="gutter"]:first-child) {
          padding-left: 0 !important;
          padding-right: 0 !important;
        }
        
        /* Modal 内的 Collapse - 确保占满宽度 */
        .material-form-modal .ant-collapse {
          width: 100%;
        }
        
        /* 默认值设置Tab的Collapse - 增加底部margin */
        .material-form-modal .ant-tabs-tabpane .ant-collapse {
          margin-bottom: 16px;
        }
        
        /* Modal 内 Collapse 的 Panel 内容 - 确保占满宽度 */
        .material-form-modal .ant-collapse-content-box {
          width: 100%;
        }
        
        /* Modal 内 Collapse 的 Panel 内容 - 确保占满宽度 */
        .material-form-modal .ant-collapse-content-box {
          width: 100%;
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
      <Modal
        className="material-form-modal"
        title={isEdit ? t('app.master-data.materialForm.editMaterial') : t('app.master-data.materialForm.createMaterial')}
        open={open}
        onCancel={onClose}
        footer={null}
        width={1000}
        destroyOnHidden
        modalRender={(modal) => (
          <div data-smart-suggestion-anchor="material-form">
            {modal}
          </div>
        )}
      >
        <ProForm
        formRef={formRef}
        loading={loading}
        onFinish={handleSubmit}
        initialValues={
          !isEdit && !(initialValues?.baseUnit != null && initialValues?.baseUnit !== '')
            ? { ...initialValues, baseUnit: 'PC' }
            : initialValues
        }
        layout="vertical"
        grid={true}
        rowProps={{ gutter: 16 }}
        onValuesChange={(changedValues, allValues) => {
          // 当物料分组、物料类型或名称变化时，重新生成编码
          if (!isEdit && isAutoGenerateEnabled('master-data-material')) {
            const groupId = allValues.groupId;
            const materialType = allValues.materialType;
            const name = allValues.name;
            
            // 如果物料分组变化，强制更新编码
            if (changedValues.groupId !== undefined) {
              // 延迟生成编码，避免频繁调用
              setTimeout(() => {
                generateCode(groupId, materialType, name, true); // 强制更新
              }, 300);
            } else if (changedValues.materialType !== undefined || changedValues.name !== undefined) {
              // 物料类型或名称变化时，只在编码为空或包含占位符时更新
              setTimeout(() => {
                generateCode(groupId, materialType, name, false);
              }, 300);
            }
          }
        }}
        submitter={{
          searchConfig: {
            submitText: isEdit ? t('app.master-data.materialForm.update') : t('app.master-data.materialForm.create'),
            resetText: t('app.master-data.materialForm.cancel'),
          },
          resetButtonProps: {
            onClick: onClose,
          },
        }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          destroyInactiveTabPane={false}
          items={[
            {
              key: 'basic',
              label: t('app.master-data.materialForm.basicInfo'),
              children: (
                <>
                  <BasicInfoTab part={1} formRef={formRef} materialGroups={materialGroups} isEdit={isEdit} />
                  <MaterialSourceTab
                    ref={materialSourceTabRef}
                    formRef={formRef}
                    material={material}
                    suppliers={suppliers}
                    processRoutes={processRoutes}
                    operations={operations}
                    suppliersLoading={suppliersLoading}
                    processRoutesLoading={processRoutesLoading}
                    operationsLoading={operationsLoading}
                    onValidate={validateSourceConfig}
                    onCheckCompleteness={checkCompleteness}
                  />
                  <BasicInfoTab part={2} formRef={formRef} materialGroups={[]} variantManaged={variantManaged} onVariantManagedChange={handleVariantManagedChange} isEdit={isEdit} />
                </>
              ),
            },
            {
              key: 'variant',
              label: t('app.master-data.materialForm.variantManagement'),
              disabled: !variantManaged,
              children: (
                <VariantManagementTab />
              ),
            },
            {
              key: 'units',
              label: t('app.master-data.materialForm.multiUnit'),
              children: (
                <MaterialUnitsManager formRef={formRef} onMessagesChange={setUnitMessages} />
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
              key: 'defaults',
              label: t('app.master-data.materialForm.defaults'),
              children: (
                <DefaultsTab
                  suppliers={suppliers}
                  customers={customers}
                  warehouses={warehouses}
                  suppliersLoading={suppliersLoading}
                  customersLoading={customersLoading}
                  warehousesLoading={warehousesLoading}
                />
              ),
            },
          ]}
        />
      </ProForm>
    </Modal>
    </>
  );
};

/**
 * 多单位管理组件
 */
interface MaterialUnitsManagerProps {
  formRef: React.RefObject<ProFormInstance>;
  onMessagesChange?: (messages: Array<{ text: string; title?: string }>) => void;
}

const MaterialUnitsManager: React.FC<MaterialUnitsManagerProps> = ({ formRef, onMessagesChange }) => {
  const { t } = useTranslation();
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

  // 初始化数据并监听表单变化
  useEffect(() => {
    const updateFromForm = () => {
      const formValues = formRef?.current?.getFieldsValue();
      if (formValues) {
        const unitsData = formValues.units;
        if (unitsData && (unitsData.units || unitsData.scenarios)) {
          setUnits(unitsData.units || []);
          setScenarios(unitsData.scenarios || {});
        }
        if (formValues.baseUnit && formValues.baseUnit !== baseUnit) {
          setBaseUnit(formValues.baseUnit);
        }
      }
    };
    
    // 立即执行一次
    updateFromForm();
    
    // 监听表单字段变化（使用较短的间隔以确保响应及时）
    const timer = setInterval(updateFromForm, 500);
    
    return () => clearInterval(timer);
  }, [formRef, baseUnit]);

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
    formRef?.current?.setFieldsValue({
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

  // 验证多单位配置是否正确
  const validateUnits = () => {
    const errors: string[] = [];
    const unitNames = new Set<string>();
    
    units.forEach((unit, index) => {
      if (!unit.unit || !unit.unit.trim()) {
        errors.push(t('app.master-data.materialForm.unitNameEmpty', { index: index + 1 }));
      } else {
        const unitName = unit.unit.trim();
        if (unitNames.has(unitName)) {
          errors.push(t('app.master-data.materialForm.unitNameDuplicate', { name: unitName }));
        }
        unitNames.add(unitName);
      }
      
      if (unit.unit && unit.unit.trim() === baseUnit) {
        errors.push(t('app.master-data.materialForm.unitSameAsBase', { unit: unit.unit }));
      }
      
      if (!unit.numerator || unit.numerator <= 0) {
        errors.push(t('app.master-data.materialForm.numeratorMin', { unit: unit.unit || `第${index + 1}行` }));
      }
      
      if (!unit.denominator || unit.denominator <= 0) {
        errors.push(t('app.master-data.materialForm.denominatorMin', { unit: unit.unit || `第${index + 1}行` }));
      }
    });
    
    return errors;
  };

  const validationErrors = validateUnits();
  const hasErrors = validationErrors.length > 0;

  useEffect(() => {
    if (!onMessagesChange) return;
    const messages: Array<{ text: string; title?: string }> = [];

    if (!baseUnit) {
      messages.push({ text: t('app.master-data.materialForm.setBaseUnitFirst'), title: t('app.master-data.materialForm.baseSettings') });
    }

    messages.push({
      text: t('app.master-data.materialForm.conversionHint'),
      title: t('app.master-data.materialForm.conversionTitle'),
    });

    if (hasErrors) {
      messages.push({
        text: `配置错误：\n${validationErrors.map((e, i) => `${i + 1}. ${e}`).join('\n')}`,
        title: t('app.master-data.materialForm.configValidation'),
      });
    } else if (units.length > 0 && baseUnit) {
      const baseLabel = unitValueToLabel[baseUnit] || baseUnit;
      const unitLines = units
        .map((unit, i) => {
          const n = unit.numerator || 1;
          const d = unit.denominator || 1;
          const rate = n / d;
          const isInt = Number.isInteger(rate);
          const ul = unit.unit ? unitValueToLabel[unit.unit] || unit.unit : unit.unit;
          return `• ${ul}：1 ${ul} = ${isInt ? rate : `${n}/${d}`} ${baseLabel}`;
        })
        .join('\n');
      let configText = `多单位配置正确\n\n基础单位：${baseLabel}（库存单位）\n\n辅助单位配置：\n${unitLines}`;
      if (scenarios.purchase || scenarios.sale || scenarios.production) {
        configText += '\n\n场景单位映射：';
        if (scenarios.purchase) configText += `\n• 采购单位：${unitValueToLabel[scenarios.purchase] || scenarios.purchase}`;
        if (scenarios.sale) configText += `\n• 销售单位：${unitValueToLabel[scenarios.sale] || scenarios.sale}`;
        if (scenarios.production) configText += `\n• 生产单位：${unitValueToLabel[scenarios.production] || scenarios.production}`;
        configText += `\n• 库存单位：${baseLabel}（基础单位）`;
      }
      messages.push({ text: configText, title: t('app.master-data.materialForm.configOverview') });
    }

    onMessagesChange(messages);
  }, [baseUnit, units, scenarios, hasErrors, validationErrors, unitValueToLabel, onMessagesChange, t]);

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
            基础单位：<strong>{unitValueToLabel[baseUnit] || baseUnit}</strong>
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
            添加辅助单位
          </Button>
        )}
      />
      {units.length > 0 && allUnits.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>场景单位映射（可选）</div>
          <div style={{ marginBottom: 8, color: '#666', fontSize: 12 }}>
            为不同业务场景指定默认使用的单位，如果不指定，则使用基础单位
          </div>
          <Row gutter={16}>
            <Col span={6}>
              <div style={{ marginBottom: 8 }}>采购单位</div>
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
              <div style={{ marginBottom: 8 }}>销售单位</div>
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
              <div style={{ marginBottom: 8 }}>生产单位</div>
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
              <div style={{ marginBottom: 8 }}>库存单位</div>
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
interface BasicInfoTabProps {
  part: 1 | 2;
  formRef: React.RefObject<ProFormInstance>;
  materialGroups: Array<{ id: number; code: string; name: string }>;
  variantManaged?: boolean;
  onVariantManagedChange?: (checked: boolean) => void;
  isEdit: boolean;
}

const BasicInfoTab: React.FC<BasicInfoTabProps> = ({
  part,
  formRef,
  materialGroups,
  variantManaged,
  onVariantManagedChange,
  isEdit,
}) => {
  const { t } = useTranslation();
  const [batchRules, setBatchRules] = useState<{ id: number; name: string; code: string }[]>([]);
  const [serialRules, setSerialRules] = useState<{ id: number; name: string; code: string }[]>([]);

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

  if (part === 1) {
    return (
      <Row gutter={16}>
        <Col span={6}>
          <ProFormText
            name="mainCode"
            label={t('app.master-data.materialForm.mainCode')}
            placeholder={isAutoGenerateEnabled('master-data-material') ? t('app.master-data.materialForm.mainCodeAuto') : t('app.master-data.materialForm.mainCodePlaceholder')}
            rules={[
              { required: true, message: t('app.master-data.materialForm.mainCodeRequired') },
              { max: 50, message: t('app.master-data.materialForm.mainCodeMax') },
            ]}
            fieldProps={{ style: { textTransform: 'uppercase' } }}
            extra={!isEdit && isAutoGenerateEnabled('master-data-material') ? t('app.master-data.materialForm.mainCodeExtra') : undefined}
          />
        </Col>
        <Col span={6}>
          <ProFormText
            name="name"
            label={t('app.master-data.materialForm.materialName')}
            placeholder={t('app.master-data.materialForm.materialNamePlaceholder')}
            rules={[
              { required: true, message: t('app.master-data.materialForm.materialNameRequired') },
              { max: 200, message: t('app.master-data.materialForm.materialNameMax') },
            ]}
          />
        </Col>
        <Col span={6}>
          <SafeProFormSelect
            name="groupId"
            label={t('app.master-data.materialForm.materialGroup')}
            placeholder={t('app.master-data.materialForm.materialGroupPlaceholder')}
            options={materialGroups.map(g => ({
              label: `${g.code} - ${g.name}`,
              value: g.id,
            }))}
            fieldProps={{ showSearch: true, allowClear: true }}
          />
        </Col>
        <Col span={6}>
          <DictionarySelect
            dictionaryCode="MATERIAL_TYPE"
            name="materialType"
            label={t('app.master-data.materialForm.materialType')}
            placeholder={t('app.master-data.materialForm.materialTypePlaceholder')}
            formRef={formRef}
          />
        </Col>
        <Col span={6}>
          <ProFormText
            name="specification"
            label={t('app.master-data.materialForm.specification')}
            placeholder={t('app.master-data.materialForm.specificationPlaceholder')}
            rules={[{ max: 500, message: t('app.master-data.materialForm.specificationMax') }]}
          />
        </Col>
        <Col span={6}>
          <ProFormText
            name="model"
            label={t('app.master-data.materialForm.model')}
            placeholder={t('app.master-data.materialForm.modelPlaceholder')}
            rules={[{ max: 100, message: t('app.master-data.materialForm.modelMax') }]}
          />
        </Col>
        <Col span={6}>
          <DictionarySelect
            dictionaryCode="MATERIAL_UNIT"
            name="baseUnit"
            label={t('app.master-data.materialForm.baseUnit')}
            placeholder={t('app.master-data.materialForm.baseUnitPlaceholder')}
            required
            formRef={formRef}
          />
        </Col>
        <Col span={6}>
          <ProFormText
            name="brand"
            label={t('app.master-data.materialForm.brand')}
            placeholder={t('app.master-data.materialForm.brandPlaceholder')}
            rules={[{ max: 100, message: t('app.master-data.materialForm.brandMax') }]}
          />
        </Col>
      </Row>
    );
  }

  return (
    <Row gutter={16}>
      <Col span={6}>
        <ProFormSwitch name="batchManaged" label={t('app.master-data.materialForm.batchManaged')} />
      </Col>
      <Col span={6}>
        <ProFormSwitch name="serialManaged" label={t('app.master-data.materialForm.serialManaged')} />
      </Col>
      <Col span={6}>
        <ProFormSwitch
          name="variantManaged"
          label={t('app.master-data.materialForm.variantManaged')}
          fieldProps={{ onChange: onVariantManagedChange }}
        />
      </Col>
      <Col span={6}>
        <ProFormSwitch name="isActive" label={t('app.master-data.materialForm.isActive')} />
      </Col>
      <ProFormDependency name={['batchManaged']}>
        {({ batchManaged }) =>
          batchManaged ? (
            <Col span={12}>
              <ProFormSelect
                name="defaultBatchRuleId"
                label={t('app.master-data.materialForm.defaultBatchRule')}
                placeholder={t('app.master-data.materialForm.defaultBatchRulePlaceholder')}
                options={batchRules.map((r) => ({ label: `${r.name} (${r.code})`, value: r.id }))}
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
                label={t('app.master-data.materialForm.defaultSerialRule')}
                placeholder={t('app.master-data.materialForm.defaultSerialRulePlaceholder')}
                options={serialRules.map((r) => ({ label: `${r.name} (${r.code})`, value: r.id }))}
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
          max={5}
          fieldProps={{
            multiple: true,
            listType: "picture-card",
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
  );
};

/**
 * 变体管理标签页
 */
const VariantManagementTab: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [variantAttributeDefinitions, setVariantAttributeDefinitions] = useState<VariantAttributeDefinition[]>([]);
  const [definitionsLoading, setDefinitionsLoading] = useState(false);

  // 加载变体属性定义
  useEffect(() => {
    const loadDefinitions = async () => {
      setDefinitionsLoading(true);
      try {
        const definitions = await variantAttributeApi.list({ is_active: true });
        // 按显示顺序排序
        definitions.sort((a, b) => a.display_order - b.display_order);
        setVariantAttributeDefinitions(definitions);
      } catch (error: any) {
        messageApi.error(error.message || t('app.master-data.materialForm.loadVariantDefFailed'));
      } finally {
        setDefinitionsLoading(false);
      }
    };

    loadDefinitions();
  }, []);

  if (definitionsLoading) {
    return <div>{t('app.master-data.materialForm.loading')}</div>;
  }

  if (variantAttributeDefinitions.length === 0) {
    return (
      <div>
        <p>{t('app.master-data.materialForm.noVariantDef')}</p>
        <p>{t('app.master-data.materialForm.configVariantFirst')}</p>
      </div>
    );
  }

  return (
    <Row gutter={16}>
      {variantAttributeDefinitions.map((def) => {
        const fieldName = ['variantAttributes', def.attribute_name];
        
        // 根据属性类型渲染对应的ProForm组件
        switch (def.attribute_type) {
          case 'enum':
            return (
              <Col span={12} key={def.attribute_name}>
                <ProFormSelect
                  name={fieldName}
                  label={def.display_name}
                  placeholder={t('app.master-data.materialForm.selectAttr', { name: def.display_name })}
                  required={def.is_required}
                  tooltip={def.description}
                  options={def.enum_values?.map(v => ({ label: v, value: v }))}
                  rules={[
                    {
                      required: def.is_required,
                      message: t('app.master-data.materialForm.selectAttr', { name: def.display_name }),
                    },
                    {
                      validator: async (_: any, value: any) => {
                        if (!value && def.is_required) {
                          throw new Error(t('app.master-data.materialForm.selectAttr', { name: def.display_name }));
                        }
                        // 验证属性值
                        if (value) {
                          try {
                            const result = await variantAttributeApi.validate({
                              attribute_name: def.attribute_name,
                              attribute_value: value,
                            });
                            if (!result.is_valid) {
                              throw new Error(result.error_message || t('app.master-data.materialForm.attrValidationFailed'));
                            }
                          } catch (error: any) {
                            throw new Error(error.message || t('app.master-data.materialForm.attrValidationFailed'));
                          }
                        }
                      },
                    },
                  ]}
                />
              </Col>
            );
          
          case 'text':
            return (
              <Col span={12} key={def.attribute_name}>
                <ProFormText
                  name={fieldName}
                  label={def.display_name}
                  placeholder={t('app.master-data.materialForm.enterAttr', { name: def.display_name })}
                  required={def.is_required}
                  tooltip={def.description}
                  fieldProps={{
                    maxLength: def.validation_rules?.max_length,
                  }}
                  rules={[
                    {
                      required: def.is_required,
                      message: t('app.master-data.materialForm.enterAttr', { name: def.display_name }),
                    },
                    {
                      validator: async (_: any, value: any) => {
                        if (!value && def.is_required) {
                          throw new Error(t('app.master-data.materialForm.enterAttr', { name: def.display_name }));
                        }
                        // 验证属性值
                        if (value) {
                          try {
                            const result = await variantAttributeApi.validate({
                              attribute_name: def.attribute_name,
                              attribute_value: value,
                            });
                            if (!result.is_valid) {
                              throw new Error(result.error_message || t('app.master-data.materialForm.attrValidationFailed'));
                            }
                          } catch (error: any) {
                            throw new Error(error.message || t('app.master-data.materialForm.attrValidationFailed'));
                          }
                        }
                      },
                    },
                  ]}
                />
              </Col>
            );
          
          case 'number':
            return (
              <Col span={12} key={def.attribute_name}>
                <ProFormDigit
                  name={fieldName}
                  label={def.display_name}
                  placeholder={t('app.master-data.materialForm.enterAttr', { name: def.display_name })}
                  required={def.is_required}
                  tooltip={def.description}
                  fieldProps={{
                    min: def.validation_rules?.min,
                    max: def.validation_rules?.max,
                  }}
                  rules={[
                    {
                      required: def.is_required,
                      message: t('app.master-data.materialForm.enterAttr', { name: def.display_name }),
                    },
                    {
                      validator: async (_: any, value: any) => {
                        if (!value && def.is_required) {
                          throw new Error(t('app.master-data.materialForm.enterAttr', { name: def.display_name }));
                        }
                        // 验证属性值
                        if (value) {
                          try {
                            const result = await variantAttributeApi.validate({
                              attribute_name: def.attribute_name,
                              attribute_value: value,
                            });
                            if (!result.is_valid) {
                              throw new Error(result.error_message || t('app.master-data.materialForm.attrValidationFailed'));
                            }
                          } catch (error: any) {
                            throw new Error(error.message || t('app.master-data.materialForm.attrValidationFailed'));
                          }
                        }
                      },
                    },
                  ]}
                />
              </Col>
            );
          
          case 'date':
            return (
              <Col span={12} key={def.attribute_name}>
                <ProFormText
                  name={fieldName}
                  label={def.display_name}
                  placeholder={t('app.master-data.materialForm.selectAttr', { name: def.display_name })}
                  required={def.is_required}
                  tooltip={def.description}
                  fieldProps={{
                    type: 'date',
                  }}
                  rules={[
                    {
                      required: def.is_required,
                      message: t('app.master-data.materialForm.selectAttr', { name: def.display_name }),
                    },
                    {
                      validator: async (_: any, value: any) => {
                        if (!value && def.is_required) {
                          throw new Error(t('app.master-data.materialForm.selectAttr', { name: def.display_name }));
                        }
                        // 验证属性值
                        if (value) {
                          try {
                            const result = await variantAttributeApi.validate({
                              attribute_name: def.attribute_name,
                              attribute_value: value,
                            });
                            if (!result.is_valid) {
                              throw new Error(result.error_message || t('app.master-data.materialForm.attrValidationFailed'));
                            }
                          } catch (error: any) {
                            throw new Error(error.message || t('app.master-data.materialForm.attrValidationFailed'));
                          }
                        }
                      },
                    },
                  ]}
                />
              </Col>
            );
          
          case 'boolean':
            return (
              <Col span={12} key={def.attribute_name}>
                <ProFormSelect
                  name={fieldName}
                  label={def.display_name}
                  placeholder={t('app.master-data.materialForm.selectAttr', { name: def.display_name })}
                  required={def.is_required}
                  tooltip={def.description}
                  options={[
                    { label: t('app.master-data.bom.yes'), value: true },
                    { label: t('app.master-data.bom.no'), value: false },
                  ]}
                  rules={[
                    {
                      required: def.is_required,
                      message: t('app.master-data.materialForm.selectAttr', { name: def.display_name }),
                    },
                    {
                      validator: async (_, value) => {
                        if (!value && def.is_required) {
                          throw new Error(t('app.master-data.materialForm.selectAttr', { name: def.display_name }));
                        }
                        // 验证属性值
                        if (value !== undefined && value !== null) {
                          try {
                            const result = await variantAttributeApi.validate({
                              attribute_name: def.attribute_name,
                              attribute_value: value,
                            });
                            if (!result.is_valid) {
                              throw new Error(result.error_message || t('app.master-data.materialForm.attrValidationFailed'));
                            }
                          } catch (error: any) {
                            throw new Error(error.message || t('app.master-data.materialForm.attrValidationFailed'));
                          }
                        }
                      },
                    },
                  ]}
                />
              </Col>
            );
          
          default:
            return (
              <Col span={12} key={def.attribute_name}>
                <ProFormText
                  name={fieldName}
                  label={def.display_name}
                  placeholder={t('app.master-data.materialForm.enterAttr', { name: def.display_name })}
                  required={def.is_required}
                  tooltip={def.description}
                  rules={[
                    {
                      required: def.is_required,
                      message: t('app.master-data.materialForm.enterAttr', { name: def.display_name }),
                    },
                    {
                      validator: async (_: any, value: any) => {
                        if (!value && def.is_required) {
                          throw new Error(t('app.master-data.materialForm.enterAttr', { name: def.display_name }));
                        }
                        // 验证属性值
                        if (value) {
                          try {
                            const result = await variantAttributeApi.validate({
                              attribute_name: def.attribute_name,
                              attribute_value: value,
                            });
                            if (!result.is_valid) {
                              throw new Error(result.error_message || t('app.master-data.materialForm.attrValidationFailed'));
                            }
                          } catch (error: any) {
                            throw new Error(error.message || t('app.master-data.materialForm.attrValidationFailed'));
                          }
                        }
                      },
                    },
                  ]}
                />
              </Col>
            );
        }
      })}
    </Row>
  );
};

/**
 * 编码映射标签页
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

/** 编码映射统一行类型（用于单表展示） */
type CodeMappingSourceType = 'department' | 'customer' | 'supplier' | 'external';
interface CodeMappingRow {
  key: string;
  sourceType: CodeMappingSourceType;
  sourceIndex?: number;
  externalUuid?: string;
  /** 映射类型展示 */
  typeLabel: string;
  /** 编码（部门/客户/供应商为 code，外部为 externalCode） */
  code: string;
  /** 关联方/类型（部门为编码类型，客户为客户名，供应商为供应商名，外部为外部系统） */
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
  onExternalSystemCodesChange,
  onReloadExternalSystemCodes,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [addForm] = Form.useForm();
  const [externalSystemForm] = Form.useForm();

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addModalType, setAddModalType] = useState<CodeMappingSourceType>('department');
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
        relation: departmentCodeTypeLabels[r.code_type] ?? r.code_type,
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
        relation: r.customerName ?? '',
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
        relation: r.supplierName ?? '',
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
  }, [departmentCodes, customerCodes, supplierCodes, externalSystemCodes, materialUuid, departmentCodeTypeLabels, t]);

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
    const t = type ?? 'department';
    setAddModalType(t);
    setAddModalVisible(true);
    addForm.resetFields();
  };

  const handleAddSubmit = () => {
    if (addModalType === 'department') {
      addForm.validateFields().then((values) => {
        onDepartmentCodesChange([...departmentCodes, values]);
        addForm.resetFields();
        setAddModalVisible(false);
      }).catch(() => {});
      return;
    }
    if (addModalType === 'customer') {
      addForm.validateFields().then((values) => {
        const customer = customers.find(c => c.id === values.customerId);
        onCustomerCodesChange([
          ...customerCodes,
          {
            ...values,
            customerName: customer?.name,
            customerUuid: customer?.uuid,
          },
        ]);
        addForm.resetFields();
        setAddModalVisible(false);
      }).catch(() => {});
      return;
    }
    if (addModalType === 'supplier') {
      addForm.validateFields().then((values) => {
        const supplier = suppliers.find(s => s.id === values.supplierId);
        onSupplierCodesChange([
          ...supplierCodes,
          {
            ...values,
            supplierName: supplier?.name,
            supplierUuid: supplier?.uuid,
          },
        ]);
        addForm.resetFields();
        setAddModalVisible(false);
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
        addForm.resetFields();
        setAddModalVisible(false);
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
          { title: t('app.master-data.codeMapping.code'), dataIndex: 'code', key: 'code', width: 140 },
          { title: t('app.master-data.codeMapping.relation'), dataIndex: 'relation', key: 'relation', width: 140 },
          { title: t('app.master-data.codeMapping.name'), dataIndex: 'name', key: 'name', width: 120, ellipsis: true },
          { title: t('app.master-data.codeMapping.description'), dataIndex: 'description', key: 'description', ellipsis: true },
          { title: t('app.master-data.codeMapping.extra'), dataIndex: 'extra', key: 'extra', width: 100 },
          {
            title: t('app.master-data.materialForm.action'),
            key: 'action',
            width: 120,
            fixed: 'right' as const,
            render: (_, record) => (
              <Space size="small">
                {record.sourceType === 'external' && (
                  <Button
                    type="link"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => {
                      const ext = externalSystemCodes.find(e => e.uuid === record.externalUuid);
                      if (ext) openEditExternalModal(ext);
                    }}
                  >
                    {t('app.master-data.codeMapping.edit')}
                  </Button>
                )}
                <Button
                  type="link"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => handleDeleteRow(record)}
                >
                  {t('app.master-data.materialForm.delete')}
                </Button>
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

      {/* 统一添加编码映射 Modal */}
      <Modal
        title={t('app.master-data.codeMapping.addMapping')}
        open={addModalVisible}
        onOk={handleAddSubmit}
        onCancel={() => { setAddModalVisible(false); addForm.resetFields(); }}
        width={600}
      >
        <Form form={addForm} layout="vertical">
          <Form.Item label={t('app.master-data.codeMapping.mappingType')}>
            <Select
              value={addModalType}
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

      {/* 编辑外部系统编码映射 Modal */}
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
  suppliers: Supplier[];
  customers: Customer[];
  warehouses: Warehouse[];
  suppliersLoading: boolean;
  customersLoading: boolean;
  warehousesLoading: boolean;
}

const DefaultsTab: React.FC<DefaultsTabProps> = ({
  suppliers,
  customers,
  warehouses,
  suppliersLoading,
  customersLoading,
  warehousesLoading,
}) => {
  const { t } = useTranslation();
  return (
    <Collapse defaultActiveKey={['finance', 'purchase', 'sale', 'inventory', 'production']}>
        <Panel header={t('app.master-data.defaults.finance')} key="finance">
          <Row gutter={16}>
            <Col span={12}>
              <ProFormDigit
                name="defaults.defaultTaxRate"
                label={t('app.master-data.defaults.defaultTaxRate')}
                placeholder={t('app.master-data.defaults.defaultTaxRatePlaceholder')}
                min={0}
                max={100}
              />
            </Col>
            <Col span={12}>
              <ProFormText
                name="defaults.defaultAccount"
                label={t('app.master-data.defaults.defaultAccount')}
                placeholder={t('app.master-data.defaults.defaultAccountPlaceholder')}
              />
            </Col>
          </Row>
        </Panel>

        {/* 采购默认值 */}
        <Panel header={t('app.master-data.defaults.purchase')} key="purchase">
          <Alert
            message={t('app.master-data.defaults.purchaseAlert')}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Row gutter={16}>
            <Col span={12}>
              <ProFormSelect
                name="defaults.defaultSupplierIds"
                label={t('app.master-data.defaults.defaultSuppliers')}
                placeholder={t('app.master-data.defaults.selectSuppliers')}
                options={suppliers.map(s => ({ label: `${s.code} - ${s.name}`, value: s.id }))}
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
              <ProFormDigit
                name="defaults.defaultPurchasePrice"
                label={t('app.master-data.defaults.defaultPurchasePrice')}
                placeholder={t('app.master-data.defaults.defaultPurchasePricePlaceholder')}
                min={0}
              />
            </Col>
            <Col span={12}>
              <ProFormText
                name="defaults.defaultPurchaseUnit"
                label={t('app.master-data.defaults.defaultPurchaseUnit')}
                placeholder={t('app.master-data.defaults.defaultPurchaseUnitPlaceholder')}
              />
            </Col>
            <Col span={12}>
              <ProFormDigit
                name="defaults.defaultPurchaseLeadTime"
                label={t('app.master-data.defaults.defaultPurchaseLeadTime')}
                placeholder={t('app.master-data.defaults.defaultPurchaseLeadTimePlaceholder')}
                min={0}
              />
            </Col>
          </Row>
        </Panel>

        {/* 销售默认值 */}
        <Panel header={t('app.master-data.defaults.sale')} key="sale">
          <Row gutter={16}>
            <Col span={12}>
              <ProFormDigit
                name="defaults.defaultSalePrice"
                label={t('app.master-data.defaults.defaultSalePrice')}
                placeholder={t('app.master-data.defaults.defaultSalePricePlaceholder')}
                min={0}
              />
            </Col>
            <Col span={12}>
              <ProFormText
                name="defaults.defaultSaleUnit"
                label={t('app.master-data.defaults.defaultSaleUnit')}
                placeholder={t('app.master-data.defaults.defaultSaleUnitPlaceholder')}
              />
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
              <ProFormText
                name="defaults.defaultLocation"
                label={t('app.master-data.defaults.defaultLocation')}
                placeholder={t('app.master-data.defaults.defaultLocationPlaceholder')}
              />
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
            <Col span={12}>
              <ProFormDigit
                name="defaults.minStock"
                label={t('app.master-data.defaults.minStock')}
                placeholder={t('app.master-data.defaults.minStockPlaceholder')}
                min={0}
              />
            </Col>
          </Row>
        </Panel>

        {/* 生产默认值：默认工艺路线仅在【基本信息】中的物料来源区域（自制件时）配置，此处仅保留默认生产单位 */}
        <Panel header={t('app.master-data.defaults.production')} key="production">
          <Row gutter={16}>
            <Col span={12}>
              <ProFormText
                name="defaults.defaultProductionUnit"
                label={t('app.master-data.defaults.defaultProductionUnit')}
                placeholder={t('app.master-data.defaults.defaultProductionUnitPlaceholder')}
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
  formRef: React.RefObject<ProFormInstance>;
  material?: Material;
  suppliers: Supplier[];
  processRoutes: ProcessRoute[];
  operations: Operation[];
  suppliersLoading: boolean;
  processRoutesLoading: boolean;
  operationsLoading: boolean;
  sourceTypeOptions: Array<{ label: string; value: string }>;
  onValidate?: () => void;
  onCheckCompleteness?: () => void;
}

const MaterialSourceTab = forwardRef<
  { applySuggestion: (type: string, manufacturingMode?: string) => void },
  MaterialSourceTabProps
>(
  ({ formRef, material, suppliers, processRoutes, operations, suppliersLoading, processRoutesLoading, operationsLoading, sourceTypeOptions, onValidate, onCheckCompleteness }, ref) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [sourceType, setSourceType] = useState<string | undefined>(material?.sourceType || material?.source_type);
    const manufacturingModeOptions = useMemo(() => [
      { label: t('app.master-data.materialForm.manufacturingFabrication'), value: 'fabrication' },
      { label: t('app.master-data.materialForm.manufacturingAssembly'), value: 'assembly' },
    ], [t]);

    const handleGotoProcessRoutes = () => {
      navigate('/apps/master-data/process/routes');
    };

  /**
   * 处理物料来源类型变化
   * @param value 来源类型
   * @param manufacturingMode 制造模式（仅 Make 时有效，应用建议时可选传入）
   */
  const handleSourceTypeChange = (value: string, manufacturingMode?: string) => {
    setSourceType(value);
    formRef.current?.setFieldsValue({
      sourceType: value,
      source_type: value, // 向后兼容
    });
    
    // 根据来源类型初始化配置
    const currentConfig = formRef.current?.getFieldValue('sourceConfig') || formRef.current?.getFieldValue('source_config') || {};
    let newConfig = { ...currentConfig };
    
    if (value === 'Make') {
      // 自制件：保留BOM和工艺路线配置，支持制造模式（加工型/装配型）
      newConfig = {
        ...newConfig,
        manufacturing_mode: manufacturingMode ?? newConfig.manufacturing_mode,
        production_lead_time: newConfig.production_lead_time,
        min_production_batch: newConfig.min_production_batch,
        production_waste_rate: newConfig.production_waste_rate,
      };
    } else if (value === 'Buy') {
      // 采购件：初始化采购相关配置
      newConfig = {
        ...newConfig,
        default_supplier_id: newConfig.default_supplier_id,
        purchase_lead_time: newConfig.purchase_lead_time,
        min_purchase_batch: newConfig.min_purchase_batch,
        purchase_price: newConfig.purchase_price,
      };
    } else if (value === 'Outsource') {
      // 委外件：初始化委外相关配置
      newConfig = {
        ...newConfig,
        outsource_supplier_id: newConfig.outsource_supplier_id,
        outsource_operation: newConfig.outsource_operation,
        outsource_lead_time: newConfig.outsource_lead_time,
        outsource_price: newConfig.outsource_price,
        material_provided_by: newConfig.material_provided_by || 'enterprise',
      };
    } else if (value === 'Configure') {
      // 配置件：保留变体相关配置
      newConfig = {
        ...newConfig,
        bom_variants: newConfig.bom_variants,
        default_variant: newConfig.default_variant,
      };
    }
    
    formRef.current?.setFieldsValue({
      sourceConfig: newConfig,
      source_config: newConfig, // 向后兼容
    });

    if (material?.uuid) {
      onValidate?.();
      onCheckCompleteness?.();
    }
  };

  useImperativeHandle(ref, () => ({
    applySuggestion: (type: string, manufacturingMode?: string) =>
      handleSourceTypeChange(type, manufacturingMode),
  }));

  return (
    <div>
      <Row gutter={16} style={{ marginTop: 8 }}>
        <Col span={12}>
          <ProFormSelect
            name="sourceType"
            label={t('app.master-data.materialForm.sourceTypeLabel')}
            placeholder={t('app.master-data.materialForm.sourceTypePlaceholder')}
            options={sourceTypeOptions}
            fieldProps={{
              value: sourceType,
              onChange: handleSourceTypeChange,
            }}
            extra={t('app.master-data.materialForm.sourceTypeExtra')}
          />
        </Col>
      </Row>

      <ProFormDependency name={['sourceType', 'sourceConfig']}>
        {({ sourceType: currentSourceType, sourceConfig }) => {
          if (currentSourceType === 'Make') {
            return (
              <Row gutter={16} style={{ marginTop: 0 }}>
                <Col span={6}>
                  <ProFormSelect
                    name="sourceConfig.manufacturing_mode"
                    label={t('app.master-data.materialForm.manufacturingMode')}
                    placeholder={t('app.master-data.materialForm.manufacturingModePlaceholder')}
                    options={manufacturingModeOptions}
                    fieldProps={{ allowClear: true }}
                    extra={t('app.master-data.materialForm.manufacturingModeExtra')}
                  />
                </Col>
                <Col span={12}>
                  <ProFormSelect
                    name="defaults.defaultProcessRouteUuid"
                    label={
                      <Space>
                        <span>{t('app.master-data.source.defaultProcessRoute')}</span>
                        <Button
                          type="link"
                          size="small"
                          icon={<LinkOutlined />}
                          onClick={handleGotoProcessRoutes}
                          title={t('app.master-data.source.gotoRoutes')}
                          style={{ padding: 0, height: 'auto' }}
                        >
                          {t('app.master-data.source.routes')}
                        </Button>
                      </Space>
                    }
                    placeholder={t('app.master-data.source.selectProcessRoute')}
                    options={processRoutes.map(pr => ({ label: `${pr.code} - ${pr.name}`, value: pr.uuid }))}
                    fieldProps={{
                      loading: processRoutesLoading,
                      showSearch: true,
                      filterOption: (input: string, option: any) =>
                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
                      allowClear: true,
                    }}
                  />
                </Col>
                <Col span={6}>
                  <ProFormDigit
                    name="sourceConfig.production_lead_time"
                    label={t('app.master-data.source.productionLeadTime')}
                    placeholder={t('app.master-data.source.leadTimePlaceholder')}
                    min={0}
                  />
                </Col>
                <Col span={6}>
                  <ProFormDigit
                    name="sourceConfig.min_production_batch"
                    label={t('app.master-data.source.minProductionBatch')}
                    placeholder={t('app.master-data.source.minBatchPlaceholder')}
                    min={0}
                  />
                </Col>
                <Col span={6}>
                  <ProFormDigit
                    name="sourceConfig.production_waste_rate"
                    label={t('app.master-data.source.productionWasteRate')}
                    placeholder={t('app.master-data.source.wasteRatePlaceholder')}
                    min={0}
                    max={100}
                  />
                </Col>
              </Row>
            );
          }
          if (currentSourceType === 'Buy') {
            return (
              <Row gutter={16} style={{ marginTop: 0 }}>
                <Col span={12}>
                  <SafeProFormSelect
                    name="sourceConfig.default_supplier_id"
                    label={t('app.master-data.source.defaultSupplier')}
                    placeholder={t('app.master-data.source.selectDefaultSupplier')}
                    options={suppliers.map(s => ({ label: `${s.code} - ${s.name}`, value: s.id }))}
                    fieldProps={{
                      loading: suppliersLoading,
                      showSearch: true,
                      filterOption: (input: string, option: any) =>
                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
                      allowClear: true,
                    }}
                  />
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
              <>
                <Row gutter={16} style={{ marginTop: 0 }}>
                  <Col span={6}>
                    <SafeProFormSelect
                      name="sourceConfig.outsource_supplier_id"
                      label={t('app.master-data.source.outsourceSupplier')}
                      placeholder={t('app.master-data.source.selectOutsourceSupplier')}
                      rules={[{ required: true, message: t('app.master-data.source.selectOutsourceSupplier') }]}
                      options={suppliers.map(s => ({ label: `${s.code} - ${s.name}`, value: s.id }))}
                      fieldProps={{
                        loading: suppliersLoading,
                        showSearch: true,
                        filterOption: (input: string, option: any) =>
                          (option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
                      }}
                    />
                  </Col>
                  <Col span={6}>
                    <SafeProFormSelect
                      name="sourceConfig.outsource_operation"
                      label={t('app.master-data.source.outsourceOperation')}
                      placeholder={t('app.master-data.source.selectOutsourceOperation')}
                      rules={[{ required: true, message: t('app.master-data.source.selectOutsourceOperation') }]}
                      options={operations.map(op => ({ label: `${op.code} - ${op.name}`, value: op.uuid }))}
                      fieldProps={{
                        loading: operationsLoading,
                        showSearch: true,
                        filterOption: (input: string, option: any) =>
                          (option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
                      }}
                    />
                  </Col>
                  <Col span={6}>
                    <ProFormDigit
                      name="sourceConfig.outsource_lead_time"
                      label={t('app.master-data.source.outsourceLeadTime')}
                      placeholder={t('app.master-data.source.leadTimePlaceholder')}
                      min={0}
                    />
                  </Col>
                  <Col span={6}>
                    <ProFormDigit
                      name="sourceConfig.outsource_price"
                      label={t('app.master-data.source.outsourcePrice')}
                      placeholder={t('app.master-data.source.pricePlaceholder')}
                      min={0}
                      fieldProps={{ precision: 2 }}
                    />
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={6}>
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
              </>
            );
          }
          if (currentSourceType === 'Configure') {
            return (
              <Row gutter={16} style={{ marginTop: 0 }}>
                <Col span={24}>
                  <Alert
                    message={t('app.master-data.source.configureTip')}
                    description={t('app.master-data.source.configureTipDesc')}
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                </Col>
                <Col span={12}>
                  <ProFormTextArea
                    name="sourceConfig.bom_variants"
                    label={t('app.master-data.source.bomVariantsLabel')}
                    placeholder={t('app.master-data.source.bomVariantsPlaceholder')}
                    fieldProps={{ rows: 4 }}
                  />
                </Col>
                <Col span={6}>
                  <ProFormText
                    name="sourceConfig.default_variant"
                    label={t('app.master-data.source.defaultVariant')}
                    placeholder={t('app.master-data.source.defaultVariantPlaceholder')}
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
          return null;
        }}
      </ProFormDependency>
    </div>
  );
});

export default MaterialForm;
