/**
 * 智能建议悬浮面板
 *
 * 在 Modal 外部悬浮显示智能建议或提示，以对话形式展示，
 * 每条建议/提示独立成气泡，参考主流 AI 对话框设计。
 *
 * @author RiverEdge
 */

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Card, Button } from 'antd';
import Lottie from 'lottie-react';
import robotAnimation from '../../../static/lottie/robot.json';
import { useLineReveal } from '../../hooks/useLineReveal';
import './index.less';

export interface SuggestionData {
  suggested_type: string;
  confidence: number;
  reasons: string[];
}

/** 支持建议或提示的通用消息格式 */
export interface MessageItem {
  type?: 'suggestion' | 'tip' | 'reason';
  text: string;
  /** 该条消息的标题，显示在气泡上方 */
  title?: string;
}

/** 验证结果 */
export interface ValidationResultData {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
}

/** 完整性检查结果 */
export interface CompletenessResultData {
  is_complete: boolean;
  missing_configs: string[];
  warnings: string[];
}

export interface SmartSuggestionFloatPanelProps {
  visible: boolean;
  loading?: boolean;
  /** 建议数据（物料来源等场景） */
  suggestion: SuggestionData | null;
  /** 验证结果 */
  validationResult?: ValidationResultData | null;
  /** 完整性检查结果 */
  completenessResult?: CompletenessResultData | null;
  /** 直接传入消息列表（提示等场景），与 suggestion 二选一 */
  messages?: MessageItem[];
  sourceTypeOptions?: Array<{ label: string; value: string }>;
  onApply?: () => void;
  /** 重新验证回调 */
  onRevalidate?: () => void;
  /** 是否正在验证 */
  loadingValidation?: boolean;
  lottieData?: object;
  /** 每条消息出现的间隔（毫秒），默认 100ms */
  lineRevealInterval?: number;
  /** 用于定位的锚点选择器（如 .modal-class），面板将与锚点元素顶端对齐并置于其左侧 */
  anchorSelector?: string;
  /** @deprecated 已移除全局标题，每个对话框单独标题 */
  title?: string;
}

const GAP_FROM_ANCHOR = 16;

