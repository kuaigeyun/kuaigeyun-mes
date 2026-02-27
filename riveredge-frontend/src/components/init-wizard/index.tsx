/**
 * 初始化向导组件
 *
 * 提供组织快速初始化向导功能，3-5步完成基础配置
 *
 * Author: Luigi Lu
 * Date: 2025-01-15
 */

import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { App, message } from 'antd';
import { ProForm, ProFormText, ProFormSelect, ProFormGroup } from '@ant-design/pro-components';
import { useNavigate } from 'react-router-dom';
import { WizardTemplate } from '../layout-templates/WizardTemplate';
import { getInitSteps, completeStep, completeInitWizard, type InitWizardData, type Step1OrganizationInfo, type Step2DefaultSettings, type Step2_5CodeRules, type Step3AdminInfo, type Step4Template } from '../../services/init-wizard';
import { getTenantId } from '../../utils/auth';
import { getIndustryTemplateList, type IndustryTemplate } from '../../services/industryTemplate';
import { getDataDictionaryByCode, getDictionaryItemList } from '../../services/dataDictionary';
import { getLanguageList } from '../../services/language';
import { useConfigStore } from '../../stores/configStore';
import { ApartmentOutlined, SettingOutlined, UserOutlined, FileTextOutlined, CheckCircleOutlined, KeyOutlined } from '@ant-design/icons';
import AISuggestions from '../ai-suggestions';

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
  const queryClient = useQueryClient();
  const fetchConfigs = useConfigStore((s) => s.fetchConfigs);

  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initData, setInitData] = useState<InitWizardData>({});
  const [stepConfigs, setStepConfigs] = useState<any[]>([]);
  const [progress, setProgress] = useState(0);
  const [templates, setTemplates] = useState<IndustryTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [currencyOptions, setCurrencyOptions] = useState<{ label: string; value: string }[]>([]);
  const [timezoneOptions, setTimezoneOptions] = useState<{ label: string; value: string }[]>([]);
  const [languageOptions, setLanguageOptions] = useState<{ label: string; value: string }[]>([]);

  // 获取当前组织ID
  const currentTenantId = tenantId || getTenantId();

  // 加载初始化步骤配置与字典数据
  useEffect(() => {
    if (currentTenantId) {
      loadInitSteps();
      loadTemplates();
      loadStep2Options();
      // 从sessionStorage恢复进度
      const savedData = sessionStorage.getItem(`init_wizard_data_${currentTenantId}`);
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          // 兼容旧格式：currency -> default_currency, language -> default_language
          if (parsed.step2_default_settings) {
            const s2 = parsed.step2_default_settings;
            if (s2.currency !== undefined && s2.default_currency === undefined) {
              s2.default_currency = s2.currency;
            }
            if (s2.language !== undefined && s2.default_language === undefined) {
              s2.default_language = s2.language;
            }
            if (!s2.date_format) s2.date_format = 'YYYY-MM-DD';
          }
          setInitData(parsed);
        } catch (e) {
          console.error('恢复初始化数据失败:', e);
        }
      }
    }
  }, [currentTenantId]);

  /**
   * 加载步骤2选项（货币、时区、语言，与站点设置一致）
   */
  const loadStep2Options = async () => {
    try {
      const [langRes, currencyDict, timezoneDict] = await Promise.all([
        getLanguageList({ is_active: true }).catch(() => ({ items: [] })),
        getDataDictionaryByCode('CURRENCY').catch(() => null),
        getDataDictionaryByCode('TIMEZONE').catch(() => null),
      ]);
      if (langRes?.items) {
        setLanguageOptions(langRes.items.map((l: any) => ({ label: l.native_name || l.name, value: l.code })));
      }
      if (currencyDict?.uuid) {
        const items = await getDictionaryItemList(currencyDict.uuid, true);
        setCurrencyOptions(items.map((i: any) => ({ label: i.label, value: i.value })));
      }
      if (timezoneDict?.uuid) {
        const items = await getDictionaryItemList(timezoneDict.uuid, true);
        setTimezoneOptions(items.map((i: any) => ({ label: i.label, value: i.value })));
      }
    } catch (e) {
      console.warn('加载步骤2选项失败', e);
    }
  };

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
      setProgress(response.progress ?? 0);

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
    } else if (stepId === 'step2_5') {
      newData.step2_5_code_rules = data as Step2_5CodeRules;
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
      const res = await getInitSteps(currentTenantId);
      setProgress(res.progress ?? 0);
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

      // 清除 initSteps 缓存，使工作台等页面的初始化提示条立即消失
      queryClient.invalidateQueries({ queryKey: ['initSteps', currentTenantId] });
      // 刷新站点配置，使默认货币、日期格式等立即生效
      await fetchConfigs();

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

  /** 步骤2 默认选项（字典为空时使用，与站点设置一致） */
  const defaultCurrencyOptions = [
    { label: '人民币 (CNY)', value: 'CNY' },
    { label: '美元 (USD)', value: 'USD' },
    { label: '欧元 (EUR)', value: 'EUR' },
    { label: '日元 (JPY)', value: 'JPY' },
    { label: '英镑 (GBP)', value: 'GBP' },
  ];
  const defaultTimezoneOptions = [
    { label: '东八区 (UTC+8)', value: 'Asia/Shanghai' },
    { label: '东京 (UTC+9)', value: 'Asia/Tokyo' },
    { label: '首尔 (UTC+9)', value: 'Asia/Seoul' },
    { label: '纽约 (UTC-5)', value: 'America/New_York' },
    { label: '伦敦 (UTC+0)', value: 'Europe/London' },
    { label: '巴黎 (UTC+1)', value: 'Europe/Paris' },
  ];
  const defaultLanguageOptions = [
    { label: '简体中文 (zh-CN)', value: 'zh-CN' },
    { label: '繁体中文 (zh-TW)', value: 'zh-TW' },
    { label: 'English (en-US)', value: 'en-US' },
    { label: '日本語 (ja-JP)', value: 'ja-JP' },
    { label: '한국어 (ko-KR)', value: 'ko-KR' },
  ];
  const dateFormatOptions = [
    { label: 'YYYY-MM-DD', value: 'YYYY-MM-DD' },
    { label: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
    { label: 'MM/DD/YYYY', value: 'MM/DD/YYYY' },
    { label: 'YYYY年MM月DD日', value: 'YYYY年MM月DD日' },
  ];

  /**
   * 步骤2：默认设置（与站点设置格式一致）
   */
  const renderStep2 = () => {
    const stepData = initData.step2_default_settings || {
      timezone: 'Asia/Shanghai',
      default_currency: 'CNY',
      default_language: 'zh-CN',
      date_format: 'YYYY-MM-DD',
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
              options={timezoneOptions.length > 0 ? timezoneOptions : defaultTimezoneOptions}
            />
            <ProFormSelect
              name="default_currency"
              label="默认货币"
              rules={[{ required: true, message: '请选择默认货币' }]}
              options={currencyOptions.length > 0 ? currencyOptions : defaultCurrencyOptions}
            />
            <ProFormSelect
              name="default_language"
              label="默认语言"
              rules={[{ required: true, message: '请选择默认语言' }]}
              options={languageOptions.length > 0 ? languageOptions : defaultLanguageOptions}
            />
            <ProFormSelect
              name="date_format"
              label="日期格式"
              rules={[{ required: true, message: '请选择日期格式' }]}
              options={dateFormatOptions}
            />
          </ProFormGroup>
        </ProForm>
      </div>
    );
  };

  /**
   * 步骤2.5：编码规则配置（可选）
   */
  const renderStep2_5 = () => {
    const stepData = initData.step2_5_code_rules || {
      use_default_rules: true,
    };

    return (
      <div>
        <ProForm
          submitter={false}
          initialValues={stepData}
          onFinish={async (values) => {
            await handleStepComplete('step2_5', values);
            setCurrentStep(3);
          }}
        >
          <ProFormGroup title="编码规则配置（可选）">
            <ProFormSelect
              name="use_default_rules"
              label="编码规则"
              rules={[{ required: true, message: '请选择编码规则' }]}
              options={[
                { label: '使用默认编码规则（推荐）', value: true },
                { label: '稍后手动配置', value: false },
              ]}
              extra="默认编码规则适用于大多数场景，包括采购订单、销售订单、工单、入库单、出库单等。您也可以稍后在系统设置中自定义编码规则。"
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
              <div>默认货币：{initData.step2_default_settings.default_currency}</div>
              <div>默认语言：{initData.step2_default_settings.default_language}</div>
              <div>日期格式：{initData.step2_default_settings.date_format}</div>
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
      title: '编码规则配置',
      description: '配置各种单据的编码规则（可选）',
      content: renderStep2_5(),
      optional: true,
      icon: <KeyOutlined />,
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
    <>
      {progress > 0 && progress < 100 && (
        <div style={{ marginBottom: 16, padding: '8px 16px', background: '#f6ffed', borderRadius: 4, border: '1px solid #b7eb8f' }}>
          <span style={{ marginRight: 8 }}>完成进度：</span>
          <span style={{ fontWeight: 500 }}>{Math.round(progress)}%</span>
        </div>
      )}
      <WizardTemplate
        steps={steps}
        current={currentStep}
        onStepChange={setCurrentStep}
        onFinish={handleFinish}
        onSkip={onCancel}
        finishDisabled={loading}
      />
      {/* AI智能建议 - 侧边栏显示，不打断操作流程 */}
      <AISuggestions
        scene="init"
        context={{
          currentStep: currentStep,
          stepConfigs: stepConfigs,
          initData: initData,
        }}
        displayMode="float"
        onActionClick={(action) => {
          // 处理建议操作点击
          if (action.startsWith('/')) {
            // 如果是路径，可以导航到对应页面
            console.log('导航到:', action);
          }
        }}
      />
    </>
  );
};

export default InitWizard;

