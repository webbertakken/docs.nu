// An in-memory R2 bucket for the bug report tests: put, get, list by prefix and delete, as the worker uses them. Not
// a `.test.ts` file, so vitest doesn't collect it as a suite.
type Stored = { bytes: Uint8Array; contentType: string | undefined };

export type TestR2 = R2Bucket & { objects: Map<string, Stored>; failPuts: boolean };

export function testR2(): TestR2 {
  const objects = new Map<string, Stored>();
  const bucket = {
    objects,
    failPuts: false,
    async put(key: string, value: ArrayBuffer | Uint8Array, opts?: R2PutOptions) {
      if (bucket.failPuts) throw new Error('r2 put failed');
      const meta = opts?.httpMetadata as R2HTTPMetadata | undefined;
      objects.set(key, { bytes: new Uint8Array(value), contentType: meta?.contentType });
      return {} as R2Object;
    },
    async get(key: string) {
      const hit = objects.get(key);
      if (!hit) return null;
      return {
        body: new Blob([hit.bytes]).stream(),
        httpMetadata: { contentType: hit.contentType },
        arrayBuffer: async () => hit.bytes.slice().buffer,
      } as unknown as R2ObjectBody;
    },
    async list(opts?: R2ListOptions) {
      const keys = [...objects.keys()].filter((k) => k.startsWith(opts?.prefix ?? ''));
      return { objects: keys.map((key) => ({ key })), truncated: false } as unknown as R2Objects;
    },
    async delete(keys: string | string[]) {
      for (const k of Array.isArray(keys) ? keys : [keys]) objects.delete(k);
    },
  };
  return bucket as unknown as TestR2;
}
