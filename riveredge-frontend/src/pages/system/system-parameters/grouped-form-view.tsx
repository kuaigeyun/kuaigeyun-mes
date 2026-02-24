/**
 * 系统参数管理 - 分组表单视图组件
 * 
 * 提供分组表单布局的参数管理界面
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Card, Form, Input, Switch, Button, Space, message, Drawer, Table, Tag, Typography, Divider, Upload, Modal, Tabs, Timeline, Empty } from 'antd';
import { SaveOutlined, ReloadOutlined, DownloadOutlined, UploadOutlined, HistoryOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import {
  getSystemParameterList,
  getSystemParameterByUuid,
  updateSystemParameter,
  batchUpdateSystemParameters,
  SystemParameter,
  SystemParameterListResponse,
  UpdateSystemParameterData,
  BatchUpdateSystemParameterData,
} from '../../../services/systemParameter';
import { getOperationLogs, OperationLog } from '../../../services/operationLog';
import { handleError, handleSuccess } from '../../../utils/errorHandler';
import { HelpTooltip } from '../../../components/help-tooltip';

const { TextArea } = Input;
const { Text, Paragraph } = Typography;

/**
 * 参数分组配置
 */
interface ParameterGroup {
  /**
   * 分组名称
   */
  name: string;
  /**
   * 分组描述
   */
  description?: string;
  /**
   * 参数键前缀（用于匹配）
   */
  keyPrefix?: string;
  /**
   * 参数键列表（精确匹配）
   */
  keys?: string[];
}

const DEFAULT_GROUPS: (ParameterGroup & { nameKey: string; descKey?: string })[] = [
  { name: 'file', nameKey: 'groupFile', descKey: 'groupFileDesc', keyPrefix: 'file.' },
  { name: 'backup', nameKey: 'groupBackup', descKey: 'groupBackupDesc', keyPrefix: 'backup.' },
  { name: 'message', nameKey: 'groupMessage', descKey: 'groupMessageDesc', keyPrefix: 'message.' },
  { name: 'system', nameKey: 'groupSystem', descKey: 'groupSystemDesc', keyPrefix: 'system.' },
  { name: 'other', nameKey: 'groupOther', descKey: 'groupOtherDesc' },
];

/**
 * 分组表单视图组件
 */
