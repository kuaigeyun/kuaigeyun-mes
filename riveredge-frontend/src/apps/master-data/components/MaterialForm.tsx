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

import React, { useState, useEffect, useRef } from 'react';
import { Modal, Tabs, App, Table, Button, Form, Input, Select, Collapse } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { ProForm, ProFormInstance, ProFormText, ProFormTextArea, ProFormSwitch, ProFormSelect, ProFormDigit } from '@ant-design/pro-components';
import type { Material, MaterialCreate, MaterialUpdate, DepartmentCodeMapping, CustomerCodeMapping, SupplierCodeMapping, MaterialDefaults } from '../types/material';
import type { Customer } from '../types/supply-chain';
import type { Supplier } from '../types/supply-chain';
import SafeProFormSelect from '../../../components/safe-pro-form-select';
import { customerApi } from '../services/supply-chain';
import { supplierApi } from '../services/supply-chain';
import { warehouseApi } from '../services/warehouse';
import { processRouteApi } from '../services/process';
import type { Warehouse } from '../types/warehouse';
import type { ProcessRoute } from '../types/process';
import type { VariantAttributeDefinition } from '../types/variant-attribute';
import { variantAttributeApi } from '../services/variant-attribute';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../utils/codeRulePage';
import { testGenerateCode } from '../../../services/codeRule';

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

  // 默认值数据
  const [defaults, setDefaults] = useState<MaterialDefaults>({});

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
   * 初始化数据
   */
  useEffect(() => {
    if (open) {
      // 加载所有需要的数据
      loadCustomers();
      loadSuppliers();
      loadWarehouses();
      loadProcessRoutes();

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
        const materialDefaults = (material as any).defaults;
        if (materialDefaults) {
          setDefaults(materialDefaults);
        } else {
          setDefaults({});
        }
      } else {
        // 新建模式，重置数据
        setDepartmentCodes([]);
        setCustomerCodes([]);
        setSupplierCodes([]);
        setDefaults({});
      }
    }
  }, [open, isEdit, material]);
  
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
      // 组装完整的数据
      const submitData: MaterialCreate | MaterialUpdate = {
        ...values,
        // 部门编码
        departmentCodes: departmentCodes.length > 0 ? departmentCodes.map(code => ({
          code_type: code.code_type,
          code: code.code,
          department: code.department,
          description: code.description,
        })) : undefined,
        // 客户编码
        customerCodes: customerCodes.length > 0 ? customerCodes.map(code => ({
          customer_id: code.customerId,
          code: code.code,
          description: code.description,
        })) : undefined,
        // 供应商编码
        supplierCodes: supplierCodes.length > 0 ? supplierCodes.map(code => ({
          supplier_id: code.supplierId,
          code: code.code,
          description: code.description,
        })) : undefined,
        // 默认值
        defaults: Object.keys(defaults).length > 0 ? defaults : undefined,
      };

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
    <Modal
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
                <VariantManagementTab
                  formRef={formRef}
                />
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
                  defaults={defaults}
                  suppliers={suppliers}
                  customers={customers}
                  warehouses={warehouses}
                  processRoutes={processRoutes}
                  suppliersLoading={suppliersLoading}
                  customersLoading={customersLoading}
                  warehousesLoading={warehousesLoading}
                  processRoutesLoading={processRoutesLoading}
                  onDefaultsChange={setDefaults}
                />
              ),
            },
          ]}
        />
      </ProForm>
    </Modal>
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
    <div style={{ padding: '16px 0' }}>
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
      <ProFormText
        name="mainCode"
        label="物料主编码"
        placeholder={isAutoGenerateEnabled('master-data-material') ? '编码已根据编码规则自动生成' : '请输入物料主编码'}
        rules={[
          { required: true, message: '请输入物料主编码' },
          { max: 50, message: '物料主编码不能超过50个字符' },
        ]}
        fieldProps={{
          style: { textTransform: 'uppercase' },
          disabled: !isEdit && isAutoGenerateEnabled('master-data-material'),
        }}
        extra={!isEdit && isAutoGenerateEnabled('master-data-material') ? '编码已根据编码规则自动生成' : undefined}
      />
      <ProFormSelect
        name="materialType"
        label="物料类型"
        placeholder="请选择物料类型"
        options={[
          { label: '成品', value: 'FIN' },
          { label: '半成品', value: 'SEMI' },
          { label: '原材料', value: 'RAW' },
          { label: '包装材料', value: 'PACK' },
          { label: '辅助材料', value: 'AUX' },
        ]}
        rules={[{ required: true, message: '请选择物料类型' }]}
      />
      <ProFormText
        name="name"
        label="物料名称"
        placeholder="请输入物料名称"
        rules={[
          { required: true, message: '请输入物料名称' },
          { max: 200, message: '物料名称不能超过200个字符' },
        ]}
      />
      <ProFormText
        name="baseUnit"
        label="基础单位"
        placeholder="请输入基础单位（如：个、件、kg等）"
        rules={[
          { required: true, message: '请输入基础单位' },
          { max: 20, message: '基础单位不能超过20个字符' },
        ]}
      />
      <ProFormText
        name="specification"
        label="规格"
        placeholder="请输入规格"
        rules={[{ max: 500, message: '规格不能超过500个字符' }]}
      />
      <ProFormText
        name="brand"
        label="品牌"
        placeholder="请输入品牌"
        rules={[{ max: 100, message: '品牌不能超过100个字符' }]}
      />
      <ProFormText
        name="model"
        label="型号"
        placeholder="请输入型号"
        rules={[{ max: 100, message: '型号不能超过100个字符' }]}
      />
      <ProFormSwitch
        name="batchManaged"
        label="是否启用批号管理"
      />
      <ProFormSwitch
        name="variantManaged"
        label="是否启用变体管理"
        fieldProps={{
          onChange: onVariantManagedChange,
        }}
      />
      <ProFormTextArea
        name="description"
        label="描述"
        placeholder="请输入描述"
        fieldProps={{
          rows: 4,
          maxLength: 500,
        }}
      />
      <ProFormSwitch
        name="isActive"
        label="是否启用"
      />
    </div>
  );
};

