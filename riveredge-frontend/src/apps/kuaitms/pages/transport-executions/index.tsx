/**
 * 运输执行管理页面
 * 
 * 提供运输执行的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions, ProFormDigit, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni_table';
import { transportExecutionApi } from '../../services/process';
import type { TransportExecution, TransportExecutionCreate, TransportExecutionUpdate } from '../../types/process';

/**
 * 运输执行管理列表页面组件
 */
const TransportExecutionsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentExecutionUuid, setCurrentExecutionUuid] = useState<string | null>(null);
  const [executionDetail, setExecutionDetail] = useState<TransportExecution | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑运输执行）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建运输执行
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentExecutionUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      loadingStatus: '待装车',
      trackingStatus: '待发车',
      signStatus: '待签收',
    });
  };

  /**
   * 处理编辑运输执行
   */
  const handleEdit = async (record: TransportExecution) => {
    try {
      setIsEdit(true);
      setCurrentExecutionUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await transportExecutionApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        executionNo: detail.executionNo,
        planId: detail.planId,
        vehicleId: detail.vehicleId,
        vehicleNo: detail.vehicleNo,
        driverId: detail.driverId,
        driverName: detail.driverName,
        loadingDate: detail.loadingDate,
        loadingStatus: detail.loadingStatus,
        departureDate: detail.departureDate,
        currentLocation: detail.currentLocation,
        trackingStatus: detail.trackingStatus,
        arrivalDate: detail.arrivalDate,
        signDate: detail.signDate,
        signPerson: detail.signPerson,
        signStatus: detail.signStatus,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取运输执行详情失败');
    }
  };

  /**
   * 处理删除运输执行
   */
  const handleDelete = async (record: TransportExecution) => {
    try {
      await transportExecutionApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: TransportExecution) => {
    try {
      setCurrentExecutionUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await transportExecutionApi.get(record.uuid);
      setExecutionDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取运输执行详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: TransportExecutionCreate | TransportExecutionUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentExecutionUuid) {
        await transportExecutionApi.update(currentExecutionUuid, values as TransportExecutionUpdate);
        messageApi.success('更新成功');
      } else {
        await transportExecutionApi.create(values as TransportExecutionCreate);
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
  const columns: ProColumns<TransportExecution>[] = [
    {
      title: '执行单编号',
      dataIndex: 'executionNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.executionNo}</a>
      ),
    },
    {
      title: '车牌号',
      dataIndex: 'vehicleNo',
      width: 120,
      ellipsis: true,
    },
    {
      title: '司机姓名',
      dataIndex: 'driverName',
      width: 100,
      ellipsis: true,
    },
    {
      title: '装车状态',
      dataIndex: 'loadingStatus',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '待装车': { text: <Tag color="blue">待装车</Tag> },
        '装车中': { text: <Tag color="orange">装车中</Tag> },
        '已装车': { text: <Tag color="green">已装车</Tag> },
      },
    },
    {
      title: '跟踪状态',
      dataIndex: 'trackingStatus',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '待发车': { text: <Tag color="blue">待发车</Tag> },
        '在途': { text: <Tag color="orange">在途</Tag> },
        '已到达': { text: <Tag color="green">已到达</Tag> },
        '已签收': { text: <Tag color="green">已签收</Tag> },
      },
    },
    {
      title: '签收状态',
      dataIndex: 'signStatus',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '待签收': { text: <Tag color="blue">待签收</Tag> },
        '已签收': { text: <Tag color="green">已签收</Tag> },
        '拒签': { text: <Tag color="red">拒签</Tag> },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '待执行': { text: <Tag color="blue">待执行</Tag> },
        '执行中': { text: <Tag color="orange">执行中</Tag> },
        '已完成': { text: <Tag color="green">已完成</Tag> },
        '异常': { text: <Tag color="red">异常</Tag> },
        '已取消': { text: <Tag color="default">已取消</Tag> },
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
            title="确定要删除这条运输执行记录吗？"
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
      <UniTable<TransportExecution>
        headerTitle="运输执行管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await transportExecutionApi.list({
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
            新建运输执行
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑运输执行' : '新建运输执行'}
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
            name="executionNo"
            label="执行单编号"
            rules={[{ required: true, message: '请输入执行单编号' }]}
            placeholder="请输入执行单编号"
          />
          <ProFormDigit
            name="planId"
            label="运输计划ID"
            placeholder="请输入运输计划ID（可选）"
          />
          <ProFormDigit
            name="vehicleId"
            label="车辆ID"
            placeholder="请输入车辆ID"
          />
          <ProFormText
            name="vehicleNo"
            label="车牌号"
            placeholder="请输入车牌号"
          />
          <ProFormDigit
            name="driverId"
            label="司机ID"
            placeholder="请输入司机ID"
          />
          <ProFormText
            name="driverName"
            label="司机姓名"
            placeholder="请输入司机姓名"
          />
          <ProFormDatePicker
            name="loadingDate"
            label="装车日期"
            placeholder="请选择装车日期"
          />
          <ProFormSelect
            name="loadingStatus"
            label="装车状态"
            options={[
              { label: '待装车', value: '待装车' },
              { label: '装车中', value: '装车中' },
              { label: '已装车', value: '已装车' },
            ]}
          />
          <ProFormDatePicker
            name="departureDate"
            label="发车日期"
            placeholder="请选择发车日期"
          />
          <ProFormText
            name="currentLocation"
            label="当前位置"
            placeholder="请输入当前位置（GPS坐标）"
          />
          <ProFormSelect
            name="trackingStatus"
            label="跟踪状态"
            options={[
              { label: '待发车', value: '待发车' },
              { label: '在途', value: '在途' },
              { label: '已到达', value: '已到达' },
              { label: '已签收', value: '已签收' },
            ]}
          />
          <ProFormDatePicker
            name="arrivalDate"
            label="到达日期"
            placeholder="请选择到达日期"
          />
          <ProFormDatePicker
            name="signDate"
            label="签收日期"
            placeholder="请选择签收日期"
          />
          <ProFormText
            name="signPerson"
            label="签收人"
            placeholder="请输入签收人"
          />
          <ProFormSelect
            name="signStatus"
            label="签收状态"
            options={[
              { label: '待签收', value: '待签收' },
              { label: '已签收', value: '已签收' },
              { label: '拒签', value: '拒签' },
            ]}
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
        title="运输执行详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : executionDetail ? (
          <ProDescriptions<TransportExecution>
            column={1}
            dataSource={executionDetail}
            columns={[
              { title: '执行单编号', dataIndex: 'executionNo' },
              { title: '运输计划ID', dataIndex: 'planId' },
              { title: '车辆ID', dataIndex: 'vehicleId' },
              { title: '车牌号', dataIndex: 'vehicleNo' },
              { title: '司机ID', dataIndex: 'driverId' },
              { title: '司机姓名', dataIndex: 'driverName' },
              { title: '装车日期', dataIndex: 'loadingDate', valueType: 'dateTime' },
              { title: '装车状态', dataIndex: 'loadingStatus' },
              { title: '发车日期', dataIndex: 'departureDate', valueType: 'dateTime' },
              { title: '当前位置', dataIndex: 'currentLocation' },
              { title: '跟踪状态', dataIndex: 'trackingStatus' },
              { title: '到达日期', dataIndex: 'arrivalDate', valueType: 'dateTime' },
              { title: '签收日期', dataIndex: 'signDate', valueType: 'dateTime' },
              { title: '签收人', dataIndex: 'signPerson' },
              { title: '签收状态', dataIndex: 'signStatus' },
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

export default TransportExecutionsPage;

