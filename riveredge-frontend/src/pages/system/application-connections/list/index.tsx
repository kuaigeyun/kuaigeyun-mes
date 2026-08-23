/**
 * 应用连接器管理列表页面
 *
 * 用于系统管理员查看和管理组织内的应用连接器（飞书、钉钉、ERP、PLM、CRM 等）。
 */

import React, { useRef, useState, useMemo } from 'react';
import { rowActionKind, rowActionTestConnection } from '../../../../components/uni-action';
import { useTranslation } from 'react-i18next';
import {
  ActionType,
  ProColumns,
  ProFormText,
  ProFormTextArea,
  ProFormSwitch,
  ProFormSelect,
  ProFormDependency,
  ProFormInstance,
} from '@ant-design/pro-components';
import {
  App,
  Popconfirm,
  Space,
  Badge,
  Typography,
  Alert,
  Button,
} from 'antd';
import { MarkerTag } from '../../../../constants/statusBadges';
import { alignProColumns, GLOBAL_DOC_LIST_FIELD_RANK } from '../../../../apps/kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { renderSystemActiveTag, renderSystemTypeMarker } from '../../utils/systemListPresentation';
import {
  DeleteOutlined,
  ApiOutlined,
  EditOutlined,
  AppstoreOutlined,
  MessageOutlined,
  CloudOutlined,
  DatabaseOutlined,
  TeamOutlined,
  RocketOutlined,
  InteractionOutlined,
  ApartmentOutlined,
  SyncOutlined,
  EnvironmentOutlined,
  CarOutlined,
} from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import {
  DetailDrawerActions,
  ListPageTemplate,
  FormModalTemplate,
  FormModalGridBlock,
  MODAL_CONFIG,
} from '../../../../components/layout-templates';
import { SystemMasterDetailDrawer } from '../../shared/systemMasterDetailDrawer';
import { getApiErrorMessage } from '../../../../utils/errorHandler';
import AppConnectorMarket from '../AppConnectorMarket';
import type { AppConnectorDefinition } from '../connectors';
import { isLlmConnectionType } from '../connectors';
import {
  getApplicationConnectionList,
  getApplicationConnectionListAll,
  getApplicationConnectionByUuid,
  createApplicationConnection,
  updateApplicationConnection,
  deleteApplicationConnection,
  testApplicationConnection,
  testApplicationConnectionConfig,
  syncApplicationConnectionContacts,
  ApplicationConnection,
} from '../../../../services/applicationConnection';
import {
  buildFactoryImportTemplate,
  resolveFactoryImportHeaderIndexMap,
} from '../../../../utils/spreadsheetImportTemplate';
import { downloadRecordsAsXlsx } from '../../../../utils/exportRecordsXlsx';
import { mergeListKeyword } from '../../../../utils/tableQueryKey';
import { useResourcePermissions } from '../../../../hooks/useResourcePermissions';
import { todaySiteDateString } from '../../../../utils/format';
import { buildListPageHelpViewConfig } from '../../../../components/page-help-wiki';

const TYPE_COLORS: Record<string, { color: string; icon: React.ReactNode }> = {
  feishu: { color: 'blue', icon: <MessageOutlined /> },
  dingtalk: { color: 'cyan', icon: <MessageOutlined /> },
  wecom: { color: 'green', icon: <MessageOutlined /> },
  kingdee_galaxy: { color: 'orange', icon: <CloudOutlined /> },
  kingdee_xingchen: { color: 'orange', icon: <CloudOutlined /> },
  kingdee_kis_cloud: { color: 'orange', icon: <CloudOutlined /> },
  kingdee_kis: { color: 'cyan', icon: <CloudOutlined /> },
  yonyou_yonbip: { color: 'purple', icon: <CloudOutlined /> },
  yonyou_u8: { color: 'purple', icon: <CloudOutlined /> },
  yonyou_u9: { color: 'purple', icon: <CloudOutlined /> },
  yonyou_nc: { color: 'purple', icon: <CloudOutlined /> },
  sap_s4hana: { color: 'gold', icon: <DatabaseOutlined /> },
  sap_b1: { color: 'gold', icon: <DatabaseOutlined /> },
  oracle_netsuite: { color: 'blue', icon: <CloudOutlined /> },
  odoo: { color: 'purple', icon: <CloudOutlined /> },
  inspur_gs: { color: 'cyan', icon: <CloudOutlined /> },
  inspur_ps: { color: 'cyan', icon: <CloudOutlined /> },
  digiwin_t100: { color: 'magenta', icon: <DatabaseOutlined /> },
  digiwin_yifei: { color: 'magenta', icon: <DatabaseOutlined /> },
  digiwin_yizhu: { color: 'magenta', icon: <DatabaseOutlined /> },
  digiwin_yituo: { color: 'magenta', icon: <DatabaseOutlined /> },
  digiwin_e10: { color: 'blue', icon: <DatabaseOutlined /> },
  chanjet_tplus: { color: 'blue', icon: <CloudOutlined /> },
  grasp_huihuang: { color: 'orange', icon: <DatabaseOutlined /> },
  super_erp: { color: 'magenta', icon: <DatabaseOutlined /> },
  erpnext: { color: 'blue', icon: <CloudOutlined /> },
  sunlike_erp: { color: 'cyan', icon: <DatabaseOutlined /> },
  teamcenter: { color: 'blue', icon: <AppstoreOutlined /> },
  windchill: { color: 'geekblue', icon: <AppstoreOutlined /> },
  caxa: { color: 'blue', icon: <AppstoreOutlined /> },
  sanpin_plm: { color: 'cyan', icon: <AppstoreOutlined /> },
  sunlike_plm: { color: 'geekblue', icon: <AppstoreOutlined /> },
  sipm: { color: 'cyan', icon: <AppstoreOutlined /> },
  inteplm: { color: 'geekblue', icon: <AppstoreOutlined /> },
  salesforce: { color: 'cyan', icon: <TeamOutlined /> },
  xiaoshouyi: { color: 'green', icon: <TeamOutlined /> },
  fenxiang: { color: 'orange', icon: <TeamOutlined /> },
  qidian: { color: 'blue', icon: <TeamOutlined /> },
  supra_crm: { color: 'volcano', icon: <TeamOutlined /> },
  weaver: { color: 'purple', icon: <ApartmentOutlined /> },
  seeyon: { color: 'geekblue', icon: <ApartmentOutlined /> },
  landray: { color: 'cyan', icon: <ApartmentOutlined /> },
  cloudhub: { color: 'blue', icon: <ApartmentOutlined /> },
  tongda_oa: { color: 'purple', icon: <ApartmentOutlined /> },
  rootcloud: { color: 'blue', icon: <RocketOutlined /> },
  casicloud: { color: 'cyan', icon: <InteractionOutlined /> },
  alicloud_iot: { color: 'orange', icon: <CloudOutlined /> },
  huaweicloud_iot: { color: 'red', icon: <CloudOutlined /> },
  thingsboard: { color: 'green', icon: <RocketOutlined /> },
  jetlinks: { color: 'blue', icon: <RocketOutlined /> },
  flux_wms: { color: 'gold', icon: <DatabaseOutlined /> },
  kejian_wms: { color: 'orange', icon: <CloudOutlined /> },
  digiwin_wms: { color: 'cyan', icon: <DatabaseOutlined /> },
  openwms: { color: 'green', icon: <DatabaseOutlined /> },
  alicloud_oss: { color: 'orange', icon: <CloudOutlined /> },
  tencent_cos: { color: 'blue', icon: <CloudOutlined /> },
  huaweicloud_obs: { color: 'red', icon: <CloudOutlined /> },
  aws_s3: { color: 'gold', icon: <CloudOutlined /> },
  minio: { color: 'geekblue', icon: <DatabaseOutlined /> },
  qiniu_kodo: { color: 'cyan', icon: <CloudOutlined /> },
  nas_webdav: { color: 'purple', icon: <DatabaseOutlined /> },
  nas_smb: { color: 'magenta', icon: <DatabaseOutlined /> },
  deepseek: { color: 'blue', icon: <RocketOutlined /> },
  openai: { color: 'green', icon: <RocketOutlined /> },
  qwen: { color: 'orange', icon: <RocketOutlined /> },
  zhipu: { color: 'purple', icon: <RocketOutlined /> },
  moonshot: { color: 'cyan', icon: <RocketOutlined /> },
  siliconflow: { color: 'geekblue', icon: <RocketOutlined /> },
  amap: { color: 'green', icon: <EnvironmentOutlined /> },
  kuaidi100: { color: 'orange', icon: <CarOutlined /> },
  kdniao: { color: 'cyan', icon: <CarOutlined /> },
  aliyun_market: { color: 'orange', icon: <CloudOutlined /> },
  tencent_market: { color: 'blue', icon: <CloudOutlined /> },
};


