import type { Asset, AssetDcaPlan, AssetType, DcaFrequency } from '../types/finance'
import { isInvestmentType } from './assets'
import { roundMoney } from './money'

export type DcaEstimateStatus =
  | 'on_track'
  | 'underfunded'
  | 'overfunded'
  | 'insufficient_data'

export interface DcaEstimate {
  status: DcaEstimateStatus
  periodsRemaining?: number
  remainingAmount?: number
  suggestedContribution?: number
  plannedContribution?: number
  contributionGap?: number
  contributionGapRate?: number
  message: string
}

export interface DcaEstimateInput {
  asset: Asset
  latestAmount?: number
  asOfDate?: string | Date
}

export interface DcaPeriodInput {
  fromDate: string | Date
  targetDate: string
  frequency: DcaFrequency
  excludeWeekends?: boolean
}

export const DCA_FREQUENCY_LABELS: Record<DcaFrequency, string> = {
  daily: '每日',
  weekly: '每周',
  biweekly: '每两周',
  monthly: '每月',
  quarterly: '每季度',
}

const VALID_FREQUENCIES: DcaFrequency[] = [
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
]

const DEFAULT_TOLERANCE_RATE = 0.2
const MS_PER_DAY = 24 * 60 * 60 * 1000

export function sanitizeDcaPlan(
  assetType: AssetType,
  input: unknown,
): AssetDcaPlan | undefined {
  if (!isInvestmentType(assetType)) return undefined
  if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined

  const raw = input as Record<string, unknown>
  if (raw.enabled !== true) return undefined

  const frequency = parseFrequency(raw.frequency)
  const plannedContribution = parsePositiveNumber(raw.plannedContribution)
  if (!frequency || plannedContribution === undefined) return undefined

  const targetAmount = parsePositiveNumber(raw.targetAmount)
  const targetDate = parseDateOnly(raw.targetDate)
  const toleranceRate = parseNonNegativeNumber(raw.toleranceRate)
  const note = typeof raw.note === 'string' ? raw.note.trim() : ''

  return {
    enabled: true,
    frequency,
    ...(frequency === 'daily'
      ? { excludeWeekends: typeof raw.excludeWeekends === 'boolean' ? raw.excludeWeekends : true }
      : {}),
    plannedContribution,
    ...(targetAmount !== undefined ? { targetAmount } : {}),
    ...(targetDate ? { targetDate } : {}),
    ...(toleranceRate !== undefined ? { toleranceRate } : {}),
    ...(note ? { note } : {}),
  }
}

export function calculateDcaPeriodsRemaining({
  fromDate,
  targetDate,
  frequency,
  excludeWeekends,
}: DcaPeriodInput): number {
  const from = toUtcDateOnly(fromDate)
  const target = parseDateOnlyToUtc(targetDate)
  if (!from || !target || target.getTime() <= from.getTime()) return 0

  if (frequency === 'daily') {
    return countDailyPeriods(from, target, excludeWeekends !== false)
  }

  if (frequency === 'monthly' || frequency === 'quarterly') {
    const months = monthsRemaining(from, target)
    return frequency === 'monthly' ? months : Math.ceil(months / 3)
  }

  const days = Math.ceil((target.getTime() - from.getTime()) / MS_PER_DAY)
  return Math.ceil(days / (frequency === 'weekly' ? 7 : 14))
}

