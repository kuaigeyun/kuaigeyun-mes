/**
 * 期初数据导入页面
 *
 * 提供期初数据导入功能，包括期初库存、在制品、应收应付的导入。
 *
 * @author Luigi Lu
 * @date 2026-01-15
 */

import React, { useState } from 'react';
import { App, Card, Steps, Button, Space, DatePicker } from 'antd';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { ImportOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { UniImport } from '../../../../../components/uni-import';
import { 
  importInitialInventory, 
  importInitialWIP, 
  importInitialReceivablesPayables,
  getCountdown,
  type LaunchCountdown,
} from '../../../services/initial-data';
import dayjs, { Dayjs } from 'dayjs';

const InitialDataImportPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [snapshotTime, setSnapshotTime] = useState<Dayjs | null>(null);
  const [launchDate, setLaunchDate] = useState<Dayjs | null>(null);
  const [, setCountdown] = useState<LaunchCountdown | null>(null);
  const [importVisible, setImportVisible] = useState(false);
  const [wipImportVisible, setWipImportVisible] = useState(false);
  const [receivablesPayablesImportVisible, setReceivablesPayablesImportVisible] = useState(false);
  const [, setImporting] = useState(false);
  
  // 加载上线倒计时
  React.useEffect(() => {
    loadCountdown();
  }, []);
  
  const loadCountdown = async () => {
    try {
      const data = await getCountdown();
      if (data) {
        setCountdown(data);
        setLaunchDate(dayjs(data.launch_date));
        if (data.snapshot_time) {
          setSnapshotTime(dayjs(data.snapshot_time));
        }
      }
    } catch (error) {
      console.error('加载上线倒计时失败:', error);
    }
  };
  
  /**
   * 处理期初应收应付导入
   */
  const handleImportReceivablesPayables = async (data: any[][]) => {
    setImporting(true);
    try {
      const result = await importInitialReceivablesPayables(
        data,
        snapshotTime ? snapshotTime.format('YYYY-MM-DD HH:mm:ss') : undefined
      );
      
      if (result.failure_count === 0) {
        messageApi.success(`期初应收应付导入成功！成功导入 ${result.success_count} 条记录`);
        setReceivablesPayablesImportVisible(false);
        setCurrentStep(3); // 进入下一步
      } else {
        messageApi.warning(
          `期初应收应付导入完成，成功 ${result.success_count} 条，失败 ${result.failure_count} 条`
        );
      }
    } catch (error: any) {
      messageApi.error(`导入失败: ${error.message || '未知错误'}`);
    } finally {
      setImporting(false);
    }
  };

  /**
   * 处理期初在制品导入
   */
  const handleImportWIP = async (data: any[][]) => {
    setImporting(true);
    try {
      const result = await importInitialWIP(
        data,
        snapshotTime ? snapshotTime.format('YYYY-MM-DD HH:mm:ss') : undefined
      );
      
      if (result.failure_count === 0) {
        messageApi.success(`期初在制品导入成功！成功导入 ${result.success_count} 条记录`);
        setWipImportVisible(false);
        setCurrentStep(2); // 进入下一步
      } else {
        messageApi.warning(
          `期初在制品导入完成，成功 ${result.success_count} 条，失败 ${result.failure_count} 条`
        );
      }
    } catch (error: any) {
      messageApi.error(`导入失败: ${error.message || '未知错误'}`);
    } finally {
      setImporting(false);
    }
  };

  /**
   * 处理期初库存导入
   */
  const handleImportInventory = async (data: any[][]) => {
    setImporting(true);
    try {
      const result = await importInitialInventory(
        data,
        snapshotTime ? snapshotTime.format('YYYY-MM-DD HH:mm:ss') : undefined
      );
      
      if (result.failure_count === 0) {
        messageApi.success(`期初库存导入成功！成功导入 ${result.success_count} 条记录`);
        setImportVisible(false);
        setCurrentStep(1); // 进入下一步
      } else {
        messageApi.warning(
          `期初库存导入完成，成功 ${result.success_count} 条，失败 ${result.failure_count} 条`
        );
      }
    } catch (error: any) {
      messageApi.error(`导入失败: ${error.message || '未知错误'}`);
    } finally {
      setImporting(false);
    }
  };

  /**
   * 步骤配置
   */
  const steps = [
    {
      title: '期初库存导入',
      description: '导入快照时间点的库存数据',
      content: (
        <div>
          <Space orientation="vertical" style={{ width: '100%' }} size="large">
            <div>
              <h3>快照时间点</h3>
              <p style={{ color: '#666', marginBottom: 16 }}>
                请选择期初数据的快照时间点（建议选择业务相对稳定的时间点，如周末、月末、月初）
              </p>
              <DatePicker
                showTime
                format="YYYY-MM-DD HH:mm:ss"
                placeholder="选择快照时间点"
                value={snapshotTime}
                onChange={(date) => setSnapshotTime(date)}
                style={{ width: '100%', maxWidth: 400 }}
              />
            </div>
            <div>
              <h3>导入数据</h3>
              <p style={{ color: '#666', marginBottom: 16 }}>
                点击下方按钮打开导入表格，填写期初库存数据。
                <br />
                <strong>必填字段：</strong>物料编码（支持部门编码，自动映射）、仓库编码、期初数量
                <br />
                <strong>可选字段：</strong>期初金额、批次号、库位编码
              </p>
              <Button
                type="primary"
                icon={<ImportOutlined />}
                onClick={() => setImportVisible(true)}
                size="large"
              >
                打开导入表格
              </Button>
            </div>
          </Space>
        </div>
      ),
    },
    {
      title: '在制品导入',
      description: '导入快照时间点的在制品数据',
      content: (
        <div>
          <Space orientation="vertical" style={{ width: '100%' }} size="large">
            <div>
              <h3>导入数据</h3>
              <p style={{ color: '#666', marginBottom: 16 }}>
                点击下方按钮打开导入表格，填写期初在制品数据。
                <br />
                <strong>必填字段：</strong>产品编码（支持部门编码，自动映射）、当前工序、在制品数量
                <br />
                <strong>可选字段：</strong>工单号（不提供则自动生成）、已投入数量、预计完成时间、车间编码
              </p>
              <Button
                type="primary"
                icon={<ImportOutlined />}
                onClick={() => setWipImportVisible(true)}
                size="large"
              >
                打开导入表格
              </Button>
            </div>
          </Space>
        </div>
      ),
    },
    {
      title: '应收应付导入',
      description: '导入快照时间点的应收应付数据',
      content: (
        <div>
          <Space orientation="vertical" style={{ width: '100%' }} size="large">
            <div>
              <h3>导入数据</h3>
              <p style={{ color: '#666', marginBottom: 16 }}>
                点击下方按钮打开导入表格，填写期初应收应付数据。
                <br />
                <strong>必填字段：</strong>类型（应收/应付）、客户编码（应收时）/供应商编码（应付时）、单据类型、单据号、单据日期、应收金额（应收时）/应付金额（应付时）
                <br />
                <strong>可选字段：</strong>已收金额、已付金额、到期日期、发票号
              </p>
              <Button
                type="primary"
                icon={<ImportOutlined />}
                onClick={() => setReceivablesPayablesImportVisible(true)}
                size="large"
              >
                打开导入表格
              </Button>
            </div>
          </Space>
        </div>
      ),
    },
    {
      title: '完成',
      description: '期初数据导入完成',
      content: (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a', marginBottom: 16 }} />
          <h2>期初数据导入完成！</h2>
          <p style={{ color: '#666', marginTop: 16 }}>
            所有期初数据已成功导入系统，您可以开始使用系统进行业务操作。
          </p>
        </div>
      ),
    },
  ];

  const stepItems = steps.map(step => ({
    title: step.title,
    description: step.description,
  }));

  return (
    <ListPageTemplate>
      <Card styles={{ body: { padding: 16 } }}>
        <Steps current={currentStep} items={stepItems} style={{ marginBottom: 32 }} />
        
        <div style={{ minHeight: 400, marginBottom: 24 }}>
          {steps[currentStep].content}
        </div>
        
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          {currentStep > 0 && (
            <Button onClick={() => setCurrentStep(currentStep - 1)}>上一步</Button>
          )}
          {currentStep < steps.length - 1 && (
            <Button type="primary" onClick={() => setCurrentStep(currentStep + 1)}>
              下一步
            </Button>
          )}
        </Space>
      </Card>

      {/* 期初库存导入弹窗 */}
      <UniImport
        visible={importVisible}
        onCancel={() => setImportVisible(false)}
        onConfirm={handleImportInventory}
        title="导入期初库存"
        headers={['物料编码', '仓库编码', '期初数量', '期初金额', '批次号', '库位编码']}
        exampleRow={['MAT001', 'WH001', '100', '1000.00', 'BATCH001', 'LOC001']}
      />

      {/* 期初在制品导入弹窗 */}
      <UniImport
        visible={wipImportVisible}
        onCancel={() => setWipImportVisible(false)}
        onConfirm={handleImportWIP}
        title="导入期初在制品"
        headers={['工单号', '产品编码', '当前工序', '在制品数量', '已投入数量', '预计完成时间', '车间编码']}
        exampleRow={['', 'PROD001', 'OP001', '50', '100', '2026-01-20 18:00:00', 'WS001']}
      />

      {/* 期初应收应付导入弹窗 */}
      <UniImport
        visible={receivablesPayablesImportVisible}
        onCancel={() => setReceivablesPayablesImportVisible(false)}
        onConfirm={handleImportReceivablesPayables}
        title="导入期初应收应付"
        headers={['类型', '客户编码', '供应商编码', '单据类型', '单据号', '单据日期', '应收金额', '应付金额', '已收金额', '已付金额', '到期日期', '发票号']}
        exampleRow={['应收', 'CUS001', '', '销售订单', 'SO001', '2026-01-10', '10000.00', '', '0', '', '2026-02-10', 'INV001']}
      />
    </ListPageTemplate>
  );
};

export default InitialDataImportPage;
