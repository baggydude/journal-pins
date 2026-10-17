export const MODULE_ID = "journal-pins";

/** Folder (in the "data" file source) where generated pin icons are cached. */
export const ICON_DIR = `modules/${MODULE_ID}/storage`;

/** Drag-data type used for images and text dragged out of journal pages. */
export const DRAG_MIME = "application/x-journal-pins+json";

export const SETTINGS = {
  ANCHOR_LINKS: "enable-anchor-links",
  DYNAMIC_ICONS: "enable-dynamic-icons",
  ICON_BORDER_REMOVAL: "enable-icon-border-removal",
  CONTENT_PINS: "enable-content-pins",
  PAGE_POPOUT: "enable-page-popout"
};

/** Leading words that should never become an auto icon. */
export const BAD_WORDS = ["The", "At", "Who", "the"];
