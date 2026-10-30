declare enum Panel {
    A = "A",
    B = "B",
    C = "C"
}
type FieldType = 'boolean' | 'numeric' | 'string';
interface FieldDef {
    name: string;
    type: FieldType;
    domain?: string[];
}
interface VigesimalSchema {
    name: string;
    fields: FieldDef[];
}
type DeltaMap = Record<string, unknown>;
type ResetEvent = 'session_start' | 'tier_upgrade' | 'err_recovery' | 'intent_pivot' | 'drift_exceeded';
interface ResetRule {
    field: string;
    event: ResetEvent;
    condition: (oldValue: unknown, newValue: unknown) => boolean;
}
interface DeltaTrackerConfig {
    resetRules?: ResetRule[];
}
type DeltaResult = {
    type: 'reset';
    delta: DeltaMap;
    resetReason: ResetEvent;
} | {
    type: 'delta';
    delta: DeltaMap;
};
interface CompressStats {
    inputTokenEstimate: number;
    outputTokenEstimate: number;
    reduction: number;
}
interface CompressResult {
    output: string;
    panelsUsed: Panel[];
    stats: CompressStats;
}
interface CompressorSession {
    compress(state: Record<string, unknown>): CompressResult;
    reset(): void;
}
interface VerifyResult {
    valid: boolean;
    errors: string[];
}

type TokenEstimator = (s: string) => number;
declare function estTokens(s: string): number;
declare function fieldLetters(fields: string[]): Map<string, string>;
declare function buildCodes(fields: string[], records: Record<string, unknown>[], est?: TokenEstimator): Map<string, Map<string, string>>;

interface EncodeOptions {
    /** Dataset name shown in the header. Default: "data". */
    name?: string;
    /** Explicit schema; inferred from the records when omitted. */
    schema?: VigesimalSchema;
    /** Token estimator for code-payoff decisions (e.g. js-tiktoken-backed). */
    est?: TokenEstimator;
}
/** Infer the schema and encode records as a typed block. */
declare function encode(records: Record<string, unknown>[], options?: EncodeOptions): string;
/** Decode typed blocks exactly. Legacy blocks without metadata need a schema
 * for typed decoding; otherwise their scalars remain strings/null. */
declare function decode(encoded: string, schema?: VigesimalSchema): Record<string, unknown>[];

interface AnalyzeOptions extends EncodeOptions {
    /** Label for the supplied counter, e.g. o200k_base. Never inferred. */
    tokenizer?: string;
}
interface Analysis {
    supported: boolean;
    roundTrip: boolean;
    format: 'vigesimal' | 'json';
    output: string;
    encoded: string | null;
    inputTokens: number;
    vigesimalTokens: number | null;
    outputTokens: number;
    reduction: number;
    tokenizer: string;
    estimated: boolean;
    warnings: string[];
}
/** Analyze complete payloads locally. Falls back to compact JSON unless a
 * supported, verified Vigesimal block is strictly smaller by the counter. */
declare function analyze(data: unknown, options?: AnalyzeOptions): Analysis;

/** Reject duplicate keys and precision-losing numbers, including escaped key
 * aliases. Quote exact IDs and high-precision decimals to preserve them. */
declare function parseJson(text: string): unknown;

declare class VigesimalVerifier {
    decode(encoded: string, schema: VigesimalSchema): Record<string, unknown>[];
    verify(encoded: string, original: Record<string, unknown>[], schema: VigesimalSchema): VerifyResult;
}

declare class SchemaRegistry {
    private schemas;
    register(name: string, schema: VigesimalSchema): void;
    get(name: string): VigesimalSchema;
    infer(name: string, sampleData: Record<string, unknown>[]): VigesimalSchema;
    getCodex(name: string): string;
}

declare class AdaptiveCompressor {
    private registry;
    constructor(registry: SchemaRegistry);
    compress(data: Record<string, unknown>, schemaName: string): CompressResult;
    compressRecords(rows: Record<string, unknown>[], schemaName: string): CompressResult;
    createSession(schemaName: string): CompressorSession;
}

declare class DeltaTracker {
    private prevState;
    private turnCount;
    private totalDeltaFields;
    private config;
    constructor(config?: DeltaTrackerConfig);
    update(newState: Record<string, unknown>): DeltaResult;
    getTurnCount(): number;
    shouldReset(): boolean;
    getResetThreshold(): number;
    getFieldChangeRate(): number;
    reset(): void;
}

declare function applyDelta(state: Record<string, unknown>, delta: DeltaMap): Record<string, unknown>;

declare function inferSchema(name: string, sampleData: Record<string, unknown>[]): VigesimalSchema;

declare function buildCodex(schema: VigesimalSchema): string;

declare function quoteCsv(s: string): string;
declare function encodeScalar(v: unknown): string;
declare function decodeScalar(s: string, type: FieldType): unknown;
declare function splitCsvRow(line: string): string[];

declare const LEGEND = "bool: 1=yes 0=no  null: _";
type CodeTable = Map<string, Map<string, string>>;
declare function encodeHeader(name: string, rowCount: number, schema: VigesimalSchema, codes: CodeTable): string;
declare function encodeRow(record: Record<string, unknown>, schema: VigesimalSchema, codes: CodeTable): string;
declare function encodeTabular(name: string, records: Record<string, unknown>[], schema: VigesimalSchema, est?: TokenEstimator): string;
declare function encodeDelta(delta: DeltaMap): string;

declare function decodeTabular(encoded: string, schema?: VigesimalSchema): Record<string, unknown>[];
declare function decodeDelta(encoded: string, schema: VigesimalSchema): Record<string, unknown>;

interface PanelSelectInput {
    isArray: boolean;
    recordCount: number;
    sessionTurnCount: number;
    shouldReset: boolean;
}
declare function selectPanels(input: PanelSelectInput): Panel[];

declare function computeResetThreshold(totalDeltaFields: number, turnsObserved: number): number;

export { AdaptiveCompressor, type Analysis, type AnalyzeOptions, type CodeTable, type CompressResult, type CompressStats, type CompressorSession, type DeltaMap, type DeltaResult, DeltaTracker, type DeltaTrackerConfig, type EncodeOptions, type FieldDef, type FieldType, LEGEND, Panel, type ResetEvent, type ResetRule, SchemaRegistry, type TokenEstimator, type VerifyResult, type VigesimalSchema, VigesimalVerifier, analyze, applyDelta, buildCodes, buildCodex, computeResetThreshold, decode, decodeDelta, decodeScalar, decodeTabular, encode, encodeDelta, encodeHeader, encodeRow, encodeScalar, encodeTabular, estTokens, fieldLetters, inferSchema, parseJson, quoteCsv, selectPanels, splitCsvRow };
