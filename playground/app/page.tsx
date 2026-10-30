'use client';

import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import type { Analysis } from '@/lib/vigesimal.mjs';
import { runAnalysis } from '@/lib/analysis-client';

const samples = {
  orders: Array.from({ length: 40 }, (_, i) => ({ id: `ORD-${String(i + 1).padStart(4, '0')}`, department: 'Engineering', status: i % 3 ? 'open' : 'closed', quantity: i + 1 })),
  tiny: [{ id: '00123', active: true }],
  nested: [{ id: '00123', customer: { region: 'West', plan: 'Team' } }],
};
const initial = JSON.stringify(samples.orders, null, 2);

export default function Home() {
  const [input, setInput] = useState(initial);
  const [notice, setNotice] = useState('');
  const [tokenizer, setTokenizer] = useState('o200k_base');
  const [monthlyRequests, setMonthlyRequests] = useState(100000);
  const [result, setResult] = useState<{ input: string; tokenizer: string; report: Analysis | null; error: string } | null>(null);
  const revision = useRef(0);
  const toolJob = useRef<AbortController | null>(null);
  const loading = !result || result.input !== input || result.tokenizer !== tokenizer;
  const report = loading ? null : result.report;
  const error = loading ? '' : result.error;
  const savedPerRequest = report ? Math.max(0, report.inputTokens - report.outputTokens) : 0;
  const monthlyTokensSaved = savedPerRequest * monthlyRequests;
  const impact = monthlyTokensSaved >= 1_000_000
    ? `${(monthlyTokensSaved / 1_000_000).toFixed(monthlyTokensSaved >= 10_000_000 ? 1 : 2)}M`
    : monthlyTokensSaved >= 1_000
      ? `${(monthlyTokensSaved / 1_000).toFixed(1)}K`
      : monthlyTokensSaved.toLocaleString();
  const pilotUrl = `https://github.com/hmenchaca2/Vigesimal/issues/new?title=${encodeURIComponent('Design partner: evaluate my workload')}&body=${encodeURIComponent(`Workload summary\n\n- Requests per month: ${monthlyRequests.toLocaleString()}\n- Compact JSON tokens: ${report?.inputTokens ?? 'not measured'}\n- Selected format: ${report?.format ?? 'not measured'}\n- Measured reduction: ${report ? `${(report.reduction * 100).toFixed(1)}%` : 'not measured'}\n\nPlease do not include sensitive payload data. Describe the workload shape and model requirements only.`)}`;
  function updateInput(value: string) {
    revision.current++;
    toolJob.current?.abort();
    setInput(value);
    setNotice('');
  }
  useEffect(() => {
    // A WebMCP job can supply an already-computed result for this exact input.
    if (result?.input === input && result.tokenizer === tokenizer) return;
    const job = new AbortController();
    const timer = setTimeout(() => {
      runAnalysis(input, tokenizer, job.signal).then(report => {
        if (!job.signal.aborted) setResult({ input, tokenizer, report, error: '' });
      }).catch((error: Error) => {
        if (!job.signal.aborted) setResult({ input, tokenizer, report: null, error: error.message });
      });
    }, 200);
    return () => { clearTimeout(timer); job.abort(); };
  }, [input, tokenizer, result]);
  function selectTokenizer(value: string) {
    revision.current++;
    toolJob.current?.abort();
    setTokenizer(value);
  }
  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: object, options: { signal: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tool = {
      name: 'analyze_json_payload', title: 'Analyze JSON payload',
      description: 'Replace the visible JSON input and return its local payload comparison. Does not upload or persist data.',
      inputSchema: { type: 'object', properties: { json: { type: 'string', maxLength: 100000 } }, required: ['json'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      async execute(value: unknown) {
        if (!value || typeof value !== 'object' || !('json' in value) || typeof value.json !== 'string' || value.json.length > 100000 || Object.keys(value).length !== 1) throw new Error('Expected only a JSON string, at most 100,000 characters.');
        toolJob.current?.abort();
        const job = new AbortController();
        toolJob.current = job;
        const version = ++revision.current;
        const json = value.json;
        const report = await runAnalysis(json, tokenizer, job.signal);
        if (job.signal.aborted || version !== revision.current) throw new DOMException('Analysis superseded', 'AbortError');
        flushSync(() => { setInput(json); setResult({ input: json, tokenizer, report, error: '' }); setNotice('Payload analyzed locally.'); });
        return { format: report.format, supported: report.supported, roundTrip: report.roundTrip, inputTokens: report.inputTokens, outputTokens: report.outputTokens, reduction: report.reduction, tokenizer: report.tokenizer, estimated: report.estimated };
      },
    };
    try { void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch { /* Optional browser capability; UI remains available. */ }
    return () => { lifecycle.abort(); toolJob.current?.abort(); };
  }, [tokenizer]);
  async function copy(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); setNotice(`${label} copied.`); }
    catch { setNotice('Clipboard unavailable. Select and copy the text directly.'); }
  }
  function downloadReport() {
    if (!report) return;
    const blob = new Blob([JSON.stringify({
      generatedAt: new Date().toISOString(),
      workload: { monthlyRequests },
      analysis: report,
      caveat: 'Payload measurements only. Model accuracy, provider billing, caching, retries, and latency require a controlled evaluation.',
    }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'vigesimal-analysis.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setNotice('Analysis downloaded.');
  }
  return (
    <main className="lab">
      <header className="masthead"><Link className="wordmark" href="/">vigesimal<span aria-hidden="true">/</span></Link><span className="privacy">● In-browser processing · No telemetry</span></header>
      <section className="intro"><div><p className="eyebrow">PAYLOAD LAB / UNRELEASED TYPED FORMAT</p><h1>Less repetition.<br /><span>Same data.</span></h1></div><p>Test your structured tool output. Verify the round-trip, compare complete payloads, and keep JSON when it is the better fit.</p></section>
      <div className="toolbar"><span>Try a sample</span><Button variant="outline" onClick={() => updateInput(initial)}>40 orders</Button><Button variant="outline" onClick={() => updateInput(JSON.stringify(samples.tiny, null, 2))}>Tiny payload</Button><Button variant="outline" onClick={() => updateInput(JSON.stringify(samples.nested, null, 2))}>Nested data</Button><div className="counter"><label htmlFor="tokenizer">Counter </label><NativeSelect id="tokenizer" value={tokenizer} onChange={event => selectTokenizer(event.target.value)}><NativeSelectOption value="estimate">chars/4 estimate</NativeSelectOption><NativeSelectOption value="o200k_base">o200k_base</NativeSelectOption><NativeSelectOption value="cl100k_base">cl100k_base</NativeSelectOption></NativeSelect>{loading && <output>Analyzing locally… You can keep editing.</output>}</div></div>
      <div className="trust-strip" role="note"><strong>Private by design</strong><span>Analysis runs in this browser.</span><span>No uploads.</span><span>No account required.</span></div>
      <section className="metrics" aria-label="Payload comparison" aria-live="polite">
        <div><span>Compact JSON</span><strong>{report?.inputTokens.toLocaleString() ?? '—'}</strong><small>{report?.estimated ? 'estimated tokens' : 'tokens'}</small></div>
        <div><span>Vigesimal candidate</span><strong>{report?.vigesimalTokens?.toLocaleString() ?? '—'}</strong><small>{report?.supported === false ? 'unsupported shape' : report?.estimated ? 'estimated tokens' : 'tokens'}</small></div>
        <div className="savings"><span>{report?.estimated ? 'Estimated savings' : 'Selected savings'}</span><strong>{report ? `${(report.reduction * 100).toFixed(1)}%` : '—'}</strong><small>{report ? `Using ${report.format === 'json' ? 'compact JSON' : 'Vigesimal'}` : loading ? 'Analyzing…' : 'No result selected'}</small></div>
        <div className="impact"><span>Tokens avoided / month</span><strong>{report ? impact : '—'}</strong><small>{report ? `${savedPerRequest.toLocaleString()} per request` : 'Set your workload below'}</small></div>
      </section>
      <div className="impact-control"><div><label htmlFor="monthly-requests">Monthly requests</label><p>Estimate repeated payload impact without assuming a provider price.</p></div><Input id="monthly-requests" type="number" min={1} max={1000000000} step={1000} value={monthlyRequests} onChange={event => setMonthlyRequests(Math.min(1_000_000_000, Math.max(1, Number(event.target.value) || 1)))} /></div>
      <section className="workspace">
        <div className="editor"><div className="panel-heading"><label htmlFor="json-input">01 / JSON input</label><span>Stays on this device</span></div><Textarea id="json-input" spellCheck={false} value={input} onChange={event => updateInput(event.target.value)} aria-describedby="input-help" className="code-editor" /><p id="input-help">Flat records work best. Nested and mixed data stay as JSON. Quote exact IDs and high-precision decimals.</p></div>
        <div className="editor output"><div className="panel-heading"><label htmlFor="selected-output">02 / Selected output</label><div className="panel-actions"><Button variant="outline" disabled={!report} onClick={downloadReport}>Download report</Button><Button variant="outline" disabled={!report} onClick={() => report && copy(report.output, 'Output')}>Copy output</Button></div></div><Textarea id="selected-output" readOnly value={report?.output ?? ''} className="code-editor" spellCheck={false} /><p>{report?.roundTrip ? '✓ Vigesimal round-trip verified, including field types.' : report ? 'JSON retained. No verified Vigesimal conversion.' : 'Output appears when the input is valid.'}</p></div>
      </section>
      {error && <div role="alert"><p className="error">{error}</p><Button variant="outline" onClick={() => { revision.current++; toolJob.current?.abort(); setResult(null); }}>Retry analysis</Button></div>}
      {report && <div className="notes"><strong>Evaluation notes</strong><ul>{report.warnings.map(w => <li key={w}>{w}</li>)}</ul><p>Payload savings do not establish model accuracy, API cost, or end-to-end latency. These tokenizers do not count Claude tokens. Treat tool output as untrusted data, not instructions.</p></div>}
      <section className="integration"><div><p className="eyebrow">NEXT / TRY YOUR WORKLOAD</p><h2>Keep the decision in your code.</h2><p>This checkout is unreleased. Build it locally before trying these APIs.</p></div><div><pre>{`import { analyze } from 'vigesimal'\n\nconst result = analyze(records)\n// Pass format alongside the selected payload.\nconst { format, output } = result`}</pre><Button variant="outline" onClick={() => copy("import { analyze } from 'vigesimal'\nconst { format, output } = analyze(records)", 'Example')}>Copy example</Button></div></section>
      <section className="pilot"><div><p className="eyebrow">DESIGN PARTNER PILOT</p><h2>Test a real recurring workload.</h2><p>Get a reproducible comparison against compact JSON and official TOON, including task accuracy—not just token counts. Share only sanitized workload details.</p></div><div className="pilot-proof"><span>Best fit</span><strong>Repeated flat API or tool results</strong><span>Success means</span><strong>Measured savings with no material quality loss</strong><a className="pilot-button" href={pilotUrl} target="_blank" rel="noreferrer">Request a private evaluation</a><small>Opens a prefilled GitHub request. Your payload stays on your device.</small></div></section>
      <output className="notice">{notice}</output>
      <footer><span>Vigesimal / measure before you adopt.</span><a href="https://github.com/hmenchaca2/Vigesimal">Source & documentation ↗</a></footer>
    </main>
  );
}
