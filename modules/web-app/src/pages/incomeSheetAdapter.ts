import type { IncomeRecordInput } from '../api/client'
import { normalizeIncomeDateInput } from '../domain/income'
import type { IncomeCategory, IncomeRecord } from '../types/finance'

export const INCOME_SHEET_COLUMNS = [
  'occurredAt',
  'category',
  'amount',
  'sourceName',
  'note',
] as const

export type IncomeSheetColumn = typeof INCOME_SHEET_COLUMNS[number]

export type IncomeSheetRow = {
  rowKey: string
  occurredAt: string
  category: string
  amount: string
  sourceName: string
  note: string
}

export type IncomeBatch = {
  creates: IncomeRecordInput[]
  updates: Array<IncomeRecordInput & { id: string }>
  deletes: string[]
}

export class IncomeSheetValidationError extends Error {
  constructor(
    message: string,
    readonly row: number,
    readonly column: IncomeSheetColumn,
  ) {
    super(message)
    this.name = 'IncomeSheetValidationError'
  }
}

const VALID_CATEGORIES: IncomeCategory[] = [
  'salary',
  'bonus',
  'side_income',
  'housing_fund',
  'investment',
  'other',
]

export function recordsToIncomeSheetRows(records: IncomeRecord[]): IncomeSheetRow[] {
  return records.map((record) => ({
    rowKey: record.id,
    occurredAt: record.occurredAt,
    category: record.category,
    amount: String(record.amount),
    sourceName: record.sourceName || '',
    note: record.note || '',
  }))
}

function isBlankRow(row: IncomeSheetRow): boolean {
  return INCOME_SHEET_COLUMNS.every((column) => row[column].trim() === '')
}

function parseAmountValue(value: string): number {
  const normalized = value.trim()
  const validNumber = /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(normalized)
  return validNumber ? Number(normalized.replace(/,/g, '')) : Number.NaN
}

function parseRow(row: IncomeSheetRow, rowIndex: number): IncomeRecordInput {
  const occurredAt = normalizeIncomeDateInput(row.occurredAt)
  if (!occurredAt) {
    throw new IncomeSheetValidationError('发生日期无效', rowIndex, 'occurredAt')
  }

  const category = row.category.trim()
  if (!VALID_CATEGORIES.includes(category as IncomeCategory)) {
    throw new IncomeSheetValidationError('收入分类无效', rowIndex, 'category')
  }

  const amount = parseAmountValue(row.amount)
  if (row.amount.trim() === '' || !Number.isFinite(amount) || amount < 0) {
    throw new IncomeSheetValidationError('金额必须是大于等于 0 的数字', rowIndex, 'amount')
  }

  const sourceName = row.sourceName.trim()
  const note = row.note.trim()
  return {
    occurredAt,
    category: category as IncomeCategory,
    amount: Math.round(amount * 100) / 100,
    ...(sourceName ? { sourceName } : {}),
    ...(note ? { note } : {}),
  }
}

function payloadMatchesRecord(payload: IncomeRecordInput, record: IncomeRecord): boolean {
  return (
    payload.occurredAt === record.occurredAt &&
    payload.category === record.category &&
    payload.amount === record.amount &&
    (payload.sourceName || '') === (record.sourceName || '') &&
    (payload.note || '') === (record.note || '')
  )
}

function rowMatchesRecord(row: IncomeSheetRow, record: IncomeRecord): boolean {
  try {
    return payloadMatchesRecord(parseRow(row, 0), record)
  } catch {
    return false
  }
}

function selectIdentityRows(
  originalById: Map<string, IncomeRecord>,
  rows: IncomeSheetRow[],
): Map<string, number> {
  const candidates = new Map<string, number[]>()
  rows.forEach((row, index) => {
    if (isBlankRow(row) || !originalById.has(row.rowKey)) return
    const indexes = candidates.get(row.rowKey) || []
    indexes.push(index)
    candidates.set(row.rowKey, indexes)
  })

  return new Map([...candidates].map(([id, indexes]) => {
    const original = originalById.get(id)!
    const unchangedIndex = indexes.find((index) => rowMatchesRecord(rows[index], original))
    return [id, unchangedIndex ?? indexes[0]]
  }))
}

export function buildIncomeBatch(
  original: IncomeRecord[],
  rows: IncomeSheetRow[],
): IncomeBatch {
  const originalById = new Map(original.map((record) => [record.id, record]))
  const identityRows = selectIdentityRows(originalById, rows)
  const consumedIds = new Set<string>()
  const creates: IncomeRecordInput[] = []
  const updates: Array<IncomeRecordInput & { id: string }> = []

  rows.forEach((row, rowIndex) => {
    if (isBlankRow(row)) return
    const payload = parseRow(row, rowIndex)
    const originalRecord = originalById.get(row.rowKey)

    if (!originalRecord || identityRows.get(row.rowKey) !== rowIndex) {
      creates.push(payload)
      return
    }

    consumedIds.add(row.rowKey)
    if (!payloadMatchesRecord(payload, originalRecord)) {
      updates.push({ id: originalRecord.id, ...payload })
    }
  })

  const deletes = original
    .filter((record) => !consumedIds.has(record.id))
    .map((record) => record.id)

  return { creates, updates, deletes }
}

export function countIncomeChanges(
  original: IncomeRecord[],
  rows: IncomeSheetRow[],
): number {
  const originalById = new Map(original.map((record) => [record.id, record]))
  const identityRows = selectIdentityRows(originalById, rows)
  const consumedIds = new Set<string>()
  let changes = 0

  for (const [rowIndex, row] of rows.entries()) {
    if (isBlankRow(row)) continue
    const originalRecord = originalById.get(row.rowKey)
    if (!originalRecord || identityRows.get(row.rowKey) !== rowIndex) {
      changes += 1
      continue
    }

    consumedIds.add(row.rowKey)
    if (!rowMatchesRecord(row, originalRecord)) {
      changes += 1
    }
  }

  return changes + original.filter((record) => !consumedIds.has(record.id)).length
}
