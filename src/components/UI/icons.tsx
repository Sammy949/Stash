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
import { CheckIcon as PhosphorCheckIcon } from "@phosphor-icons/react";
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
  LightningIcon as BoltIcon,
  LockIcon,
  MoonIcon,
  PaperPlaneTiltIcon as SendIcon,
  PencilSimpleIcon as PencilIcon,
  PlusIcon,
  ReceiptIcon,
  SparkleIcon,
  StopIcon,
  SunIcon,
  TargetIcon,
  TrashIcon,
  WalletIcon,
  XIcon as CloseIcon,
} from "@phosphor-icons/react";

/**
 * The one documented exception to "weight comes from the provider".
 *
 * Phosphor's `fill` weight for Check is not a heavier checkmark: it is a
 * ROUNDED SQUARE with the check knocked out of it (verified in the package
 * source, `defs/Check.es.js` — the fill path opens `M216,40H40A16,16,...`).
 * Under the global fill provider, every "done" tick in the app therefore
 * rendered as a mark sitting in a filled box, which is the component-kit look
 * this design explicitly refuses.
 *
 * `bold` is the heaviest weight that still draws the bare stroke, so the tick
 * keeps the presence the fill provider was chosen for without the container.
 * Check is the only bare mark in our vocabulary that does this — Plus, X and
 * Minus have no container at fill weight, so they are plain re-exports.
 */
export function CheckIcon(props: ComponentProps<typeof PhosphorCheckIcon>) {
  return <PhosphorCheckIcon weight="bold" {...props} />;
}
