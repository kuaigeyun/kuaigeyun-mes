import React, { useEffect, useRef } from 'react';
import "@univerjs/design/lib/index.css";
import "@univerjs/ui/lib/index.css";
import "@univerjs/docs-ui/lib/index.css";

import { Univer, LocaleType, ICommandService, UniverInstanceType } from "@univerjs/core";
import { defaultTheme } from "@univerjs/design";
import zhCN from "@univerjs/design/lib/locale/zh-CN";
import { UniverDocsPlugin, SetTextSelectionsOperation } from "@univerjs/docs";
import { UniverDocsUIPlugin, IMEInputCommand } from "@univerjs/docs-ui";
import { UniverRenderEnginePlugin } from "@univerjs/engine-render";
import { UniverUIPlugin } from "@univerjs/ui";
import { UniverFormulaEnginePlugin } from "@univerjs/engine-formula";

interface UniverDocPreviewProps {
  data: any;
  variables?: Record<string, any>;
}

const UniverDocPreview: React.FC<UniverDocPreviewProps> = ({ data, variables }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const univerRef = useRef<Univer | null>(null);

  useEffect(() => {
    if (!containerRef.current || !data) return;

    // Initialize Univer
    const univer = new Univer({
      theme: defaultTheme,
      locale: LocaleType.ZH_CN,
      locales: {
        [LocaleType.ZH_CN]: zhCN,
      },
    });

    univerRef.current = univer;

    // Register plugins
    univer.registerPlugin(UniverRenderEnginePlugin);
    univer.registerPlugin(UniverFormulaEnginePlugin);
    // UI plugin with minimal configuration for read-only preview
    univer.registerPlugin(UniverUIPlugin, {
      container: containerRef.current,
      header: false,
      footer: false,
      toolbar: false, // Hide toolbar for preview
    });
    univer.registerPlugin(UniverDocsPlugin, {
      hasScroll: true, // Allow scrolling if content is long
    });
    univer.registerPlugin(UniverDocsUIPlugin);
    // 预览模式不注册 Drawing 插件，与 editor 保持一致

    // Initial load
    const unitId = 'doc-preview-' + Date.now();
    const docData = JSON.parse(JSON.stringify(data));
    // Ensure unitId matches
    docData.id = unitId;

    const doc = univer.createUnit(UniverInstanceType.UNIVER_DOC, docData);

    // Perform Variable Substitution using Command API
    // Replace from end to start (sequential await) to avoid index shifting and race conditions
    if (variables) {
      const runSubstitution = async () => {
        try {
          const univerAny = univer as any;
          const injector = univerAny.getInjector ? univerAny.getInjector() : univerAny.__getInjector();
          const commandService = injector.get(ICommandService);
          const snapshot = doc.getSnapshot();
          const body = snapshot.body;
          if (!body || !body.dataStream) return;

          const dataStream = body.dataStream;
          const matches: { start: number; end: number; key: string }[] = [];

          // Regex to find {{key}}
          const regex = /\{\{([^}]+)\}\}/g;
          let match;
          while ((match = regex.exec(dataStream)) !== null) {
            matches.push({
              start: match.index,
              end: match.index + match[0].length,
              key: match[1].trim(),
            });
          }

          // Replace from end to start to avoid index shifting; must await sequentially
          const reversed = [...matches].reverse();
          for (const m of reversed) {
            const value = resolveValue(m.key, variables);
            const strValue =
              value != null && typeof value === 'object' && !(value instanceof Date)
                ? JSON.stringify(value)
                : String(value ?? '');

            await commandService.executeCommand(SetTextSelectionsOperation.id, {
              unitId,
              ranges: [{ startOffset: m.start, endOffset: m.end }],
            });

            await commandService.executeCommand(IMEInputCommand.id, {
              unitId,
              newText: strValue,
              oldTextLen: m.end - m.start,
              isCompositionStart: false,
              isCompositionEnd: true,
            });
          }
        } catch (e) {
          console.error("Preview data injection failed:", e);
        }
      };

      setTimeout(runSubstitution, 100); // Small delay to ensure doc is ready
    }

    return () => {
      univer.dispose();
      univerRef.current = null;
    };
  }, [data, variables]);

  const resolveValue = (key: string, vars: Record<string, unknown>): unknown => {
    const keys = key.split('.');
    let val: unknown = vars;
    for (const k of keys) {
      if (val === undefined || val === null) return '';
      if (typeof val === 'object' && !Array.isArray(val) && k in (val as object)) {
        val = (val as Record<string, unknown>)[k];
      } else if (Array.isArray(val) && /^\d+$/.test(k)) {
        val = val[parseInt(k, 10)];
      } else {
        return '';
      }
    }
    return val;
  };

  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: '100%', 
        height: '100%', 
        overflow: 'hidden' 
      }} 
    />
  );
};

export default UniverDocPreview;
