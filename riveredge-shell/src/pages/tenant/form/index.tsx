/**
 * 组织表单页面
 * 
 * 用于新增和编辑组织信息。
 * 注意：此页面通常需要超级管理员权限。
 */

import React, { useEffect, useState, useRef } from 'react';
import { ProForm, ProFormText, ProFormSelect, ProFormDigit, ProFormDateTimePicker, ProFormInstance } from '@ant-design/pro-components';
import { message } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  getTenantById,
  createTenant,
  updateTenant,
  getPackageConfig,
  Tenant,
  CreateTenantData,
  UpdateTenantData,
  TenantStatus,
  TenantPlan,
  PackageConfig,
} from '@/services/tenant';

/**
 * 组织表单页面组件
 */
const TenantForm: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('id');
  const [loading, setLoading] = useState(false);
  const [initialValues, setInitialValues] = useState<Partial<Tenant>>({});
  const [packageConfigs, setPackageConfigs] = useState<Record<string, PackageConfig>>({});
  const [selectedPlan, setSelectedPlan] = useState<TenantPlan>(TenantPlan.TRIAL);
  const formRef = useRef<ProFormInstance>();

  /**
   * 加载套餐配置
   */
  useEffect(() => {
    // 加载所有套餐配置（用于显示套餐信息）
    import('@/services/tenant').then(({ getPackageConfigs }) => {
      getPackageConfigs()
        .then((configs) => {
          setPackageConfigs(configs);
        })
        .catch((error: any) => {
          console.error('加载套餐配置失败:', error);
        });
    });
  }, []);

  /**
   * 加载组织数据（编辑模式）
   */
  useEffect(() => {
    if (tenantId) {
      setLoading(true);
      getTenantById(Number(tenantId))
        .then((tenant) => {
          setInitialValues(tenant);
          setSelectedPlan(tenant.plan);
        })
        .catch((error: any) => {
          message.error(error.message || '加载组织信息失败');
          navigate('/tenant/list');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [tenantId]);

  /**
   * 处理套餐选择变化
   * 根据选择的套餐自动设置 max_users 和 max_storage
   */
  const handlePlanChange = async (plan: TenantPlan) => {
    setSelectedPlan(plan);
    try {
      const config = await getPackageConfig(plan);
      // 自动设置 max_users 和 max_storage
      formRef.current?.setFieldsValue({
        max_users: config.max_users,
        max_storage: config.max_storage_mb,
      });
    } catch (error: any) {
      console.error('获取套餐配置失败:', error);
    }
  };

  /**
   * 处理表单提交
   */
  const handleSubmit = async (values: any) => {
    try {
      if (tenantId) {
        // 更新组织
        const updateData: UpdateTenantData = {
          name: values.name,
          domain: values.domain,
          status: values.status,
          plan: values.plan,
          settings: values.settings || {},
          max_users: values.max_users,
          max_storage: values.max_storage,
          expires_at: values.expires_at,
        };
        await updateTenant(Number(tenantId), updateData);
        message.success('更新成功');
      } else {
        // 创建组织（不指定 max_users 和 max_storage，由后端根据套餐自动设置）
        const createData: CreateTenantData = {
          name: values.name,
          domain: values.domain,
          status: values.status || TenantStatus.INACTIVE,
          plan: values.plan || TenantPlan.TRIAL,
          settings: values.settings || {},
          // max_users 和 max_storage 不指定，由后端根据套餐自动设置
          expires_at: values.expires_at,
        };
        await createTenant(createData);
        message.success('创建成功');
      }
      navigate('/tenant/list');
    } catch (error: any) {
      message.error(error.message || '操作失败');
    }
  };

  return (
    <ProForm
      formRef={formRef}
      loading={loading}
      initialValues={{
        ...initialValues,
        plan: initialValues.plan || TenantPlan.TRIAL,
      }}
      onFinish={handleSubmit}
      submitter={{
        searchConfig: {
          submitText: tenantId ? '更新' : '创建',
        },
      }}
    >
      <ProFormText
        name="name"
        label="组织名称"
        placeholder="请输入组织名称"
        rules={[
          { required: true, message: '请输入组织名称' },
          { min: 1, max: 100, message: '组织名称长度为 1-100 字符' },
        ]}
      />
      <ProFormText
        name="domain"
        label="组织域名"
        placeholder="请输入组织域名（用于子域名访问）"
        rules={[
          { required: true, message: '请输入组织域名' },
          { min: 1, max: 100, message: '组织域名长度为 1-100 字符' },
          { pattern: /^[a-z0-9-]+$/, message: '域名只能包含小写字母、数字和连字符' },
        ]}
        disabled={!!tenantId} // 编辑模式下不允许修改域名
      />
      <ProFormSelect
        name="status"
        label="组织状态"
        placeholder="请选择组织状态"
        options={[
          { label: '激活', value: TenantStatus.ACTIVE },
          { label: '未激活', value: TenantStatus.INACTIVE },
          { label: '已过期', value: TenantStatus.EXPIRED },
          { label: '已暂停', value: TenantStatus.SUSPENDED },
        ]}
        initialValue={TenantStatus.INACTIVE}
      />
      <ProFormSelect
        name="plan"
        label="组织套餐"
        placeholder="请选择组织套餐"
        options={[
          { label: '体验套餐', value: TenantPlan.TRIAL },
          { label: '基础版', value: TenantPlan.BASIC },
          { label: '专业版', value: TenantPlan.PROFESSIONAL },
          { label: '企业版', value: TenantPlan.ENTERPRISE },
        ]}
        initialValue={TenantPlan.TRIAL}
        fieldProps={{
          onChange: (value: TenantPlan) => {
            handlePlanChange(value);
          },
        }}
        extra={
          selectedPlan && packageConfigs[selectedPlan]
            ? `套餐说明：${packageConfigs[selectedPlan].description}`
            : undefined
        }
      />
      <ProFormDigit
        name="max_users"
        label="最大用户数"
        placeholder="将根据套餐自动设置"
        min={1}
        initialValue={packageConfigs[selectedPlan]?.max_users || 10}
        rules={[{ required: true, message: '请输入最大用户数' }]}
        extra="选择套餐后将自动设置，也可手动调整"
      />
      <ProFormDigit
        name="max_storage"
        label="最大存储空间（MB）"
        placeholder="将根据套餐自动设置"
        min={0}
        initialValue={packageConfigs[selectedPlan]?.max_storage_mb || 1024}
        rules={[{ required: true, message: '请输入最大存储空间' }]}
        extra="选择套餐后将自动设置，也可手动调整"
      />
      <ProFormDateTimePicker
        name="expires_at"
        label="过期时间（可选）"
        placeholder="请选择过期时间（留空则永不过期）"
      />
    </ProForm>
  );
};

export default TenantForm;

