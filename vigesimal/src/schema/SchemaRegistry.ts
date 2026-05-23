import type { VigesimalSchema } from '../types'
import { Panel } from '../types'
import { inferSchema } from './infer'
import { buildCodex } from './codex'

export class SchemaRegistry {
  private schemas = new Map<string, VigesimalSchema>()
  private schemaCounter = 0

  private nextSchemaId(): string {
    this.schemaCounter++
    return `S${this.schemaCounter}`
  }

  register(name: string, schema: VigesimalSchema): void {
    this.schemas.set(name, schema)
  }

  get(name: string): VigesimalSchema {
    const schema = this.schemas.get(name)
    if (!schema) throw new Error(`Schema "${name}" not found`)
    return schema
  }

  infer(name: string, sampleData: Record<string, unknown>[]): VigesimalSchema {
    const schemaId = this.nextSchemaId()
    const schema = inferSchema(schemaId, sampleData)
    this.schemas.set(name, schema)
    return schema
  }

  getCodex(name: string, panels: Panel[] = [Panel.A]): string {
    return buildCodex(this.get(name), panels)
  }
}