export function estimateDcaPlan({
  asset,
  latestAmount,
  asOfDate = new Date(),
}: DcaEstimateInput): DcaEstimate {
  const plan = asset.dcaPlan
  if (!plan?.enabled) {
    return insufficientData('未启用定投计划。')
  }

  if (
    plan.targetAmount === undefined ||
    !plan.targetDate ||
    !Number.isFinite(plan.plannedContribution) ||
    latestAmount === undefined ||
    !Number.isFinite(latestAmount)
  ) {
    return insufficientData('计划已保存，补充目标金额和目标日期后可估算周期投入。')
  }

  const periodsRemaining = calculateDcaPeriodsRemaining({
    fromDate: asOfDate,
    targetDate: plan.targetDate,
    frequency: plan.frequency,
    excludeWeekends: plan.excludeWeekends,
  })
  const remainingAmount = roundMoney(Math.max(plan.targetAmount - latestAmount, 0))
  const suggestedContribution = roundMoney(
    periodsRemaining > 0 ? remainingAmount / periodsRemaining : remainingAmount,
  )
  const plannedContribution = plan.plannedContribution
  const contributionGap = roundMoney(plannedContribution - suggestedContribution)
  const contributionGapRate = suggestedContribution > 0
    ? roundRatio(contributionGap / suggestedContribution)
    : 0
  const toleranceRate = plan.toleranceRate ?? DEFAULT_TOLERANCE_RATE

  if (periodsRemaining === 0 && remainingAmount > 0) {
    return {
      status: 'underfunded',
      periodsRemaining,
      remainingAmount,
      suggestedContribution,
      plannedContribution,
      contributionGap,
      contributionGapRate,
      message: '目标日期已经到达或过去，当前金额仍低于目标。',
    }
  }

  if (suggestedContribution > 0 && contributionGapRate < -toleranceRate) {
    return {
      status: 'underfunded',
      periodsRemaining,
      remainingAmount,
      suggestedContribution,
      plannedContribution,
      contributionGap,
      contributionGapRate,
      message: '计划投入低于目标倒推金额，后续可能需要提高每期投入。',
    }
  }

  if (suggestedContribution > 0 && contributionGapRate > toleranceRate) {
    return {
      status: 'overfunded',
      periodsRemaining,
      remainingAmount,
      suggestedContribution,
      plannedContribution,
      contributionGap,
      contributionGapRate,
      message: '计划投入高于目标倒推金额，可检查是否有意加速投入。',
    }
  }

  return {
    status: 'on_track',
    periodsRemaining,
    remainingAmount,
    suggestedContribution,
    plannedContribution,
    contributionGap,
    contributionGapRate,
    message: '计划投入与目标倒推金额接近。',
  }
}

function insufficientData(message: string): DcaEstimate {
  return { status: 'insufficient_data', message }
}

function parseFrequency(value: unknown): DcaFrequency | undefined {
  return typeof value === 'string' && VALID_FREQUENCIES.includes(value as DcaFrequency)
    ? value as DcaFrequency
    : undefined
}

function parsePositiveNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : undefined
}

function parseNonNegativeNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : undefined
}

function parseDateOnly(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  return parseDateOnlyToUtc(value) ? value : undefined
}

function parseDateOnlyToUtc(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return undefined

  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, monthIndex, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== monthIndex ||
    date.getUTCDate() !== day
  ) {
    return undefined
  }
  return date
}

function toUtcDateOnly(value: string | Date): Date | undefined {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()))
  }

  const dateOnly = value.includes('T') ? value.slice(0, 10) : value
  return parseDateOnlyToUtc(dateOnly)
}

function countDailyPeriods(from: Date, target: Date, excludeWeekends: boolean): number {
  let count = 0
  for (
    let cursor = new Date(from.getTime() + MS_PER_DAY);
    cursor.getTime() <= target.getTime();
    cursor = new Date(cursor.getTime() + MS_PER_DAY)
  ) {
    const day = cursor.getUTCDay()
    if (excludeWeekends && (day === 0 || day === 6)) continue
    count += 1
  }
  return count
}

function monthsRemaining(from: Date, target: Date): number {
  let months = (target.getUTCFullYear() - from.getUTCFullYear()) * 12
    + target.getUTCMonth()
    - from.getUTCMonth()
  if (target.getUTCDate() > from.getUTCDate()) months += 1
  return Math.max(months, 1)
}

function roundRatio(value: number): number {
  return Math.round(value * 10000) / 10000
}
