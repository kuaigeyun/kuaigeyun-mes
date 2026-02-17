/**
 * 打印模板设计器 - Univer 文档编辑器 (深度仿真激活版)
 * 解决“必须先点快捷键按钮”的布局陷阱。
 */
import React, { useLayoutEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import {
  UniverInstanceType,
  LocaleType,
  merge,
} from '@univerjs/core';

import { createUniver, defaultTheme } from '@univerjs/presets';
import { UniverDocsCorePreset } from '@univerjs/presets/preset-docs-core';
import { UniverDocsDrawingPreset } from '@univerjs/presets/preset-docs-drawing';

// 样式全家桶：确保布局高度计算有依据
import '@univerjs/design/lib/index.css';
import '@univerjs/ui/lib/index.css';
import '@univerjs/docs-ui/lib/index.css';
import '@univerjs/presets/lib/styles/preset-docs-core.css';
import '@univerjs/presets/lib/styles/preset-docs-drawing.css';

import UniverPresetDocsCoreZhCN from '@univerjs/presets/preset-docs-core/locales/zh-CN';
import i18n from '../../config/i18n';
import { EMPTY_UNIVER_DOC } from './constants';

const UNIT_ID = 'DOC_ULTIMATE_V3';

const UniverDocEditor = forwardRef<any, { initialData?: any }>(({ initialData }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const univerInstanceRef = useRef<{ univer: any; univerAPI: any } | null>(null);

  useImperativeHandle(ref, () => ({
    getData: () => univerInstanceRef.current?.univerAPI.getActiveDocument()?.getSnapshot(),
    insertText: (text: string) => univerInstanceRef.current?.univerAPI.getActiveDocument()?.insertText(text, { startOffset: 0, endOffset: 0 })
  }));

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    
    // 强制给容器一个明确的 ID
    const uniqueId = `univer-doc-shell-${Date.now()}`;
    container.id = uniqueId;

    const init = async () => {
      if (univerInstanceRef.current) return;
      
      try {
        const lang = i18n?.language || 'zh-CN';
        const univerLocale = lang.startsWith('zh') ? LocaleType.ZH_CN : LocaleType.EN_US;

        const { univer, univerAPI } = createUniver({
          locale: univerLocale,
          locales: { [LocaleType.ZH_CN]: merge({}, UniverPresetDocsCoreZhCN) },
          theme: defaultTheme,
          presets: [
            UniverDocsCorePreset({
              container: uniqueId,
              header: true,
              footer: true,
            }),
            UniverDocsDrawingPreset()
          ],
        });

        const docData = initialData?.body?.dataStream
            ? { ...JSON.parse(JSON.stringify(initialData)), id: UNIT_ID }
            : { ...JSON.parse(JSON.stringify(EMPTY_UNIVER_DOC)), id: UNIT_ID };

        // 注入强制页面模式渲染配置
        docData.documentStyle = merge({}, docData.documentStyle || {}, {
            pageSize: { width: 595.27, height: 841.89 },
            marginTop: 50, marginBottom: 50, marginLeft: 90, marginRight: 90,
            renderConfig: { 
                isPageMode: true,
                pageMode: 1 // 备份属性，部分版本使用该值
            }
        });

        univer.createUnit(UniverInstanceType.UNIVER_DOC, docData);
        univerInstanceRef.current = { univer, univerAPI };

        // --- 核心：仿真激活序列 ---
        const wakeup = () => {
          try {
            console.log('[Univer] Triggering deep wakeup...');
            
            // 1. 通过 DOM 寻找“快捷键”按钮并真实点击它
            // 理由：内部 Command 可能失效，但 DOM 点击会强制触发 UI 状态机的 resize 循环
            const toolbarButtons = container.querySelectorAll('.univer-toolbar-item, button');
            const keyboardBtn = Array.from(toolbarButtons).find(btn => 
                btn.getAttribute('title')?.includes('快捷键') || 
                btn.querySelector('[class*="keyboard"]') ||
                btn.innerHTML.includes('keyboard')
            ) as HTMLElement;

            if (keyboardBtn) {
                console.log('[Univer] Keyboard button found, simulating click...');
                keyboardBtn.click(); // 打开
                setTimeout(() => keyboardBtn.click(), 500); // 500ms 后关闭
            }

            // 2. 强制触发全局 Resize 激活 Canvas 布局
            window.dispatchEvent(new Event('resize'));
            
            // 3. 设置活跃并聚焦
            univerAPI.focus();
            
            // 4. 重绘标志位
            const canvas = container.querySelector('canvas');
            if (canvas) {
                canvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                canvas.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            }
          } catch(e) {
            console.warn('[Univer] Wakeup step failed', e);
          }
        };

        // 进行两轮激活：一轮在 1.5s (基础加载完)，一轮在 3s (确保所有抽屉就绪)
        setTimeout(wakeup, 1500);
        setTimeout(wakeup, 3000);

      } catch (err) {
        console.error('[Univer] Init failed', err);
      }
    };

    const timer = setTimeout(init, 300);
    return () => {
      clearTimeout(timer);
      if (univerInstanceRef.current) {
        univerInstanceRef.current.univer.dispose();
        univerInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div className="univer-ultimate-v3" style={{ 
      width: '100%', 
      height: 'calc(100vh - 120px)', 
      display: 'flex', 
      flexDirection: 'column',
      position: 'relative',
      background: '#f0f2f5' 
    }}>
      <style>{`
        /* 仿真 3D 纸张视觉 */
        .univer-ultimate-v3 .univer-render-canvas-container {
            background-color: #f0f2f5 !important;
            padding: 24px 0 !important;
            display: flex !important;
            justify-content: center !important;
            min-height: 100% !important;
        }
        
        .univer-ultimate-v3 .univer-render-canvas-main {
            background-color: #ffffff !important;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1) !important;
            filter: drop-shadow(0 0 12px rgba(0,0,0,0.05)) !important;
            margin: 0 auto !important;
        }

        /* 状态条样式：淡入淡出 */
        .univer-boot-status {
            position: absolute;
            top: 40px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 999;
            background: rgba(24, 144, 255, 0.85);
            color: white;
            padding: 4px 16px;
            border-radius: 20px;
            font-size: 12px;
            pointer-events: none;
            animation: fadeOut 5s forwards;
        }
        @keyframes fadeOut { 0% { opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; } }

        /* 强制标尺显示补丁 */
        .univer-ultimate-v3 [class*="ruler"] {
            display: block !important;
            visibility: visible !important;
            z-index: 10 !important;
        }
      `}</style>
      
      <div className="univer-boot-status">AI-Engine: Activating Workspace...</div>

      <div 
        ref={containerRef} 
        style={{ flex: 1, position: 'relative', width: '100%', height: '100%' }} 
      />
    </div>
  );
});

export default UniverDocEditor;
