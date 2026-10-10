# Trackaa design system

Paylead-inspired: deep-teal **ink**, **neon** green for the one thing to press, warm **paper** background, flat white cards, and hard offset shadows instead of blurry elevation. Tokens live in `src/app/globals.css`; components live in `src/components/ui.tsx`. Pages compose the kit. If a page needs something the kit lacks, add it to the kit, not inline.

## Colour

| Token (Tailwind) | Use |
| --- | --- |
| `bg-bg` paper | page background |
| `bg-surface` | cards, sheets, inputs |
| `bg-surface-2` | sunken: tracks, idle icon tiles, wells, hover |
| `border-line` | hairlines, idle borders |
| `text-ink` / `bg-hero` | text; ink panels (hero, sidebar, active glyphs, selected chips) |
| `text-muted`, `text-subtle` | secondary text; placeholders and tertiary |
| `bg-brand` neon + `text-brand-ink` | primary action, active tab on ink, progress fill, earned/achieved |
| `text-income` / `text-expense` | money in / money out values only |
| `warn` | "spending fast" and at-risk states only |

Never use:
- raw hex values or Tailwind palette colours (`orange-500`, `#f97316`);
- a colour per category;
- blue for transfers. Transfers are neutral (`text-muted`, `TransferIcon`).

Status is always words plus an icon (`Tag`, `ToneTag`), never colour alone. For share-of-total bars use `SHARE_RAMP` from `lib/visuals` (biggest slice darkest).

## Shape

There are only four radii:

| Class | Size | Use |
| --- | --- | --- |
| `rounded-tile` | 12px | icon tiles, tags, small wells |
| `rounded-control` | 14px | buttons, inputs, segmented tracks, row highlights |
| `rounded-card` | 20px | cards |
| `rounded-sheet` | 28px | sheets, dialogs, hero |

Pills (`rounded-full`) are for chips, tags, toggles and progress bars only. Do not use `rounded-xl/2xl/3xl` or `rounded-[…]`.

## Depth

- Cards are flat: `border border-line bg-surface`. There is no `shadow-card` or `shadow-float`.
- Hard shadows (`.pop`, `shadow-hard`, `shadow-hard-lg`) mark the one thing to press, or something floating (toast, tooltip, desktop sheet, celebration).
- The neon offset shadow is reserved for `IconTile`.

## Type

- **Display** (Bricolage, `font-display`): page titles (`PageHeader`, 34px/800), section titles (`SectionTitle`, 19px/700), sheet titles, and every money figure (`Num`, `Stat`, hero numbers).
- **Body** (Inter): 15px row titles (semibold), 12.5–13px meta (`text-muted`).
- **Eyebrow** (`.eyebrow` / `Eyebrow`): 11.5px uppercase labels above figures and sections.

## Components (`ui.tsx`)

| Area | Components |
| --- | --- |
| Layout | `PageHeader` (eyebrow, title, actions, back link), `SectionTitle` (title, hint, action), `SectionLink`, `Card` (tones: default, ink, sunken, dashed, brand; `flush` for lists), `LinkCard`, `ListCard` + `ListRow` |
| Figures | `Stat`, `Num` |
| Status | `Tag` (neutral, good, warn, bad, brand, ink), `ProgressBar` (tones: brand, good, warn, bad, ink; optional pace tick), `ToneTag` / `Meter` from `charts.tsx` for budgets |
| Controls | `Button` (primary = neon pop, ink, secondary = outline, danger = outline coral, ghost), `buttonClass()` for links, `IconButton`, `Chip` (active = ink), `Segmented` (`onDark` on ink panels), `Input`, `Select`, `Field`, `Label`, `Toggle` |
| Overlays | `Sheet`, toast (`useToast`) |
| Feedback | `Callout` (info, warn, bad), `ErrorBox`, `FormError`, `Skeleton`, `Spinner`, `EmptyState` |
| Icons | `Glyph` (list icon: sunken tile, ink glyph; `active` = ink tile with neon glyph), `Monogram`, `IconTile` (featured: tilted ink tile with neon shadow; empty states, badges and celebrations only) |

Category icons come from `categoryIcon(name)` and render in a `Glyph`. Accounts use `ACCOUNT_ICON`.

Button choice:
- One primary (neon) action per view.
- Use secondary for the rest.
- Use ink for a strong action inside an already-neon context.
