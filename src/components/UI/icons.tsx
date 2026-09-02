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
 * Not icons, so not here: the brand mark (see StashMark), the balance ring in
 * VaultCard, and the onboarding scene art.
 */
export {
  ArrowDownIcon,
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  BrainIcon as MemoryIcon,
  // Phosphor has no "radar"; Broadcast is the concentric-sweep mark and reads
  // correctly for the scholarship deadline scanner.
  BroadcastIcon as RadarIcon,
  ChatCircleIcon as ChatIcon,
  CheckIcon,
  CopyIcon,
  LightningIcon as BoltIcon,
  LockIcon,
  PaperPlaneTiltIcon as SendIcon,
  PencilSimpleIcon as PencilIcon,
  PlusIcon,
  ReceiptIcon,
  SparkleIcon,
  StopIcon,
  TargetIcon,
  TrashIcon,
  XIcon as CloseIcon,
} from "@phosphor-icons/react";
