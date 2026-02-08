/**
 * SOP查看 - 工位机触屏模式页面
 *
 * 专门为工控机设计的全屏触屏SOP查看界面，适合车间固定工位使用。
 * 特点：大按钮、大字体、全屏模式、触屏优化布局、步骤高亮、图片缩放。
 *
 * Author: Luigi Lu
 * Date: 2026-01-27
 */

import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Space, message, Spin, Tag, Image, Empty, Divider } from 'antd';
import { LeftOutlined, RightOutlined, ZoomInOutlined, ZoomOutOutlined, ReloadOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { TouchScreenTemplate, TOUCH_SCREEN_CONFIG } from '../../../../../components/layout-templates';
import { sopApi } from '../../../../master-data/services/process';
import { useTouchScreen } from '../../../../../hooks/useTouchScreen';
import { App } from 'antd';
import type { SOP } from '../../../../master-data/types/process';

/**
 * SOP步骤接口
 */
interface SOPStep {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  completed?: boolean;
  current?: boolean;
}

/**
 * SOP查看 - 工位机触屏模式页面
 */
const SOPViewerKioskPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const touchScreen = useTouchScreen();
  const [loading, setLoading] = useState(false);
  const [sop, setSop] = useState<SOP | null>(null);
  const [steps, setSteps] = useState<SOPStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [imageScale, setImageScale] = useState(1);
  const imageRef = useRef<HTMLImageElement>(null);

  // 从URL参数获取SOP UUID或工序ID
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sopUuid = params.get('sopUuid');
    const operationId = params.get('operationId');

    if (sopUuid) {
      loadSOPByUuid(sopUuid);
    } else if (operationId) {
      loadSOPByOperationId(parseInt(operationId));
    } else {
      messageApi.warning('请提供SOP UUID或工序ID');
    }
  }, []);

  /**
   * 根据SOP UUID加载SOP
   */
  const loadSOPByUuid = async (uuid: string) => {
    setLoading(true);
    try {
      const sopData = await sopApi.get(uuid);
      setSop(sopData);
      parseSOPSteps(sopData);
    } catch (error: any) {
      messageApi.error(error.message || '加载SOP失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 根据工序ID加载SOP
   */
  const loadSOPByOperationId = async (operationId: number) => {
    setLoading(true);
    try {
      const sops = await sopApi.list({ operationId, isActive: true });
      if (sops && sops.length > 0) {
        const sopData = sops[0];
        setSop(sopData);
        parseSOPSteps(sopData);
      } else {
        messageApi.warning('该工序未关联SOP');
      }
    } catch (error: any) {
      messageApi.error(error.message || '加载SOP失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 解析SOP步骤
   */
  const parseSOPSteps = (sopData: SOP) => {
    const parsedSteps: SOPStep[] = [];

    // 如果SOP有flowConfig，从flowConfig中解析步骤
    if (sopData.flowConfig && sopData.flowConfig.nodes) {
      const nodes = sopData.flowConfig.nodes;
      nodes.forEach((node: any, index: number) => {
        parsedSteps.push({
          id: node.id || `step-${index}`,
          title: node.label || node.title || `步骤 ${index + 1}`,
          description: node.description || node.data?.description,
          imageUrl: node.data?.imageUrl || node.imageUrl,
          completed: false,
          current: index === 0, // 默认第一个步骤为当前步骤
        });
      });
    } else if (sopData.content) {
      // 如果SOP有content，尝试解析JSON格式的内容
      try {
        const content = typeof sopData.content === 'string' ? JSON.parse(sopData.content) : sopData.content;
        if (Array.isArray(content)) {
          content.forEach((step: any, index: number) => {
            parsedSteps.push({
              id: step.id || `step-${index}`,
              title: step.title || `步骤 ${index + 1}`,
              description: step.description,
              imageUrl: step.imageUrl || step.image,
              completed: step.completed || false,
              current: index === 0,
            });
          });
        }
      } catch (e) {
        // 如果解析失败，将content作为单个步骤
        parsedSteps.push({
          id: 'step-1',
          title: 'SOP内容',
          description: typeof sopData.content === 'string' ? sopData.content : JSON.stringify(sopData.content),
          completed: false,
          current: true,
        });
      }
    } else {
      // 如果没有步骤数据，显示空状态
      messageApi.warning('SOP没有步骤数据');
    }

    setSteps(parsedSteps);
    setCurrentStepIndex(0);
  };

  /**
   * 处理上一步
   */
  const handlePreviousStep = () => {
    if (currentStepIndex > 0) {
      const newIndex = currentStepIndex - 1;
      setCurrentStepIndex(newIndex);
      updateStepStatus(newIndex);
      setImageScale(1); // 重置图片缩放
    }
  };

  /**
   * 处理下一步
   */
  const handleNextStep = () => {
    if (currentStepIndex < steps.length - 1) {
      const newIndex = currentStepIndex + 1;
      setCurrentStepIndex(newIndex);
      updateStepStatus(newIndex);
      setImageScale(1); // 重置图片缩放
    }
  };

  /**
   * 更新步骤状态
   */
  const updateStepStatus = (stepIndex: number) => {
    const updatedSteps = steps.map((step, index) => ({
      ...step,
      current: index === stepIndex,
      completed: index < stepIndex,
    }));
    setSteps(updatedSteps);
  };

  /**
   * 处理步骤点击
   */
  const handleStepClick = (index: number) => {
    setCurrentStepIndex(index);
    updateStepStatus(index);
    setImageScale(1); // 重置图片缩放
  };

  /**
   * 处理图片缩放
   */
  const handleImageZoom = (delta: number) => {
    const newScale = Math.max(0.5, Math.min(3, imageScale + delta));
    setImageScale(newScale);
  };

  /**
   * 处理图片双击缩放
   */
  const handleImageDoubleClick = () => {
    if (imageScale === 1) {
      setImageScale(2);
    } else {
      setImageScale(1);
    }
  };

  /**
   * 当前步骤
   */
  const currentStep = steps[currentStepIndex];

  return (
    <TouchScreenTemplate
      title={sop ? `SOP: ${sop.name}` : 'SOP查看'}
      fullscreen={true}
      footerButtons={[
        {
          title: '上一步',
          type: 'default',
          icon: <LeftOutlined />,
          onClick: handlePreviousStep,
          disabled: currentStepIndex === 0,
          block: false,
        },
        {
          title: '下一步',
          type: 'primary',
          icon: <RightOutlined />,
          onClick: handleNextStep,
          disabled: currentStepIndex >= steps.length - 1,
          block: false,
        },
      ]}
    >
      <Spin spinning={loading}>
        {!sop ? (
          <Empty description="未找到SOP数据" />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* SOP基本信息 */}
            <Card size="small" style={{ marginBottom: 24, backgroundColor: '#f5f5f5' }}>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <div>
                  <strong>SOP编码：</strong>
                  <span>{sop.code}</span>
                </div>
                <div>
                  <strong>SOP名称：</strong>
                  <span>{sop.name}</span>
                </div>
                {sop.version && (
                  <div>
                    <strong>版本：</strong>
                    <span>{sop.version}</span>
                  </div>
                )}
              </Space>
            </Card>

            {/* 步骤列表（横向滚动） */}
            {steps.length > 0 && (
              <Card title="步骤列表" style={{ marginBottom: 24 }}>
                <div
                  style={{
                    display: 'flex',
                    overflowX: 'auto',
                    gap: 16,
                    padding: '8px 0',
                    WebkitOverflowScrolling: 'touch',
                  }}
                >
                  {steps.map((step, index) => (
                    <Button
                      key={step.id}
                      type={step.current ? 'primary' : step.completed ? 'default' : 'dashed'}
                      size="large"
                      onClick={() => handleStepClick(index)}
                      style={{
                        minWidth: 120,
                        height: 60,
                        fontSize: 20,
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                      }}
                    >
                      {step.completed && <CheckCircleOutlined />}
                      {step.current && !step.completed && <ClockCircleOutlined />}
                      <span>{step.title}</span>
                    </Button>
                  ))}
                </div>
              </Card>
            )}

            {/* 当前步骤内容 */}
            {currentStep && (
              <Card
                title={
                  <Space>
                    <span>步骤 {currentStepIndex + 1} / {steps.length}</span>
                    <Tag color={currentStep.completed ? 'success' : currentStep.current ? 'processing' : 'default'}>
                      {currentStep.completed ? '已完成' : currentStep.current ? '进行中' : '未开始'}
                    </Tag>
                  </Space>
                }
                style={{ flex: 1, display: 'flex', flexDirection: 'column', marginBottom: 24 }}
                styles={{ body: { flex: 1, overflow: 'auto' } }}
              >
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  {/* 步骤标题 */}
                  <div style={{ fontSize: 32, fontWeight: 600, textAlign: 'center' }}>
                    {currentStep.title}
                  </div>

                  {/* 步骤描述 */}
                  {currentStep.description && (
                    <div style={{ fontSize: 24, lineHeight: 1.8, padding: '16px', backgroundColor: '#fafafa', borderRadius: 8 }}>
                      {currentStep.description}
                    </div>
                  )}

                  {/* 步骤图片 */}
                  {currentStep.imageUrl && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 16,
                        padding: '16px',
                        backgroundColor: '#fafafa',
                        borderRadius: 8,
                      }}
                    >
                      <div style={{ position: 'relative', width: '100%', overflow: 'auto', maxHeight: '60vh' }}>
                        <img
                          ref={imageRef}
                          src={currentStep.imageUrl}
                          alt={currentStep.title}
                          style={{
                            width: '100%',
                            height: 'auto',
                            transform: `scale(${imageScale})`,
                            transformOrigin: 'center center',
                            transition: 'transform 0.3s ease',
                            cursor: 'pointer',
                            userSelect: 'none',
                          }}
                          onDoubleClick={handleImageDoubleClick}
                          draggable={false}
                        />
                      </div>

                      {/* 图片缩放控制 */}
                      <Space>
                        <Button
                          size="large"
                          icon={<ZoomOutOutlined />}
                          onClick={() => handleImageZoom(-0.2)}
                          disabled={imageScale <= 0.5}
                          style={{ height: 60, fontSize: 24 }}
                        >
                          缩小
                        </Button>
                        <Button
                          size="large"
                          onClick={() => setImageScale(1)}
                          style={{ height: 60, fontSize: 24 }}
                        >
                          重置 ({Math.round(imageScale * 100)}%)
                        </Button>
                        <Button
                          size="large"
                          icon={<ZoomInOutlined />}
                          onClick={() => handleImageZoom(0.2)}
                          disabled={imageScale >= 3}
                          style={{ height: 60, fontSize: 24 }}
                        >
                          放大
                        </Button>
                      </Space>
                    </div>
                  )}

                  {/* 如果没有图片和描述，显示提示 */}
                  {!currentStep.description && !currentStep.imageUrl && (
                    <Empty description="该步骤暂无内容" />
                  )}
                </Space>
              </Card>
            )}

            {/* 如果没有步骤，显示空状态 */}
            {steps.length === 0 && (
              <Empty description="SOP没有步骤数据" />
            )}
          </div>
        )}
      </Spin>
    </TouchScreenTemplate>
  );
};

export default SOPViewerKioskPage;
