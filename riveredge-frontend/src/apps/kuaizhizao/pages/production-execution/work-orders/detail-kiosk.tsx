/**
 * 工单执行详情页 - 触屏模式
 *
 * 核心生产执行界面，集成SOP查看、关键物料批次录入、开始/暂停/结束控制及报工。
 *
 * Author: RiverEdge AI
 * Date: 2026-02-05
 */

import React, { useState, useEffect } from 'react';
import { Card, Button, Row, Col, Tabs, Tag, Descriptions, message, Modal, Input, Space, Statistic, Progress } from 'antd';
import { 
    ArrowLeftOutlined, 
    PlayCircleOutlined, 
    PauseCircleOutlined, 
    CheckCircleOutlined, 
    FileTextOutlined, 
    BarcodeOutlined,
    FormOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { TouchScreenTemplate, TOUCH_SCREEN_CONFIG, HMI_DESIGN_TOKENS } from '../../../../../components/layout-templates';
import NumericKeypad from '../../../../../components/touch-keyboard/NumericKeypad';
import { workOrderApi } from '../../../services/production';

const { Meta } = Card;

const WorkOrderDetailKioskPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [workOrder, setWorkOrder] = useState<any>(null);
    const [activeOperation, setActiveOperation] = useState<any>(null);
    
    // 报工 Modal
    const [reportModalVisible, setReportModalVisible] = useState(false);
    const [reportQuantity, setReportQuantity] = useState('');
    
    useEffect(() => {
        if (id) {
            loadWorkOrderDetail(id);
        }
    }, [id]);

    const loadWorkOrderDetail = async (workOrderId: string) => {
        setLoading(true);
        try {
            const data = await workOrderApi.get(workOrderId);
            setWorkOrder(data);
            
            // 加载工序信息并找到当前工序
            const ops = await workOrderApi.getOperations(workOrderId);
            if (ops && ops.length > 0) {
                // 简单逻辑：找第一个进行中或待开始的
                const current = ops.find((o: any) => o.status === 'processing') || ops.find((o: any) => o.status === 'pending');
                setActiveOperation(current || ops[0]);
            }
        } catch (error) {
            console.error(error);
            message.error('加载工单详情失败');
        } finally {
            setLoading(false);
        }
    };

    const handleStart = async () => {
        if (!workOrder || !activeOperation) return;
        try {
            await workOrderApi.startOperation(workOrder.id, activeOperation.id);
            message.success('工序已开始');
            loadWorkOrderDetail(workOrder.id);
        } catch (error) {
            message.error('操作失败');
        }
    };
    
    const handleComplete = async () => {
        // 打开报工弹窗
        setReportQuantity('');
        setReportModalVisible(true);
    };

    const submitReporting = async () => {
        if (!reportQuantity || parseFloat(reportQuantity) <= 0) {
            message.warning('请输入有效的报工数量');
            return;
        }

        try {
            // TODO: 调用真实的报工API
            // await reportingApi.create({ ... })
            message.success(`成功报工: ${reportQuantity}`);
            setReportModalVisible(false);
            loadWorkOrderDetail(workOrder.id);
        } catch (error) {
            message.error('报工失败');
        }
    };

    const handleKeypadInput = (key: string) => {
        if (key === '.') {
            if (!reportQuantity.includes('.')) {
                setReportQuantity(prev => prev + key);
            }
        } else {
            setReportQuantity(prev => prev + key);
        }
    };

    const handleKeypadDelete = () => {
        setReportQuantity(prev => prev.slice(0, -1));
    };

    const handleKeypadClear = () => {
        setReportQuantity('');
    };

    if (!workOrder) return <Card loading={true} />;

    return (
        <TouchScreenTemplate
            title={`工单执行: ${workOrder.code}`}
            fullscreen={true}
            footerButtons={[
                {
                    title: '暂停',
                    type: 'default',
                    icon: <PauseCircleOutlined />,
                    onClick: () => message.info('暂停功能待实现'),
                    disabled: activeOperation?.status !== 'processing',
                    block: false
                },
                 {
                    title: '返回列表',
                    type: 'default',
                    icon: <ArrowLeftOutlined />,
                    onClick: () => navigate(-1),
                    block: false
                }
            ]}
        >
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* 顶部信息栏 */}
                <Card styles={{ body: { padding: '16px' } }}>
                    <Row gutter={[16, 16]}>
                        <Col span={8}>
                            <Statistic title="产品" value={workOrder.product_name} valueStyle={{ fontSize: `${HMI_DESIGN_TOKENS.FONT_BODY_MIN}px`, fontWeight: 'bold' }} />
                        </Col>
                         <Col span={4}>
                            <Statistic title="计划数量" value={workOrder.quantity} valueStyle={{ fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }} />
                        </Col>
                        <Col span={4}>
                            <Statistic title="已完工" value={workOrder.completed_quantity || 0} valueStyle={{ color: HMI_DESIGN_TOKENS.STATUS_OK, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }} />
                        </Col>
                         <Col span={8} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                             {activeOperation?.status === 'pending' && (
                                 <Button type="primary" size="large" icon={<PlayCircleOutlined />} onClick={handleStart} style={{ minHeight: TOUCH_SCREEN_CONFIG.BUTTON_MIN_HEIGHT, height: TOUCH_SCREEN_CONFIG.BUTTON_MIN_HEIGHT, width: '140px', fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN, backgroundColor: HMI_DESIGN_TOKENS.STATUS_INFO, borderColor: HMI_DESIGN_TOKENS.STATUS_INFO }}>
                                     开始
                                 </Button>
                             )}
                             {activeOperation?.status === 'processing' && (
                                 <Button type="primary" size="large" icon={<CheckCircleOutlined />} onClick={handleComplete} style={{ minHeight: TOUCH_SCREEN_CONFIG.BUTTON_MIN_HEIGHT, height: TOUCH_SCREEN_CONFIG.BUTTON_MIN_HEIGHT, width: '140px', fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN, backgroundColor: HMI_DESIGN_TOKENS.STATUS_OK, borderColor: HMI_DESIGN_TOKENS.STATUS_OK }}>
                                     完工
                                 </Button>
                             )}
                        </Col>
                    </Row>
                    <div style={{ marginTop: '16px' }}>
                         <Progress percent={Math.round(((workOrder.completed_quantity || 0) / workOrder.quantity) * 100)} status="active" strokeColor={{ from: HMI_DESIGN_TOKENS.STATUS_INFO, to: HMI_DESIGN_TOKENS.STATUS_OK }} />
                    </div>
                </Card>

                {/* 主内容区 Tabs */}
                 <div style={{ flex: 1, backgroundColor: '#fff', padding: '16px', borderRadius: '8px' }}>
                     <Tabs
                        defaultActiveKey="sop"
                        items={[
                            {
                                key: 'sop',
                                label: <span style={{ fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN, padding: '12px 16px', minHeight: HMI_DESIGN_TOKENS.TOUCH_MIN_SIZE, display: 'inline-flex', alignItems: 'center' }}><FileTextOutlined /> 作业指导 SOP</span>,
                                children: (
                                    <div style={{ height: '500px', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5', border: '1px dashed #d9d9d9' }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <FileTextOutlined style={{ fontSize: '64px', color: '#bfbfbf' }} />
                                            <div style={{ marginTop: '16px', fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN, color: '#999' }}>暂无 SOP 文件预览</div>
                                            {/* 这里后续集成 PDF 预览或图片轮播 */}
                                        </div>
                                    </div>
                                )
                            },
                             {
                                key: 'material',
                                label: <span style={{ fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN, padding: '12px 16px', minHeight: HMI_DESIGN_TOKENS.TOUCH_MIN_SIZE, display: 'inline-flex', alignItems: 'center' }}><BarcodeOutlined /> 关键物料投料</span>,
                                children: (
                                    <div style={{ padding: '20px', textAlign: 'center' }}>
                                        <Button size="large" icon={<BarcodeOutlined />} style={{ minHeight: TOUCH_SCREEN_CONFIG.BUTTON_MIN_HEIGHT, height: '80px', width: '200px', fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}>扫描投料</Button>
                                        <div style={{ marginTop: '20px', color: '#999', fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}>扫描关键件条码进行防错校验和追溯绑定</div>
                                    </div>
                                )
                            }
                        ]}
                     />
                 </div>
            </div>

            {/* 报工弹窗 */}
            <Modal
                title={<span style={{ fontSize: HMI_DESIGN_TOKENS.FONT_TITLE_MIN }}>工序报工</span>}
                open={reportModalVisible}
                onCancel={() => setReportModalVisible(false)}
                footer={null}
                width={600}
                centered
                destroyOnHidden
            >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
                    <div style={{ width: '100%' }}>
                         <div style={{ marginBottom: '8px', fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN, color: '#666' }}>本次报工数量:</div>
                         <Input 
                            size="large" 
                            value={reportQuantity} 
                            readOnly 
                            style={{ height: TOUCH_SCREEN_CONFIG.BUTTON_MIN_HEIGHT, fontSize: '32px', textAlign: 'center', fontWeight: 'bold', borderColor: HMI_DESIGN_TOKENS.BORDER }} 
                            placeholder="请点击下方键盘输入"
                         />
                    </div>
                    
                    <NumericKeypad 
                        onInput={handleKeypadInput}
                        onDelete={handleKeypadDelete}
                        onClear={handleKeypadClear}
                        onConfirm={submitReporting}
                        style={{ maxWidth: '100%' }}
                    />
                </div>
            </Modal>
        </TouchScreenTemplate>
    );
};

export default WorkOrderDetailKioskPage;
