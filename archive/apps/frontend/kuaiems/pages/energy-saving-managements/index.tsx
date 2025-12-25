/**
 * 节能管理页面
 * 
 * 提供节能管理的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions, ProFormDigit, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { energySavingManagementApi } from '../../services/process';
import type { EnergySavingManagement, EnergySavingManagementCreate, EnergySavingManagementUpdate } from '../../types/process';

/**
 * 节能管理列表页面组件
 */
const EnergySavingManagementsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentManagementUuid, setCurrentManagementUuid] = useState<string | null>(null);
  const [managementDetail, setManagementDetail] = useState<EnergySavingManagement | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑节能管理）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建节能管理
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentManagementUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      managementType: '节能目标',
      measureStatus: '待执行',
      status: '草稿',
    });
  };

  /**
   * 处理编辑节能管理
   */
  const handleEdit = async (record: EnergySavingManagement) => {
    try {
      setIsEdit(true);
      setCurrentManagementUuid(record.uuid);
      setModalVisible(true);
      
      // 获取节能管理详情
      const detail = await energySavingManagementApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        managementNo: detail.managementNo,
        managementName: detail.managementName,
        managementType: detail.managementType,
        energyType: detail.energyType,
        targetValue: detail.targetValue,
        currentValue: detail.currentValue,
        achievementRate: detail.achievementRate,
        savingAmount: detail.savingAmount,
        savingRate: detail.savingRate,
        measureDescription: detail.measureDescription,
        measureStatus: detail.measureStatus,
        effectEvaluation: detail.effectEvaluation,
        startDate: detail.startDate,
        endDate: detail.endDate,
        status: detail.status,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取节能管理详情失败');
    }
  };

  /**
   * 处理删除节能管理
   */
  const handleDelete = async (record: EnergySavingManagement) => {
    try {
      await energySavingManagementApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: EnergySavingManagement) => {
    try {
      setCurrentManagementUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await energySavingManagementApi.get(record.uuid);
      setManagementDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取节能管理详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: EnergySavingManagementCreate | EnergySavingManagementUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentManagementUuid) {
        await energySavingManagementApi.update(currentManagementUuid, values as EnergySavingManagementUpdate);
        messageApi.success('更新成功');
      } else {
        await energySavingManagementApi.create(values as EnergySavingManagementCreate);
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
  const columns: ProColumns<EnergySavingManagement>[] = [
    {
      title: '管理编号',
      dataIndex: 'managementNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.managementNo}</a>
      ),
    },
    {
      title: '管理名称',
      dataIndex: 'managementName',
      width: 200,
      ellipsis: true,
    },
    {
      title: '能源类型',
      dataIndex: 'energyType',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '电': { text: '电' },
        '水': { text: '水' },
        '气': { text: '气' },
        '其他': { text: '其他' },
      },
    },
    {
      title: '目标值',
      dataIndex: 'targetValue',
      width: 120,
      valueType: 'digit',
    },
    {
      title: '管理类型',
      dataIndex: 'managementType',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '节能目标': { text: '节能目标' },
        '节能措施': { text: '节能措施' },
        '节能效果评估': { text: '节能效果评估' },
      },
    },
    {
      title: '目标值',
      dataIndex: 'targetValue',
      width: 120,
      valueType: 'digit',
    },
    {
      title: '当前值',
      dataIndex: 'currentValue',
      width: 120,
      valueType: 'digit',
    },
    {
      title: '达成率',
      dataIndex: 'achievementRate',
      width: 100,
      valueType: 'percent',
    },
    {
      title: '措施状态',
      dataIndex: 'measureStatus',
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
        '执行中': { text: <Tag color="processing">执行中</Tag> },
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
            title="确定要删除这条节能管理吗？"
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
      <UniTable<EnergySavingManagement>
        headerTitle="节能管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await energySavingManagementApi.list({
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
            新建节能管理
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑节能管理' : '新建节能管理'}
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
            name="managementNo"
            label="管理编号"
            rules={[{ required: true, message: '请输入管理编号' }]}
            placeholder="请输入管理编号"
            disabled={isEdit}
          />
          <ProFormText
            name="managementName"
            label="管理名称"
            rules={[{ required: true, message: '请输入管理名称' }]}
            placeholder="请输入管理名称"
          />
          <ProFormSelect
            name="energyType"
            label="能源类型"
            options={[
              { label: '电', value: '电' },
              { label: '水', value: '水' },
              { label: '气', value: '气' },
              { label: '其他', value: '其他' },
            ]}
          />
          <ProFormDigit
            name="targetValue"
            label="目标值"
            placeholder="请输入目标值"
            min={0}
          />
          <ProFormSelect
            name="managementType"
            label="管理类型"
            options={[
              { label: '节能目标', value: '节能目标' },
              { label: '节能措施', value: '节能措施' },
              { label: '节能效果评估', value: '节能效果评估' },
            ]}
            rules={[{ required: true, message: '请选择管理类型' }]}
          />
          <ProFormDigit
            name="targetValue"
            label="目标值"
            placeholder="请输入目标值"
            min={0}
          />
          <ProFormDigit
            name="currentValue"
            label="当前值"
            placeholder="请输入当前值"
            min={0}
          />
          <ProFormDigit
            name="achievementRate"
            label="达成率（%）"
            placeholder="请输入达成率"
            min={0}
            max={100}
          />
          <ProFormDigit
            name="savingAmount"
            label="节约量"
            placeholder="请输入节约量"
            min={0}
          />
          <ProFormDigit
            name="savingRate"
            label="节约率（%）"
            placeholder="请输入节约率"
            min={0}
            max={100}
          />
          <ProFormTextArea
            name="measureDescription"
            label="措施描述"
            placeholder="请输入措施描述"
          />
          <ProFormSelect
            name="measureStatus"
            label="措施状态"
            options={[
              { label: '待执行', value: '待执行' },
              { label: '执行中', value: '执行中' },
              { label: '已完成', value: '已完成' },
            ]}
            initialValue="待执行"
          />
          <ProFormDatePicker
            name="startDate"
            label="开始日期"
            placeholder="请选择开始日期"
          />
          <ProFormDatePicker
            name="endDate"
            label="结束日期"
            placeholder="请选择结束日期"
          />
          <ProFormTextArea
            name="effectEvaluation"
            label="效果评估"
            placeholder="请输入效果评估"
          />
          <ProFormSelect
            name="status"
            label="状态"
            options={[
              { label: '草稿', value: '草稿' },
              { label: '执行中', value: '执行中' },
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
        title="节能管理详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : managementDetail ? (
          <ProDescriptions<EnergySavingManagement>
            column={1}
            dataSource={managementDetail}
            columns={[
              { title: '管理编号', dataIndex: 'managementNo' },
              { title: '管理名称', dataIndex: 'managementName' },
              { title: '管理类型', dataIndex: 'managementType' },
              { title: '能源类型', dataIndex: 'energyType' },
              { title: '目标值', dataIndex: 'targetValue' },
              { title: '当前值', dataIndex: 'currentValue' },
              { title: '达成率', dataIndex: 'achievementRate', valueType: 'percent' },
              { title: '节约量', dataIndex: 'savingAmount' },
              { title: '节约率', dataIndex: 'savingRate', valueType: 'percent' },
              { title: '措施描述', dataIndex: 'measureDescription' },
              { title: '措施状态', dataIndex: 'measureStatus' },
              { title: '效果评估', dataIndex: 'effectEvaluation' },
              { title: '开始日期', dataIndex: 'startDate', valueType: 'dateTime' },
              { title: '结束日期', dataIndex: 'endDate', valueType: 'dateTime' },
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

export default EnergySavingManagementsPage;

