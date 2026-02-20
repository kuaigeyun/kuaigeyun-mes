/**
 * 打印设备管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的打印设备。
 * 支持打印设备的 CRUD 操作和打印设备连接测试功能。
 */

import React, { useRef, useState, useMemo } from 'react';
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

/**
 * 获取设备类型图标和颜色
 */
const getTypeInfo = (type: string): { color: string; text: string; icon: React.ReactNode } => {
  const typeMap: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
    local: { 
      color: 'blue', 
      text: '本地',
      icon: <PrinterFilled />,
    },
    network: { 
      color: 'green', 
      text: '网络',
      icon: <PrinterFilled />,
    },
    cloud: { 
      color: 'purple', 
      text: '云打印',
      icon: <PrinterFilled />,
    },
    other: { 
      color: 'default', 
      text: '其他',
      icon: <PrinterFilled />,
    },
  };
  return typeMap[type] || { color: 'default', text: type, icon: <PrinterFilled /> };
};

/**
 * 获取设备状态显示
 */
const getDeviceStatus = (device: PrintDevice): { 
  status: 'success' | 'error' | 'warning' | 'default'; 
  text: string;
  onlineStatus: 'success' | 'error' | 'default';
  onlineText: string;
} => {
  if (!device.is_active) {
    return { 
      status: 'default', 
      text: '已禁用',
      onlineStatus: 'default',
      onlineText: '已禁用',
    };
  }
  
  if (device.is_online) {
    return { 
      status: 'success', 
      text: '在线',
      onlineStatus: 'success',
      onlineText: '在线',
    };
  }
  
  return { 
    status: 'error', 
    text: '离线',
    onlineStatus: 'error',
    onlineText: '离线',
  };
};

/**
 * 打印设备管理列表页面组件
 */
