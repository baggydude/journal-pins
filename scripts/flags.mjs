import { MODULE_ID } from "./constants.mjs";

/*
 * Pin data is stored under flags["journal-pins"].
 */

const { getProperty } = foundry.utils;

function flag(doc, key) {
  return getProperty(doc, `flags.${MODULE_ID}.${key}`);
}

export function getSlug(doc) {
  return flag(doc, "slug") ?? "";
}

export function getImage(doc) {
  return flag(doc, "image") || "";
}

export function getText(doc) {
  return flag(doc, "text") || "";
}

export function getShareImage(doc) {
  return flag(doc, "shareImage") ?? false;
}

export function getKeepBorder(doc) {
  return flag(doc, "keepBorder") ?? false;
}

export function getDisableAutoIcon(doc) {
  return flag(doc, "disableAutoIcon") ?? false;
}

/** The form field name for one of this module's flags. */
export function flagField(key) {
  return `flags.${MODULE_ID}.${key}`;
}
