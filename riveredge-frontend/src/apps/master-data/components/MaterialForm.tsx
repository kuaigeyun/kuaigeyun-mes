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
import { Modal, Tabs, App, Table, Button, Form, Input, Select, Collapse, Row, Col, Alert, Tag, Space, Switch, Card, theme } from 'antd';
import { FormModalTemplate } from '../../../components/layout-templates';
import { MODAL_CONFIG } from '../../../components/layout-templates/constants';
import { PlusOutlined, DeleteOutlined, EditOutlined, LinkOutlined } from '@ant-design/icons';
import { ProForm, ProFormInstance, ProFormText, ProFormTextArea, ProFormSwitch, ProFormSelect, ProFormDigit, ProFormDependency, ProFormUploadButton } from '@ant-design/pro-components';
import type { Material, MaterialCreate, MaterialUpdate, DepartmentCodeMapping, CustomerCodeMapping, SupplierCodeMapping, MaterialUnit, MaterialCodeMapping } from '../types/material';
import type { Customer } from '../types/supply-chain';
import type { Supplier } from '../types/supply-chain';
import SafeProFormSelect from '../../../components/safe-pro-form-select';
import { customerApi, supplierApi, unwrapSupplyPagedList } from '../services/supply-chain';
import { warehouseApi } from '../services/warehouse';
import { processRouteApi, operationApi } from '../services/process';
import { materialCodeMappingApi } from '../services/material';
import type { Warehouse } from '../types/warehouse';
import type { ProcessRoute, Operation } from '../types/process';
import type { VariantAttributeDefinition } from '../types/variant-attribute';
import { variantAttributeApi } from '../services/variant-attribute';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../utils/codeRulePage';
import { testGenerateCode } from '../../../services/codeRule';
import DictionarySelect from '../../../components/dictionary-select';
import { getDataDictionaryByCode, getDictionaryItemList } from '../../../services/dataDictionary';
import { getFileDownloadUrlWithToken, uploadMultipleFiles } from '../../../services/file';
import { batchRuleApi, serialRuleApi } from '../services/batchSerialRules';
import { saveSuspendedModal } from '../utils/suspendedModal';
import { inspectionPlanApi } from '../../kuaizhizao/services/production';

const { Panel } = Collapse;

/** 系统默认规则占位值（提交时转为 null） */
const SYSTEM_DEFAULT_RULE_VALUE = '__SYSTEM_DEFAULT__';

