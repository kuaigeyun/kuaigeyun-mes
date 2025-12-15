/**
 * 维护计划管理页面
 * 
 * 提供维护计划的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions, ProFormDigit, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni_table';
import { maintenancePlanApi } from '../../services/process';
import type { MaintenancePlan, MaintenancePlanCreate, MaintenancePlanUpdate } from '../../types/process';

/**
 * 维护计划管理列表页面组件
 */
const MaintenancePlansPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentPlanUuid, setCurrentPlanUuid] = useState<string | null>(null);
  const [planDetail, setPlanDetail] = useState<MaintenancePlan | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑维护计划）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建维护计划
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentPlanUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      priority: '中',
    });
  };

  /**
   * 处理编辑维护计划
   */
  const handleEdit = async (record: MaintenancePlan) => {
    try {
      setIsEdit(true);
      setCurrentPlanUuid(record.uuid);
      setModalVisible(true);
      
      // 获取维护计划详情
      const detail = await maintenancePlanApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        planNo: detail.planNo,
        planName: detail.planName,
        equipmentId: detail.equipmentId,
        equipmentName: detail.equipmentName,
        planType: detail.planType,
        maintenanceType: detail.maintenanceType,
        cycleType: detail.cycleType,
        cycleValue: detail.cycleValue,
        cycleUnit: detail.cycleUnit,
        plannedStartDate: detail.plannedStartDate,
        plannedEndDate: detail.plannedEndDate,
        responsiblePersonId: detail.responsiblePersonId,
        responsiblePersonName: detail.responsiblePersonName,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取维护计划详情失败');
    }
  };

  /**
   * 处理删除维护计划
   */
  const handleDelete = async (record: MaintenancePlan) => {
    try {
      await maintenancePlanApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: MaintenancePlan) => {
    try {
      setCurrentPlanUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await maintenancePlanApi.get(record.uuid);
      setPlanDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取维护计划详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: MaintenancePlanCreate | MaintenancePlanUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentPlanUuid) {
        await maintenancePlanApi.update(currentPlanUuid, values as MaintenancePlanUpdate);
        messageApi.success('更新成功');
      } else {
        await maintenancePlanApi.create(values as MaintenancePlanCreate);
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
  const columns: ProColumns<MaintenancePlan>[] = [
    {
      title: '计划编号',
      dataIndex: 'planNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.planNo}</a>
      ),
    },
    {
      title: '计划名称',
      dataIndex: 'planName',
      width: 200,
      ellipsis: true,
    },
    {
      title: '设备名称',
      dataIndex: 'equipmentName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '计划类型',
      dataIndex: 'planType',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '预防性维护': { text: '预防性维护' },
        '计划性维护': { text: '计划性维护' },
        '临时维护': { text: '临时维护' },
      },
    },
    {
      title: '维护类型',
      dataIndex: 'maintenanceType',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '日常保养': { text: '日常保养' },
        '定期检修': { text: '定期检修' },
        '大修': { text: '大修' },
      },
    },
    {
      title: '周期',
      dataIndex: 'cycleValue',
      width: 100,
      render: (_, record) => {
        if (record.cycleValue && record.cycleUnit) {
          return `${record.cycleValue} ${record.cycleUnit}`;
        }
        return '-';
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
        '已取消': { text: <Tag color="default">已取消</Tag> },
      },
    },
    {
      title: '负责人',
      dataIndex: 'responsiblePersonName',
      width: 100,
      ellipsis: true,
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
            title="确定要删除这条维护计划吗？"
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
      <UniTable<MaintenancePlan>
        headerTitle="维护计划管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await maintenancePlanApi.list({
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
            新建维护计划
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑维护计划' : '新建维护计划'}
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
            name="planNo"
            label="计划编号"
            rules={[{ required: true, message: '请输入计划编号' }]}
            placeholder="请输入计划编号"
          />
          <ProFormText
            name="planName"
            label="计划名称"
            rules={[{ required: true, message: '请输入计划名称' }]}
            placeholder="请输入计划名称"
          />
          <ProFormDigit
            name="equipmentId"
            label="设备ID"
            rules={[{ required: true, message: '请输入设备ID' }]}
            placeholder="请输入设备ID"
          />
          <ProFormText
            name="equipmentName"
            label="设备名称"
            rules={[{ required: true, message: '请输入设备名称' }]}
            placeholder="请输入设备名称"
          />
          <ProFormSelect
            name="planType"
            label="计划类型"
            options={[
              { label: '预防性维护', value: '预防性维护' },
              { label: '计划性维护', value: '计划性维护' },
              { label: '临时维护', value: '临时维护' },
            ]}
            rules={[{ required: true, message: '请选择计划类型' }]}
          />
          <ProFormSelect
            name="maintenanceType"
            label="维护类型"
            options={[
              { label: '日常保养', value: '日常保养' },
              { label: '定期检修', value: '定期检修' },
              { label: '大修', value: '大修' },
            ]}
            rules={[{ required: true, message: '请选择维护类型' }]}
          />
          <ProFormSelect
            name="cycleType"
            label="周期类型"
            options={[
              { label: '按天', value: '按天' },
              { label: '按周', value: '按周' },
              { label: '按月', value: '按月' },
              { label: '按年', value: '按年' },
            ]}
            placeholder="请选择周期类型"
          />
          <ProFormDigit
            name="cycleValue"
            label="周期值"
            placeholder="请输入周期值"
          />
          <ProFormSelect
            name="cycleUnit"
            label="周期单位"
            options={[
              { label: '天', value: '天' },
              { label: '周', value: '周' },
              { label: '月', value: '月' },
              { label: '年', value: '年' },
            ]}
            placeholder="请选择周期单位"
          />
          <ProFormDatePicker
            name="plannedStartDate"
            label="计划开始日期"
            placeholder="请选择计划开始日期"
          />
          <ProFormDatePicker
            name="plannedEndDate"
            label="计划结束日期"
            placeholder="请选择计划结束日期"
          />
          <ProFormDigit
            name="responsiblePersonId"
            label="负责人ID"
            placeholder="请输入负责人ID"
          />
          <ProFormText
            name="responsiblePersonName"
            label="负责人姓名"
            placeholder="请输入负责人姓名"
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
        title="维护计划详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : planDetail ? (
          <ProDescriptions<MaintenancePlan>
            column={1}
            dataSource={planDetail}
            columns={[
              { title: '计划编号', dataIndex: 'planNo' },
              { title: '计划名称', dataIndex: 'planName' },
              { title: '设备ID', dataIndex: 'equipmentId' },
              { title: '设备名称', dataIndex: 'equipmentName' },
              { title: '计划类型', dataIndex: 'planType' },
              { title: '维护类型', dataIndex: 'maintenanceType' },
              { title: '周期类型', dataIndex: 'cycleType' },
              { title: '周期值', dataIndex: 'cycleValue' },
              { title: '周期单位', dataIndex: 'cycleUnit' },
              { title: '计划开始日期', dataIndex: 'plannedStartDate', valueType: 'dateTime' },
              { title: '计划结束日期', dataIndex: 'plannedEndDate', valueType: 'dateTime' },
              { title: '负责人ID', dataIndex: 'responsiblePersonId' },
              { title: '负责人姓名', dataIndex: 'responsiblePersonName' },
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

export default MaintenancePlansPage;

