/**
 * 统一需求计算页面
 *
 * 提供统一的需求计算功能，支持MRP和LRP两种计算类型。
 *
 * 根据《☆ 用户使用全场景推演.md》的设计理念，将MRP和LRP合并为统一的需求计算。
 *
 * @author Luigi Lu
 * @date 2025-01-14
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormSelect, ProFormText, ProFormDigit, ProFormTextArea, ProDescriptions } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Drawer, Table, message } from 'antd';
import { PlayCircleOutlined, EyeOutlined, ReloadOutlined, FileAddOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import {
  listDemandComputations,
  getDemandComputation,
  createDemandComputation,
  executeDemandComputation,
  generateOrdersFromComputation,
  validateMaterialSources,
  getMaterialSources,
  DemandComputation,
  DemandComputationItem
} from '../../../services/demand-computation';
import { listDemands, Demand } from '../../../services/demand';

const DemandComputationPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);
  
  // Modal 相关状态（新建计算）
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDemandId, setSelectedDemandId] = useState<number | null>(null);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentComputation, setCurrentComputation] = useState<DemandComputation | null>(null);
  
  // 物料来源信息状态
  const [materialSources, setMaterialSources] = useState<any[]>([]);
  const [validationResults, setValidationResults] = useState<any>(null);
  
  // 需求列表（用于选择需求）
  const [demandList, setDemandList] = useState<Demand[]>([]);

  /**
   * 处理新建计算
   */
  const handleCreate = async () => {
    try {
      // 加载已审核通过的需求列表
      const demands = await listDemands({ status: '已审核', review_status: '通过', limit: 100 });
      setDemandList(demands.data || []);
      setSelectedDemandId(null);
      setModalVisible(true);
      formRef.current?.resetFields();
    } catch (error: any) {
      messageApi.error('加载需求列表失败');
    }
  };

  /**
   * 处理详情查看
   */
  const handleDetail = async (keys: React.Key[]) => {
    if (keys.length === 1) {
      const id = Number(keys[0]);
      try {
        const data = await getDemandComputation(id, true);
        setCurrentComputation(data);
        
        // 获取物料来源信息
        try {
          const sources = await getMaterialSources(id);
          setMaterialSources(sources.material_sources || []);
        } catch (error) {
          console.error('获取物料来源信息失败:', error);
          setMaterialSources([]);
        }
        
        // 获取验证结果
        try {
          const validation = await validateMaterialSources(id);
          setValidationResults(validation);
        } catch (error) {
          console.error('获取验证结果失败:', error);
          setValidationResults(null);
        }
        
        setDrawerVisible(true);
      } catch (error: any) {
        messageApi.error('获取计算详情失败');
      }
    }
  };

  /**
   * 处理执行计算
   */
  const handleExecute = async (record: DemandComputation) => {
    Modal.confirm({
      title: '执行需求计算',
      content: `确认要执行计算 ${record.computation_code} 吗？`,
      onOk: async () => {
        try {
          await executeDemandComputation(record.id!);
          messageApi.success('计算执行成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error('计算执行失败');
        }
      },
    });
  };

  /**
   * 处理一键生成工单和采购单（物料来源控制增强）
   */
  const handleGenerateOrders = async (record: DemandComputation) => {
    // 先验证物料来源配置
    try {
      const validation = await validateMaterialSources(record.id!);
      
      if (!validation.all_passed) {
        // 有验证失败，显示详细错误信息
        const errorMessages = validation.validation_results
          .filter((r: any) => !r.validation_passed)
          .map((r: any) => `物料 ${r.material_code} (${r.material_name}): ${r.errors.join(', ')}`)
          .join('\n');
        
        Modal.warning({
          title: '物料来源验证失败',
          width: 600,
          content: (
            <div>
              <p>以下物料的来源配置验证失败，无法生成工单和采购单：</p>
              <pre style={{ 
                background: '#f5f5f5', 
                padding: '12px', 
                borderRadius: '4px',
                maxHeight: '300px',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {errorMessages}
              </pre>
              <p style={{ marginTop: '12px', color: '#ff4d4f' }}>
                失败数量: {validation.failed_count} / {validation.total_count}
              </p>
            </div>
          ),
        });
        return;
      }
      
      // 获取物料来源统计信息
      const sources = await getMaterialSources(record.id!);
      const sourceTypeCounts: Record<string, number> = {};
      sources.material_sources.forEach((s: any) => {
        const type = s.source_type || '未设置';
        sourceTypeCounts[type] = (sourceTypeCounts[type] || 0) + 1;
      });
      
      const sourceInfo = Object.entries(sourceTypeCounts)
        .map(([type, count]) => {
          const typeNames: Record<string, string> = {
            'Make': '自制件',
            'Buy': '采购件',
            'Phantom': '虚拟件',
            'Outsource': '委外件',
            'Configure': '配置件',
            '未设置': '未设置',
          };
          return `${typeNames[type] || type}: ${count}`;
        })
        .join(', ');
      
      Modal.confirm({
        title: '一键生成工单和采购单',
        width: 600,
        content: (
          <div>
            <p>确认要从计算结果 <strong>{record.computation_code}</strong> 生成工单和采购单吗？</p>
            <div style={{ marginTop: '12px', padding: '12px', background: '#f0f5ff', borderRadius: '4px' }}>
              <p style={{ margin: 0, fontWeight: 'bold' }}>物料来源统计：</p>
              <p style={{ margin: '8px 0 0 0' }}>{sourceInfo}</p>
            </div>
            <p style={{ marginTop: '12px', fontSize: '12px', color: '#666' }}>
              系统将根据物料来源类型智能生成：自制件生成生产工单，采购件生成采购订单，虚拟件自动跳过
            </p>
          </div>
        ),
        onOk: async () => {
          try {
            const result = await generateOrdersFromComputation(record.id!);
            messageApi.success(
              `生成成功！工单 ${result.work_order_count} 个，采购单 ${result.purchase_order_count} 个`
            );
            actionRef.current?.reload();
          } catch (error: any) {
            messageApi.error(error?.response?.data?.detail || '生成工单和采购单失败');
          }
        },
      });
    } catch (error: any) {
      messageApi.error('验证物料来源配置失败');
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<DemandComputation>[] = [
    {
      title: '计算编码',
      dataIndex: 'computation_code',
      width: 150,
      fixed: 'left',
      hideInSearch: false,
    },
    {
      title: '需求编码',
      dataIndex: 'demand_code',
      width: 150,
      hideInSearch: false,
    },
    {
      title: '计算类型',
      dataIndex: 'computation_type',
      width: 100,
      valueType: 'select',
      valueEnum: {
        'MRP': { text: 'MRP' },
        'LRP': { text: 'LRP' },
      },
      hideInSearch: false,
      render: (text: string) => (
        <Tag color={text === 'MRP' ? 'blue' : 'green'}>{text}</Tag>
      ),
    },
    {
      title: '计算状态',
      dataIndex: 'computation_status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '进行中': { text: '进行中' },
        '计算中': { text: '计算中' },
        '完成': { text: '完成' },
        '失败': { text: '失败' },
      },
      hideInSearch: false,
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          '进行中': 'processing',
          '计算中': 'processing',
          '完成': 'success',
          '失败': 'error',
        };
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
      },
    },
    {
      title: '业务模式',
      dataIndex: 'business_mode',
      width: 100,
      valueType: 'select',
      valueEnum: {
        'MTS': { text: 'MTS' },
        'MTO': { text: 'MTO' },
      },
      hideInSearch: false,
      render: (text: string) => (
        <Tag color={text === 'MTS' ? 'cyan' : 'purple'}>{text}</Tag>
      ),
    },
    {
      title: '开始时间',
      dataIndex: 'computation_start_time',
      width: 160,
      valueType: 'dateTime',
      hideInSearch: false,
      search: {
        valueType: 'dateRange',
      },
    },
    {
      title: '结束时间',
      dataIndex: 'computation_end_time',
      width: 160,
      valueType: 'dateTime',
      hideInTable: false,
      hideInSearch: true,
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
            onClick={() => handleDetail([record.id!])}
          >
            详情
          </Button>
          {record.computation_status === '进行中' && (
            <Button
              type="link"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleExecute(record)}
            >
              执行
            </Button>
          )}
          {record.computation_status === '完成' && (
            <Button
              type="link"
              size="small"
              icon={<FileAddOutlined />}
              onClick={() => handleGenerateOrders(record)}
            >
              生成工单/采购单
            </Button>
          )}
        </Space>
      ),
    },
  ];

  /**
   * 渲染页面
   */
  return (
    <ListPageTemplate
      title="统一需求计算"
      description="支持MRP和LRP两种计算类型，统一管理需求计算结果"
    >
      <UniTable<DemandComputation>
        actionRef={actionRef}
        columns={columns}
        showAdvancedSearch={true}
        request={async (params, sort, _filter, searchFormValues) => {
          const apiParams: any = {
            skip: (params.current! - 1) * params.pageSize!,
            limit: params.pageSize!,
          };
          
          // 处理搜索参数
          if (searchFormValues?.computation_code) {
            apiParams.computation_code = searchFormValues.computation_code;
          }
          if (searchFormValues?.demand_code) {
            apiParams.demand_code = searchFormValues.demand_code;
          }
          if (searchFormValues?.computation_type) {
            apiParams.computation_type = searchFormValues.computation_type;
          }
          if (searchFormValues?.computation_status) {
            apiParams.computation_status = searchFormValues.computation_status;
          }
          if (searchFormValues?.business_mode) {
            apiParams.business_mode = searchFormValues.business_mode;
          }
          if (searchFormValues?.demand_id) {
            apiParams.demand_id = searchFormValues.demand_id;
          }
          
          // 处理时间范围搜索
          if (searchFormValues?.computation_start_time) {
            if (Array.isArray(searchFormValues.computation_start_time)) {
              if (searchFormValues.computation_start_time[0]) {
                apiParams.start_date = dayjs(searchFormValues.computation_start_time[0]).format('YYYY-MM-DD');
              }
              if (searchFormValues.computation_start_time[1]) {
                apiParams.end_date = dayjs(searchFormValues.computation_start_time[1]).format('YYYY-MM-DD');
              }
            } else if (searchFormValues.computation_start_time) {
              // 单个日期值
              apiParams.start_date = dayjs(searchFormValues.computation_start_time).format('YYYY-MM-DD');
            }
          }
          
          const result = await listDemandComputations(apiParams);
          return {
            data: result.data || [],
            success: result.success,
            total: result.total || 0,
          };
        }}
        rowKey="id"
        search={{
          labelWidth: 'auto',
        }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            onClick={handleCreate}
          >
            新建计算
          </Button>,
        ]}
      />

      {/* 新建计算Modal */}
      <Modal
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        title="新建需求计算"
        width={800}
        onOk={async () => {
          try {
            const values = await formRef.current?.validateFields();
            const selectedDemand = demandList.find(d => d.id === selectedDemandId);
            if (!selectedDemand) {
              messageApi.error('请选择需求');
              return;
            }
            
            // 根据需求类型确定计算类型
            const computationType = selectedDemand.business_mode === 'MTS' ? 'MRP' : 'LRP';
            
            await createDemandComputation({
              demand_id: selectedDemandId!,
              computation_type: computationType,
              computation_params: values.computation_params || {},
              notes: values.notes,
            });
            
            messageApi.success('创建成功');
            setModalVisible(false);
            actionRef.current?.reload();
          } catch (error: any) {
            messageApi.error('创建失败');
          }
        }}
      >
        <ProForm
          formRef={formRef}
          submitter={false}
          layout="vertical"
        >
          <ProFormSelect
            name="demand_id"
            label="选择需求"
            options={demandList.map(d => ({
              label: `${d.demand_code} - ${d.demand_name || ''}`,
              value: d.id,
            }))}
            fieldProps={{
              onChange: (value) => setSelectedDemandId(value),
            }}
            rules={[{ required: true, message: '请选择需求' }]}
          />
          <ProFormTextArea
            name="notes"
            label="备注"
            placeholder="请输入备注"
          />
        </ProForm>
      </Modal>

      {/* 详情Drawer */}
      <Drawer
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        title="计算详情"
        width={800}
      >
        {currentComputation && (
          <>
            <ProDescriptions<DemandComputation>
              dataSource={currentComputation}
              columns={[
                { title: '计算编码', dataIndex: 'computation_code' },
                { title: '需求编码', dataIndex: 'demand_code' },
                { title: '计算类型', dataIndex: 'computation_type' },
                { title: '计算状态', dataIndex: 'computation_status' },
                { title: '开始时间', dataIndex: 'computation_start_time', valueType: 'dateTime' },
                { title: '结束时间', dataIndex: 'computation_end_time', valueType: 'dateTime' },
              ]}
            />
            
            {/* 物料来源验证结果 */}
            {validationResults && (
              <div style={{ marginTop: 24, marginBottom: 24 }}>
                <ProDescriptions
                  title="物料来源验证结果"
                  size="small"
                  column={3}
                  dataSource={{
                    all_passed: validationResults.all_passed ? '全部通过' : '存在失败',
                    passed_count: validationResults.passed_count,
                    failed_count: validationResults.failed_count,
                    total_count: validationResults.total_count,
                  }}
                  columns={[
                    { 
                      title: '验证状态', 
                      dataIndex: 'all_passed',
                      render: (text: string) => (
                        <Tag color={text === '全部通过' ? 'success' : 'error'}>{text}</Tag>
                      )
                    },
                    { title: '通过数量', dataIndex: 'passed_count' },
                    { title: '失败数量', dataIndex: 'failed_count' },
                    { title: '总数量', dataIndex: 'total_count' },
                  ]}
                />
                
                {validationResults.failed_count > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <p style={{ fontWeight: 'bold', color: '#ff4d4f' }}>验证失败的物料：</p>
                    <ul style={{ marginTop: 8 }}>
                      {validationResults.validation_results
                        .filter((r: any) => !r.validation_passed)
                        .map((r: any, index: number) => (
                          <li key={index} style={{ marginBottom: 4 }}>
                            <strong>{r.material_code}</strong> ({r.material_name}): {r.errors.join(', ')}
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            
            {currentComputation.items && currentComputation.items.length > 0 && (
              <>
                <h3 style={{ marginTop: 24, marginBottom: 16 }}>计算结果明细</h3>
                <Table<DemandComputationItem>
                  dataSource={currentComputation.items}
                  rowKey="id"
                  columns={[
                    { title: '物料编码', dataIndex: 'material_code', width: 120 },
                    { title: '物料名称', dataIndex: 'material_name', width: 150 },
                    { 
                      title: '物料来源', 
                      dataIndex: 'material_source_type',
                      width: 100,
                      render: (type: string) => {
                        const typeMap: Record<string, { label: string; color: string }> = {
                          'Make': { label: '自制件', color: 'blue' },
                          'Buy': { label: '采购件', color: 'green' },
                          'Phantom': { label: '虚拟件', color: 'orange' },
                          'Outsource': { label: '委外件', color: 'purple' },
                          'Configure': { label: '配置件', color: 'cyan' },
                        };
                        const info = typeMap[type] || { label: type || '未设置', color: 'default' };
                        return <Tag color={info.color}>{info.label}</Tag>;
                      }
                    },
                    { 
                      title: '验证状态', 
                      dataIndex: 'source_validation_passed',
                      width: 100,
                      render: (passed: boolean, record: DemandComputationItem) => {
                        if (record.material_source_type) {
                          return (
                            <Tag color={passed ? 'success' : 'error'}>
                              {passed ? '通过' : '失败'}
                            </Tag>
                          );
                        }
                        return <span>-</span>;
                      }
                    },
                    { title: '需求数量', dataIndex: 'required_quantity', width: 100 },
                    { title: '可用库存', dataIndex: 'available_inventory', width: 100 },
                    { title: '净需求', dataIndex: 'net_requirement', width: 100 },
                    { title: '建议工单数量', dataIndex: 'suggested_work_order_quantity', width: 120 },
                    { title: '建议采购数量', dataIndex: 'suggested_purchase_order_quantity', width: 120 },
                  ]}
                  pagination={false}
                  scroll={{ x: 1200 }}
                />
              </>
            )}
          </>
        )}
      </Drawer>
    </ListPageTemplate>
  );
};

export default DemandComputationPage;
