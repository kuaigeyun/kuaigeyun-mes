import React, { useEffect, useMemo, useRef } from 'react';
import 'swagger-ui-dist/swagger-ui.css';

type SwaggerUiFactory = (options: Record<string, unknown>) => { destroy?: () => void };

function resolveOpenApiUrl(): string {
  const env = import.meta.env as Record<string, string | boolean | undefined>;
  const configuredTarget = (env.VITE_API_TARGET as string | undefined)?.trim();
  if (configuredTarget) {
    return `${configuredTarget.replace(/\/$/, '')}/openapi.json`;
  }

  const backendHost = (env.VITE_BACKEND_HOST as string | undefined) || '127.0.0.1';
  const backendPort = (env.VITE_BACKEND_PORT as string | undefined) || '8200';
  if (env.DEV) {
    return `http://${backendHost}:${backendPort}/openapi.json`;
  }
  return `${window.location.origin}/openapi.json`;
}

const DocsPage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const openApiUrl = useMemo(() => resolveOpenApiUrl(), []);

  useEffect(() => {
    let active = true;
    let instance: { destroy?: () => void } | undefined;

    void (async () => {
      const mod = await import('swagger-ui-dist/swagger-ui-bundle.js');
      const factory = ((mod as { default?: SwaggerUiFactory }).default || mod) as SwaggerUiFactory;

      if (!active || !containerRef.current) {
        return;
      }

      instance = factory({
        url: openApiUrl,
        domNode: containerRef.current,
        layout: 'BaseLayout',
        deepLinking: true,
        showExtensions: true,
        showCommonExtensions: true,
      });
    })();

    return () => {
      active = false;
      instance?.destroy?.();
    };
  }, [openApiUrl]);

  return <div ref={containerRef} style={{ minHeight: '100vh', background: '#fff' }} />;
};

export default DocsPage;

