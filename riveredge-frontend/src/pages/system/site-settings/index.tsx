/**
 * 站点设置页面
 *
 * 用于系统管理员配置组织内的站点设置。
 * 支持站点基本信息、Logo、邀请注册开关等配置。
 */

import React, { useState, useEffect, useLayoutEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Form, Input, Switch, Button, Upload, Space, Select, Row, Col, InputNumber, Card, ColorPicker, Modal, Table, Tag, Typography, theme } from 'antd';
import dayjs from 'dayjs';
import { SaveOutlined, ReloadOutlined, UploadOutlined, DeleteOutlined, InfoCircleOutlined, SettingOutlined, CloudDownloadOutlined, ApartmentOutlined, GlobalOutlined, LinkOutlined } from '@ant-design/icons';
import { ThemedSegmented } from '../../../components/themed-segmented';
import { MultiTabListPageTemplate } from '../../../components/layout-templates';
import type { UploadFile, UploadProps } from 'antd';
import {
  getSiteSetting,
  updateSiteSetting,
  getBranchOrganizationCapability,
  getBranchOrganizationList,
  createBranchOrganization,
  updateBranchOrganization,
  BranchOrganizationCapability,
  BranchOrganizationItem,
} from '../../../services/siteSetting';
import { TenantPlan, TenantStatus } from '../../../services/tenant';
import { useConfigStore, getPersistedConfigs } from '../../../stores/configStore';
import { useThemeStore } from '../../../stores/themeStore';
import { uploadFile, getSiteLogoPreview, invalidateSiteLogoPreviewCache, FileUploadResponse } from '../../../services/file';
import { toRelativeIfLocalhost } from '../../../utils/avatar';
import { 
  getDataDictionaryByCode, 
  getDictionaryItemList, 
  DictionaryItem 
} from '../../../services/dataDictionary';
import { getLanguageList } from '../../../services/language';
import ImageCropper from '../../../components/image-cropper';
import { getSiteSettingsDictCache, setSiteSettingsDictCache } from '../../../utils/siteSettingsDictCache';
import { cacheTenantDefaultLanguage } from '../../../utils/localeBootstrap';
import {
  buildFallbackCurrencyOptions,
  buildFallbackTimezoneOptions,
  mapCurrencyDictionaryOptions,
  mapTimezoneDictionaryOptions,
} from '../../../utils/systemDictionaryLabels';
import { formatDateTimeBySiteSetting } from '../../../utils/format';
import { TenantInitDataPanel } from '../config-center/TenantInitDataPanel';
import {
  LoginLeftColumnPreview,
  LoginPageEditorSplitPanel,
  LoginLocaleSettingsFields,
  LoginLogoSettingsBlock,
  LoginDomainSettingsBlock,
  LoginDecorationSettingsBlock,
  LoginBackgroundSettingsBlock,
  LoginFeatureSwitchesBlock,
} from '../../../components/login-page-editor';
import { isLoginVisualLayerEnabled, validateLoginVisualLayers } from '../../../utils/loginVisualLayers';
import {
  DEEPSEEK_DEFAULT_BASE_URL,
  DEEPSEEK_DEFAULT_MODEL,
  DEEPSEEK_OCR_EXAMPLE_BASE_URL,
  DEEPSEEK_OCR_EXAMPLE_MODEL,
  DEEPSEEK_V4_MODEL_OPTIONS,
  INTEGRATION_API_KEY_MASK,
} from '../../../utils/integrationSettings';

/**
 * 站点设置页面组件
 */
/** 从 configStore 构建表单初始值（与 loadSiteSetting 结构一致），用于首屏立即展示，避免空数据再重载 */
function getInitialValuesFromConfigStore(
  configs: Record<string, any>,
  normalizeColorValue: (color: any, defaultVal: string) => string
) {
  const themeConfig = configs.theme_config || {};
  const legacyThemeColor = configs.theme_color;
  const normalizedThemeColor = normalizeColorValue(
    legacyThemeColor || themeConfig.colorPrimary,
    '#1890ff'
  );
  return {
    site_name: configs.site_name ?? '',
    site_logo: configs.site_logo ?? '',
    organization_name: configs.organization_name ?? '',
    organization_address: configs.organization_address ?? '',
    contact_info: configs.contact_info ?? '',
    default_currency: configs.default_currency ?? 'CNY',
    date_format: configs.date_format ?? 'YYYY-MM-DD',
    default_language: configs.default_language ?? 'zh-CN',
    timezone: configs.timezone ?? 'Asia/Shanghai',
    theme_color: normalizedThemeColor,
    theme_borderRadius: themeConfig.borderRadius ?? 6,
    theme_fontSize: themeConfig.fontSize ?? 14,
    theme_compact: false,
    enable_register: configs.enable_register !== false,
    enable_launch_wizard: configs.enable_launch_wizard !== false,
    enable_system_dashboard: configs.enable_system_dashboard !== false,
    tenant_domain: configs.tenant_domain ?? '',
    platform_name: configs.platform_name ?? '',
    platform_name_en: configs.platform_name_en ?? '',
    login_logo: configs.login_logo ?? '',
    login_title: configs.login_title ?? '',
    login_title_en: configs.login_title_en ?? '',
    login_content: configs.login_content ?? '',
    login_content_en: configs.login_content_en ?? '',
    login_decoration_image: configs.login_decoration_image ?? '',
    login_background_image: configs.login_background_image ?? '',
    login_decoration_enabled: configs.login_decoration_enabled !== false,
    login_background_enabled: configs.login_background_enabled !== false,
    icp_license: configs.icp_license ?? '',
    icp_license_en: configs.icp_license_en ?? '',
    login_theme_color: configs.login_theme_color ?? undefined,
    login_guest_enabled: configs.login_guest_enabled !== false,
    login_client_win_enabled: configs.login_client_win_enabled !== false,
    login_client_android_enabled: configs.login_client_android_enabled !== false,
    login_quick_enabled: configs.login_quick_enabled !== false,
    copyright: configs.copyright ?? '',
    description: configs.description ?? '',
    'security.token_check_interval': configs['security.token_check_interval'] ?? configs.security?.token_check_interval ?? 60,
    'security.inactivity_timeout': configs['security.inactivity_timeout'] ?? configs.security?.inactivity_timeout ?? 1800,
    'security.user_cache_time': configs['security.user_cache_time'] ?? configs.security?.user_cache_time ?? 300,
    'ui.max_tabs': configs['ui.max_tabs'] ?? configs.ui?.max_tabs ?? 20,
    'ui.default_page_size': configs['ui.default_page_size'] ?? configs.ui?.default_page_size ?? 20,
    'ui.table_loading_delay': configs['ui.table_loading_delay'] ?? configs.ui?.table_loading_delay ?? 0,
    'theme_config.colorPrimary': configs['theme_config.colorPrimary'] ?? themeConfig.colorPrimary ?? normalizedThemeColor ?? '#1890ff',
    'network.timeout': configs['network.timeout'] ?? configs.network?.timeout ?? 10000,
    'system.max_retries': configs['system.max_retries'] ?? configs.system?.max_retries ?? 3,
    'integrations.deepseek.enabled': configs.integrations?.deepseek?.enabled === true,
    'integrations.deepseek.api_key': '',
    'integrations.deepseek.model': configs.integrations?.deepseek?.model ?? DEEPSEEK_DEFAULT_MODEL,
    'integrations.deepseek.base_url': configs.integrations?.deepseek?.base_url ?? DEEPSEEK_DEFAULT_BASE_URL,
    'integrations.deepseek.tools_enabled': configs.integrations?.deepseek?.tools_enabled !== false,
    'integrations.deepseek.rag_enabled': configs.integrations?.deepseek?.rag_enabled !== false,
    'integrations.deepseek.rag_use_embedding': configs.integrations?.deepseek?.rag_use_embedding !== false,
    'integrations.deepseek.rag_top_k': configs.integrations?.deepseek?.rag_top_k ?? 5,
    'integrations.deepseek.custom_system_prompt': configs.integrations?.deepseek?.custom_system_prompt ?? '',
    'integrations.deepseek.ocr_base_url': configs.integrations?.deepseek?.ocr_base_url ?? '',
    'integrations.deepseek.ocr_model': configs.integrations?.deepseek?.ocr_model ?? '',
    'integrations.deepseek.ocr_api_key': '',
  };
}

const DEFAULT_FORM_INITIAL = {
  default_currency: 'CNY',
  date_format: 'YYYY-MM-DD',
  default_language: 'zh-CN',
  timezone: 'Asia/Shanghai',
  enable_register: true,
  enable_launch_wizard: true,
  enable_system_dashboard: true,
} as const;

/** 同步用：仅支持字符串颜色，用于首帧从 localStorage 读出的 configs */
const syncNormalizeColor = (color: any, defaultVal: string): string =>
  typeof color === 'string' ? color : defaultVal;

const SITE_SETTINGS_BASIC_TAB_FIELDS = [
  'site_logo',
  'site_name',
  'organization_name',
  'organization_address',
  'contact_info',
  'default_currency',
  'date_format',
  'default_language',
  'timezone',
  'description',
] as const;

const SITE_SETTINGS_LOGIN_PAGE_TAB_FIELDS = [
  'tenant_domain',
  'platform_name',
  'platform_name_en',
  'login_logo',
  'login_title',
  'login_title_en',
  'login_content',
  'login_content_en',
  'login_decoration_image',
  'login_background_image',
  'login_decoration_enabled',
  'login_background_enabled',
  'icp_license',
  'icp_license_en',
  'login_theme_color',
  'login_guest_enabled',
  'login_client_win_enabled',
  'login_client_android_enabled',
  'login_quick_enabled',
  'enable_register',
] as const;

const SITE_SETTINGS_SYSTEM_TAB_FIELDS = [
  'enable_launch_wizard',
  'enable_system_dashboard',
  'security.token_check_interval',
  'security.inactivity_timeout',
  'security.user_cache_time',
  'ui.max_tabs',
  'ui.default_page_size',
  'ui.table_loading_delay',
  'theme_config.colorPrimary',
  'network.timeout',
  'system.max_retries',
] as const;

