/**
 * 应用连接器管理列表页面
 *
 * 用于系统管理员查看和管理组织内的应用连接器（飞书、钉钉、ERP、PLM、CRM 等）。
 */

import React, { useRef, useState, useMemo } from 'react';
import { rowActionKind } from '../../../../components/uni-action';
import { useTranslation } from 'react-i18next';
import {
  ActionType,
  ProColumns,
  ProFormText,
  ProFormTextArea,
  ProFormSwitch,
  ProFormDependency,
  ProFormInstance,
} from '@ant-design/pro-components';
import {
  App,
  Popconfirm,
  Tag,
  Space,
  Badge,
  Typography,
  Alert,
  Button,
  Descriptions,
} from 'antd';
import {
  DeleteOutlined,
  EyeOutlined,
  ThunderboltOutlined,
  EditOutlined,
  AppstoreOutlined,
  MessageOutlined,
  CloudOutlined,
  DatabaseOutlined,
  TeamOutlined,
  RocketOutlined,
  InteractionOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import {
  flushDrawerOpen,
  ListPageTemplate,
  FormModalTemplate,
  MODAL_CONFIG,
  DRAWER_CONFIG,
} from '../../../../components/layout-templates';
import { UniDetail, detailDrawerDescriptionItems } from '../../../../components/uni-detail';
import AppConnectorMarket from '../AppConnectorMarket';
import type { AppConnectorDefinition } from '../connectors';
import {
  getApplicationConnectionList,
  getApplicationConnectionListAll,
  getApplicationConnectionByUuid,
  createApplicationConnection,
  updateApplicationConnection,
  deleteApplicationConnection,
  testApplicationConnection,
  testApplicationConnectionConfig,
  ApplicationConnection,
} from '../../../../services/applicationConnection';
import {
  buildFactoryImportTemplate,
  resolveFactoryImportHeaderIndexMap,
} from '../../../../utils/spreadsheetImportTemplate';

const TYPE_COLORS: Record<string, { color: string; icon: React.ReactNode }> = {
  feishu: { color: 'blue', icon: <MessageOutlined /> },
  dingtalk: { color: 'cyan', icon: <MessageOutlined /> },
  wecom: { color: 'green', icon: <MessageOutlined /> },
  sap: { color: 'gold', icon: <DatabaseOutlined /> },
  kingdee: { color: 'orange', icon: <CloudOutlined /> },
  yonyou: { color: 'purple', icon: <CloudOutlined /> },
  dsc: { color: 'magenta', icon: <DatabaseOutlined /> },
  inspur: { color: 'cyan', icon: <CloudOutlined /> },
  digiwin_e10: { color: 'blue', icon: <DatabaseOutlined /> },
  grasp_erp: { color: 'orange', icon: <DatabaseOutlined /> },
  super_erp: { color: 'magenta', icon: <DatabaseOutlined /> },
  chanjet_tplus: { color: 'blue', icon: <CloudOutlined /> },
  kingdee_kis: { color: 'cyan', icon: <CloudOutlined /> },
  oracle_netsuite: { color: 'blue', icon: <CloudOutlined /> },
  erpnext: { color: 'blue', icon: <CloudOutlined /> },
  odoo: { color: 'purple', icon: <CloudOutlined /> },
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
  const applicationConnectionDetailReqRef = useRef(0);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentUuid, setCurrentUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | undefined>(undefined);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<ApplicationConnection | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [allConnections, setAllConnections] = useState<ApplicationConnection[]>([]);
  const [connectorMarketVisible, setConnectorMarketVisible] = useState(false);
  const formRef = useRef<ProFormInstance>(null);

  const applicationConnectionImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          { field: 'name', required: true, labelKey: 'pages.system.applicationConnections.importHeaderName' },
          { field: 'code', required: true, labelKey: 'pages.system.applicationConnections.importHeaderCode' },
          { field: 'type', required: true, labelKey: 'pages.system.applicationConnections.importHeaderType' },
          {
            field: 'description',
            labelKey: 'pages.system.applicationConnections.importHeaderDescription',
            aliases: ['描述'],
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
          t('pages.system.applicationConnections.importExampleActive'),
          '{}',
        ],
      ),
    [t, i18n.language],
  );

  const handleCreate = () => {
    setIsEdit(false);
    setCurrentUuid(null);
    setConnectorMarketVisible(true);
  };

  const handleConnectorSelect = (connector: AppConnectorDefinition) => {
    setFormInitialValues({
      type: connector.type,
      is_active: true,
      ...connector.defaultConfig,
    });
    setModalVisible(true);
  };

  const handleEdit = async (record: ApplicationConnection) => {
    try {
      setIsEdit(true);
      setCurrentUuid(record.uuid);
      const detail = await getApplicationConnectionByUuid(record.uuid);
      const config = detail.config || {};
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

  const handleView = async (record: ApplicationConnection) => {
    const req = ++applicationConnectionDetailReqRef.current;
    flushDrawerOpen(() => {
      setDrawerVisible(true);
      setDetailData(null);
      setDetailLoading(true);
    });
    try {
      const detail = await getApplicationConnectionByUuid(record.uuid);
      if (applicationConnectionDetailReqRef.current !== req) return;
      setDetailData(detail);
    } catch (error: any) {
      if (applicationConnectionDetailReqRef.current === req) {
        messageApi.error(error.message || t('pages.system.applicationConnections.getDetailFailed'));
      }
    } finally {
      if (applicationConnectionDetailReqRef.current === req) {
        setDetailLoading(false);
      }
    }
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
        action: enable ? t('pages.system.applicationConnections.actionEnable') : t('pages.system.applicationConnections.actionDisable'),
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

  const handleSubmit = async (values: any): Promise<void> => {
    try {
      setFormLoading(true);
      const { name, code, description, type, is_active, ...restConfig } = values;
      const config = { ...restConfig };
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
      case 'sap':
        return (
          <>
            {common}
            <ProFormText name="client" label="Client" colProps={{ span: 12 }} />
            <ProFormText name="username" label="Username" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText.Password name="password" label="Password" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText name="language" label="Language" initialValue="ZH" colProps={{ span: 12 }} />
          </>
        );
      case 'kingdee':
        return (
          <>
            {common}
            <ProFormText name="app_id" label="App ID" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText.Password name="app_secret" label="App Secret" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText name="acct_id" label="Acct ID" colProps={{ span: 12 }} />
            <ProFormText name="lcid" label="LCID" initialValue="2052" colProps={{ span: 12 }} />
          </>
        );
      case 'yonyou':
        return (
          <>
            {common}
            <ProFormText name="app_key" label="App Key" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText.Password name="app_secret" label="App Secret" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText name="corp_id" label="Corp ID" colProps={{ span: 12 }} />
            <ProFormText name="user_id" label="User ID" colProps={{ span: 12 }} />
          </>
        );
      case 'dsc':
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
      case 'inspur':
      case 'grasp_erp':
      case 'chanjet_tplus':
      case 'erpnext':
      case 'sunlike_erp':
        return (
          <>
            {common}
            <ProFormText name="app_key" label="App Key" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText.Password name="app_secret" label="App Secret" rules={[{ required: true }]} colProps={{ span: 12 }} />
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
      default:
        return <Alert title={t('pages.system.applicationConnections.noVisualForm', { type })} type="info" />;
    }
  };

  const canTestInForm = (type: string) => {
    return [
      'feishu', 'dingtalk', 'wecom',
      'sap', 'kingdee', 'yonyou', 'dsc', 'inspur', 'digiwin_e10',
      'grasp_erp', 'super_erp', 'chanjet_tplus', 'kingdee_kis',
      'oracle_netsuite', 'erpnext', 'odoo', 'sunlike_erp',
      'teamcenter', 'windchill', 'caxa', 'sanpin_plm', 'sunlike_plm', 'sipm', 'inteplm',
      'salesforce', 'xiaoshouyi', 'fenxiang', 'qidian', 'supra_crm',
      'weaver', 'seeyon', 'landray', 'cloudhub', 'tongda_oa',
      'rootcloud', 'casicloud', 'alicloud_iot', 'huaweicloud_iot', 'thingsboard', 'jetlinks',
      'flux_wms', 'kejian_wms', 'digiwin_wms', 'openwms',
    ].includes(type);
  };

  const columns: ProColumns<ApplicationConnection>[] = [
    { title: t('pages.system.applicationConnections.columnName'), dataIndex: 'name', width: 180, fixed: 'left' },
    { title: t('pages.system.applicationConnections.columnCode'), dataIndex: 'code', width: 140 },
    {
      title: t('pages.system.applicationConnections.columnType'),
      dataIndex: 'type',
      width: 120,
      render: (_, record) => {
        const info = getTypeInfo(record.type);
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    { title: t('pages.system.applicationConnections.columnDescription'), dataIndex: 'description', ellipsis: true, hideInSearch: true },
    {
      title: t('pages.system.applicationConnections.columnConnectionStatus'),
      dataIndex: 'is_connected',
      width: 100,
      render: (_, record) => {
        const s = getConnectionStatus(record);
        return <Badge status={s.status} text={s.text} />;
      },
    },
    {
      title: t('pages.system.applicationConnections.columnActive'),
      dataIndex: 'is_active',
      width: 80,
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? t('pages.system.applicationConnections.actionEnable') : t('pages.system.applicationConnections.actionDisable')}
        </Tag>
      ),
    },
    {
      title: t('pages.system.applicationConnections.columnLastConnected'),
      dataIndex: 'last_connected_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('pages.system.applicationConnections.columnCreatedAt'),
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('pages.system.applicationConnections.columnActions'),
      valueType: 'option',
      fixed: 'right',
      render: (_, record) =>
        [
            <Button {...rowActionKind('read')} key="view" onClick={() => handleView(record)}>
              {t('pages.system.applicationConnections.view')}
            </Button>,
            <Button {...rowActionKind('update')} key="edit" onClick={() => handleEdit(record)}>
              {t('pages.system.applicationConnections.edit')}
            </Button>,
            <Button {...rowActionKind('read')}
              key="test"
              type="link"
              size="small"
              icon={<ThunderboltOutlined />}
              onClick={() => handleTestConnection(record)}
            >
              {t('pages.system.applicationConnections.testConnection')}
            </Button>,
            <Popconfirm {...rowActionKind('delete')}
              key="delete"
              title={t('pages.system.applicationConnections.deleteConfirmTitle')}
              onConfirm={() => handleDelete(record)}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
            >
              <Button type="link" size="small" icon={<DeleteOutlined />} danger>
                {t('pages.system.applicationConnections.delete')}
              </Button>
            </Popconfirm>,
          ],
    },
  ];

  const detailColumns = [
    { title: t('pages.system.applicationConnections.columnName'), dataIndex: 'name' },
    { title: t('pages.system.applicationConnections.columnCode'), dataIndex: 'code' },
    {
      title: t('pages.system.applicationConnections.columnType'),
      dataIndex: 'type',
      render: (v: string) => {
        const info = getTypeInfo(v);
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    { title: t('pages.system.applicationConnections.columnDescription'), dataIndex: 'description' },
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
      title: t('pages.system.applicationConnections.columnActive'),
      dataIndex: 'is_active',
      render: (v: boolean) => (
        <Tag color={v ? 'success' : 'default'}>
          {v ? t('pages.system.applicationConnections.actionEnable') : t('pages.system.applicationConnections.actionDisable')}
        </Tag>
      ),
    },
    { title: t('pages.system.applicationConnections.columnLastConnected'), dataIndex: 'last_connected_at', valueType: 'dateTime' },
    { title: t('pages.system.applicationConnections.columnLastError'), dataIndex: 'last_error', render: (v: string) => v ? <Tag color="error">{v}</Tag> : t('common.dash') },
    { title: t('pages.system.applicationConnections.columnCreatedAt'), dataIndex: 'created_at', valueType: 'dateTime' },
    { title: t('pages.system.applicationConnections.columnUpdatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
  ];

  return (
    <>
      <ListPageTemplate statCards={statCards}>
        <UniTable<ApplicationConnection>
          columnPersistenceId="pages.system.application-connections.list"
          actionRef={actionRef}
          columns={columns}
          request={async (params, _sort, _filter, searchFormValues) => {
            const apiParams: any = {
              page: params.current || 1,
              page_size: params.pageSize || 20,
            };
            if (searchFormValues?.search) apiParams.search = searchFormValues.search;
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
          deleteButtonText={t('pages.system.applicationConnections.batchDeleteButton')}
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
            const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = t('pages.system.applicationConnections.exportFileName', {
              date: new Date().toISOString().slice(0, 10),
            });
            a.click();
            URL.revokeObjectURL(url);
            messageApi.success(t('common.exportSuccess', { count: items.length }));
          }}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={isEdit ? t('pages.system.applicationConnections.editModalTitle') : t('pages.system.applicationConnections.createModalTitle')}
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
                  icon={<ThunderboltOutlined />}
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
        <ProFormText name="type" label={t('pages.system.applicationConnections.columnType')} disabled colProps={{ span: 12 }} />
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
          label={t('pages.system.applicationConnections.columnDescription')}
          placeholder={t('pages.system.applicationConnections.descPlaceholder')}
          fieldProps={{ rows: 3 }}
          colProps={{ span: 24 }}
        />
        <ProFormSwitch name="is_active" label={t('pages.system.applicationConnections.columnActive')} colProps={{ span: 12 }} />
      </FormModalTemplate>

      <AppConnectorMarket
        open={connectorMarketVisible}
        onClose={() => setConnectorMarketVisible(false)}
        onSelect={handleConnectorSelect}
      />

      <UniDetail
        title={t('pages.system.applicationConnections.detailTitle')}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        basic={
          detailData ? (
            <Descriptions column={1} items={detailDrawerDescriptionItems(detailColumns as any, detailData)} />
          ) : null
        }
        extra={
          detailData && (
            <Space>
              <Button type="primary" icon={<EditOutlined />} onClick={() => { setDrawerVisible(false); handleEdit(detailData); }}>
                {t('pages.system.applicationConnections.edit')}
              </Button>
              <Button icon={<ThunderboltOutlined />} onClick={() => handleTestConnection(detailData)}>
                {t('pages.system.applicationConnections.testConnection')}
              </Button>
              <Popconfirm
                title={t('pages.system.applicationConnections.deleteConfirmTitle')}
                onConfirm={() => { handleDelete(detailData); setDrawerVisible(false); }}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
              >
                <Button danger icon={<DeleteOutlined />}>{t('pages.system.applicationConnections.delete')}</Button>
              </Popconfirm>
            </Space>
          )
        }
      />
    </>
  );
};

export default ApplicationConnectionsListPage;
