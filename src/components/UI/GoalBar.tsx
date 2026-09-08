import { Progress } from "@/components/shadcn/progress";

/**
 * The earmark bar for a savings goal, on the real Progress primitive — so it
 * carries role="progressbar" and a live value rather than being a decorative
 * div. Shared by the dashboard panel and the inline card the agent renders, so
 * a goal looks identical wherever it appears.
 *
 * The track and indicator are rendered *inside* the primitive and take no props
 * of their own, so they are reached with slot selectors. Kept here in app code
 * rather than patched into the vendored file, because a later `shadcn add`
 * re-pull would silently drop the patch and the bar would fall back to the
 * neutral `--primary` graphite.
 *
 * Success, not primary: a goal bar is money secured, and money is the only
 * thing in this interface allowed to carry colour.
 */
export function GoalBar({ name, pct }: { name: string; pct: number }) {
  return (
    <Progress
      value={pct}
      aria-label={`${name} progress`}
      // The track is bg-muted by default, which on a white card is a 0.96
      // lightness on a 1.0 lightness — the empty part of the bar effectively
      // disappeared in light mode, so a 0% goal read as no bar at all. A tonal
      // step off the ink works in both modes, the same way Card's own edge does.
      className="[&_[data-slot=progress-indicator]]:bg-success [&_[data-slot=progress-track]]:h-1.5 [&_[data-slot=progress-track]]:bg-foreground/10"
    />
  );
}
