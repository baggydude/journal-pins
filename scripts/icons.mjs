import { BAD_WORDS, ICON_DIR, MODULE_ID } from "./constants.mjs";
import { getDisableAutoIcon, getImage, getText } from "./flags.mjs";

/** Default icons for pins that open an image or a text passage and have no numbered label. */
const CONTENT_ICONS = {
  image: `modules/${MODULE_ID}/icons/image-pin.svg`,
  text: `modules/${MODULE_ID}/icons/text-pin.svg`
};

/** Font size for the icon text, by number of characters. */
const FONT_SIZES = { 1: 300, 2: 230, 3: 170, 4: 140 };

const knownFiles = new Set();
const pending = new Map();
let scan;

function iconSvg(stub) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"
  style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; fill-rule:evenodd; clip-rule:evenodd">
  <circle style="fill:#ffffff;stroke:#010101;stroke-width:30;stroke-miterlimit:10;" cx="250" cy="250" r="220"/>
  <text font-family='-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    font-size="${FONT_SIZES[stub.length]}" font-weight="400" fill="black" stroke="#000000"
    x="50%" y="52%" text-anchor="middle" dy=".3em">${stub}</text>
</svg>`;
}

/**
 * The short code shown on a pin's icon, e.g. "1a. Strange Door" -> "1a", "Area 07" -> "Area" and "07: Cave" -> "7".
 * @param {string} label
 * @returns {string|undefined}
 */
export function iconStub(label) {
  const stub = (label.trim().split(".")[0].split(" ")[0].split(":")[0] ?? "")
    .replaceAll(/[()[\].:'<>{}]/g, "")
    .replace(/\d+/, (digits) => String(parseInt(digits)));
  // Only letters and digits, so the stub is safe as both a file name and SVG text.
  if ( !/^[\p{L}\p{N}]{1,4}$/u.test(stub) || BAD_WORDS.includes(stub) ) return undefined;
  return stub;
}

/** The pin label without a leading "<page name>:" prefix. */
function pinLabel(note) {
  const label = note.document.label?.trim();
  if ( !label ) return undefined;
  const pageName = note.document.page?.name;
  if ( pageName && label.startsWith(`${pageName}:`) ) return label.slice(pageName.length + 1).trim();
  return label;
}

async function scanIconDir() {
  if ( !game.user.can("FILES_BROWSE") ) return;
  scan ??= foundry.applications.apps.FilePicker.implementation.browse("data", ICON_DIR)
    .then((result) => result.files.forEach((f) => knownFiles.add(f)))
    .catch((err) => console.warn("Journal Pins | Could not read icon folder", err));
  return scan;
}

async function createIcon(stub) {
  const path = `${ICON_DIR}/${stub}.svg`;
  await scanIconDir();
  if ( knownFiles.has(path) ) return path;
  // Users who can't upload get the expected path, which works once a GM has generated that icon.
  if ( !game.user.can("FILES_UPLOAD") ) return path;
  const file = new File([iconSvg(stub)], `${stub}.svg`, { type: "image/svg+xml" });
  const result = await foundry.applications.apps.FilePicker.implementation.upload("data", ICON_DIR, file, {}, { notify: false });
  const uploaded = result?.path ?? path;
  knownFiles.add(uploaded);
  return uploaded;
}

/** Path of the cached icon for a stub, creating it on first use. */
function iconPath(stub) {
  if ( !pending.has(stub) ) {
    pending.set(stub, createIcon(stub).catch((err) => {
      pending.delete(stub);
      console.error(`Journal Pins | Could not create icon for "${stub}"`, err);
      return undefined;
    }));
  }
  return pending.get(stub);
}

/**
 * The generated icon a pin should show instead of its own texture, if any.
 * @param {Note} note
 * @returns {Promise<string|undefined>}
 */
export async function autoIconFor(note) {
  const src = note.document.texture?.src;
  if ( !src || src.startsWith("blob:") || getDisableAutoIcon(note.document) ) return undefined;
  const label = pinLabel(note);
  const stub = label ? iconStub(label) : undefined;
  const contentIcon = getImage(note.document) ? CONTENT_ICONS.image
    : getText(note.document) ? CONTENT_ICONS.text
      : undefined;
  // Image and text pins are labelled from captions and excerpts, so their first word ("You", "Old") is rarely a
  // map key. Only a code with a number in it ("1a", "12") overrides their default icon.
  if ( stub && (!contentIcon || /\d/.test(stub)) ) return iconPath(stub);
  return contentIcon;
}
