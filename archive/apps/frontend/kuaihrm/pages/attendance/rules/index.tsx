/**
 * 考勤规则管理页面
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormInstance, ProDescriptions, ProFormDigit, ProFormTimePicker } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { attendanceRuleApi } from '../../../services/process';
import type { AttendanceRule, AttendanceRuleCreate, AttendanceRuleUpdate } from '../../../types/process';

const AttendanceRulesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentUuid, setCurrentUuid] = useState<string | null>(null);
  const [detail, setDetail] = useState<AttendanceRule | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  const handleCreate = () => {
    setIsEdit(false);
    setCurrentUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ 
      status: '启用',
      breakDuration: 60,
      lateTolerance: 15,
      earlyLeaveTolerance: 15,
      overtimeThreshold: 8.00,
    });
  };

  const handleEdit = async (record: AttendanceRule) => {
    try {
      setIsEdit(true);
      setCurrentUuid(record.uuid);
      setModalVisible(true);
      const data = await attendanceRuleApi.get(record.uuid);
      formRef.current?.setFieldsValue(data);
    } catch (error: any) {
      messageApi.error(error.message || '获取详情失败');
    }
  };

  const handleDelete = async (record: AttendanceRule) => {
    try {
      await attendanceRuleApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  const handleOpenDetail = async (record: AttendanceRule) => {
    try {
      setCurrentUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      const data = await attendanceRuleApi.get(record.uuid);
      setDetail(data);
    } catch (error: any) {
      messageApi.error(error.message || '获取详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSubmit = async (values: AttendanceRuleCreate | AttendanceRuleUpdate) => {
    try {
      setFormLoading(true);
      if (isEdit && currentUuid) {
        await attendanceRuleApi.update(currentUuid, values as AttendanceRuleUpdate);
        messageApi.success('更新成功');
      } else {
        await attendanceRuleApi.create(values as AttendanceRuleCreate);
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

  const columns: ProColumns<AttendanceRule>[] = [
    {
      title: '规则编码',
      dataIndex: 'ruleCode',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.ruleCode}</a>
      ),
    },
    {
      title: '规则名称',
      dataIndex: 'ruleName',
      width: 200,
    },
    {
      title: '规则类型',
      dataIndex: 'ruleType',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '标准工时': { text: '标准工时' },
        '弹性工时': { text: '弹性工时' },
        '综合工时': { text: '综合工时' },
      },
    },
    {
      title: '上班时间',
      dataIndex: 'workStartTime',
      width: 100,
    },
    {
      title: '下班时间',
      dataIndex: 'workEndTime',
      width: 100,
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
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确定要删除吗？" onConfirm={() => handleDelete(record)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>
      <UniTable<AttendanceRule>
        headerTitle="考勤规则管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await attendanceRuleApi.list({ skip, limit: pageSize, ...rest });
          return { data, success: true, total: data.length };
        }}
        rowKey="uuid"
        search={{ labelWidth: 'auto' }}
        toolBarRender={() => [
          <Button type="primary" key="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建</Button>,
        ]}
        rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
      />
      <Modal title={isEdit ? '编辑' : '新建'} open={modalVisible} onCancel={() => setModalVisible(false)} footer={null} width={800}>
        <ProForm formRef={formRef} onFinish={handleSubmit} submitter={{ searchConfig: { submitText: isEdit ? '更新' : '创建' }, submitButtonProps: { loading: formLoading } }}>
          <ProFormText name="ruleCode" label="规则编码" rules={[{ required: true }]} disabled={isEdit} />
          <ProFormText name="ruleName" label="规则名称" rules={[{ required: true }]} />
          <ProFormSelect name="ruleType" label="规则类型" rules={[{ required: true }]} options={[
            { label: '标准工时', value: '标准工时' },
            { label: '弹性工时', value: '弹性工时' },
            { label: '综合工时', value: '综合工时' },
          ]} />
          <ProFormText name="workStartTime" label="上班时间" rules={[{ required: true }]} placeholder="格式：HH:mm" />
          <ProFormText name="workEndTime" label="下班时间" rules={[{ required: true }]} placeholder="格式：HH:mm" />
          <ProFormDigit name="breakDuration" label="休息时长（分钟）" min={0} />
          <ProFormDigit name="lateTolerance" label="迟到容忍时间（分钟）" min={0} />
          <ProFormDigit name="earlyLeaveTolerance" label="早退容忍时间（分钟）" min={0} />
          <ProFormDigit name="overtimeThreshold" label="加班阈值（小时）" min={0} />
          <ProFormSelect name="status" label="状态" options={[
            { label: '启用', value: '启用' },
            { label: '停用', value: '停用' },
          ]} />
        </ProForm>
      </Modal>
      <Drawer title="详情" open={drawerVisible} onClose={() => setDrawerVisible(false)} width={600}>
        {detailLoading ? <div>加载中...</div> : detail ? <ProDescriptions<AttendanceRule> column={1} dataSource={detail} /> : null}
      </Drawer>
    </div>
  );
};

export default AttendanceRulesPage;

