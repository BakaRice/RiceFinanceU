import { useRef, useCallback } from 'react'

type InputStatus = 'default' | 'modified' | 'auto-calc' | 'error'

interface MoneyInputProps {
  ariaLabel?: string
  value: string
  onChange: (value: string) => void
  unit?: string
  /** Allow negative numbers (for profit/profitRate) */
  allowNegative?: boolean
  /** Maximum decimal places, defaults to 2 */
  maxDecimals?: number
  /** Minimum value (e.g. -100 for percent) */
  minValue?: number
  placeholder?: string
  disabled?: boolean
  status?: InputStatus
}

/**
 * Financial number input that respects intermediate typing states.
 *
 * - Allows "12.", ".5", "-", "-12." during input
 * - Truncates pasted values exceeding maxDecimals (no rounding)
 * - Formats on blur: "12" → "12.00", ".5" → "0.50"
 * - Empty stays empty, never auto-fills "0.00"
 */
export default function MoneyInput({
  ariaLabel,
  value,
  onChange,
  unit,
  allowNegative = false,
  maxDecimals = 2,
  minValue,
  placeholder,
  disabled = false,
  status = 'default',
}: MoneyInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  // Validate the full string
  const isValidIntermediate = useCallback(
    (s: string): boolean => {
      if (s === '' || s === '-') return true
      // Allow trailing decimal: "12." or "-12."
      if (allowNegative) {
        if (!/^-?\d*\.?\d*$/.test(s)) return false
      } else {
        if (!/^\d*\.?\d*$/.test(s)) return false
      }
      // Check decimal places
      const dotIdx = s.indexOf('.')
      if (dotIdx >= 0) {
        const decimals = s.slice(dotIdx + 1)
        if (decimals.length > maxDecimals) return false
      }
      // Check leading zeros: allow "0", "0.", "0.1" but not "00" or "01"
      const numPart = s.startsWith('-') ? s.slice(1) : s
      if (numPart.length > 1 && numPart[0] === '0' && numPart[1] !== '.') return false
      return true
    },
    [allowNegative, maxDecimals]
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value

      // Handle paste: truncate decimals instead of rounding
      const dotIdx = raw.indexOf('.')
      if (dotIdx >= 0 && raw.slice(dotIdx + 1).length > maxDecimals) {
        const truncated = raw.slice(0, dotIdx + 1 + maxDecimals)
        if (isValidIntermediate(truncated)) {
          onChange(truncated)
        }
        return
      }

      // Validate character by character (handle paste and normal input)
      if (isValidIntermediate(raw)) {
        onChange(raw)
      }
      // If invalid, don't update (blocks illegal chars)
    },
    [onChange, isValidIntermediate, maxDecimals]
  )

  const handleBlur = useCallback(() => {
    if (value === '' || value === '-') return

    let num = Number(value)
    if (!Number.isFinite(num)) return

    // Enforce min value
    if (minValue !== undefined && num < minValue) {
      num = minValue
    }

    // Format: always show 2 decimal places on blur
    const formatted = num.toFixed(maxDecimals)
    if (formatted !== value) {
      onChange(formatted)
    }
  }, [value, onChange, maxDecimals, minValue])

  const statusClass =
    status === 'modified'
      ? 'is-modified'
      : status === 'auto-calc'
        ? 'is-auto-calc'
        : status === 'error'
          ? 'has-error'
          : ''

  return (
    <span className={`money-input-wrapper ${unit ? 'has-unit' : ''}`}>
      <input
        aria-label={ariaLabel}
        ref={inputRef}
        type="text"
        inputMode="decimal"
        className={`money-input ${statusClass}`.trim()}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
      />
      {unit && <span className="money-input-unit">{unit}</span>}
    </span>
  )
}
