/**
 * 应用连接器管理列表页面
 *
 * 用于系统管理员查看和管理组织内的应用连接器（飞书、钉钉、ERP、PLM、CRM 等）。
 */

import React, { useRef, useState, useMemo } from 'react';
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
  Dropdown,
  Modal,
} from 'antd';
import {
  DeleteOutlined,
  EyeOutlined,
  ThunderboltOutlined,
  EditOutlined,
  MoreOutlined,
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
  ListPageTemplate,
  FormModalTemplate,
  DetailDrawerTemplate,
  MODAL_CONFIG,
  DRAWER_CONFIG,
} from '../../../../components/layout-templates';
import AppConnectorMarket from '../AppConnectorMarket';
import type { AppConnectorDefinition } from '../connectors';
import {
  getApplicationConnectionList,
  getApplicationConnectionByUuid,
  createApplicationConnection,
  updateApplicationConnection,
  deleteApplicationConnection,
  testApplicationConnection,
  testApplicationConnectionConfig,
  ApplicationConnection,
} from '../../../../services/applicationConnection';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const {  } = Typography;

const TYPE_DISPLAY: Record<string, string> = {
  feishu: '飞书',
  dingtalk: '钉钉',
  wecom: '企业微信',
  sap: 'SAP',
  kingdee: '金蝶',
  yonyou: '用友',
  dsc: '鼎捷',
  inspur: '浪潮',
  digiwin_e10: '鼎捷 E10',
  grasp_erp: '管家婆',
  super_erp: '速达 ERP',
  chanjet_tplus: '畅捷通 T+',
  kingdee_kis: '金蝶 KIS',
  oracle_netsuite: 'Oracle NetSuite',
  erpnext: 'ERPNext',
  odoo: 'Odoo',
  sunlike_erp: '天心天思 ERP',
  teamcenter: 'Teamcenter',
  windchill: 'Windchill',
  caxa: 'CAXA (数码大方)',
  sanpin_plm: '三品 PLM',
  sunlike_plm: '天心天思 PLM',
  sipm: '思普 PLM',
  inteplm: '英特 PLM',
  salesforce: 'Salesforce',
  xiaoshouyi: '销售易',
  fenxiang: '纷享销客',
  qidian: '腾讯企点',
  supra_crm: '超兔 CRM',
  weaver: '泛微 OA',
  seeyon: '致远 OA',
  landray: '蓝凌 OA',
  cloudhub: '云之家',
  tongda_oa: '通达 OA',
  rootcloud: '树根互联',
  casicloud: '航天云网',
  alicloud_iot: '阿里云 IoT',
  huaweicloud_iot: '华为云 IoT',
  thingsboard: 'ThingsBoard',
  jetlinks: 'JetLinks',
  flux_wms: '富勒 WMS',
  kejian_wms: '科箭 WMS',
  digiwin_wms: '鼎捷 WMS',
  openwms: 'OpenWMS',
};

