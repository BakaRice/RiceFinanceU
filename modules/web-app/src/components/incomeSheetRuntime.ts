import type { IDisposable } from '@univerjs/presets'
import {
  createUniver,
  LocaleType,
  mergeLocales,
} from '@univerjs/presets'
import {
  UniverSheetsCorePreset,
} from '@univerjs/preset-sheets-core'
import sheetsCoreZhCN from '@univerjs/preset-sheets-core/locales/zh-CN'
import {
  UniverSheetsDataValidationPreset,
} from '@univerjs/preset-sheets-data-validation'
import sheetsDataValidationZhCN from '@univerjs/preset-sheets-data-validation/locales/zh-CN'
import { UniverSheetsFilterPreset } from '@univerjs/preset-sheets-filter'
import sheetsFilterZhCN from '@univerjs/preset-sheets-filter/locales/zh-CN'
import { UniverSheetsSortPreset } from '@univerjs/preset-sheets-sort'
import sheetsSortZhCN from '@univerjs/preset-sheets-sort/locales/zh-CN'
import type { IncomeSheetColumn, IncomeSheetRow } from '../pages/incomeSheetAdapter'
import type { IncomeRecord } from '../types/finance'
import {
  buildIncomeWorkbookData,
  INCOME_SHEET_HEADERS,
  recordsToWorksheetValues,
  worksheetValuesToIncomeRows,
} from './incomeSheetWorkbook'

import '@univerjs/preset-sheets-core/lib/index.css'
import '@univerjs/preset-sheets-data-validation/lib/index.css'
import '@univerjs/preset-sheets-filter/lib/index.css'
import '@univerjs/preset-sheets-sort/lib/index.css'

const COLUMN_INDEX: Record<IncomeSheetColumn, number> = {
  occurredAt: 1,
  category: 2,
  amount: 3,
  sourceName: 4,
  note: 5,
}

export type IncomeSheetRuntime = {
  setRecords(records: IncomeRecord[]): void
  setDarkMode(enabled: boolean): void
  focusCell(row: number, column: IncomeSheetColumn): void
  dispose(): void
}

type CreateIncomeSheetRuntimeOptions = {
  container: HTMLElement
  onRowsChange(rows: IncomeSheetRow[]): void
}

export function createIncomeSheetRuntime({
  container,
  onRowsChange,
}: CreateIncomeSheetRuntimeOptions): IncomeSheetRuntime {
  const { univer, univerAPI } = createUniver({
    locale: LocaleType.ZH_CN,
    locales: {
      [LocaleType.ZH_CN]: mergeLocales(
        sheetsCoreZhCN,
        sheetsDataValidationZhCN,
        sheetsFilterZhCN,
        sheetsSortZhCN,
      ),
    },
    presets: [
      UniverSheetsCorePreset({
        container,
        header: false,
        toolbar: false,
        formulaBar: false,
        footer: false,
        contextMenu: true,
      }),
      UniverSheetsDataValidationPreset({
        showEditOnDropdown: false,
        showSearchOnDropdown: false,
      }),
      UniverSheetsFilterPreset(),
      UniverSheetsSortPreset(),
    ],
  })

  let disposed = false
  let suppressEvents = false
  let emitScheduled = false

  function getActiveSheet() {
    return univerAPI.getActiveWorkbook()?.getActiveSheet() || null
  }

  function emitRows() {
    if (disposed || suppressEvents) return
    const worksheet = getActiveSheet()
    if (!worksheet) return
    const values = worksheet
      .getRange(1, 0, worksheet.getMaxRows() - 1, INCOME_SHEET_HEADERS.length)
      .getValues()
    onRowsChange(worksheetValuesToIncomeRows(values))
  }

  function scheduleEmit() {
    if (disposed || suppressEvents || emitScheduled) return
    emitScheduled = true
    queueMicrotask(() => {
      emitScheduled = false
      emitRows()
    })
  }

  const commandSubscription: IDisposable = univerAPI.addEvent(
    univerAPI.Event.CommandExecuted,
    scheduleEmit,
  )

  function configureSheet() {
    const worksheet = getActiveSheet()
    if (!worksheet) return
    const lastRow = worksheet.getMaxRows()
    worksheet.hideColumns(0, 1)
    worksheet.setFrozenRows(1)
    worksheet.getRange(0, 1, 1, 5)
      .setBackgroundColor('#e8eef8')
      .setFontWeight('bold')
    worksheet.getRange(1, 3, lastRow - 1, 1).setNumberFormat('#,##0.00')

    const categoryRule = univerAPI.newDataValidation()
      .requireValueInList([
        'salary',
        'bonus',
        'side_income',
        'housing_fund',
        'investment',
        'other',
      ], false, true)
      .setAllowBlank(true)
      .setOptions({ showErrorMessage: true, error: '请选择有效的收入分类' })
      .build()
    worksheet.getRange(1, 2, lastRow - 1, 1).setDataValidation(categoryRule)

    const amountRule = univerAPI.newDataValidation()
      .requireNumberGreaterThanOrEqualTo(0)
      .setAllowBlank(true)
      .setOptions({ showErrorMessage: true, error: '金额必须大于等于 0' })
      .build()
    worksheet.getRange(1, 3, lastRow - 1, 1).setDataValidation(amountRule)

    worksheet.getRange(0, 0, lastRow, INCOME_SHEET_HEADERS.length).createFilter()
  }

  return {
    setRecords(records) {
      suppressEvents = true
      const worksheet = getActiveSheet()
      if (worksheet) {
        worksheet
          .getRange(1, 0, worksheet.getMaxRows() - 1, INCOME_SHEET_HEADERS.length)
          .setValues(recordsToWorksheetValues(records, worksheet.getMaxRows() - 1))
      } else {
        univerAPI.createWorkbook(buildIncomeWorkbookData(records))
        configureSheet()
      }
      suppressEvents = false
      emitRows()
    },
    setDarkMode(enabled) {
      univerAPI.toggleDarkMode(enabled)
    },
    focusCell(row, column) {
      const worksheet = getActiveSheet()
      if (!worksheet) return
      worksheet.setActiveRange(worksheet.getRange(row + 1, COLUMN_INDEX[column]))
    },
    dispose() {
      disposed = true
      commandSubscription.dispose()
      univer.dispose()
    },
  }
}
