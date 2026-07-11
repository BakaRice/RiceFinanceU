/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TableWorkspace from './TableWorkspace'

describe('TableWorkspace', () => {
  it('shows the table identity, dirty count, and save action', () => {
    const onPrimaryAction = vi.fn()
    render(
      <TableWorkspace
        title="资产"
        description="一行一个资产"
        dirtyCount={3}
        primaryActionLabel="保存资产"
        onPrimaryAction={onPrimaryAction}
      >
        <table><tbody><tr><td>现金</td></tr></tbody></table>
      </TableWorkspace>,
    )

    expect(screen.getByRole('heading', { name: '资产' })).toBeTruthy()
    expect(screen.getByText('一行一个资产')).toBeTruthy()
    expect(screen.getByText('3 项未保存')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '保存资产' }))
    expect(onPrimaryAction).toHaveBeenCalledTimes(1)
  })

  it('disables save while clean or saving', () => {
    const { rerender } = render(
      <TableWorkspace title="汇率" dirtyCount={0} primaryActionLabel="保存汇率">
        <div />
      </TableWorkspace>,
    )
    expect(screen.getByRole('button', { name: '保存汇率' }).hasAttribute('disabled')).toBe(true)

    rerender(
      <TableWorkspace title="汇率" dirtyCount={1} primaryActionLabel="保存中…" saving>
        <div />
      </TableWorkspace>,
    )
    expect(screen.getByRole('button', { name: '保存中…' }).hasAttribute('disabled')).toBe(true)
  })
})
