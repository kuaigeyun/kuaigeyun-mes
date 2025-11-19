/**
 * 租户表单页面
 * 
 * 用于新增和编辑租户信息。
 * 注意：此页面通常需要超级管理员权限。
 */

import React, { useEffect, useState } from 'react';
import { ProForm, ProFormText, ProFormSelect, ProFormDigit, ProFormDateTimePicker } from '@ant-design/pro-components';
import { message } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  getTenantById,
  createTenant,
  updateTenant,
  Tenant,
  CreateTenantData,
  UpdateTenantData,
  TenantStatus,
  TenantPlan,
} from '@/services/tenant';

/**
 * 租户表单页面组件
 */
const TenantForm: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('id');
  const [loading, setLoading] = useState(false);
  const [initialValues, setInitialValues] = useState<Partial<Tenant>>({});

  /**
   * 加载租户数据（编辑模式）
   */
  useEffect(() => {
    if (tenantId) {
      setLoading(true);
      getTenantById(Number(tenantId))
        .then((tenant) => {
          setInitialValues(tenant);
        })
        .catch((error: any) => {
          message.error(error.message || '加载租户信息失败');
          navigate('/tenant/list');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [tenantId]);

  /**
   * 处理表单提交
   */
  const handleSubmit = async (values: any) => {
    try {
      if (tenantId) {
        // 更新租户
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
        // 创建租户
        const createData: CreateTenantData = {
          name: values.name,
          domain: values.domain,
          status: values.status || TenantStatus.INACTIVE,
          plan: values.plan || TenantPlan.BASIC,
          settings: values.settings || {},
          max_users: values.max_users || 10,
          max_storage: values.max_storage || 1024,
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
      loading={loading}
      initialValues={initialValues}
      onFinish={handleSubmit}
      submitter={{
        searchConfig: {
          submitText: tenantId ? '更新' : '创建',
        },
      }}
    >
      <ProFormText
        name="name"
        label="租户名称"
        placeholder="请输入租户名称"
        rules={[
          { required: true, message: '请输入租户名称' },
          { min: 1, max: 100, message: '租户名称长度为 1-100 字符' },
        ]}
      />
      <ProFormText
        name="domain"
        label="租户域名"
        placeholder="请输入租户域名（用于子域名访问）"
        rules={[
          { required: true, message: '请输入租户域名' },
          { min: 1, max: 100, message: '租户域名长度为 1-100 字符' },
          { pattern: /^[a-z0-9-]+$/, message: '域名只能包含小写字母、数字和连字符' },
        ]}
        disabled={!!tenantId} // 编辑模式下不允许修改域名
      />
      <ProFormSelect
        name="status"
        label="租户状态"
        placeholder="请选择租户状态"
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
        label="租户套餐"
        placeholder="请选择租户套餐"
        options={[
          { label: '基础版', value: TenantPlan.BASIC },
          { label: '专业版', value: TenantPlan.PROFESSIONAL },
          { label: '企业版', value: TenantPlan.ENTERPRISE },
        ]}
        initialValue={TenantPlan.BASIC}
      />
      <ProFormDigit
        name="max_users"
        label="最大用户数"
        placeholder="请输入最大用户数"
        min={1}
        initialValue={10}
        rules={[{ required: true, message: '请输入最大用户数' }]}
      />
      <ProFormDigit
        name="max_storage"
        label="最大存储空间（MB）"
        placeholder="请输入最大存储空间（MB）"
        min={0}
        initialValue={1024}
        rules={[{ required: true, message: '请输入最大存储空间' }]}
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

