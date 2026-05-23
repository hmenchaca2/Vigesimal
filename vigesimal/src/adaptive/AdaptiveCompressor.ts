import type { CompressResult, CompressorSession } from '../types'
import { Panel } from '../types'
import { VigesimalEncoder } from '../encoder/VigesimalEncoder'
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
  private encoder = new VigesimalEncoder()

  constructor(registry: SchemaRegistry) {
    this.registry = registry
  }

  compress(
    data: Record<string, unknown>,
    schemaName: string
  ): CompressResult {
    const schema = this.registry.get(schemaName)
    const output = this.encoder.encode(data, schema)
    return {
      output,
      panelsUsed: [Panel.A],
      stats: makeStats(JSON.stringify(data), output),
    }
  }

  compressRecords(
    rows: Record<string, unknown>[],
    schemaName: string
  ): CompressResult {
    const schema = this.registry.get(schemaName)
    const panels = selectPanels({
      isArray: true,
      recordCount: rows.length,
      sessionTurnCount: 0,
      shouldReset: false,
    })

    const output = panels.includes(Panel.B)
      ? this.encoder.encodeTabular(rows, schema)
      : rows.map(r => this.encoder.encode(r, schema)).join('\n')

    return {
      output,
      panelsUsed: panels,
      stats: makeStats(JSON.stringify(rows), output),
    }
  }

  createSession(schemaName: string): CompressorSession {
    const schema = this.registry.get(schemaName)
    const tracker = new DeltaTracker()
    const encoder = this.encoder
    let turnCount = 0

    return {
      compress(state: Record<string, unknown>): CompressResult {
        turnCount++
        const deltaResult = tracker.update(state)

        const panels = selectPanels({
          isArray: false,
          recordCount: 1,
          sessionTurnCount: turnCount,
          shouldReset: deltaResult.type === 'reset',
        })

        let output: string
        if (deltaResult.type === 'reset') {
          output = encoder.encode(state, schema)
        } else {
          output = encoder.encodeDelta(deltaResult.delta, schema)
        }

        return {
          output,
          panelsUsed: panels,
          stats: makeStats(JSON.stringify(state), output),
        }
      },

      reset(): void {
        tracker.reset()
        turnCount = 0
      },
    }
  }
}
