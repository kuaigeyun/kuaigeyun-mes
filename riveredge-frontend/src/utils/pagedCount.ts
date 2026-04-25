export async function countWithPagedRequests<T, P extends { skip?: number; limit?: number }>(
  fetchPage: (params: P) => Promise<T[]>,
  baseParams: Omit<P, 'skip' | 'limit'>,
  options?: {
    chunkSize?: number;
    maxRounds?: number;
  },
): Promise<number> {
  const chunkSize = options?.chunkSize ?? 100;
  const maxRounds = options?.maxRounds ?? 200;

  let total = 0;
  let skip = 0;

  for (let i = 0; i < maxRounds; i += 1) {
    const page = await fetchPage({
      ...(baseParams as P),
      skip,
      limit: chunkSize,
    });
    const size = Array.isArray(page) ? page.length : 0;
    total += size;
    if (size < chunkSize) break;
    skip += chunkSize;
  }

  return total;
}

