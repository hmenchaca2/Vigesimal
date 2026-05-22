import type { VigesimalSchema } from '../types'
import { Panel } from '../types'

export function buildCodex(schema: VigesimalSchema, panels: Panel[]): string {
  const hasB = panels.includes(Panel.B)
  const hasC = panels.includes(Panel.C)
  const hasD = panels.includes(Panel.D)

  const panelTags = ['A:core', hasB && 'B:tabular', hasC && 'C:delta', hasD && 'D:emblem']
    .filter(Boolean)
    .join(' ')

  const lines: string[] = [
    `## GRAMMAR v4 [${panelTags}]`,
    `[]+,+  +=present _=absent 0=zero -=err`,
    `${schema.name}[${schema.fields.map(f => f.name).join('|')}]`,
  ]

  for (const field of schema.fields) {
    if (field.domain && field.domain.length > 0) {
      lines.push(`  ${field.name}:${field.domain.join('|')}`)
    }
  }

  return lines.join('\n') + '\n'
}
