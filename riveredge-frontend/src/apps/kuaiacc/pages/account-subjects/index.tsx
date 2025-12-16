/**
 * 会计科目管理页面
 * 
 * 提供会计科目的 CRUD 功能，按照中国财务规范设计。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormInstance, ProDescriptions, ProFormDigit } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni-table';
import { accountSubjectApi } from '../../services/process';
import type { AccountSubject, AccountSubjectCreate, AccountSubjectUpdate } from '../../types/process';

/**
 * 会计科目管理列表页面组件
 */
const AccountSubjectsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentSubjectUuid, setCurrentSubjectUuid] = useState<string | null>(null);
  const [subjectDetail, setSubjectDetail] = useState<AccountSubject | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑会计科目）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建会计科目
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentSubjectUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      level: 1,
      isLeaf: true,
      direction: '借方',
      status: '启用',
    });
  };

  /**
   * 处理编辑会计科目
   */
  const handleEdit = async (record: AccountSubject) => {
    try {
      setIsEdit(true);
      setCurrentSubjectUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await accountSubjectApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        subjectCode: detail.subjectCode,
        subjectName: detail.subjectName,
        subjectType: detail.subjectType,
        parentId: detail.parentId,
        level: detail.level,
        isLeaf: detail.isLeaf,
        direction: detail.direction,
        status: detail.status,
        currency: detail.currency,
        quantityUnit: detail.quantityUnit,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取会计科目详情失败');
    }
  };

  /**
   * 处理删除会计科目
   */
  const handleDelete = async (record: AccountSubject) => {
    try {
      await accountSubjectApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: AccountSubject) => {
    try {
      setCurrentSubjectUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await accountSubjectApi.get(record.uuid);
      setSubjectDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取会计科目详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: AccountSubjectCreate | AccountSubjectUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentSubjectUuid) {
        await accountSubjectApi.update(currentSubjectUuid, values as AccountSubjectUpdate);
        messageApi.success('更新成功');
      } else {
        await accountSubjectApi.create(values as AccountSubjectCreate);
        messageApi.success('创建成功');
      }
      
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || (isEdit ? '更新失败' : '创建失败'));
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<AccountSubject>[] = [
    {
      title: '科目编码',
      dataIndex: 'subjectCode',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.subjectCode}</a>
      ),
    },
    {
      title: '科目名称',
      dataIndex: 'subjectName',
      width: 200,
      ellipsis: true,
    },
    {
      title: '科目类型',
      dataIndex: 'subjectType',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '资产': { text: '资产' },
        '负债': { text: '负债' },
        '所有者权益': { text: '所有者权益' },
        '收入': { text: '收入' },
        '费用': { text: '费用' },
      },
    },
    {
      title: '层级',
      dataIndex: 'level',
      width: 80,
    },
    {
      title: '余额方向',
      dataIndex: 'direction',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '借方': { text: <Tag color="blue">借方</Tag> },
        '贷方': { text: <Tag color="green">贷方</Tag> },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '启用': { text: <Tag color="green">启用</Tag> },
        '停用': { text: <Tag color="default">停用</Tag> },
      },
    },
    {
      title: '操作',
      valueType: 'option',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个会计科目吗？"
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
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>
      <UniTable<AccountSubject>
        headerTitle="会计科目管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await accountSubjectApi.list({
            skip,
            limit: pageSize,
            ...rest,
          });
          return {
            data,
            success: true,
            total: data.length,
          };
        }}
        rowKey="uuid"
        search={{
          labelWidth: 'auto',
        }}
        toolBarRender={() => [
          <Button
            type="primary"
            key="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新建会计科目
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑会计科目' : '新建会计科目'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
      >
        <ProForm
          formRef={formRef}
          onFinish={handleSubmit}
          submitter={{
            searchConfig: {
              submitText: isEdit ? '更新' : '创建',
            },
            submitButtonProps: {
              loading: formLoading,
            },
          }}
        >
          <ProFormText
            name="subjectCode"
            label="科目编码"
            rules={[{ required: true, message: '请输入科目编码' }]}
            placeholder="按中国会计准则4-2-2-2结构"
            disabled={isEdit}
          />
          <ProFormText
            name="subjectName"
            label="科目名称"
            rules={[{ required: true, message: '请输入科目名称' }]}
            placeholder="请输入科目名称"
          />
          <ProFormSelect
            name="subjectType"
            label="科目类型"
            options={[
              { label: '资产', value: '资产' },
              { label: '负债', value: '负债' },
              { label: '所有者权益', value: '所有者权益' },
              { label: '收入', value: '收入' },
              { label: '费用', value: '费用' },
            ]}
            rules={[{ required: true, message: '请选择科目类型' }]}
          />
          <ProFormDigit
            name="parentId"
            label="父科目ID"
            placeholder="可选，用于科目层级"
          />
          <ProFormDigit
            name="level"
            label="科目层级"
            min={1}
            max={4}
            rules={[{ required: true, message: '请输入科目层级' }]}
          />
          <ProFormSelect
            name="direction"
            label="余额方向"
            options={[
              { label: '借方', value: '借方' },
              { label: '贷方', value: '贷方' },
            ]}
            rules={[{ required: true, message: '请选择余额方向' }]}
          />
          <ProFormSelect
            name="status"
            label="状态"
            options={[
              { label: '启用', value: '启用' },
              { label: '停用', value: '停用' },
            ]}
            rules={[{ required: true, message: '请选择状态' }]}
          />
          <ProFormText
            name="currency"
            label="币种"
            placeholder="人民币、美元等，默认人民币"
          />
          <ProFormText
            name="quantityUnit"
            label="数量单位"
            placeholder="用于数量金额式账页"
          />
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="会计科目详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : subjectDetail ? (
          <ProDescriptions<AccountSubject>
            column={1}
            dataSource={subjectDetail}
            columns={[
              { title: '科目编码', dataIndex: 'subjectCode' },
              { title: '科目名称', dataIndex: 'subjectName' },
              { title: '科目类型', dataIndex: 'subjectType' },
              { title: '层级', dataIndex: 'level' },
              { title: '是否末级', dataIndex: 'isLeaf', valueType: 'switch' },
              { title: '余额方向', dataIndex: 'direction' },
              { title: '状态', dataIndex: 'status' },
              { title: '币种', dataIndex: 'currency' },
              { title: '数量单位', dataIndex: 'quantityUnit' },
              { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
              { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
            ]}
          />
        ) : null}
      </Drawer>
    </div>
  );
};

export default AccountSubjectsPage;

