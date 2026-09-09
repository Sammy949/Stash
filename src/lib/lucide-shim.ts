/**
 * lucide-react → phosphor shim.
 *
 * The vendored shadcn components import their chevrons, checks and spinners from
 * lucide, which is stroke-only. Stash's icons are filled phosphor, and outline
 * chevrons sitting beside filled icons is exactly the mismatch this redesign is
 * meant to remove. So `lucide-react` is aliased to this module in vite.config.ts
 * (and in tsconfig paths, so the typechecker sees the same thing the bundler
 * does), and every lucide name the registry uses is mapped to its phosphor
 * equivalent here.
 *
 * These are the 16 names the 61 vendored components actually import. A future
 * `shadcn add` that reaches for a 17th fails the build with an unresolved
 * export, which is the failure mode we want: loud, not a silently mixed icon
 * set. Add the mapping and move on.
 *
 * Weight comes from the IconContext.Provider in main.tsx, same as the app's own
 * icons, so the whole interface is one weight.
 *
 * Check, X, Plus and Minus are the exceptions, and they are re-exported from
 * the app's own icon vocabulary rather than from phosphor directly. Phosphor's
 * `fill` weight for all four is a rounded square with the mark knocked out of
 * it, so under the global fill provider every vendored tick, close and add
 * control rendered as a glyph inside a filled tile: the theme and currency
 * radio items, the checkbox, the command list, and every dialog's close button.
 * icons.tsx carries the corrected (bold) versions; pointing at it means there
 * is ONE definition and the two cannot drift apart again.
 */
export {
  CheckIcon,
  CloseIcon as XIcon,
  MinusIcon,
  PlusIcon,
} from "@/components/UI/icons";

export {
  ArrowDownIcon,
  CaretDownIcon as ChevronDownIcon,
  CaretLeftIcon as ChevronLeftIcon,
  CaretRightIcon as ChevronRightIcon,
  CaretUpIcon as ChevronUpIcon,
  CheckCircleIcon as CircleCheckIcon,
  DotsThreeIcon as MoreHorizontalIcon,
  InfoIcon,
  MagnifyingGlassIcon as SearchIcon,
  // lucide's Loader2 is a spinner arc; phosphor's Spinner is the same idea.
  SpinnerIcon as Loader2Icon,
  // lucide's PanelLeft is a sidebar toggle.
  SidebarSimpleIcon as PanelLeftIcon,
  WarningIcon as TriangleAlertIcon,
  WarningOctagonIcon as OctagonXIcon,
} from "@phosphor-icons/react";
