// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { SettingsCard, SettingsCardSection } from '@deepseek-ai/dsh-client-ui-primitives'

afterEach(cleanup)

describe('SettingsCardSection', () => {
  it('wraps its children and accepts a layout className', () => {
    const { container } = render(
      <SettingsCardSection className="my-section">
        <span data-testid="child">card</span>
      </SettingsCardSection>,
    )
    expect(screen.getByTestId('child')).toBeDefined()
    expect(container.firstElementChild?.className).toContain('my-section')
  })
})

describe('SettingsCard', () => {
  it('renders a div by default, a li when requested', () => {
    const { rerender, container } = render(<SettingsCard>card</SettingsCard>)
    expect(container.firstElementChild?.tagName).toBe('DIV')
    rerender(<SettingsCard as="li">card</SettingsCard>)
    expect(container.firstElementChild?.tagName).toBe('LI')
  })

  it('forwards data-* hooks and the open marker', () => {
    const { container } = render(
      <SettingsCard open data-cordis-status="running">card</SettingsCard>,
    )
    const card = container.firstElementChild
    expect(card?.getAttribute('data-cordis-status')).toBe('running')
    expect(card?.hasAttribute('data-open')).toBe(true)
  })

  it('omits the open marker when closed', () => {
    const { container } = render(<SettingsCard>card</SettingsCard>)
    expect(container.firstElementChild?.hasAttribute('data-open')).toBe(false)
  })

  it('merges a content-layout className', () => {
    const { container } = render(<SettingsCard className="my-row">card</SettingsCard>)
    expect(container.firstElementChild?.className).toContain('my-row')
  })
})
