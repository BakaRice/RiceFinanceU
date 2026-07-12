export const INCOME_SHEET_UI_CONFIG = {
  // 发生日期按领域模型保存为 YYYY-MM-DD 文本，不需要电子表格的“数字以文本存储”警告。
  disableForceStringAlert: true,
  disableForceStringMark: true,
} as const

const BLOCKED_STRUCTURE_COMMANDS = new Set([
  'sheet.command.insert-col',
  'sheet.command.insert-col-by-range',
  'sheet.command.insert-col-before',
  'sheet.command.insert-col-after',
  'sheet.command.insert-multi-cols-before',
  'sheet.command.insert-multi-cols-right',
  'sheet.command.insert-range-move-right-confirm',
  'sheet.command.remove-col',
  'sheet.command.remove-col-by-range',
  'sheet.command.remove-col-confirm',
  'sheet.command.delete-range-move-left-confirm',
  'sheet.command.move-cols',
])

export function isBlockedIncomeSheetStructureCommand(commandId: string): boolean {
  return BLOCKED_STRUCTURE_COMMANDS.has(commandId)
}

export function isBlockedIncomeSheetHeaderEdit(commandId: string, params: unknown): boolean {
  if (commandId !== 'sheet.command.set-range-values' || !params || typeof params !== 'object') {
    return false
  }

  const range = (params as { range?: { startRow?: number; endRow?: number } }).range
  return typeof range?.startRow === 'number' &&
    typeof range.endRow === 'number' &&
    range.startRow <= 0 &&
    range.endRow >= 0
}