const PrintDeviceListPage: React.FC = () => {
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
      messageApi.error(error.message || '获取打印设备详情失败');
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
      messageApi.error(error.message || '获取打印设备详情失败');
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
        messageApi.success(result.message || '连接测试成功');
      } else {
        messageApi.error(result.error || '连接测试失败');
      }
      
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '连接测试失败');
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
        messageApi.success(result.message || '打印任务已提交');
      } else {
        messageApi.error(result.error || '打印失败');
      }
      
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '打印失败');
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
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理批量删除
   */
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请选择要删除的打印设备');
      return;
    }
    
    try {
      await Promise.all(selectedRowKeys.map((key) => deletePrintDevice(key as string)));
      messageApi.success('批量删除成功');
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error('批量删除失败');
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
        messageApi.error('设备配置 JSON 格式错误');
        throw new Error('设备配置 JSON 格式错误');
      }
      
      const data: CreatePrintDeviceData | UpdatePrintDeviceData = {
        ...values,
        config,
      };
      
      if (isEdit && currentPrintDeviceUuid) {
        await updatePrintDevice(currentPrintDeviceUuid, data as UpdatePrintDeviceData);
        messageApi.success('更新成功');
      } else {
        await createPrintDevice(data as CreatePrintDeviceData);
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
      {
        title: '总设备数',
        value: stats.total,
        valueStyle: { color: '#1890ff' },
      },
      {
        title: '在线设备',
        value: stats.online,
        valueStyle: { color: '#52c41a' },
      },
      {
        title: '离线设备',
        value: stats.offline,
        valueStyle: { color: '#ff4d4f' },
      },
      {
        title: '已启用',
        value: stats.active,
        valueStyle: { color: '#52c41a' },
      },
    ];
  }, [allDevices]);

  /**
   * 卡片渲染函数
   */
  const renderCard = (device: PrintDevice, index: number) => {
    const typeInfo = getTypeInfo(device.type);
    const deviceStatus = getDeviceStatus(device);
    
    return (
      <Card
        key={device.uuid}
        hoverable
        style={{ height: '100%' }}
        actions={[
          <Tooltip key="view" title="查看详情">
            <EyeOutlined
              onClick={() => handleView(device)}
              style={{ fontSize: 16 }}
            />
          </Tooltip>,
          <Tooltip key="test" title="测试连接">
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
            title="确定要删除这个打印设备吗？"
            onConfirm={() => handleDelete(device)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
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
                代码: {device.code}
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
              <Text type="secondary" style={{ fontSize: 12 }}>在线状态：</Text>
              <Badge
                status={deviceStatus.onlineStatus}
                text={deviceStatus.onlineText}
              />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>启用状态：</Text>
              <Tag color={device.is_active ? 'success' : 'default'}>
                {device.is_active ? '启用' : '禁用'}
              </Tag>
            </div>
            
            {device.is_default && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>默认设备：</Text>
                <Tag color="processing">是</Tag>
              </div>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>使用次数：</Text>
              <Text style={{ fontSize: 12 }}>{device.usage_count || 0}</Text>
            </div>
            
            {device.last_connected_at && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>最后连接：</Text>
                <Text style={{ fontSize: 12 }}>
                  {dayjs(device.last_connected_at).fromNow()}
                </Text>
              </div>
            )}
            
            {device.last_used_at && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>最后使用：</Text>
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
      title: '设备名称',
      dataIndex: 'name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '设备代码',
      dataIndex: 'code',
      width: 150,
      ellipsis: true,
    },
    {
      title: '设备类型',
      dataIndex: 'type',
      width: 120,
      valueType: 'select',
      valueEnum: {
        local: { text: '本地' },
        network: { text: '网络' },
        cloud: { text: '云打印' },
        other: { text: '其他' },
      },
      render: (_, record) => {
        const typeMap: Record<string, { color: string; text: string }> = {
          local: { color: 'blue', text: '本地' },
          network: { color: 'green', text: '网络' },
          cloud: { color: 'purple', text: '云打印' },
          other: { color: 'default', text: '其他' },
        };
        const typeInfo = typeMap[record.type] || { color: 'default', text: record.type };
        return <Tag color={typeInfo.color}>{typeInfo.text}</Tag>;
      },
    },
    {
      title: '是否启用',
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '启用', status: 'Success' },
        false: { text: '禁用', status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '在线状态',
      dataIndex: 'is_online',
      width: 100,
      hideInSearch: true,
      render: (_, record) => (
        <Tag color={record.is_online ? 'success' : 'error'}>
          {record.is_online ? '在线' : '离线'}
        </Tag>
      ),
    },
    {
      title: '是否默认',
      dataIndex: 'is_default',
      width: 100,
      hideInSearch: true,
      render: (_, record) => (
        <Tag color={record.is_default ? 'processing' : 'default'}>
          {record.is_default ? '默认' : '-'}
        </Tag>
      ),
    },
    {
      title: '使用次数',
      dataIndex: 'usage_count',
      width: 100,
      hideInSearch: true,
    },
    {
      title: '最后使用时间',
      dataIndex: 'last_used_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
    },
    {
      title: '创建时间',
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
    {
      title: '设备名称',
      dataIndex: 'name',
    },
    {
      title: '设备代码',
      dataIndex: 'code',
    },
    {
      title: '设备类型',
      dataIndex: 'type',
    },
    {
      title: '设备描述',
      dataIndex: 'description',
    },
    {
      title: '是否启用',
      dataIndex: 'is_active',
      render: (value: boolean) => (
        <Tag color={value ? 'success' : 'default'}>
          {value ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '在线状态',
      dataIndex: 'is_online',
      render: (value: boolean) => (
        <Tag color={value ? 'success' : 'error'}>
          {value ? '在线' : '离线'}
        </Tag>
      ),
    },
    {
      title: '是否默认',
      dataIndex: 'is_default',
      render: (value: boolean) => (
        <Tag color={value ? 'processing' : 'default'}>
          {value ? '默认' : '-'}
        </Tag>
      ),
    },
    {
      title: '设备配置',
      dataIndex: 'config',
      render: (value: Record<string, any>) => (
        <pre style={{ maxHeight: '200px', overflow: 'auto', background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
          {JSON.stringify(value, null, 2)}
        </pre>
      ),
    },
    {
      title: '使用次数',
      dataIndex: 'usage_count',
    },
    {
      title: '最后连接时间',
      dataIndex: 'last_connected_at',
      valueType: 'dateTime',
    },
    {
      title: '最后使用时间',
      dataIndex: 'last_used_at',
      valueType: 'dateTime',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      valueType: 'dateTime',
    },
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
              messageApi.error(error?.message || '获取打印设备列表失败');
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
          createButtonText="新建打印设备"
          onCreate={handleCreate}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteButtonText="批量删除"
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
              messageApi.warning('暂无数据可导出');
              return;
            }
            const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `print-devices-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            messageApi.success('导出成功');
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
        title={isEdit ? '编辑打印设备' : '新建打印设备'}
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
          label="设备名称"
          rules={[{ required: true, message: '请输入设备名称' }]}
        />
        <ProFormText
          name="code"
          label="设备代码"
          rules={[
            { required: true, message: '请输入设备代码' },
            { pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/, message: '设备代码只能包含字母、数字和下划线，且必须以字母开头' },
          ]}
          disabled={isEdit}
          tooltip="设备代码用于程序识别，创建后不可修改"
        />
        <SafeProFormSelect
          name="type"
          label="设备类型"
          rules={[{ required: true, message: '请选择设备类型' }]}
          options={[
            { label: '本地', value: 'local' },
            { label: '网络', value: 'network' },
            { label: '云打印', value: 'cloud' },
            { label: '其他', value: 'other' },
          ]}
          disabled={isEdit}
        />
        <ProFormTextArea
          name="description"
          label="设备描述"
          fieldProps={{
            rows: 3,
          }}
        />
        <ProForm.Item
          name="config"
          label="设备配置（JSON）"
          rules={[{ required: true, message: '请输入设备配置' }]}
          tooltip="设备配置，JSON 格式，根据设备类型不同而不同"
        >
          <TextArea
            rows={6}
            value={configJson}
            onChange={(e) => setConfigJson(e.target.value)}
            placeholder='{"host": "192.168.1.100", "port": 9100, "protocol": "raw"}'
            style={{ fontFamily: CODE_FONT_FAMILY }}
          />
        </ProForm.Item>
        {isEdit && (
          <>
            <ProFormSwitch
              name="is_active"
              label="是否启用"
            />
            <ProFormSwitch
              name="is_default"
              label="是否默认设备"
            />
          </>
        )}
      </FormModalTemplate>

      {/* 测试连接 Modal */}
      <Modal
        title="测试打印设备连接"
        open={testModalVisible}
        onCancel={() => setTestModalVisible(false)}
        footer={null}
        width={500}
      >
        {testFormLoading ? (
          <div>测试中...</div>
        ) : testResult ? (
          <div style={{ padding: 16 }}>
            {testResult.success ? (
              <div style={{ color: '#52c41a' }}>✓ {testResult.message || '连接测试成功'}</div>
            ) : (
              <div>
                <div style={{ color: '#ff4d4f' }}>✗ 连接测试失败</div>
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
        title="执行打印任务"
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
              submitText: '打印',
            },
          }}
        >
          <ProFormText
            name="template_uuid"
            label="打印模板UUID"
            rules={[{ required: true, message: '请输入打印模板UUID' }]}
          />
          <ProFormTextArea
            name="data"
            label="打印数据（JSON）"
            rules={[{ required: true, message: '请输入打印数据' }]}
            fieldProps={{
              rows: 6,
              style: { fontFamily: CODE_FONT_FAMILY },
              placeholder: '{"title": "标题", "content": "内容"}',
            }}
            tooltip="打印数据，JSON 格式，用于替换模板中的变量"
          />
          <ProFormSwitch
            name="async_execution"
            label="异步执行（通过 Inngest）"
            tooltip="如果启用，打印任务将通过 Inngest 异步执行"
          />
        </ProForm>
        
        {printResult && (
          <div style={{ marginTop: 24, padding: 16, background: '#f5f5f5', borderRadius: 4 }}>
            <div style={{ marginBottom: 8, fontWeight: 'bold' }}>打印结果：</div>
            {printResult.success ? (
              <div style={{ color: '#52c41a' }}>✓ {printResult.message || '打印任务已提交'}</div>
            ) : (
              <div>
                <div style={{ color: '#ff4d4f' }}>✗ 打印失败</div>
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
        title="打印设备详情"
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
