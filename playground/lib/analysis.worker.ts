import { analyze, parseJson } from './vigesimal.mjs';

self.onmessage = async (event: MessageEvent<{ json: string; tokenizer: string }>) => {
  try {
    const { json, tokenizer } = event.data;
    const data = parseJson(json);
    let counter: ((text: string) => number) | undefined;
    if (tokenizer !== 'estimate') {
      const [{ Tiktoken }, ranks] = await Promise.all([
        import('js-tiktoken/lite'),
        tokenizer === 'o200k_base' ? import('js-tiktoken/ranks/o200k_base') : import('js-tiktoken/ranks/cl100k_base'),
      ]);
      const encoder = new Tiktoken(ranks.default);
      counter = text => encoder.encode(text, [], []).length;
    }
    self.postMessage({ type: 'ready' });
    const report = analyze(data, counter ? { est: counter, tokenizer } : {});
    self.postMessage({ type: 'result', report });
  } catch (error) {
    self.postMessage({ type: 'error', error: (error as Error).message });
  }
};
