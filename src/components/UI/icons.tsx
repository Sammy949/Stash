/**
 * The app's icon vocabulary, re-exported straight from lucide-react.
 *
 * No wrappers and no hand-drawn paths: lucide's own `*Icon` exports are aliased
 * to the names the app already uses, so the 32 call sites are untouched and this
 * file adds no components at runtime. Icons therefore draw at lucide's native
 * stroke-width 2 rather than the 1.75 the old hand-drawn set used.
 *
 * Adding an icon means adding a line here, not drawing one. If lucide has no
 * suitable mark, ask before inventing one.
 *
 * Not icons, so not here: the brand mark (see StashMark), the balance ring in
 * VaultCard, and the onboarding scene art.
 */
export {
  ArrowDownIcon,
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  BrainIcon as MemoryIcon,
  CheckIcon,
  CopyIcon,
  LockIcon,
  MessageSquareIcon as ChatIcon,
  PencilIcon,
  PlusIcon,
  RadarIcon,
  ReceiptIcon,
  SendIcon,
  SparklesIcon as SparkleIcon,
  // Outline by default; the one call site fills it so it reads as "stop".
  SquareIcon as StopIcon,
  TargetIcon,
  Trash2Icon as TrashIcon,
  XIcon as CloseIcon,
  ZapIcon as BoltIcon,
} from "lucide-react";
