/**
 * 初始化向导组件
 *
 * 提供组织快速初始化向导功能，3-5步完成基础配置
 *
 * Author: Luigi Lu
 * Date: 2025-01-15
 */

import React, { useState, useEffect } from 'react';
import { App, message } from 'antd';
import { ProForm, ProFormText, ProFormSelect, ProFormGroup } from '@ant-design/pro-components';
import { useNavigate } from 'react-router-dom';
import { WizardTemplate } from '../layout-templates/WizardTemplate';
import { getInitSteps, completeStep, completeInitWizard, type InitWizardData, type Step1OrganizationInfo, type Step2DefaultSettings, type Step3AdminInfo, type Step4Template } from '../../services/init-wizard';
import { getTenantId } from '../../utils/auth';
import { getIndustryTemplateList, type IndustryTemplate } from '../../services/industryTemplate';
import { ApartmentOutlined, SettingOutlined, UserOutlined, FileTextOutlined, CheckCircleOutlined } from '@ant-design/icons';

/**
 * 初始化向导组件属性
 */
export interface InitWizardProps {
  /** 组织ID */
  tenantId?: number;
  /** 完成回调 */
  onComplete?: () => void;
  /** 取消回调 */
  onCancel?: () => void;
}

/**
 * 初始化向导组件
 */
