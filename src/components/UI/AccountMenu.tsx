import type { Currency } from "@/types";
import { CURRENCY_LIST } from "@/lib/currency";
import { useTheme, type ThemeChoice } from "@/hooks/useTheme";
import { Avatar, AvatarFallback } from "@/components/shadcn/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/shadcn/dropdown-menu";
import { BuildBadge } from "@/components/UI/BuildBadge";
import {
  CloudArrowUpIcon,
  MoonIcon,
  SparkleIcon,
  SunIcon,
  SystemThemeIcon,
  WalletIcon,
} from "@/components/UI/icons";

/**
 * Two initials from a name (or an email local-part), for the avatar fallback.
 * Deliberately tonal, never a gradient circle.
 */
export function initials(nameOrEmail: string): string {
  const base = nameOrEmail.includes("@")
    ? nameOrEmail.split("@")[0]
    : nameOrEmail;
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  const letters =
    parts.length >= 2
      ? parts[0][0] + parts[parts.length - 1][0]
      : base.slice(0, 2);
  return letters.toUpperCase() || "S";
}

const THEMES: { value: ThemeChoice; label: string; Icon: typeof SunIcon }[] = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
  { value: "system", label: "System", Icon: SystemThemeIcon },
];

/**
 * The account surface: who Stash thinks you are, and the few settings that are
 * real.
 *
 * Every row here does something today. There is no profile page, no
 * notifications, no billing, no language picker, because none of those exist to
 * configure. The wallet row is the one exception and it says so: disabled, with
 * the reason, rather than a control that looks live and is not.
 *
 * Theme is a radio group rather than a sun/moon toggle. That pattern is the
 * stock switch, and more usefully it cannot express "follow my system", which is
 * the default here.
 */
export function AccountMenu({
  name,
  currency,
  memoryCount,
  onCurrencyChange,
  onSync,
  syncing = false,
  onStartFresh,
}: {
  /** The name Stash remembers. Empty before onboarding fills it in. */
  name: string;
  currency: Currency;
  /** How many things Stash currently remembers, for the one honest status line. */
  memoryCount?: number;
  onCurrencyChange?: (next: Currency) => void;
  onSync?: () => void;
  syncing?: boolean;
  /** Clear the transcript. Memory is untouched, which the label says out loud. */
  onStartFresh?: () => void;
}) {
  const { theme, setTheme } = useTheme();
  const label = name.trim() || "You";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account and settings"
        className="rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Avatar>
          <AvatarFallback>{initials(label)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="min-w-60">
        <div className="px-3 py-2">
          <p className="truncate text-sm font-medium text-foreground">{label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {memoryCount
              ? `Stash remembers ${memoryCount} thing${memoryCount === 1 ? "" : "s"}`
              : "Nothing remembered yet"}
          </p>
        </div>

        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(v) => setTheme(v as ThemeChoice)}
        >
          {/* Inside the RadioGroup, not beside it: GroupLabel reads
              MenuGroupContext, which only Group and RadioGroup provide. Outside,
              it throws and takes the whole popup down with it. */}
          <DropdownMenuLabel>Appearance</DropdownMenuLabel>
          {THEMES.map(({ value, label: l, Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon className="size-4 text-muted-foreground" />
              {l}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        {onCurrencyChange && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                Currency
                <span className="font-data ml-auto pr-1 text-xs text-muted-foreground">
                  {currency}
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-52">
                <DropdownMenuRadioGroup
                  value={currency}
                  onValueChange={(v) => onCurrencyChange(v as Currency)}
                >
                  {CURRENCY_LIST.map((c) => (
                    <DropdownMenuRadioItem key={c.code} value={c.code}>
                      <span className="font-data w-8 text-muted-foreground">
                        {c.symbol}
                      </span>
                      {c.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}

        <DropdownMenuSeparator />
        {onSync && (
          <DropdownMenuItem onClick={onSync} disabled={syncing}>
            <CloudArrowUpIcon className="size-4 text-muted-foreground" />
            {syncing ? "Backing up…" : "Back up to 0G"}
          </DropdownMenuItem>
        )}
        {onStartFresh && (
          <DropdownMenuItem onClick={onStartFresh}>
            <SparkleIcon className="size-4 text-muted-foreground" />
            New conversation
          </DropdownMenuItem>
        )}
        {/* Disabled on purpose rather than hidden: it tells you what is coming
            without pretending to work. Wallet connect is the next milestone. */}
        <DropdownMenuItem disabled>
          <WalletIcon className="size-4" />
          Connect wallet
          <span className="ml-auto pl-3 text-[10px] text-muted-foreground">
            Soon
          </span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <div className="px-3 py-1.5">
          <BuildBadge clock />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