const SmartSuggestionFloatPanel: React.FC<SmartSuggestionFloatPanelProps> = ({
  visible,
  loading = false,
  suggestion,
  validationResult,
  completenessResult,
  messages: messagesProp,
  sourceTypeOptions = [],
  onApply,
  onRevalidate,
  loadingValidation = false,
  lottieData,
  lineRevealInterval = 100,
  anchorSelector,
}) => {
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);

  // #region agent log
  const prevVisibleRef = React.useRef<boolean | null>(null);
  const prevPositionReadyRef = React.useRef<boolean | null>(null);
  useEffect(() => {
    const isPositionReady = !anchorSelector || !!position;
    const visibleChanged = prevVisibleRef.current !== null && prevVisibleRef.current !== visible;
    const positionReadyChanged =
      prevPositionReadyRef.current !== null && prevPositionReadyRef.current !== isPositionReady;
    prevVisibleRef.current = visible;
    prevPositionReadyRef.current = isPositionReady;
    if (visible) {
      fetch('http://127.0.0.1:7242/ingest/14723169-35ed-4ca8-9cad-d93c6c16c078', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'SmartSuggestionFloatPanel:render',
          message: 'visible / positionReady / position',
          data: {
            visible,
            visibleChanged,
            isPositionReady,
            positionReadyChanged,
            hasPosition: !!position,
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          hypothesisId: 'A,B,D',
        }),
      }).catch(() => {});
    }
  });
  // #endregion

  const updatePosition = useCallback(() => {
    if (!anchorSelector) return;
    const anchor = document.querySelector(anchorSelector);
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    setPosition({
      top: rect.top,
      right: window.innerWidth - rect.left + GAP_FROM_ANCHOR,
    });
  }, [anchorSelector]);

  useEffect(() => {
    if (!visible || !anchorSelector) {
      setPosition(null);
      return;
    }

    const runUpdate = () => {
      const anchor = document.querySelector(anchorSelector);
      if (anchor) updatePosition();
    };

    runUpdate();

    const retryTimers = [50, 150, 300].map((ms) => setTimeout(runUpdate, ms));

    const pollUntilFound = () => {
      const anchor = document.querySelector(anchorSelector);
      if (anchor) {
        const resizeObserver = new ResizeObserver(runUpdate);
        resizeObserver.observe(anchor);
        window.addEventListener('resize', runUpdate);
        return () => {
          resizeObserver.disconnect();
          window.removeEventListener('resize', runUpdate);
        };
      }
      return null;
    };

    let cleanup: (() => void) | null = null;
    const setupTimer = setTimeout(() => {
      cleanup = pollUntilFound();
    }, 350);

    return () => {
      retryTimers.forEach(clearTimeout);
      clearTimeout(setupTimer);
      cleanup?.();
    };
  }, [visible, anchorSelector, updatePosition]);
  /** 每条为一份完整建议/提示/验证，对应一个对话框气泡；title 为该条标题，action 为该条下方的操作按钮 */
  const displayBlocks = useMemo(
    (): Array<{ content: string; title: string; action?: 'apply' | 'revalidate' }> => {
      const blocks: Array<{ content: string; title: string; action?: 'apply' | 'revalidate' }> = [];

      if (messagesProp?.length) {
        return messagesProp.map((m) => ({
          content: m.text,
          title: m.title ?? '配置说明',
        }));
      }

      if (suggestion?.suggested_type) {
        const typeLabel =
          sourceTypeOptions.find((opt) => opt.value === suggestion.suggested_type)?.label || suggestion.suggested_type;
        const confidencePercent = (suggestion.confidence * 100).toFixed(0);
        const mainText = `建议：${typeLabel}，置信度 ${confidencePercent}%`;
        const reasons = suggestion.reasons || [];
        const reasonsText =
          reasons.length > 0 ? `\n\n建议原因：\n${reasons.map((r, i) => `${i + 1}. ${r}`).join('\n')}` : '';
        blocks.push({ content: mainText + reasonsText, title: '来源建议', action: 'apply' });
      }

      if (validationResult) {
        const status = validationResult.is_valid ? '验证通过' : '验证失败';
        const parts: string[] = [status];
        if (validationResult.errors.length > 0) {
          parts.push(`\n错误：\n${validationResult.errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}`);
        }
        if (validationResult.warnings.length > 0) {
          parts.push(`\n警告：\n${validationResult.warnings.map((w, i) => `${i + 1}. ${w}`).join('\n')}`);
        }
        blocks.push({ content: parts.join(''), title: '验证结果', action: 'revalidate' });
      }

      if (completenessResult && !completenessResult.is_complete) {
        const parts: string[] = ['配置不完整'];
        if (completenessResult.missing_configs.length > 0) {
          parts.push(`\n缺失配置：\n${completenessResult.missing_configs.map((c, i) => `${i + 1}. ${c}`).join('\n')}`);
        }
        if (completenessResult.warnings.length > 0) {
          parts.push(`\n建议：\n${completenessResult.warnings.map((w, i) => `${i + 1}. ${w}`).join('\n')}`);
        }
        blocks.push({ content: parts.join(''), title: '配置完整性' });
      }

      return blocks;
    },
    [messagesProp, suggestion, sourceTypeOptions, validationResult, completenessResult]
  );

  // 将每个气泡内容按段（\n 分割）展开为扁平列表，实现文字逐段展示
  const flatSegments = useMemo(() => {
    const segments: Array<{ blockIndex: number; text: string }> = [];
    displayBlocks.forEach((block, i) => {
      block.content.split('\n').forEach((line) => {
        segments.push({ blockIndex: i, text: line });
      });
    });
    return segments;
  }, [displayBlocks]);

  const flatTexts = flatSegments.map((s) => s.text);
  const contentReady = visible && flatTexts.length > 0 && !loading && !loadingValidation;
  const { visibleLines: visibleSegments } = useLineReveal(
    flatTexts,
    lineRevealInterval,
    contentReady
  );

  // #region agent log
  const prevContentReadyRef = React.useRef<boolean | null>(null);
  const prevDisplayBlocksCountRef = React.useRef<number | null>(null);
  useEffect(() => {
    const contentReadyChanged = prevContentReadyRef.current !== contentReady;
    const displayBlocksChanged = prevDisplayBlocksCountRef.current !== displayBlocks.length;
    prevContentReadyRef.current = contentReady;
    prevDisplayBlocksCountRef.current = displayBlocks.length;
    if (visible && displayBlocks.length > 0) {
      fetch('http://127.0.0.1:7242/ingest/14723169-35ed-4ca8-9cad-d93c6c16c078', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'SmartSuggestionFloatPanel:contentReady',
          message: 'contentReady / displayBlocks / useLineReveal',
          data: {
            contentReady,
            contentReadyChanged,
            displayBlocksCount: displayBlocks.length,
            displayBlocksChanged,
            flatSegmentsCount: flatTexts.length,
            visibleSegmentsCount: visibleSegments.length,
            loading,
            loadingValidation,
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          hypothesisId: 'C,E',
        }),
      }).catch(() => {});
    }
  });
  // #endregion

  // 根据已展示的段落，按块分组回显内容
  const visibleBlockContents = useMemo(() => {
    const blockMap: Record<number, string[]> = {};
    const visibleCount = visibleSegments.length;
    for (let i = 0; i < visibleCount && i < flatSegments.length; i++) {
      const seg = flatSegments[i];
      if (!blockMap[seg.blockIndex]) blockMap[seg.blockIndex] = [];
      blockMap[seg.blockIndex].push(visibleSegments[i]);
    }
    return displayBlocks.map((_, i) =>
      (blockMap[i] || []).join('\n')
    );
  }, [visibleSegments, flatSegments, displayBlocks.length]);

  const animationData = lottieData ?? robotAnimation;

  if (!visible) {
    return null;
  }

  const isPositionReady = !anchorSelector || !!position;
  const inlineStyle: React.CSSProperties =
    anchorSelector && position ? { top: position.top, right: position.right } : {};

  return (
    <div
      className={`smart-suggestion-float-panel ${isPositionReady ? 'smart-suggestion-float-panel--ready' : ''}`}
      style={inlineStyle}
    >
      <Card className="smart-suggestion-float-panel__card" variant="borderless">
        <div className="smart-suggestion-float-panel__body">
          <div className="smart-suggestion-float-panel__robot">
            <Lottie animationData={animationData} loop={true} style={{ width: 64, height: 64 }} />
          </div>
          <div className="smart-suggestion-float-panel__conversation">
            {displayBlocks.map(
              (block, index) =>
                visibleBlockContents[index] !== undefined &&
                visibleBlockContents[index].length > 0 && (
                  <div
                    key={index}
                    className={`smart-suggestion-float-panel__block ${
                      index > 0 ? 'smart-suggestion-float-panel__block--subsequent' : ''
                    }`}
                  >
                    <div className="smart-suggestion-float-panel__block-title">{block.title}</div>
                    <div className="smart-suggestion-float-panel__bubble">
                      {visibleBlockContents[index]}
                    </div>
                {block.action === 'apply' && onApply && (
                  <div className="smart-suggestion-float-panel__block-actions">
                    <Button type="primary" size="small" onClick={onApply}>
                      应用建议
                    </Button>
                  </div>
                )}
                {block.action === 'revalidate' && onRevalidate && (
                  <div className="smart-suggestion-float-panel__block-actions">
                    <Button size="small" loading={loadingValidation} onClick={onRevalidate}>
                      重新验证
                    </Button>
                  </div>
                )}
                  </div>
                )
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default SmartSuggestionFloatPanel;