const GroupedFormView: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parameters, setParameters] = useState<SystemParameter[]>([]);
  const [historyDrawerVisible, setHistoryDrawerVisible] = useState(false);
  const [historyData, setHistoryData] = useState<OperationLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedParameter, setSelectedParameter] = useState<SystemParameter | null>(null);

  /**
   * 加载参数列表
   */
  const loadParameters = async () => {
    setLoading(true);
    try {
      const response: SystemParameterListResponse = await getSystemParameterList({
        page: 1,
        page_size: 1000, // 加载所有参数
      });
      setParameters(response.items || []);
      
      // 设置表单初始值
      const initialValues: Record<string, any> = {};
      (response.items || []).forEach((param) => {
        // 根据类型处理值
        if (param.type === 'json') {
          initialValues[param.key] = typeof param.value === 'string' ? param.value : JSON.stringify(param.value, null, 2);
        } else {
          initialValues[param.key] = param.value;
        }
      });
      form.setFieldsValue(initialValues);
    } catch (error: any) {
      handleError(error, t('pages.system.parameters.grouped.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadParameters();
  }, []);

  /**
   * 按分组组织参数
   */
  const groupedParameters = useMemo(() => {
    const groups: Record<string, SystemParameter[]> = {};
    
    // 初始化分组
    DEFAULT_GROUPS.forEach((group) => {
      groups[group.name] = [];
    });
    
    // 分配参数到分组
    (parameters || []).forEach((param) => {
      let assigned = false;
      
      for (const group of DEFAULT_GROUPS) {
        if (group.keys && group.keys.includes(param.key)) {
          groups[group.name].push(param);
          assigned = true;
          break;
        }
        
        if (group.keyPrefix && param.key.startsWith(group.keyPrefix)) {
          groups[group.name].push(param);
          assigned = true;
          break;
        }
      }
      
      if (!assigned) {
        groups['other'].push(param);
      }
    });
    
    return groups;
  }, [parameters]);

  /**
   * 处理保存
   */
  const handleSave = async () => {
    try {
      setSaving(true);
      const values = await form.validateFields();
      
      // 构建批量更新数据
      const updates: BatchUpdateSystemParameterData = {};
      Object.keys(values).forEach((key) => {
        const param = (parameters || []).find((p) => p.key === key);
        if (param) {
          let processedValue: any = values[key];
          
          // 根据类型处理值
          if (param.type === 'json') {
            try {
              if (typeof processedValue === 'string') {
                processedValue = JSON.parse(processedValue);
              }
            } catch (e) {
              messageApi.error(t('pages.system.parameters.grouped.paramJsonInvalid', { key }));
              throw new Error(t('pages.system.parameters.grouped.paramJsonInvalid', { key }));
            }
          } else if (param.type === 'number') {
            processedValue = Number(processedValue);
            if (isNaN(processedValue)) {
              messageApi.error(t('pages.system.parameters.grouped.paramMustBeNumber', { key }));
              throw new Error(t('pages.system.parameters.grouped.paramMustBeNumber', { key }));
            }
          } else if (param.type === 'boolean') {
            processedValue = processedValue === true || processedValue === 'true' || processedValue === 1;
          }
          
          // 比较值是否变化（考虑类型转换）
          const currentValue = param.type === 'json' 
            ? (typeof param.value === 'string' ? JSON.parse(param.value) : param.value)
            : param.value;
          
          if (JSON.stringify(currentValue) !== JSON.stringify(processedValue)) {
            updates[key] = processedValue;
          }
        }
      });
      
      if (Object.keys(updates).length === 0) {
        messageApi.info(t('pages.system.parameters.grouped.noUpdates'));
        return;
      }
      
      await batchUpdateSystemParameters(updates);
      handleSuccess(t('pages.system.parameters.saveSuccess'));
      loadParameters();
    } catch (error: any) {
      handleError(error, t('pages.system.parameters.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  /**
   * 处理导出
   */
  const handleExport = () => {
    try {
      // 构建 CSV 数据
      const headers = ['key', 'value', 'type', 'description', 'is_system', 'is_active'];
      const rows = (parameters || []).map((param) => [
        param.key,
        typeof param.value === 'object' ? JSON.stringify(param.value) : String(param.value),
        param.type,
        param.description || '',
        param.is_system ? 'Y' : 'N',
        param.is_active ? 'Y' : 'N',
      ]);
      
      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');
      
      // 创建下载链接
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `系统参数_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      handleSuccess(t('pages.system.parameters.grouped.exportSuccess'));
    } catch (error: any) {
      handleError(error, t('pages.system.parameters.grouped.exportFailed'));
    }
  };

  /**
   * 处理导入
   */
  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const lines = text.split('\n').filter((line) => line.trim());
      
      if (lines.length < 2) {
        messageApi.error(t('pages.system.parameters.grouped.csvInvalid'));
        return;
      }
      
      // 解析 CSV（简单实现，实际应该使用 CSV 解析库）
      const headers = lines[0].split(',').map((h) => h.replace(/^"|"$/g, ''));
      const updates: BatchUpdateSystemParameterData = {};
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map((v) => v.replace(/^"|"$/g, '').replace(/""/g, '"'));
        const keyIndex = headers.indexOf('key');
        const valueIndex = headers.indexOf('value');
        
        if (keyIndex >= 0 && valueIndex >= 0) {
          const key = values[keyIndex];
          let value: any = values[valueIndex];
          
          // 尝试解析 JSON
          try {
            value = JSON.parse(value);
          } catch {
            // 不是 JSON，保持原值
          }
          
          updates[key] = value;
        }
      }
      
      if (Object.keys(updates).length === 0) {
        messageApi.error(t('pages.system.parameters.grouped.noValidData'));
        return;
      }
      
      await batchUpdateSystemParameters(updates);
      handleSuccess(t('pages.system.parameters.grouped.importSuccess'));
      loadParameters();
    } catch (error: any) {
      handleError(error, t('pages.system.parameters.grouped.importFailed'));
    }
    
    return false; // 阻止默认上传行为
  };

  /**
   * 查看参数变更历史
   */
  const handleViewHistory = async (parameter: SystemParameter) => {
    setSelectedParameter(parameter);
    setHistoryDrawerVisible(true);
    setHistoryLoading(true);
    
    try {
      const response = await getOperationLogs({
        page: 1,
        page_size: 100,
        operation_module: '系统参数',
        operation_object_type: 'SystemParameter',
        operation_object_uuid: parameter.uuid,
      });
      setHistoryData(response.items);
    } catch (error: any) {
      handleError(error, t('pages.system.parameters.grouped.loadHistoryFailed'));
    } finally {
      setHistoryLoading(false);
    }
  };

  /**
   * 渲染参数输入框
   */
  const renderParameterInput = (param: SystemParameter) => {
    const helpText = param.description || `${t('pages.system.parameters.grouped.enterValue')} (${param.type})`;
    
    switch (param.type) {
      case 'number':
        return (
          <Form.Item
            key={param.key}
            name={param.key}
            label={
              <Space>
                <span>{param.key}</span>
                {param.description && (
                  <HelpTooltip content={param.description} />
                )}
              </Space>
            }
            tooltip={helpText}
            rules={[
              {
                validator: (_, value) => {
                  if (value !== undefined && value !== null && isNaN(Number(value))) {
                    return Promise.reject(new Error(t('pages.system.parameters.grouped.enterValidNumber')));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input type="number" placeholder={t('pages.system.parameters.grouped.enterNumber')} />
          </Form.Item>
        );
      
      case 'boolean':
        return (
          <Form.Item
            key={param.key}
            name={param.key}
            label={
              <Space>
                <span>{param.key}</span>
                {param.description && (
                  <HelpTooltip content={param.description} />
                )}
              </Space>
            }
            tooltip={helpText}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        );
      
      case 'json':
        return (
          <Form.Item
            key={param.key}
            name={param.key}
            label={
              <Space>
                <span>{param.key}</span>
                {param.description && (
                  <HelpTooltip content={param.description} />
                )}
              </Space>
            }
            tooltip={helpText}
            rules={[
              {
                validator: (_, value) => {
                  if (value === undefined || value === null || value === '') {
                    return Promise.resolve();
                  }
                  try {
                    const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);
                    JSON.parse(jsonValue);
                    return Promise.resolve();
                  } catch {
                    return Promise.reject(new Error(t('pages.system.parameters.grouped.jsonInvalid')));
                  }
                },
              },
            ]}
            getValueFromEvent={(e) => {
              // 如果是 TextArea 的 onChange 事件，直接返回值
              return typeof e === 'string' ? e : e?.target?.value || '';
            }}
          >
            <TextArea
              rows={4}
              placeholder={t('pages.system.parameters.grouped.enterJson')}
            />
          </Form.Item>
        );
      
      default:
        return (
          <Form.Item
            key={param.key}
            name={param.key}
            label={
              <Space>
                <span>{param.key}</span>
                {param.description && (
                  <HelpTooltip content={param.description} />
                )}
              </Space>
            }
            tooltip={helpText}
          >
            <Input placeholder={t('pages.system.parameters.grouped.enterValue')} />
          </Form.Item>
        );
    }
  };

  return (
    <>
      <PageContainer
        title={t('pages.system.parameters.grouped.pageTitle')}
        extra={[
          <Button
            key="history"
            icon={<HistoryOutlined />}
            onClick={() => {
              // 显示所有参数的变更历史
              setSelectedParameter(null);
              setHistoryDrawerVisible(true);
              setHistoryLoading(true);
              getOperationLogs({
                page: 1,
                page_size: 100,
                operation_module: '系统参数',
              })
                .then((response) => {
                  setHistoryData(response.items);
                })
                .catch((error: any) => {
                  handleError(error, t('pages.system.parameters.grouped.loadHistoryFailed'));
                })
                .finally(() => {
                  setHistoryLoading(false);
                });
            }}
          >
            {t('pages.system.parameters.grouped.changeHistory')}
          </Button>,
          <Button
            key="export"
            icon={<DownloadOutlined />}
            onClick={handleExport}
          >
            {t('pages.system.parameters.grouped.export')}
          </Button>,
          <Upload
            key="import"
            accept=".csv"
            beforeUpload={handleImport}
            showUploadList={false}
          >
            <Button icon={<UploadOutlined />}>{t('pages.system.parameters.grouped.import')}</Button>
          </Upload>,
          <Button
            key="reload"
            icon={<ReloadOutlined />}
            onClick={loadParameters}
            loading={loading}
          >
            {t('pages.system.parameters.grouped.refresh')}
          </Button>,
          <Button
            key="save"
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
          >
            {t('pages.system.parameters.grouped.save')}
          </Button>,
        ]}
      >
        <Card loading={loading}>
          <Form
            form={form}
            layout="vertical"
            initialValues={{}}
          >
            {DEFAULT_GROUPS.map((group) => {
              const groupParams = groupedParameters[group.name] || [];
              
              if (groupParams.length === 0) {
                return null;
              }
              
              return (
                <Card
                  key={group.name}
                  type="inner"
                  title={
                    <Space>
                      <span>{t(`pages.system.parameters.grouped.${group.nameKey}`)}</span>
                      {group.descKey && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {t(`pages.system.parameters.grouped.${group.descKey}`)}
                        </Text>
                      )}
                    </Space>
                  }
                  style={{ marginBottom: 16 }}
                  extra={
                    <Tag color="blue">{t('pages.system.parameters.grouped.paramsCount', { count: groupParams.length })}</Tag>
                  }
                >
                  {groupParams.map((param) => (
                    <div key={param.uuid} style={{ marginBottom: 16 }}>
                      {renderParameterInput(param)}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: -16, marginBottom: 8 }}>
                        <Space size="small">
                          <Tag color={param.type === 'string' ? 'default' : param.type === 'number' ? 'blue' : param.type === 'boolean' ? 'green' : 'orange'}>
                            {param.type}
                          </Tag>
                          {param.is_system && (
                            <Tag color="default">{t('pages.system.parameters.grouped.systemParam')}</Tag>
                          )}
                          <Tag color={param.is_active ? 'success' : 'default'}>
                            {param.is_active ? t('pages.system.parameters.grouped.enabled') : t('pages.system.parameters.grouped.disabled')}
                          </Tag>
                        </Space>
                        <Button
                          type="link"
                          size="small"
                          icon={<HistoryOutlined />}
                          onClick={() => handleViewHistory(param)}
                        >
                          {t('pages.system.parameters.grouped.history')}
                        </Button>
                      </div>
                    </div>
                  ))}
                </Card>
              );
            })}
          </Form>
        </Card>
      </PageContainer>

      {/* 变更历史抽屉 */}
      <Drawer
        title={selectedParameter ? `${t('pages.system.parameters.grouped.historyTitle')} - ${selectedParameter.key}` : t('pages.system.parameters.grouped.historyTitle')}
        placement="right"
        size={700}
        open={historyDrawerVisible}
        onClose={() => {
          setHistoryDrawerVisible(false);
          setSelectedParameter(null);
          setHistoryData([]);
        }}
        loading={historyLoading}
      >
        {historyData.length > 0 ? (
          <Timeline>
            {historyData.map((log, index) => {
              let color = 'blue';
              let icon = <HistoryOutlined />;
              
              if (log.operation_type === 'create') {
                color = 'green';
              } else if (log.operation_type === 'update') {
                color = 'blue';
              } else if (log.operation_type === 'delete') {
                color = 'red';
              }
              
              return (
                <Timeline.Item key={index} color={color} dot={icon}>
                  <div>
                    <div style={{ marginBottom: 4 }}>
                      <Text strong>
                        {log.operation_type === 'create' ? t('pages.system.parameters.grouped.create') :
                         log.operation_type === 'update' ? t('pages.system.parameters.grouped.update') :
                         log.operation_type === 'delete' ? t('pages.system.parameters.grouped.delete') :
                         log.operation_type}
                      </Text>
                      <Text type="secondary" style={{ marginLeft: 8 }}>
                        {t('pages.system.parameters.grouped.userId')}: {log.user_id}
                      </Text>
                    </div>
                    {log.operation_content && (
                      <Paragraph style={{ marginBottom: 4, fontSize: 12 }}>
                        {log.operation_content}
                      </Paragraph>
                    )}
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {new Date(log.created_at).toLocaleString()}
                      </Text>
                    </div>
                  </div>
                </Timeline.Item>
              );
            })}
          </Timeline>
        ) : (
          <Empty description={t('pages.system.parameters.grouped.noHistory')} />
        )}
      </Drawer>
    </>
  );
};

export default GroupedFormView;

