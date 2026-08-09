import { QueryClient } from '@tanstack/react-query';
import { defaultQueryOptions } from './config/reactQuery';

/** 全局 QueryClient（main 与壳层 init 共用，保证缓存键一致） */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      ...defaultQueryOptions,
    },
    mutations: {
      retry: () => false,
      throwOnError: false,
    },
  },
});