const getTypeInfo = (type: string): { color: string; text: string; icon: React.ReactNode } => {
  const typeMap: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
    feishu: { color: 'blue', text: '飞书', icon: <MessageOutlined /> },
    dingtalk: { color: 'cyan', text: '钉钉', icon: <MessageOutlined /> },
    wecom: { color: 'green', text: '企业微信', icon: <MessageOutlined /> },
    sap: { color: 'gold', text: 'SAP', icon: <DatabaseOutlined /> },
    kingdee: { color: 'orange', text: '金蝶', icon: <CloudOutlined /> },
    yonyou: { color: 'purple', text: '用友', icon: <CloudOutlined /> },
    dsc: { color: 'magenta', text: '鼎捷', icon: <DatabaseOutlined /> },
    inspur: { color: 'cyan', text: '浪潮', icon: <CloudOutlined /> },
    digiwin_e10: { color: 'blue', text: '鼎捷 E10', icon: <DatabaseOutlined /> },
    grasp_erp: { color: 'orange', text: '管家婆', icon: <DatabaseOutlined /> },
    super_erp: { color: 'magenta', text: '速达 ERP', icon: <DatabaseOutlined /> },
    chanjet_tplus: { color: 'blue', text: '畅捷通 T+', icon: <CloudOutlined /> },
    kingdee_kis: { color: 'cyan', text: '金蝶 KIS', icon: <CloudOutlined /> },
    oracle_netsuite: { color: 'blue', text: 'Oracle NetSuite', icon: <CloudOutlined /> },
    erpnext: { color: 'blue', text: 'ERPNext', icon: <CloudOutlined /> },
    odoo: { color: 'purple', text: 'Odoo', icon: <CloudOutlined /> },
    sunlike_erp: { color: 'cyan', text: '天心天思 ERP', icon: <DatabaseOutlined /> },
    teamcenter: { color: 'blue', text: 'Teamcenter', icon: <AppstoreOutlined /> },
    windchill: { color: 'geekblue', text: 'Windchill', icon: <AppstoreOutlined /> },
    caxa: { color: 'blue', text: 'CAXA (数码大方)', icon: <AppstoreOutlined /> },
    sanpin_plm: { color: 'cyan', text: '三品 PLM', icon: <AppstoreOutlined /> },
    sunlike_plm: { color: 'geekblue', text: '天心天思 PLM', icon: <AppstoreOutlined /> },
    sipm: { color: 'cyan', text: '思普 PLM', icon: <AppstoreOutlined /> },
    inteplm: { color: 'geekblue', text: '英特 PLM', icon: <AppstoreOutlined /> },
    salesforce: { color: 'cyan', text: 'Salesforce', icon: <TeamOutlined /> },
    xiaoshouyi: { color: 'green', text: '销售易', icon: <TeamOutlined /> },
    fenxiang: { color: 'orange', text: '纷享销客', icon: <TeamOutlined /> },
    qidian: { color: 'blue', text: '腾讯企点', icon: <TeamOutlined /> },
    supra_crm: { color: 'volcano', text: '超兔 CRM', icon: <TeamOutlined /> },
    weaver: { color: 'purple', text: '泛微 OA', icon: <ApartmentOutlined /> },
    seeyon: { color: 'geekblue', text: '致远 OA', icon: <ApartmentOutlined /> },
    landray: { color: 'cyan', text: '蓝凌 OA', icon: <ApartmentOutlined /> },
    cloudhub: { color: 'blue', text: '云之家', icon: <ApartmentOutlined /> },
    tongda_oa: { color: 'purple', text: '通达 OA', icon: <ApartmentOutlined /> },
    rootcloud: { color: 'blue', text: '树根互联', icon: <RocketOutlined /> },
    casicloud: { color: 'cyan', text: '航天云网', icon: <InteractionOutlined /> },
    alicloud_iot: { color: 'orange', text: '阿里云 IoT', icon: <CloudOutlined /> },
    huaweicloud_iot: { color: 'red', text: '华为云 IoT', icon: <CloudOutlined /> },
    thingsboard: { color: 'green', text: 'ThingsBoard', icon: <RocketOutlined /> },
    jetlinks: { color: 'blue', text: 'JetLinks', icon: <RocketOutlined /> },
    flux_wms: { color: 'gold', text: '富勒 WMS', icon: <DatabaseOutlined /> },
    kejian_wms: { color: 'orange', text: '科箭 WMS', icon: <CloudOutlined /> },
    digiwin_wms: { color: 'cyan', text: '鼎捷 WMS', icon: <DatabaseOutlined /> },
    openwms: { color: 'green', text: 'OpenWMS', icon: <DatabaseOutlined /> },
  };
  return typeMap[type] || { color: 'default', text: TYPE_DISPLAY[type] || type, icon: <AppstoreOutlined /> };
};

