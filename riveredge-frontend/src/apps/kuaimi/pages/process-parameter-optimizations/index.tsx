/**
 * 工艺参数优化管理页面
 * 
 * 提供工艺参数优化的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions, ProFormDigit } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni_table';
import { processParameterOptimizationApi } from '../../services/process';
import type { ProcessParameterOptimization, ProcessParameterOptimizationCreate, ProcessParameterOptimizationUpdate } from '../../types/process';

/**
 * 工艺参数优化管理列表页面组件
 */
const ProcessParameterOptimizationsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentOptimizationUuid, setCurrentOptimizationUuid] = useState<string | null>(null);
  const [optimizationDetail, setOptimizationDetail] = useState<ProcessParameterOptimization | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑工艺参数优化）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建工艺参数优化
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentOptimizationUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      improvementStatus: '待执行',
      status: '草稿',
    });
  };

  /**
   * 处理编辑工艺参数优化
   */
  const handleEdit = async (record: ProcessParameterOptimization) => {
    try {
      setIsEdit(true);
      setCurrentOptimizationUuid(record.uuid);
      setModalVisible(true);
      
      // 获取工艺参数优化详情
      const detail = await processParameterOptimizationApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        optimizationNo: detail.optimizationNo,
        optimizationName: detail.optimizationName,
        processId: detail.processId,
        processName: detail.processName,
        improvementStatus: detail.improvementStatus,
        status: detail.status,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取工艺参数优化详情失败');
    }
  };

  /**
   * 处理删除工艺参数优化
   */
  const handleDelete = async (record: ProcessParameterOptimization) => {
    try {
      await processParameterOptimizationApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: ProcessParameterOptimization) => {
    try {
      setCurrentOptimizationUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await processParameterOptimizationApi.get(record.uuid);
      setOptimizationDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取工艺参数优化详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: ProcessParameterOptimizationCreate | ProcessParameterOptimizationUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentOptimizationUuid) {
        await processParameterOptimizationApi.update(currentOptimizationUuid, values as ProcessParameterOptimizationUpdate);
        messageApi.success('更新成功');
      } else {
        await processParameterOptimizationApi.create(values as ProcessParameterOptimizationCreate);
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
  const columns: ProColumns<ProcessParameterOptimization>[] = [
    {
      title: '优化编号',
      dataIndex: 'optimizationNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.optimizationNo}</a>
      ),
    },
    {
      title: '优化名称',
      dataIndex: 'optimizationName',
      width: 200,
      ellipsis: true,
    },
    {
      title: '工艺名称',
      dataIndex: 'processName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '改进状态',
      dataIndex: 'improvementStatus',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '待执行': { text: <Tag color="default">待执行</Tag> },
        '执行中': { text: <Tag color="processing">执行中</Tag> },
        '已完成': { text: <Tag color="green">已完成</Tag> },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '草稿': { text: <Tag color="default">草稿</Tag> },
        '已完成': { text: <Tag color="green">已完成</Tag> },
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
            title="确定要删除这条工艺参数优化吗？"
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
      <UniTable<ProcessParameterOptimization>
        headerTitle="工艺参数优化管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await processParameterOptimizationApi.list({
            skip,
            limit: pageSize,
            ...rest,
          });
          return {
            data,
            success: true,
            total: data.length, // TODO: 后端需要返回总数
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
            新建工艺参数优化
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑工艺参数优化' : '新建工艺参数优化'}
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
            name="optimizationNo"
            label="优化编号"
            rules={[{ required: true, message: '请输入优化编号' }]}
            placeholder="请输入优化编号"
            disabled={isEdit}
          />
          <ProFormText
            name="optimizationName"
            label="优化名称"
            rules={[{ required: true, message: '请输入优化名称' }]}
            placeholder="请输入优化名称"
          />
          <ProFormDigit
            name="processId"
            label="工艺ID"
            placeholder="请输入工艺ID"
          />
          <ProFormText
            name="processName"
            label="工艺名称"
            placeholder="请输入工艺名称"
          />
          <ProFormSelect
            name="improvementStatus"
            label="改进状态"
            options={[
              { label: '待执行', value: '待执行' },
              { label: '执行中', value: '执行中' },
              { label: '已完成', value: '已完成' },
            ]}
            initialValue="待执行"
          />
          <ProFormSelect
            name="status"
            label="状态"
            options={[
              { label: '草稿', value: '草稿' },
              { label: '已完成', value: '已完成' },
            ]}
            initialValue="草稿"
          />
          <ProFormTextArea
            name="remark"
            label="备注"
            placeholder="请输入备注信息"
          />
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="工艺参数优化详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : optimizationDetail ? (
          <ProDescriptions<ProcessParameterOptimization>
            column={1}
            dataSource={optimizationDetail}
            columns={[
              { title: '优化编号', dataIndex: 'optimizationNo' },
              { title: '优化名称', dataIndex: 'optimizationName' },
              { title: '工艺ID', dataIndex: 'processId' },
              { title: '工艺名称', dataIndex: 'processName' },
              { title: '改进状态', dataIndex: 'improvementStatus' },
              { title: '状态', dataIndex: 'status' },
              { title: '备注', dataIndex: 'remark' },
              { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
              { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
            ]}
          />
        ) : null}
      </Drawer>
    </div>
  );
};

export default ProcessParameterOptimizationsPage;

