/**
 * 物料表单组件（多标签页）
 *
 * 实现物料的新建和编辑功能，包含四个标签页：
 * 1. 基本信息
 * 2. 变体管理
 * 3. 编码映射
 * 4. 默认值设置
 *
 * Author: Luigi Lu
 * Date: 2026-01-08
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Modal, Tabs, App, Table, Button, Form, Input, Select, Collapse, Row, Col, Alert, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { ProForm, ProFormInstance, ProFormText, ProFormTextArea, ProFormSwitch, ProFormSelect, ProFormDigit, ProFormDependency } from '@ant-design/pro-components';
import type { Material, MaterialCreate, MaterialUpdate, DepartmentCodeMapping, CustomerCodeMapping, SupplierCodeMapping, MaterialDefaults, MaterialUnits, MaterialUnit } from '../types/material';
import type { Customer } from '../types/supply-chain';
import type { Supplier } from '../types/supply-chain';
import SafeProFormSelect from '../../../components/safe-pro-form-select';
import { customerApi } from '../services/supply-chain';
import { supplierApi } from '../services/supply-chain';
import { warehouseApi } from '../services/warehouse';
import { processRouteApi } from '../services/process';
import { materialSourceApi } from '../services/material';
import type { Warehouse } from '../types/warehouse';
import type { ProcessRoute } from '../types/process';
import type { VariantAttributeDefinition } from '../types/variant-attribute';
import { variantAttributeApi } from '../services/variant-attribute';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../utils/codeRulePage';
import { testGenerateCode } from '../../../services/codeRule';
import DictionarySelect from '../../../components/dictionary-select';
import { getDataDictionaryByCode, getDictionaryItemList } from '../../../services/dataDictionary';

const { Panel } = Collapse;

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
  const { message: messageApi } = App.useApp();
  const formRef = useRef<ProFormInstance>();
  const [activeTab, setActiveTab] = useState<string>('basic');
  const [variantManaged, setVariantManaged] = useState<boolean>(false);
  
  // 客户和供应商列表
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [processRoutes, setProcessRoutes] = useState<ProcessRoute[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [warehousesLoading, setWarehousesLoading] = useState(false);
  const [processRoutesLoading, setProcessRoutesLoading] = useState(false);

  // 编码映射数据
  const [departmentCodes, setDepartmentCodes] = useState<DepartmentCodeMapping[]>([]);
  const [customerCodes, setCustomerCodes] = useState<CustomerCodeMapping[]>([]);
  const [supplierCodes, setSupplierCodes] = useState<SupplierCodeMapping[]>([]);


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
        
        // 加载默认值（兼容处理：后端可能返回 snake_case 或 camelCase）
        // 将默认值转换为表单字段格式（对象数组转换为 ID 数组）
        const materialDefaults = (material as any).defaults;
        if (materialDefaults) {
          const formDefaults: any = { ...materialDefaults };
          
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
          
          // 移除对象数组字段（已转换为 ID 数组）
          delete formDefaults.defaultSuppliers;
          delete formDefaults.defaultCustomers;
          delete formDefaults.defaultWarehouses;
          delete formDefaults.defaultProcessRoute; // 只保留 UUID
          
          // 设置到表单
          setTimeout(() => {
            formRef.current?.setFieldsValue({
              defaults: formDefaults,
            });
          }, 100);
        }
        
        // 加载物料来源数据（兼容处理：后端可能返回 snake_case 或 camelCase）
        const materialSourceType = (material as any).source_type || material.sourceType;
        const materialSourceConfig = (material as any).source_config || material.sourceConfig;
        
        if (materialSourceType || materialSourceConfig) {
          setTimeout(() => {
            formRef.current?.setFieldsValue({
              sourceType: materialSourceType,
              source_type: materialSourceType, // 向后兼容
              sourceConfig: materialSourceConfig,
              source_config: materialSourceConfig, // 向后兼容
            });
          }, 100);
        }
      } else {
        // 新建模式，重置数据
        setDepartmentCodes([]);
        setCustomerCodes([]);
        setSupplierCodes([]);
      }
    }
  }, [open, isEdit, material, generateCode, initialValues]);
  
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
      const sourceConfig = values.sourceConfig || values.source_config;
      
      // 处理默认值数据转换
      const formDefaults = values.defaults || {};
      const processedDefaults: any = { ...formDefaults };
      
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
      
      // 处理默认工艺路线
      if (formDefaults.defaultProcessRouteUuid && processRoutes.length > 0) {
        const route = processRoutes.find(pr => pr.uuid === formDefaults.defaultProcessRouteUuid);
        if (route) {
          processedDefaults.defaultProcessRoute = route.id;
          processedDefaults.defaultProcessRouteUuid = route.uuid;
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
      
      // 组装完整的数据，将驼峰命名转换为蛇形命名
      const { defaults: _defaults, ...restValues } = values;
      const submitData: any = {
        // 基础字段转换（驼峰 -> 蛇形）
        main_code: restValues.mainCode,
        name: restValues.name,
        group_id: restValues.groupId,
        material_type: restValues.materialType,
        specification: restValues.specification,
        base_unit: restValues.baseUnit, // 关键：转换为 base_unit
        units: restValues.units,
        batch_managed: restValues.batchManaged,
        variant_managed: restValues.variantManaged,
        variant_attributes: restValues.variantAttributes,
        description: restValues.description,
        brand: restValues.brand,
        model: restValues.model,
        is_active: restValues.isActive,
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
        source_config: sourceConfig,
      };
      
      // 移除 undefined 值
      Object.keys(submitData).forEach(key => {
        if (submitData[key] === undefined) {
          delete submitData[key];
        }
      });

      await onFinish(submitData);
    } catch (error: any) {
      messageApi.error(error.message || '提交失败');
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

  return (
    <>
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
        title={isEdit ? '编辑物料' : '新建物料'}
        open={open}
        onCancel={onClose}
        footer={null}
        width={1000}
        destroyOnClose
      >
        <ProForm
        formRef={formRef}
        loading={loading}
        onFinish={handleSubmit}
        initialValues={initialValues}
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
            submitText: isEdit ? '更新' : '创建',
            resetText: '取消',
          },
          resetButtonProps: {
            onClick: onClose,
          },
        }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'basic',
              label: '基本信息',
              children: (
                <BasicInfoTab
                  formRef={formRef}
                  materialGroups={materialGroups}
                  variantManaged={variantManaged}
                  onVariantManagedChange={handleVariantManagedChange}
                  isEdit={isEdit}
                />
              ),
            },
            {
              key: 'variant',
              label: '变体管理',
              disabled: !variantManaged,
              children: (
                <VariantManagementTab />
              ),
            },
            {
              key: 'units',
              label: '多单位管理',
              children: (
                <MaterialUnitsManager formRef={formRef} />
              ),
            },
            {
              key: 'mapping',
              label: '编码映射',
              children: (
                <CodeMappingTab
                  departmentCodes={departmentCodes}
                  customerCodes={customerCodes}
                  supplierCodes={supplierCodes}
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
              label: '默认值设置',
              children: (
                <DefaultsTab
                  suppliers={suppliers}
                  customers={customers}
                  warehouses={warehouses}
                  processRoutes={processRoutes}
                  suppliersLoading={suppliersLoading}
                  customersLoading={customersLoading}
                  warehousesLoading={warehousesLoading}
                  processRoutesLoading={processRoutesLoading}
                />
              ),
            },
            {
              key: 'source',
              label: '物料来源',
              children: (
                <MaterialSourceTab
                  formRef={formRef}
                  material={material}
                  suppliers={suppliers}
                  processRoutes={processRoutes}
                  suppliersLoading={suppliersLoading}
                  processRoutesLoading={processRoutesLoading}
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
}

const MaterialUnitsManager: React.FC<MaterialUnitsManagerProps> = ({ formRef }) => {
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
      title: '单位名称',
      dataIndex: 'unit',
      render: (_: any, record: MaterialUnit, index: number) => (
        <Select
          value={record.unit}
          placeholder="请选择单位"
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
      title: '换算关系',
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
                placeholder="分子"
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
                placeholder="分母"
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
      title: '使用场景',
      dataIndex: 'scenarios',
      render: (_: any, record: MaterialUnit, index: number) => (
        <Select
          mode="multiple"
          value={record.scenarios || []}
          onChange={(value: string[]) => handleUnitChange(index, 'scenarios', value)}
          placeholder="选择使用场景"
          style={{ width: '100%' }}
          options={[
            { label: '采购', value: 'purchase' },
            { label: '销售', value: 'sale' },
            { label: '生产', value: 'production' },
            { label: '库存', value: 'inventory' },
          ]}
        />
      ),
    },
    {
      title: '操作',
      render: (_: any, __: MaterialUnit, index: number) => (
        <Button
          type="link"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDeleteUnit(index)}
        >
          删除
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
        errors.push(`第${index + 1}行的单位名称不能为空`);
      } else {
        const unitName = unit.unit.trim();
        if (unitNames.has(unitName)) {
          errors.push(`单位"${unitName}"重复，请使用不同的单位名称`);
        }
        unitNames.add(unitName);
      }
      
      if (unit.unit && unit.unit.trim() === baseUnit) {
        errors.push(`单位"${unit.unit}"与基础单位重复，辅助单位不能与基础单位相同`);
      }
      
      if (!unit.numerator || unit.numerator <= 0) {
        errors.push(`单位"${unit.unit || `第${index + 1}行`}"的换算分子必须大于0`);
      }
      
      if (!unit.denominator || unit.denominator <= 0) {
        errors.push(`单位"${unit.unit || `第${index + 1}行`}"的换算分母必须大于0`);
      }
    });
    
    return errors;
  };

  const validationErrors = validateUnits();
  const hasErrors = validationErrors.length > 0;

  return (
    <div style={{ width: '100%', display: 'block', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontWeight: 500 }}>多单位管理</div>
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
      {!baseUnit && (
        <Alert
          message='请先在"基本信息"标签页设置基础单位'
          type="warning"
          showIcon
          style={{ marginBottom: 8 }}
        />
      )}
      <Alert
        message="使用说明"
        description={
          <>
            <div style={{ marginBottom: 4 }}>
              <strong>换算关系设置：</strong>使用"分子/分母"的方式表示换算关系，避免精度丢失。例如：1吨 = 1000kg，则分子=1000，分母=1（即 1000/1）。
            </div>
            <div>
              <strong>换算公式：</strong>1个辅助单位 = (分子/分母) × 1个基础单位
            </div>
          </>
        }
        type="info"
        showIcon
        style={{ marginBottom: 8 }}
      />
      {hasErrors && (
        <Alert
          message="配置错误"
          description={
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          }
          type="error"
          showIcon
          style={{ marginBottom: 8 }}
        />
      )}
      {units.length > 0 && !hasErrors && baseUnit && (
        <Alert
          message="多单位配置正确"
          description={
            <>
              <div style={{ marginBottom: 4 }}>
                <strong>基础单位：</strong>{unitValueToLabel[baseUnit] || baseUnit}（库存单位）
              </div>
              <div style={{ marginBottom: 4 }}>
                <strong>辅助单位配置：</strong>
              </div>
              {units.map((unit, index) => {
                const numerator = unit.numerator || 1;
                const denominator = unit.denominator || 1;
                const conversionRate = numerator / denominator;
                const isInteger = Number.isInteger(conversionRate);
                const unitLabel = unit.unit ? unitValueToLabel[unit.unit] : unit.unit;
                const baseUnitLabel = baseUnit ? unitValueToLabel[baseUnit] : baseUnit;
                return (
                  <div key={index} style={{ marginLeft: 16, marginBottom: 2 }}>
                    • {unitLabel || unit.unit}：1 {unitLabel || unit.unit} = {isInteger ? conversionRate : `${numerator}/${denominator}`} {baseUnitLabel || baseUnit}
                  </div>
                );
              })}
              {(scenarios.purchase || scenarios.sale || scenarios.production) && (
                <>
                  <div style={{ marginTop: 8, marginBottom: 4 }}>
                    <strong>场景单位映射：</strong>
                  </div>
                  {scenarios.purchase && (
                    <div style={{ marginLeft: 16, marginBottom: 2 }}>• 采购单位：{unitValueToLabel[scenarios.purchase] || scenarios.purchase}</div>
                  )}
                  {scenarios.sale && (
                    <div style={{ marginLeft: 16, marginBottom: 2 }}>• 销售单位：{unitValueToLabel[scenarios.sale] || scenarios.sale}</div>
                  )}
                  {scenarios.production && (
                    <div style={{ marginLeft: 16, marginBottom: 2 }}>• 生产单位：{unitValueToLabel[scenarios.production] || scenarios.production}</div>
                  )}
                  <div style={{ marginLeft: 16 }}>• 库存单位：{unitValueToLabel[baseUnit] || baseUnit}（基础单位）</div>
                </>
              )}
            </>
          }
          type="success"
          showIcon
          style={{ marginBottom: 8 }}
        />
      )}
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
                placeholder="选择采购单位"
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
                placeholder="选择销售单位"
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
                placeholder="选择生产单位"
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
                placeholder="基础单位"
              />
            </Col>
          </Row>
        </div>
      )}
    </div>
  );
};

/**
 * 基本信息标签页
 */
