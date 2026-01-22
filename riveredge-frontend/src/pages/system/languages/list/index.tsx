/**
 * 语言管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的语言。
 * 支持语言的 CRUD 操作和翻译管理。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormSelect, ProFormSwitch, ProFormDigit, ProFormInstance } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../components/safe-pro-form-select';
import { App, Popconfirm, Button, Tag, Space, Drawer, Modal, message, Table, Input } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, PlusOutlined, TranslationOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../components/layout-templates';
import {
  getLanguageList,
  getLanguageByUuid,
  createLanguage,
  updateLanguage,
  deleteLanguage,
  updateTranslations,
  Language,
  CreateLanguageData,
  UpdateLanguageData,
  TranslationUpdateRequest,
} from '../../../../services/language';

/**
 * 语言管理列表页面组件
 */
const LanguageListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Modal 相关状态（创建/编辑语言）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentLanguageUuid, setCurrentLanguageUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | undefined>(undefined);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<Language | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // 翻译管理 Drawer 状态
  const [translationDrawerVisible, setTranslationDrawerVisible] = useState(false);
  const [currentLanguageForTranslation, setCurrentLanguageForTranslation] = useState<Language | null>(null);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translationLoading, setTranslationLoading] = useState(false);
  const [translationSaving, setTranslationSaving] = useState(false);
  const [newTranslationKey, setNewTranslationKey] = useState('');
  const [newTranslationValue, setNewTranslationValue] = useState('');

  /**
   * 处理新建语言
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentLanguageUuid(null);
    setFormInitialValues({
      is_default: false,
      is_active: true,
      sort_order: 0,
    });
    setModalVisible(true);
  };

  /**
   * 处理编辑语言
   */
  const handleEdit = async (record: Language) => {
    try {
      setIsEdit(true);
      setCurrentLanguageUuid(record.uuid);
      
      // 获取语言详情
      const detail = await getLanguageByUuid(record.uuid);
      setFormInitialValues({
        code: detail.code,
        name: detail.name,
        native_name: detail.native_name,
        is_default: detail.is_default,
        is_active: detail.is_active,
        sort_order: detail.sort_order,
      });
      setModalVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || '获取语言详情失败');
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: Language) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getLanguageByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取语言详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理管理翻译
   */
  const handleManageTranslations = async (record: Language) => {
    try {
      setTranslationLoading(true);
      setTranslationDrawerVisible(true);
      setCurrentLanguageForTranslation(record);
      const detail = await getLanguageByUuid(record.uuid);
      setTranslations(detail.translations || {});
    } catch (error: any) {
      messageApi.error(error.message || '获取翻译内容失败');
    } finally {
      setTranslationLoading(false);
    }
  };

  /**
   * 处理添加翻译
   */
  const handleAddTranslation = () => {
    if (!newTranslationKey.trim()) {
      messageApi.warning('请输入翻译键');
      return;
    }
    if (translations[newTranslationKey]) {
      messageApi.warning('翻译键已存在');
      return;
    }
    setTranslations({
      ...translations,
      [newTranslationKey]: newTranslationValue,
    });
    setNewTranslationKey('');
    setNewTranslationValue('');
  };

  /**
   * 处理删除翻译
   */
  const handleDeleteTranslation = (key: string) => {
    const newTranslations = { ...translations };
    delete newTranslations[key];
    setTranslations(newTranslations);
  };

  /**
   * 处理保存翻译
   */
  const handleSaveTranslations = async () => {
    if (!currentLanguageForTranslation) return;
    
    try {
      setTranslationSaving(true);
      await updateTranslations(currentLanguageForTranslation.uuid, {
        translations,
      } as TranslationUpdateRequest);
      messageApi.success('保存成功');
      setTranslationDrawerVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '保存失败');
    } finally {
      setTranslationSaving(false);
    }
  };

  /**
   * 处理删除语言
   */
  const handleDelete = async (record: Language) => {
    try {
      await deleteLanguage(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理批量删除语言
   */
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请先选择要删除的记录');
      return;
    }

    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 条记录吗？默认语言无法删除。此操作不可恢复。`,
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          let successCount = 0;
          let failCount = 0;
          const errors: string[] = [];

          for (const key of selectedRowKeys) {
            try {
              await deleteLanguage(key.toString());
              successCount++;
            } catch (error: any) {
              failCount++;
              errors.push(error.message || '删除失败');
            }
          }

          if (successCount > 0) {
            messageApi.success(`成功删除 ${successCount} 条记录`);
          }
          if (failCount > 0) {
            messageApi.error(`删除失败 ${failCount} 条记录${errors.length > 0 ? '：' + errors.join('; ') : ''}`);
          }

          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '批量删除失败');
        }
      },
    });
  };

  /**
   * 处理提交表单（创建/更新语言）
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentLanguageUuid) {
        await updateLanguage(currentLanguageUuid, values as UpdateLanguageData);
        messageApi.success('更新成功');
      } else {
        await createLanguage(values as CreateLanguageData);
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
   * 表格列定义
   */
  const columns: ProColumns<Language>[] = [
    {
      title: '语言代码',
      dataIndex: 'code',
      width: 120,
      fixed: 'left',
      render: (_, record) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{record.code}</span>
      ),
    },
    {
      title: '语言名称',
      dataIndex: 'name',
      width: 150,
    },
    {
      title: '本地名称',
      dataIndex: 'native_name',
      width: 150,
      hideInSearch: true,
    },
    {
      title: '翻译数量',
      dataIndex: 'translations',
      width: 120,
      hideInSearch: true,
      render: (_, record) => Object.keys(record.translations || {}).length,
    },
    {
      title: '默认语言',
      dataIndex: 'is_default',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '是', status: 'Success' },
        false: { text: '否', status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_default ? 'success' : 'default'}>
          {record.is_default ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      width: 80,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: '状态',
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
      width: 250,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            查看
          </Button>
          <Button
            type="link"
            size="small"
            icon={<TranslationOutlined />}
            onClick={() => handleManageTranslations(record)}
          >
            翻译
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个语言吗？"
            onConfirm={() => handleDelete(record)}
            disabled={record.is_default}
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
              disabled={record.is_default}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  /**
   * 翻译表格列定义
   */
  const translationColumns = [
    {
      title: '翻译键',
      dataIndex: 'key',
      width: '40%',
      render: (text: string) => (
        <span style={{ fontFamily: 'monospace' }}>{text}</span>
      ),
    },
    {
      title: '翻译值',
      dataIndex: 'value',
      width: '50%',
    },
    {
      title: '操作',
      width: '10%',
      render: (_: any, record: { key: string }) => (
        <Button
          type="link"
          danger
          size="small"
          onClick={() => handleDeleteTranslation(record.key)}
        >
          删除
        </Button>
      ),
    },
  ];

  /**
   * 翻译表格数据
   */
  const translationTableData = Object.entries(translations).map(([key, value]) => ({
    key,
    value,
  }));

  return (
    <>
      <ListPageTemplate>
        <UniTable<Language>
          actionRef={actionRef}
          columns={columns}
          request={async (params, sort, _filter, searchFormValues) => {
            // 处理搜索参数
            const apiParams: any = {
              page: params.current || 1,
              page_size: params.pageSize || 20,
            };
            
            // 状态筛选
            if (searchFormValues?.is_active !== undefined && searchFormValues.is_active !== '' && searchFormValues.is_active !== null) {
              apiParams.is_active = searchFormValues.is_active;
            }
            
            // 搜索条件处理：code 和 name 使用模糊搜索
            if (searchFormValues?.code) {
              apiParams.code = searchFormValues.code as string;
            }
            if (searchFormValues?.name) {
              apiParams.name = searchFormValues.name as string;
            }
            
            try {
              const response = await getLanguageList(apiParams);
              return {
                data: response.items,
                success: true,
                total: response.total,
              };
            } catch (error: any) {
              console.error('获取语言列表失败:', error);
              messageApi.error(error?.message || '获取语言列表失败');
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          rowKey="uuid"
          showAdvancedSearch={true}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
          }}
          toolBarRender={() => [
            <Button
              key="create"
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
            >
              新建语言
            </Button>,
            <Button
              key="batch-delete"
              danger
              icon={<DeleteOutlined />}
              disabled={selectedRowKeys.length === 0}
              onClick={handleBatchDelete}
            >
              批量删除
            </Button>,
          ]}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
        />
      </ListPageTemplate>

      {/* 创建/编辑语言 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑语言' : '新建语言'}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setFormInitialValues(undefined);
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        initialValues={formInitialValues}
        loading={formLoading}
        width={MODAL_CONFIG.SMALL_WIDTH}
      >
        <SafeProFormSelect
          name="code"
          label="语言代码"
          rules={[{ required: true, message: '请选择语言代码' }]}
          disabled={isEdit}
          extra="语言代码用于程序识别，创建后不可修改"
          options={[
            { label: '简体中文 (zh-CN)', value: 'zh-CN' },
            { label: 'English (en-US)', value: 'en-US' },
          ]}
        />
        <ProFormText
          name="name"
          label="语言名称"
          rules={[{ required: true, message: '请输入语言名称' }]}
          placeholder="例如：中文、English、日本語"
        />
        <ProFormText
          name="native_name"
          label="本地名称"
          placeholder="例如：中文、English、日本語"
        />
        <ProFormSwitch
          name="is_default"
          label="是否默认语言"
        />
        <ProFormDigit
          name="sort_order"
          label="排序顺序"
          fieldProps={{ min: 0 }}
          initialValue={0}
        />
        <ProFormSwitch
          name="is_active"
          label="是否启用"
        />
      </FormModalTemplate>

      {/* 查看详情 Drawer */}
      <DetailDrawerTemplate
        title="语言详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        dataSource={detailData}
        columns={[
          {
            title: '语言代码',
            dataIndex: 'code',
            render: (value: string) => (
              <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{value}</span>
            ),
          },
          {
            title: '语言名称',
            dataIndex: 'name',
          },
          {
            title: '本地名称',
            dataIndex: 'native_name',
            render: (value: string) => value || '-',
          },
          {
            title: '翻译数量',
            dataIndex: 'translations',
            render: (value: Record<string, string>) => Object.keys(value || {}).length,
          },
          {
            title: '默认语言',
            dataIndex: 'is_default',
            render: (value: boolean) => (value ? '是' : '否'),
          },
          {
            title: '排序顺序',
            dataIndex: 'sort_order',
          },
          {
            title: '状态',
            dataIndex: 'is_active',
            render: (value: boolean) => (value ? '启用' : '禁用'),
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
        ]}
      />

      {/* 翻译管理 Drawer */}
      <Drawer
        title={`翻译管理 - ${currentLanguageForTranslation?.name || ''}`}
        open={translationDrawerVisible}
        onClose={() => {
          setTranslationDrawerVisible(false);
          setCurrentLanguageForTranslation(null);
          setTranslations({});
        }}
        size={800}
        loading={translationLoading}
        extra={[
          <Button
            key="save"
            type="primary"
            onClick={handleSaveTranslations}
            loading={translationSaving}
          >
            保存
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <Space.Compact style={{ width: '100%' }}>
            <Input
              placeholder="翻译键"
              value={newTranslationKey}
              onChange={(e) => setNewTranslationKey(e.target.value)}
              onPressEnter={handleAddTranslation}
            />
            <Input
              placeholder="翻译值"
              value={newTranslationValue}
              onChange={(e) => setNewTranslationValue(e.target.value)}
              onPressEnter={handleAddTranslation}
            />
            <Button type="primary" onClick={handleAddTranslation}>
              添加
            </Button>
          </Space.Compact>
        </div>
        <Table
          columns={translationColumns}
          dataSource={translationTableData}
          rowKey="key"
          pagination={false}
          scroll={{ y: 400 }}
        />
      </Drawer>
    </>
  );
};

export default LanguageListPage;

