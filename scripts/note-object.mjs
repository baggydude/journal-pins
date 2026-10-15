import { features } from "./settings.mjs";
import { getKeepBorder } from "./flags.mjs";
import { autoIconFor } from "./icons.mjs";

const { ControlIcon } = foundry.canvas.containers;

class BorderlessControlIcon extends ControlIcon {
  /** @override */
  _refresh() {
    super._refresh();
    this.bg.clear();
    this.border.visible = false;
  }
}

/**
 * Replace the Note placeable class with one that draws auto icons and borderless icons.
 * The generated icon is only used for drawing; the pin's saved texture is never changed.
 */
export function registerNoteClass() {
  const { dynamicIcons, borderRemoval } = features;
  if ( !dynamicIcons && !borderRemoval ) return;

  const Base = CONFIG.Note.objectClass;
  class JournalPinsNote extends Base {
    /** @override */
    async _draw(options) {
      this.journalPinsIcon = dynamicIcons ? await autoIconFor(this) : undefined;
      return super._draw(options);
    }

    /** @override */
    _drawControlIcon() {
      const texture = this.journalPinsIcon ?? this.document.texture.src;
      const IconClass = borderRemoval && !getKeepBorder(this.document) ? BorderlessControlIcon : ControlIcon;
      return new IconClass({ texture });
    }

    /** @override */
    _onUpdate(changed, options, userId) {
      super._onUpdate(changed, options, userId);
      // The auto icon depends on the label and flags, which core doesn't redraw for.
      if ( ["text", "flags", "entryId", "pageId"].some((k) => k in changed) ) this.renderFlags.set({ redraw: true });
    }
  }
  CONFIG.Note.objectClass = JournalPinsNote;
}
