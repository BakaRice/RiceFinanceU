/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { FeedbackProvider, useFeedback } from './FeedbackContext'

function ConfirmTrigger() {
  const { confirm } = useFeedback()
  return (
    <button
      type="button"
      onClick={() => confirm({
        title: '确认保存快照',
        message: '快照时间：2026-07-11\n更新 2 项',
        confirmLabel: '保存',
      })}
    >
      打开确认
    </button>
  )
}

afterEach(() => cleanup())

describe('FeedbackProvider confirmation', () => {
  it('exposes a labelled modal dialog with explicit actions', async () => {
    render(
      <FeedbackProvider>
        <ConfirmTrigger />
      </FeedbackProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: '打开确认' }))

    expect(await screen.findByRole('dialog', { name: '确认保存快照' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '保存' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '取消' })).toBeTruthy()
    expect(screen.getByText(/快照时间：/).classList.contains('confirm-body')).toBe(true)
  })
})
