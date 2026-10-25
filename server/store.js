import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { get, put, BlobPreconditionFailedError } from '@vercel/blob';

const blobPath = 'portfolio/site.json';
const localPath = () => process.env.DATA_FILE || resolve('data/site.local.json');
const emptyState = async () => ({ content: JSON.parse(await readFile(resolve('data/site.json'), 'utf8')), revision: 0, feedback: [], rateLimits: {} });

export async function readState() {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await get(blobPath, { access: 'private', useCache: false });
    if (!blob) return { state: await emptyState(), etag: null };
    return { state: await new Response(blob.stream).json(), etag: blob.blob.etag };
  }
  if (process.env.VERCEL) throw Object.assign(new Error('Connect a private Vercel Blob store to enable data storage.'), { status: 503 });
  try { return { state: JSON.parse(await readFile(localPath(), 'utf8')) }; }
  catch (error) { if (error.code !== 'ENOENT') throw error; return { state: await emptyState() }; }
}

let queue = Promise.resolve();
export function mutateState(update) {
  const operation = queue.then(async () => {
    for (let attempt = 0; attempt < 8; attempt++) {
      const { state, etag } = await readState();
      const result = update(state);
      const json = JSON.stringify(state, null, 2);
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        try {
          await put(blobPath, json, {
            access: 'private', contentType: 'application/json', addRandomSuffix: false,
            allowOverwrite: Boolean(etag), ...(etag ? { ifMatch: etag } : {}),
          });
        } catch (error) {
          if (error instanceof BlobPreconditionFailedError) continue;
          // The SDK reports an existing pathname as a generic BlobError.
          // A second writer may have initialized the document since our read.
          if (!etag && (await readState()).etag) continue;
          throw error;
        }
      } else {
        const path = localPath();
        await mkdir(dirname(path), { recursive: true });
        const temp = `${path}.${randomUUID()}.tmp`;
        await writeFile(temp, json, { mode: 0o600 });
        await rename(temp, path);
      }
      return result;
    }
    throw Object.assign(new Error('The site is busy. Please try again.'), { status: 409 });
  });
  queue = operation.catch(() => {});
  return operation;
}
