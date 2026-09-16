import { afterEach, describe, expect, it, vi } from 'vitest'
import { runAnalysis } from '../lib/analysis-client'

function fakeWorker() {
  return { onmessage: null as Worker['onmessage'], onerror: null as Worker['onerror'], postMessage: vi.fn(), terminate: vi.fn() }
}
function emit(worker: ReturnType<typeof fakeWorker>, data: unknown) {
  worker.onmessage?.call(worker as unknown as Worker, { data } as MessageEvent)
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('bounded, cancellable playground analysis', () => {
  it('returns a report and releases the worker', async () => {
    const worker = fakeWorker()
    const task = runAnalysis('[]', 'estimate', new AbortController().signal, () => worker)
    emit(worker, { type: 'result', report: { format: 'json' } })
    await expect(task).resolves.toEqual({ format: 'json' })
    expect(worker.terminate).toHaveBeenCalledOnce()
  })
  it('terminates synchronous work when input is superseded', async () => {
    const worker = fakeWorker()
    const controller = new AbortController()
    const task = runAnalysis('[]', 'estimate', controller.signal, () => worker)
    controller.abort()
    await expect(task).rejects.toMatchObject({ name: 'AbortError' })
    expect(worker.terminate).toHaveBeenCalledOnce()
    expect(worker.onmessage).toBeNull()
  })
  it.each([false, true])('bounds loading and computation (ready=%s)', async ready => {
    vi.useFakeTimers()
    const worker = fakeWorker()
    const task = runAnalysis('[]', 'o200k_base', new AbortController().signal, () => worker)
    if (ready) emit(worker, { type: 'ready' })
    const assertion = expect(task).rejects.toThrow(ready ? /5-second limit/ : /15 seconds/)
    await vi.advanceTimersByTimeAsync(ready ? 5000 : 15000)
    await assertion
    expect(worker.terminate).toHaveBeenCalledOnce()
  })
  it('rejects oversized input before starting a worker', async () => {
    const factory = vi.fn()
    await expect(runAnalysis('x'.repeat(100001), 'estimate', new AbortController().signal, factory)).rejects.toThrow(/100,000/)
    expect(factory).not.toHaveBeenCalled()
  })
  it('surfaces worker errors and terminates', async () => {
    const worker = fakeWorker()
    const task = runAnalysis('[]', 'estimate', new AbortController().signal, () => worker)
    emit(worker, { type: 'error', error: 'precision loss' })
    await expect(task).rejects.toThrow(/precision loss/)
    expect(worker.terminate).toHaveBeenCalledOnce()
  })
  it('exercises actual worker parsing and both real tokenizers', async () => {
    const scope = { onmessage: null as unknown as (event: { data: { json: string; tokenizer: string } }) => Promise<void>, postMessage: vi.fn() }
    vi.stubGlobal('self', scope)
    await import('../lib/analysis.worker')
    await scope.onmessage({ data: { json: '[{"id":9007199254740993}]', tokenizer: 'estimate' } })
    expect(scope.postMessage).toHaveBeenLastCalledWith({ type: 'error', error: expect.stringContaining('precision loss') })
    await scope.onmessage({ data: { json: '[{"id":1,"\\u0069d":2}]', tokenizer: 'estimate' } })
    expect(scope.postMessage).toHaveBeenLastCalledWith({ type: 'error', error: expect.stringContaining('Duplicate JSON key') })
    for (const tokenizer of ['o200k_base', 'cl100k_base']) {
      await scope.onmessage({ data: { json: '[{"text":"<|endoftext|>","id":"9007199254740993"}]', tokenizer } })
      expect(scope.postMessage).toHaveBeenLastCalledWith({ type: 'result', report: expect.objectContaining({ roundTrip: true, estimated: false, tokenizer }) })
    }
  })
})
