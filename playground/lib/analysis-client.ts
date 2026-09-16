import type { Analysis } from './vigesimal.mjs';
// eslint-disable-next-line import/default -- Vite supplies this virtual worker constructor.
import AnalysisWorkerConstructor from './analysis.worker?worker';

type AnalysisWorker = Pick<Worker, 'onmessage' | 'onerror' | 'postMessage' | 'terminate'>;

// A fresh worker makes cancellation real: terminating it interrupts synchronous
// tokenization too. Both loading and computation have hard wall-clock limits.
export function runAnalysis(json: string, tokenizer: string, signal: AbortSignal,
  createWorker: () => AnalysisWorker = () => new AnalysisWorkerConstructor(),
): Promise<Analysis> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Analysis cancelled', 'AbortError'));
    if (!json.trim()) return reject(new Error('Paste JSON or load an example to begin.'));
    if (json.length > 100_000) return reject(new Error('Use the CLI for payloads over 100,000 characters.'));
    if (!['estimate', 'o200k_base', 'cl100k_base'].includes(tokenizer)) return reject(new Error('Unknown tokenizer.'));
    const worker = createWorker();
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;
    const finish = (error?: Error, report?: Analysis) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
      if (error) reject(error); else resolve(report!);
    };
    const abort = () => finish(new DOMException('Analysis cancelled', 'AbortError'));
    timer = setTimeout(() => finish(new Error('Analysis could not start within 15 seconds. Retry or choose the chars/4 estimate.')), 15_000);
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = event => {
      if (event.data.type === 'ready') {
        clearTimeout(timer);
        timer = setTimeout(() => finish(new Error('Analysis exceeded the 5-second limit. Try a smaller payload or choose the chars/4 estimate. No result was selected.')), 5_000);
      } else if (event.data.type === 'error') finish(new Error(event.data.error));
      else if (event.data.type === 'result') finish(undefined, event.data.report);
    };
    worker.onerror = () => finish(new Error('Analysis worker failed. Retry or choose another counter.'));
    try { worker.postMessage({ json, tokenizer }); }
    catch (error) { finish(error as Error); }
  });
}
