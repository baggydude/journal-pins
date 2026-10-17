import { MODULE_ID, SETTINGS } from "./constants.mjs";

const DEFINITIONS = {
  [SETTINGS.ANCHOR_LINKS]: { key: "EnableAnchorLinks", default: true },
  [SETTINGS.DYNAMIC_ICONS]: { key: "EnableDynamicIcons", default: true },
  [SETTINGS.ICON_BORDER_REMOVAL]: { key: "EnableIconBorderRemoval", default: false },
  [SETTINGS.CONTENT_PINS]: { key: "EnableContentPins", default: true },
  [SETTINGS.PAGE_POPOUT]: { key: "EnablePagePopout", default: true }
};

export function registerSettings() {
  for ( const [name, def] of Object.entries(DEFINITIONS) ) {
    game.settings.register(MODULE_ID, name, {
      name: `JournalPins.Settings.${def.key}.Name`,
      hint: `JournalPins.Settings.${def.key}.Hint`,
      scope: "world",
      config: true,
      type: Boolean,
      default: def.default,
      requiresReload: true
    });
  }
}

function setting(name) {
  return game.settings.get(MODULE_ID, name);
}

/** Features which overlap with other modules switch themselves off when those modules are active. */
export const features = {
  get anchorLinks() {
    return setting(SETTINGS.ANCHOR_LINKS)
      && !game.modules.get("jal")?.active
      && !game.modules.get("ddb-importer")?.active;
  },
  get dynamicIcons() {
    return setting(SETTINGS.DYNAMIC_ICONS);
  },
  get borderRemoval() {
    return setting(SETTINGS.ICON_BORDER_REMOVAL)
      && !game.modules.get("backgroundless-pins")?.active
      && !game.modules.get("pin-cushion")?.active;
  },
  get contentPins() {
    return setting(SETTINGS.CONTENT_PINS);
  },
  get pagePopout() {
    return setting(SETTINGS.PAGE_POPOUT)
      && !game.modules.get("journal-page-popout")?.active;
  }
};
