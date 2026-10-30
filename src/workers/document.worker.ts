/// <reference lib="webworker" />
import { generateEpub } from '../core/epub';
import { buildOutline, sectionPreview } from '../core/outline';
import { decodeText } from '../core/text';
import type { DocumentSnapshot, WorkerRequest, WorkerResponse } from '../core/types';

const worker = self as unknown as DedicatedWorkerGlobalScope;
let state: { text: string; snapshot: DocumentSnapshot } | null = null;
let activeJob = 0;

function send(response: WorkerResponse, transfer: Transferable[] = []) { worker.postMessage(response, transfer); }

worker.onmessage = async ({ data: request }: MessageEvent<WorkerRequest>) => {
  if (request.type === 'cancel') { activeJob = -1; return; }
  const id = request.id;
  let lastProgress = 0;
  if (request.type !== 'preview') activeJob = id;
  const check = () => { if (activeJob !== id) throw new Error('操作已取消'); };
  const progress = async (value: number, label: string) => {
    check();
    lastProgress = Math.max(lastProgress, value);
    send({ id, type: 'progress', value: lastProgress, label });
    await new Promise((resolve) => setTimeout(resolve, 0));
    check();
  };
  try {
    if (request.type === 'load') {
      await progress(0.02, '读取文件');
      const bytes = new Uint8Array(await request.file.arrayBuffer());
      check();
      const decoded = decodeText(bytes, request.encoding);
      await progress(0.16, '检查编码');
      const outline = await buildOutline(decoded.text, request.rules, new Set(), request.maxTitleLength, (value) => progress(0.2 + value * 0.8, '识别章节'));
      check();
      const snapshot: DocumentSnapshot = {
        ...outline, documentId: crypto.randomUUID(), revision: 1,
        filename: request.file.name, size: request.file.size,
        encoding: decoded.encoding, encodingUncertain: decoded.uncertain,
      };
      state = { text: decoded.text, snapshot };
      send({ id, type: 'result', payload: snapshot });
    } else if (request.type === 'analyze') {
      if (!state) throw new Error('请先导入 TXT 文件。');
      const outline = await buildOutline(state.text, request.rules, new Set(request.ignored), request.maxTitleLength, (value) => progress(value, '更新章节目录'));
      check();
      state.snapshot = { ...state.snapshot, ...outline, revision: state.snapshot.revision + 1 };
      send({ id, type: 'result', payload: state.snapshot });
    } else if (request.type === 'preview') {
      if (!state) throw new Error('请先导入 TXT 文件。');
      const section = state.snapshot.sections.find((item) => item.id === request.sectionId);
      if (!section) throw new Error('章节已更新，请重新选择。');
      send({ id, type: 'result', payload: { ...sectionPreview(state.text, section, request.offset), sectionId: section.id, revision: state.snapshot.revision } });
    } else if (request.type === 'export') {
      if (!state) throw new Error('请先导入 TXT 文件。');
      const bytes = await generateEpub(state.text, state.snapshot, request.metadata, (value) => progress(value, '生成 EPUB'));
      check();
      send({ id, type: 'result', payload: bytes }, [bytes.buffer as ArrayBuffer]);
    }
  } catch (error) {
    send({ id, type: 'error', message: error instanceof Error ? error.message : '处理失败，请重试。' });
  }
};
