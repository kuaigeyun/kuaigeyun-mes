/**
 * 打印设备管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的打印设备。
 * 支持打印设备的 CRUD 操作和打印设备连接测试功能。
 */

import React, { useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSelect, ProFormSwitch, ProFormInstance, ProForm } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../components/safe-pro-form-select';
import { App, Popconfirm, Button, Tag, Drawer, Modal, message, Input, Form, Space, Badge, Typography, Tooltip, Card, theme } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, PlusOutlined, PrinterOutlined, CheckCircleOutlined, PrinterFilled } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../components/layout-templates';
import {
  getPrintDeviceList,
  getPrintDeviceByUuid,
  createPrintDevice,
  updatePrintDevice,
  deletePrintDevice,
  testPrintDevice,
  printWithDevice,
  PrintDevice,
  CreatePrintDeviceData,
  UpdatePrintDeviceData,
  PrintDeviceTestResponse,
  PrintDevicePrintData,
  PrintDevicePrintResponse,
} from '../../../../services/printDevice';
import { CODE_FONT_FAMILY } from '../../../../constants/fonts';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { TextArea } = Input;
const { Text, Paragraph } = Typography;
const { useToken } = theme;

type TFunction = (key: string) => string;

/**
 * 获取设备类型图标和颜色（需传入 t 以支持 i18n）
 */
const getTypeInfo = (type: string, t: TFunction): { color: string; text: string; icon: React.ReactNode } => {
  const typeMap: Record<string, { color: string; textKey: string; icon: React.ReactNode }> = {
    local: { color: 'blue', textKey: 'pages.system.printDevices.typeLocal', icon: <PrinterFilled /> },
    network: { color: 'green', textKey: 'pages.system.printDevices.typeNetwork', icon: <PrinterFilled /> },
    cloud: { color: 'purple', textKey: 'pages.system.printDevices.typeCloud', icon: <PrinterFilled /> },
    other: { color: 'default', textKey: 'pages.system.printDevices.typeOther', icon: <PrinterFilled /> },
  };
  const info = typeMap[type] || { color: 'default', textKey: '', icon: <PrinterFilled /> };
  return { ...info, text: info.textKey ? t(info.textKey) : type };
};

/**
 * 获取设备状态显示（需传入 t 以支持 i18n）
 */
const getDeviceStatus = (device: PrintDevice, t: TFunction): {
  status: 'success' | 'error' | 'warning' | 'default';
  text: string;
  onlineStatus: 'success' | 'error' | 'default';
  onlineText: string;
} => {
  if (!device.is_active) {
    const text = t('pages.system.printDevices.statusDisabled');
    return { status: 'default', text, onlineStatus: 'default', onlineText: text };
  }
  if (device.is_online) {
    const text = t('pages.system.printDevices.statusOnline');
    return { status: 'success', text, onlineStatus: 'success', onlineText: text };
  }
  const text = t('pages.system.printDevices.statusOffline');
  return { status: 'error', text, onlineStatus: 'error', onlineText: text };
};

/**
 * 打印设备管理列表页面组件
 */
const PrintDeviceListPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = useToken();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [allDevices, setAllDevices] = useState<PrintDevice[]>([]); // 用于统计
  
  // Modal 相关状态（创建/编辑打印设备）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentPrintDeviceUuid, setCurrentPrintDeviceUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | undefined>(undefined);
  const [configJson, setConfigJson] = useState<string>('{}');
  
  // Modal 相关状态（测试连接）
  const [testModalVisible, setTestModalVisible] = useState(false);
  const [testFormLoading, setTestFormLoading] = useState(false);
  const [currentTestDeviceUuid, setCurrentTestDeviceUuid] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<PrintDeviceTestResponse | null>(null);
  
  // Modal 相关状态（执行打印）
  const [printModalVisible, setPrintModalVisible] = useState(false);
  const [printFormLoading, setPrintFormLoading] = useState(false);
  const [currentPrintDeviceUuidForPrint, setCurrentPrintDeviceUuidForPrint] = useState<string | null>(null);
  const [printFormRef] = Form.useForm();
  const [printResult, setPrintResult] = useState<PrintDevicePrintResponse | null>(null);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<PrintDevice | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /**
   * 处理新建打印设备
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentPrintDeviceUuid(null);
    setConfigJson('{}');
    setFormInitialValues({
      type: 'network',
      is_active: true,
      is_default: false,
    });
    setModalVisible(true);
  };

  /**
   * 处理编辑打印设备
   */
  const handleEdit = async (record: PrintDevice) => {
    try {
      setIsEdit(true);
      setCurrentPrintDeviceUuid(record.uuid);
      
      // 获取打印设备详情
      const detail = await getPrintDeviceByUuid(record.uuid);
      setConfigJson(JSON.stringify(detail.config, null, 2));
      setFormInitialValues({
        name: detail.name,
        code: detail.code,
        type: detail.type,
        description: detail.description,
        is_active: detail.is_active,
        is_default: detail.is_default,
      });
      setModalVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.printDevices.getDetailFailed'));
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: PrintDevice) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getPrintDeviceByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.printDevices.getDetailFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理测试连接
   */
  const handleTest = async (record: PrintDevice) => {
    setCurrentTestDeviceUuid(record.uuid);
    setTestModalVisible(true);
    setTestResult(null);
    
    try {
      setTestFormLoading(true);
      const result = await testPrintDevice(record.uuid);
      setTestResult(result);
      
      if (result.success) {
        messageApi.success(result.message || t('pages.system.printDevices.testSuccess'));
      } else {
        messageApi.error(result.error || t('pages.system.printDevices.testFailed'));
      }
      
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.printDevices.testFailed'));
    } finally {
      setTestFormLoading(false);
    }
  };

  /**
   * 处理执行打印
   */
  const handlePrint = (record: PrintDevice) => {
    setCurrentPrintDeviceUuidForPrint(record.uuid);
    setPrintModalVisible(true);
    setPrintResult(null);
    printFormRef.current?.resetFields();
    printFormRef.current?.setFieldsValue({
      async_execution: false,
    });
  };

  /**
   * 处理执行打印表单提交
   */
  const handlePrintSubmit = async (values: any) => {
    if (!currentPrintDeviceUuidForPrint) return;
    
    try {
      setPrintFormLoading(true);
      setPrintResult(null);
      
      const data: PrintDevicePrintData = {
        template_uuid: values.template_uuid,
        data: values.data ? JSON.parse(values.data) : {},
        async_execution: values.async_execution || false,
      };
      
      const result = await printWithDevice(currentPrintDeviceUuidForPrint, data);
      setPrintResult(result);
      
      if (result.success) {
        messageApi.success(result.message || t('pages.system.printDevices.printSubmitted'));
      } else {
        messageApi.error(result.error || t('pages.system.printDevices.printFailed'));
      }
      
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.printDevices.printFailed'));
    } finally {
      setPrintFormLoading(false);
    }
  };

  /**
   * 处理删除打印设备
   */
  const handleDelete = async (record: PrintDevice) => {
    try {
      await deletePrintDevice(record.uuid);
      messageApi.success(t('pages.system.printDevices.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.printDevices.deleteFailed'));
    }
  };

  /**
   * 处理批量删除
   */
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('pages.system.printDevices.selectToDelete'));
      return;
    }
    
    try {
      await Promise.all(selectedRowKeys.map((key) => deletePrintDevice(key as string)));
      messageApi.success(t('pages.system.printDevices.batchDeleteSuccess'));
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(t('pages.system.printDevices.batchDeleteFailed'));
    }
  };

  /**
   * 处理表单提交
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      setFormLoading(true);
      
      // 解析 JSON 配置
      let config: Record<string, any>;
      try {
        config = JSON.parse(configJson);
      } catch (e) {
        const msg = t('pages.system.printDevices.configJsonError');
        messageApi.error(msg);
        throw new Error(msg);
      }
      
      const data: CreatePrintDeviceData | UpdatePrintDeviceData = {
        ...values,
        config,
      };
      
      if (isEdit && currentPrintDeviceUuid) {
        await updatePrintDevice(currentPrintDeviceUuid, data as UpdatePrintDeviceData);
        messageApi.success(t('pages.system.printDevices.updateSuccess'));
      } else {
        await createPrintDevice(data as CreatePrintDeviceData);
        messageApi.success(t('pages.system.printDevices.createSuccess'));
      }
      
      setModalVisible(false);
      setFormInitialValues(undefined);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.printDevices.operationFailed'));
      throw error;
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 计算统计信息
   */
  const statCards = useMemo(() => {
    if (allDevices.length === 0) return undefined;
    
    const stats = {
      total: allDevices.length,
      active: allDevices.filter((d) => d.is_active).length,
      inactive: allDevices.filter((d) => !d.is_active).length,
      online: allDevices.filter((d) => d.is_online && d.is_active).length,
      offline: allDevices.filter((d) => !d.is_online && d.is_active).length,
      default: allDevices.filter((d) => d.is_default).length,
      totalUsage: allDevices.reduce((sum, d) => sum + (d.usage_count || 0), 0),
    };

    return [
      { title: t('pages.system.printDevices.statTotal'), value: stats.total, valueStyle: { color: '#1890ff' } },
      { title: t('pages.system.printDevices.statOnline'), value: stats.online, valueStyle: { color: '#52c41a' } },
      { title: t('pages.system.printDevices.statOffline'), value: stats.offline, valueStyle: { color: '#ff4d4f' } },
      { title: t('pages.system.printDevices.statActive'), value: stats.active, valueStyle: { color: '#52c41a' } },
    ];
  }, [allDevices, t]);

  /**
   * 卡片渲染函数
   */
  const renderCard = (device: PrintDevice, index: number) => {
    const typeInfo = getTypeInfo(device.type, t);
    const deviceStatus = getDeviceStatus(device, t);
    
    return (
      <Card
        key={device.uuid}
        hoverable
        style={{ height: '100%' }}
        actions={[
          <Tooltip key="view" title={t('pages.system.printDevices.viewDetail')}>
            <EyeOutlined
              onClick={() => handleView(device)}
              style={{ fontSize: 16 }}
            />
          </Tooltip>,
          <Tooltip key="test" title={t('pages.system.printDevices.testConnection')}>
            <CheckCircleOutlined
              onClick={() => handleTest(device)}
              disabled={!device.is_active}
              style={{ 
                fontSize: 16, 
                color: device.is_active ? '#1890ff' : '#d9d9d9',
              }}
            />
          </Tooltip>,
          <Popconfirm
            key="delete"
            title={t('pages.system.printDevices.deleteConfirmTitle')}
            onConfirm={() => handleDelete(device)}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
          >
            <Tooltip title={t('pages.system.printDevices.deleteTooltip')}>
              <DeleteOutlined
                style={{ fontSize: 16, color: '#ff4d4f' }}
              />
            </Tooltip>
          </Popconfirm>,
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong style={{ fontSize: 16 }}>
                {device.name}
              </Text>
              <Tag color={typeInfo.color} icon={typeInfo.icon}>
                {typeInfo.text}
              </Tag>
            </div>
            
            {device.code && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('pages.system.printDevices.codePrefix')}{device.code}
              </Text>
            )}
            
            {device.description && (
              <Paragraph
                ellipsis={{ rows: 2, expandable: false }}
                style={{ marginBottom: 0, fontSize: 12 }}
              >
                {device.description}
              </Paragraph>
            )}
          </Space>
        </div>
        
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${token.colorBorder}` }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.printDevices.onlineStatusLabel')}</Text>
              <Badge
                status={deviceStatus.onlineStatus}
                text={deviceStatus.onlineText}
              />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.printDevices.statusLabel')}</Text>
              <Tag color={device.is_active ? 'success' : 'default'}>
                {device.is_active ? t('pages.system.printDevices.enabled') : t('pages.system.printDevices.disabled')}
              </Tag>
            </div>
            
            {device.is_default && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.printDevices.defaultLabel')}</Text>
                <Tag color="processing">{t('pages.system.printDevices.isDefault')}</Tag>
              </div>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.printDevices.usageLabel')}</Text>
              <Text style={{ fontSize: 12 }}>{device.usage_count || 0}</Text>
            </div>
            
            {device.last_connected_at && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.printDevices.lastConnectedLabel')}</Text>
                <Text style={{ fontSize: 12 }}>
                  {dayjs(device.last_connected_at).fromNow()}
                </Text>
              </div>
            )}
            
            {device.last_used_at && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.printDevices.lastUsedLabel')}</Text>
                <Text style={{ fontSize: 12 }}>
                  {dayjs(device.last_used_at).fromNow()}
                </Text>
              </div>
            )}
          </Space>
        </div>
      </Card>
    );
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<PrintDevice>[] = [
    {
      title: t('pages.system.printDevices.columnName'),
      dataIndex: 'name',
      width: 200,
      ellipsis: true,
    },
    {
      title: t('pages.system.printDevices.columnCode'),
      dataIndex: 'code',
      width: 150,
      ellipsis: true,
    },
    {
      title: t('pages.system.printDevices.columnType'),
      dataIndex: 'type',
      width: 120,
      valueType: 'select',
      valueEnum: {
        local: { text: t('pages.system.printDevices.typeLocal') },
        network: { text: t('pages.system.printDevices.typeNetwork') },
        cloud: { text: t('pages.system.printDevices.typeCloud') },
        other: { text: t('pages.system.printDevices.typeOther') },
      },
      render: (_, record) => {
        const typeInfo = getTypeInfo(record.type, t);
        return <Tag color={typeInfo.color}>{typeInfo.text}</Tag>;
      },
    },
    {
      title: t('pages.system.printDevices.columnActive'),
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('pages.system.printDevices.enabled'), status: 'Success' },
        false: { text: t('pages.system.printDevices.disabled'), status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? t('pages.system.printDevices.enabled') : t('pages.system.printDevices.disabled')}
        </Tag>
      ),
    },
    {
      title: t('pages.system.printDevices.columnOnline'),
      dataIndex: 'is_online',
      width: 100,
      hideInSearch: true,
      render: (_, record) => (
        <Tag color={record.is_online ? 'success' : 'error'}>
          {record.is_online ? t('pages.system.printDevices.statusOnline') : t('pages.system.printDevices.statusOffline')}
        </Tag>
      ),
    },
    {
      title: t('pages.system.printDevices.columnDefault'),
      dataIndex: 'is_default',
      width: 100,
      hideInSearch: true,
      render: (_, record) => (
        <Tag color={record.is_default ? 'processing' : 'default'}>
          {record.is_default ? t('pages.system.printDevices.defaultTag') : '-'}
        </Tag>
      ),
    },
    {
      title: t('pages.system.printDevices.columnUsage'),
      dataIndex: 'usage_count',
      width: 100,
      hideInSearch: true,
    },
    {
      title: t('pages.system.printDevices.columnLastUsed'),
      dataIndex: 'last_used_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
    },
    {
      title: t('pages.system.printDevices.columnCreatedAt'),
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
    },
  ];

  /**
   * 详情列定义
   */
  const detailColumns = [
    { title: t('pages.system.printDevices.columnName'), dataIndex: 'name' },
    { title: t('pages.system.printDevices.columnCode'), dataIndex: 'code' },
    { title: t('pages.system.printDevices.columnType'), dataIndex: 'type' },
    { title: t('pages.system.printDevices.labelDescription'), dataIndex: 'description' },
    {
      title: t('pages.system.printDevices.columnActive'),
      dataIndex: 'is_active',
      render: (value: boolean) => (
        <Tag color={value ? 'success' : 'default'}>
          {value ? t('pages.system.printDevices.enabled') : t('pages.system.printDevices.disabled')}
        </Tag>
      ),
    },
    {
      title: t('pages.system.printDevices.columnOnline'),
      dataIndex: 'is_online',
      render: (value: boolean) => (
        <Tag color={value ? 'success' : 'error'}>
          {value ? t('pages.system.printDevices.statusOnline') : t('pages.system.printDevices.statusOffline')}
        </Tag>
      ),
    },
    {
      title: t('pages.system.printDevices.columnDefault'),
      dataIndex: 'is_default',
      render: (value: boolean) => (
        <Tag color={value ? 'processing' : 'default'}>
          {value ? t('pages.system.printDevices.defaultTag') : '-'}
        </Tag>
      ),
    },
    {
      title: t('pages.system.printDevices.columnConfig'),
      dataIndex: 'config',
      render: (value: Record<string, any>) => (
        <pre style={{ maxHeight: '200px', overflow: 'auto', background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
          {JSON.stringify(value, null, 2)}
        </pre>
      ),
    },
    { title: t('pages.system.printDevices.columnUsage'), dataIndex: 'usage_count' },
    { title: t('pages.system.printDevices.columnLastConnected'), dataIndex: 'last_connected_at', valueType: 'dateTime' },
    { title: t('pages.system.printDevices.columnLastUsed'), dataIndex: 'last_used_at', valueType: 'dateTime' },
    { title: t('pages.system.printDevices.columnCreatedAt'), dataIndex: 'created_at', valueType: 'dateTime' },
    { title: t('pages.system.printDevices.columnUpdatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
  ];

  return (
    <>
      <ListPageTemplate statCards={statCards}>
        <UniTable<PrintDevice>
          actionRef={actionRef}
          columns={columns}
          request={async (params, sort, _filter, searchFormValues) => {
            const { current = 1, pageSize = 20 } = params;
            const skip = (current - 1) * pageSize;
            const limit = pageSize;

            const listParams: any = {
              skip,
              limit,
              ...searchFormValues,
            };

            try {
              const data = await getPrintDeviceList(listParams);
              
              // 同时获取所有数据用于统计（如果当前页是第一页）
              if (current === 1) {
                try {
                  const allData = await getPrintDeviceList({ skip: 0, limit: 1000 });
                  setAllDevices(allData);
                } catch (e) {
                  // 忽略统计数据的错误
                }
              }
              
              return {
                data,
                success: true,
                total: data.length, // 注意：这里应该返回实际总数，如果API支持的话
              };
            } catch (error: any) {
              console.error('获取打印设备列表失败:', error);
              messageApi.error(error?.message || t('pages.system.printDevices.loadListFailed'));
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          rowKey="uuid"
          showAdvancedSearch={true}
          showCreateButton
          createButtonText={t('pages.system.printDevices.createButton')}
          onCreate={handleCreate}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteButtonText={t('pages.system.printDevices.batchDelete')}
          enableRowSelection
          onRowSelectionChange={setSelectedRowKeys}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          showImportButton
          showExportButton
          onExport={async (type, keys, pageData) => {
            let items: PrintDevice[] = [];
            if (type === 'selected' && keys?.length) {
              items = await Promise.all(keys.map((k) => getPrintDeviceByUuid(String(k))));
            } else if (type === 'currentPage' && pageData?.length) {
              items = pageData;
            } else {
              items = await getPrintDeviceList({ skip: 0, limit: 10000 });
            }
            if (items.length === 0) {
              messageApi.warning(t('pages.system.printDevices.noDataToExport'));
              return;
            }
            const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `print-devices-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            messageApi.success(t('pages.system.printDevices.exportSuccess'));
          }}
          viewTypes={['table', 'help']}
          defaultViewType="table"
          cardViewConfig={{
            renderCard,
          }}
        />
      </ListPageTemplate>

      {/* 创建/编辑 Modal */}
      <FormModalTemplate
        title={isEdit ? t('pages.system.printDevices.modalEdit') : t('pages.system.printDevices.modalCreate')}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setFormInitialValues(undefined);
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        initialValues={formInitialValues}
        loading={formLoading}
        width={MODAL_CONFIG.LARGE_WIDTH}
      >
        <ProFormText
          name="name"
          label={t('pages.system.printDevices.labelName')}
          rules={[{ required: true, message: t('pages.system.printDevices.nameRequired') }]}
        />
        <ProFormText
          name="code"
          label={t('pages.system.printDevices.labelCode')}
          rules={[
            { required: true, message: t('pages.system.printDevices.codeRequired') },
            { pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/, message: t('pages.system.printDevices.codePattern') },
          ]}
          disabled={isEdit}
          tooltip={t('pages.system.printDevices.codeTooltip')}
        />
        <SafeProFormSelect
          name="type"
          label={t('pages.system.printDevices.labelType')}
          rules={[{ required: true, message: t('pages.system.printDevices.typeRequired') }]}
          options={[
            { label: t('pages.system.printDevices.typeLocal'), value: 'local' },
            { label: t('pages.system.printDevices.typeNetwork'), value: 'network' },
            { label: t('pages.system.printDevices.typeCloud'), value: 'cloud' },
            { label: t('pages.system.printDevices.typeOther'), value: 'other' },
          ]}
          disabled={isEdit}
        />
        <ProFormTextArea
          name="description"
          label={t('pages.system.printDevices.labelDescription')}
          fieldProps={{
            rows: 3,
          }}
        />
        <ProForm.Item
          name="config"
          label={t('pages.system.printDevices.labelConfig')}
          rules={[{ required: true, message: t('pages.system.printDevices.configRequired') }]}
          tooltip={t('pages.system.printDevices.configTooltip')}
        >
          <TextArea
            rows={6}
            value={configJson}
            onChange={(e) => setConfigJson(e.target.value)}
            placeholder={t('pages.system.printDevices.configPlaceholder')}
            style={{ fontFamily: CODE_FONT_FAMILY }}
          />
        </ProForm.Item>
        {isEdit && (
          <>
            <ProFormSwitch
              name="is_active"
              label={t('pages.system.printDevices.labelActive')}
            />
            <ProFormSwitch
              name="is_default"
              label={t('pages.system.printDevices.labelDefault')}
            />
          </>
        )}
      </FormModalTemplate>

      {/* 测试连接 Modal */}
      <Modal
        title={t('pages.system.printDevices.testModalTitle')}
        open={testModalVisible}
        onCancel={() => setTestModalVisible(false)}
        footer={null}
        width={500}
      >
        {testFormLoading ? (
          <div>{t('pages.system.printDevices.testing')}</div>
        ) : testResult ? (
          <div style={{ padding: 16 }}>
            {testResult.success ? (
              <div style={{ color: '#52c41a' }}>✓ {testResult.message || t('pages.system.printDevices.testSuccess')}</div>
            ) : (
              <div>
                <div style={{ color: '#ff4d4f' }}>✗ {t('pages.system.printDevices.testFailed')}</div>
                {testResult.error && (
                  <div style={{ marginTop: 8, color: '#ff4d4f' }}>{testResult.error}</div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      {/* 执行打印 Modal */}
      <Modal
        title={t('pages.system.printDevices.printModalTitle')}
        open={printModalVisible}
        onCancel={() => setPrintModalVisible(false)}
        footer={null}
        width={700}
      >
        <ProForm
          formRef={printFormRef}
          loading={printFormLoading}
          onFinish={handlePrintSubmit}
          submitter={{
            searchConfig: {
              submitText: t('pages.system.printDevices.submitPrint'),
            },
          }}
        >
          <ProFormText
            name="template_uuid"
            label={t('pages.system.printDevices.labelTemplateUuid')}
            rules={[{ required: true, message: t('pages.system.printDevices.templateUuidRequired') }]}
          />
          <ProFormTextArea
            name="data"
            label={t('pages.system.printDevices.labelPrintData')}
            rules={[{ required: true, message: t('pages.system.printDevices.printDataRequired') }]}
            fieldProps={{
              rows: 6,
              style: { fontFamily: CODE_FONT_FAMILY },
              placeholder: t('pages.system.printDevices.printDataPlaceholder'),
            }}
            tooltip={t('pages.system.printDevices.printDataTooltip')}
          />
          <ProFormSwitch
            name="async_execution"
            label={t('pages.system.printDevices.labelAsync')}
            tooltip={t('pages.system.printDevices.asyncTooltip')}
          />
        </ProForm>
        
        {printResult && (
          <div style={{ marginTop: 24, padding: 16, background: '#f5f5f5', borderRadius: 4 }}>
            <div style={{ marginBottom: 8, fontWeight: 'bold' }}>{t('pages.system.printDevices.printResultTitle')}</div>
            {printResult.success ? (
              <div style={{ color: '#52c41a' }}>✓ {printResult.message || t('pages.system.printDevices.printSuccess')}</div>
            ) : (
              <div>
                <div style={{ color: '#ff4d4f' }}>✗ {t('pages.system.printDevices.printFailed')}</div>
                {printResult.error && (
                  <div style={{ marginTop: 8, color: '#ff4d4f' }}>{printResult.error}</div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate<PrintDevice>
        title={t('pages.system.printDevices.detailTitle')}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        dataSource={detailData || {}}
        columns={detailColumns}
      />
    </>
  );
};

export default PrintDeviceListPage;