const InitWizard: React.FC<InitWizardProps> = ({ tenantId, onComplete, onCancel }) => {
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initData, setInitData] = useState<InitWizardData>({});
  const [stepConfigs, setStepConfigs] = useState<any[]>([]);
  const [templates, setTemplates] = useState<IndustryTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  // 获取当前组织ID
  const currentTenantId = tenantId || getTenantId();

  // 加载初始化步骤配置
  useEffect(() => {
    if (currentTenantId) {
      loadInitSteps();
      loadTemplates();
      // 从sessionStorage恢复进度
      const savedData = sessionStorage.getItem(`init_wizard_data_${currentTenantId}`);
      if (savedData) {
        try {
          setInitData(JSON.parse(savedData));
        } catch (e) {
          console.error('恢复初始化数据失败:', e);
        }
      }
    }
  }, [currentTenantId]);

  /**
   * 加载行业模板列表
   */
  const loadTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const response = await getIndustryTemplateList(undefined, true);
      setTemplates(response.items || []);
    } catch (error: any) {
      console.error('加载模板列表失败:', error);
      // 不显示错误消息，因为这是可选步骤
    } finally {
      setTemplatesLoading(false);
    }
  };

  /**
   * 加载初始化步骤配置
   */
  const loadInitSteps = async () => {
    if (!currentTenantId) return;

    try {
      const response = await getInitSteps(currentTenantId);
      setStepConfigs(response.steps);
      
      // 如果有当前步骤，设置当前步骤
      if (response.current_step) {
        const stepIndex = response.steps.findIndex(s => s.step_id === response.current_step);
        if (stepIndex >= 0) {
          setCurrentStep(stepIndex);
        }
      }
    } catch (error: any) {
      console.error('加载初始化步骤失败:', error);
      messageApi.error(error?.message || '加载初始化步骤失败');
    }
  };

  /**
   * 保存步骤数据到sessionStorage
   */
  const saveStepData = (stepId: string, data: any) => {
    const newData = { ...initData };
    
    if (stepId === 'step1') {
      newData.step1_organization_info = data as Step1OrganizationInfo;
    } else if (stepId === 'step2') {
      newData.step2_default_settings = data as Step2DefaultSettings;
    } else if (stepId === 'step3') {
      newData.step3_admin_info = data as Step3AdminInfo;
    } else if (stepId === 'step4') {
      newData.step4_template = data as Step4Template;
    }
    
    setInitData(newData);
    if (currentTenantId) {
      sessionStorage.setItem(`init_wizard_data_${currentTenantId}`, JSON.stringify(newData));
    }
  };

  /**
   * 完成步骤
   */
  const handleStepComplete = async (stepId: string, data: any) => {
    if (!currentTenantId) return;

    try {
      setLoading(true);
      await completeStep(stepId, data);
      saveStepData(stepId, data);
      messageApi.success('步骤完成');
    } catch (error: any) {
      console.error('完成步骤失败:', error);
      messageApi.error(error?.message || '完成步骤失败');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  /**
   * 完成初始化向导
   */
  const handleFinish = async () => {
    if (!currentTenantId) return;

    try {
      setLoading(true);
      await completeInitWizard(currentTenantId, initData);
      messageApi.success('初始化完成');
      
      // 清除sessionStorage
      sessionStorage.removeItem(`init_wizard_data_${currentTenantId}`);
      
      // 调用完成回调
      if (onComplete) {
        onComplete();
      } else {
        // 默认跳转到工作台
        navigate('/dashboard');
      }
    } catch (error: any) {
      console.error('完成初始化失败:', error);
      messageApi.error(error?.message || '完成初始化失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 步骤1：组织信息完善
   */
  const renderStep1 = () => {
    const stepConfig = stepConfigs.find(s => s.step_id === 'step1');
    const stepData = initData.step1_organization_info || {};

    return (
      <div>
        <ProForm
          submitter={false}
          initialValues={stepData}
          onFinish={async (values) => {
            await handleStepComplete('step1', values);
            setCurrentStep(1);
          }}
        >
          <ProFormGroup title="组织信息">
            <ProFormText
              name="organization_code"
              label="组织代码"
              placeholder="请输入组织代码（可选）"
              extra="组织代码用于标识组织，留空则使用系统生成的代码"
            />
            <ProFormSelect
              name="industry"
              label="行业"
              placeholder="请选择行业（可选）"
              options={[
                { label: '制造业', value: 'manufacturing' },
                { label: '零售业', value: 'retail' },
                { label: '服务业', value: 'service' },
                { label: '金融业', value: 'finance' },
                { label: '教育', value: 'education' },
                { label: '医疗', value: 'healthcare' },
                { label: '其他', value: 'other' },
              ]}
            />
            <ProFormSelect
              name="scale"
              label="规模"
              placeholder="请选择组织规模（可选）"
              options={[
                { label: '小型（<50人）', value: 'small' },
                { label: '中型（50-500人）', value: 'medium' },
                { label: '大型（>500人）', value: 'large' },
              ]}
            />
          </ProFormGroup>
        </ProForm>
      </div>
    );
  };

  /**
   * 步骤2：默认设置
   */
  const renderStep2 = () => {
    const stepData = initData.step2_default_settings || {
      timezone: 'Asia/Shanghai',
      currency: 'CNY',
      language: 'zh-CN',
    };

    return (
      <div>
        <ProForm
          submitter={false}
          initialValues={stepData}
          onFinish={async (values) => {
            await handleStepComplete('step2', values);
            setCurrentStep(2);
          }}
        >
          <ProFormGroup title="默认设置">
            <ProFormSelect
              name="timezone"
              label="时区"
              rules={[{ required: true, message: '请选择时区' }]}
              options={[
                { label: '东八区 (UTC+8)', value: 'Asia/Shanghai' },
                { label: '东京 (UTC+9)', value: 'Asia/Tokyo' },
                { label: '首尔 (UTC+9)', value: 'Asia/Seoul' },
                { label: '纽约 (UTC-5)', value: 'America/New_York' },
                { label: '伦敦 (UTC+0)', value: 'Europe/London' },
                { label: '巴黎 (UTC+1)', value: 'Europe/Paris' },
              ]}
            />
            <ProFormSelect
              name="currency"
              label="货币"
              rules={[{ required: true, message: '请选择货币' }]}
              options={[
                { label: '人民币 (CNY)', value: 'CNY' },
                { label: '美元 (USD)', value: 'USD' },
                { label: '欧元 (EUR)', value: 'EUR' },
                { label: '日元 (JPY)', value: 'JPY' },
                { label: '英镑 (GBP)', value: 'GBP' },
              ]}
            />
            <ProFormSelect
              name="language"
              label="语言"
              rules={[{ required: true, message: '请选择语言' }]}
              options={[
                { label: '简体中文 (zh-CN)', value: 'zh-CN' },
                { label: '繁体中文 (zh-TW)', value: 'zh-TW' },
                { label: 'English (en-US)', value: 'en-US' },
                { label: '日本語 (ja-JP)', value: 'ja-JP' },
                { label: '한국어 (ko-KR)', value: 'ko-KR' },
              ]}
            />
          </ProFormGroup>
        </ProForm>
      </div>
    );
  };

  /**
   * 步骤3：管理员信息
   */
  const renderStep3 = () => {
    const stepData = initData.step3_admin_info || {};

    return (
      <div>
        <ProForm
          submitter={false}
          initialValues={stepData}
          onFinish={async (values) => {
            await handleStepComplete('step3', values);
            setCurrentStep(3);
          }}
        >
          <ProFormGroup title="管理员信息">
            <ProFormText
              name="full_name"
              label="姓名"
              placeholder="请输入管理员姓名（可选）"
            />
            <ProFormText
              name="email"
              label="邮箱"
              placeholder="请输入管理员邮箱（可选）"
              rules={[
                { type: 'email', message: '请输入有效的邮箱地址' },
              ]}
            />
          </ProFormGroup>
        </ProForm>
      </div>
    );
  };

  /**
   * 步骤4：选择行业模板（可选）
   */
  const renderStep4 = () => {
    const stepData = initData.step4_template || {};

    return (
      <div>
        <ProForm
          submitter={false}
          initialValues={stepData}
          onFinish={async (values) => {
            await handleStepComplete('step4', values);
            setCurrentStep(4);
          }}
        >
          <ProFormGroup title="选择行业模板（可选）">
            <ProFormSelect
              name="template_id"
              label="行业模板"
              placeholder={templatesLoading ? '加载中...' : '请选择行业模板（可选，可跳过）'}
              loading={templatesLoading}
              options={[
                { label: '不选择模板（跳过）', value: undefined },
                ...templates.map((template) => ({
                  label: `${template.name}${template.is_default ? '（推荐）' : ''}`,
                  value: template.id,
                })),
              ]}
              extra="选择行业模板可以快速配置系统，包括编码规则、系统参数等，也可以稍后手动配置"
            />
          </ProFormGroup>
        </ProForm>
      </div>
    );
  };

  /**
   * 步骤5：完成确认
   */
  const renderStep5 = () => {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a', marginBottom: 24 }} />
        <h2>初始化配置完成</h2>
        <p style={{ color: '#666', marginTop: 16, marginBottom: 32 }}>
          请确认所有信息无误，点击"完成"按钮完成初始化
        </p>
        <div style={{ textAlign: 'left', maxWidth: 600, margin: '0 auto' }}>
          <h3>配置摘要：</h3>
          {initData.step1_organization_info && (
            <div style={{ marginBottom: 16 }}>
              <strong>组织信息：</strong>
              {initData.step1_organization_info.organization_code && (
                <div>组织代码：{initData.step1_organization_info.organization_code}</div>
              )}
              {initData.step1_organization_info.industry && (
                <div>行业：{initData.step1_organization_info.industry}</div>
              )}
              {initData.step1_organization_info.scale && (
                <div>规模：{initData.step1_organization_info.scale}</div>
              )}
            </div>
          )}
          {initData.step2_default_settings && (
            <div style={{ marginBottom: 16 }}>
              <strong>默认设置：</strong>
              <div>时区：{initData.step2_default_settings.timezone}</div>
              <div>货币：{initData.step2_default_settings.currency}</div>
              <div>语言：{initData.step2_default_settings.language}</div>
            </div>
          )}
          {initData.step3_admin_info && (
            <div style={{ marginBottom: 16 }}>
              <strong>管理员信息：</strong>
              {initData.step3_admin_info.full_name && (
                <div>姓名：{initData.step3_admin_info.full_name}</div>
              )}
              {initData.step3_admin_info.email && (
                <div>邮箱：{initData.step3_admin_info.email}</div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // 构建步骤列表
  const steps = [
    {
      title: '组织信息完善',
      description: '补充组织基本信息',
      content: renderStep1(),
      icon: <ApartmentOutlined />,
    },
    {
      title: '默认设置',
      description: '配置时区、货币、语言等默认设置',
      content: renderStep2(),
      icon: <SettingOutlined />,
    },
    {
      title: '管理员信息',
      description: '完善管理员个人信息',
      content: renderStep3(),
      optional: true,
      icon: <UserOutlined />,
    },
    {
      title: '选择行业模板',
      description: '选择适合的行业模板快速配置（可选）',
      content: renderStep4(),
      optional: true,
      icon: <FileTextOutlined />,
    },
    {
      title: '完成',
      description: '确认并完成初始化',
      content: renderStep5(),
      icon: <CheckCircleOutlined />,
    },
  ];

  if (!currentTenantId) {
    return <div>无法获取组织ID，请先登录</div>;
  }

  return (
    <WizardTemplate
      steps={steps}
      current={currentStep}
      onStepChange={setCurrentStep}
      onFinish={handleFinish}
      finishDisabled={loading}
    />
  );
};

export default InitWizard;

