import type { CellValue, IWorkbookData } from '@univerjs/presets'
import { BooleanNumber, LocaleType } from '@univerjs/presets'
import type { IncomeSheetRow } from '../pages/incomeSheetAdapter'
import type { IncomeRecord } from '../types/finance'

export const INCOME_WORKBOOK_ID = 'income-workbook'
export const INCOME_SHEET_ID = 'income-sheet'
export const INCOME_SHEET_HEADERS = ['_row_key', '发生日期', '分类', '金额', '来源', '备注']
const MIN_DATA_ROWS = 200

function cell(value: CellValue) {
  return { v: value }
}

export function recordsToWorksheetValues(
  records: IncomeRecord[],
  rowCount: number,
): CellValue[][] {
  return Array.from({ length: rowCount }, (_, index) => {
    const record = records[index]
    if (!record) return [`new:${index + 1}`, '', '', '', '', '']
    return [
      record.id,
      record.occurredAt,
      record.category,
      record.amount,
      record.sourceName || '',
      record.note || '',
    ]
  })
}

export function buildIncomeWorkbookData(records: IncomeRecord[]): IWorkbookData {
  const rowCount = Math.max(MIN_DATA_ROWS + 1, records.length + 51)
  const cellData: NonNullable<IWorkbookData['sheets'][string]['cellData']> = {
    0: Object.fromEntries(INCOME_SHEET_HEADERS.map((value, column) => [column, cell(value)])),
  }

  recordsToWorksheetValues(records, rowCount - 1).forEach((values, index) => {
    cellData[index + 1] = Object.fromEntries(
      values.map((value, column) => [column, cell(value)]),
    )
  })

  return {
    id: INCOME_WORKBOOK_ID,
    name: '收入',
    appVersion: '0.25.1',
    locale: LocaleType.ZH_CN,
    styles: {},
    sheetOrder: [INCOME_SHEET_ID],
    sheets: {
      [INCOME_SHEET_ID]: {
        id: INCOME_SHEET_ID,
        name: '收入',
        tabColor: '',
        hidden: BooleanNumber.FALSE,
        freeze: { startRow: 1, startColumn: 0, xSplit: 0, ySplit: 1 },
        rowCount,
        columnCount: INCOME_SHEET_HEADERS.length,
        zoomRatio: 1,
        scrollTop: 0,
        scrollLeft: 0,
        defaultColumnWidth: 120,
        defaultRowHeight: 30,
        mergeData: [],
        cellData,
        rowData: { 0: { h: 34 } },
        columnData: {
          0: { hd: BooleanNumber.TRUE, w: 1 },
          1: { w: 130 },
          2: { w: 150 },
          3: { w: 140 },
          4: { w: 190 },
          5: { w: 260 },
        },
        rowHeader: { width: 46 },
        columnHeader: { height: 0, hidden: BooleanNumber.TRUE },
        showGridlines: BooleanNumber.TRUE,
        rightToLeft: BooleanNumber.FALSE,
      },
    },
  }
}

function stringValue(value: CellValue | null | undefined | void): string {
  return value === null || value === undefined ? '' : String(value)
}

export function worksheetValuesToIncomeRows(
  values: Array<Array<CellValue | null | undefined | void>>,
): IncomeSheetRow[] {
  return values.map((row, index) => ({
    rowKey: stringValue(row[0]) || `new:${index + 1}`,
    occurredAt: stringValue(row[1]),
    category: stringValue(row[2]),
    amount: stringValue(row[3]),
    sourceName: stringValue(row[4]),
    note: stringValue(row[5]),
  }))
}
