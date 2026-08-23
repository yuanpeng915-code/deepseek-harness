import clsx from 'clsx'
import type { ReactNode } from 'react'
import css from './SettingsCard.module.css'

/** `data-*` hooks the card chrome may forward (e.g. per-status CSS selectors). */
type SettingsCardData = { [key: `data-${string}`]: string | number | boolean | undefined }

/**
 * Settings-panel width cap and column rhythm for a plugin-configuration card
 * list. Feature packages compose their cards inside this container so column
 * width and vertical spacing stay consistent across the Settings → Plugins
 * tabs.
 * @param props - className override and card children.
 * @returns the section container.
 */
export function SettingsCardSection({ className, children }: {
  className?: string | undefined
  children: ReactNode
}) {
  return <div className={clsx(css.section, className)}>{children}</div>
}

/**
 * Shared chrome for one plugin-configuration card: border, radius, and surface
 * tokens, plus an `open` highlight. Content layout (padding, internal gaps,
 * header/body structure) stays with the consuming feature.
 * @param props - element tag, open highlight, content-layout className, and
 *   forwarded `data-*` hooks.
 * @returns the card element.
 */
export function SettingsCard({ as = 'div', open = false, className, children, ...data }: {
  as?: 'div' | 'li'
  open?: boolean
  className?: string | undefined
  children: ReactNode
} & SettingsCardData) {
  const Tag = as as 'div'
  return <Tag {...data} data-open={open || undefined} className={clsx(css.card, open && css.cardOpen, className)}>{children}</Tag>
}
