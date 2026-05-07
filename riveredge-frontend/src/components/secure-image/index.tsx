/**
 * SecureImage 组件
 *
 * 用于显示需要鉴权的文件图片。通过 getFilePreview 获取带 token 的 URL，
 * 解决生产环境中 img 标签无法携带 Authorization 头导致的图片无法显示问题。
 */

import React, { useEffect, useState, useRef } from 'react';
import { Image, Skeleton } from 'antd';
import { getFileDownloadUrlWithToken } from '../../services/file';

export interface SecureImageProps {
  /** 文件 UUID 或 直接图片 URL */
  fileUuid?: string;
  /** 直接图片 URL (可选，如果提供则跳过鉴权请求) */
  src?: string;
  /** 图片 alt 文本 */
  alt?: string;
  /** 宽度 */
  width?: number | string;
  /** 高度 */
  height?: number | string;
  /** 样式 */
  style?: React.CSSProperties;
  /** 是否用于头像（请求缩略图） */
  forAvatar?: boolean;
  /** 预览配置 */
  preview?: boolean | { src?: string };
  /** 加载失败回调 */
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  /** 加载完成回调 */
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
}

/**
 * 带鉴权的图片组件 - 优化加载性能
 */
export const SecureImage: React.FC<SecureImageProps> = ({
  fileUuid,
  src: initialSrc,
  alt = '',
  width,
  height,
  style,
  forAvatar = false,
  preview = true,
  onError,
  onLoad,
}) => {
  const emitDebugLog = React.useCallback((payload: Record<string, unknown>) => {
    // #region agent log
    fetch('http://127.0.0.1:7807/ingest/b117966e-dad0-4d01-bd6a-e3ba9296abb4',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4d2004'},body:JSON.stringify(payload)}).catch(()=>{});
    // #endregion
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        navigator.sendBeacon(
          'http://127.0.0.1:7807/ingest/b117966e-dad0-4d01-bd6a-e3ba9296abb4',
          JSON.stringify(payload),
        );
      }
    } catch {
      // no-op
    }
  }, []);

  const emitUiProbe = React.useCallback((tag: string, data: Record<string, unknown>) => {
    if (typeof document === 'undefined') return;
    const probeId = 'secure-image-debug-probe';
    const probeLogId = 'secure-image-debug-probe-log';
    const text = `${tag} | cls=${document.body.className || '-'} | pe=${document.body.style.pointerEvents || '-'} | ov=${document.body.style.overflow || '-'} | hit=${String((data as any).hit || '-')}`;
    let node = document.getElementById(probeId);
    if (!node) {
      node = document.createElement('div');
      node.id = probeId;
      node.style.position = 'fixed';
      node.style.right = '8px';
      node.style.top = '8px';
      node.style.zIndex = '2147483647';
      node.style.fontSize = '12px';
      node.style.lineHeight = '16px';
      node.style.padding = '6px 8px';
      node.style.borderRadius = '4px';
      node.style.background = 'rgba(0,0,0,0.72)';
      node.style.color = '#fff';
      node.style.pointerEvents = 'none';
      node.style.maxWidth = '48vw';
      node.style.whiteSpace = 'nowrap';
      node.style.overflow = 'hidden';
      node.style.textOverflow = 'ellipsis';
      document.body.appendChild(node);
    }
    node.textContent = text;

    let logNode = document.getElementById(probeLogId);
    if (!logNode) {
      logNode = document.createElement('div');
      logNode.id = probeLogId;
      logNode.style.position = 'fixed';
      logNode.style.right = '8px';
      logNode.style.top = '36px';
      logNode.style.zIndex = '2147483647';
      logNode.style.fontSize = '11px';
      logNode.style.lineHeight = '14px';
      logNode.style.padding = '6px 8px';
      logNode.style.borderRadius = '4px';
      logNode.style.background = 'rgba(0,0,0,0.72)';
      logNode.style.color = '#fff';
      logNode.style.pointerEvents = 'none';
      logNode.style.maxWidth = '62vw';
      logNode.style.whiteSpace = 'pre';
      document.body.appendChild(logNode);
    }
    const prev = (logNode.textContent || '').split('\n').filter(Boolean);
    const next = [...prev.slice(-5), text];
    logNode.textContent = next.join('\n');
    // #region agent log
    emitDebugLog({sessionId:'4d2004',runId:'run3',hypothesisId:'H8',location:'secure-image/index.tsx:ui-probe',message:'UI probe update',data:{tag, ...data, bodyClass: document.body.className || '', bodyPointerEvents: document.body.style.pointerEvents || '', bodyOverflow: document.body.style.overflow || ''},timestamp:Date.now()});
    // #endregion
  }, [emitDebugLog]);

  const sampleOverlayState = React.useCallback((tag: string) => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const x = Math.floor(window.innerWidth / 2);
    const y = Math.floor(window.innerHeight / 2);
    const hit = document.elementFromPoint(x, y) as HTMLElement | null;
    const hitDesc = hit
      ? `${hit.tagName.toLowerCase()}#${hit.id || '-'}.${
          typeof hit.className === 'string' ? hit.className.split(' ').filter(Boolean).slice(0, 2).join('.') || '-' : '-'
        }`
      : 'null';
    const previewMaskCount = document.querySelectorAll('.ant-image-preview-mask').length;
    const previewRootCount = document.querySelectorAll('.ant-image-preview-root').length;
    const modalWrapCount = document.querySelectorAll('.ant-image-preview-wrap').length;
    emitUiProbe(tag, { hit: hitDesc, previewMaskCount, previewRootCount, modalWrapCount });
  }, [emitUiProbe]);

  const cleanupStalePreviewRoots = React.useCallback((reason: string) => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const hit = document.elementFromPoint(
      Math.floor(window.innerWidth / 2),
      Math.floor(window.innerHeight / 2),
    ) as HTMLElement | null;
    const hitClass = typeof hit?.className === 'string' ? hit.className : '';
    const stillBlockedByPreviewMask = hitClass.includes('ant-image-preview-mask');
    if (!stillBlockedByPreviewMask) return;

    const roots = Array.from(document.querySelectorAll('.ant-image-preview-root'));
    const wraps = Array.from(document.querySelectorAll('.ant-image-preview-wrap'));
    const masks = Array.from(document.querySelectorAll('.ant-image-preview-mask'));
    const containers = Array.from(document.querySelectorAll('.ant-image-preview'));
    const fuzzyNodes = Array.from(
      document.querySelectorAll("[class*='ant-image-preview']")
    ).filter((n) => n instanceof HTMLElement);

    const before = {
      roots: roots.length,
      wraps: wraps.length,
      masks: masks.length,
      containers: containers.length,
      fuzzy: fuzzyNodes.length,
    };

    roots.forEach((node) => node.parentNode?.removeChild(node));
    wraps.forEach((node) => node.parentNode?.removeChild(node));
    masks.forEach((node) => node.parentNode?.removeChild(node));
    containers.forEach((node) => node.parentNode?.removeChild(node));

    // 如果命中节点本身仍是 ant-image-preview 相关节点，沿祖先链精确清除
    if (hit) {
      let cur: HTMLElement | null = hit;
      let guard = 0;
      while (cur && cur !== document.body && guard < 8) {
        const cls = typeof cur.className === 'string' ? cur.className : '';
        if (cls.includes('ant-image-preview')) {
          const parent = cur.parentNode;
          parent?.removeChild(cur);
          break;
        }
        cur = cur.parentElement;
        guard += 1;
      }
    }

    const after = {
      roots: document.querySelectorAll('.ant-image-preview-root').length,
      wraps: document.querySelectorAll('.ant-image-preview-wrap').length,
      masks: document.querySelectorAll('.ant-image-preview-mask').length,
      containers: document.querySelectorAll('.ant-image-preview').length,
      fuzzy: document.querySelectorAll("[class*='ant-image-preview']").length,
    };
    emitUiProbe(`cleanup-${reason}`, {
      hit: `removed r/w/m/c/f:${before.roots}/${before.wraps}/${before.masks}/${before.containers}/${before.fuzzy} -> ${after.roots}/${after.wraps}/${after.masks}/${after.containers}/${after.fuzzy}`,
      cleanupApplied: true,
    });
    // #region agent log
    emitDebugLog({
      sessionId: '4d2004',
      runId: 'post-fix',
      hypothesisId: 'FIX',
      location: 'secure-image/index.tsx:cleanupStalePreviewRoots',
      message: 'Removed stale ant image preview roots after close',
      data: { reason, before, after, stillBlockedByPreviewMask },
      timestamp: Date.now(),
    });
    // #endregion
  }, [emitDebugLog, emitUiProbe]);

  const [src, setSrc] = useState<string | null>(initialSrc || null);
  const previewEnabled = !!preview;
  const [loading, setLoading] = useState(!initialSrc);
  const [error, setError] = useState(false);
  const [isVisible, setIsVisible] = useState(previewEnabled);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewEpoch, setPreviewEpoch] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const openPreview = React.useCallback(() => {
    if (!previewEnabled) return;
    setPreviewVisible(true);
    emitUiProbe('open-click', { visible: true });
    // #region agent log
    emitDebugLog({
      sessionId: '4d2004',
      runId: 'run5',
      hypothesisId: 'H13',
      location: 'secure-image/index.tsx:openPreview',
      message: 'Manual open preview by click',
      data: {
        previewEnabled,
        hasSrc: !!src,
        visibleBefore: previewVisible,
      },
      timestamp: Date.now(),
    });
    // #endregion
  }, [previewEnabled, emitUiProbe, emitDebugLog, src, previewVisible]);

  useEffect(() => {
    // #region agent log
    emitDebugLog({
      sessionId: '4d2004',
      runId: 'run6',
      hypothesisId: 'H14',
      location: 'secure-image/index.tsx:mount',
      message: 'SecureImage mounted',
      data: {
        previewEnabled,
        hasInitialSrc: !!initialSrc,
        hasFileUuid: !!fileUuid,
      },
      timestamp: Date.now(),
    });
    // #endregion
  }, [emitDebugLog, previewEnabled, initialSrc, fileUuid]);

  useEffect(() => {
    // #region agent log
    emitDebugLog({
      sessionId: '4d2004',
      runId: 'run8',
      hypothesisId: 'H16',
      location: 'secure-image/index.tsx:previewEpoch',
      message: 'Preview instance epoch changed',
      data: { previewEpoch, previewVisible },
      timestamp: Date.now(),
    });
    // #endregion
  }, [emitDebugLog, previewEpoch, previewVisible]);

  // 1. 延迟加载：仅当组件进入可视区域时才触发 API 请求鉴权 URL
  useEffect(() => {
    if (previewEnabled) {
      setIsVisible(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        // #region agent log
        emitDebugLog({sessionId:'4d2004',runId:'run2',hypothesisId:'H6',location:'secure-image/index.tsx:76',message:'Intersection visible, image component activated',data:{fileUuid: fileUuid ?? null, hasInitialSrc: !!initialSrc},timestamp:Date.now()});
        // #endregion
        emitUiProbe('intersect-visible', { fileUuid: fileUuid ?? null });
        setIsVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '200px' }); // 提前 200px 加载

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [fileUuid, initialSrc, previewEnabled, emitDebugLog]);

  // 2. 获取鉴权后的预览 URL
  useEffect(() => {
    if (!isVisible) return;
    
    // 如果已经有初始 src，就不需要请求
    if (initialSrc) {
      setSrc(initialSrc);
      setLoading(false);
      return;
    }

    if (!fileUuid) return;

    let cancelled = false;
    setLoading(true);
    getFileDownloadUrlWithToken(fileUuid, { forAvatar })
      .then((url) => {
        if (!cancelled) {
          setSrc(url);
          setError(false);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      // #region agent log
      emitDebugLog({sessionId:'4d2004',runId:'run2',hypothesisId:'H3',location:'secure-image/index.tsx:119',message:'Preview source effect cleanup/unmount path',data:{fileUuid: fileUuid ?? null, bodyClass: typeof document !== 'undefined' ? document.body.className : 'na', bodyPointerEvents: typeof document !== 'undefined' ? (document.body.style.pointerEvents || '') : 'na', bodyOverflow: typeof document !== 'undefined' ? (document.body.style.overflow || '') : 'na'},timestamp:Date.now()});
      // #endregion
      emitUiProbe('effect-cleanup', { fileUuid: fileUuid ?? null });
      cancelled = true;
    };
  }, [fileUuid, forAvatar, isVisible, initialSrc, emitDebugLog, emitUiProbe]);

  const previewConfig = React.useMemo(() => {
    if (!preview) return false;
    if (preview === true) {
      return {
        src: src || undefined,
        destroyOnHidden: true,
        visible: previewVisible,
        onVisibleChange: (visible: boolean) => {
          setPreviewVisible(visible);
          if (!visible) {
            setPreviewEpoch((v) => v + 1);
          }
          // #region agent log
          emitDebugLog({sessionId:'4d2004',runId:'post-fix',hypothesisId:'H1',location:'secure-image/index.tsx:138',message:'Ant preview visibility changed',data:{visible, getContainer:'default', destroyOnHidden:true, bodyClass: typeof document !== 'undefined' ? document.body.className : 'na', bodyPointerEvents: typeof document !== 'undefined' ? (document.body.style.pointerEvents || '') : 'na', bodyOverflow: typeof document !== 'undefined' ? (document.body.style.overflow || '') : 'na'},timestamp:Date.now()});
          // #endregion
          emitUiProbe(`visible-${visible ? 'open' : 'close'}`, { visible });
          sampleOverlayState(`sample-${visible ? 'open' : 'close'}-0`);
          queueMicrotask(() => {
            // #region agent log
            emitDebugLog({sessionId:'4d2004',runId:'run2',hypothesisId:'H2',location:'secure-image/index.tsx:142',message:'Post-visibility microtask body state snapshot',data:{visible, bodyClass: typeof document !== 'undefined' ? document.body.className : 'na', bodyPointerEvents: typeof document !== 'undefined' ? (document.body.style.pointerEvents || '') : 'na', bodyOverflow: typeof document !== 'undefined' ? (document.body.style.overflow || '') : 'na'},timestamp:Date.now()});
            // #endregion
            emitUiProbe('microtask-after-visible-change', { visible });
            sampleOverlayState('sample-microtask');
          });
          if (!visible) {
            sampleOverlayState('sample-close');
            // #region agent log
            emitDebugLog({
              sessionId: '4d2004',
              runId: 'run8',
              hypothesisId: 'H16',
              location: 'secure-image/index.tsx:onVisibleChange',
              message: 'Close detected, remount preview instance for stale overlay recovery',
              data: { visible, cleanupDisabled: true, remountByEpoch: true },
              timestamp: Date.now(),
            });
            // #endregion
          }
        },
      };
    }
    return {
      ...preview,
      src: preview.src || src || undefined,
      destroyOnHidden: true,
      visible: previewVisible,
      onVisibleChange: (visible: boolean) => {
        setPreviewVisible(visible);
        if (!visible) {
          setPreviewEpoch((v) => v + 1);
        }
        // #region agent log
        emitDebugLog({sessionId:'4d2004',runId:'post-fix',hypothesisId:'H4',location:'secure-image/index.tsx:154',message:'Custom preview object visibility changed',data:{visible, getContainer:'default', destroyOnHidden:true, bodyClass: typeof document !== 'undefined' ? document.body.className : 'na', bodyPointerEvents: typeof document !== 'undefined' ? (document.body.style.pointerEvents || '') : 'na', bodyOverflow: typeof document !== 'undefined' ? (document.body.style.overflow || '') : 'na'},timestamp:Date.now()});
        // #endregion
        emitUiProbe('custom-visible-change', { visible });
      },
    };
  }, [preview, src, emitDebugLog, emitUiProbe, sampleOverlayState, previewVisible]);

  const placeholder = (
    <div
      ref={containerRef}
      style={{
        width: width ?? 40,
        height: height ?? 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f5f5',
        borderRadius: 4,
        ...style,
      }}
    >
      <Skeleton.Avatar active shape="square" size={typeof width === 'number' ? width : 40} />
    </div>
  );

  if (!isVisible || loading) {
    return placeholder;
  }

  if (error || !src) {
    return (
      <div
        style={{
          width: width ?? 40,
          height: height ?? 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fafafa',
          color: '#bfbfbf',
          fontSize: 12,
          borderRadius: 4,
          ...style,
        }}
      >
        {alt || 'Error'}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ display: 'inline-block', lineHeight: 0, position: 'relative' }}
      data-secure-image-debug="v3"
    >
      <Image
        key={`secure-image-${previewEpoch}`}
        src={src || undefined}
        alt={alt}
        width={width}
        height={height}
        style={{ objectFit: 'cover', borderRadius: 4, ...style }}
        preview={previewConfig}
        onClick={openPreview}
        placeholder={<Skeleton.Avatar active shape="square" size={typeof width === 'number' ? width : 40} />}
        onError={(e) => {
          setError(true);
          onError?.(e);
        }}
        onLoad={onLoad}
      />
      {import.meta.env.DEV ? (
        <span
          style={{
            position: 'absolute',
            right: -2,
            top: -2,
            fontSize: 8,
            lineHeight: '10px',
            padding: '0 2px',
            borderRadius: 2,
            background: 'rgba(22,119,255,0.9)',
            color: '#fff',
            pointerEvents: 'none',
          }}
        >
          dbg
        </span>
      ) : null}
    </div>
  );
};

export default SecureImage;
