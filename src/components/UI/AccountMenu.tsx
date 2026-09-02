import { useTheme, type ThemeChoice } from "@/hooks/useTheme";
import { Avatar, AvatarFallback } from "@/components/shadcn/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/shadcn/dropdown-menu";
import { MoonIcon, SunIcon, SystemThemeIcon } from "@/components/UI/icons";

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
 * The account surface: who Stash thinks you are, and how it looks.
 *
 * Deliberately NOT a sun/moon toggle — that pattern is the stock theme switch,
 * and it also cannot express "follow my system", which is the default here. A
 * radio group states all three options and shows which one is active.
 *
 * The avatar is the trigger. Its fallback is tonal initials on a muted surface,
 * never a gradient, and it sits bare on the header rather than inside a tile.
 */
export function AccountMenu({
  name,
  currency,
  memoryCount,
}: {
  /** The name Stash remembers. Empty before onboarding fills it in. */
  name: string;
  currency: string;
  /** How many things Stash currently remembers, for the one honest status line. */
  memoryCount?: number;
}) {
  const { theme, setTheme } = useTheme();
  const label = name.trim() || "You";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account and appearance"
        className="rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Avatar>
          <AvatarFallback>{initials(label)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-56">
        <div className="px-3 py-2">
          <p className="truncate text-sm font-medium text-foreground">{label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {memoryCount
              ? `${currency} · Stash remembers ${memoryCount} thing${memoryCount === 1 ? "" : "s"}`
              : `${currency} · nothing remembered yet`}
          </p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(v) => setTheme(v as ThemeChoice)}
        >
          {THEMES.map(({ value, label: l, Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon className="size-4 text-muted-foreground" />
              {l}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
