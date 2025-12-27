/**
 * 财务报表管理页面
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormDatePicker, ProFormDigit, ProFormInstance, ProDescriptions, Button as ProButton } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, FileTextOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { financialReportApi } from '../../services/process';
import type { FinancialReport, FinancialReportCreate } from '../../types/process';

const FinancialReportsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentUuid, setCurrentUuid] = useState<string | null>(null);
  const [detail, setDetail] = useState<FinancialReport | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [generateModalVisible, setGenerateModalVisible] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);

  const handleCreate = () => {
    setIsEdit(false);
    setCurrentUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      status: '草稿',
      year: new Date().getFullYear(),
    });
  };

  const handleEdit = async (record: FinancialReport) => {
    try {
      setIsEdit(true);
      setCurrentUuid(record.uuid);
      setModalVisible(true);
      const data = await financialReportApi.get(record.uuid);
      formRef.current?.setFieldsValue(data);
    } catch (error: any) {
      messageApi.error(error.message || '获取详情失败');
    }
  };

  const handleDelete = async (record: FinancialReport) => {
    try {
      await financialReportApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  const handleOpenDetail = async (record: FinancialReport) => {
    try {
      setCurrentUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      const data = await financialReportApi.get(record.uuid);
      setDetail(data);
    } catch (error: any) {
      messageApi.error(error.message || '获取详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleGenerate = () => {
    setGenerateModalVisible(true);
    formRef.current?.resetFields();
  };

  const handleGenerateSubmit = async (values: { reportType: string; reportPeriod: string }) => {
    try {
      setGenerateLoading(true);
      await financialReportApi.generate(values.reportType, values.reportPeriod);
      messageApi.success('报表生成成功');
      setGenerateModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '报表生成失败');
    } finally {
      setGenerateLoading(false);
    }
  };

  const handleSubmit = async (values: FinancialReportCreate) => {
    try {
      setFormLoading(true);
      if (isEdit && currentUuid) {
        await financialReportApi.update(currentUuid, values);
        messageApi.success('更新成功');
      } else {
        await financialReportApi.create(values);
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

  const columns: ProColumns<FinancialReport>[] = [
    {
      title: '报表编号',
      dataIndex: 'reportNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.reportNo}</a>
      ),
    },
    {
      title: '报表类型',
      dataIndex: 'reportType',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '资产负债表': { text: '资产负债表' },
        '利润表': { text: '利润表' },
        '现金流量表': { text: '现金流量表' },
        '成本报表': { text: '成本报表' },
      },
    },
    {
      title: '报表期间',
      dataIndex: 'reportPeriod',
      width: 120,
    },
    {
      title: '年度',
      dataIndex: 'year',
      width: 80,
    },
    {
      title: '月份',
      dataIndex: 'month',
      width: 80,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '草稿': { text: <Tag color="default">草稿</Tag> },
        '已生成': { text: <Tag color="blue">已生成</Tag> },
        '已审核': { text: <Tag color="green">已审核</Tag> },
        '已发布': { text: <Tag color="green">已发布</Tag> },
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
      <UniTable<FinancialReport>
        headerTitle="财务报表管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await financialReportApi.list({ skip, limit: pageSize, ...rest });
          return { data, success: true, total: data.length };
        }}
        rowKey="uuid"
        search={{ labelWidth: 'auto' }}
        toolBarRender={() => [
          <Button type="primary" key="generate" icon={<FileTextOutlined />} onClick={handleGenerate}>生成报表</Button>,
          <Button type="primary" key="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建报表</Button>,
        ]}
        rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
      />
      <Modal title={isEdit ? '编辑财务报表' : '新建财务报表'} open={modalVisible} onCancel={() => setModalVisible(false)} footer={null} width={800}>
        <ProForm formRef={formRef} onFinish={handleSubmit} submitter={{ searchConfig: { submitText: isEdit ? '更新' : '创建' }, submitButtonProps: { loading: formLoading } }}>
          <ProFormText name="reportNo" label="报表编号" rules={[{ required: true }]} />
          <ProFormSelect name="reportType" label="报表类型" options={[{ label: '资产负债表', value: '资产负债表' }, { label: '利润表', value: '利润表' }, { label: '现金流量表', value: '现金流量表' }, { label: '成本报表', value: '成本报表' }]} rules={[{ required: true }]} />
          <ProFormText name="reportPeriod" label="报表期间" rules={[{ required: true }]} placeholder="格式：2024-01、2024" />
          <ProFormDatePicker name="reportDate" label="报表日期" rules={[{ required: true }]} />
          <ProFormDigit name="year" label="年度" rules={[{ required: true }]} min={2000} max={9999} />
          <ProFormDigit name="month" label="月份" min={1} max={12} />
        </ProForm>
      </Modal>
      <Modal title="生成财务报表" open={generateModalVisible} onCancel={() => setGenerateModalVisible(false)} footer={null} width={600}>
        <ProForm formRef={formRef} onFinish={handleGenerateSubmit} submitter={{ searchConfig: { submitText: '生成' }, submitButtonProps: { loading: generateLoading } }}>
          <ProFormSelect name="reportType" label="报表类型" options={[{ label: '资产负债表', value: '资产负债表' }, { label: '利润表', value: '利润表' }, { label: '现金流量表', value: '现金流量表' }, { label: '成本报表', value: '成本报表' }]} rules={[{ required: true }]} />
          <ProFormText name="reportPeriod" label="报表期间" rules={[{ required: true }]} placeholder="格式：2024-01、2024" />
        </ProForm>
      </Modal>
      <Drawer title="财务报表详情" open={drawerVisible} onClose={() => setDrawerVisible(false)} width={600}>
        {detailLoading ? <div>加载中...</div> : detail ? <ProDescriptions<FinancialReport> column={1} dataSource={detail} /> : null}
      </Drawer>
    </div>
  );
};

export default FinancialReportsPage;
