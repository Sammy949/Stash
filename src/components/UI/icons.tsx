/**
 * The app's icon set, backed by lucide-react.
 *
 * These are thin named wrappers rather than bare re-exports for one reason:
 * lucide draws at stroke-width 2 and this app draws at 1.75, so the wrapper
 * pins the weight while passing everything else through. Keeping the existing
 * `*Icon` names means all 32 call sites stayed untouched.
 *
 * Every icon here must come from a pack. If a mark is needed that lucide does
 * not have, ask rather than drawing one. The brand mark, the balance ring, and
 * the onboarding scene art are NOT icons and are deliberately still bespoke.
 */
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowUpRight,
  Brain,
  Check,
  Copy,
  Lock,
  MessageSquare,
  Pencil,
  Plus,
  Radar,
  Receipt,
  Send,
  Sparkles,
  Square,
  Target,
  Trash2,
  X,
  Zap,
  type LucideProps,
} from "lucide-react";

/** Matches the app's existing line weight; lucide's own default is 2. */
const STROKE = 1.75;

export type IconProps = LucideProps;

export const LockIcon = (props: IconProps) => (
  <Lock strokeWidth={STROKE} {...props} />
);

export const RadarIcon = (props: IconProps) => (
  <Radar strokeWidth={STROKE} {...props} />
);

export const TargetIcon = (props: IconProps) => (
  <Target strokeWidth={STROKE} {...props} />
);

export const BoltIcon = (props: IconProps) => (
  <Zap strokeWidth={STROKE} {...props} />
);

export const SendIcon = (props: IconProps) => (
  <Send strokeWidth={STROKE} {...props} />
);

/** Filled, so it reads as a stop button rather than an empty box. */
export const StopIcon = (props: IconProps) => (
  <Square fill="currentColor" strokeWidth={STROKE} {...props} />
);

export const PencilIcon = (props: IconProps) => (
  <Pencil strokeWidth={STROKE} {...props} />
);

export const TrashIcon = (props: IconProps) => (
  <Trash2 strokeWidth={STROKE} {...props} />
);

export const CheckIcon = (props: IconProps) => (
  <Check strokeWidth={STROKE} {...props} />
);

export const CloseIcon = (props: IconProps) => (
  <X strokeWidth={STROKE} {...props} />
);

export const ReceiptIcon = (props: IconProps) => (
  <Receipt strokeWidth={STROKE} {...props} />
);

export const PlusIcon = (props: IconProps) => (
  <Plus strokeWidth={STROKE} {...props} />
);

export const CopyIcon = (props: IconProps) => (
  <Copy strokeWidth={STROKE} {...props} />
);

export const SparkleIcon = (props: IconProps) => (
  <Sparkles strokeWidth={STROKE} {...props} />
);

export const ArrowDownLeftIcon = (props: IconProps) => (
  <ArrowDownLeft strokeWidth={STROKE} {...props} />
);

/** Jump-to-latest affordance on the transcript scroller. */
export const ArrowDownIcon = (props: IconProps) => (
  <ArrowDown strokeWidth={STROKE} {...props} />
);

export const ArrowUpRightIcon = (props: IconProps) => (
  <ArrowUpRight strokeWidth={STROKE} {...props} />
);

export const ChatIcon = (props: IconProps) => (
  <MessageSquare strokeWidth={STROKE} {...props} />
);

export const MemoryIcon = (props: IconProps) => (
  <Brain strokeWidth={STROKE} {...props} />
);
