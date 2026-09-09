/**
 * The app's icon vocabulary, re-exported from @phosphor-icons/react.
 *
 * No wrappers and no hand-drawn paths. Weight is set once for the whole tree by
 * the IconContext.Provider in main.tsx (`fill`), so these are pure aliases and
 * add nothing at runtime. An icon can still opt out by passing `weight` itself,
 * which beats the context.
 *
 * Adding an icon means adding a line here. If phosphor has no suitable mark,
 * ask rather than drawing one.
 *
 * Not icons, so not here: the brand mark (see StashMark), the balance trace in
 * BalanceInstrument (data visualisation), and the onboarding scene art.
 */
import {
  CheckIcon as PhosphorCheckIcon,
  MinusIcon as PhosphorMinusIcon,
  PlusIcon as PhosphorPlusIcon,
  XIcon as PhosphorXIcon,
} from "@phosphor-icons/react";
import type { ComponentProps } from "react";

export {
  ArrowDownIcon,
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  BrainIcon as MemoryIcon,
  // Phosphor has no "radar"; Broadcast is the concentric-sweep mark and reads
  // correctly for the scholarship deadline scanner.
  BroadcastIcon as RadarIcon,
  CaretDownIcon,
  ChatCircleIcon as ChatIcon,
  CircleHalfIcon as SystemThemeIcon,
  CloudArrowUpIcon,
  CopyIcon,
  // Sand mostly run through, which is the runway warning exactly: not "time
  // exists" but "time is nearly out". Its `fill` weight is the hourglass itself
  // (`M200,75.64V40…`), not the knocked-out tile the four marks below carry, so
  // it is safe under the global fill provider — checked in defs/HourglassLow.
  HourglassLowIcon as RunwayIcon,
  LightningIcon as BoltIcon,
  LockIcon,
  MoonIcon,
  PaperPlaneTiltIcon as SendIcon,
  PencilSimpleIcon as PencilIcon,
  ReceiptIcon,
  SparkleIcon,
  StopIcon,
  SunIcon,
  TargetIcon,
  TrashIcon,
} from "@phosphor-icons/react";

/**
 * The documented exceptions to "weight comes from the provider".
 *
 * Phosphor's `fill` weight for these marks is not a heavier stroke: it is a
 * ROUNDED SQUARE with the mark knocked out of it. Under the global fill
 * provider they therefore render as an icon sitting in a filled tile, which is
 * the component-kit look this design explicitly refuses.
 *
 * Verified in the package source, and it is FOUR marks, not one — every path
 * below opens with the same square:
 *   defs/Check.es.js  fill: `M216,40H40A16,16,...`
 *   defs/X.es.js      fill: `M208,32H48A16,16,...`
 *   defs/Plus.es.js   fill: `M208,32H48A16,16,...`
 *   defs/Minus.es.js  fill: `M208,32H48A16,16,...`
 * This comment used to claim X, Plus and Minus were safe and re-export them
 * raw, so the Manage sheet's close and add buttons were shipping a white tile
 * with the glyph cut out of it.
 *
 * `bold` is the heaviest weight that still draws the bare mark, so each keeps
 * the presence the fill provider was chosen for without the container.
 */
export function CheckIcon(props: ComponentProps<typeof PhosphorCheckIcon>) {
  return <PhosphorCheckIcon weight="bold" {...props} />;
}

export function CloseIcon(props: ComponentProps<typeof PhosphorXIcon>) {
  return <PhosphorXIcon weight="bold" {...props} />;
}

export function PlusIcon(props: ComponentProps<typeof PhosphorPlusIcon>) {
  return <PhosphorPlusIcon weight="bold" {...props} />;
}

export function MinusIcon(props: ComponentProps<typeof PhosphorMinusIcon>) {
  return <PhosphorMinusIcon weight="bold" {...props} />;
}
