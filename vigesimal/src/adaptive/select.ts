import { Panel } from '../types'

export interface PanelSelectInput {
  isArray: boolean
  recordCount: number
  sessionTurnCount: number
  shouldReset: boolean
}

export function selectPanels(input: PanelSelectInput): Panel[] {
  const panels: Panel[] = [Panel.A]

  if (input.isArray && input.recordCount >= 3) {
    panels.push(Panel.B)
  }

  if (input.sessionTurnCount > 1 && !input.shouldReset) {
    panels.push(Panel.C)
  }

  return panels
}
