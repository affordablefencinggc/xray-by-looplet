import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * SC-19 rail bounds. The collapsed Live assistant rail must stay inside the right-hand menu
 * column. It previously spanned the whole viewport, covering the workspace and the log tabs
 * underneath it.
 *
 * This is asserted against the stylesheet text because the rule is pure CSS with no reachable
 * TypeScript seam: LiveAssistant.tsx:549 sets only `left`, `top` and `width` inline from the
 * free-floating panel rect, and the collapsed geometry comes entirely from assistantPanel.css.
 * A DOM test would need a browser; this catches the regression in the unit suite instead.
 */
const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "assistantPanel.css"), "utf8");

/** Everything inside the SC-19 fence, comments included. */
function collapsedRailFence(): string {
  const start = css.indexOf("[SC-19 rail bounds] begin");
  assert.notEqual(start, -1, "the SC-19 rail bounds fence is missing from assistantPanel.css");
  const end = css.indexOf("[SC-19 rail bounds] end", start);
  assert.notEqual(end, -1, "the SC-19 rail bounds fence is not closed");
  return css.slice(start, end);
}

/**
 * The fence with `/* ... *\/` comments stripped. Assertions about what the rule *does* must read
 * declarations only: the comments deliberately name `data-assistant-rail` to explain why the rule
 * cannot use it, and a naive text search would read that explanation as the defect itself.
 */
