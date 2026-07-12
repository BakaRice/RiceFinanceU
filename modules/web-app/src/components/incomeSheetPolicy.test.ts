import { describe, expect, it } from 'vitest'
import {
  INCOME_SHEET_UI_CONFIG,
  isBlockedIncomeSheetHeaderEdit,
  isBlockedIncomeSheetStructureCommand,
} from './incomeSheetPolicy'

describe('income sheet interaction policy', () => {
  it('does not show numeric-text warnings for YYYY-MM-DD business dates', () => {
    expect(INCOME_SHEET_UI_CONFIG).toEqual({
      disableForceStringAlert: true,
      disableForceStringMark: true,
    })
  })

  it.each([
    'sheet.command.insert-col-before',
    'sheet.command.insert-multi-cols-before',
    'sheet.command.insert-multi-cols-right',
    'sheet.command.remove-col-confirm',
    'sheet.command.delete-range-move-left-confirm',
    'sheet.command.insert-range-move-right-confirm',
  ])('blocks the fixed-column structure command %s', (commandId) => {
    expect(isBlockedIncomeSheetStructureCommand(commandId)).toBe(true)
  })

  it('keeps row and cell editing commands available', () => {
    expect(isBlockedIncomeSheetStructureCommand('sheet.command.insert-row-before')).toBe(false)
    expect(isBlockedIncomeSheetStructureCommand('sheet.command.set-range-values')).toBe(false)
  })

  it('blocks header edits without protecting the visible worksheet', () => {
    expect(isBlockedIncomeSheetHeaderEdit('sheet.command.set-range-values', {
      range: { startRow: 0, endRow: 0, startColumn: 1, endColumn: 5 },
    })).toBe(true)
    expect(isBlockedIncomeSheetHeaderEdit('sheet.command.set-range-values', {
      range: { startRow: 1, endRow: 1, startColumn: 1, endColumn: 5 },
    })).toBe(false)
  })
})
