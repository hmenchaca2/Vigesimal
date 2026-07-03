import type { CompressResult, CompressorSession } from '../types'
import { Panel } from '../types'
import { encodeTabular, encodeRow, encodeHeader, encodeDelta } from '../encoder/panels'
import { DeltaTracker } from '../delta/DeltaTracker'
import type { SchemaRegistry } from '../schema/SchemaRegistry'
import { selectPanels } from './select'

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

function makeStats(original: string, compressed: string) {
  const inputTokenEstimate = estimateTokens(original)
  const outputTokenEstimate = estimateTokens(compressed)
  const reduction = Math.max(0, 1 - outputTokenEstimate / inputTokenEstimate)
  return { inputTokenEstimate, outputTokenEstimate, reduction }
}

export class AdaptiveCompressor {
  private registry: SchemaRegistry

  constructor(registry: SchemaRegistry) {
    this.registry = registry
  }

  compress(data: Record<string, unknown>, schemaName: string): CompressResult {
    const schema = this.registry.get(schemaName)
    const output = encodeTabular(schemaName, [data], schema)
    return {
      output,
      panelsUsed: [Panel.A],
      stats: makeStats(JSON.stringify(data), output),
    }
  }

  compressRecords(rows: Record<string, unknown>[], schemaName: string): CompressResult {
    const schema = this.registry.get(schemaName)
    const panels = selectPanels({
      isArray: true,
      recordCount: rows.length,
      sessionTurnCount: 0,
      shouldReset: false,
    })
    const output = encodeTabular(schemaName, rows, schema)
    return { output, panelsUsed: panels, stats: makeStats(JSON.stringify(rows), output) }
  }

  createSession(schemaName: string): CompressorSession {
    const schema = this.registry.get(schemaName)
    const tracker = new DeltaTracker()

    return {
      compress(state: Record<string, unknown>): CompressResult {
        const deltaResult = tracker.update(state)
        const panels = selectPanels({
          isArray: false,
          recordCount: 1,
          sessionTurnCount: tracker.getTurnCount(),
          shouldReset: deltaResult.type === 'reset',
        })
        const output =
          deltaResult.type === 'reset'
            ? encodeHeader(schemaName, 1, schema, new Map()) + encodeRow(state, schema, new Map()) + '\n'
            : encodeDelta(deltaResult.delta)
        return { output, panelsUsed: panels, stats: makeStats(JSON.stringify(state), output) }
      },
      reset(): void {
        tracker.reset()
      },
    }
  }
}
