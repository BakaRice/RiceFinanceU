// src/domain/money.ts

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

export function formatMoney(n: number): string {
  const isNegative = n < 0
  const abs = Math.abs(n)
  const parts = abs.toFixed(2).split('.')
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${isNegative ? '-' : ''}${intPart}.${parts[1]}`
}