/**
 * 变体管理标签页
 */
interface VariantManagementTabProps {
  formRef: React.RefObject<ProFormInstance>;
}

const VariantManagementTab: React.FC<VariantManagementTabProps> = ({ formRef }) => {
  const { message: messageApi } = App.useApp();
  const [variantAttributes, setVariantAttributes] = useState<Record<string, any>>({});
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

  // 初始化时从表单获取变体属性
  useEffect(() => {
    const formValues = formRef.current?.getFieldsValue();
    if (formValues?.variantAttributes) {
      setVariantAttributes(formValues.variantAttributes);
    }
  }, []);

  const handleAttributeChange = (attributeName: string, value: any) => {
    const newAttributes = {
      ...variantAttributes,
      [attributeName]: value,
    };
    setVariantAttributes(newAttributes);
    formRef.current?.setFieldsValue({
      variantAttributes: newAttributes,
    });
  };

  // 渲染属性输入组件
  const renderAttributeInput = (def: VariantAttributeDefinition) => {
    const value = variantAttributes[def.attribute_name];
    
    switch (def.attribute_type) {
      case 'enum':
        return (
          <Select
            value={value}
            onChange={(val) => handleAttributeChange(def.attribute_name, val)}
            placeholder={`请选择${def.display_name}`}
            style={{ width: '100%' }}
            options={def.enum_values?.map(v => ({ label: v, value: v }))}
          />
        );
      
      case 'text':
        return (
          <Input
            value={value}
            onChange={(e) => handleAttributeChange(def.attribute_name, e.target.value)}
            placeholder={`请输入${def.display_name}`}
            maxLength={def.validation_rules?.max_length}
          />
        );
      
      case 'number':
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => handleAttributeChange(def.attribute_name, parseFloat(e.target.value) || 0)}
            placeholder={`请输入${def.display_name}`}
            min={def.validation_rules?.min}
            max={def.validation_rules?.max}
          />
        );
      
      case 'date':
        return (
          <Input
            type="date"
            value={value}
            onChange={(e) => handleAttributeChange(def.attribute_name, e.target.value)}
            placeholder={`请选择${def.display_name}`}
          />
        );
      
      case 'boolean':
        return (
          <Select
            value={value}
            onChange={(val) => handleAttributeChange(def.attribute_name, val)}
            placeholder={`请选择${def.display_name}`}
            style={{ width: '100%' }}
            options={[
              { label: '是', value: true },
              { label: '否', value: false },
            ]}
          />
        );
      
      default:
        return (
          <Input
            value={value}
            onChange={(e) => handleAttributeChange(def.attribute_name, e.target.value)}
            placeholder={`请输入${def.display_name}`}
          />
        );
    }
  };

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
    <div style={{ padding: '16px 0' }}>
      {variantAttributeDefinitions.map((def) => (
        <ProForm.Item
          key={def.attribute_name}
          name={['variantAttributes', def.attribute_name]}
          label={def.display_name}
          required={def.is_required}
          tooltip={def.description}
          rules={[
            {
              required: def.is_required,
              message: `请输入${def.display_name}`,
            },
            {
              validator: async (_, value) => {
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
        >
          {renderAttributeInput(def)}
        </ProForm.Item>
      ))}
      {Object.keys(variantAttributes).length > 0 && (
        <div style={{ marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>当前变体属性：</div>
          <pre style={{ margin: 0, fontSize: 12 }}>
            {JSON.stringify(variantAttributes, null, 2)}
          </pre>
        </div>
      )}
    </div>
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

  // 部门编码类型选项
  const departmentCodeTypes = [
    { label: '销售编码', value: 'SALE' },
    { label: '设计编码', value: 'DES' },
    { label: '采购编码', value: 'PUR' },
    { label: '仓库编码', value: 'WH' },
    { label: '生产编码', value: 'PROD' },
  ];

  // 添加部门编码
  const handleAddDepartmentCode = () => {
    deptForm.validateFields().then((values) => {
      onDepartmentCodesChange([...departmentCodes, values]);
      deptForm.resetFields();
    });
  };

  // 删除部门编码
  const handleDeleteDepartmentCode = (index: number) => {
    const newCodes = [...departmentCodes];
    newCodes.splice(index, 1);
    onDepartmentCodesChange(newCodes);
  };

  // 添加客户编码
  const handleAddCustomerCode = () => {
    customerForm.validateFields().then((values) => {
      const customer = customers.find(c => c.id === values.customerId);
      onCustomerCodesChange([
        ...customerCodes,
        {
          ...values,
          customerName: customer?.name,
          customerUuid: customer?.uuid,
        },
      ]);
      customerForm.resetFields();
    });
  };

  // 删除客户编码
  const handleDeleteCustomerCode = (index: number) => {
    const newCodes = [...customerCodes];
    newCodes.splice(index, 1);
    onCustomerCodesChange(newCodes);
  };

  // 添加供应商编码
  const handleAddSupplierCode = () => {
    supplierForm.validateFields().then((values) => {
      const supplier = suppliers.find(s => s.id === values.supplierId);
      onSupplierCodesChange([
        ...supplierCodes,
        {
          ...values,
          supplierName: supplier?.name,
          supplierUuid: supplier?.uuid,
        },
      ]);
      supplierForm.resetFields();
    });
  };

  // 删除供应商编码
  const handleDeleteSupplierCode = (index: number) => {
    const newCodes = [...supplierCodes];
    newCodes.splice(index, 1);
    onSupplierCodesChange(newCodes);
  };

  return (
    <div style={{ padding: '16px 0' }}>
      <Collapse defaultActiveKey={['department', 'customer', 'supplier']}>
        {/* 公司内部部门编码 */}
        <Panel header="公司内部部门编码" key="department">
          <Table
            dataSource={departmentCodes}
            columns={[
              { title: '编码类型', dataIndex: 'code_type', key: 'code_type' },
              { title: '编码', dataIndex: 'code', key: 'code' },
              { title: '部门', dataIndex: 'department', key: 'department' },
              { title: '描述', dataIndex: 'description', key: 'description' },
              {
                title: '操作',
                key: 'action',
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
          />
          <Form form={deptForm} layout="inline" style={{ marginTop: 16 }}>
            <Form.Item name="code_type" rules={[{ required: true, message: '请选择编码类型' }]}>
              <Select placeholder="编码类型" style={{ width: 120 }} options={departmentCodeTypes} />
            </Form.Item>
            <Form.Item name="code" rules={[{ required: true, message: '请输入编码' }]}>
              <Input placeholder="编码" style={{ width: 150 }} />
            </Form.Item>
            <Form.Item name="department">
              <Input placeholder="部门（可选）" style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="description">
              <Input placeholder="描述（可选）" style={{ width: 200 }} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddDepartmentCode}>
                添加
              </Button>
            </Form.Item>
          </Form>
        </Panel>

        {/* 客户物料编码 */}
        <Panel header="客户物料编码" key="customer">
          <Table
            dataSource={customerCodes}
            columns={[
              { title: '客户', dataIndex: 'customerName', key: 'customerName' },
              { title: '客户编码', dataIndex: 'code', key: 'code' },
              { title: '描述', dataIndex: 'description', key: 'description' },
              {
                title: '操作',
                key: 'action',
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
          />
          <Form form={customerForm} layout="inline" style={{ marginTop: 16 }}>
            <Form.Item name="customerId" rules={[{ required: true, message: '请选择客户' }]}>
              <Select
                placeholder="选择客户"
                style={{ width: 200 }}
                loading={customersLoading}
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={customers.map(c => ({ label: `${c.code} - ${c.name}`, value: c.id }))}
              />
            </Form.Item>
            <Form.Item name="code" rules={[{ required: true, message: '请输入客户编码' }]}>
              <Input placeholder="客户编码" style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="description">
              <Input placeholder="描述（可选）" style={{ width: 200 }} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddCustomerCode}>
                添加
              </Button>
            </Form.Item>
          </Form>
        </Panel>

        {/* 供应商物料编码 */}
        <Panel header="供应商物料编码" key="supplier">
          <Table
            dataSource={supplierCodes}
            columns={[
              { title: '供应商', dataIndex: 'supplierName', key: 'supplierName' },
              { title: '供应商编码', dataIndex: 'code', key: 'code' },
              { title: '描述', dataIndex: 'description', key: 'description' },
              {
                title: '操作',
                key: 'action',
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
          />
          <Form form={supplierForm} layout="inline" style={{ marginTop: 16 }}>
            <Form.Item name="supplierId" rules={[{ required: true, message: '请选择供应商' }]}>
              <Select
                placeholder="选择供应商"
                style={{ width: 200 }}
                loading={suppliersLoading}
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={suppliers.map(s => ({ label: `${s.code} - ${s.name}`, value: s.id }))}
              />
            </Form.Item>
            <Form.Item name="code" rules={[{ required: true, message: '请输入供应商编码' }]}>
              <Input placeholder="供应商编码" style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="description">
              <Input placeholder="描述（可选）" style={{ width: 200 }} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddSupplierCode}>
                添加
              </Button>
            </Form.Item>
          </Form>
        </Panel>
      </Collapse>
    </div>
  );
};

/**
 * 默认值设置标签页
 */
interface DefaultsTabProps {
  defaults: MaterialDefaults;
  suppliers: Supplier[];
  customers: Customer[];
  warehouses: Warehouse[];
  processRoutes: ProcessRoute[];
  suppliersLoading: boolean;
  customersLoading: boolean;
  warehousesLoading: boolean;
  processRoutesLoading: boolean;
  onDefaultsChange: (defaults: MaterialDefaults) => void;
}

const DefaultsTab: React.FC<DefaultsTabProps> = ({
  defaults,
  suppliers,
  customers,
  warehouses,
  processRoutes,
  suppliersLoading,
  customersLoading,
  warehousesLoading,
  processRoutesLoading,
  onDefaultsChange,
}) => {
  const updateDefaults = (key: keyof MaterialDefaults, value: any) => {
    onDefaultsChange({
      ...defaults,
      [key]: value,
    });
  };

  return (
    <div style={{ padding: '16px 0' }}>
      <Collapse defaultActiveKey={['finance', 'purchase', 'sale', 'inventory', 'production']}>
        {/* 财务默认值 */}
        <Panel header="财务默认值" key="finance">
          <ProFormDigit
            label="默认税率（%）"
            placeholder="请输入默认税率，如：13表示13%"
            min={0}
            max={100}
            fieldProps={{
              value: defaults.defaultTaxRate,
              onChange: (value) => updateDefaults('defaultTaxRate', value),
              style: { width: '100%' },
            }}
          />
          <ProFormText
            label="默认科目"
            placeholder="请输入默认科目"
            fieldProps={{
              value: defaults.defaultAccount,
              onChange: (e) => updateDefaults('defaultAccount', e.target.value),
            }}
          />
        </Panel>

        {/* 采购默认值 */}
        <Panel header="采购默认值" key="purchase">
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>默认供应商（可多选，按优先级排序）</div>
            <Select
              mode="multiple"
              placeholder="请选择默认供应商"
              style={{ width: '100%' }}
              loading={suppliersLoading}
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={suppliers.map(s => ({ label: `${s.code} - ${s.name}`, value: s.id }))}
              value={defaults.defaultSuppliers?.map(s => s.supplierId)}
              onChange={(values) => {
                const selectedSuppliers = values.map((id, index) => {
                  const supplier = suppliers.find(s => s.id === id);
                  return {
                    supplierId: id,
                    supplierUuid: supplier?.uuid,
                    supplierName: supplier?.name,
                    priority: index + 1,
                  };
                });
                updateDefaults('defaultSuppliers', selectedSuppliers);
              }}
            />
          </div>
          <ProFormDigit
            label="默认采购价格"
            placeholder="请输入默认采购价格"
            min={0}
            fieldProps={{
              value: defaults.defaultPurchasePrice,
              onChange: (value) => updateDefaults('defaultPurchasePrice', value),
              style: { width: '100%' },
            }}
          />
          <ProFormText
            label="默认采购单位"
            placeholder="请输入默认采购单位"
            fieldProps={{
              value: defaults.defaultPurchaseUnit,
              onChange: (e) => updateDefaults('defaultPurchaseUnit', e.target.value),
            }}
          />
          <ProFormDigit
            label="默认采购周期（天）"
            placeholder="请输入默认采购周期"
            min={0}
            fieldProps={{
              value: defaults.defaultPurchaseLeadTime,
              onChange: (value) => updateDefaults('defaultPurchaseLeadTime', value),
              style: { width: '100%' },
            }}
          />
        </Panel>

        {/* 销售默认值 */}
        <Panel header="销售默认值" key="sale">
          <ProFormDigit
            label="默认销售价格"
            placeholder="请输入默认销售价格"
            min={0}
            fieldProps={{
              value: defaults.defaultSalePrice,
              onChange: (value) => updateDefaults('defaultSalePrice', value),
              style: { width: '100%' },
            }}
          />
          <ProFormText
            label="默认销售单位"
            placeholder="请输入默认销售单位"
            fieldProps={{
              value: defaults.defaultSaleUnit,
              onChange: (e) => updateDefaults('defaultSaleUnit', e.target.value),
            }}
          />
          <div style={{ marginTop: 16 }}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>默认客户（可多选）</div>
            <Select
              mode="multiple"
              placeholder="请选择默认客户"
              style={{ width: '100%' }}
              loading={customersLoading}
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={customers.map(c => ({ label: `${c.code} - ${c.name}`, value: c.id }))}
              value={defaults.defaultCustomers?.map(c => c.customerId)}
              onChange={(values) => {
                const selectedCustomers = values.map((id) => {
                  const customer = customers.find(c => c.id === id);
                  return {
                    customerId: id,
                    customerUuid: customer?.uuid,
                    customerName: customer?.name,
                  };
                });
                updateDefaults('defaultCustomers', selectedCustomers);
              }}
            />
          </div>
        </Panel>

        {/* 库存默认值 */}
        <Panel header="库存默认值" key="inventory">
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>默认仓库（可多选，按优先级排序）</div>
            <Select
              mode="multiple"
              placeholder="请选择默认仓库"
              style={{ width: '100%' }}
              loading={warehousesLoading}
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={warehouses.map(w => ({ label: `${w.code} - ${w.name}`, value: w.id }))}
              value={defaults.defaultWarehouses?.map(w => w.warehouseId)}
              onChange={(values) => {
                const selectedWarehouses = values.map((id, index) => {
                  const warehouse = warehouses.find(w => w.id === id);
                  return {
                    warehouseId: id,
                    warehouseUuid: warehouse?.uuid,
                    warehouseName: warehouse?.name,
                    priority: index + 1,
                  };
                });
                updateDefaults('defaultWarehouses', selectedWarehouses);
              }}
            />
          </div>
          <ProFormText
            label="默认库位"
            placeholder="请输入默认库位"
            fieldProps={{
              value: defaults.defaultLocation,
              onChange: (e) => updateDefaults('defaultLocation', e.target.value),
            }}
          />
          <ProFormDigit
            label="安全库存"
            placeholder="请输入安全库存"
            min={0}
            fieldProps={{
              value: defaults.safetyStock,
              onChange: (value) => updateDefaults('safetyStock', value),
              style: { width: '100%' },
            }}
          />
          <ProFormDigit
            label="最大库存"
            placeholder="请输入最大库存"
            min={0}
            fieldProps={{
              value: defaults.maxStock,
              onChange: (value) => updateDefaults('maxStock', value),
              style: { width: '100%' },
            }}
          />
          <ProFormDigit
            label="最小库存"
            placeholder="请输入最小库存"
            min={0}
            fieldProps={{
              value: defaults.minStock,
              onChange: (value) => updateDefaults('minStock', value),
              style: { width: '100%' },
            }}
          />
        </Panel>

        {/* 生产默认值 */}
        <Panel header="生产默认值" key="production">
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>默认工艺路线</div>
            <Select
              placeholder="请选择默认工艺路线"
              style={{ width: '100%' }}
              loading={processRoutesLoading}
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={processRoutes.map(pr => ({ label: `${pr.code} - ${pr.name}`, value: pr.uuid }))}
              value={defaults.defaultProcessRouteUuid}
              onChange={(value) => {
                const route = processRoutes.find(pr => pr.uuid === value);
                updateDefaults('defaultProcessRoute', route?.id);
                updateDefaults('defaultProcessRouteUuid', value);
              }}
              allowClear
            />
          </div>
          <ProFormText
            label="默认生产单位"
            placeholder="请输入默认生产单位"
            fieldProps={{
              value: defaults.defaultProductionUnit,
              onChange: (e) => updateDefaults('defaultProductionUnit', e.target.value),
            }}
          />
        </Panel>
      </Collapse>
    </div>
  );
};

export default MaterialForm;