interface BasicInfoTabProps {
  formRef: React.RefObject<ProFormInstance>;
  materialGroups: Array<{ id: number; code: string; name: string }>;
  variantManaged: boolean;
  onVariantManagedChange: (checked: boolean) => void;
  isEdit: boolean;
}

const BasicInfoTab: React.FC<BasicInfoTabProps> = ({
  formRef,
  materialGroups,
  variantManaged,
  onVariantManagedChange,
  isEdit,
}) => {
  return (
    <Row gutter={16}>
      {/* 1. 物料主编码 */}
      <Col span={12}>
        <ProFormText
          name="mainCode"
          label="物料主编码"
          placeholder={isAutoGenerateEnabled('master-data-material') ? '编码已根据编码规则自动生成，也可手动编辑' : '请输入物料主编码'}
          rules={[
            { required: true, message: '请输入物料主编码' },
            { max: 50, message: '物料主编码不能超过50个字符' },
          ]}
          fieldProps={{
            style: { textTransform: 'uppercase' },
            // 允许手动编辑编码
          }}
          extra={!isEdit && isAutoGenerateEnabled('master-data-material') ? '编码已根据编码规则自动生成，也可手动编辑。选择物料分组后会自动更新编码。' : undefined}
        />
      </Col>
      {/* 2. 物料名称 */}
      <Col span={12}>
        <ProFormText
          name="name"
          label="物料名称"
          placeholder="请输入物料名称"
          rules={[
            { required: true, message: '请输入物料名称' },
            { max: 200, message: '物料名称不能超过200个字符' },
          ]}
        />
      </Col>
      {/* 3. 物料分组 */}
      <Col span={12}>
        <SafeProFormSelect
          name="groupId"
          label="物料分组"
          placeholder="请选择物料分组（可选）"
          options={materialGroups.map(g => ({
            label: `${g.code} - ${g.name}`,
            value: g.id,
          }))}
          fieldProps={{
            showSearch: true,
            allowClear: true,
          }}
        />
      </Col>
      {/* 4. 物料类型 */}
      <Col span={12}>
        <DictionarySelect
          dictionaryCode="MATERIAL_TYPE"
          name="materialType"
          label="物料类型"
          placeholder="请选择物料类型（可选）"
          formRef={formRef}
        />
      </Col>
      {/* 5. 规格 */}
      <Col span={12}>
        <ProFormText
          name="specification"
          label="规格"
          placeholder="请输入规格"
          rules={[{ max: 500, message: '规格不能超过500个字符' }]}
        />
      </Col>
      {/* 6. 型号 */}
      <Col span={12}>
        <ProFormText
          name="model"
          label="型号"
          placeholder="请输入型号"
          rules={[{ max: 100, message: '型号不能超过100个字符' }]}
        />
      </Col>
      {/* 7. 基础单位 */}
      <Col span={12}>
        <DictionarySelect
          dictionaryCode="MATERIAL_UNIT"
          name="baseUnit"
          label="基础单位"
          placeholder="请选择基础单位（如：个、件、kg等）"
          required
          formRef={formRef}
          initialValue="PC"
        />
      </Col>
      {/* 8. 品牌 */}
      <Col span={12}>
        <ProFormText
          name="brand"
          label="品牌"
          placeholder="请输入品牌"
          rules={[{ max: 100, message: '品牌不能超过100个字符' }]}
        />
      </Col>
      {/* 剩余字段保持不变 */}
      <Col span={12}>
        <ProFormSwitch
          name="batchManaged"
          label="是否启用批号管理"
        />
      </Col>
      <Col span={12}>
        <ProFormSwitch
          name="variantManaged"
          label="是否启用变体管理"
          fieldProps={{
            onChange: onVariantManagedChange,
          }}
        />
      </Col>
      <Col span={24}>
        <ProFormTextArea
          name="description"
          label="描述"
          placeholder="请输入描述"
          fieldProps={{
            rows: 4,
            maxLength: 500,
          }}
        />
      </Col>
      <Col span={12}>
        <ProFormSwitch
          name="isActive"
          label="是否启用"
        />
      </Col>
    </Row>
  );
};

