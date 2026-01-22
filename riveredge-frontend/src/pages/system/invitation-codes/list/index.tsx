/**
 * 邀请码管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的邀请码。
 * 支持邀请码的 CRUD 操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormSwitch, ProFormDigit, ProFormDateTimePicker, ProFormInstance } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Drawer, Modal, message } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, PlusOutlined, CopyOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../components/layout-templates';
import {
  getInvitationCodeList,
  getInvitationCodeByUuid,
  createInvitationCode,
  updateInvitationCode,
  deleteInvitationCode,
  InvitationCode,
  CreateInvitationCodeData,
  UpdateInvitationCodeData,
} from '../../../../services/invitationCode';

/**
 * 邀请码管理列表页面组件
 */
const InvitationCodeListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Modal 相关状态（创建/编辑邀请码）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentCodeUuid, setCurrentCodeUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | undefined>(undefined);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<InvitationCode | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /**
   * 处理新建邀请码
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentCodeUuid(null);
    setFormInitialValues({
      max_uses: 1,
      is_active: true,
    });
    setModalVisible(true);
  };

  /**
   * 处理编辑邀请码
   */
  const handleEdit = async (record: InvitationCode) => {
    try {
      setIsEdit(true);
      setCurrentCodeUuid(record.uuid);
      
      // 获取邀请码详情
      const detail = await getInvitationCodeByUuid(record.uuid);
      setFormInitialValues({
        email: detail.email,
        role_id: detail.role_id,
        max_uses: detail.max_uses,
        expires_at: detail.expires_at,
        is_active: detail.is_active,
      });
      setModalVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || '获取邀请码详情失败');
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: InvitationCode) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getInvitationCodeByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取邀请码详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理删除邀请码
   */
  const handleDelete = async (record: InvitationCode) => {
    try {
      await deleteInvitationCode(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理批量删除邀请码
   */
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请先选择要删除的记录');
      return;
    }

    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 条记录吗？此操作不可恢复。`,
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
              await deleteInvitationCode(key.toString());
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
   * 处理复制邀请码
   */
  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      messageApi.success('邀请码已复制到剪贴板');
    }).catch(() => {
      messageApi.error('复制失败');
    });
  };

  /**
   * 处理提交表单（创建/更新邀请码）
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentCodeUuid) {
        await updateInvitationCode(currentCodeUuid, values as UpdateInvitationCodeData);
        messageApi.success('更新成功');
      } else {
        await createInvitationCode(values as CreateInvitationCodeData);
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
   * 检查邀请码是否有效
   */
  const isCodeValid = (record: InvitationCode): boolean => {
    if (!record.is_active) return false;
    if (record.used_count >= record.max_uses) return false;
    if (record.expires_at) {
      const expiresAt = new Date(record.expires_at);
      if (expiresAt < new Date()) return false;
    }
    return true;
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<InvitationCode>[] = [
    {
      title: '邀请码',
      dataIndex: 'code',
      width: 200,
      fixed: 'left',
      render: (_, record) => (
        <Space>
          <span style={{ fontFamily: 'monospace', fontSize: '14px' }}>{record.code}</span>
          <Button
            type="link"
            size="small"
            icon={<CopyOutlined />}
            onClick={() => handleCopy(record.code)}
          >
            复制
          </Button>
        </Space>
      ),
    },
    {
      title: '邀请邮箱',
      dataIndex: 'email',
      width: 200,
      hideInSearch: true,
    },
    {
      title: '使用次数',
      dataIndex: 'used_count',
      width: 120,
      hideInSearch: true,
      render: (_, record) => `${record.used_count} / ${record.max_uses}`,
    },
    {
      title: '过期时间',
      dataIndex: 'expires_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      render: (_, record) => record.expires_at || '永不过期',
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
      render: (_, record) => {
        const valid = isCodeValid(record);
        return (
          <Space>
            <Tag color={record.is_active ? 'success' : 'default'}>
              {record.is_active ? '启用' : '禁用'}
            </Tag>
            {!valid && record.is_active && (
              <Tag color="error">已失效</Tag>
            )}
          </Space>
        );
      },
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
      width: 200,
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
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个邀请码吗？"
            onConfirm={() => handleDelete(record)}
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<InvitationCode>
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
            
            try {
              const response = await getInvitationCodeList(apiParams);
              return {
                data: response.items,
                success: true,
                total: response.total,
              };
            } catch (error: any) {
              console.error('获取邀请码列表失败:', error);
              messageApi.error(error?.message || '获取邀请码列表失败');
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
              生成邀请码
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

      {/* 创建/编辑邀请码 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑邀请码' : '生成邀请码'}
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
        <ProFormText
          name="email"
          label="邀请邮箱（可选）"
          placeholder="请输入邀请邮箱"
        />
        <ProFormDigit
          name="role_id"
          label="默认角色ID（可选）"
          placeholder="请输入默认角色ID"
        />
        <ProFormDigit
          name="max_uses"
          label="最大使用次数"
          fieldProps={{ min: 1 }}
          initialValue={1}
          extra="邀请码最多可以使用多少次"
        />
        <ProFormDateTimePicker
          name="expires_at"
          label="过期时间（可选）"
          placeholder="请选择过期时间"
          extra="留空表示永不过期"
        />
        <ProFormSwitch
          name="is_active"
          label="是否启用"
        />
      </FormModalTemplate>

      {/* 查看详情 Drawer */}
      <DetailDrawerTemplate
        title="邀请码详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        dataSource={detailData}
        columns={[
          {
            title: '邀请码',
            dataIndex: 'code',
            render: (value: string) => (
              <Space>
                <span style={{ fontFamily: 'monospace', fontSize: '16px', fontWeight: 'bold' }}>{value}</span>
                <Button
                  type="link"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => handleCopy(value)}
                >
                  复制
                </Button>
              </Space>
            ),
          },
          {
            title: '邀请邮箱',
            dataIndex: 'email',
            render: (value: string) => value || '-',
          },
          {
            title: '默认角色ID',
            dataIndex: 'role_id',
            render: (value: number) => value || '-',
          },
          {
            title: '使用次数',
            dataIndex: 'used_count',
            render: (_: any, record: InvitationCode) => `${record.used_count} / ${record.max_uses}`,
          },
          {
            title: '过期时间',
            dataIndex: 'expires_at',
            render: (value: string) => value || '永不过期',
          },
          {
            title: '状态',
            dataIndex: 'is_active',
            render: (value: boolean, record: InvitationCode) => {
              const valid = isCodeValid(record);
              return (
                <Space>
                  <Tag color={value ? 'success' : 'default'}>
                    {value ? '启用' : '禁用'}
                  </Tag>
                  {!valid && value && (
                    <Tag color="error">已失效</Tag>
                  )}
                </Space>
              );
            },
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
    </>
  );
};

export default InvitationCodeListPage;

