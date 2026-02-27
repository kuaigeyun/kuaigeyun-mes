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
import { App } from 'antd';
import { ProForm, ProFormSelect, ProFormGroup } from '@ant-design/pro-components';
import { useNavigate } from 'react-router-dom';
import { WizardTemplate } from '../layout-templates/WizardTemplate';
import { getInitSteps, completeStep, completeInitWizard, type InitWizardData, type Step2DefaultSettings } from '../../services/init-wizard';
import { getTenantId } from '../../utils/auth';
import { getDataDictionaryByCode, getDictionaryItemList } from '../../services/dataDictionary';
import { getLanguageList } from '../../services/language';
import { useConfigStore } from '../../stores/configStore';
import { SettingOutlined, CheckCircleOutlined } from '@ant-design/icons';

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
  const [currencyOptions, setCurrencyOptions] = useState<{ label: string; value: string }[]>([]);
  const [timezoneOptions, setTimezoneOptions] = useState<{ label: string; value: string }[]>([]);
  const [languageOptions, setLanguageOptions] = useState<{ label: string; value: string }[]>([]);

  // 获取当前组织ID
  const currentTenantId = tenantId || getTenantId();

  // 加载初始化步骤配置与字典数据
  useEffect(() => {
    if (currentTenantId) {
      loadInitSteps();
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
    if (stepId === 'step2') {
      newData.step2_default_settings = data as Step2DefaultSettings;
    }
    setInitData(newData);
    if (currentTenantId) {
      sessionStorage.setItem(`init_wizard_data_${currentTenantId}`, JSON.stringify(newData));
    }
  };

  /**
   * 完成步骤（仅 step2 基础设置）
   */
  const handleStepComplete = async (stepId: string, data: any) => {
    if (!currentTenantId) return;

    try {
      setLoading(true);
      await completeStep(stepId, data);
      saveStepData(stepId, data);
      await loadInitSteps();
      messageApi.success('步骤完成');
      if (stepId === 'step2') setCurrentStep(1);
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
        {initData.step2_default_settings && (
          <div style={{ textAlign: 'left', maxWidth: 600, margin: '0 auto' }}>
            <h3>配置摘要：</h3>
            <div style={{ marginBottom: 16 }}>
              <strong>基础设置：</strong>
              <div>时区：{initData.step2_default_settings.timezone}</div>
              <div>默认货币：{initData.step2_default_settings.default_currency}</div>
              <div>默认语言：{initData.step2_default_settings.default_language}</div>
              <div>日期格式：{initData.step2_default_settings.date_format}</div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // 构建步骤列表（精简：仅基础设置 + 完成）
  const steps = [
    {
      title: '基础设置',
      description: '配置时区、货币、语言等核心设置',
      content: renderStep2(),
      icon: <SettingOutlined />,
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
      onSkip={onCancel}
      finishDisabled={loading}
    />
  );
};

export default InitWizard;