/**
 * 变体管理标签页
 */
const VariantManagementTab: React.FC = () => {
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
        messageApi.error(error.message || '加载变体属性定义失败');
      } finally {
        setDefinitionsLoading(false);
      }
    };

    loadDefinitions();
  }, []);

  if (definitionsLoading) {
    return <div>加载中...</div>;
  }

  if (variantAttributeDefinitions.length === 0) {
    return (
      <div>
        <p>暂无变体属性定义</p>
        <p>请先在"物料数据 → 变体属性"中配置变体属性定义</p>
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
                  placeholder={`请选择${def.display_name}`}
                  required={def.is_required}
                  tooltip={def.description}
                  options={def.enum_values?.map(v => ({ label: v, value: v }))}
                  rules={[
                    {
                      required: def.is_required,
                      message: `请选择${def.display_name}`,
                    },
                    {
                      validator: async (_: any, value: any) => {
                        if (!value && def.is_required) {
                          throw new Error(`请选择${def.display_name}`);
                        }
                        // 验证属性值
                        if (value) {
                          try {
                            const result = await variantAttributeApi.validate({
                              attribute_name: def.attribute_name,
                              attribute_value: value,
                            });
                            if (!result.is_valid) {
                              throw new Error(result.error_message || '属性值验证失败');
                            }
                          } catch (error: any) {
                            throw new Error(error.message || '属性值验证失败');
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
                  placeholder={`请输入${def.display_name}`}
                  required={def.is_required}
                  tooltip={def.description}
                  fieldProps={{
                    maxLength: def.validation_rules?.max_length,
                  }}
                  rules={[
                    {
                      required: def.is_required,
                      message: `请输入${def.display_name}`,
                    },
                    {
                      validator: async (_: any, value: any) => {
                        if (!value && def.is_required) {
                          throw new Error(`请输入${def.display_name}`);
                        }
                        // 验证属性值
                        if (value) {
                          try {
                            const result = await variantAttributeApi.validate({
                              attribute_name: def.attribute_name,
                              attribute_value: value,
                            });
                            if (!result.is_valid) {
                              throw new Error(result.error_message || '属性值验证失败');
                            }
                          } catch (error: any) {
                            throw new Error(error.message || '属性值验证失败');
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
                  placeholder={`请输入${def.display_name}`}
                  required={def.is_required}
                  tooltip={def.description}
                  fieldProps={{
                    min: def.validation_rules?.min,
                    max: def.validation_rules?.max,
                  }}
                  rules={[
                    {
                      required: def.is_required,
                      message: `请输入${def.display_name}`,
                    },
                    {
                      validator: async (_: any, value: any) => {
                        if (!value && def.is_required) {
                          throw new Error(`请输入${def.display_name}`);
                        }
                        // 验证属性值
                        if (value) {
                          try {
                            const result = await variantAttributeApi.validate({
                              attribute_name: def.attribute_name,
                              attribute_value: value,
                            });
                            if (!result.is_valid) {
                              throw new Error(result.error_message || '属性值验证失败');
                            }
                          } catch (error: any) {
                            throw new Error(error.message || '属性值验证失败');
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
                  placeholder={`请选择${def.display_name}`}
                  required={def.is_required}
                  tooltip={def.description}
                  fieldProps={{
                    type: 'date',
                  }}
                  rules={[
                    {
                      required: def.is_required,
                      message: `请选择${def.display_name}`,
                    },
                    {
                      validator: async (_: any, value: any) => {
                        if (!value && def.is_required) {
                          throw new Error(`请选择${def.display_name}`);
                        }
                        // 验证属性值
                        if (value) {
                          try {
                            const result = await variantAttributeApi.validate({
                              attribute_name: def.attribute_name,
                              attribute_value: value,
                            });
                            if (!result.is_valid) {
                              throw new Error(result.error_message || '属性值验证失败');
                            }
                          } catch (error: any) {
                            throw new Error(error.message || '属性值验证失败');
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
                  placeholder={`请选择${def.display_name}`}
                  required={def.is_required}
                  tooltip={def.description}
                  options={[
                    { label: '是', value: true },
                    { label: '否', value: false },
                  ]}
                  rules={[
                    {
                      required: def.is_required,
                      message: `请选择${def.display_name}`,
                    },
                    {
                      validator: async (_, value) => {
                        if (!value && def.is_required) {
                          throw new Error(`请选择${def.display_name}`);
                        }
                        // 验证属性值
                        if (value !== undefined && value !== null) {
                          try {
                            const result = await variantAttributeApi.validate({
                              attribute_name: def.attribute_name,
                              attribute_value: value,
                            });
                            if (!result.is_valid) {
                              throw new Error(result.error_message || '属性值验证失败');
                            }
                          } catch (error: any) {
                            throw new Error(error.message || '属性值验证失败');
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
                  placeholder={`请输入${def.display_name}`}
                  required={def.is_required}
                  tooltip={def.description}
                  rules={[
                    {
                      required: def.is_required,
                      message: `请输入${def.display_name}`,
                    },
                    {
                      validator: async (_: any, value: any) => {
                        if (!value && def.is_required) {
                          throw new Error(`请输入${def.display_name}`);
                        }
                        // 验证属性值
                        if (value) {
                          try {
                            const result = await variantAttributeApi.validate({
                              attribute_name: def.attribute_name,
                              attribute_value: value,
                            });
                            if (!result.is_valid) {
                              throw new Error(result.error_message || '属性值验证失败');
                            }
                          } catch (error: any) {
                            throw new Error(error.message || '属性值验证失败');
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
  customers: Customer[];
  suppliers: Supplier[];
  customersLoading: boolean;
  suppliersLoading: boolean;
  onDepartmentCodesChange: (codes: DepartmentCodeMapping[]) => void;
  onCustomerCodesChange: (codes: CustomerCodeMapping[]) => void;
  onSupplierCodesChange: (codes: SupplierCodeMapping[]) => void;
}

const CodeMappingTab: React.FC<CodeMappingTabProps> = ({
  departmentCodes,
  customerCodes,
  supplierCodes,
  customers,
  suppliers,
  customersLoading,
  suppliersLoading,
  onDepartmentCodesChange,
  onCustomerCodesChange,
  onSupplierCodesChange,
}) => {
  const [deptForm] = Form.useForm();
  const [customerForm] = Form.useForm();
  const [supplierForm] = Form.useForm();

  // Modal 状态
  const [deptModalVisible, setDeptModalVisible] = useState(false);
  const [customerModalVisible, setCustomerModalVisible] = useState(false);
  const [supplierModalVisible, setSupplierModalVisible] = useState(false);

  // 部门编码类型选项
  const departmentCodeTypes = [
    { label: '销售编码', value: 'SALE' },
    { label: '设计编码', value: 'DES' },
    { label: '采购编码', value: 'PUR' },
    { label: '仓库编码', value: 'WH' },
    { label: '生产编码', value: 'PROD' },
  ];

  // 打开部门编码 Modal
  const handleOpenDeptModal = () => {
    setDeptModalVisible(true);
    deptForm.resetFields();
  };

  // 添加部门编码
  const handleAddDepartmentCode = () => {
    deptForm.validateFields().then((validatedValues) => {
      onDepartmentCodesChange([...departmentCodes, validatedValues]);
      deptForm.resetFields();
      setDeptModalVisible(false);
    }).catch(() => {
      // 验证失败，不做任何操作
    });
  };

  // 删除部门编码
  const handleDeleteDepartmentCode = (index: number) => {
    const newCodes = [...departmentCodes];
    newCodes.splice(index, 1);
    onDepartmentCodesChange(newCodes);
  };

  // 打开客户编码 Modal
  const handleOpenCustomerModal = () => {
    setCustomerModalVisible(true);
    customerForm.resetFields();
  };

  // 添加客户编码
  const handleAddCustomerCode = () => {
    customerForm.validateFields().then((validatedValues) => {
      const customer = customers.find(c => c.id === validatedValues.customerId);
      onCustomerCodesChange([
        ...customerCodes,
        {
          ...validatedValues,
          customerName: customer?.name,
          customerUuid: customer?.uuid,
        },
      ]);
      customerForm.resetFields();
      setCustomerModalVisible(false);
    }).catch(() => {
      // 验证失败，不做任何操作
    });
  };

  // 删除客户编码
  const handleDeleteCustomerCode = (index: number) => {
    const newCodes = [...customerCodes];
    newCodes.splice(index, 1);
    onCustomerCodesChange(newCodes);
  };

  // 打开供应商编码 Modal
  const handleOpenSupplierModal = () => {
    setSupplierModalVisible(true);
    supplierForm.resetFields();
  };

  // 添加供应商编码
  const handleAddSupplierCode = () => {
    supplierForm.validateFields().then((validatedValues) => {
      const supplier = suppliers.find(s => s.id === validatedValues.supplierId);
      onSupplierCodesChange([
        ...supplierCodes,
        {
          ...validatedValues,
          supplierName: supplier?.name,
          supplierUuid: supplier?.uuid,
        },
      ]);
      supplierForm.resetFields();
      setSupplierModalVisible(false);
    }).catch(() => {
      // 验证失败，不做任何操作
    });
  };

  // 删除供应商编码
  const handleDeleteSupplierCode = (index: number) => {
    const newCodes = [...supplierCodes];
    newCodes.splice(index, 1);
    onSupplierCodesChange(newCodes);
  };

  return (
    <>
      {/* 公司内部部门编码 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 8, fontWeight: 500 }}>公司内部部门编码</div>
        <Table
          dataSource={departmentCodes}
          columns={[
            { title: '编码类型', dataIndex: 'code_type', key: 'code_type', width: 120 },
            { title: '编码', dataIndex: 'code', key: 'code', width: 150 },
            { title: '名称', dataIndex: 'name', key: 'name', width: 150 },
            { title: '部门', dataIndex: 'department', key: 'department', width: 120 },
            { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
            {
              title: '操作',
              key: 'action',
              width: 80,
              fixed: 'right' as const,
              render: (_, __, index) => (
                <Button
                  type="link"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDeleteDepartmentCode(index)}
                >
                  删除
                </Button>
              ),
            },
          ]}
          pagination={false}
          size="small"
          locale={{ emptyText: '暂无部门编码' }}
          footer={() => (
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={handleOpenDeptModal}
              block
            >
              添加部门编码
            </Button>
          )}
        />
      </div>

      {/* 客户物料编码 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 8, fontWeight: 500 }}>客户物料编码</div>
        <Table
          dataSource={customerCodes}
          columns={[
            { title: '客户', dataIndex: 'customerName', key: 'customerName', width: 200 },
            { title: '客户编码', dataIndex: 'code', key: 'code', width: 150 },
            { title: '名称', dataIndex: 'name', key: 'name', width: 150 },
            { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
            {
              title: '操作',
              key: 'action',
              width: 80,
              fixed: 'right' as const,
              render: (_, __, index) => (
                <Button
                  type="link"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDeleteCustomerCode(index)}
                >
                  删除
                </Button>
              ),
            },
          ]}
          pagination={false}
          size="small"
          locale={{ emptyText: '暂无客户编码' }}
          footer={() => (
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={handleOpenCustomerModal}
              block
            >
              添加客户编码
            </Button>
          )}
        />
      </div>

      {/* 供应商物料编码 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 8, fontWeight: 500 }}>供应商物料编码</div>
        <Table
          dataSource={supplierCodes}
          columns={[
            { title: '供应商', dataIndex: 'supplierName', key: 'supplierName', width: 200 },
            { title: '供应商编码', dataIndex: 'code', key: 'code', width: 150 },
            { title: '名称', dataIndex: 'name', key: 'name', width: 150 },
            { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
            {
              title: '操作',
              key: 'action',
              width: 80,
              fixed: 'right' as const,
              render: (_, __, index) => (
                <Button
                  type="link"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDeleteSupplierCode(index)}
                >
                  删除
                </Button>
              ),
            },
          ]}
          pagination={false}
          size="small"
          locale={{ emptyText: '暂无供应商编码' }}
          footer={() => (
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={handleOpenSupplierModal}
              block
            >
              添加供应商编码
            </Button>
          )}
        />
      </div>

      {/* 部门编码 Modal */}
      <Modal
        title="添加部门编码"
        open={deptModalVisible}
        onOk={handleAddDepartmentCode}
        onCancel={() => setDeptModalVisible(false)}
        width={600}
      >
        <Form form={deptForm} layout="vertical">
          <Form.Item name="code_type" label="编码类型" rules={[{ required: true, message: '请选择编码类型' }]}>
            <Select placeholder="编码类型" options={departmentCodeTypes} />
          </Form.Item>
          <Form.Item name="code" label="编码" rules={[{ required: true, message: '请输入编码' }]}>
            <Input placeholder="编码" />
          </Form.Item>
          <Form.Item name="name" label="名称（可选）">
            <Input placeholder="名称（可选）" />
          </Form.Item>
          <Form.Item name="department" label="部门（可选）">
            <Input placeholder="部门（可选）" />
          </Form.Item>
          <Form.Item name="description" label="描述（可选）">
            <Input.TextArea placeholder="描述（可选）" rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 客户编码 Modal */}
      <Modal
        title="添加客户编码"
        open={customerModalVisible}
        onOk={handleAddCustomerCode}
        onCancel={() => setCustomerModalVisible(false)}
        width={600}
      >
        <Form form={customerForm} layout="vertical">
          <Form.Item name="customerId" label="客户" rules={[{ required: true, message: '请选择客户' }]}>
            <Select
              placeholder="选择客户"
              loading={customersLoading}
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={customers.map(c => ({ label: `${c.code} - ${c.name}`, value: c.id }))}
            />
          </Form.Item>
          <Form.Item name="code" label="客户编码" rules={[{ required: true, message: '请输入客户编码' }]}>
            <Input placeholder="客户编码" />
          </Form.Item>
          <Form.Item name="name" label="名称（可选）">
            <Input placeholder="名称（可选）" />
          </Form.Item>
          <Form.Item name="description" label="描述（可选）">
            <Input.TextArea placeholder="描述（可选）" rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 供应商编码 Modal */}
      <Modal
        title="添加供应商编码"
        open={supplierModalVisible}
        onOk={handleAddSupplierCode}
        onCancel={() => setSupplierModalVisible(false)}
        width={600}
      >
        <Form form={supplierForm} layout="vertical">
          <Form.Item name="supplierId" label="供应商" rules={[{ required: true, message: '请选择供应商' }]}>
            <Select
              placeholder="选择供应商"
              loading={suppliersLoading}
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={suppliers.map(s => ({ label: `${s.code} - ${s.name}`, value: s.id }))}
            />
          </Form.Item>
          <Form.Item name="code" label="供应商编码" rules={[{ required: true, message: '请输入供应商编码' }]}>
            <Input placeholder="供应商编码" />
          </Form.Item>
          <Form.Item name="name" label="名称（可选）">
            <Input placeholder="名称（可选）" />
          </Form.Item>
          <Form.Item name="description" label="描述（可选）">
            <Input.TextArea placeholder="描述（可选）" rows={3} />
          </Form.Item>
        </Form>
      </Modal>
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
  processRoutes: ProcessRoute[];
  suppliersLoading: boolean;
  customersLoading: boolean;
  warehousesLoading: boolean;
  processRoutesLoading: boolean;
}

const DefaultsTab: React.FC<DefaultsTabProps> = ({
  suppliers,
  customers,
  warehouses,
  processRoutes,
  suppliersLoading,
  customersLoading,
  warehousesLoading,
  processRoutesLoading,
}) => {
  return (
    <Collapse defaultActiveKey={['finance', 'purchase', 'sale', 'inventory', 'production']}>
        {/* 财务默认值 */}
        <Panel header="财务默认值" key="finance">
          <Row gutter={16}>
            <Col span={12}>
              <ProFormDigit
                name="defaults.defaultTaxRate"
                label="默认税率（%）"
                placeholder="请输入默认税率，如：13表示13%"
                min={0}
                max={100}
              />
            </Col>
            <Col span={12}>
              <ProFormText
                name="defaults.defaultAccount"
                label="默认科目"
                placeholder="请输入默认科目"
              />
            </Col>
          </Row>
        </Panel>

        {/* 采购默认值 */}
        <Panel header="采购默认值" key="purchase">
          <Row gutter={16}>
            <Col span={12}>
              <ProFormSelect
                name="defaults.defaultSupplierIds"
                label="默认供应商（可多选，按优先级排序）"
                placeholder="请选择默认供应商"
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
                label="默认采购价格"
                placeholder="请输入默认采购价格"
                min={0}
              />
            </Col>
            <Col span={12}>
              <ProFormText
                name="defaults.defaultPurchaseUnit"
                label="默认采购单位"
                placeholder="请输入默认采购单位"
              />
            </Col>
            <Col span={12}>
              <ProFormDigit
                name="defaults.defaultPurchaseLeadTime"
                label="默认采购周期（天）"
                placeholder="请输入默认采购周期"
                min={0}
              />
            </Col>
          </Row>
        </Panel>

        {/* 销售默认值 */}
        <Panel header="销售默认值" key="sale">
          <Row gutter={16}>
            <Col span={12}>
              <ProFormDigit
                name="defaults.defaultSalePrice"
                label="默认销售价格"
                placeholder="请输入默认销售价格"
                min={0}
              />
            </Col>
            <Col span={12}>
              <ProFormText
                name="defaults.defaultSaleUnit"
                label="默认销售单位"
                placeholder="请输入默认销售单位"
              />
            </Col>
            <Col span={12}>
              <ProFormSelect
                name="defaults.defaultCustomerIds"
                label="默认客户（可多选）"
                placeholder="请选择默认客户"
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
        <Panel header="库存默认值" key="inventory">
          <Row gutter={16}>
            <Col span={12}>
              <ProFormSelect
                name="defaults.defaultWarehouseIds"
                label="默认仓库（可多选，按优先级排序）"
                placeholder="请选择默认仓库"
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
                label="默认库位"
                placeholder="请输入默认库位"
              />
            </Col>
            <Col span={12}>
              <ProFormDigit
                name="defaults.safetyStock"
                label="安全库存"
                placeholder="请输入安全库存"
                min={0}
              />
            </Col>
            <Col span={12}>
              <ProFormDigit
                name="defaults.maxStock"
                label="最大库存"
                placeholder="请输入最大库存"
                min={0}
              />
            </Col>
            <Col span={12}>
              <ProFormDigit
                name="defaults.minStock"
                label="最小库存"
                placeholder="请输入最小库存"
                min={0}
              />
            </Col>
          </Row>
        </Panel>

        {/* 生产默认值 */}
        <Panel header="生产默认值" key="production">
          <Row gutter={16}>
            <Col span={12}>
              <ProFormSelect
                name="defaults.defaultProcessRouteUuid"
                label="默认工艺路线"
                placeholder="请选择默认工艺路线"
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
            <Col span={12}>
              <ProFormText
                name="defaults.defaultProductionUnit"
                label="默认生产单位"
                placeholder="请输入默认生产单位"
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
  suppliersLoading: boolean;
  processRoutesLoading: boolean;
}

const MaterialSourceTab: React.FC<MaterialSourceTabProps> = ({
  formRef,
  material,
  suppliers,
  processRoutes,
  suppliersLoading,
  processRoutesLoading,
}) => {
  const { message: messageApi } = App.useApp();
  const [sourceType, setSourceType] = useState<string | undefined>(material?.sourceType || material?.source_type);
  const [validationResult, setValidationResult] = useState<{
    is_valid: boolean;
    errors: string[];
    warnings: string[];
  } | null>(null);
  const [suggestionResult, setSuggestionResult] = useState<{
    suggested_type: string | null;
    confidence: number;
    reasons: string[];
  } | null>(null);
  const [completenessResult, setCompletenessResult] = useState<{
    is_complete: boolean;
    missing_configs: string[];
    warnings: string[];
  } | null>(null);
  const [loadingValidation, setLoadingValidation] = useState(false);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);

  /**
   * 物料来源类型选项
   */
  const sourceTypeOptions = [
    { label: '自制件 (Make)', value: 'Make' },
    { label: '采购件 (Buy)', value: 'Buy' },
    { label: '虚拟件 (Phantom)', value: 'Phantom' },
    { label: '委外件 (Outsource)', value: 'Outsource' },
    { label: '配置件 (Configure)', value: 'Configure' },
  ];

  /**
   * 处理物料来源类型变化
   */
  const handleSourceTypeChange = (value: string) => {
    setSourceType(value);
    formRef.current?.setFieldsValue({
      sourceType: value,
      source_type: value, // 向后兼容
    });
    
    // 根据来源类型初始化配置
    const currentConfig = formRef.current?.getFieldValue('sourceConfig') || formRef.current?.getFieldValue('source_config') || {};
    let newConfig = { ...currentConfig };
    
    if (value === 'Make') {
      // 自制件：保留BOM和工艺路线配置
      newConfig = {
        ...newConfig,
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
    
    // 验证配置
    if (material?.uuid) {
      validateSourceConfig();
    }
  };

  /**
   * 验证物料来源配置
   */
  const validateSourceConfig = async () => {
    if (!material?.uuid) return;
    
    try {
      setLoadingValidation(true);
      const result = await materialSourceApi.validate(material.uuid);
      setValidationResult(result);
    } catch (error: any) {
      messageApi.error(`验证失败: ${error.message || '未知错误'}`);
    } finally {
      setLoadingValidation(false);
    }
  };

  /**
   * 获取智能建议
   */
  const loadSuggestion = async () => {
    if (!material?.uuid) return;
    
    try {
      setLoadingSuggestion(true);
      const result = await materialSourceApi.suggest(material.uuid);
      setSuggestionResult(result);
    } catch (error: any) {
      messageApi.error(`获取建议失败: ${error.message || '未知错误'}`);
    } finally {
      setLoadingSuggestion(false);
    }
  };

  /**
   * 检查配置完整性
   */
  const checkCompleteness = async () => {
    if (!material?.uuid) return;
    
    try {
      const result = await materialSourceApi.checkCompleteness(material.uuid);
      setCompletenessResult(result);
    } catch (error: any) {
      messageApi.error(`检查失败: ${error.message || '未知错误'}`);
    }
  };

  /**
   * 初始化时加载建议和验证
   */
  useEffect(() => {
    if (material?.uuid) {
      loadSuggestion();
      validateSourceConfig();
      checkCompleteness();
    }
  }, [material?.uuid]);

  /**
   * 监听来源类型变化，重新验证
   */
  useEffect(() => {
    if (sourceType && material?.uuid) {
      validateSourceConfig();
      checkCompleteness();
    }
  }, [sourceType]);

  return (
    <div>
      {/* 智能建议 */}
      {suggestionResult && suggestionResult.suggested_type && (
        <Alert
          message={`智能建议：${sourceTypeOptions.find(opt => opt.value === suggestionResult.suggested_type)?.label || suggestionResult.suggested_type}`}
          description={
            <div>
              <div>置信度：{(suggestionResult.confidence * 100).toFixed(0)}%</div>
              <div style={{ marginTop: 8 }}>
                <strong>建议原因：</strong>
                <ul style={{ marginTop: 4, marginBottom: 0 }}>
                  {suggestionResult.reasons.map((reason, index) => (
                    <li key={index}>{reason}</li>
                  ))}
                </ul>
              </div>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          action={
            <Button
              size="small"
              onClick={() => {
                if (suggestionResult.suggested_type) {
                  handleSourceTypeChange(suggestionResult.suggested_type);
                }
              }}
            >
              应用建议
            </Button>
          }
        />
      )}

      {/* 验证结果 */}
      {validationResult && (
        <Alert
          message={validationResult.is_valid ? '验证通过' : '验证失败'}
          description={
            <div>
              {validationResult.errors.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <strong style={{ color: '#ff4d4f' }}>错误：</strong>
                  <ul style={{ marginTop: 4, marginBottom: 0 }}>
                    {validationResult.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
              {validationResult.warnings.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <strong style={{ color: '#faad14' }}>警告：</strong>
                  <ul style={{ marginTop: 4, marginBottom: 0 }}>
                    {validationResult.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          }
          type={validationResult.is_valid ? 'success' : 'error'}
          showIcon
          style={{ marginBottom: 16 }}
          action={
            <Button
              size="small"
              loading={loadingValidation}
              onClick={validateSourceConfig}
            >
              重新验证
            </Button>
          }
        />
      )}

      {/* 配置完整性检查 */}
      {completenessResult && !completenessResult.is_complete && (
        <Alert
          message="配置不完整"
          description={
            <div>
              <div style={{ marginTop: 8 }}>
                <strong>缺失配置：</strong>
                <ul style={{ marginTop: 4, marginBottom: 0 }}>
                  {completenessResult.missing_configs.map((config, index) => (
                    <li key={index}>{config}</li>
                  ))}
                </ul>
              </div>
              {completenessResult.warnings.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <strong>建议：</strong>
                  <ul style={{ marginTop: 4, marginBottom: 0 }}>
                    {completenessResult.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          }
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 物料来源类型选择 */}
      <ProFormSelect
        name="sourceType"
        label="物料来源类型"
        placeholder="请选择物料来源类型"
        options={sourceTypeOptions}
        fieldProps={{
          value: sourceType,
          onChange: handleSourceTypeChange,
        }}
        extra="物料来源类型决定了物料的获取方式（自制/采购/委外等）"
      />

      {/* 根据来源类型动态显示配置项 */}
      <ProFormDependency name={['sourceType', 'sourceConfig']}>
        {({ sourceType: currentSourceType, sourceConfig }) => {
          const config = sourceConfig || {};
          
          if (currentSourceType === 'Make') {
            // 自制件配置
            return (
              <div>
                <ProFormSelect
                  name="defaults.defaultProcessRouteUuid"
                  label="默认工艺路线"
                  placeholder="请选择默认工艺路线"
                  options={processRoutes.map(pr => ({ label: `${pr.code} - ${pr.name}`, value: pr.uuid }))}
                  fieldProps={{
                    loading: processRoutesLoading,
                    showSearch: true,
                    filterOption: (input: string, option: any) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
                    allowClear: true,
                  }}
                />
                <ProFormDigit
                  name="sourceConfig.production_lead_time"
                  label="生产提前期（天）"
                  placeholder="请输入生产提前期"
                  min={0}
                />
                <ProFormDigit
                  name="sourceConfig.min_production_batch"
                  label="最小生产批量"
                  placeholder="请输入最小生产批量"
                  min={0}
                />
                <ProFormDigit
                  name="sourceConfig.production_waste_rate"
                  label="生产损耗率（%）"
                  placeholder="请输入生产损耗率"
                  min={0}
                  max={100}
                />
              </div>
            );
          } else if (currentSourceType === 'Buy') {
            // 采购件配置
            return (
              <div>
                <SafeProFormSelect
                  name="sourceConfig.default_supplier_id"
                  label="默认供应商"
                  placeholder="请选择默认供应商（建议配置）"
                  options={suppliers.map(s => ({ label: `${s.code} - ${s.name}`, value: s.id }))}
                  fieldProps={{
                    loading: suppliersLoading,
                    showSearch: true,
                    filterOption: (input: string, option: any) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
                    allowClear: true,
                  }}
                />
                <ProFormDigit
                  name="sourceConfig.purchase_lead_time"
                  label="采购提前期（天）"
                  placeholder="请输入采购提前期"
                  min={0}
                />
                <ProFormDigit
                  name="sourceConfig.min_purchase_batch"
                  label="最小采购批量"
                  placeholder="请输入最小采购批量"
                  min={0}
                />
                <ProFormDigit
                  name="sourceConfig.purchase_price"
                  label="采购价格"
                  placeholder="请输入采购价格"
                  min={0}
                  fieldProps={{
                    precision: 2,
                  }}
                />
              </div>
            );
          } else if (currentSourceType === 'Outsource') {
            // 委外件配置
            return (
              <div>
                <SafeProFormSelect
                  name="sourceConfig.outsource_supplier_id"
                  label="委外供应商"
                  placeholder="请选择委外供应商"
                  rules={[{ required: true, message: '请选择委外供应商' }]}
                  options={suppliers.map(s => ({ label: `${s.code} - ${s.name}`, value: s.id }))}
                  fieldProps={{
                    loading: suppliersLoading,
                    showSearch: true,
                    filterOption: (input: string, option: any) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
                  }}
                />
                <ProFormText
                  name="sourceConfig.outsource_operation"
                  label="委外工序"
                  placeholder="请输入委外工序"
                  rules={[{ required: true, message: '请输入委外工序' }]}
                />
                <ProFormDigit
                  name="sourceConfig.outsource_lead_time"
                  label="委外提前期（天）"
                  placeholder="请输入委外提前期"
                  min={0}
                />
                <ProFormDigit
                  name="sourceConfig.outsource_price"
                  label="委外价格"
                  placeholder="请输入委外价格"
                  min={0}
                  fieldProps={{
                    precision: 2,
                  }}
                />
                <ProFormSelect
                  name="sourceConfig.material_provided_by"
                  label="物料提供方"
                  placeholder="请选择物料提供方"
                  options={[
                    { label: '企业提供', value: 'enterprise' },
                    { label: '供应商提供', value: 'supplier' },
                  ]}
                  initialValue="enterprise"
                />
              </div>
            );
          } else if (currentSourceType === 'Configure') {
            // 配置件配置
            return (
              <div>
                <Alert
                  message="配置件说明"
                  description="配置件需要配置变体属性和BOM变体，请在'变体管理'标签页配置变体属性。"
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                <ProFormTextArea
                  name="sourceConfig.bom_variants"
                  label="BOM变体配置（JSON格式）"
                  placeholder='请输入BOM变体配置，格式：{"variant1": {...}, "variant2": {...}}'
                  fieldProps={{
                    rows: 6,
                  }}
                />
                <ProFormText
                  name="sourceConfig.default_variant"
                  label="默认变体"
                  placeholder="请输入默认变体"
                />
              </div>
            );
          } else if (currentSourceType === 'Phantom') {
            // 虚拟件配置
            return (
              <div>
                <Alert
                  message="虚拟件说明"
                  description="虚拟件不实际存在，仅用于BOM展开。虚拟件必须配置完整的BOM结构，系统会自动跳过虚拟件，直接展开下层物料。"
                  type="info"
                  showIcon
                />
              </div>
            );
          }
          
          return null;
        }}
      </ProFormDependency>
    </div>
  );
};

export default MaterialForm;
