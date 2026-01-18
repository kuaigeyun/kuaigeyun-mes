/**
 * 二维码扫描页面
 * 
 * 提供二维码扫描功能，扫描后自动跳转到对应的详情页面
 * 
 * Author: Luigi Lu
 * Date: 2026-01-27
 */

import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { App, Card, Spin, message } from 'antd';
import { QRCodeScanner } from '../../components/qrcode';
import { qrcodeApi, type QRCodeParseResponse } from '../../services/qrcode';

/**
 * 二维码扫描页面组件
 */
const QRCodeScanPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  /**
   * 处理二维码扫描成功
   */
  const handleScanSuccess = async (response: QRCodeParseResponse) => {
    try {
      const { qrcode_type, data } = response;

      // 根据二维码类型跳转到对应的详情页面
      switch (qrcode_type) {
        case 'MAT': {
          // 物料码：跳转到物料详情
          const materialUuid = data.material_uuid;
          if (materialUuid) {
            navigate(`/apps/master-data/materials?uuid=${materialUuid}&action=detail`);
            messageApi.success('正在跳转到物料详情...');
          } else {
            messageApi.error('物料二维码数据不完整');
          }
          break;
        }
        case 'WO': {
          // 工单码：跳转到工单详情
          const workOrderUuid = data.work_order_uuid;
          if (workOrderUuid) {
            navigate(`/apps/kuaizhizao/production-execution/work-orders?uuid=${workOrderUuid}&action=detail`);
            messageApi.success('正在跳转到工单详情...');
          } else {
            messageApi.error('工单二维码数据不完整');
          }
          break;
        }
        case 'OP': {
          // 工序码：跳转到工序详情
          const operationUuid = data.operation_uuid;
          if (operationUuid) {
            navigate(`/apps/master-data/process/operations?operationUuid=${operationUuid}&action=detail`);
            messageApi.success('正在跳转到工序详情...');
          } else {
            messageApi.error('工序二维码数据不完整');
          }
          break;
        }
        case 'EQ': {
          // 设备码：跳转到设备详情
          const equipmentUuid = data.equipment_uuid;
          if (equipmentUuid) {
            navigate(`/system/equipment?uuid=${equipmentUuid}&action=detail`);
            messageApi.success('正在跳转到设备详情...');
          } else {
            messageApi.error('设备二维码数据不完整');
          }
          break;
        }
        case 'EMP': {
          // 人员码：跳转到人员详情
          const employeeUuid = data.employee_uuid;
          if (employeeUuid) {
            navigate(`/system/users?uuid=${employeeUuid}&action=detail`);
            messageApi.success('正在跳转到人员详情...');
          } else {
            messageApi.error('人员二维码数据不完整');
          }
          break;
        }
        case 'BOX': {
          // 装箱码：跳转到装箱详情
          const boxUuid = data.box_uuid;
          if (boxUuid) {
            navigate(`/apps/kuaizhizao/warehouse-management/packing?uuid=${boxUuid}&action=detail`);
            messageApi.success('正在跳转到装箱详情...');
          } else {
            messageApi.error('装箱二维码数据不完整');
          }
          break;
        }
        case 'TRACE': {
          // 追溯码：跳转到追溯详情
          const traceUuid = data.trace_uuid;
          if (traceUuid) {
            navigate(`/apps/kuaizhizao/quality-management/trace?uuid=${traceUuid}&action=detail`);
            messageApi.success('正在跳转到追溯详情...');
          } else {
            messageApi.error('追溯二维码数据不完整');
          }
          break;
        }
        default:
          messageApi.warning(`未知的二维码类型: ${qrcode_type}`);
      }
    } catch (error: any) {
      messageApi.error(`处理二维码失败: ${error.message || '未知错误'}`);
    }
  };

  /**
   * 处理URL参数中的二维码文本（用于直接解析）
   */
  useEffect(() => {
    const qrcodeText = searchParams.get('text');
    if (qrcodeText) {
      // 自动解析URL参数中的二维码文本
      qrcodeApi.parse({ qrcode_text: qrcodeText })
        .then(handleScanSuccess)
        .catch((error: any) => {
          messageApi.error(`解析二维码失败: ${error.message || '未知错误'}`);
        });
    }
  }, [searchParams]);

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <Card title="二维码扫描">
        <QRCodeScanner
          onScanSuccess={handleScanSuccess}
          showResult={true}
        />
      </Card>
    </div>
  );
};

export default QRCodeScanPage;