const SENSITIVE_KEYS = [
  'password',
  'token',
  'app_secret',
  'client_secret',
  'corp_secret',
  'encoding_aes_key',
  'security_token',
  'aes_key',
  'access_key_secret',
  'secret_access_key',
  'secret_key',
  'api_key',
  'api_secret',
  'rest_key',
  'security_code',
  'js_key',
  'app_code',
];

const ApplicationConnectionsListPage: React.FC = () => {
  const { t, i18n } = useTranslation();

  const getConnectionStatus = (
    conn: ApplicationConnection
  ): { status: 'success' | 'error' | 'warning' | 'default'; text: string } => {
    if (!conn.is_active) return { status: 'default', text: t('pages.system.applicationConnections.statusDisabled') };
    if (conn.is_connected) return { status: 'success', text: t('pages.system.applicationConnections.statusConnected') };
    if (conn.last_error) return { status: 'error', text: t('pages.system.applicationConnections.statusFailed') };
    return { status: 'warning', text: t('pages.system.applicationConnections.statusDisconnected') };
  };

  const getTypeInfo = (type: string): { color: string; text: string; icon: React.ReactNode } => {
    const tc = type ? `type${type.charAt(0).toUpperCase()}${type.slice(1)}` : '';
    const key = tc ? `pages.system.applicationConnections.${tc}` : '';
    let text = key ? t(key) : type;
    if (key && text === key) text = type;
    const info = TYPE_COLORS[type] || { color: 'default', icon: <AppstoreOutlined /> };
    return { ...info, text: text || type };
  };
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentUuid, setCurrentUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | undefined>(undefined);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<ApplicationConnection | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRetryUuidRef = useRef<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [syncingContactsUuid, setSyncingContactsUuid] = useState<string | null>(null);
  const [allConnections, setAllConnections] = useState<ApplicationConnection[]>([]);
  const [connectorMarketVisible, setConnectorMarketVisible] = useState(false);
  const [connectorMarketInitialCategory, setConnectorMarketInitialCategory] = useState('all');
  const connectionPerms = useResourcePermissions('system:application-connection');
  const canSyncContacts = !connectionPerms.enabled || !!connectionPerms.canAction?.('execute');
  const formRef = useRef<ProFormInstance>(null);

  const applicationConnectionImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          { field: 'name', required: true, labelKey: 'common.name' },
          { field: 'code', required: true, labelKey: 'common.code' },
          { field: 'type', required: true, labelKey: 'pages.system.applicationConnections.importHeaderType' },
          {
            field: 'description',
            labelKey: 'common.remark',
            aliases: ['备注', '描述'],
          },
          {
            field: 'isActive',
            labelKey: 'pages.system.applicationConnections.importHeaderActive',
            aliases: ['启用状态'],
          },
          {
            field: 'configJson',
            labelKey: 'pages.system.applicationConnections.importHeaderConfigJson',
            aliases: ['连接配置(JSON)'],
          },
        ],
        [
          t('pages.system.applicationConnections.importExampleName'),
          'example_conn',
          'feishu',
          t('pages.system.applicationConnections.importExampleDescription'),
          t('common.yes'),
          '{}',
        ],
      ),
    [t, i18n.language],
  );

  const handleCreate = () => {
    setIsEdit(false);
    setCurrentUuid(null);
    setConnectorMarketInitialCategory('all');
    setConnectorMarketVisible(true);
  };

  const handleConnectorSelect = (connector: AppConnectorDefinition) => {
    const defaults = { ...(connector.defaultConfig || {}) };
    delete defaults.enabled;
    const modelHint = String(defaults.model || 'default')
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .slice(0, 24);
    const suggestedCode = isLlmConnectionType(connector.type)
      ? `${connector.type}_${modelHint}`.slice(0, 50)
      : undefined;
    setFormInitialValues({
      type: connector.type,
      is_active: true,
      ...(isLlmConnectionType(connector.type)
        ? {
            name: `${connector.name} ${defaults.model || ''}`.trim(),
            code: suggestedCode,
          }
        : {}),
      ...defaults,
    });
    setModalVisible(true);
  };

  const handleEdit = async (record: ApplicationConnection) => {
    try {
      setIsEdit(true);
      setCurrentUuid(record.uuid);
      const detail = await getApplicationConnectionByUuid(record.uuid);
      const config = { ...(detail.config || {}) };
      delete config.api_key_configured;
      if (config.api_key === '****') {
        config.api_key = '';
      }
      for (const key of ['rest_key', 'security_code', 'js_key', 'app_code'] as const) {
        if (config[key] === '****') {
          config[key] = '';
        }
      }
      setFormInitialValues({
        name: detail.name,
        code: detail.code,
        description: detail.description,
        type: detail.type,
        is_active: detail.is_active,
        ...config,
      });
      setModalVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.applicationConnections.getDetailFailed'));
    }
  };

  const loadDetail = async (uuid: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const detail = await getApplicationConnectionByUuid(uuid);
      setDetailData(detail);
    } catch (error) {
      setDetailData(null);
      setDetailError(getApiErrorMessage(error, t('pages.system.applicationConnections.getDetailFailed')));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleView = async (record: ApplicationConnection) => {
    detailRetryUuidRef.current = record.uuid;
    setDrawerVisible(true);
    setDetailData(null);
    setDetailError(null);
    void loadDetail(record.uuid);
  };

  const handleBatchStatus = async (enable: boolean) => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('pages.system.applicationConnections.selectToOperate'));
      return;
    }
    try {
      let done = 0;
      for (const uuid of selectedRowKeys) {
        await updateApplicationConnection(String(uuid), { is_active: enable });
        done++;
      }
      messageApi.success(t('pages.system.applicationConnections.batchStatusSuccess', {
        action: enable ? t('common.enabled') : t('common.disabled'),
        count: done,
      }));
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('common.operationFailed'));
    }
  };

  const handleBatchTest = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('pages.system.applicationConnections.selectToTest'));
      return;
    }
    let ok = 0;
    let fail = 0;
    for (const uuid of selectedRowKeys) {
      try {
        const r = await testApplicationConnection(String(uuid));
        if (r.success) ok++;
        else fail++;
      } catch {
        fail++;
      }
    }
    messageApi.info(t('pages.system.applicationConnections.testComplete', { ok, fail }));
    actionRef.current?.reload();
  };

  const handleDelete = async (record: ApplicationConnection) => {
    try {
      await deleteApplicationConnection(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    try {
      let done = 0;
      let fail = 0;
      for (const uuid of keys) {
        try {
          await deleteApplicationConnection(String(uuid));
          done++;
        } catch {
          fail++;
        }
      }
      if (fail > 0) {
        messageApi.warning(t('pages.system.applicationConnections.batchDeletePartial', { done, fail }));
      } else {
        messageApi.success(t('pages.system.applicationConnections.batchDeleteSuccess', { count: done }));
      }
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('common.batchDeleteFailed'));
    }
  };

  const handleTestConnectionInForm = async () => {
    try {
      const values = await formRef.current?.validateFields();
      if (!values) return;
      const { type, name, code, description, is_active, ...restConfig } = values;
      setTestingConnection(true);
      const result = await testApplicationConnectionConfig(type, restConfig);
      if (result.success) {
        messageApi.success(result.message || t('pages.system.applicationConnections.testSuccess'));
      } else {
        messageApi.error(result.message || result.error || t('pages.system.applicationConnections.testFailed'));
      }
    } catch (error: any) {
      if (error?.errorFields) {
        messageApi.warning(t('pages.system.applicationConnections.fillConfigFirst'));
      } else {
        messageApi.error(error?.message || t('pages.system.applicationConnections.testFailed'));
      }
    } finally {
      setTestingConnection(false);
    }
  };

  const handleTestConnection = async (record: ApplicationConnection) => {
    try {
      const result = await testApplicationConnection(record.uuid);
      if (result.success) {
        messageApi.success(result.message || t('pages.system.applicationConnections.testSuccess'));
      } else {
        messageApi.error(result.message || result.error || t('pages.system.applicationConnections.testFailed'));
      }
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.applicationConnections.testFailed'));
    }
  };

  const handleSyncContacts = async (record: ApplicationConnection) => {
    if (record.type !== 'wecom') return;
    try {
      setSyncingContactsUuid(record.uuid);
      messageApi.loading({
        content: t('pages.system.applicationConnections.syncContactsRunning'),
        key: 'wecom-sync-contacts',
        duration: 0,
      });
      const result = await syncApplicationConnectionContacts(record.uuid);
      messageApi.destroy('wecom-sync-contacts');
      if (result.success) {
        messageApi.success(result.message || t('pages.system.applicationConnections.syncContactsSuccess'));
      } else {
        messageApi.error(result.message || result.error || t('pages.system.applicationConnections.syncContactsFailed'));
      }
      actionRef.current?.reload();
      if (detailData?.uuid === record.uuid) {
        const detail = await getApplicationConnectionByUuid(record.uuid);
        setDetailData(detail);
      }
    } catch (error: any) {
      messageApi.destroy('wecom-sync-contacts');
      messageApi.error(error?.message || t('pages.system.applicationConnections.syncContactsFailed'));
    } finally {
      setSyncingContactsUuid(null);
    }
  };

  const handleSubmit = async (values: any): Promise<void> => {
    try {
      setFormLoading(true);
      const {
        name,
        code,
        description,
        type,
        is_active,
        api_key_configured: _apiKeyConfigured,
        enabled: _enabled,
        ...restConfig
      } = values;
      const config = { ...restConfig };
      if (config.api_key === '****') {
        delete config.api_key;
      }
      if (config.app_code === '****') {
        delete config.app_code;
      }
      if (isEdit && currentUuid) {
        await updateApplicationConnection(currentUuid, {
          name,
          description,
          config,
          is_active,
        });
        messageApi.success(t('common.updateSuccess'));
      } else {
        await createApplicationConnection({
          name,
          code,
          type,
          description,
          config,
          is_active,
        });
        messageApi.success(t('common.createSuccess'));
      }
      setModalVisible(false);
      setFormInitialValues(undefined);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.operationFailed'));
      throw error;
    } finally {
      setFormLoading(false);
    }
  };

  const statCards = useMemo(() => {
    if (allConnections.length === 0) return undefined;
    const stats = {
      total: allConnections.length,
      connected: allConnections.filter((c) => c.is_connected && c.is_active).length,
      disconnected: allConnections.filter((c) => !c.is_connected && c.is_active).length,
      inactive: allConnections.filter((c) => !c.is_active).length,
    };
    return [
      { title: t('pages.system.applicationConnections.statTotal'), value: stats.total, valueStyle: { color: '#1890ff' } },
      { title: t('pages.system.applicationConnections.statConnected'), value: stats.connected, valueStyle: { color: '#52c41a' } },
      { title: t('pages.system.applicationConnections.statDisconnected'), value: stats.disconnected, valueStyle: { color: '#ff4d4f' } },
      { title: t('pages.system.applicationConnections.statInactive'), value: stats.inactive, valueStyle: { color: '#faad14' } },
    ];
  }, [allConnections, t]);

  const renderConfigForm = (type: string) => {
    const common = (
      <>
        <ProFormText name="base_url" label="Base URL" placeholder="https://..." colProps={{ span: 24 }} />
      </>
    );
    switch (type) {
      case 'feishu':
        return (
          <>
            <ProFormText name="app_id" label="App ID" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText.Password name="app_secret" label="App Secret" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText name="encrypt_key" label="Encrypt Key" colProps={{ span: 12 }} />
            <ProFormText name="verification_token" label="Verification Token" colProps={{ span: 12 }} />
          </>
        );
      case 'dingtalk':
        return (
          <>
            <ProFormText name="corpid" label="Corpid" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText name="agent_id" label="Agent ID" colProps={{ span: 12 }} />
            <ProFormText name="app_key" label="App Key" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText.Password name="app_secret" label="App Secret" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText name="aes_key" label={t('pages.system.applicationConnections.formAesKeyLabel')} colProps={{ span: 12 }} />
            <ProFormText name="token" label={t('pages.system.applicationConnections.formTokenLabel')} colProps={{ span: 12 }} />
          </>
        );
      case 'wecom':
        return (
          <>
            <ProFormText name="corp_id" label={t('pages.system.applicationConnections.formCorpIdLabel')} rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText.Password name="corp_secret" label="Secret" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText name="agent_id" label="Agent ID" colProps={{ span: 12 }} />
            <ProFormText name="token" label="Token" colProps={{ span: 12 }} />
            <ProFormText name="encoding_aes_key" label="EncodingAESKey" colProps={{ span: 12 }} />
          </>
        );
      case 'sap_s4hana':
        return (
          <>
            {common}
            <ProFormText name="client" label="Client" colProps={{ span: 12 }} />
            <ProFormText name="username" label="Username" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText.Password name="password" label="Password" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText name="language" label="Language" initialValue="ZH" colProps={{ span: 12 }} />
          </>
        );
      case 'sap_b1':
        return (
          <>
            {common}
            <ProFormText name="company_db" label="Company DB" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText name="username" label="Username" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText.Password name="password" label="Password" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText name="language" label="Language" initialValue="ZH" colProps={{ span: 12 }} />
          </>
        );
      case 'kingdee_galaxy':
      case 'kingdee_xingchen':
      case 'kingdee_kis_cloud':
        return (
          <>
            {common}
            <ProFormText name="app_id" label="App ID" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText.Password name="app_secret" label="App Secret" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText name="acct_id" label="Acct ID" colProps={{ span: 12 }} />
            <ProFormText name="lcid" label="LCID" initialValue="2052" colProps={{ span: 12 }} />
          </>
        );
      case 'yonyou_yonbip':
      case 'yonyou_u8':
      case 'yonyou_u9':
      case 'yonyou_nc':
        return (
          <>
            {common}
            <ProFormText name="app_key" label="App Key" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText.Password name="app_secret" label="App Secret" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText name="corp_id" label="Corp ID" colProps={{ span: 12 }} />
            <ProFormText name="user_id" label="User ID" colProps={{ span: 12 }} />
          </>
        );
      case 'digiwin_t100':
      case 'digiwin_yifei':
      case 'digiwin_yizhu':
      case 'digiwin_yituo':
      case 'digiwin_e10':
        return (
          <>
            {common}
            <ProFormText name="username" label="Username" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText.Password name="password" label="Password" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText name="company_id" label="Company/Tenant ID" colProps={{ span: 12 }} />
          </>
        );
      case 'teamcenter':
        return (
          <>
            {common}
            <ProFormText name="username" label="Username" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText.Password name="password" label="Password" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText name="database" label="Database" colProps={{ span: 12 }} />
          </>
        );
      case 'windchill':
        return (
          <>
            {common}
            <ProFormText name="username" label="Username" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText.Password name="password" label="Password" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText name="csrf_token" label="CSRF Token" colProps={{ span: 12 }} />
          </>
        );
      case 'inspur_gs':
      case 'inspur_ps':
      case 'grasp_huihuang':
      case 'chanjet_tplus':
      case 'sunlike_erp':
        return (
          <>
            {common}
            <ProFormText name="app_key" label="App Key" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText.Password name="app_secret" label="App Secret" rules={[{ required: true }]} colProps={{ span: 12 }} />
          </>
        );
      case 'erpnext':
        return (
          <>
            {common}
            <ProFormText name="api_key" label="API Key" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText.Password name="api_secret" label="API Secret" rules={[{ required: true }]} colProps={{ span: 12 }} />
          </>
        );
      case 'caxa':
      case 'sanpin_plm':
      case 'sunlike_plm':
      case 'sipm':
      case 'inteplm':
      case 'seeyon':
      case 'landray':
      case 'super_erp':
      case 'tongda_oa':
      case 'digiwin_wms':
      case 'openwms':
      case 'thingsboard':
        return (
          <>
            {common}
            <ProFormText name="username" label={t('pages.system.applicationConnections.formUsernameLabel')} rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText.Password name="password" label={t('pages.system.applicationConnections.formPasswordLabel')} rules={[{ required: true }]} colProps={{ span: 12 }} />
          </>
        );
      case 'kingdee_kis':
      case 'cloudhub':
        return (
          <>
            {common}
            <ProFormText name="instance_id" label={t('pages.system.applicationConnections.formInstanceIdLabel')} rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText.Password name="app_secret" label="App Secret" rules={[{ required: true }]} colProps={{ span: 12 }} />
          </>
        );
      case 'weaver':
        return (
          <>
            {common}
            <ProFormText name="appid" label="AppID" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText.Password name="appsecret" label="AppSecret" rules={[{ required: true }]} colProps={{ span: 12 }} />
          </>
        );
      case 'flux_wms':
        return (
          <>
            {common}
            <ProFormText name="app_key" label="App Key" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText.Password name="app_secret" label="App Secret" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText name="warehouse_id" label="Warehouse ID" colProps={{ span: 12 }} />
          </>
        );
      case 'kejian_wms':
      case 'supra_crm':
        return (
          <>
            {common}
            <ProFormText name="client_id" label="Client ID / API Key" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText.Password name="client_secret" label="Client Secret / API Secret" rules={[{ required: true }]} colProps={{ span: 12 }} />
          </>
        );
      case 'oracle_netsuite':
        return (
          <>
            {common}
            <ProFormText name="account" label="Account ID" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText name="consumer_key" label="Consumer Key" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText.Password name="consumer_secret" label="Consumer Secret" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText name="token_id" label="Token ID" colProps={{ span: 12 }} />
            <ProFormText.Password name="token_secret" label="Token Secret" colProps={{ span: 12 }} />
          </>
        );
      case 'odoo':
        return (
          <>
            {common}
            <ProFormText name="db" label="Database Name" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText name="username" label="Username" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText.Password name="password" label="Password" rules={[{ required: true }]} colProps={{ span: 12 }} />
          </>
        );
      case 'alicloud_iot':
        return (
          <>
            <ProFormText name="access_key_id" label="Access Key ID" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText.Password name="access_key_secret" label="Access Key Secret" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText name="region_id" label="Region ID" initialValue="cn-shanghai" colProps={{ span: 12 }} />
          </>
        );
      case 'huaweicloud_iot':
        return (
          <>
            {common}
            <ProFormText name="app_id" label="App ID" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText.Password name="secret" label="App Secret" rules={[{ required: true }]} colProps={{ span: 12 }} />
          </>
        );
      case 'jetlinks':
        return (
          <>
            {common}
            <ProFormText.Password name="token" label="Access Token" rules={[{ required: true }]} colProps={{ span: 24 }} />
          </>
        );
      case 'qidian':
      case 'rootcloud':
      case 'casicloud':
        return (
          <>
            {common}
            <ProFormText name="app_key" label="App Key" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText.Password name="app_secret" label="App Secret" rules={[{ required: true }]} colProps={{ span: 12 }} />
          </>
        );
      case 'salesforce':
        return (
          <>
            <ProFormText name="base_url" label="Base URL" initialValue="https://login.salesforce.com" colProps={{ span: 24 }} />
            <ProFormText name="client_id" label="Client ID" colProps={{ span: 12 }} />
            <ProFormText.Password name="client_secret" label="Client Secret" colProps={{ span: 12 }} />
            <ProFormText name="username" label="Username" colProps={{ span: 12 }} />
            <ProFormText.Password name="password" label="Password" colProps={{ span: 12 }} />
            <ProFormText.Password name="security_token" label="Security Token" colProps={{ span: 12 }} />
          </>
        );
      case 'xiaoshouyi':
        return (
          <>
            {common}
            <ProFormText name="app_id" label="App ID" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText.Password name="app_secret" label="App Secret" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText name="grant_type" label="Grant Type" initialValue="client_credentials" colProps={{ span: 12 }} />
          </>
        );
      case 'fenxiang':
        return (
          <>
            {common}
            <ProFormText name="corp_id" label="Corp ID" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText.Password name="corp_secret" label="Corp Secret" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText name="app_id" label="App ID" colProps={{ span: 12 }} />
            <ProFormText.Password name="app_secret" label="App Secret" colProps={{ span: 12 }} />
          </>
        );
      case 'alicloud_oss':
      case 'huaweicloud_obs':
      case 'aws_s3':
        return (
          <>
            <ProFormText name="endpoint" label="Endpoint" colProps={{ span: 24 }} />
            <ProFormText name="access_key_id" label="Access Key ID" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText.Password
              name={type === 'alicloud_oss' ? 'access_key_secret' : 'secret_access_key'}
              label="Secret Key"
              rules={[{ required: true }]}
              colProps={{ span: 12 }}
            />
            <ProFormText name="bucket" label="Bucket" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText name="region" label="Region" colProps={{ span: 12 }} />
          </>
        );
      case 'tencent_cos':
        return (
          <>
            <ProFormText
              name="endpoint"
              label="Endpoint"
              colProps={{ span: 24 }}
              placeholder="可留空，将按 Bucket+Region 自动拼 https://{bucket}.cos.{region}.myqcloud.com"
            />
            <ProFormText name="secret_id" label="SecretId" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText.Password name="secret_key" label="SecretKey" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText name="bucket" label="Bucket" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText
              name="region"
              label="Region"
              rules={[{ required: true }]}
              colProps={{ span: 12 }}
              placeholder="ap-guangzhou"
            />
          </>
        );
      case 'minio':
        return (
          <>
            <ProFormText
              name="endpoint"
              label="Endpoint"
              rules={[{ required: true }]}
              colProps={{ span: 24 }}
              placeholder="minio.example.com:9000 或 http://192.168.1.10:9000"
              extra="填 S3 API 地址（常见 :9000），不要填控制台（:9001），也不要带 Bucket 路径；未写协议时由「使用 HTTPS」补全"
            />
            <ProFormSwitch
              name="use_ssl"
              label="使用 HTTPS"
              initialValue={true}
              colProps={{ span: 12 }}
              extra="强制走 TLS。若 MinIO 仅 HTTP（常见 9000 端口），请关闭，否则会报 WRONG_VERSION_NUMBER"
            />
            <ProFormText
              name="region"
              label="Region"
              colProps={{ span: 12 }}
              placeholder="us-east-1"
              extra="多数自建 MinIO 可填 us-east-1"
            />
            <ProFormText name="access_key" label="Access Key" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText.Password name="secret_key" label="Secret Key" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText
              name="bucket"
              label="Bucket"
              rules={[{ required: true }]}
              colProps={{ span: 12 }}
              extra="桶名需符合 S3 规则（小写等）；探测走 path-style /{bucket}"
            />
          </>
        );
      case 'qiniu_kodo':
        return (
          <>
            <ProFormText name="endpoint" label="Endpoint" rules={[{ required: true }]} colProps={{ span: 24 }} />
            <ProFormText name="access_key" label="Access Key" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText.Password name="secret_key" label="Secret Key" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText name="bucket" label="Bucket" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText name="region" label="Region" colProps={{ span: 12 }} />
          </>
        );
      case 'nas_webdav':
        return (
          <>
            <ProFormText name="base_url" label="WebDAV URL" rules={[{ required: true }]} colProps={{ span: 24 }} />
            <ProFormText name="username" label={t('pages.system.applicationConnections.formUsernameLabel')} rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText.Password name="password" label={t('pages.system.applicationConnections.formPasswordLabel')} rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText name="root_path" label="Root Path" initialValue="/" colProps={{ span: 12 }} />
          </>
        );
      case 'nas_smb':
        return (
          <>
            <ProFormText name="host" label="Host" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText name="share" label="Share" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText name="username" label={t('pages.system.applicationConnections.formUsernameLabel')} rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText.Password name="password" label={t('pages.system.applicationConnections.formPasswordLabel')} rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText name="domain" label="Domain" colProps={{ span: 12 }} />
            <ProFormText name="port" label="Port" initialValue={445} colProps={{ span: 12 }} />
          </>
        );
      case 'aliyun_market':
      case 'tencent_market':
        return (
          <>
            <FormModalGridBlock>
              <Alert
                title={t('pages.system.applicationConnections.cloudMarketHint')}
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
            </FormModalGridBlock>
            <ProFormSelect
              name="scene"
              label={t('pages.system.applicationConnections.cloudMarketScene')}
              rules={[{ required: true }]}
              colProps={{ span: 12 }}
              extra={t('pages.system.applicationConnections.cloudMarketSceneExtra')}
              options={[
                {
                  value: 'express_query',
                  label: t('pages.system.applicationConnections.cloudMarketSceneExpressQuery'),
                },
              ]}
            />
            <ProFormSelect
              name="http_method"
              label={t('pages.system.applicationConnections.cloudMarketMethod')}
              rules={[{ required: true }]}
              colProps={{ span: 12 }}
              extra={t('pages.system.applicationConnections.cloudMarketMethodExtra')}
              options={[
                { value: 'POST', label: 'POST' },
                { value: 'GET', label: 'GET' },
              ]}
            />
            <ProFormText
              name="query_url"
              label={t('pages.system.applicationConnections.cloudMarketQueryUrl')}
              rules={[
                { required: true },
                { pattern: /^https:\/\//, message: t('pages.system.applicationConnections.cloudMarketQueryUrlPattern') },
              ]}
              colProps={{ span: 24 }}
              extra={t('pages.system.applicationConnections.cloudMarketQueryUrlExtra')}
              placeholder={t('pages.system.applicationConnections.cloudMarketQueryUrlPlaceholder')}
            />
            <ProFormText.Password
              name="app_code"
              label={t('pages.system.applicationConnections.cloudMarketAppCode')}
              rules={isEdit ? [] : [{ required: true }]}
              colProps={{ span: 24 }}
              extra={t('pages.system.applicationConnections.cloudMarketAppCodeExtra')}
              placeholder={
                isEdit
                  ? t('pages.system.siteSettings.integrationsDeepseekApiKeyPlaceholderConfigured')
                  : undefined
              }
              fieldProps={{ autoComplete: 'new-password' }}
            />
          </>
        );
      case 'kdniao':
        return (
          <>
            <FormModalGridBlock>
              <Alert
                title={t('pages.system.applicationConnections.kdniaoHint')}
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
            </FormModalGridBlock>
            <ProFormText
              name="ebusiness_id"
              label={t('pages.system.applicationConnections.kdniaoEbusinessId')}
              rules={[{ required: true }]}
              colProps={{ span: 24 }}
              extra={t('pages.system.applicationConnections.kdniaoEbusinessIdExtra')}
            />
            <ProFormText.Password
              name="api_key"
              label={t('pages.system.applicationConnections.kdniaoApiKey')}
              rules={isEdit ? [] : [{ required: true }]}
              colProps={{ span: 24 }}
              extra={t('pages.system.applicationConnections.kdniaoApiKeyExtra')}
              placeholder={
                isEdit
                  ? t('pages.system.siteSettings.integrationsDeepseekApiKeyPlaceholderConfigured')
                  : undefined
              }
              fieldProps={{ autoComplete: 'new-password' }}
            />
          </>
        );
      case 'kuaidi100':
        return (
          <>
            <FormModalGridBlock>
              <Alert
                title={t('pages.system.applicationConnections.kuaidi100Hint')}
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
            </FormModalGridBlock>
            <ProFormText
              name="customer"
              label={t('pages.system.applicationConnections.kuaidi100Customer')}
              rules={[{ required: true }]}
              colProps={{ span: 24 }}
              extra={t('pages.system.applicationConnections.kuaidi100CustomerExtra')}
            />
            <ProFormText.Password
              name="api_key"
              label={t('pages.system.applicationConnections.kuaidi100ApiKey')}
              rules={isEdit ? [] : [{ required: true }]}
              colProps={{ span: 24 }}
              extra={t('pages.system.applicationConnections.kuaidi100ApiKeyExtra')}
              placeholder={
                isEdit
                  ? t('pages.system.siteSettings.integrationsDeepseekApiKeyPlaceholderConfigured')
                  : undefined
              }
              fieldProps={{ autoComplete: 'new-password' }}
            />
          </>
        );
      case 'amap':
        return (
          <>
            <FormModalGridBlock>
              <Alert
                title={t('pages.system.applicationConnections.amapHint')}
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
            </FormModalGridBlock>
            <ProFormText
              name="js_key"
              label={t('pages.system.applicationConnections.amapJsKey')}
              rules={[{ required: true }]}
              colProps={{ span: 24 }}
              extra={t('pages.system.applicationConnections.amapJsKeyExtra')}
            />
            <ProFormText.Password
              name="security_code"
              label={t('pages.system.applicationConnections.amapSecurityCode')}
              colProps={{ span: 24 }}
              extra={t('pages.system.applicationConnections.amapSecurityCodeExtra')}
              fieldProps={{ autoComplete: 'new-password' }}
            />
            <ProFormText.Password
              name="rest_key"
              label={t('pages.system.applicationConnections.amapRestKey')}
              rules={isEdit ? [] : [{ required: true }]}
              colProps={{ span: 24 }}
              extra={t('pages.system.applicationConnections.amapRestKeyExtra')}
              placeholder={
                isEdit
                  ? t('pages.system.siteSettings.integrationsDeepseekApiKeyPlaceholderConfigured')
                  : undefined
              }
              fieldProps={{ autoComplete: 'new-password' }}
            />
          </>
        );
      case 'deepseek':
      case 'openai':
      case 'qwen':
      case 'zhipu':
      case 'moonshot':
      case 'siliconflow':
        return (
          <>
            <ProFormText
              name="base_url"
              label="API Base URL"
              rules={[{ required: true }]}
              colProps={{ span: 24 }}
            />
            <ProFormText
              name="model"
              label={t('pages.system.applicationConnections.columnModel')}
              rules={[{ required: true }]}
              colProps={{ span: 12 }}
              placeholder="deepseek-v4-flash"
            />
            <ProFormText.Password
              name="api_key"
              label="API Key"
              rules={isEdit ? [] : [{ required: true }]}
              colProps={{ span: 12 }}
              placeholder={
                isEdit
                  ? t('pages.system.siteSettings.integrationsDeepseekApiKeyPlaceholderConfigured')
                  : t('pages.system.applicationConnections.llmProviderKeyRequired')
              }
              fieldProps={{ autoComplete: 'new-password' }}
            />
          </>
        );
      default:
        return (
          <FormModalGridBlock>
            <Alert title={t('pages.system.applicationConnections.noVisualForm', { type })} type="info" />
          </FormModalGridBlock>
        );
    }
  };

  const canTestInForm = (type: string) => {
    return [
      'feishu', 'dingtalk', 'wecom',
      'kingdee_galaxy', 'kingdee_xingchen', 'kingdee_kis_cloud', 'kingdee_kis',
      'yonyou_yonbip', 'yonyou_u8', 'yonyou_u9', 'yonyou_nc',
      'sap_s4hana', 'sap_b1', 'oracle_netsuite', 'odoo',
      'inspur_gs', 'inspur_ps',
      'digiwin_t100', 'digiwin_yifei', 'digiwin_yizhu', 'digiwin_yituo', 'digiwin_e10',
      'chanjet_tplus', 'grasp_huihuang', 'super_erp', 'erpnext', 'sunlike_erp',
      'teamcenter', 'windchill', 'caxa', 'sanpin_plm', 'sunlike_plm', 'sipm', 'inteplm',
      'salesforce', 'xiaoshouyi', 'fenxiang', 'qidian', 'supra_crm',
      'weaver', 'seeyon', 'landray', 'cloudhub', 'tongda_oa',
      'rootcloud', 'casicloud', 'alicloud_iot', 'huaweicloud_iot', 'thingsboard', 'jetlinks',
      'flux_wms', 'kejian_wms', 'digiwin_wms', 'openwms',
      'alicloud_oss', 'tencent_cos', 'huaweicloud_obs', 'aws_s3', 'minio', 'qiniu_kodo',
      'nas_webdav', 'nas_smb', 'amap', 'kuaidi100', 'kdniao', 'aliyun_market', 'tencent_market',
      'deepseek', 'openai', 'qwen', 'zhipu', 'moonshot', 'siliconflow',
    ].includes(type);
  };

  const columns = useMemo<ProColumns<ApplicationConnection>[]>(() => alignProColumns([
    { title: t('pages.system.applicationConnections.columnName'), dataIndex: 'name', width: 180, fixed: 'left' },
    { title: t('pages.system.applicationConnections.columnCode'), dataIndex: 'code', width: 140, minWidth: 140, uniTableKeepWidth: true, resizable: false },
    {
      title: t('pages.system.applicationConnections.columnType'),
      dataIndex: 'type',
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      render: (_, record) => {
        const info = getTypeInfo(record.type);
        return <MarkerTag color={info.color}>{info.text}</MarkerTag>;
      },
    },
    {
      title: t('pages.system.applicationConnections.columnModel'),
      dataIndex: ['config', 'model'],
      width: 160,
      ellipsis: true,
      hideInSearch: true,
      render: (_, record) => {
        if (!isLlmConnectionType(record.type)) return t('common.dash');
        return record.config?.model || t('common.dash');
      },
    },
    { title: t('common.remark'), dataIndex: 'description', ellipsis: true, hideInSearch: true },
    {
      title: t('pages.system.applicationConnections.columnConnectionStatus'),
      dataIndex: 'is_connected',
      width: 100,
      minWidth: 100,
      uniTableKeepWidth: true,
      resizable: false,
      render: (_, record) => {
        const s = getConnectionStatus(record);
        return <Badge status={s.status} text={s.text} />;
      },
    },
    {
      title: t('common.enabled'),
      dataIndex: 'is_active',
      width: 80,
      minWidth: 80,
      uniTableKeepWidth: true,
      resizable: false,
      render: (_, record) =>
        renderSystemActiveTag(
          t,
          record.is_active,
          'common.enabled',
          'common.disabled',
        ),
    },
    {
      title: t('pages.system.applicationConnections.columnLastConnected'),
      dataIndex: 'last_connected_at',
      width: 180,
      minWidth: 180,
      uniTableKeepWidth: true,
      resizable: false,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('common.createdAt'),
      dataIndex: 'created_at',
      width: 180,
      minWidth: 180,
      uniTableKeepWidth: true,
      resizable: false,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('common.actions'),
      key: 'action',
      valueType: 'option',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) =>
        [
            <Button {...rowActionKind('read')} key="view" onClick={() => handleView(record)}>
              {t('common.view')}
            </Button>,
            <Button {...rowActionKind('update')} key="edit" onClick={() => handleEdit(record)}>
              {t('common.edit')}
            </Button>,
            <Button
              {...rowActionTestConnection('execute')}
              key="test"
              onClick={() => handleTestConnection(record)}
            >
              {t('pages.system.applicationConnections.testConnection')}
            </Button>,
            record.type === 'wecom' && canSyncContacts ? (
              <Popconfirm
                {...rowActionKind('execute')}
                key="sync-contacts"
                title={t('pages.system.applicationConnections.syncContactsConfirmTitle')}
                description={t('pages.system.applicationConnections.syncContactsConfirmContent')}
                onConfirm={() => handleSyncContacts(record)}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
              >
                <Button
                  type="link"
                  size="small"
                  icon={<SyncOutlined />}
                  loading={syncingContactsUuid === record.uuid}
                >
                  {t('pages.system.applicationConnections.syncContacts')}
                </Button>
              </Popconfirm>
            ) : null,
            <Popconfirm {...rowActionKind('delete')}
              key="delete"
              title={t('pages.system.applicationConnections.deleteConfirmTitle')}
              onConfirm={() => handleDelete(record)}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
            >
              <Button type="link" size="small" icon={<DeleteOutlined />} danger>
                {t('common.delete')}
              </Button>
            </Popconfirm>,
          ].filter(Boolean),
    },
  ], GLOBAL_DOC_LIST_FIELD_RANK), [t, canSyncContacts, syncingContactsUuid, handleView, handleEdit, handleTestConnection, handleSyncContacts, handleDelete]);

  const detailColumns = [
    { title: t('pages.system.applicationConnections.columnName'), dataIndex: 'name' },
    { title: t('pages.system.applicationConnections.columnCode'), dataIndex: 'code' },
    {
      title: t('pages.system.applicationConnections.columnType'),
      dataIndex: 'type',
      render: (v: string) => {
        const info = getTypeInfo(v);
        return <MarkerTag color={info.color}>{info.text}</MarkerTag>;
      },
    },
    {
      title: t('pages.system.applicationConnections.columnModel'),
      dataIndex: 'config',
      render: (_: any, record: ApplicationConnection) =>
        isLlmConnectionType(record.type) ? record.config?.model || t('common.dash') : t('common.dash'),
    },
    { title: t('common.remark'), dataIndex: 'description' },
    {
      title: t('pages.system.applicationConnections.columnConfig'),
      dataIndex: 'config',
      render: (value: any) => {
        const masked = value ? { ...value } : {};
        SENSITIVE_KEYS.forEach((k) => {
          if (masked[k]) masked[k] = '****';
        });
        return (
          <pre style={{ margin: 0, padding: 8, background: '#f5f5f5', borderRadius: 4, maxHeight: 300, overflow: 'auto', fontSize: 12 }}>
            {JSON.stringify(masked, null, 2)}
          </pre>
        );
      },
    },
    {
      title: t('pages.system.applicationConnections.columnConnectionStatus'),
      dataIndex: 'is_connected',
      render: (v: boolean) => (
        <Badge
          status={v ? 'success' : 'default'}
          text={v ? t('pages.system.applicationConnections.statusConnected') : t('pages.system.applicationConnections.statusDisconnected')}
        />
      ),
    },
    {
      title: t('common.enabled'),
      dataIndex: 'is_active',
      render: (v: boolean) =>
        renderSystemActiveTag(
          t,
          v,
          'common.enabled',
          'common.disabled',
        ),
    },
    { title: t('pages.system.applicationConnections.columnLastConnected'), dataIndex: 'last_connected_at', valueType: 'dateTime' },
    {
      title: t('pages.system.applicationConnections.columnLastError'),
      dataIndex: 'last_error',
      render: (v: string) => (v ? renderSystemTypeMarker(v, 'error') : t('common.dash')),
    },
    { title: t('common.createdAt'), dataIndex: 'created_at', valueType: 'dateTime' },
    { title: t('common.updatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
  ];

  return (
    <>
      <ListPageTemplate statCards={statCards}>
        <UniTable<ApplicationConnection>
        viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('system.applicationConnections')}
          columnPersistenceId="pages.system.application-connections.list-v1"
          actionRef={actionRef}
          columns={columns}
          request={async (params, _sort, _filter, searchFormValues) => {
            const apiParams: any = {
              page: params.current || 1,
              page_size: params.pageSize || 20,
            };
            const kw = mergeListKeyword(searchFormValues, 'search');
            if (kw) apiParams.search = kw;
            if (searchFormValues?.type) apiParams.type = searchFormValues.type;
            if (searchFormValues?.is_active !== undefined && searchFormValues.is_active !== '' && searchFormValues.is_active !== null) {
              apiParams.is_active = searchFormValues.is_active;
            }
            try {
              const result = await getApplicationConnectionList(apiParams);
              if ((params.current || 1) === 1) {
                try {
                  const allItems = await getApplicationConnectionListAll({
                    search: apiParams.search,
                    type: apiParams.type,
                    is_active: apiParams.is_active,
                  });
                  setAllConnections(allItems);
                } catch {
                  // ignore
                }
              }
              return { data: result.items, success: true, total: result.total };
            } catch (error: any) {
              messageApi.error(error?.message || t('pages.system.applicationConnections.getListFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          rowKey="uuid"
          showAdvancedSearch={true}
          showCreateButton
          onCreate={handleCreate}
          createButtonText={t('pages.system.applicationConnections.createButton')}
          enableRowSelection
          onRowSelectionChange={setSelectedRowKeys}
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteButtonText={t('common.batchDelete')}
          deleteConfirmTitle={t('pages.system.applicationConnections.batchDeleteTitle')}
          deleteConfirmDescription={(c) => t('pages.system.applicationConnections.batchDeleteDescription', { count: c })}
          toolBarRender={() =>
            selectedRowKeys.length > 0
              ? [
                  <Button {...rowActionKind('read')} key="batch-test" onClick={handleBatchTest}>{t('pages.system.applicationConnections.batchTestButton')}</Button>,
                  <Button {...rowActionKind('update')} key="batch-enable" onClick={() => handleBatchStatus(true)}>{t('pages.system.applicationConnections.batchEnableButton')}</Button>,
                  <Button {...rowActionKind('update')} key="batch-disable" onClick={() => handleBatchStatus(false)}>{t('pages.system.applicationConnections.batchDisableButton')}</Button>,
                ]
              : []
          }
          showImportButton
          onImport={async (data) => {
            if (!data || data.length < 2) {
              messageApi.warning(t('pages.system.applicationConnections.importDataRequired'));
              return;
            }
            const headers = (data[0] || []).map((h: any) => String(h || '').trim());
            const rows = data.slice(2).filter((row: any[]) =>
              row.some((c: any) => c != null && String(c).trim()),
            );
            const headerIndexMap = resolveFactoryImportHeaderIndexMap(
              headers,
              applicationConnectionImportTemplate.importHeaderMap,
            );
            const val = (row: any[], field: string) => {
              const idx = headerIndexMap[field];
              return idx !== undefined && row[idx] != null ? row[idx] : undefined;
            };
            let done = 0;
            const ts = Date.now();
            for (let i = 0; i < rows.length; i++) {
              const row = rows[i];
              const name = val(row, 'name');
              const code = val(row, 'code');
              const type = val(row, 'type');
              if (name && code && type) {
                let config: Record<string, any> = {};
                const configJson = val(row, 'configJson');
                if (configJson) {
                  try {
                    config = JSON.parse(String(configJson));
                  } catch {
                    config = {};
                  }
                }
                const isActiveRaw = val(row, 'isActive');
                await createApplicationConnection({
                  name: String(name),
                  code: `${String(code).replace(/[^a-z0-9_]/g, '_').slice(0, 30)}_${ts}${i}`,
                  type: String(type),
                  config,
                  description: val(row, 'description') ? String(val(row, 'description')) : undefined,
                  is_active:
                    isActiveRaw !== 'false' && isActiveRaw !== '0' && isActiveRaw !== '',
                });
                done++;
              }
            }
            messageApi.success(t('pages.system.applicationConnections.importSuccess', { count: done }));
            actionRef.current?.reload();
          }}
          importHeaders={applicationConnectionImportTemplate.importHeaders}
          importExampleRow={applicationConnectionImportTemplate.importExampleRow}
          importFieldMap={applicationConnectionImportTemplate.importHeaderMap}
          showExportButton
          onExport={async (type, keys, pageData) => {
            let items: ApplicationConnection[] = [];
            if (type === 'selected' && keys?.length) {
              items = await Promise.all(keys.map((k) => getApplicationConnectionByUuid(String(k))));
            } else if (type === 'currentPage' && pageData?.length) {
              items = pageData;
            } else {
              items = await getApplicationConnectionListAll();
            }
            if (items.length === 0) {
              messageApi.warning(t('common.exportNoData'));
              return;
            }
            await downloadRecordsAsXlsx(
              items as Array<Record<string, unknown>>,
              t('pages.system.applicationConnections.exportFileName', {
                date: todaySiteDateString(),
              }),
            );
            messageApi.success(t('common.exportSuccess', { count: items.length }));
          }}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={
          <Space size={8} align="center">
            <span>
              {isEdit
                ? t('pages.system.applicationConnections.editModalTitle')
                : t('pages.system.applicationConnections.createModalTitle')}
            </span>
            {formInitialValues?.type ? (
              <MarkerTag color={getTypeInfo(String(formInitialValues.type)).color}>
                {getTypeInfo(String(formInitialValues.type)).text}
              </MarkerTag>
            ) : null}
          </Space>
        }
        open={modalVisible}
        onClose={() => { setModalVisible(false); setFormInitialValues(undefined); }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        initialValues={formInitialValues}
        loading={formLoading}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        grid
        extraFooter={
          <ProFormDependency name={['type']}>
            {({ type }) => {
              if (!type || !canTestInForm(type)) return null;
              return (
                <Button
                  type="default"
                  icon={<ApiOutlined />}
                  loading={testingConnection}
                  onClick={handleTestConnectionInForm}
                >
                  {t('pages.system.applicationConnections.testConnection')}
                </Button>
              );
            }}
          </ProFormDependency>
        }
      >
        <ProFormText name="type" hidden />
        <ProFormText
          name="code"
          label={t('pages.system.applicationConnections.columnCode')}
          rules={[
            { required: true },
            { pattern: /^[a-z0-9_]+$/, message: t('pages.system.applicationConnections.codePattern') },
          ]}
          placeholder={t('pages.system.applicationConnections.codePlaceholder')}
          disabled={isEdit}
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="name"
          label={t('pages.system.applicationConnections.columnName')}
          rules={[{ required: true }]}
          placeholder={t('pages.system.applicationConnections.namePlaceholder')}
          colProps={{ span: 12 }}
        />
        <ProFormDependency name={['type']}>
          {({ type }) => {
            if (!type) return null;
            return renderConfigForm(type);
          }}
        </ProFormDependency>
        <ProFormTextArea
          name="description"
          label={t('common.remark')}
          placeholder={t('pages.system.applicationConnections.descPlaceholder')}
          fieldProps={{ rows: 3 }}
          colProps={{ span: 24 }}
        />
        <ProFormSwitch name="is_active" label={t('common.enabled')} colProps={{ span: 12 }} />
      </FormModalTemplate>

      <AppConnectorMarket
        open={connectorMarketVisible}
        onClose={() => setConnectorMarketVisible(false)}
        onSelect={handleConnectorSelect}
        initialCategory={connectorMarketInitialCategory}
      />

      <SystemMasterDetailDrawer
        title={t('pages.system.applicationConnections.detailTitle')}
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setDetailData(null);
          setDetailError(null);
        }}
        detail={detailData}
        detailColumns={detailColumns}
        loading={detailLoading}
        error={detailError}
        onRetry={() => {
          const uuid = detailRetryUuidRef.current;
          if (uuid) void loadDetail(uuid);
        }}
        extra={
          detailData ? (
            <DetailDrawerActions
              items={[
                {
                  key: 'test',
                  visible: true,
                  render: (
                    <Button icon={<ApiOutlined />} onClick={() => handleTestConnection(detailData)}>
                      {t('pages.system.applicationConnections.testConnection')}
                    </Button>
                  ),
                },
                {
                  key: 'wecom-sync',
                  visible: detailData.type === 'wecom' && canSyncContacts,
                  render: (
                    <Popconfirm
                      title={t('pages.system.applicationConnections.syncContactsConfirmTitle')}
                      description={t('pages.system.applicationConnections.syncContactsConfirmContent')}
                      onConfirm={() => handleSyncContacts(detailData)}
                      okText={t('common.confirm')}
                      cancelText={t('common.cancel')}
                    >
                      <Button
                        icon={<SyncOutlined />}
                        loading={syncingContactsUuid === detailData.uuid}
                      >
                        {t('pages.system.applicationConnections.syncContacts')}
                      </Button>
                    </Popconfirm>
                  ),
                },
                {
                  key: 'edit',
                  visible: true,
                  render: (
                    <Button {...rowActionKind('update')} icon={<EditOutlined />} onClick={() => handleEdit(detailData)}>
                      {t('common.edit')}
                    </Button>
                  ),
                },
              ]}
            />
          ) : null
        }
      />
    </>
  );
};

export default ApplicationConnectionsListPage;
