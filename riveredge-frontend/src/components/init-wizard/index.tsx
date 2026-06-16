/**
 * 初始化向导组件
 *
 * 提供组织快速初始化向导功能，3-5步完成基础配置
 *
 * Author: Luigi Lu
 * Date: 2025-01-15
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { ProForm, ProFormSelect, ProFormGroup } from '@ant-design/pro-components';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { WizardTemplate } from '../layout-templates/WizardTemplate';
import { getInitSteps, completeStep, completeInitWizard, type InitWizardData, type Step2DefaultSettings } from '../../services/init-wizard';
import { getTenantId } from '../../utils/auth';
import { getDataDictionaryByCode, getDictionaryItemList } from '../../services/dataDictionary';
import { getLanguageList } from '../../services/language';
import { useConfigStore } from '../../stores/configStore';
import { getSiteSettingsDictCache, setSiteSettingsDictCache } from '../../utils/siteSettingsDictCache';
import {
  buildFallbackCurrencyOptions,
  buildFallbackTimezoneOptions,
  mapCurrencyDictionaryOptions,
  mapTimezoneDictionaryOptions,
} from '../../utils/systemDictionaryLabels';
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
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchConfigs = useConfigStore((s) => s.fetchConfigs);

  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initData, setInitData] = useState<InitWizardData>({});
  const [stepConfigs, setStepConfigs] = useState<any[]>([]);
  const [currencyOptions, setCurrencyOptions] = useState<{ label: string; value: string }[]>(() => {
    const c = getSiteSettingsDictCache()?.currency;
    return c?.map((i) => ({ label: i.label, value: i.value })) ?? [];
  });
  const [timezoneOptions, setTimezoneOptions] = useState<{ label: string; value: string }[]>(() => {
    const c = getSiteSettingsDictCache()?.timezone;
    return c?.map((i) => ({ label: i.label, value: i.value })) ?? [];
  });
  const [languageOptions, setLanguageOptions] = useState<{ label: string; value: string }[]>(() => {
    const c = getSiteSettingsDictCache()?.language;
    return c?.map((i) => ({ label: i.label, value: i.value })) ?? [];
  });

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
        const opts = langRes.items.map((l: any) => ({ label: l.native_name || l.name, value: l.code }));
        setLanguageOptions(opts);
        setSiteSettingsDictCache({ language: opts.map((o) => ({ ...o, key: o.value })) });
      }
      if (currencyDict?.uuid) {
        const items = await getDictionaryItemList(currencyDict.uuid, true);
        const opts = items.map((i: any) => ({ label: i.label, value: i.value }));
        setCurrencyOptions(opts);
        setSiteSettingsDictCache({ currency: items });
      }
      if (timezoneDict?.uuid) {
        const items = await getDictionaryItemList(timezoneDict.uuid, true);
        const opts = items.map((i: any) => ({ label: i.label, value: i.value }));
        setTimezoneOptions(opts);
        setSiteSettingsDictCache({ timezone: items });
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
      messageApi.error(error?.message || t('pages.init.wizard.loadStepsFailed'));
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
      messageApi.success(t('pages.init.wizard.stepComplete'));
      if (stepId === 'step2') setCurrentStep(1);
    } catch (error: any) {
      console.error('完成步骤失败:', error);
      messageApi.error(error?.message || t('pages.init.wizard.stepCompleteFailed'));
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
      messageApi.success(t('pages.init.wizard.initComplete'));

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
      messageApi.error(error?.message || t('pages.init.wizard.initFailed'));
    } finally {
      setLoading(false);
    }
  };

  /** 步骤2 默认选项（字典为空时使用，与站点设置一致） */
  const defaultCurrencyOptions = useMemo(() => buildFallbackCurrencyOptions(t), [t]);
  const defaultTimezoneOptions = useMemo(() => buildFallbackTimezoneOptions(t), [t]);
  const localizedCurrencyOptions = useMemo(
    () => (currencyOptions.length > 0 ? mapCurrencyDictionaryOptions(currencyOptions, t) : defaultCurrencyOptions),
    [currencyOptions, defaultCurrencyOptions, t],
  );
  const localizedTimezoneOptions = useMemo(
    () => (timezoneOptions.length > 0 ? mapTimezoneDictionaryOptions(timezoneOptions, t) : defaultTimezoneOptions),
    [timezoneOptions, defaultTimezoneOptions, t],
  );
  const defaultLanguageOptions = [
    { label: '简体中文 (zh-CN)', value: 'zh-CN' },
    { label: '繁体中文 (zh-Hant)', value: 'zh-Hant' },
    { label: 'English (en-US)', value: 'en-US' },
    { label: '日本語 (ja-JP)', value: 'ja-JP' },
    { label: 'Tiếng Việt (vi-VN)', value: 'vi-VN' },
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
          <ProFormGroup title={t('pages.init.wizard.defaultSettings')}>
            <ProFormSelect
              name="timezone"
              label={t('pages.init.wizard.timezone')}
              rules={[{ required: true, message: t('pages.init.wizard.selectTimezone') }]}
              options={localizedTimezoneOptions}
            />
            <ProFormSelect
              name="default_currency"
              label={t('pages.init.wizard.defaultCurrency')}
              rules={[{ required: true, message: t('pages.init.wizard.selectCurrency') }]}
              options={localizedCurrencyOptions}
            />
            <ProFormSelect
              name="default_language"
              label={t('pages.init.wizard.defaultLanguage')}
              rules={[{ required: true, message: t('pages.init.wizard.selectLanguage') }]}
              options={languageOptions.length > 0 ? languageOptions : defaultLanguageOptions}
            />
            <ProFormSelect
              name="date_format"
              label={t('pages.init.wizard.dateFormat')}
              rules={[{ required: true, message: t('pages.init.wizard.selectDateFormat') }]}
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
        <h2>{t('pages.init.wizard.configComplete')}</h2>
        <p style={{ color: '#666', marginTop: 16, marginBottom: 32 }}>
          {t('pages.init.wizard.configConfirm')}
        </p>
        {initData.step2_default_settings && (
          <div style={{ textAlign: 'left', maxWidth: 600, margin: '0 auto' }}>
            <h3>{t('pages.init.wizard.configSummary')}</h3>
            <div style={{ marginBottom: 16 }}>
              <strong>{t('pages.init.wizard.basicSettings')}</strong>
              <div>{t('pages.init.wizard.summaryTimezone')}{initData.step2_default_settings.timezone}</div>
              <div>{t('pages.init.wizard.summaryCurrency')}{initData.step2_default_settings.default_currency}</div>
              <div>{t('pages.init.wizard.summaryLanguage')}{initData.step2_default_settings.default_language}</div>
              <div>{t('pages.init.wizard.summaryDateFormat')}{initData.step2_default_settings.date_format}</div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // 构建步骤列表（精简：仅基础设置 + 完成）
  const steps = [
    {
      title: t('pages.init.wizard.tabBasic'),
      description: t('pages.init.wizard.tabBasicDesc'),
      content: renderStep2(),
      icon: <SettingOutlined />,
    },
    {
      title: t('pages.init.wizard.tabFinish'),
      description: t('pages.init.wizard.tabFinishDesc'),
      content: renderStep5(),
      icon: <CheckCircleOutlined />,
    },
  ];

  if (!currentTenantId) {
    return <div>{t('pages.init.wizard.noTenantId')}</div>;
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

