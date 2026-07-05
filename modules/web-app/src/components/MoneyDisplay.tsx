import type { Currency } from '../types/finance'
import { CURRENCY_SYMBOLS } from '../types/finance'

interface MoneyDisplayProps {
  value: number | undefined | null
  currency?: Currency
  /** Show + for positive values (profit display) */
  showSign?: boolean
  /** Apply profit/loss coloring */
  isProfit?: boolean
  /** Larger size for detail page main amount */
  size?: 'normal' | 'large'
  /** Show currency code after the number */
  showCurrency?: boolean
}

/**
 * Split-layered money display:
 * Symbol + Integer + .Decimal + Currency
 *
 * - Integer is the main visual element
 * - Decimal is smaller and lighter
 * - Currency code is a subdued label
 * - Profit values get +/- prefix and color
 */
export default function MoneyDisplay({
  value,
  currency,
  showSign = false,
  isProfit = false,
  size = 'normal',
  showCurrency = true,
}: MoneyDisplayProps) {
  // Empty / invalid state
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return <span className="money-display is-empty">-</span>
  }

  const isNegative = value < 0
  const abs = Math.abs(value)
  const formatted = abs.toFixed(2)
  const [intPart, decPart] = formatted.split('.')

  // Add thousand separators
  const intWithCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

  // Determine color class for profit values
  const colorClass = isProfit
    ? value > 0
      ? 'is-profit'
      : value < 0
        ? 'is-loss'
        : 'is-neutral'
    : ''

  const sizeClass = size === 'large' ? 'money-lg' : ''

  if (isProfit) {
    // Profit display: +/- sign + integer + .decimal (no currency symbol/code)
    return (
      <span className={`money-display ${colorClass} ${sizeClass}`.trim()}>
        <span className="money-symbol">{value > 0 ? '+' : value < 0 ? '-' : ''}</span>
        <span className="money-integer">{intWithCommas}</span>
        <span className="money-decimal">.{decPart}</span>
      </span>
    )
  }

  // Normal amount display: currency symbol + integer + .decimal + currency code
  const sym = currency ? CURRENCY_SYMBOLS[currency] : '¥'

  const signPrefix = showSign && value > 0 ? '+' : isNegative ? '-' : ''

  return (
    <span className={`money-display ${colorClass} ${sizeClass}`.trim()}>
      {signPrefix ? (
        <span className="money-symbol">{signPrefix}</span>
      ) : (
        <span className="money-symbol">{sym}</span>
      )}
      <span className="money-integer">{intWithCommas}</span>
      <span className="money-decimal">.{decPart}</span>
      {showCurrency && currency && (
        <span className="money-currency">{currency}</span>
      )}
    </span>
  )
}
