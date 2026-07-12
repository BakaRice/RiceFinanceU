import { describe, expect, it } from 'vitest'
import type { IncomeRecord } from '../types/finance'
import {
  buildIncomeWorkbookData,
  worksheetValuesToIncomeRows,
} from './incomeSheetWorkbook'

const records: IncomeRecord[] = [{
  id: 'salary-1',
  occurredAt: '2026-07-01',
  category: 'salary',
  amount: 10000,
  sourceName: '公司',
  note: '七月工资',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
}]

describe('incomeSheetRuntime data model', () => {
  it('builds one hidden identity column and five visible business columns', () => {
    const workbook = buildIncomeWorkbookData(records)
    const sheet = workbook.sheets['income-sheet']

    expect(workbook.sheetOrder).toEqual(['income-sheet'])
    expect(sheet.columnCount).toBe(6)
    expect(sheet.columnData?.[0]?.hd).toBe(1)
    expect(sheet.cellData?.[0]?.[0]?.v).toBe('_row_key')
    expect(sheet.cellData?.[0]?.[1]?.v).toBe('发生日期')
    expect(sheet.cellData?.[1]?.[0]?.v).toBe('salary-1')
    expect(sheet.cellData?.[1]?.[1]?.v).toBe('2026-07-01')
    expect(sheet.cellData?.[1]?.[3]?.v).toBe(10000)
  })

  it('reads worksheet values while keeping hidden identities and blank destinations stable', () => {
    expect(worksheetValuesToIncomeRows([
      ['salary-1', '2026-07-01', 'salary', 12000, '公司', ''],
      ['new:2', '2026-07-02', 'bonus', 500, '', '奖金'],
      [null, null, null, null, null, null],
    ])).toEqual([
      {
        rowKey: 'salary-1',
        occurredAt: '2026-07-01',
        category: 'salary',
        amount: '12000',
        sourceName: '公司',
        note: '',
      },
      {
        rowKey: 'new:2',
        occurredAt: '2026-07-02',
        category: 'bonus',
        amount: '500',
        sourceName: '',
        note: '奖金',
      },
      {
        rowKey: 'new:3',
        occurredAt: '',
        category: '',
        amount: '',
        sourceName: '',
        note: '',
      },
    ])
  })
})