/** 每种物料来源类型的合法字段白名单（用于过滤混合字段） */
const SOURCE_CONFIG_FIELDS: Record<string, string[]> = {
  Make: ['manufacturing_mode', 'production_lead_time', 'min_production_batch', 'production_waste_rate'],
  Buy: ['purchase_price', 'purchase_lead_time', 'min_purchase_batch', 'default_supplier_id', 'default_supplier_name'],
  Outsource: ['outsource_supplier_id', 'outsource_supplier_name', 'outsource_lead_time', 'min_outsource_batch', 'outsource_operation', 'outsource_price', 'material_provided_by'],
  Phantom: [],
  Service: [],
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
  /** 暂存 Modal 时的返回路径，设置后点击表单内链接会先暂存表单再跳转 */
  suspendedModalReturnPath?: string;
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
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const formRef = useRef<ProFormInstance>();
  const sourceTypeOptions = useMemo(() => [
    { label: t('app.master-data.materialForm.sourceMake'), value: 'Make' },
    { label: t('app.master-data.materialForm.sourceBuy'), value: 'Buy' },
    { label: t('app.master-data.materialForm.sourceOutsource'), value: 'Outsource' },
    { label: t('app.master-data.materialForm.sourcePhantom'), value: 'Phantom' },
    { label: t('app.master-data.materialForm.sourceService'), value: 'Service' },
  ], [t]);
  const [activeTab, setActiveTab] = useState<string>('basic');
  const [variantManaged, setVariantManaged] = useState<boolean>(false);

  const emitAgentDebugLog = useCallback(
    (runId: string, hypothesisId: string, location: string, message: string, data: Record<string, any>) => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b117966e-dad0-4d01-bd6a-e3ba9296abb4', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '8e3a76' },
        body: JSON.stringify({
          sessionId: '8e3a76',
          runId,
          hypothesisId,
          location,
          message,
          data,
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
    },
    []
  );

  // 打开表单时同步 variantManaged 状态（编辑已有属性物料时，属性管理标签页需可用）
  useEffect(() => {
    if (open) {
      emitAgentDebugLog('run-2', 'H6', 'MaterialForm.tsx:open-effect', 'material form opened', {
        isEdit,
        hasMaterial: !!material,
        materialUuid: (material as any)?.uuid ?? null,
      });
      const iv = initialValues as { variantManaged?: boolean; variant_managed?: boolean } | undefined;
      const vm =
        material?.variantManaged ??
        (material as { variant_managed?: boolean })?.variant_managed ??
        iv?.variantManaged ??
        iv?.variant_managed ??
        false;
      setVariantManaged(!!vm);
    }
  }, [open, isEdit, material, material?.variantManaged, (material as any)?.variant_managed, initialValues, emitAgentDebugLog]);
  
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

    // 构建上下文（用于编号规则，隔离字段 scope_fields 依赖 group_code）
    const context: Record<string, any> = {};
    
    // 如果提供了物料分组ID，获取分组信息（兼容 id 为 number/string 的类型）
    if (groupId != null && !(typeof groupId === 'string' && groupId === '')) {
      const group = materialGroups.find(g => Number(g.id) === Number(groupId));
      if (group) {
        context.group_code = group.code;
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
  }, [isEdit, materialGroups, t]);

  /**
   * 当物料分组加载完成且已选择分组时，重新生成编号（确保 scope_fields 隔离计数生效）
   * 场景：用户在选择分组时 materialGroups 可能尚未加载，导致 context 缺少 group_code
   */
  useEffect(() => {
    if (isEdit || !isAutoGenerateEnabled('master-data-material') || materialGroups.length === 0) return;
    const groupId = formRef.current?.getFieldValue('groupId');
    if (groupId == null || groupId === '') return;
    const group = materialGroups.find(g => Number(g.id) === Number(groupId));
    if (group) {
      const sourceType = formRef.current?.getFieldValue('sourceType');
      const name = formRef.current?.getFieldValue('name');
      generateCode(groupId, sourceType, name, true);
    }
  }, [materialGroups, isEdit, generateCode]);

  /**
   * 初始化数据
   */
  useEffect(() => {
    if (open) {
      if (!isEdit) lastAutoGeneratedCodeRef.current = null;
      // 加载所有需要的数据
      loadCustomers();
      loadSuppliers();
      loadWarehouses();
      loadProcessRoutes();
      loadOperations();

      // 如果是新建模式且启用了自动编号，生成编号
      if (!isEdit) {
        generateCode(initialValues?.groupId, initialValues?.sourceType, initialValues?.name);
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
        
        // 加载外部系统编号映射
        if (material.uuid) {
          loadExternalSystemCodes(material.uuid);
        }
        
        // 处理图片预填（使用带 token 的 URL，确保生产环境可显示）
        const materialImages = (material as any).images || [];
        if (materialImages.length > 0) {
          Promise.all(
            materialImages.map((uuid: string) =>
              getFileDownloadUrlWithToken(uuid).then((url) => ({
                uid: uuid,
                name: t('app.master-data.materialForm.images'),
                status: 'done' as const,
                url,
              }))
            )
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
        }
        
        // 工艺路线回填由下方独立 useEffect（150ms 延后）在 processRoutes 加载完成后写入 defaultProcessRouteUuid，
        // 此处不再依赖 processRoutes，避免 processRoutes 入 deps 导致 effect 反复执行、循环调用 loadProcessRoutes
        if (routeId != null && processRoutes.length > 0) {
          const route = processRoutes.find((pr: { id: number }) => pr.id === routeId);
          if (route) formDefaults.defaultProcessRouteUuid = route.uuid;
        }
        
        if (Object.keys(formDefaults).length > 0) {
          emitAgentDebugLog('run-1', 'H5', 'MaterialForm.tsx:553', 'edit defaults prepared for setFieldsValue', {
            materialUuid: (material as any)?.uuid,
            materialDefaultsKeys: Object.keys(materialDefaults || {}),
            formDefaultsKeys: Object.keys(formDefaults || {}),
            defaultTaxRate: formDefaults?.defaultTaxRate,
            defaultSalePrice: formDefaults?.defaultSalePrice,
          });
          setTimeout(() => {
            const fieldsToSet: any = { defaults: formDefaults };
            // ProForm 在 name 使用 "defaults.xxx" 时，需要同步写入扁平 key 才能稳定回显
            Object.keys(formDefaults).forEach((key) => {
              fieldsToSet[`defaults.${key}`] = formDefaults[key];
            });
            formRef.current?.setFieldsValue(fieldsToSet);
            emitAgentDebugLog('run-4', 'H10', 'MaterialForm.tsx:560', 'edit defaults flatten setFieldsValue applied', {
              defaultsKeysSet: Object.keys((fieldsToSet && fieldsToSet.defaults) || {}),
              flatDefaultsKeyCount: Object.keys(fieldsToSet).filter((k) => k.startsWith('defaults.')).length,
              flatDefaultTaxRate: fieldsToSet['defaults.defaultTaxRate'] ?? null,
              flatDefaultSalePrice: fieldsToSet['defaults.defaultSalePrice'] ?? null,
            });
            emitAgentDebugLog('run-1', 'H5', 'MaterialForm.tsx:560', 'edit defaults setFieldsValue applied', {
              defaultsKeysSet: Object.keys((fieldsToSet && fieldsToSet.defaults) || {}),
              flatRouteSet: fieldsToSet['defaults.defaultProcessRouteUuid'] ?? null,
            });
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
   * 当供应商列表加载完成后，更新供应商编号映射中的名称
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
      emitAgentDebugLog('run-1', 'H1', 'MaterialForm.tsx:688', 'submit started', {
        isEdit,
        valueKeys: Object.keys(values || {}),
        hasDefaultsObject: !!values?.defaults,
        hasFlatDefaultTaxRate: values?.['defaults.defaultTaxRate'] !== undefined,
      });
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
      emitAgentDebugLog('run-1', 'H2', 'MaterialForm.tsx:775', 'defaults merged', {
        rawDefaultsKeys: Object.keys(formDefaultsRaw || {}),
        flatDefaultsKeys: Object.keys(flatDefaultsFromValues || {}),
        mergedDefaultsKeys: Object.keys(processedDefaults || {}),
        defaultTaxRate: processedDefaults?.defaultTaxRate,
        defaultSalePrice: processedDefaults?.defaultSalePrice,
      });
      
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
        process_route_id: sourceType === 'Make' ? (processRouteIdForSubmit ?? (material as any)?.process_route_id ?? (material as any)?.processRouteId ?? null) : ((material as any)?.process_route_id ?? (material as any)?.processRouteId),
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
          const va = restValues.variantAttributes;
          if (va == null) return undefined;
          if (typeof va !== 'object') return undefined;
          const filtered = Object.fromEntries(
            Object.entries(va).filter(([, v]) => v != null && v !== '' && (!Array.isArray(v) || v.length > 0))
          );
          return Object.keys(filtered).length > 0 ? filtered : null;
        })(),
        description: restValues.description,
        brand: restValues.brand,
        model: restValues.model,
        texture: restValues.texture,
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
        customer_codes: customerCodes.length > 0 ? customerCodes.map(code => ({
          customer_id: code.customerId,
          code: code.code,
          description: code.description,
        })) : undefined,
        // 供应商编号
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
        // 质检选项
        inspection_mode: values.inspectionMode || 'none',
        default_inspection_plan_id: values.inspectionMode === 'plan' ? (values.defaultInspectionPlanId || null) : null,
        over_report_mode: values.overReportMode || 'none',
        over_report_value: values.overReportValue ?? 0,
      };
      emitAgentDebugLog('run-1', 'H3', 'MaterialForm.tsx:859', 'submit payload built', {
        hasDefaultsPayload: submitData.defaults !== undefined,
        payloadDefaultsKeys: Object.keys(submitData.defaults || {}),
        payloadDefaultTaxRate: submitData.defaults?.defaultTaxRate,
        payloadDefaultSalePrice: submitData.defaults?.defaultSalePrice,
      });
      
      // 移除 undefined 值
      Object.keys(submitData).forEach(key => {
        if (submitData[key] === undefined) {
          delete submitData[key];
        }
      });

      const result = await onFinish(submitData);
      emitAgentDebugLog('run-1', 'H4', 'MaterialForm.tsx:894', 'onFinish resolved', {
        resultType: typeof result,
      });
      
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
      // 如果关闭属性管理，清空属性
      formRef.current?.setFieldsValue({
        variantAttributes: undefined,
      });
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
          max-width: 968px;
          padding: 0 0 16px 0;
          box-sizing: border-box;
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
            ? { ...initialValues, baseUnit: 'PC' }
            : initialValues;
          // 新建模式：根据来源类型设置默认税率（服务6%，其他13%）
          if (!isEdit && vals?.sourceType != null && (vals?.defaults?.defaultTaxRate == null)) {
            vals = {
              ...vals,
              defaults: { ...vals?.defaults, defaultTaxRate: vals.sourceType === 'Service' ? 6 : 13 },
            };
          }
          return vals;
        })()}
        layout="vertical"
        grid={false}
        onValuesChange={(changedValues, allValues) => {
          if (!isEdit && isAutoGenerateEnabled('master-data-material')) {
            const groupId = allValues.groupId;
            const sourceType = allValues.sourceType;
            const name = allValues.name;
            if (changedValues.groupId !== undefined) {
              // 切换分组时立即刷新编号预览，显示该分组对应的流水号
              generateCode(groupId, sourceType, name, true);
            } else if (changedValues.sourceType !== undefined || changedValues.name !== undefined) {
              generateCode(groupId, sourceType, name, false);
            }
          }
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
                  <BasicInfoTab part={1} formRef={formRef} materialGroups={materialGroups} isEdit={isEdit} suspendedModalReturnPath={suspendedModalReturnPath} />
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
                  />
                  <BasicInfoTab part={2} formRef={formRef} materialGroups={[]} variantManaged={variantManaged} onVariantManagedChange={handleVariantManagedChange} isEdit={isEdit} suspendedModalReturnPath={suspendedModalReturnPath} />
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
                <MaterialUnitsManager formRef={formRef} />
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
                  warehouses={warehouses}
                  customersLoading={customersLoading}
                  warehousesLoading={warehousesLoading}
                />
              ),
            },
          ]}
        />
      </FormModalTemplate>
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

const MaterialInspectionTab: React.FC<MaterialInspectionTabProps> = ({
  formRef,
  material,
  isEdit,
  suspendedModalReturnPath,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [planOptions, setPlanOptions] = useState<Array<{ label: string; value: number }>>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);

  useEffect(() => {
    const loadPlans = async () => {
      setLoadingPlans(true);
      try {
        let plans: any[] = [];
        if (material?.id) {
          try {
            plans = await inspectionPlanApi.getByMaterial(String(material.id)) || [];
          } catch {
            plans = await inspectionPlanApi.list({ limit: 200, is_active: true }) || [];
          }
        } else {
          plans = await inspectionPlanApi.list({ limit: 200, is_active: true }) || [];
        }
        setPlanOptions(
          (Array.isArray(plans) ? plans : []).map((p: any) => ({
            label: `${p.plan_code || p.planCode || ''} ${p.plan_name || p.planName || ''}`.trim() || String(p.id),
            value: p.id,
          }))
        );
      } catch (e) {
        console.warn('加载质检方案失败:', e);
        setPlanOptions([]);
      } finally {
        setLoadingPlans(false);
      }
    };
    loadPlans();
  }, [material?.id]);

  const handleGotoNewPlan = () => {
    const materialId = material?.id;
    const path = materialId
      ? `/apps/kuaizhizao/quality-management/inspection-plans?materialId=${materialId}`
      : '/apps/kuaizhizao/quality-management/inspection-plans';
    if (suspendedModalReturnPath) {
      const formData = formRef.current?.getFieldsValue?.(true) ?? {};
      saveSuspendedModal(suspendedModalReturnPath, formData as Record<string, any>);
    }
    navigate(path);
  };

  return (
    <div style={{ padding: '0 0 16px 0' }}>
      <ProFormSelect
        name="inspectionMode"
        label={t('app.master-data.materialForm.inspectionMode')}
        options={[
          { label: t('app.master-data.materialForm.inspectionModeNone'), value: 'none' },
          { label: t('app.master-data.materialForm.inspectionModeSimple'), value: 'simple' },
          { label: t('app.master-data.materialForm.inspectionModePlan'), value: 'plan' },
        ]}
        fieldProps={{ style: { width: 280 } }}
      />
      <ProFormDependency name={['inspectionMode']}>
        {({ inspectionMode }) =>
          inspectionMode === 'simple' ? (
            <Alert
              type="info"
              showIcon
              message={t('app.master-data.materialForm.inspectionModeSimpleHint')}
              style={{ marginBottom: 16 }}
            />
          ) : inspectionMode === 'plan' ? (
            <ProFormSelect
              name="defaultInspectionPlanId"
              label={
                <Space size="small">
                  <span>{t('app.master-data.materialForm.defaultInspectionPlan')}</span>
                  <Button type="link" size="small" onClick={handleGotoNewPlan}>
                    {t('app.master-data.materialForm.gotoInspectionPlans')}
                  </Button>
                </Space>
              }
              options={planOptions}
              fieldProps={{
                loading: loadingPlans,
                allowClear: true,
                showSearch: true,
                optionFilterProp: 'label',
                style: { width: 360 },
              }}
            />
          ) : null
        }
      </ProFormDependency>
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
 * 多单位管理组件
 */
interface MaterialUnitsManagerProps {
  formRef: any;
}

const MaterialUnitsManager: React.FC<MaterialUnitsManagerProps> = ({ formRef }) => {
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

  // 订阅表单字段变化（替代原 setInterval 轮询）
  const watchedUnits = Form.useWatch('units', formRef?.current);
  const watchedBaseUnit = Form.useWatch('baseUnit', formRef?.current);

  useEffect(() => {
    if (watchedUnits && (watchedUnits.units || watchedUnits.scenarios)) {
      setUnits(watchedUnits.units || []);
      setScenarios(watchedUnits.scenarios || {});
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
interface BasicInfoTabProps {
  part: 1 | 2;
  formRef: any;
  materialGroups: Array<{ id: number; code: string; name: string }>;
  variantManaged?: boolean;
  onVariantManagedChange?: (checked: boolean) => void;
  isEdit: boolean;
  suspendedModalReturnPath?: string;
}

const BasicInfoTab: React.FC<BasicInfoTabProps> = ({
  part,
  formRef,
  materialGroups,
  onVariantManagedChange,
  isEdit,
  suspendedModalReturnPath,
}) => {
  const { t } = useTranslation();
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

  if (part === 1) {
    return (
      <Row gutter={16} style={{ width: '100%' }}>
        <ProFormDependency name={['groupId']}>
          {({ groupId }) => (
            <Col span={6} style={{ minWidth: 0 }}>
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
            </Col>
          )}
        </ProFormDependency>
        <Col span={6} style={{ minWidth: 0 }}>
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
        <Col span={6} style={{ minWidth: 0 }}>
          <SafeProFormSelect
            name="groupId"
            label={t('app.master-data.materialForm.materialGroup')}
            placeholder={t('app.master-data.materialForm.materialGroupPlaceholder')}
            options={materialGroups.map(g => ({
              label: `${g.code} - ${g.name}`,
              value: g.id,
            }))}
            fieldProps={{ showSearch: true, allowClear: true, style: { width: '100%' } }}
          />
        </Col>
        <Col span={6} style={{ minWidth: 0 }}>
          <DictionarySelect
            dictionaryCode="MATERIAL_UNIT"
            name="baseUnit"
            label={t('app.master-data.materialForm.baseUnit')}
            placeholder={t('app.master-data.materialForm.baseUnitPlaceholder')}
            required
            formRef={formRef}
            colProps={{ span: 24 }}
            valueEqualsLabel
          />
        </Col>
        <Col span={6} style={{ minWidth: 0 }}>
          <ProFormText
            name="specification"
            label={t('app.master-data.materialForm.specification')}
            placeholder={t('app.master-data.materialForm.specificationPlaceholder')}
            rules={[{ max: 500, message: t('app.master-data.materialForm.specificationMax') }]}
          />
        </Col>
        <Col span={6} style={{ minWidth: 0 }}>
          <ProFormText
            name="model"
            label={t('app.master-data.materialForm.model')}
            placeholder={t('app.master-data.materialForm.modelPlaceholder')}
            rules={[{ max: 100, message: t('app.master-data.materialForm.modelMax') }]}
          />
        </Col>
        <Col span={6} style={{ minWidth: 0 }}>
          <ProFormText
            name="brand"
            label={t('app.master-data.materialForm.brand')}
            placeholder={t('app.master-data.materialForm.brandPlaceholder')}
            rules={[{ max: 100, message: t('app.master-data.materialForm.brandMax') }]}
          />
        </Col>
        <Col span={6} style={{ minWidth: 0 }}>
          <ProFormText
            name="texture"
            label={t('app.master-data.materialForm.texture')}
            placeholder={t('app.master-data.materialForm.texturePlaceholder')}
            rules={[{ max: 100, message: t('app.master-data.materialForm.textureMax') }]}
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
 * 属性管理标签页
 */
const VariantManagementTab: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [variantAttributeDefinitions, setVariantAttributeDefinitions] = useState<VariantAttributeDefinition[]>([]);
  const [definitionsLoading, setDefinitionsLoading] = useState(false);

  // 加载属性定义
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
                  required={false}
                  tooltip={def.description}
                  fieldProps={{ mode: def.allow_multiple ? 'multiple' : undefined }}
                  options={def.enum_values?.map(v => ({ label: v, value: v }))}
                  rules={[
                    {
                      validator: async (_: any, value: any) => {
                        if (!value) return;
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
                  required={false}
                  tooltip={def.description}
                  fieldProps={{
                    maxLength: def.validation_rules?.max_length,
                  }}
                  rules={[
                    {
                      validator: async (_: any, value: any) => {
                        if (!value) return;
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
                  required={false}
                  tooltip={def.description}
                  fieldProps={{
                    min: def.validation_rules?.min,
                    max: def.validation_rules?.max,
                  }}
                  rules={[
                    {
                      validator: async (_: any, value: any) => {
                        if (value == null || value === '') return;
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
                  required={false}
                  tooltip={def.description}
                  fieldProps={{
                    type: 'date',
                  }}
                  rules={[
                    {
                      validator: async (_: any, value: any) => {
                        if (!value) return;
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
                  required={false}
                  tooltip={def.description}
                  options={[
                    { label: t('app.master-data.bom.yes'), value: true },
                    { label: t('app.master-data.bom.no'), value: false },
                  ]}
                  rules={[
                    {
                      validator: async (_, value) => {
                        if (value === undefined || value === null) return;
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
                  required={false}
                  tooltip={def.description}
                  rules={[
                    {
                      validator: async (_: any, value: any) => {
                        if (!value) return;
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

      {/* 统一添加编号映射 Modal */}
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
  warehouses: Warehouse[];
  customersLoading: boolean;
  warehousesLoading: boolean;
}

const DefaultsTab: React.FC<DefaultsTabProps> = ({
  customers,
  warehouses,
  customersLoading,
  warehousesLoading,
}) => {
  const { t } = useTranslation();
  return (
    <Collapse defaultActiveKey={['finance', 'sale', 'inventory']}>
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
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const [sourceType, setSourceType] = useState<string | undefined>(material?.sourceType || material?.source_type);
  const manufacturingModeOptions = useMemo(() => [
    { label: t('app.master-data.materialForm.manufacturingFabrication'), value: 'fabrication' },
    { label: t('app.master-data.materialForm.manufacturingAssembly'), value: 'assembly' },
  ], [t]);

  const handleGotoProcessRoutes = () => {
    if (suspendedModalReturnPath) {
      const values = formRef?.current?.getFieldsValue?.() ?? {};
      saveSuspendedModal(suspendedModalReturnPath, values);
    }
    navigate('/apps/master-data/process/routes');
  };

  const handleSourceTypeChange = (value: string, manufacturingMode?: string) => {
    setSourceType(value);
    formRef.current?.setFieldsValue({
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
        production_waste_rate: newConfig.production_waste_rate,
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
            name="sourceType"
            label={t('app.master-data.materialForm.sourceTypeLabel')}
            placeholder={t('app.master-data.materialForm.sourceTypePlaceholder')}
            options={sourceTypeOptions}
            fieldProps={{
              value: sourceType,
              onChange: (val: string) => handleSourceTypeChange(val),
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
                <Col span={12}>
                  <Row gutter={16}>
                    <Col span={12}>
                      <ProFormSelect
                        name="sourceConfig.manufacturing_mode"
                        label={t('app.master-data.materialForm.manufacturingMode')}
                        placeholder={t('app.master-data.materialForm.manufacturingModePlaceholder')}
                        options={manufacturingModeOptions}
                        fieldProps={{ allowClear: true }}
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
                  </Row>
                </Col>
                <Col span={4}>
                  <ProFormDigit
                    name="sourceConfig.production_lead_time"
                    label={t('app.master-data.source.productionLeadTime')}
                    placeholder={t('app.master-data.source.leadTimePlaceholder')}
                    min={0}
                  />
                </Col>
                <Col span={4}>
                  <ProFormDigit
                    name="sourceConfig.min_production_batch"
                    label={t('app.master-data.source.minProductionBatch')}
                    placeholder={t('app.master-data.source.minBatchPlaceholder')}
                    min={0}
                  />
                </Col>
                <Col span={4}>
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