const SITE_SETTINGS_INTEGRATIONS_TAB_FIELDS = [
  'integrations.deepseek.enabled',
  'integrations.deepseek.model',
  'integrations.deepseek.base_url',
  'integrations.deepseek.api_key',
  'integrations.deepseek.tools_enabled',
  'integrations.deepseek.rag_enabled',
  'integrations.deepseek.rag_use_embedding',
  'integrations.deepseek.rag_top_k',
  'integrations.deepseek.custom_system_prompt',
  'integrations.deepseek.ocr_base_url',
  'integrations.deepseek.ocr_model',
  'integrations.deepseek.ocr_api_key',
] as const;

const SiteSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = theme.useToken();
  const cardRadius = token.borderRadiusLG;
  const fetchConfigs = useConfigStore((s) => s.fetchConfigs);
  const configs = useConfigStore((s) => s.configs);
  const initialized = useConfigStore((s) => s.initialized);
  const [form] = Form.useForm();
  // 首帧即用持久化 configs 填表，避免 persist 异步注水前的空白或重载感
  const [formInitialValues] = useState<Record<string, any>>(() => {
    const persisted = getPersistedConfigs();
    if (!persisted || !('site_name' in persisted)) return { ...DEFAULT_FORM_INITIAL };
    return getInitialValuesFromConfigStore(persisted, syncNormalizeColor);
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoFileList, setLogoFileList] = useState<UploadFile[]>([]);
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);
  const [loginLogoFileList, setLoginLogoFileList] = useState<UploadFile[]>([]);
  const [loginLogoUrl, setLoginLogoUrl] = useState<string | undefined>(undefined);
  const [useCustomLoginLogo, setUseCustomLoginLogo] = useState(false);
  const [decorationFileList, setDecorationFileList] = useState<UploadFile[]>([]);
  const [decorationImageUrl, setDecorationImageUrl] = useState<string | undefined>(undefined);
  const [backgroundFileList, setBackgroundFileList] = useState<UploadFile[]>([]);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | undefined>(undefined);
  const [cropModalVisible, setCropModalVisible] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [activeTabKey, setActiveTabKey] = useState('basic');
  const [currencyOptions, setCurrencyOptions] = useState<DictionaryItem[]>(
    () => (getSiteSettingsDictCache()?.currency ?? []) as DictionaryItem[]
  );
  const systemSettingsRef = React.useRef<Record<string, any>>({});
  const [timezoneOptions, setTimezoneOptions] = useState<DictionaryItem[]>(
    () => (getSiteSettingsDictCache()?.timezone ?? []) as DictionaryItem[]
  );
  const localizedCurrencyOptions = useMemo(
    () => mapCurrencyDictionaryOptions(currencyOptions, t),
    [currencyOptions, t],
  );
  const localizedTimezoneOptions = useMemo(
    () => mapTimezoneDictionaryOptions(timezoneOptions, t),
    [timezoneOptions, t],
  );
  const fallbackCurrencyOptions = useMemo(() => buildFallbackCurrencyOptions(t), [t]);
  const fallbackTimezoneOptions = useMemo(() => buildFallbackTimezoneOptions(t), [t]);
  const [branchOrgCapability, setBranchOrgCapability] = useState<BranchOrganizationCapability | null>(null);
  const [branchOrgList, setBranchOrgList] = useState<BranchOrganizationItem[]>([]);
  const [branchOrgTotal, setBranchOrgTotal] = useState(0);
  const [branchOrgPage, setBranchOrgPage] = useState(1);
  const [branchOrgPageSize, setBranchOrgPageSize] = useState(10);
  const [branchOrgLoading, setBranchOrgLoading] = useState(false);
  const [branchOrgModalOpen, setBranchOrgModalOpen] = useState(false);
  const [branchOrgModalMode, setBranchOrgModalMode] = useState<'create' | 'edit'>('create');
  const [editingBranchOrg, setEditingBranchOrg] = useState<BranchOrganizationItem | null>(null);
  const [creatingBranchOrg, setCreatingBranchOrg] = useState(false);
  const [updatingBranchOrg, setUpdatingBranchOrg] = useState(false);
  const [branchOrgForm] = Form.useForm();
  const [useNewBranchAdmin, setUseNewBranchAdmin] = useState(false);
  const [deepseekApiKeyConfigured, setDeepseekApiKeyConfigured] = useState(false);
  const [deepseekOcrApiKeyConfigured, setDeepseekOcrApiKeyConfigured] = useState(false);
  const tenantDomainValue = Form.useWatch('tenant_domain', form);
  const loginLogoValue = Form.useWatch('login_logo', form);
  const loginDecorationValue = Form.useWatch('login_decoration_image', form);
  const loginBackgroundValue = Form.useWatch('login_background_image', form);
  const loginDecorationEnabledValue = Form.useWatch('login_decoration_enabled', form);
  const loginBackgroundEnabledValue = Form.useWatch('login_background_enabled', form);
  const platformNameValue = Form.useWatch('platform_name', form);
  const platformNameEnValue = Form.useWatch('platform_name_en', form);
  const loginTitleValue = Form.useWatch('login_title', form);
  const loginTitleEnValue = Form.useWatch('login_title_en', form);
  const loginContentValue = Form.useWatch('login_content', form);
  const loginContentEnValue = Form.useWatch('login_content_en', form);
  const loginThemeColorValue = Form.useWatch('login_theme_color', form);
  const [loginPreviewLocale, setLoginPreviewLocale] = useState<'zh-CN' | 'en-US'>('zh-CN');
  const currentTenantDomain = String(tenantDomainValue || '').trim().toLowerCase();
  const tenantPathAccessUrl = (() => {
    if (!currentTenantDomain) return '';
    const { protocol, hostname, port } = window.location;
    const labels = hostname.split('.');
    const baseHost = labels.length >= 3 && labels[0].toLowerCase() === currentTenantDomain ? labels.slice(1).join('.') : hostname;
    return `${protocol}//${port ? `${baseHost}:${port}` : baseHost}/${currentTenantDomain}`;
  })();

  /**
   * 判断字符串是否是UUID格式
   */
  const isUUID = (str: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  /**
   * 加载LOGO预览URL
   */
  const loadLogoPreview = async (logoValue: string | undefined) => {
    if (!logoValue || !logoValue.trim()) {
      setLogoUrl(undefined);
      setLogoFileList([]);
      return;
    }

    // 如果是UUID格式，获取文件预览URL
    if (isUUID(logoValue.trim())) {
      const previewInfo = await getSiteLogoPreview(logoValue.trim());
      if (!previewInfo?.preview_url) {
        setLogoUrl(undefined);
        setLogoFileList([]);
        return;
      }
      const previewUrl = toRelativeIfLocalhost(previewInfo.preview_url);
      setLogoUrl(previewUrl);
      setLogoFileList([{
        uid: logoValue.trim(),
        name: t('pages.system.siteSettings.siteLogo'),
        status: 'done',
        url: previewUrl,
      }]);
    } else {
      // 如果是URL格式，直接使用
      setLogoUrl(logoValue.trim());
      setLogoFileList([{
        uid: logoValue.trim(),
        name: t('pages.system.siteSettings.siteLogo'),
        status: 'done',
        url: logoValue.trim(),
      }]);
    }
  };

  const loadDecorationPreview = async (imageValue: string | undefined) => {
    if (!imageValue || !imageValue.trim()) {
      setDecorationImageUrl(undefined);
      setDecorationFileList([]);
      return;
    }
    if (isUUID(imageValue.trim())) {
      const previewInfo = await getSiteLogoPreview(imageValue.trim());
      if (!previewInfo?.preview_url) {
        setDecorationImageUrl(undefined);
        setDecorationFileList([]);
        return;
      }
      const previewUrl = toRelativeIfLocalhost(previewInfo.preview_url);
      setDecorationImageUrl(previewUrl);
      setDecorationFileList([{
        uid: imageValue.trim(),
        name: t('pages.system.siteSettings.loginDecorationImage'),
        status: 'done',
        url: previewUrl,
      }]);
      return;
    }
    const normalized = toRelativeIfLocalhost(imageValue.trim());
    setDecorationImageUrl(normalized);
    setDecorationFileList([{
      uid: imageValue.trim(),
      name: t('pages.system.siteSettings.loginDecorationImage'),
      status: 'done',
      url: normalized,
    }]);
  };

  const loadBackgroundPreview = async (imageValue: string | undefined) => {
    if (!imageValue || !imageValue.trim()) {
      setBackgroundImageUrl(undefined);
      setBackgroundFileList([]);
      return;
    }
    if (isUUID(imageValue.trim())) {
      const previewInfo = await getSiteLogoPreview(imageValue.trim());
      if (!previewInfo?.preview_url) {
        setBackgroundImageUrl(undefined);
        setBackgroundFileList([]);
        return;
      }
      const previewUrl = toRelativeIfLocalhost(previewInfo.preview_url);
      setBackgroundImageUrl(previewUrl);
      setBackgroundFileList([{
        uid: imageValue.trim(),
        name: t('pages.system.siteSettings.loginBackgroundImage'),
        status: 'done',
        url: previewUrl,
      }]);
      return;
    }
    const normalized = toRelativeIfLocalhost(imageValue.trim());
    setBackgroundImageUrl(normalized);
    setBackgroundFileList([{
      uid: imageValue.trim(),
      name: t('pages.system.siteSettings.loginBackgroundImage'),
      status: 'done',
      url: normalized,
    }]);
  };

  const loadLoginLogoPreview = async (logoValue: string | undefined) => {
    if (!logoValue || !logoValue.trim()) {
      setLoginLogoUrl(undefined);
      setLoginLogoFileList([]);
      return;
    }
    if (isUUID(logoValue.trim())) {
      const previewInfo = await getSiteLogoPreview(logoValue.trim());
      if (!previewInfo?.preview_url) {
        setLoginLogoUrl(undefined);
        setLoginLogoFileList([]);
        return;
      }
      const previewUrl = toRelativeIfLocalhost(previewInfo.preview_url);
      setLoginLogoUrl(previewUrl);
      setLoginLogoFileList([{
        uid: logoValue.trim(),
        name: t('pages.system.siteSettings.loginLogo'),
        status: 'done',
        url: previewUrl,
      }]);
      return;
    }
    const normalized = toRelativeIfLocalhost(logoValue.trim());
    setLoginLogoUrl(normalized);
    setLoginLogoFileList([{
      uid: logoValue.trim(),
      name: t('pages.system.siteSettings.loginLogo'),
      status: 'done',
      url: normalized,
    }]);
  };

  const [languageOptions, setLanguageOptions] = useState<{ label: string; value: string; key: string }[]>(() => {
    const cached = getSiteSettingsDictCache()?.language;
    return Array.isArray(cached) ? (cached as { label: string; value: string; key: string }[]) : [];
  });

  /**
   * 加载站点设置和字典数据
   */
  useEffect(() => {
    loadSiteSetting();
    loadDictionaryData();
    loadBranchOrganizationCapability();
  }, []);

  useEffect(() => {
    const value = String(loginLogoValue || '').trim();
    if (!value) {
      setLoginLogoUrl(undefined);
      setLoginLogoFileList([]);
      return;
    }
    if (!isUUID(value)) {
      const normalized = toRelativeIfLocalhost(value);
      setLoginLogoUrl(normalized);
      setLoginLogoFileList([{
        uid: value,
        name: t('pages.system.siteSettings.loginLogo'),
        status: 'done',
        url: normalized,
      }]);
      return;
    }
    if (value.length !== 36) return;
    void loadLoginLogoPreview(value);
  }, [loginLogoValue]);

  useEffect(() => {
    const value = String(loginDecorationValue || '').trim();
    if (!value) {
      setDecorationImageUrl(undefined);
      setDecorationFileList([]);
      return;
    }
    if (!isUUID(value)) {
      const normalized = toRelativeIfLocalhost(value);
      setDecorationImageUrl(normalized);
      setDecorationFileList([{
        uid: value,
        name: t('pages.system.siteSettings.loginDecorationImage'),
        status: 'done',
        url: normalized,
      }]);
      return;
    }
    if (value.length !== 36) return;
    void loadDecorationPreview(value);
  }, [loginDecorationValue]);

  useEffect(() => {
    const value = String(loginBackgroundValue || '').trim();
    if (!value) {
      setBackgroundImageUrl(undefined);
      setBackgroundFileList([]);
      return;
    }
    if (!isUUID(value)) {
      const normalized = toRelativeIfLocalhost(value);
      setBackgroundImageUrl(normalized);
      setBackgroundFileList([{
        uid: value,
        name: t('pages.system.siteSettings.loginBackgroundImage'),
        status: 'done',
        url: normalized,
      }]);
      return;
    }
    if (value.length !== 36) return;
    void loadBackgroundPreview(value);
  }, [loginBackgroundValue]);

  const decorationLayerEnabled = isLoginVisualLayerEnabled(loginDecorationEnabledValue);
  const backgroundLayerEnabled = isLoginVisualLayerEnabled(loginBackgroundEnabledValue);

  const warnLoginVisualLayerAtLeastOne = () => {
    messageApi.warning(t('pages.system.siteSettings.loginVisualLayerAtLeastOne'));
  };

  const loadBranchOrganizationCapability = async () => {
    try {
      const capability = await getBranchOrganizationCapability();
      setBranchOrgCapability(capability);
    } catch {
      setBranchOrgCapability(null);
    }
  };

  const loadBranchOrganizations = async (page: number = branchOrgPage, pageSize: number = branchOrgPageSize) => {
    try {
      setBranchOrgLoading(true);
      const result = await getBranchOrganizationList({ page, page_size: pageSize });
      setBranchOrgList(result.items || []);
      setBranchOrgTotal(result.total || 0);
      setBranchOrgPage(result.page || page);
      setBranchOrgPageSize(result.page_size || pageSize);
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.siteSettings.branchOrgListLoadFailed'));
    } finally {
      setBranchOrgLoading(false);
    }
  };

  useEffect(() => {
    if (activeTabKey !== 'branch-organizations') return;
    loadBranchOrganizations(1, branchOrgPageSize);
  }, [activeTabKey]);

  useEffect(() => {
    if (branchOrgCapability?.is_branch_organization && activeTabKey === 'branch-organizations') {
      setActiveTabKey('basic');
    }
  }, [branchOrgCapability, activeTabKey]);

  useEffect(() => {
    if (branchOrgCapability?.is_branch_organization && activeTabKey === 'login-page') {
      setActiveTabKey('basic');
    }
  }, [branchOrgCapability, activeTabKey]);

  /**
   * 加载字典数据
   */
  const loadDictionaryData = async () => {
    try {
      // 加载语言列表
      try {
        const langResponse = await getLanguageList({ is_active: true });
        if (langResponse && langResponse.items) {
          const options = langResponse.items.map(lang => ({
             label: lang.native_name || lang.name,
             value: lang.code,
             key: lang.uuid || lang.code
          }));
          setLanguageOptions(options);
          setSiteSettingsDictCache({ language: options });
        }
      } catch (e) {
        console.warn('加载语言列表失败', e);
      }

      try {
        const currencyDict = await getDataDictionaryByCode('CURRENCY');
        if (currencyDict && currencyDict.uuid) {
          const items = await getDictionaryItemList(currencyDict.uuid, true);
          setCurrencyOptions(items);
          setSiteSettingsDictCache({ currency: items });
        }
      } catch (e) {
        console.warn('加载货币字典失败', e);
      }

      try {
        const timezoneDict = await getDataDictionaryByCode('TIMEZONE');
        if (timezoneDict && timezoneDict.uuid) {
          const items = await getDictionaryItemList(timezoneDict.uuid, true);
          setTimezoneOptions(items);
          setSiteSettingsDictCache({ timezone: items });
        }
      } catch (e) {
        console.warn('加载时区字典失败', e);
      }
    } catch (error) {
      console.error('加载字典数据失败', error);
    }
  };

  /**
   * 规范化颜色值为字符串格式（用于表单初始化）
   */
  const normalizeColorValue = (color: any, defaultValue: string = '#1890ff'): string => {
    if (!color) return defaultValue;
    if (typeof color === 'string') return color;

    // 处理颜色对象：优先使用 toHexString 方法
    if (color && typeof color.toHexString === 'function') {
      try {
        return color.toHexString();
      } catch (e) {
        console.warn('Color toHexString failed:', e);
      }
    }

    // 处理包含 metaColor 的颜色对象
    if (color && color.metaColor) {
      if (typeof color.metaColor.toHexString === 'function') {
        try {
          return color.metaColor.toHexString();
        } catch (e) {
          console.warn('Color metaColor toHexString failed:', e);
        }
      }
      // 如果 metaColor 有 r, g, b 属性，手动转换为 hex
      if (typeof color.metaColor.r === 'number' && typeof color.metaColor.g === 'number' && typeof color.metaColor.b === 'number') {
        const r = Math.round(color.metaColor.r).toString(16).padStart(2, '0');
        const g = Math.round(color.metaColor.g).toString(16).padStart(2, '0');
        const b = Math.round(color.metaColor.b).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
      }
    }

    // 如果 color 有 r, g, b 属性，手动转换为 hex
    if (color && typeof color.r === 'number' && typeof color.g === 'number' && typeof color.b === 'number') {
      const r = Math.round(color.r).toString(16).padStart(2, '0');
      const g = Math.round(color.g).toString(16).padStart(2, '0');
      const b = Math.round(color.b).toString(16).padStart(2, '0');
      return `#${r}${g}${b}`;
    }

    return defaultValue;
  };

  // 有缓存时（已初始化或持久化里含 site_name）用 store 填表；依赖 configs 以便 persist 注水后再填一次
  useLayoutEffect(() => {
    const hasSiteConfig = configs && (initialized || 'site_name' in configs);
    if (!hasSiteConfig) return;
    const values = getInitialValuesFromConfigStore(configs, normalizeColorValue);
    // 保留表单中已上传但尚未同步到 configStore 的 site_logo，避免 persist 注水覆盖
    const currentSiteLogo = form.getFieldValue('site_logo');
    if (
      typeof currentSiteLogo === 'string' &&
      currentSiteLogo.trim() &&
      currentSiteLogo.trim() !== String(values.site_logo ?? '').trim()
    ) {
      values.site_logo = currentSiteLogo;
    }
    form.setFieldsValue(values);
    systemSettingsRef.current = {
      'security.token_check_interval': values['security.token_check_interval'],
      'security.inactivity_timeout': values['security.inactivity_timeout'],
      'security.user_cache_time': values['security.user_cache_time'],
      'ui.max_tabs': values['ui.max_tabs'],
      'ui.default_page_size': values['ui.default_page_size'],
      'ui.table_loading_delay': values['ui.table_loading_delay'],
      'theme_config.colorPrimary': values['theme_config.colorPrimary'],
      'network.timeout': values['network.timeout'],
      'system.max_retries': values['system.max_retries'],
    };
    const logo = String(values.site_logo ?? '').trim();
    if (logo) loadLogoPreview(logo);
  }, [configs, initialized]);

  const loadSiteSetting = async () => {
    try {
      const hasCache = useConfigStore.getState().initialized;
      if (!hasCache) setLoading(true);
      const setting = await getSiteSetting();

      // 设置表单初始值
      // 兼容旧版本：如果存在 theme_color，优先使用；否则使用 theme_config
      const themeConfig = setting.settings?.theme_config || {};
      const legacyThemeColor = setting.settings?.theme_color;

      // 规范化颜色值为字符串，确保 ColorPicker 接收到正确的格式
      const normalizedThemeColor = normalizeColorValue(
        legacyThemeColor || themeConfig.colorPrimary,
        '#1890ff'
      );

      const siteLogoValue = setting.settings?.site_logo || '';

      const newValues = {
        site_name: setting.settings?.site_name || '',
        site_logo: siteLogoValue,
        organization_name: setting.settings?.organization_name || '',
        organization_address: setting.settings?.organization_address || '',
        contact_info: setting.settings?.contact_info || '',
        default_currency: setting.settings?.default_currency || 'CNY',
        date_format: setting.settings?.date_format || 'YYYY-MM-DD',
        default_language: setting.settings?.default_language || 'zh-CN',
        timezone: setting.settings?.timezone || 'Asia/Shanghai',
        theme_color: normalizedThemeColor,
        theme_borderRadius: themeConfig.borderRadius ?? 6,
        theme_fontSize: themeConfig.fontSize || 14,
        theme_compact: false,
        enable_register: setting.settings?.enable_register !== false,
        enable_launch_wizard: setting.settings?.enable_launch_wizard !== false,
        enable_system_dashboard: setting.settings?.enable_system_dashboard !== false,
        tenant_domain: setting.settings?.tenant_domain || '',
        platform_name: setting.settings?.platform_name || setting.settings?.site_name || '',
        platform_name_en: setting.settings?.platform_name_en || '',
        login_logo: setting.settings?.login_logo || '',
        login_title: setting.settings?.login_title || '',
        login_title_en: setting.settings?.login_title_en || '',
        login_content: setting.settings?.login_content || '',
        login_content_en: setting.settings?.login_content_en || '',
        login_decoration_image: setting.settings?.login_decoration_image || '',
        login_background_image: setting.settings?.login_background_image || '',
        login_decoration_enabled: setting.settings?.login_decoration_enabled !== false,
        login_background_enabled: setting.settings?.login_background_enabled !== false,
        icp_license: setting.settings?.icp_license || '',
        icp_license_en: setting.settings?.icp_license_en || '',
        login_theme_color: setting.settings?.login_theme_color || undefined,
        login_guest_enabled: setting.settings?.login_guest_enabled !== false,
        login_client_win_enabled: setting.settings?.login_client_win_enabled !== false,
        login_client_android_enabled: setting.settings?.login_client_android_enabled !== false,
        login_quick_enabled: setting.settings?.login_quick_enabled !== false,
        copyright: setting.settings?.copyright || '',
        description: setting.settings?.description || '',
        'security.token_check_interval': setting.settings?.security?.token_check_interval ?? 60,
        'security.inactivity_timeout': setting.settings?.security?.inactivity_timeout ?? 1800,
        'security.user_cache_time': setting.settings?.security?.user_cache_time ?? 300,
        'ui.max_tabs': setting.settings?.ui?.max_tabs ?? 20,
        'ui.default_page_size': setting.settings?.ui?.default_page_size ?? 20,
        'ui.table_loading_delay': setting.settings?.ui?.table_loading_delay ?? 0,
        'theme_config.colorPrimary': setting.settings?.theme_config?.colorPrimary ?? normalizedThemeColor ?? '#1890ff',
        'network.timeout': setting.settings?.network?.timeout ?? 10000,
        'system.max_retries': setting.settings?.system?.max_retries ?? 3,
        'integrations.deepseek.enabled': setting.settings?.integrations?.deepseek?.enabled === true,
        'integrations.deepseek.api_key': '',
        'integrations.deepseek.model':
          setting.settings?.integrations?.deepseek?.model ?? DEEPSEEK_DEFAULT_MODEL,
        'integrations.deepseek.base_url':
          setting.settings?.integrations?.deepseek?.base_url ?? DEEPSEEK_DEFAULT_BASE_URL,
        'integrations.deepseek.tools_enabled':
          setting.settings?.integrations?.deepseek?.tools_enabled !== false,
        'integrations.deepseek.rag_enabled':
          setting.settings?.integrations?.deepseek?.rag_enabled !== false,
        'integrations.deepseek.rag_use_embedding':
          setting.settings?.integrations?.deepseek?.rag_use_embedding !== false,
        'integrations.deepseek.rag_top_k': setting.settings?.integrations?.deepseek?.rag_top_k ?? 5,
        'integrations.deepseek.custom_system_prompt':
          setting.settings?.integrations?.deepseek?.custom_system_prompt ?? '',
        'integrations.deepseek.ocr_base_url':
          setting.settings?.integrations?.deepseek?.ocr_base_url ?? '',
        'integrations.deepseek.ocr_model':
          setting.settings?.integrations?.deepseek?.ocr_model ?? '',
        'integrations.deepseek.ocr_api_key': '',
      };
      setDeepseekApiKeyConfigured(setting.settings?.integrations?.deepseek?.api_key_configured === true);
      setDeepseekOcrApiKeyConfigured(
        setting.settings?.integrations?.deepseek?.ocr_api_key_configured === true,
      );
      setUseCustomLoginLogo(Boolean(String(newValues.login_logo || '').trim()));

      if (!hasCache) {
        form.setFieldsValue(newValues);
      } else {
        const current = form.getFieldsValue();
        const keys = Object.keys(newValues) as (keyof typeof newValues)[];
        const changed = keys.some((k) => {
          const a = current[k];
          const b = newValues[k];
          return typeof b === 'object' ? JSON.stringify(a) !== JSON.stringify(b) : a !== b;
        });
        if (changed) form.setFieldsValue(newValues);
      }

      systemSettingsRef.current = {
        'security.token_check_interval': setting.settings?.security?.token_check_interval ?? 60,
        'security.inactivity_timeout': setting.settings?.security?.inactivity_timeout ?? 1800,
        'security.user_cache_time': setting.settings?.security?.user_cache_time ?? 300,
        'ui.max_tabs': setting.settings?.ui?.max_tabs ?? 20,
        'ui.default_page_size': setting.settings?.ui?.default_page_size ?? 20,
        'ui.table_loading_delay': setting.settings?.ui?.table_loading_delay ?? 0,
        'theme_config.colorPrimary': setting.settings?.theme_config?.colorPrimary ?? normalizedThemeColor ?? '#1890ff',
        'network.timeout': setting.settings?.network?.timeout ?? 10000,
        'system.max_retries': setting.settings?.system?.max_retries ?? 3,
      };

      // 加载LOGO预览
      await loadLogoPreview(siteLogoValue);
      await loadLoginLogoPreview(setting.settings?.login_logo || '');
      await loadDecorationPreview(setting.settings?.login_decoration_image || '');
      await loadBackgroundPreview(setting.settings?.login_background_image || '');
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.siteSettings.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * 处理LOGO文件选择（在剪裁之前）
   */
  const handleLogoFileSelect: UploadProps['beforeUpload'] = (file) => {
    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      messageApi.error(t('pages.system.siteSettings.selectImage'));
      return false;
    }
    
    // 保存选中的文件，显示剪裁弹窗
    setSelectedImageFile(file);
    setCropModalVisible(true);
    
    // 阻止默认上传行为
    return false;
  };

  /**
   * 处理剪裁确认
   */
  const handleCropConfirm = async (croppedImageBlob: Blob) => {
    try {
      // 将Blob转换为File对象
      const croppedFile = new File([croppedImageBlob], selectedImageFile?.name || 'logo.png', {
        type: 'image/png',
        lastModified: Date.now(),
      });

      // 先使用本地文件创建预览URL（立即显示）
      const localPreviewUrl = URL.createObjectURL(croppedFile);
      setLogoUrl(localPreviewUrl);
      
      // 关闭剪裁弹窗
      setCropModalVisible(false);
      setSelectedImageFile(null);
      
      // 上传剪裁后的文件（使用category标记为站点logo，便于管理，自动租户隔离）
      const response: FileUploadResponse = await uploadFile(croppedFile, {
        category: 'site-logo',
        description: t('pages.system.siteSettings.siteLogo'),
      });
      
      if (response.uuid) {
        invalidateSiteLogoPreviewCache(response.uuid);
        form.setFieldsValue({ site_logo: response.uuid });

        // 与清除 LOGO 一致：上传后立即持久化，避免仅提示成功但未写入站点设置
        await updateSiteSetting({ settings: { site_logo: response.uuid } });
        await fetchConfigs(true);

        let previewUrl: string | undefined;
        try {
          const previewInfo = await getSiteLogoPreview(response.uuid);
          if (previewInfo?.preview_url) {
            previewUrl = toRelativeIfLocalhost(previewInfo.preview_url);
            URL.revokeObjectURL(localPreviewUrl);
            setLogoUrl(previewUrl);
          }
        } catch (error) {
          console.warn('Failed to get logo preview URL:', error);
        }

        setLogoFileList([{
          uid: response.uuid,
          name: response.original_name,
          status: 'done',
          url: previewUrl || localPreviewUrl,
        }]);

        useThemeStore.getState().initFromApi();
        messageApi.success(t('pages.system.siteSettings.logoUploadSuccess'));
      } else {
        // 上传失败，释放本地预览URL
        URL.revokeObjectURL(localPreviewUrl);
        setLogoUrl(undefined);
        throw new Error(t('pages.system.siteSettings.uploadFailed'));
      }
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.siteSettings.logoUploadFailed'));
    }
  };

  /**
   * 处理剪裁取消
   */
  const handleCropCancel = () => {
    setCropModalVisible(false);
    setSelectedImageFile(null);
  };

  /**
   * 处理清除LOGO
   */
  const handleClearLogo = async () => {
    try {
      setSaving(true);
      const previousLogo = form.getFieldValue('site_logo');
      setLogoUrl(undefined);
      setLogoFileList([]);
      form.setFieldsValue({
        site_logo: '',
      });
      await updateSiteSetting({ settings: { site_logo: '' } });
      if (typeof previousLogo === 'string' && previousLogo.trim()) {
        invalidateSiteLogoPreviewCache(previousLogo.trim());
      }
      await fetchConfigs(true);
      messageApi.success(t('pages.system.siteSettings.logoClearSuccess'));
      useThemeStore.getState().initFromApi();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.siteSettings.logoClearFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDecorationUpload: UploadProps['beforeUpload'] = async (file) => {
    try {
      if (!file.type.startsWith('image/')) {
        messageApi.error(t('pages.system.siteSettings.selectImage'));
        return Upload.LIST_IGNORE;
      }
      const response = await uploadFile(file as File, {
        category: 'site-logo',
        description: t('pages.system.siteSettings.loginDecorationImage'),
      });
      if (!response.uuid) {
        messageApi.error(t('pages.system.siteSettings.uploadFailed'));
        return Upload.LIST_IGNORE;
      }
      form.setFieldsValue({ login_decoration_image: response.uuid });
      await loadDecorationPreview(response.uuid);
      messageApi.success(t('pages.system.siteSettings.loginDecorationUploadSuccess'));
      return Upload.LIST_IGNORE;
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.siteSettings.loginDecorationUploadFailed'));
      return Upload.LIST_IGNORE;
    }
  };

  const handleLoginLogoUpload: UploadProps['beforeUpload'] = async (file) => {
    try {
      if (!file.type.startsWith('image/')) {
        messageApi.error(t('pages.system.siteSettings.selectImage'));
        return Upload.LIST_IGNORE;
      }
      const response = await uploadFile(file as File, {
        category: 'site-logo',
        description: t('pages.system.siteSettings.loginLogo'),
      });
      if (!response.uuid) {
        messageApi.error(t('pages.system.siteSettings.uploadFailed'));
        return Upload.LIST_IGNORE;
      }
      form.setFieldsValue({ login_logo: response.uuid });
      await loadLoginLogoPreview(response.uuid);
      messageApi.success(t('pages.system.siteSettings.loginLogoUploadSuccess'));
      return Upload.LIST_IGNORE;
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.siteSettings.loginLogoUploadFailed'));
      return Upload.LIST_IGNORE;
    }
  };

  const handleClearLoginLogo = () => {
    form.setFieldsValue({ login_logo: '' });
    setLoginLogoUrl(undefined);
    setLoginLogoFileList([]);
  };

  const handleDisableCustomLoginLogo = () => {
    handleClearLoginLogo();
    setUseCustomLoginLogo(false);
  };

  const handleClearDecorationImage = () => {
    form.setFieldsValue({ login_decoration_image: '' });
    setDecorationImageUrl(undefined);
    setDecorationFileList([]);
  };

  const handleBackgroundUpload: UploadProps['beforeUpload'] = async (file) => {
    try {
      if (!file.type.startsWith('image/')) {
        messageApi.error(t('pages.system.siteSettings.selectImage'));
        return Upload.LIST_IGNORE;
      }
      const response = await uploadFile(file as File, {
        category: 'site-logo',
        description: t('pages.system.siteSettings.loginBackgroundImage'),
      });
      if (!response.uuid) {
        messageApi.error(t('pages.system.siteSettings.uploadFailed'));
        return Upload.LIST_IGNORE;
      }
      form.setFieldsValue({ login_background_image: response.uuid });
      await loadBackgroundPreview(response.uuid);
      messageApi.success(t('pages.system.siteSettings.loginBackgroundUploadSuccess'));
      return Upload.LIST_IGNORE;
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.siteSettings.loginBackgroundUploadFailed'));
      return Upload.LIST_IGNORE;
    }
  };

  const handleClearBackgroundImage = () => {
    form.setFieldsValue({ login_background_image: '' });
    setBackgroundImageUrl(undefined);
    setBackgroundFileList([]);
  };

  /**
   * 处理保存（仅提交当前 Tab 对应字段）
   */
  const handleSave = async () => {
    const saveTab = activeTabKey;
    if (saveTab === 'branch-organizations' || saveTab === 'init-data') {
      return;
    }

    try {
      setSaving(true);
      const settings: Record<string, any> = {};
      let shouldRefreshConfigs = false;
      let shouldRefreshTheme = false;

      if (saveTab === 'basic') {
        const values = await form.validateFields([...SITE_SETTINGS_BASIC_TAB_FIELDS]);
        Object.assign(settings, {
          site_logo: values.site_logo,
          site_name: values.site_name,
          organization_name: values.organization_name,
          organization_address: values.organization_address,
          contact_info: values.contact_info,
          default_currency: values.default_currency,
          date_format: values.date_format,
          default_language: values.default_language,
          timezone: values.timezone,
          description: values.description,
        });
        if (values.default_language) {
          cacheTenantDefaultLanguage(values.default_language);
        }
        shouldRefreshConfigs = true;
      } else if (saveTab === 'login-page') {
        const values = await form.validateFields([...SITE_SETTINGS_LOGIN_PAGE_TAB_FIELDS]);
        try {
          validateLoginVisualLayers(
            isLoginVisualLayerEnabled(values.login_decoration_enabled),
            isLoginVisualLayerEnabled(values.login_background_enabled),
          );
        } catch {
          messageApi.error(t('pages.system.siteSettings.loginVisualLayerAtLeastOne'));
          return;
        }
        Object.assign(settings, {
          tenant_domain: values.tenant_domain,
          platform_name: values.platform_name,
          platform_name_en: values.platform_name_en,
          login_logo: values.login_logo,
          login_title: values.login_title,
          login_title_en: values.login_title_en,
          login_content: values.login_content,
          login_content_en: values.login_content_en,
          login_decoration_image: values.login_decoration_image,
          login_background_image: values.login_background_image,
          login_decoration_enabled: values.login_decoration_enabled,
          login_background_enabled: values.login_background_enabled,
          icp_license: values.icp_license,
          icp_license_en: values.icp_license_en,
          login_theme_color: values.login_theme_color,
          login_guest_enabled: values.login_guest_enabled,
          login_client_win_enabled: values.login_client_win_enabled,
          login_client_android_enabled: values.login_client_android_enabled,
          login_quick_enabled: values.login_quick_enabled,
          enable_register: values.enable_register,
        });
        shouldRefreshConfigs = true;
      } else if (saveTab === 'system') {
        const values = await form.validateFields([...SITE_SETTINGS_SYSTEM_TAB_FIELDS]);
        const sys = { ...systemSettingsRef.current, ...values };
        Object.assign(settings, {
          enable_launch_wizard: values.enable_launch_wizard,
          enable_system_dashboard: values.enable_system_dashboard,
        });
        if (sys['security.token_check_interval'] !== undefined) {
          settings.security = {
            token_check_interval: sys['security.token_check_interval'],
            inactivity_timeout: sys['security.inactivity_timeout'],
            user_cache_time: sys['security.user_cache_time'],
          };
        }
        if (sys['ui.max_tabs'] !== undefined) {
          settings.ui = {
            max_tabs: sys['ui.max_tabs'],
            default_page_size: sys['ui.default_page_size'],
            table_loading_delay: sys['ui.table_loading_delay'],
          };
        }
        if (sys['theme_config.colorPrimary'] !== undefined) {
          settings.theme_config = { colorPrimary: sys['theme_config.colorPrimary'] };
        }
        if (sys['network.timeout'] !== undefined) {
          settings.network = { timeout: sys['network.timeout'] };
        }
        if (sys['system.max_retries'] !== undefined) {
          settings.system = { max_retries: sys['system.max_retries'] };
        }
        shouldRefreshConfigs = true;
        shouldRefreshTheme = true;
      } else if (saveTab === 'integrations') {
        const values = await form.validateFields([...SITE_SETTINGS_INTEGRATIONS_TAB_FIELDS]);
        const deepseekApiKey = String(values['integrations.deepseek.api_key'] ?? '').trim();
        const deepseekOcrApiKey = String(values['integrations.deepseek.ocr_api_key'] ?? '').trim();
        const deepseekPayload: Record<string, any> = {
          enabled: values['integrations.deepseek.enabled'] === true,
          model:
            String(values['integrations.deepseek.model'] ?? DEEPSEEK_DEFAULT_MODEL).trim() ||
            DEEPSEEK_DEFAULT_MODEL,
          base_url:
            String(values['integrations.deepseek.base_url'] ?? DEEPSEEK_DEFAULT_BASE_URL).trim() ||
            DEEPSEEK_DEFAULT_BASE_URL,
          tools_enabled: values['integrations.deepseek.tools_enabled'] !== false,
          rag_enabled: values['integrations.deepseek.rag_enabled'] !== false,
          rag_use_embedding: values['integrations.deepseek.rag_use_embedding'] !== false,
          rag_top_k: Number(values['integrations.deepseek.rag_top_k']) || 5,
          custom_system_prompt: String(values['integrations.deepseek.custom_system_prompt'] ?? '').trim(),
          ocr_base_url: String(values['integrations.deepseek.ocr_base_url'] ?? '').trim(),
          ocr_model: String(values['integrations.deepseek.ocr_model'] ?? '').trim(),
        };
        if (deepseekApiKey && deepseekApiKey !== INTEGRATION_API_KEY_MASK) {
          deepseekPayload.api_key = deepseekApiKey;
        }
        if (deepseekOcrApiKey && deepseekOcrApiKey !== INTEGRATION_API_KEY_MASK) {
          deepseekPayload.ocr_api_key = deepseekOcrApiKey;
        }
        settings.integrations = { deepseek: deepseekPayload };
        shouldRefreshConfigs = true;
      } else {
        return;
      }

      await updateSiteSetting({ settings });
      messageApi.success(t('pages.system.siteSettings.saveSuccess'));

      if (shouldRefreshTheme) {
        useThemeStore.getState().initFromApi();
        systemSettingsRef.current = {
          ...systemSettingsRef.current,
          'security.token_check_interval': settings.security?.token_check_interval,
          'security.inactivity_timeout': settings.security?.inactivity_timeout,
          'security.user_cache_time': settings.security?.user_cache_time,
          'ui.max_tabs': settings.ui?.max_tabs,
          'ui.default_page_size': settings.ui?.default_page_size,
          'ui.table_loading_delay': settings.ui?.table_loading_delay,
          'theme_config.colorPrimary': settings.theme_config?.colorPrimary,
          'network.timeout': settings.network?.timeout,
          'system.max_retries': settings.system?.max_retries,
        };
      }

      if (shouldRefreshConfigs) {
        await fetchConfigs(true);
      }
      await loadSiteSetting();
    } catch (error: any) {
      if (error?.errorFields) return;
      messageApi.error(error?.message || t('pages.system.siteSettings.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleResetLoginPageSettings = async () => {
    try {
      setSaving(true);
      await updateSiteSetting({
        settings: {
          platform_name: '',
          platform_name_en: '',
          login_logo: '',
          login_title: '',
          login_title_en: '',
          login_content: '',
          login_content_en: '',
          login_decoration_image: '',
          login_background_image: '',
          login_decoration_enabled: null,
          login_background_enabled: null,
          icp_license: '',
          icp_license_en: '',
          login_theme_color: '',
          login_guest_enabled: null,
          login_client_win_enabled: null,
          login_client_android_enabled: null,
          login_quick_enabled: null,
        },
      });
      await loadSiteSetting();
      await fetchConfigs(true);
      messageApi.success(t('pages.system.siteSettings.loginPageResetSuccess'));
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.siteSettings.loginPageResetFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleCreateBranchOrganization = async () => {
    try {
      const values = await branchOrgForm.validateFields();
      setCreatingBranchOrg(true);
      await createBranchOrganization({
        name: values.name,
        domain: values.domain,
        admin_account: useNewBranchAdmin
          ? {
              username: values.admin_username,
              password: values.admin_password,
              full_name: values.admin_full_name || undefined,
              phone: values.admin_phone || undefined,
            }
          : undefined,
      });
      messageApi.success(t('pages.system.siteSettings.branchOrgCreateSuccess'));
      setBranchOrgModalOpen(false);
      branchOrgForm.resetFields();
      setUseNewBranchAdmin(false);
      await loadBranchOrganizationCapability();
      await loadBranchOrganizations(1, branchOrgPageSize);
    } catch (error: any) {
      if (error?.errorFields) return;
      messageApi.error(error?.message || t('pages.system.siteSettings.branchOrgCreateFailed'));
    } finally {
      setCreatingBranchOrg(false);
    }
  };

  const openCreateBranchOrgModal = () => {
    setBranchOrgModalMode('create');
    setEditingBranchOrg(null);
    branchOrgForm.resetFields();
    setUseNewBranchAdmin(false);
    setBranchOrgModalOpen(true);
  };

  const openEditBranchOrgModal = (record: BranchOrganizationItem) => {
    setBranchOrgModalMode('edit');
    setEditingBranchOrg(record);
    setUseNewBranchAdmin(false);
    branchOrgForm.setFieldsValue({
      name: record.name,
      domain: record.domain,
      status: record.status,
    });
    setBranchOrgModalOpen(true);
  };

  const handleUpdateBranchOrganization = async () => {
    if (!editingBranchOrg) return;
    try {
      const values = await branchOrgForm.validateFields(['name', 'domain', 'status']);
      setUpdatingBranchOrg(true);
      await updateBranchOrganization(editingBranchOrg.id, {
        name: values.name,
        domain: values.domain,
        status: values.status,
      });
      messageApi.success(t('pages.system.siteSettings.branchOrgUpdateSuccess'));
      setBranchOrgModalOpen(false);
      setEditingBranchOrg(null);
      branchOrgForm.resetFields();
      await loadBranchOrganizations(branchOrgPage, branchOrgPageSize);
    } catch (error: any) {
      if (error?.errorFields) return;
      messageApi.error(error?.message || t('pages.system.siteSettings.branchOrgUpdateFailed'));
    } finally {
      setUpdatingBranchOrg(false);
    }
  };

  const handleBranchOrgModalOk = () => {
    if (branchOrgModalMode === 'edit') {
      return handleUpdateBranchOrganization();
    }
    return handleCreateBranchOrganization();
  };

  const closeBranchOrgModal = () => {
    setBranchOrgModalOpen(false);
    setEditingBranchOrg(null);
    setUseNewBranchAdmin(false);
    branchOrgForm.resetFields();
  };

  const actionButtons = (
    <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-start' }}>
      <Space>
        <Button
          icon={<ReloadOutlined />}
          onClick={loadSiteSetting}
          loading={loading}
        >
          {t('pages.system.siteSettings.refresh')}
        </Button>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={handleSave}
          loading={saving}
        >
          {t('pages.system.siteSettings.save')}
        </Button>
      </Space>
    </div>
  );

  const basicInfoContent = (
    <Row gutter={[24, 16]}>
      <Col xs={24} sm={24} md={24} lg={24}>
        <Form.Item
          name="site_logo"
          label={t('pages.system.siteSettings.siteLogo')}
          tooltip={t('pages.system.siteSettings.siteLogoTooltip')}
        >
          <Space orientation="vertical" style={{ width: '100%' }}>
            {logoUrl && (
              <div style={{ marginBottom: 8 }}>
                <img
                  src={logoUrl}
                  alt={t('pages.system.siteSettings.siteLogo')}
                  style={{
                    maxWidth: '200px',
                    maxHeight: '100px',
                    objectFit: 'contain',
                    border: '1px solid var(--river-border-color)',
                    borderRadius: '4px',
                    padding: '8px',
                  }}
                />
              </div>
            )}
            <Space>
              <Upload
                beforeUpload={handleLogoFileSelect}
                fileList={logoFileList}
                maxCount={1}
                accept="image/*"
                showUploadList={false}
              >
                <Button icon={<UploadOutlined />}>{t('pages.system.siteSettings.uploadLogo')}</Button>
              </Upload>
              {logoUrl && (
                <Button icon={<DeleteOutlined />} danger onClick={handleClearLogo}>
                  {t('pages.system.siteSettings.clearLogo')}
                </Button>
              )}
            </Space>
          </Space>
        </Form.Item>
      </Col>
      <Col xs={24} sm={24} md={12} lg={12}>
        <Form.Item
          name="site_name"
          label={t('pages.system.siteSettings.siteName')}
          tooltip={t('pages.system.siteSettings.siteNameTooltip')}
        >
          <Input placeholder={t('pages.system.siteSettings.siteNamePlaceholder')} />
        </Form.Item>
      </Col>
      <Col xs={24} sm={24} md={12} lg={12}>
        <Form.Item name="organization_name" label={t('pages.system.siteSettings.organizationName')}>
          <Input placeholder={t('pages.system.siteSettings.organizationNamePlaceholder')} />
        </Form.Item>
      </Col>
      <Col xs={24} sm={24} md={12} lg={12}>
        <Form.Item name="organization_address" label={t('pages.system.siteSettings.organizationAddress')}>
          <Input placeholder={t('pages.system.siteSettings.organizationAddressPlaceholder')} />
        </Form.Item>
      </Col>
      <Col xs={24} sm={24} md={12} lg={12}>
        <Form.Item name="contact_info" label={t('pages.system.siteSettings.contactInfo')}>
          <Input placeholder={t('pages.system.siteSettings.contactInfoPlaceholder')} />
        </Form.Item>
      </Col>
      <Col xs={24} sm={24} md={12} lg={12}>
        <Form.Item name="default_currency" label={t('pages.system.siteSettings.defaultCurrency')}>
          <Select placeholder={t('pages.system.siteSettings.defaultCurrencyPlaceholder')} loading={loading} allowClear>
            {localizedCurrencyOptions.map((item) => (
              <Select.Option key={item.value} value={item.value}>
                {item.label}
              </Select.Option>
            ))}
            {localizedCurrencyOptions.length === 0 &&
              fallbackCurrencyOptions.map((item) => (
                <Select.Option key={item.value} value={item.value}>
                  {item.label}
                </Select.Option>
              ))}
          </Select>
        </Form.Item>
      </Col>
      <Col xs={24} sm={24} md={12} lg={12}>
        <Form.Item name="date_format" label={t('pages.system.siteSettings.dateFormat')}>
          <Select placeholder={t('pages.system.siteSettings.dateFormatPlaceholder')}>
            <Select.Option value="YYYY-MM-DD">{t('pages.system.siteSettings.dateFormatYMD')}</Select.Option>
            <Select.Option value="DD/MM/YYYY">{t('pages.system.siteSettings.dateFormatDMY')}</Select.Option>
            <Select.Option value="MM/DD/YYYY">{t('pages.system.siteSettings.dateFormatMDY')}</Select.Option>
            <Select.Option value="YYYY年MM月DD日">{t('pages.system.siteSettings.dateFormatChinese')}</Select.Option>
          </Select>
        </Form.Item>
      </Col>
      <Col xs={24} sm={24} md={12} lg={12}>
        <Form.Item name="default_language" label={t('pages.system.siteSettings.defaultLanguage')}>
          <Select placeholder={t('pages.system.siteSettings.defaultLanguagePlaceholder')} loading={loading} allowClear>
            {languageOptions.map((item) => (
              <Select.Option key={item.key} value={item.value}>
                {item.label}
              </Select.Option>
            ))}
            {languageOptions.length === 0 && (
              <>
                <Select.Option value="zh-CN">{t('pages.system.siteSettings.langZhCN')}</Select.Option>
                <Select.Option value="en-US">{t('pages.system.siteSettings.langEnUS')}</Select.Option>
              </>
            )}
          </Select>
        </Form.Item>
      </Col>
      <Col xs={24} sm={24} md={12} lg={12}>
        <Form.Item name="timezone" label={t('pages.system.siteSettings.timezone')}>
          <Select placeholder={t('pages.system.siteSettings.timezonePlaceholder')} loading={loading} allowClear>
            {localizedTimezoneOptions.map((item) => (
              <Select.Option key={item.value} value={item.value}>
                {item.label}
              </Select.Option>
            ))}
            {localizedTimezoneOptions.length === 0 &&
              fallbackTimezoneOptions.map((item) => (
                <Select.Option key={item.value} value={item.value}>
                  {item.label}
                </Select.Option>
              ))}
          </Select>
        </Form.Item>
      </Col>
      <Col xs={24} sm={24} md={24} lg={24}>
        <Form.Item name="description" label={t('pages.system.siteSettings.description')}>
          <Input.TextArea rows={3} placeholder={t('pages.system.siteSettings.descriptionPlaceholder')} />
        </Form.Item>
      </Col>
    </Row>
  );

  const basicInfoWithActions = (
    <>
      {basicInfoContent}
      {actionButtons}
    </>
  );

  const systemSettingsContent = (
    <Row gutter={[0, 16]}>
      <Col span={24}>
        <Card title={t('pages.system.siteSettings.tabFunction')} size="small">
          <Row gutter={[16, 0]}>
            <Col xs={24} sm={12} md={12} lg={12} xl={12}>
              <Form.Item
                name="enable_launch_wizard"
                label={t('pages.system.siteSettings.enableLaunchWizard')}
                valuePropName="checked"
                tooltip={t('pages.system.siteSettings.enableLaunchWizardTooltip')}
              >
                <Switch />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={12} lg={12} xl={12}>
              <Form.Item
                name="enable_system_dashboard"
                label={t('pages.system.siteSettings.enableSystemDashboard')}
                valuePropName="checked"
                tooltip={t('pages.system.siteSettings.enableSystemDashboardTooltip')}
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Card>
      </Col>
      <Col span={24}>
        <Card title={t('pages.system.siteSettings.groupSecurity')} size="small">
          <Row gutter={[16, 0]}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name="security.token_check_interval"
                label={t('pages.system.configCenter.param.security_token_check_interval')}
                tooltip={t('pages.system.configCenter.param.security_token_check_interval_desc')}
              >
                <InputNumber min={10} max={300} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name="security.inactivity_timeout"
                label={t('pages.system.configCenter.param.security_inactivity_timeout')}
                tooltip={t('pages.system.configCenter.param.security_inactivity_timeout_desc')}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name="security.user_cache_time"
                label={t('pages.system.configCenter.param.security_user_cache_time')}
                tooltip={t('pages.system.configCenter.param.security_user_cache_time_desc')}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Card>
      </Col>
      <Col span={24}>
        <Card title={t('pages.system.siteSettings.groupUi')} size="small">
          <Row gutter={[16, 0]}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name="ui.max_tabs"
                label={t('pages.system.configCenter.param.ui_max_tabs')}
                tooltip={t('pages.system.configCenter.param.ui_max_tabs_desc')}
              >
                <InputNumber min={5} max={50} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name="ui.default_page_size"
                label={t('pages.system.configCenter.param.ui_default_page_size')}
                tooltip={t('pages.system.configCenter.param.ui_default_page_size_desc')}
              >
                <InputNumber min={5} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name="ui.table_loading_delay"
                label={t('pages.system.configCenter.param.ui_table_loading_delay')}
                tooltip={t('pages.system.configCenter.param.ui_table_loading_delay_desc')}
              >
                <InputNumber min={0} max={1000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Card>
      </Col>
      <Col span={24}>
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title={t('pages.system.configCenter.param.theme_config_colorPrimary')} size="small">
              <Form.Item
                name="theme_config.colorPrimary"
                label={t('pages.system.configCenter.param.theme_config_colorPrimary')}
                tooltip={t('pages.system.configCenter.param.theme_config_colorPrimary_desc')}
                getValueFromEvent={(c: any) => (typeof c?.toHexString === 'function' ? c.toHexString() : c)}
                style={{ marginBottom: 0 }}
              >
                <ColorPicker showText />
              </Form.Item>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title={t('pages.system.siteSettings.groupNetwork')} size="small">
              <Row gutter={[16, 0]}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="network.timeout"
                    label={t('pages.system.configCenter.param.network_timeout')}
                    tooltip={t('pages.system.configCenter.param.network_timeout_desc')}
                    style={{ marginBottom: 0 }}
                  >
                    <InputNumber min={1000} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="system.max_retries"
                    label={t('pages.system.configCenter.param.system_max_retries')}
                    tooltip={t('pages.system.configCenter.param.system_max_retries_desc')}
                    style={{ marginBottom: 0 }}
                  >
                    <InputNumber min={0} max={5} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>
      </Col>
    </Row>
  );

  const systemSettingsWithActions = (
    <>
      {systemSettingsContent}
      {actionButtons}
    </>
  );

  const integrationsSettingsContent = (
    <Row gutter={[0, 16]}>
      <Col span={24}>
        <Card title={t('pages.system.siteSettings.integrationsDeepseekTitle')} size="small">
          <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
            {t('pages.system.siteSettings.integrationsDeepseekHint')}
          </Typography.Paragraph>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Form.Item
                name="integrations.deepseek.enabled"
                label={t('pages.system.siteSettings.integrationsDeepseekEnabled')}
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Form.Item
                name="integrations.deepseek.model"
                label={t('pages.system.siteSettings.integrationsDeepseekModel')}
                tooltip={t('pages.system.siteSettings.integrationsDeepseekModelTooltip')}
              >
                <Select
                  options={DEEPSEEK_V4_MODEL_OPTIONS.map(value => ({
                    value,
                    label: t(`pages.system.siteSettings.integrationsDeepseekModel_${value}`),
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="integrations.deepseek.base_url"
                label={t('pages.system.siteSettings.integrationsDeepseekBaseUrl')}
              >
                <Input placeholder={t('pages.system.siteSettings.integrationsDeepseekBaseUrlPlaceholder')} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="integrations.deepseek.api_key"
                label={t('pages.system.siteSettings.integrationsDeepseekApiKey')}
                extra={
                  deepseekApiKeyConfigured
                    ? t('pages.system.siteSettings.integrationsDeepseekApiKeyConfigured')
                    : undefined
                }
              >
                <Input.Password
                  placeholder={
                    deepseekApiKeyConfigured
                      ? t('pages.system.siteSettings.integrationsDeepseekApiKeyPlaceholderConfigured')
                      : t('pages.system.siteSettings.integrationsDeepseekApiKeyPlaceholder')
                  }
                  autoComplete="new-password"
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>
      </Col>
      <Col span={24}>
        <Card title={t('pages.system.siteSettings.integrationsDeepseekOcrTitle')} size="small">
          <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
            {t('pages.system.siteSettings.integrationsDeepseekOcrHint')}
          </Typography.Paragraph>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Form.Item
                name="integrations.deepseek.ocr_base_url"
                label={t('pages.system.siteSettings.integrationsDeepseekOcrBaseUrl')}
              >
                <Input placeholder={DEEPSEEK_OCR_EXAMPLE_BASE_URL} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="integrations.deepseek.ocr_model"
                label={t('pages.system.siteSettings.integrationsDeepseekOcrModel')}
              >
                <Input placeholder={DEEPSEEK_OCR_EXAMPLE_MODEL} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="integrations.deepseek.ocr_api_key"
                label={t('pages.system.siteSettings.integrationsDeepseekOcrApiKey')}
                tooltip={t('pages.system.siteSettings.integrationsDeepseekOcrApiKeyTooltip')}
                extra={
                  deepseekOcrApiKeyConfigured
                    ? t('pages.system.siteSettings.integrationsDeepseekApiKeyConfigured')
                    : undefined
                }
              >
                <Input.Password
                  placeholder={
                    deepseekOcrApiKeyConfigured
                      ? t('pages.system.siteSettings.integrationsDeepseekApiKeyPlaceholderConfigured')
                      : t('pages.system.siteSettings.integrationsDeepseekOcrApiKeyPlaceholder')
                  }
                  autoComplete="new-password"
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>
      </Col>
      <Col span={24}>
        <Card title={t('pages.system.siteSettings.integrationsDeepseekAiTitle')} size="small">
          <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
            {t('pages.system.siteSettings.integrationsDeepseekAiHint')}
          </Typography.Paragraph>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Form.Item
                name="integrations.deepseek.tools_enabled"
                label={t('pages.system.siteSettings.integrationsDeepseekToolsEnabled')}
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="integrations.deepseek.rag_enabled"
                label={t('pages.system.siteSettings.integrationsDeepseekRagEnabled')}
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="integrations.deepseek.rag_use_embedding"
                label={t('pages.system.siteSettings.integrationsDeepseekRagEmbedding')}
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Form.Item
                name="integrations.deepseek.rag_top_k"
                label={t('pages.system.siteSettings.integrationsDeepseekRagTopK')}
              >
                <InputNumber min={1} max={20} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Form.Item
                name="integrations.deepseek.custom_system_prompt"
                label={t('pages.system.siteSettings.integrationsDeepseekCustomPrompt')}
              >
                <Input.TextArea
                  rows={5}
                  placeholder={t('pages.system.siteSettings.integrationsDeepseekCustomPromptPlaceholder')}
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>
      </Col>
    </Row>
  );

  const integrationsSettingsWithActions = (
    <>
      {integrationsSettingsContent}
      {actionButtons}
    </>
  );

  const loginPageSettingsContent = (
    <Row gutter={[0, 16]}>
      <Col span={24}>
        <Card title={t('pages.infra.platform.loginConfig')} size="small">
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <LoginPageEditorSplitPanel
                preview={
                  <>
                    <div className="login-page-editor-split-preview-header">
                      <Typography.Text strong>{t('pages.system.siteSettings.loginLeftPreview')}</Typography.Text>
                      <ThemedSegmented
                        size="small"
                        value={loginPreviewLocale}
                        onChange={(value) => setLoginPreviewLocale(value as 'zh-CN' | 'en-US')}
                        options={[
                          { label: t('common.languages.zhCN'), value: 'zh-CN' },
                          { label: t('common.languages.enUS'), value: 'en-US' },
                        ]}
                      />
                    </div>
                    <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                      {t('pages.system.siteSettings.loginLeftPreviewHint')}
                    </Typography.Text>
                    <div className="login-page-editor-split-preview-body">
                      <LoginLeftColumnPreview
                        variant="editor-fill"
                        themeColor={loginThemeColorValue || '#1890ff'}
                        locale={loginPreviewLocale}
                        platformName={
                          loginPreviewLocale === 'en-US' ? platformNameEnValue : platformNameValue
                        }
                        loginTitle={
                          loginPreviewLocale === 'en-US' ? loginTitleEnValue : loginTitleValue
                        }
                        loginContent={
                          loginPreviewLocale === 'en-US' ? loginContentEnValue : loginContentValue
                        }
                        logoUrl={useCustomLoginLogo ? loginLogoUrl : logoUrl}
                        decorationUrl={decorationLayerEnabled ? decorationImageUrl : undefined}
                        backgroundUrl={backgroundLayerEnabled ? backgroundImageUrl : undefined}
                        decorationEnabled={decorationLayerEnabled}
                        backgroundEnabled={backgroundLayerEnabled}
                      />
                    </div>
                  </>
                }
                settings={
                  <div className="login-page-editor-split-settings-stack">
                    <LoginDomainSettingsBlock tenantPathAccessUrl={tenantPathAccessUrl} />
                    <LoginLogoSettingsBlock
                      useCustomLoginLogo={useCustomLoginLogo}
                      onEnableCustomLoginLogo={() => setUseCustomLoginLogo(true)}
                      onDisableCustomLoginLogo={handleDisableCustomLoginLogo}
                      loginLogoUrl={loginLogoUrl}
                      loginLogoFileList={loginLogoFileList}
                      onLoginLogoUpload={handleLoginLogoUpload}
                      onClearLoginLogo={handleClearLoginLogo}
                      hasLoginLogoValue={
                        Boolean(loginLogoUrl || String(loginLogoValue || '').trim())
                      }
                    />
                    <LoginLocaleSettingsFields
                      key={loginPreviewLocale}
                      locale={loginPreviewLocale}
                      variant="site"
                    />
                    <LoginDecorationSettingsBlock
                      variant="site"
                      onAtLeastOneRequired={warnLoginVisualLayerAtLeastOne}
                      decorationUrl={decorationImageUrl}
                      decorationFileList={decorationFileList}
                      onDecorationUpload={handleDecorationUpload}
                      onClearDecoration={handleClearDecorationImage}
                      hasDecorationValue={
                        Boolean(decorationImageUrl || String(loginDecorationValue || '').trim())
                      }
                    />
                    <LoginBackgroundSettingsBlock
                      variant="site"
                      onAtLeastOneRequired={warnLoginVisualLayerAtLeastOne}
                      backgroundUrl={backgroundImageUrl}
                      backgroundFileList={backgroundFileList}
                      onBackgroundUpload={handleBackgroundUpload}
                      onClearBackground={handleClearBackgroundImage}
                      hasBackgroundValue={
                        Boolean(backgroundImageUrl || String(loginBackgroundValue || '').trim())
                      }
                    />
                    <Form.Item
                      name="login_theme_color"
                      label={t('pages.system.siteSettings.loginPageThemeColor')}
                      getValueFromEvent={(c: any) => (typeof c?.toHexString === 'function' ? c.toHexString() : c)}
                    >
                      <ColorPicker showText />
                    </Form.Item>
                  </div>
                }
              />
            </Col>
            <Col span={24}>
              <LoginFeatureSwitchesBlock />
            </Col>
          </Row>
        </Card>
      </Col>
    </Row>
  );

  const loginPageSettingsWithActions = (
    <>
      {loginPageSettingsContent}
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-start' }}>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadSiteSetting}
            loading={loading}
          >
            {t('pages.system.siteSettings.refresh')}
          </Button>
          <Button
            onClick={handleResetLoginPageSettings}
            loading={saving}
          >
            {t('components.uniQuery.reset')}
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
          >
            {t('pages.system.siteSettings.save')}
          </Button>
        </Space>
      </div>
    </>
  );

  const branchOrgColumns = [
    {
      title: t('pages.system.siteSettings.branchOrgColumnName'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('pages.system.siteSettings.branchOrgColumnDomain'),
      dataIndex: 'domain',
      key: 'domain',
    },
    {
      title: t('pages.system.siteSettings.branchOrgColumnStatus'),
      dataIndex: 'status',
      key: 'status',
      render: (value: string) => {
        const color = value === TenantStatus.ACTIVE ? 'success' : value === TenantStatus.SUSPENDED ? 'error' : 'default';
        const labelMap: Record<string, string> = {
          [TenantStatus.ACTIVE]: t('pages.infra.tenant.statusActive'),
          [TenantStatus.INACTIVE]: t('pages.infra.tenant.statusInactive'),
          [TenantStatus.EXPIRED]: t('pages.infra.tenant.statusExpired'),
          [TenantStatus.SUSPENDED]: t('pages.infra.tenant.statusSuspended'),
        };
        return <Tag color={color}>{labelMap[value] || value}</Tag>;
      },
    },
    {
      title: t('pages.system.siteSettings.branchOrgColumnPlan'),
      dataIndex: 'plan',
      key: 'plan',
      render: (value: string) => {
        const color = value === TenantPlan.ENTERPRISE ? 'gold' : value === TenantPlan.PROFESSIONAL ? 'purple' : 'blue';
        const labelMap: Record<string, string> = {
          [TenantPlan.TRIAL]: t('pages.infra.tenant.planTrial'),
          [TenantPlan.BASIC]: t('pages.infra.tenant.planBasic'),
          [TenantPlan.PROFESSIONAL]: t('pages.infra.tenant.planProfessional'),
          [TenantPlan.ENTERPRISE]: t('pages.infra.tenant.planEnterprise'),
        };
        return <Tag color={color}>{labelMap[value] || value}</Tag>;
      },
    },
    {
      title: t('pages.system.siteSettings.branchOrgColumnQuota'),
      key: 'quota',
      render: (_: unknown, record: BranchOrganizationItem) => `${record.user_count || 0}/${record.max_users}`,
    },
    {
      title: t('pages.system.siteSettings.branchOrgColumnCreatedAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      render: (value: string) => formatDateTimeBySiteSetting(value),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 100,
      render: (_: unknown, record: BranchOrganizationItem) => (
        <Button type="link" size="small" onClick={() => openEditBranchOrgModal(record)}>
          {t('common.edit')}
        </Button>
      ),
    },
  ];

  const branchOrganizationsTabContent = (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space size={12}>
          <span>{t('pages.system.siteSettings.branchOrgTitle')}</span>
          <Typography.Text type="secondary">
            {t('pages.system.siteSettings.branchOrgHint')}
          </Typography.Text>
        </Space>
        <Space>
          <Button onClick={() => loadBranchOrganizations(branchOrgPage, branchOrgPageSize)} loading={branchOrgLoading}>
            {t('pages.system.siteSettings.refresh')}
          </Button>
          {branchOrgCapability?.can_create_branch_organization && (
            <Button type="primary" onClick={openCreateBranchOrgModal}>
              {t('pages.system.siteSettings.branchOrgCreateButton')}
            </Button>
          )}
        </Space>
      </div>
      <Table<BranchOrganizationItem>
        rowKey="id"
        loading={branchOrgLoading}
        columns={branchOrgColumns}
        dataSource={branchOrgList}
        pagination={{
          current: branchOrgPage,
          pageSize: branchOrgPageSize,
          total: branchOrgTotal,
          showSizeChanger: true,
          onChange: (page, pageSize) => loadBranchOrganizations(page, pageSize),
        }}
      />
    </Space>
  );

  const tenantInitTabContent = <TenantInitDataPanel />;
  const showBranchOrganizationsTab = !!branchOrgCapability && !branchOrgCapability.is_branch_organization;
  const showLoginPageTab = !branchOrgCapability?.is_branch_organization;

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={formInitialValues}
    >
      <MultiTabListPageTemplate
        activeTabKey={activeTabKey}
        onTabChange={setActiveTabKey}
        tabs={[
          { key: 'basic', label: (<Space><InfoCircleOutlined /><span>{t('pages.system.siteSettings.tabBasic')}</span></Space>), children: basicInfoWithActions },
          ...(showLoginPageTab
            ? [{ key: 'login-page', label: (<Space><GlobalOutlined /><span>{t('pages.system.siteSettings.tabLoginPage')}</span></Space>), children: loginPageSettingsWithActions }]
            : []),
          { key: 'system', label: (<Space><SettingOutlined /><span>{t('pages.system.siteSettings.tabSystem')}</span></Space>), children: systemSettingsWithActions },
          { key: 'integrations', label: (<Space><LinkOutlined /><span>{t('pages.system.siteSettings.tabIntegrations')}</span></Space>), children: integrationsSettingsWithActions },
          ...(showBranchOrganizationsTab
            ? [{ key: 'branch-organizations', label: (<Space><ApartmentOutlined /><span>{t('pages.system.siteSettings.tabBranchOrganizations')}</span></Space>), children: branchOrganizationsTabContent }]
            : []),
          { key: 'init-data', label: (<Space><CloudDownloadOutlined /><span>{t('pages.system.siteSettings.tabInitData')}</span></Space>), children: tenantInitTabContent },
        ]}
      />

      {/* 图片剪裁弹窗 */}
      <ImageCropper
        open={cropModalVisible}
        title={t('pages.system.siteSettings.cropTitle')}
        image={selectedImageFile}
        defaultShape="rect"
        onCancel={handleCropCancel}
        onConfirm={handleCropConfirm}
      />
      <Modal
        title={
          branchOrgModalMode === 'edit'
            ? t('pages.system.siteSettings.branchOrgEditModalTitle')
            : t('pages.system.siteSettings.branchOrgCreateModalTitle')
        }
        open={branchOrgModalOpen}
        onCancel={closeBranchOrgModal}
        onOk={handleBranchOrgModalOk}
        okButtonProps={{ loading: creatingBranchOrg || updatingBranchOrg }}
        destroyOnClose
      >
        <Form form={branchOrgForm} layout="vertical">
          <Form.Item name="name" label={t('pages.system.siteSettings.branchOrgNameLabel')} rules={[{ required: true, message: t('pages.system.siteSettings.branchOrgNameRequired') }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="domain"
            label={t('pages.system.siteSettings.branchOrgDomainLabel')}
            rules={[
              { required: true, message: t('pages.system.siteSettings.branchOrgDomainRequired') },
              { pattern: /^[a-z0-9-]+$/, message: t('pages.system.siteSettings.branchOrgDomainPattern') },
            ]}
          >
            <Input />
          </Form.Item>
          {branchOrgModalMode === 'edit' && (
            <Form.Item
              name="status"
              label={t('pages.system.siteSettings.branchOrgStatusLabel')}
              rules={[{ required: true, message: t('pages.system.siteSettings.branchOrgStatusRequired') }]}
            >
              <Select
                options={[
                  { label: t('pages.infra.tenant.statusActive'), value: TenantStatus.ACTIVE },
                  { label: t('pages.infra.tenant.statusInactive'), value: TenantStatus.INACTIVE },
                  { label: t('pages.infra.tenant.statusExpired'), value: TenantStatus.EXPIRED },
                  { label: t('pages.infra.tenant.statusSuspended'), value: TenantStatus.SUSPENDED },
                ]}
              />
            </Form.Item>
          )}
          {branchOrgModalMode === 'create' && (
            <>
              <Form.Item label={t('pages.system.siteSettings.branchOrgAdminDefaultLabel')}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Typography.Text type="secondary">
                    {t('pages.system.siteSettings.branchOrgAdminDefaultHint')}
                  </Typography.Text>
                  {!useNewBranchAdmin && (
                    <Button onClick={() => setUseNewBranchAdmin(true)}>{t('pages.system.siteSettings.branchOrgAddAdminButton')}</Button>
                  )}
                </Space>
              </Form.Item>
              {useNewBranchAdmin && (
                <>
                  <Form.Item name="admin_username" label={t('pages.system.siteSettings.branchOrgAdminUsernameLabel')} rules={[{ required: true, message: t('pages.system.siteSettings.branchOrgAdminUsernameRequired') }]}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="admin_password" label={t('pages.system.siteSettings.branchOrgAdminPasswordLabel')} rules={[{ required: true, message: t('pages.system.siteSettings.branchOrgAdminPasswordRequired') }, { min: 8, message: t('pages.system.siteSettings.branchOrgAdminPasswordMin') }]}>
                    <Input.Password />
                  </Form.Item>
                  <Form.Item name="admin_full_name" label={t('pages.system.siteSettings.branchOrgAdminFullNameLabel')}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="admin_phone" label={t('pages.system.siteSettings.branchOrgAdminPhoneLabel')} rules={[{ pattern: /^$|^1[3-9]\d{9}$/, message: t('pages.system.siteSettings.branchOrgAdminPhonePattern') }]}>
                    <Input />
                  </Form.Item>
                </>
              )}
            </>
          )}
        </Form>
      </Modal>
    </Form>
  );
};

export default SiteSettingsPage;