const getConnectionStatus = (
  conn: ApplicationConnection
): { status: 'success' | 'error' | 'warning' | 'default'; text: string } => {
  if (!conn.is_active) return { status: 'default', text: '已禁用' };
  if (conn.is_connected) return { status: 'success', text: '已连接' };
  if (conn.last_error) return { status: 'error', text: '连接失败' };
  return { status: 'warning', text: '未连接' };
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
  const [testingConnection, setTestingConnection] = useState(false);
  const [allConnections, setAllConnections] = useState<ApplicationConnection[]>([]);
  const [connectorMarketVisible, setConnectorMarketVisible] = useState(false);
  const formRef = useRef<ProFormInstance>(null);

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
      messageApi.error(error.message || '获取详情失败');
    }
  };

  const handleView = async (record: ApplicationConnection) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getApplicationConnectionByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleBatchStatus = async (enable: boolean) => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请先选择要操作的应用连接器');
      return;
    }
    try {
      let done = 0;
      for (const uuid of selectedRowKeys) {
        await updateApplicationConnection(String(uuid), { is_active: enable });
        done++;
      }
      messageApi.success(`已${enable ? '启用' : '禁用'} ${done} 个应用连接器`);
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || '操作失败');
    }
  };

  const handleBatchTest = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请先选择要测试的应用连接器');
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
    messageApi.info(`测试完成：成功 ${ok}，失败 ${fail}`);
    actionRef.current?.reload();
  };

  const handleDelete = async (record: ApplicationConnection) => {
    try {
      await deleteApplicationConnection(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请先选择要删除的应用连接器');
      return;
    }
    Modal.confirm({
      title: `确定要删除选中的 ${selectedRowKeys.length} 个应用连接器吗？`,
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          let done = 0;
          let fail = 0;
          for (const uuid of selectedRowKeys) {
            try {
              await deleteApplicationConnection(String(uuid));
              done++;
            } catch {
              fail++;
            }
          }
          if (fail > 0) {
            messageApi.warning(`删除完成：成功 ${done} 个，失败 ${fail} 个`);
          } else {
            messageApi.success(`已删除 ${done} 个应用连接器`);
          }
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error?.message || '批量删除失败');
        }
      },
    });
  };

  const handleTestConnectionInForm = async () => {
    try {
      const values = await formRef.current?.validateFields();
      if (!values) return;
      const { type, name, code, description, is_active, ...restConfig } = values;
      setTestingConnection(true);
      const result = await testApplicationConnectionConfig(type, restConfig);
      if (result.success) {
        messageApi.success(result.message || '连接测试成功');
      } else {
        messageApi.error(result.message || result.error || '连接测试失败');
      }
    } catch (error: any) {
      if (error?.errorFields) {
        messageApi.warning('请先填写完整的连接配置');
      } else {
        messageApi.error(error?.message || '连接测试失败');
      }
    } finally {
      setTestingConnection(false);
    }
  };

  const handleTestConnection = async (record: ApplicationConnection) => {
    try {
      const result = await testApplicationConnection(record.uuid);
      if (result.success) {
        messageApi.success(result.message || '连接测试成功');
      } else {
        messageApi.error(result.message || result.error || '连接测试失败');
      }
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '连接测试失败');
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
        messageApi.success('更新成功');
      } else {
        await createApplicationConnection({
          name,
          code,
          type,
          description,
          config,
          is_active,
        });
        messageApi.success('创建成功');
      }
      setModalVisible(false);
      setFormInitialValues(undefined);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
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
      { title: '总应用连接数', value: stats.total, valueStyle: { color: '#1890ff' } },
      { title: '已连接', value: stats.connected, valueStyle: { color: '#52c41a' } },
      { title: '未连接', value: stats.disconnected, valueStyle: { color: '#ff4d4f' } },
      { title: '已禁用', value: stats.inactive, valueStyle: { color: '#faad14' } },
    ];
  }, [allConnections]);

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
            <ProFormText name="aes_key" label="加密 aes_key" colProps={{ span: 12 }} />
            <ProFormText name="token" label="签名 token" colProps={{ span: 12 }} />
          </>
        );
      case 'wecom':
        return (
          <>
            <ProFormText name="corp_id" label="企业 ID" rules={[{ required: true }]} colProps={{ span: 12 }} />
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
            <ProFormText name="username" label="用户名" rules={[{ required: true }]} colProps={{ span: 12 }} />
            <ProFormText.Password name="password" label="密码" rules={[{ required: true }]} colProps={{ span: 12 }} />
          </>
        );
      case 'kingdee_kis':
      case 'cloudhub':
        return (
          <>
            {common}
            <ProFormText name="instance_id" label="实例 ID / APP ID" rules={[{ required: true }]} colProps={{ span: 12 }} />
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
        return <Alert message={`暂未为 ${type} 类型提供可视化表单`} type="info" />;
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
    { title: '应用连接名称', dataIndex: 'name', width: 180, fixed: 'left' },
    { title: '应用连接代码', dataIndex: 'code', width: 140 },
    {
      title: '连接器类型',
      dataIndex: 'type',
      width: 120,
      render: (_, record) => {
        const info = getTypeInfo(record.type);
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    { title: '描述', dataIndex: 'description', ellipsis: true, hideInSearch: true },
    {
      title: '连接状态',
      dataIndex: 'is_connected',
      width: 100,
      render: (_, record) => {
        const s = getConnectionStatus(record);
        return <Badge status={s.status} text={s.text} />;
      },
    },
    {
      title: '启用状态',
      dataIndex: 'is_active',
      width: 80,
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>{record.is_active ? '启用' : '禁用'}</Tag>
      ),
    },
    {
      title: '最后连接时间',
      dataIndex: 'last_connected_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(record)}>
            查看
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Dropdown
            menu={{
              items: [
                { key: 'test', icon: <ThunderboltOutlined />, label: '测试连接', onClick: () => handleTestConnection(record) },
                {
                  key: 'delete',
                  icon: <DeleteOutlined />,
                  label: '删除',
                  danger: true,
                  onClick: () => {
                    Modal.confirm({
                      title: '确定要删除这个应用连接器吗？',
                      okText: '确定',
                      cancelText: '取消',
                      okType: 'danger',
                      onOk: () => handleDelete(record),
                    });
                  },
                },
              ],
            }}
          >
            <Button type="link" size="small" icon={<MoreOutlined />}>更多</Button>
          </Dropdown>
        </Space>
      ),
    },
  ];

  const detailColumns = [
    { title: '应用连接名称', dataIndex: 'name' },
    { title: '应用连接代码', dataIndex: 'code' },
    {
      title: '连接器类型',
      dataIndex: 'type',
      render: (v: string) => {
        const info = getTypeInfo(v);
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    { title: '描述', dataIndex: 'description' },
    {
      title: '连接配置',
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
      title: '连接状态',
      dataIndex: 'is_connected',
      render: (v: boolean) => <Badge status={v ? 'success' : 'default'} text={v ? '已连接' : '未连接'} />,
    },
    { title: '启用状态', dataIndex: 'is_active', render: (v: boolean) => <Tag color={v ? 'success' : 'default'}>{v ? '启用' : '禁用'}</Tag> },
    { title: '最后连接时间', dataIndex: 'last_connected_at', valueType: 'dateTime' },
    { title: '最后错误', dataIndex: 'last_error', render: (v: string) => v ? <Tag color="error">{v}</Tag> : '-' },
    { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime' },
    { title: '更新时间', dataIndex: 'updated_at', valueType: 'dateTime' },
  ];

  return (
    <>
      <ListPageTemplate statCards={statCards}>
        <UniTable<ApplicationConnection>
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
                  const allRes = await getApplicationConnectionList({ page: 1, page_size: 1000 });
                  setAllConnections(allRes.items);
                } catch {
                  // ignore
                }
              }
              return { data: result.items, success: true, total: result.total };
            } catch (error: any) {
              messageApi.error(error?.message || '获取列表失败');
              return { data: [], success: false, total: 0 };
            }
          }}
          rowKey="uuid"
          showAdvancedSearch={true}
          showCreateButton
          onCreate={handleCreate}
          createButtonText="新建应用连接"
          enableRowSelection
          onRowSelectionChange={setSelectedRowKeys}
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteButtonText="批量删除"
          toolBarRender={() =>
            selectedRowKeys.length > 0
              ? [
                  <Button key="batch-test" onClick={handleBatchTest}>批量测试连接</Button>,
                  <Button key="batch-enable" onClick={() => handleBatchStatus(true)}>批量启用</Button>,
                  <Button key="batch-disable" onClick={() => handleBatchStatus(false)}>批量禁用</Button>,
                ]
              : []
          }
          showImportButton
          onImport={async (data) => {
            if (!data || data.length < 2) {
              messageApi.warning('请填写导入数据');
              return;
            }
            const headers = (data[0] || []).map((h: any) => String(h || '').replace(/^\*/, '').trim());
            const rows = data.slice(1).filter((row: any[]) => row.some((c: any) => c != null && String(c).trim()));
            const fieldMap: Record<string, string> = {
              '名称': 'name', 'name': 'name',
              '代码': 'code', 'code': 'code',
              '类型': 'type', 'type': 'type',
              '描述': 'description', 'description': 'description',
              '启用状态': 'is_active', 'is_active': 'is_active',
              '连接配置(JSON)': 'config_json', 'config_json': 'config_json',
            };
            let done = 0;
            const ts = Date.now();
            for (let i = 0; i < rows.length; i++) {
              const row = rows[i];
              const obj: Record<string, any> = {};
              headers.forEach((h, idx) => {
                const field = fieldMap[h] || fieldMap[h?.trim()];
                if (field && row[idx] != null) obj[field] = row[idx];
              });
              if (obj.name && obj.code && obj.type) {
                let config: Record<string, any> = {};
                if (obj.config_json) {
                  try {
                    config = JSON.parse(String(obj.config_json));
                  } catch {
                    config = {};
                  }
                }
                await createApplicationConnection({
                  name: String(obj.name),
                  code: `${String(obj.code).replace(/[^a-z0-9_]/g, '_').slice(0, 30)}_${ts}${i}`,
                  type: String(obj.type),
                  config,
                  description: obj.description ? String(obj.description) : undefined,
                  is_active: obj.is_active !== 'false' && obj.is_active !== '0' && obj.is_active !== '',
                });
                done++;
              }
            }
            messageApi.success(`成功导入 ${done} 个应用连接`);
            actionRef.current?.reload();
          }}
          importHeaders={['*名称', '*代码', '*类型', '描述', '启用状态', '连接配置(JSON)']}
          importExampleRow={['示例连接', 'example_conn', 'feishu', '选填', '是', '{}']}
          showExportButton
          onExport={async (type, keys, pageData) => {
            let items: ApplicationConnection[] = [];
            if (type === 'selected' && keys?.length) {
              items = await Promise.all(keys.map((k) => getApplicationConnectionByUuid(String(k))));
            } else if (type === 'currentPage' && pageData?.length) {
              items = pageData;
            } else {
              const res = await getApplicationConnectionList({ page: 1, page_size: 1000 });
              items = res.items;
            }
            if (items.length === 0) {
              messageApi.warning('暂无数据可导出');
              return;
            }
            const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `application-connections-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            messageApi.success('导出成功');
          }}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={isEdit ? '编辑应用连接器' : '新建应用连接器'}
        open={modalVisible}
        onClose={() => { setModalVisible(false); setFormInitialValues(undefined); }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        initialValues={formInitialValues}
        loading={formLoading}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
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
                  测试连接
                </Button>
              );
            }}
          </ProFormDependency>
        }
      >
        <ProFormText name="type" label="连接器类型" disabled colProps={{ span: 12 }} />
        <ProFormText name="name" label="应用连接名称" rules={[{ required: true }]} placeholder="例：生产环境连接" colProps={{ span: 12 }} />
        <ProFormText
          name="code"
          label="应用连接代码"
          rules={[
            { required: true },
            { pattern: /^[a-z0-9_]+$/, message: '只能包含小写字母、数字和下划线' },
          ]}
          placeholder="例：prod_connection"
          disabled={isEdit}
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
          label="描述"
          placeholder="选填"
          fieldProps={{ rows: 3 }}
          colProps={{ span: 24 }}
        />
        <ProFormSwitch name="is_active" label="启用状态" colProps={{ span: 12 }} />
      </FormModalTemplate>

      <AppConnectorMarket
        open={connectorMarketVisible}
        onClose={() => setConnectorMarketVisible(false)}
        onSelect={handleConnectorSelect}
      />

      <DetailDrawerTemplate<ApplicationConnection>
        title="应用连接器详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        dataSource={(detailData || {}) as ApplicationConnection}
        columns={detailColumns as any}
        extra={
          detailData && (
            <Space>
              <Button type="primary" icon={<EditOutlined />} onClick={() => { setDrawerVisible(false); handleEdit(detailData); }}>
                编辑
              </Button>
              <Button icon={<ThunderboltOutlined />} onClick={() => handleTestConnection(detailData)}>
                测试连接
              </Button>
              <Popconfirm title="确定要删除吗？" onConfirm={() => { handleDelete(detailData); setDrawerVisible(false); }} okText="确定" cancelText="取消">
                <Button danger icon={<DeleteOutlined />}>删除</Button>
              </Popconfirm>
            </Space>
          )
        }
      />
    </>
  );
};

export default ApplicationConnectionsListPage;
