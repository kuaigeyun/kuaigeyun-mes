/**
 * 电子记录管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的电子记录。
 * 支持电子记录的 CRUD 操作和签名、归档功能。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptions, ProForm, ProFormText, ProFormTextArea, ProFormSelect, ProFormInstance } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Drawer, Modal, message, Input, Form } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, PlusOutlined, CheckCircleOutlined, FileOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni_table';
import {
  getElectronicRecordList,
  getElectronicRecordByUuid,
  createElectronicRecord,
  updateElectronicRecord,
  deleteElectronicRecord,
  signElectronicRecord,
  archiveElectronicRecord,
  ElectronicRecord,
  CreateElectronicRecordData,
  UpdateElectronicRecordData,
  SignElectronicRecordData,
  ArchiveElectronicRecordData,
} from '../../../../services/electronicRecord';

const { TextArea } = Input;

/**
 * 电子记录管理列表页面组件
 */
const ElectronicRecordListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Modal 相关状态（创建/编辑电子记录）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentElectronicRecordUuid, setCurrentElectronicRecordUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [contentJson, setContentJson] = useState<string>('{}');
  
  // Modal 相关状态（签名）
  const [signModalVisible, setSignModalVisible] = useState(false);
  const [signFormLoading, setSignFormLoading] = useState(false);
  const [currentSignRecordUuid, setCurrentSignRecordUuid] = useState<string | null>(null);
  const [signFormRef] = Form.useForm();
  
  // Modal 相关状态（归档）
  const [archiveModalVisible, setArchiveModalVisible] = useState(false);
  const [archiveFormLoading, setArchiveFormLoading] = useState(false);
  const [currentArchiveRecordUuid, setCurrentArchiveRecordUuid] = useState<string | null>(null);
  const [archiveFormRef] = Form.useForm();
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<ElectronicRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /**
   * 处理新建电子记录
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentElectronicRecordUuid(null);
    setContentJson('{}');
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      type: 'document',
    });
  };

  /**
   * 处理编辑电子记录
   */
  const handleEdit = async (record: ElectronicRecord) => {
    try {
      setIsEdit(true);
      setCurrentElectronicRecordUuid(record.uuid);
      setModalVisible(true);
      
      // 获取电子记录详情
      const detail = await getElectronicRecordByUuid(record.uuid);
      setContentJson(JSON.stringify(detail.content, null, 2));
      formRef.current?.setFieldsValue({
        name: detail.name,
        code: detail.code,
        type: detail.type,
        description: detail.description,
        file_uuid: detail.file_uuid,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取电子记录详情失败');
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: ElectronicRecord) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getElectronicRecordByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取电子记录详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理签名
   */
  const handleSign = (record: ElectronicRecord) => {
    setCurrentSignRecordUuid(record.uuid);
    setSignModalVisible(true);
    signFormRef.current?.resetFields();
  };

  /**
   * 处理签名表单提交
   */
  const handleSignSubmit = async (values: any) => {
    if (!currentSignRecordUuid) return;
    
    try {
      setSignFormLoading(true);
      const data: SignElectronicRecordData = {
        signer_id: values.signer_id,
        signature_data: values.signature_data,
      };
      await signElectronicRecord(currentSignRecordUuid, data);
      messageApi.success('签名操作已提交');
      setSignModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '签名失败');
    } finally {
      setSignFormLoading(false);
    }
  };

  /**
   * 处理归档
   */
  const handleArchive = (record: ElectronicRecord) => {
    setCurrentArchiveRecordUuid(record.uuid);
    setArchiveModalVisible(true);
    archiveFormRef.current?.resetFields();
  };

  /**
   * 处理归档表单提交
   */
  const handleArchiveSubmit = async (values: any) => {
    if (!currentArchiveRecordUuid) return;
    
    try {
      setArchiveFormLoading(true);
      const data: ArchiveElectronicRecordData = {
        archive_location: values.archive_location,
      };
      await archiveElectronicRecord(currentArchiveRecordUuid, data);
      messageApi.success('归档操作已提交');
      setArchiveModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '归档失败');
    } finally {
      setArchiveFormLoading(false);
    }
  };

  /**
   * 处理删除电子记录
   */
  const handleDelete = async (record: ElectronicRecord) => {
    try {
      await deleteElectronicRecord(record.uuid);
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
      messageApi.warning('请选择要删除的电子记录');
      return;
    }
    
    try {
      await Promise.all(selectedRowKeys.map((key) => deleteElectronicRecord(key as string)));
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
  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      
      // 解析 JSON 内容
      let content: Record<string, any>;
      try {
        content = JSON.parse(contentJson);
      } catch (e) {
        messageApi.error('记录内容 JSON 格式错误');
        return;
      }
      
      const data: CreateElectronicRecordData | UpdateElectronicRecordData = {
        ...values,
        content,
      };
      
      if (isEdit && currentElectronicRecordUuid) {
        await updateElectronicRecord(currentElectronicRecordUuid, data as UpdateElectronicRecordData);
        messageApi.success('更新成功');
      } else {
        await createElectronicRecord(data as CreateElectronicRecordData);
        messageApi.success('创建成功');
      }
      
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<ElectronicRecord>[] = [
    {
      title: '记录名称',
      dataIndex: 'name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '记录代码',
      dataIndex: 'code',
      width: 150,
      ellipsis: true,
    },
    {
      title: '记录类型',
      dataIndex: 'type',
      width: 120,
      ellipsis: true,
    },
    {
      title: '记录状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        draft: { text: '草稿', status: 'Default' },
        signed: { text: '已签名', status: 'Success' },
        archived: { text: '已归档', status: 'Processing' },
        destroyed: { text: '已销毁', status: 'Error' },
      },
      render: (_, record) => {
        const statusMap = {
          draft: { color: 'default', text: '草稿' },
          signed: { color: 'success', text: '已签名' },
          archived: { color: 'processing', text: '已归档' },
          destroyed: { color: 'error', text: '已销毁' },
        };
        const statusInfo = statusMap[record.status] || { color: 'default', text: record.status };
        return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
      },
    },
    {
      title: '生命周期阶段',
      dataIndex: 'lifecycle_stage',
      width: 120,
      ellipsis: true,
      hideInSearch: true,
      render: (_, record) => {
        if (!record.lifecycle_stage) return '-';
        const stageMap = {
          created: '已创建',
          signing: '签名中',
          archiving: '归档中',
          completed: '已完成',
        };
        return stageMap[record.lifecycle_stage] || record.lifecycle_stage;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 300,
      fixed: 'right',
      render: (_, record) => {
        const actions = [
          <Button
            key="view"
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            查看
          </Button>,
        ];
        
        if (record.status === 'draft') {
          actions.push(
            <Button
              key="edit"
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>,
            <Button
              key="sign"
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleSign(record)}
            >
              签名
            </Button>
          );
        }
        
        if (record.status === 'signed') {
          actions.push(
            <Button
              key="archive"
              type="link"
              size="small"
              icon={<FileOutlined />}
              onClick={() => handleArchive(record)}
            >
              归档
            </Button>
          );
        }
        
        actions.push(
          <Popconfirm
            key="delete"
            title="确定要删除这个电子记录吗？"
            onConfirm={() => handleDelete(record)}
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        );
        
        return actions;
      },
    },
  ];

  return (
    <>
      <UniTable<ElectronicRecord>
        headerTitle="电子记录管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params, sort, _filter, searchFormValues) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const limit = pageSize;
          
          const listParams: any = {
            skip,
            limit,
            ...searchFormValues,
          };
          
          const data = await getElectronicRecordList(listParams);
          return {
            data,
            success: true,
            total: data.length,
          };
        }}
        rowKey="uuid"
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        toolBarRender={() => [
          <Button
            key="batch-delete"
            danger
            onClick={handleBatchDelete}
            disabled={selectedRowKeys.length === 0}
          >
            批量删除
          </Button>,
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新建
          </Button>,
        ]}
        search={{
          labelWidth: 'auto',
          showAdvancedSearch: true,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑电子记录' : '新建电子记录'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
      >
        <ProForm
          formRef={formRef}
          loading={formLoading}
          onFinish={handleSubmit}
          submitter={{
            searchConfig: {
              submitText: isEdit ? '更新' : '创建',
            },
          }}
        >
          <ProFormText
            name="name"
            label="记录名称"
            rules={[{ required: true, message: '请输入记录名称' }]}
          />
          <ProFormText
            name="code"
            label="记录代码"
            rules={[
              { required: true, message: '请输入记录代码' },
              { pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/, message: '记录代码只能包含字母、数字和下划线，且必须以字母开头' },
            ]}
            disabled={isEdit}
            tooltip="记录代码用于程序识别，创建后不可修改"
          />
          <ProFormSelect
            name="type"
            label="记录类型"
            rules={[{ required: true, message: '请选择记录类型' }]}
            options={[
              { label: '文档', value: 'document' },
              { label: '合同', value: 'contract' },
              { label: '报告', value: 'report' },
              { label: '其他', value: 'other' },
            ]}
            disabled={isEdit}
          />
          <ProFormTextArea
            name="description"
            label="记录描述"
            fieldProps={{
              rows: 3,
            }}
          />
          <ProFormText
            name="file_uuid"
            label="关联文件UUID（可选）"
          />
          <ProForm.Item
            name="content"
            label="记录内容（JSON）"
            rules={[{ required: true, message: '请输入记录内容' }]}
          >
            <TextArea
              rows={8}
              value={contentJson}
              onChange={(e) => setContentJson(e.target.value)}
              placeholder='{"key": "value"}'
            />
          </ProForm.Item>
        </ProForm>
      </Modal>

      {/* 签名 Modal */}
      <Modal
        title="签名电子记录"
        open={signModalVisible}
        onCancel={() => setSignModalVisible(false)}
        footer={null}
        width={500}
      >
        <ProForm
          formRef={signFormRef}
          loading={signFormLoading}
          onFinish={handleSignSubmit}
          submitter={{
            searchConfig: {
              submitText: '确认签名',
            },
          }}
        >
          <ProFormText
            name="signer_id"
            label="签名人ID"
            rules={[{ required: true, message: '请输入签名人ID' }]}
          />
          <ProFormTextArea
            name="signature_data"
            label="签名数据（可选）"
            fieldProps={{
              rows: 4,
            }}
          />
        </ProForm>
      </Modal>

      {/* 归档 Modal */}
      <Modal
        title="归档电子记录"
        open={archiveModalVisible}
        onCancel={() => setArchiveModalVisible(false)}
        footer={null}
        width={500}
      >
        <ProForm
          formRef={archiveFormRef}
          loading={archiveFormLoading}
          onFinish={handleArchiveSubmit}
          submitter={{
            searchConfig: {
              submitText: '确认归档',
            },
          }}
        >
          <ProFormText
            name="archive_location"
            label="归档位置（可选）"
            maxLength={200}
          />
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="电子记录详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : detailData ? (
          <ProDescriptions
            column={1}
            dataSource={detailData}
            columns={[
              {
                title: '记录名称',
                dataIndex: 'name',
              },
              {
                title: '记录代码',
                dataIndex: 'code',
              },
              {
                title: '记录类型',
                dataIndex: 'type',
              },
              {
                title: '记录描述',
                dataIndex: 'description',
              },
              {
                title: '记录状态',
                dataIndex: 'status',
                render: (value) => {
                  const statusMap = {
                    draft: { color: 'default', text: '草稿' },
                    signed: { color: 'success', text: '已签名' },
                    archived: { color: 'processing', text: '已归档' },
                    destroyed: { color: 'error', text: '已销毁' },
                  };
                  const statusInfo = statusMap[value] || { color: 'default', text: value };
                  return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
                },
              },
              {
                title: '生命周期阶段',
                dataIndex: 'lifecycle_stage',
              },
              {
                title: '关联文件UUID',
                dataIndex: 'file_uuid',
              },
              {
                title: '记录内容',
                dataIndex: 'content',
                render: (value) => (
                  <pre style={{ maxHeight: '200px', overflow: 'auto' }}>
                    {JSON.stringify(value, null, 2)}
                  </pre>
                ),
              },
              {
                title: '签名人ID',
                dataIndex: 'signer_id',
              },
              {
                title: '签名时间',
                dataIndex: 'signed_at',
                valueType: 'dateTime',
              },
              {
                title: '归档时间',
                dataIndex: 'archived_at',
                valueType: 'dateTime',
              },
              {
                title: '归档位置',
                dataIndex: 'archive_location',
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
        ) : null}
      </Drawer>
    </>
  );
};

export default ElectronicRecordListPage;

