import { describe, expect, it } from 'vitest'
import type { IncomeRecord } from '../types/finance'
import {
  buildIncomeBatch,
  countIncomeChanges,
  IncomeSheetValidationError,
  recordsToIncomeSheetRows,
  type IncomeSheetRow,
} from './incomeSheetAdapter'

const original: IncomeRecord[] = [
  {
    id: 'salary-1',
    occurredAt: '2026-07-01',
    category: 'salary',
    amount: 10000,
    sourceName: '公司',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 'removed-1',
    occurredAt: '2026-07-02',
    category: 'bonus',
    amount: 1000,
    createdAt: '2026-07-02T00:00:00.000Z',
    updatedAt: '2026-07-02T00:00:00.000Z',
  },
]

function row(overrides: Partial<IncomeSheetRow> = {}): IncomeSheetRow {
  return {
    rowKey: 'new:1',
    occurredAt: '',
    category: '',
    amount: '',
    sourceName: '',
    note: '',
    ...overrides,
  }
}

describe('incomeSheetAdapter', () => {
  it('projects income records into editable sheet rows', () => {
    expect(recordsToIncomeSheetRows(original)).toEqual([
      row({
        rowKey: 'salary-1',
        occurredAt: '2026-07-01',
        category: 'salary',
        amount: '10000',
        sourceName: '公司',
      }),
      row({
        rowKey: 'removed-1',
        occurredAt: '2026-07-02',
        category: 'bonus',
        amount: '1000',
      }),
    ])
  })

  it('builds one create update delete batch and ignores blank rows', () => {
    const rows = [
      row({
        rowKey: 'salary-1',
        occurredAt: '2026年7月1日',
        category: 'salary',
        amount: '12000.235',
        sourceName: ' 公司 ',
      }),
      row({
        rowKey: 'new:1',
        occurredAt: '2026-07-03',
        category: 'side_income',
        amount: '500',
        note: ' 顾问费 ',
      }),
      row({ rowKey: 'new:2' }),
    ]

    expect(buildIncomeBatch(original, rows)).toEqual({
      creates: [{
        occurredAt: '2026-07-03',
        category: 'side_income',
        amount: 500,
        note: '顾问费',
      }],
      updates: [{
        id: 'salary-1',
        occurredAt: '2026-07-01',
        category: 'salary',
        amount: 12000.24,
        sourceName: '公司',
      }],
      deletes: ['removed-1'],
    })
    expect(countIncomeChanges(original, rows)).toBe(3)
  })

  it('keeps record identity when rows are sorted', () => {
    const rows = recordsToIncomeSheetRows(original).reverse()
    rows[0] = { ...rows[0], amount: '1500' }

    expect(buildIncomeBatch(original, rows)).toEqual({
      creates: [],
      updates: [{
        id: 'removed-1',
        occurredAt: '2026-07-02',
        category: 'bonus',
        amount: 1500,
      }],
      deletes: [],
    })
  })

  it('treats a duplicated existing row identity as a new record', () => {
    const source = recordsToIncomeSheetRows(original)[0]

    expect(buildIncomeBatch(original, [source, { ...source, amount: '20000' }])).toEqual({
      creates: [{
        occurredAt: '2026-07-01',
        category: 'salary',
        amount: 20000,
        sourceName: '公司',
      }],
      updates: [],
      deletes: ['removed-1'],
    })
  })

  it.each([
    {
      value: row({ occurredAt: '2026-02-30', category: 'salary', amount: '1' }),
      column: 'occurredAt',
      message: '发生日期无效',
    },
    {
      value: row({ occurredAt: '2026-07-01', category: 'unexpected', amount: '1' }),
      column: 'category',
      message: '收入分类无效',
    },
    {
      value: row({ occurredAt: '2026-07-01', category: 'salary', amount: '-1' }),
      column: 'amount',
      message: '金额必须是大于等于 0 的数字',
    },
  ])('returns the exact invalid cell for $column', ({ value, column, message }) => {
    try {
      buildIncomeBatch([], [row({ rowKey: 'blank' }), value])
      throw new Error('expected validation to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(IncomeSheetValidationError)
      expect(error).toMatchObject({ row: 1, column, message })
    }
  })

  it('counts invalid edited rows as dirty without validating during render', () => {
    const rows = recordsToIncomeSheetRows(original)
    rows[0] = { ...rows[0], amount: '-1' }

    expect(countIncomeChanges(original, rows)).toBe(1)
  })
})