function collapsedRailDesktopRule(): string {
  // The fence marker sits INSIDE the opening comment, so the slice starts mid-comment and its
  // leading `/*` is not present. Drop everything up to the first `*/` before stripping the rest.
  const fence = collapsedRailFence();
  const afterLead = fence.slice(fence.indexOf("*/") + 2);
  return afterLead.replace(/\/\*[\s\S]*?\*\//g, " ");
}

describe("SC-19 collapsed rail bounds", () => {
  it("sticks the collapsed rail to the column seam rather than spanning the viewport", () => {
    const rule = collapsedRailDesktopRule();
    // Anchored to BOTH edges. Given a width instead, a missing variable forces a guessed fallback
    // and the rail floats off the seam — which is what happened when it used --right-menu-width.
    assert.match(
      rule,
      /left:\s*var\(--assistant-seam-left,\s*0px\)\s*!important/,
      "the left edge must stick to the published column seam",
    );
    assert.match(rule, /right:\s*0\s*!important/, "the rail must stay pinned to the right edge");
    assert.match(rule, /width:\s*auto\s*!important/, "width must follow from both anchors, never be guessed");
    // A guessed width is the specific regression: it cannot know where the seam is.
    assert.equal(
      /width:\s*var\(--right-menu-width/.test(rule),
      false,
      "the rail must not take a width from a variable the portaled panel cannot inherit",
    );
  });

  it("degrades to the full-width rail when the seam has not been measured", () => {
    // The fallback in the var() is 0px, so a missing seam gives the old edge-to-edge rail rather
    // than a rail offset by a wrong guess. Losing the inset is recoverable; a wrong offset is not.
    assert.match(
      collapsedRailDesktopRule(),
      /var\(--assistant-seam-left,\s*0px\)/,
      "the seam fallback must be 0px so an unmeasured column degrades to full width",
    );
  });

  it("docks the OPEN panel to the same column instead of floating it", () => {
    // Opening must grow the rail upward, not turn it into a free window over the workspace. The
    // inline style carries left/top/width from the undocked panel rect, so the docked rule has to
    // override all three or the panel escapes the column the moment it opens.
    const rule = collapsedRailDesktopRule();
    const open = rule.slice(rule.indexOf(".live-assistant.is-open"));
    assert.match(open, /left:\s*var\(--assistant-seam-left,\s*0px\)\s*!important/, "the open panel must start at the seam");
    assert.match(open, /right:\s*0\s*!important/, "the open panel must reach the right edge");
    assert.match(open, /width:\s*auto\s*!important/, "the open panel must not keep the free-floating width");
    assert.match(open, /top:\s*var\(--assistant-column-top,\s*90px\)\s*!important/, "the panel must begin at the workbench top");
    assert.match(open, /bottom:\s*var\(--assistant-column-bottom,\s*0px\)\s*!important/, "the panel must reach the workbench bottom without a gap");
    assert.match(open, /border-radius:\s*0/, "the full-height panel must have square corners");
  });

  it("hides the collapsed launcher once the panel is open", () => {
    // The launcher IS the collapsed rail; the open panel's header carries the same title and the
    // close control. Rendering both stacks a second bar under the panel. It is never unmounted
    // (focus returns to it on close), so it must be hidden rather than removed.
    const rule = collapsedRailDesktopRule();
    const launcher = rule.slice(rule.indexOf(".live-assistant.is-open .live-assistant-launcher"));
    assert.match(launcher, /display:\s*none/, "the launcher must be hidden while the panel is open");
  });

  it("is not overridden by the later launcher width rule", () => {
    // Same cascade trap that already caught the column seam once: a rule for the same selector is
    // declared later in the file. It must not set `display`, or the hide above silently loses.
    const laterIndex = css.lastIndexOf(".live-assistant.is-open .live-assistant-launcher");
    const fenceEnd = css.indexOf("[SC-19 rail bounds] end");
    assert.ok(laterIndex > fenceEnd, "expected a later rule for this selector outside the fence");
    const later = css.slice(laterIndex, css.indexOf("}", laterIndex));
    assert.equal(/display\s*:/.test(later), false, "the later rule must not set display, which would undo the hide");
  });

  it("scopes the constraint to the widths where rails are actually measured", () => {
    const rule = collapsedRailDesktopRule();
    assert.match(
      rule,
      /@media\s*\(min-width:\s*941px\)/,
      "the constraint must match assistantRail.css's 941px rail breakpoint",
    );
  });

  it("does not depend on [data-assistant-rail], which is already cleared when the panel closes", () => {
    // WorkspaceRails.tsx:96 dispatches "assistant-closed" on close and nextRailState clears rail
    // mode for that action, removing the attribute and its four --assistant-rail-* variables.
    // A rule keyed off them would never apply in exactly the state this fixes.
    const rule = collapsedRailDesktopRule();
    assert.equal(
      /data-assistant-rail/.test(rule),
      false,
      "the collapsed-rail rule must not key off an attribute that is cleared before it renders",
    );
    assert.equal(
      /--assistant-rail-(left|width|top|height)/.test(rule),
      false,
      "the collapsed-rail rule must not read rail vars that are removed when the panel closes",
    );
  });

  it("restores the column seam after the launcher rule that strips both side borders", () => {
    // The generic launcher rule sets `border-left: 0` for the edge-to-edge phone layout. It is
    // declared AFTER the bounds block with equal specificity, so a seam declared inside that block
    // would silently lose the cascade and the docked rail would butt against the workspace with no
    // edge. The seam therefore has to come later in the file than that rule.
    const launcherReset = css.indexOf("border-left: 0;");
    const seam = css.indexOf("[SC-19 rail seam] begin");
    assert.notEqual(launcherReset, -1, "the launcher border reset is missing");
    assert.notEqual(seam, -1, "the SC-19 rail seam fence is missing");
    assert.ok(seam > launcherReset, "the seam must be declared after the rule that strips the borders");
    assert.match(
      css.slice(seam),
      /border-left:\s*1px solid/,
      "the docked rail must carry a left border against the workspace",
    );
  });

  it("publishes the seam on <html>, outside the rail-mode effect that clears it", () => {
    // The CSS above is inert unless something sets --assistant-seam-left on the document element.
    // Two properties matter and neither is visible from the stylesheet: the variable must be set on
    // documentElement (the panel is portaled to body, so a value on .workspace-rails cannot reach
    // it), and it must be set by an effect that does NOT depend on railMode, because rail mode is
    // already cleared in the collapsed state this styles.
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "WorkspaceRails.tsx"), "utf8");
    const start = source.indexOf("[SC-19 seam] begin");
    const end = source.indexOf("[SC-19 seam] end");
    assert.notEqual(start, -1, "the SC-19 seam publisher is missing from WorkspaceRails.tsx");
    assert.notEqual(end, -1, "the SC-19 seam fence is not closed");
    const effect = source.slice(start, end);
    assert.match(effect, /root\.style\.setProperty\(ASSISTANT_SEAM_VAR/, "the seam must be set on the document element");
    assert.match(effect, /root\.style\.removeProperty\(ASSISTANT_SEAM_VAR\)/, "the seam must be cleaned up on unmount");
    // The measured `left` for the right side is the resizer HANDLE, placed 2px inside the column so
    // the drag separator straddles the seam. Publishing it raw overlaps the menu by those 2px. The
    // rail-mode dock corrects the same way, so this must match rather than invent its own offset.
    assert.match(effect, /right\.left \+ 2/, "the seam must undo the 2px resizer-handle offset");
    assert.match(
      source,
      /left: rail\.left \+ 2/,
      "the rail-mode dock's correction must still exist, since the seam mirrors it",
    );
    // A collapsed column reports a different anchor entirely (r.right - 10), which is not a seam.
    assert.match(effect, /!r\.collapsed/, "a collapsed column must not publish a seam");
    // The dependency array must not include railMode; if it did, the value would come and go with
    // a mode the collapsed rail does not have.
    const deps = effect.slice(effect.lastIndexOf("}, ["));
    assert.equal(/railMode/.test(deps), false, "the seam effect must not depend on rail mode");
    assert.match(deps, /rects/, "the seam must be recomputed when the rails are re-measured");
  });

  it("keeps the edge-to-edge default for the undocked panel below the rail breakpoint", () => {
    // Under 941px there are no rails, so the original full-width launcher is still correct.
    assert.match(
      css,
      /\.live-assistant:not\(\.is-open\)\s*\{[^}]*left:\s*0\s*!important/,
      "the base collapsed rule should still span the viewport where no rails exist",
    );
  });
});
