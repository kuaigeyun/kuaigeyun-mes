/**
 * 站点设置页面
 *
 * 用于系统管理员配置组织内的站点设置。
 * 支持站点基本信息、Logo、邀请注册开关等配置。
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Form, Input, Switch, Button, Upload, Space, Select, Row, Col, InputNumber, Card, ColorPicker } from 'antd';
import { SaveOutlined, ReloadOutlined, UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import { MultiTabListPageTemplate } from '../../../components/layout-templates';
import type { UploadFile, UploadProps } from 'antd';
import {
  getSiteSetting,
  updateSiteSetting,
} from '../../../services/siteSetting';
import { useConfigStore } from '../../../stores/configStore';
import { useThemeStore } from '../../../stores/themeStore';
import { uploadFile, getFilePreview, FileUploadResponse } from '../../../services/file';
import { 
  getDataDictionaryByCode, 
  getDictionaryItemList, 
  DictionaryItem 
} from '../../../services/dataDictionary';
import { getLanguageList } from '../../../services/language';
import ImageCropper from '../../../components/image-cropper';

/**
 * 站点设置页面组件
 */
const SiteSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const fetchConfigs = useConfigStore((s) => s.fetchConfigs);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoFileList, setLogoFileList] = useState<UploadFile[]>([]);
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);
  const [cropModalVisible, setCropModalVisible] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [activeTabKey, setActiveTabKey] = useState('basic');
  const [currencyOptions, setCurrencyOptions] = useState<DictionaryItem[]>([]);
  const systemSettingsRef = React.useRef<Record<string, any>>({});
  const [timezoneOptions, setTimezoneOptions] = useState<DictionaryItem[]>([]);

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
      try {
        const previewInfo = await getFilePreview(logoValue.trim());
        setLogoUrl(previewInfo.preview_url);
        setLogoFileList([{
          uid: logoValue.trim(),
          name: t('pages.system.siteSettings.siteLogo'),
          status: 'done',
          url: previewInfo.preview_url,
        }]);
      } catch (error) {
        console.error('获取LOGO预览URL失败:', error);
        setLogoUrl(undefined);
        setLogoFileList([]);
      }
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

  // 语言选项
  const [languageOptions, setLanguageOptions] = useState<any[]>([]);

  /**
   * 加载站点设置和字典数据
   */
  useEffect(() => {
    loadSiteSetting();
    loadDictionaryData();
  }, []);

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
             key: lang.uuid
          }));
          setLanguageOptions(options);
        }
      } catch (e) {
        console.warn('加载语言列表失败', e);
      }

      // 加载货币字典
      try {
        const currencyDict = await getDataDictionaryByCode('CURRENCY');
        if (currencyDict && currencyDict.uuid) {
          const items = await getDictionaryItemList(currencyDict.uuid, true);
          setCurrencyOptions(items);
        }
      } catch (e) {
        console.warn('加载货币字典失败', e);
      }

      // 加载时区字典
      try {
        const timezoneDict = await getDataDictionaryByCode('TIMEZONE');
        if (timezoneDict && timezoneDict.uuid) {
          const items = await getDictionaryItemList(timezoneDict.uuid, true);
          setTimezoneOptions(items);
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

  const loadSiteSetting = async () => {
    try {
      setLoading(true);
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
      
      form.setFieldsValue({
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
        theme_borderRadius: themeConfig.borderRadius || 6,
        theme_fontSize: themeConfig.fontSize || 14,
        theme_compact: themeConfig.compact || false,
        enable_invitation: setting.settings?.enable_invitation !== false,
        enable_register: setting.settings?.enable_register !== false,
        copyright: setting.settings?.copyright || '',
        description: setting.settings?.description || '',
        // 系统设置
        'security.token_check_interval': setting.settings?.security?.token_check_interval ?? 60,
        'security.inactivity_timeout': setting.settings?.security?.inactivity_timeout ?? 1800,
        'security.user_cache_time': setting.settings?.security?.user_cache_time ?? 300,
        'ui.max_tabs': setting.settings?.ui?.max_tabs ?? 20,
        'ui.default_page_size': setting.settings?.ui?.default_page_size ?? 20,
        'ui.table_loading_delay': setting.settings?.ui?.table_loading_delay ?? 800,
        'theme_config.colorPrimary': setting.settings?.theme_config?.colorPrimary ?? normalizedThemeColor ?? '#1890ff',
        'network.timeout': setting.settings?.network?.timeout ?? 10000,
        'system.max_retries': setting.settings?.system?.max_retries ?? 3,
      });

      systemSettingsRef.current = {
        'security.token_check_interval': setting.settings?.security?.token_check_interval ?? 60,
        'security.inactivity_timeout': setting.settings?.security?.inactivity_timeout ?? 1800,
        'security.user_cache_time': setting.settings?.security?.user_cache_time ?? 300,
        'ui.max_tabs': setting.settings?.ui?.max_tabs ?? 20,
        'ui.default_page_size': setting.settings?.ui?.default_page_size ?? 20,
        'ui.table_loading_delay': setting.settings?.ui?.table_loading_delay ?? 800,
        'theme_config.colorPrimary': setting.settings?.theme_config?.colorPrimary ?? normalizedThemeColor ?? '#1890ff',
        'network.timeout': setting.settings?.network?.timeout ?? 10000,
        'system.max_retries': setting.settings?.system?.max_retries ?? 3,
      };

      // 加载LOGO预览
      await loadLogoPreview(siteLogoValue);
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
        // 更新表单中的site_logo字段（保存UUID）
        form.setFieldsValue({
          site_logo: response.uuid,
        });
        
        // 获取服务器预览URL
        let previewUrl: string | undefined = undefined;
        try {
          const previewInfo = await getFilePreview(response.uuid);
          previewUrl = previewInfo.preview_url;
          // 释放本地预览URL
          URL.revokeObjectURL(localPreviewUrl);
          // 使用服务器预览URL
          setLogoUrl(previewUrl);
        } catch (error) {
          // 如果获取预览URL失败，继续使用本地预览URL
          console.error('获取LOGO预览URL失败:', error);
        }
        
        // 更新LOGO文件列表
        setLogoFileList([{
          uid: response.uuid,
          name: response.original_name,
          status: 'done',
          url: previewUrl || localPreviewUrl,
        }]);
        
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
      setLogoUrl(undefined);
      setLogoFileList([]);
      form.setFieldsValue({
        site_logo: '',
      });
      await updateSiteSetting({ settings: { site_logo: '' } });
      messageApi.success(t('pages.system.siteSettings.logoClearSuccess'));
      useThemeStore.getState().initFromApi();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.siteSettings.logoClearFailed'));
    } finally {
      setSaving(false);
    }
  };

  /**
   * 处理保存
   */
  const handleSave = async () => {
    try {
      setSaving(true);
      const values = await form.validateFields();
      const allValues = { ...systemSettingsRef.current, ...values };

      const settings: Record<string, any> = {
        site_name: values.site_name,
        site_logo: values.site_logo,
        organization_name: values.organization_name,
        organization_address: values.organization_address,
        contact_info: values.contact_info,
        default_currency: values.default_currency,
        date_format: values.date_format,
        default_language: values.default_language,
        timezone: values.timezone,
        enable_invitation: values.enable_invitation,
        enable_register: values.enable_register,
        copyright: values.copyright,
        description: values.description,
      };

      // 系统设置
      const sys = allValues;
      if (sys['security.token_check_interval'] !== undefined) {
        settings.security = {
          ...(settings.security || {}),
          token_check_interval: sys['security.token_check_interval'],
          inactivity_timeout: sys['security.inactivity_timeout'],
          user_cache_time: sys['security.user_cache_time'],
        };
      }
      if (sys['ui.max_tabs'] !== undefined) {
        settings.ui = {
          ...(settings.ui || {}),
          max_tabs: sys['ui.max_tabs'],
          default_page_size: sys['ui.default_page_size'],
          table_loading_delay: sys['ui.table_loading_delay'],
        };
      }
      if (sys['theme_config.colorPrimary'] !== undefined) {
        settings.theme_config = { ...(settings.theme_config || {}), colorPrimary: sys['theme_config.colorPrimary'] };
      }
      if (sys['network.timeout'] !== undefined) {
        settings.network = { ...(settings.network || {}), timeout: sys['network.timeout'] };
      }
      if (sys['system.max_retries'] !== undefined) {
        settings.system = { ...(settings.system || {}), max_retries: sys['system.max_retries'] };
      }

      await updateSiteSetting({ settings });
      messageApi.success(t('pages.system.siteSettings.saveSuccess'));

      if (settings.security || settings.ui || settings.theme_config || settings.network || settings.system) {
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

      // 刷新 configStore 使日期格式、站点名称、LOGO 等配置立即生效（BasicLayout 等从 configStore 读取）
      await fetchConfigs();
      // 重新加载设置
      await loadSiteSetting();
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.siteSettings.saveFailed'));
    } finally {
      setSaving(false);
    }
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
                    border: '1px solid #d9d9d9',
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
            {currencyOptions.map((item) => (
              <Select.Option key={item.uuid} value={item.value}>
                {item.label}
              </Select.Option>
            ))}
            {currencyOptions.length === 0 && (
              <>
                <Select.Option value="CNY">人民币 (CNY)</Select.Option>
                <Select.Option value="USD">美元 (USD)</Select.Option>
                <Select.Option value="EUR">欧元 (EUR)</Select.Option>
                <Select.Option value="JPY">日元 (JPY)</Select.Option>
                <Select.Option value="GBP">英镑 (GBP)</Select.Option>
              </>
            )}
          </Select>
        </Form.Item>
      </Col>
      <Col xs={24} sm={24} md={12} lg={12}>
        <Form.Item name="date_format" label={t('pages.system.siteSettings.dateFormat')}>
          <Select placeholder={t('pages.system.siteSettings.dateFormatPlaceholder')}>
            <Select.Option value="YYYY-MM-DD">YYYY-MM-DD</Select.Option>
            <Select.Option value="DD/MM/YYYY">DD/MM/YYYY</Select.Option>
            <Select.Option value="MM/DD/YYYY">MM/DD/YYYY</Select.Option>
            <Select.Option value="YYYY年MM月DD日">YYYY年MM月DD日</Select.Option>
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
                <Select.Option value="zh-CN">中文 (简体)</Select.Option>
                <Select.Option value="en-US">English (US)</Select.Option>
              </>
            )}
          </Select>
        </Form.Item>
      </Col>
      <Col xs={24} sm={24} md={12} lg={12}>
        <Form.Item name="timezone" label={t('pages.system.siteSettings.timezone')}>
          <Select placeholder={t('pages.system.siteSettings.timezonePlaceholder')} loading={loading} allowClear>
            {timezoneOptions.map((item) => (
              <Select.Option key={item.uuid} value={item.value}>
                {item.label}
              </Select.Option>
            ))}
            {timezoneOptions.length === 0 && (
              <>
                <Select.Option value="Asia/Shanghai">东八区 (UTC+8)</Select.Option>
                <Select.Option value="Asia/Tokyo">东京 (UTC+9)</Select.Option>
                <Select.Option value="Asia/Seoul">首尔 (UTC+9)</Select.Option>
                <Select.Option value="America/New_York">纽约 (UTC-5)</Select.Option>
                <Select.Option value="Europe/London">伦敦 (UTC+0)</Select.Option>
                <Select.Option value="Europe/Paris">巴黎 (UTC+1)</Select.Option>
              </>
            )}
          </Select>
        </Form.Item>
      </Col>
      <Col xs={24} sm={24} md={24} lg={24}>
        <Form.Item name="copyright" label={t('pages.system.siteSettings.copyright')}>
          <Input placeholder={t('pages.system.siteSettings.copyrightPlaceholder')} />
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

  const functionSettingsContent = (
    <Row gutter={[24, 16]}>
      <Col xs={24} sm={24} md={12} lg={12}>
        <Form.Item name="enable_invitation" label={t('pages.system.siteSettings.enableInvitation')} valuePropName="checked">
          <Switch />
        </Form.Item>
      </Col>
      <Col xs={24} sm={24} md={12} lg={12}>
        <Form.Item name="enable_register" label={t('pages.system.siteSettings.enableRegister')} valuePropName="checked">
          <Switch />
        </Form.Item>
      </Col>
    </Row>
  );

  const functionSettingsWithActions = (
    <>
      {functionSettingsContent}
      {actionButtons}
    </>
  );

  const systemSettingsContent = (
    <Row gutter={[24, 16]}>
      <Col xs={24}>
        <Card title={t('pages.system.configCenter.param.security_token_check_interval')} size="small" style={{ marginBottom: 16 }}>
          <Form.Item
            name="security.token_check_interval"
            label={t('pages.system.configCenter.param.security_token_check_interval')}
            tooltip={t('pages.system.configCenter.param.security_token_check_interval_desc')}
          >
            <InputNumber min={10} max={300} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="security.inactivity_timeout"
            label={t('pages.system.configCenter.param.security_inactivity_timeout')}
            tooltip={t('pages.system.configCenter.param.security_inactivity_timeout_desc')}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="security.user_cache_time"
            label={t('pages.system.configCenter.param.security_user_cache_time')}
            tooltip={t('pages.system.configCenter.param.security_user_cache_time_desc')}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Card>
        <Card title={t('pages.system.configCenter.param.ui_max_tabs')} size="small" style={{ marginBottom: 16 }}>
          <Form.Item
            name="ui.max_tabs"
            label={t('pages.system.configCenter.param.ui_max_tabs')}
            tooltip={t('pages.system.configCenter.param.ui_max_tabs_desc')}
          >
            <InputNumber min={5} max={50} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="ui.default_page_size"
            label={t('pages.system.configCenter.param.ui_default_page_size')}
            tooltip={t('pages.system.configCenter.param.ui_default_page_size_desc')}
          >
            <InputNumber min={5} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="ui.table_loading_delay"
            label={t('pages.system.configCenter.param.ui_table_loading_delay')}
            tooltip={t('pages.system.configCenter.param.ui_table_loading_delay_desc')}
          >
            <InputNumber min={0} max={1000} style={{ width: '100%' }} />
          </Form.Item>
        </Card>
        <Card title={t('pages.system.configCenter.param.theme_config_colorPrimary')} size="small" style={{ marginBottom: 16 }}>
          <Form.Item
            name="theme_config.colorPrimary"
            label={t('pages.system.configCenter.param.theme_config_colorPrimary')}
            tooltip={t('pages.system.configCenter.param.theme_config_colorPrimary_desc')}
            getValueFromEvent={(c: any) => (typeof c?.toHexString === 'function' ? c.toHexString() : c)}
          >
            <ColorPicker showText />
          </Form.Item>
        </Card>
        <Card title={t('pages.system.configCenter.param.network_timeout')} size="small" style={{ marginBottom: 16 }}>
          <Form.Item
            name="network.timeout"
            label={t('pages.system.configCenter.param.network_timeout')}
            tooltip={t('pages.system.configCenter.param.network_timeout_desc')}
          >
            <InputNumber min={1000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="system.max_retries"
            label={t('pages.system.configCenter.param.system_max_retries')}
            tooltip={t('pages.system.configCenter.param.system_max_retries_desc')}
          >
            <InputNumber min={0} max={5} style={{ width: '100%' }} />
          </Form.Item>
        </Card>
      </Col>
    </Row>
  );

  const systemSettingsWithActions = (
    <>
      {systemSettingsContent}
      {actionButtons}
    </>
  );

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        default_currency: 'CNY',
        date_format: 'YYYY-MM-DD',
        default_language: 'zh-CN',
        timezone: 'Asia/Shanghai',
        enable_invitation: true,
        enable_register: true,
      }}
    >
      <MultiTabListPageTemplate
        activeTabKey={activeTabKey}
        onTabChange={setActiveTabKey}
        tabs={[
          { key: 'basic', label: t('pages.system.siteSettings.tabBasic'), children: basicInfoWithActions },
          { key: 'function', label: t('pages.system.siteSettings.tabFunction'), children: functionSettingsWithActions },
          { key: 'system', label: t('pages.system.siteSettings.tabSystem'), children: systemSettingsWithActions },
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
    </Form>
  );
};

export default SiteSettingsPage;

