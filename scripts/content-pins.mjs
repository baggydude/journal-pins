import { DRAG_MIME, MODULE_ID } from "./constants.mjs";
import { features } from "./settings.mjs";
import { getImage, getShareImage, getSlug, getText } from "./flags.mjs";

const HIGHLIGHT_NAME = MODULE_ID;
const HIGHLIGHT_DURATION = 10000;
let highlightTimeout;

/* -------------------------------------------- */
/*  Dragging out of journal pages               */
/* -------------------------------------------- */

function truncate(text, length = 40) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > length ? `${flat.slice(0, length - 1).trimEnd()}…` : flat;
}

function imageLabel(img) {
  const caption = img.closest("figure")?.querySelector("figcaption")?.textContent;
  const fileName = decodeURIComponent((img.getAttribute("src") ?? "").split("/").pop().split("?")[0]);
  return truncate(caption || img.alt || img.title || fileName);
}

/**
 * Find the journal page a drag started in. Only pages shown in a journal's normal reading view count; page
 * editors are separate windows and keep their usual drag behaviour.
 * @returns {JournalEntryPage|undefined}
 */
function pageForElement(element) {
  const pageElement = element.closest(".journal-entry-page[data-page-id]");
  if ( !pageElement ) return undefined;
  const app = foundry.applications.instances.get(pageElement.closest(".application")?.id);
  if ( !(app instanceof foundry.applications.sheets.journal.JournalEntrySheet) ) return undefined;
  return app.document.pages.get(pageElement.dataset.pageId);
}

function onDragStart(event) {
  if ( !canvas.ready || !game.user.can("NOTE_CREATE") ) return;
  const target = event.target instanceof Text ? event.target.parentElement : event.target;
  if ( !(target instanceof HTMLElement) ) return;
  // Leave content links, the table of contents and anything editable to their own drag handlers.
  if ( target.closest(".toc, .content-link, [contenteditable='true']") ) return;
  const page = pageForElement(target);
  if ( !page ) return;

  let payload;
  if ( target instanceof HTMLImageElement ) {
    payload = { image: target.getAttribute("src"), label: imageLabel(target) };
  } else {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if ( !text || !target.closest(".journal-entry-page")?.contains(selection.anchorNode) ) return;
    payload = { text, label: truncate(text) };
  }
  // A custom type leaves the normal text/plain data alone, so dropping into chat or an editor still works as usual.
  event.dataTransfer.setData(DRAG_MIME, JSON.stringify({ uuid: page.uuid, ...payload }));
  // Core cancels any drag that doesn't start on an element marked draggable="true", which rules out both page
  // images and selected text. This listener runs first (window, capture phase), so stopping the event here keeps
  // it away from that check.
  event.stopPropagation();
}

/* -------------------------------------------- */
/*  Dropping onto the canvas                    */
/* -------------------------------------------- */

/**
 * Open the new-pin dialog for a page, the same way core does for dropped pages, with extra pin data filled in.
 */
async function createPin(event, { x, y }, { uuid, label, slug, image, text }) {
  const page = await fromUuid(uuid);
  if ( !page ) return;
  let entry = page.parent;
  if ( entry.inCompendium ) entry = await JournalEntry.implementation.create(game.journal.fromCompendium(entry));

  const layer = canvas.notes;
  let origin = { x, y };
  if ( !event.shiftKey ) origin = layer.getSnappedPoint(origin);
  if ( !canvas.dimensions.rect.contains(origin.x, origin.y) ) return;

  const pinFlags = {};
  if ( slug ) pinFlags.slug = slug;
  if ( image ) pinFlags.image = image;
  if ( text ) pinFlags.text = text;

  const noteData = foundry.utils.mergeObject({
    x: origin.x,
    y: origin.y,
    sort: Math.max(layer.getMaxSort() + 1, 0)
  }, layer.paletteCreateData);
  Object.assign(noteData, {
    entryId: entry.id,
    pageId: page.id,
    text: label ?? "",
    flags: { [MODULE_ID]: pinFlags }
  });
  return layer._createPreview(noteData, { top: event.clientY - 20, left: event.clientX + 40 });
}

/**
 * The image page behind a dropped journal link: an image page itself, or a journal entry whose only page is an image.
 * Compendium links resolve to index entries without page data, so they are left to core.
 * @returns {JournalEntryPage|undefined}
 */
function droppedImagePage(data) {
  if ( !["JournalEntryPage", "JournalEntry"].includes(data.type) || !data.uuid ) return undefined;
  const doc = fromUuidSync(data.uuid, { strict: false });
  const page = (doc instanceof JournalEntry) && (doc.pages.size === 1) ? doc.pages.contents[0] : doc;
  if ( !(page instanceof JournalEntryPage) || (page.type !== "image") || !page.src ) return undefined;
  return page;
}

function onDropCanvasData(_canvas, data, event) {
  const raw = features.contentPins ? event?.dataTransfer?.getData(DRAG_MIME) : "";
  if ( raw ) {
    let pin;
    try {
      pin = JSON.parse(raw);
    } catch {
      return;
    }
    createPin(event, data, pin);
    return false;
  }
  // Headings dragged from a journal's table of contents.
  if ( features.anchorLinks && (data.type === "JournalEntryPage") && data.anchor?.slug ) {
    createPin(event, data, { uuid: data.uuid, slug: data.anchor.slug, label: data.anchor.name });
    return false;
  }
  // Links to image pages (handouts) make image pins, the same as dragging the picture out of the open page.
  const imagePage = features.contentPins ? droppedImagePage(data) : undefined;
  if ( imagePage ) {
    createPin(event, data, { uuid: imagePage.uuid, image: imagePage.src, label: imagePage.name });
    return false;
  }
}

/* -------------------------------------------- */
/*  Double-clicking a pin                       */
/* -------------------------------------------- */

async function showImage(note, src) {
  const { page } = note.document;
  const popout = new foundry.applications.apps.ImagePopout({
    src,
    uuid: page?.uuid,
    window: { title: note.document.label || page?.name }
  });
  await popout.render({ force: true });
  if ( game.user.isGM && getShareImage(note.document) ) popout.shareImage();
}

/**
 * Find text within an element, ignoring whitespace (a selection's text has line breaks between paragraphs that
 * the page's text nodes don't).
 * @returns {Range|undefined}
 */
function findText(root, text) {
  const wanted = text.replace(/\s+/g, "");
  if ( !wanted ) return undefined;
  const chars = [];
  const positions = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for ( let node = walker.nextNode(); node; node = walker.nextNode() ) {
    const value = node.nodeValue;
    for ( let i = 0; i < value.length; i++ ) {
      if ( /\s/.test(value[i]) ) continue;
      chars.push(value[i]);
      positions.push([node, i]);
    }
  }
  const haystack = chars.join("");
  let index = haystack.indexOf(wanted);
  if ( index === -1 ) index = haystack.toLowerCase().indexOf(wanted.toLowerCase());
  if ( index === -1 ) return undefined;
  const [startNode, startOffset] = positions[index];
  const [endNode, endOffset] = positions[index + wanted.length - 1];
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset + 1);
  return range;
}

function highlight(range) {
  if ( globalThis.CSS?.highlights ) {
    CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(range));
    clearTimeout(highlightTimeout);
    highlightTimeout = setTimeout(() => CSS.highlights.delete(HIGHLIGHT_NAME), HIGHLIGHT_DURATION);
  } else {
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

async function showText(note, options, text) {
  const { entry, page } = note.document;
  const sheet = entry.sheet;
  await sheet.render({ force: true, ...options });
  const pageElement = sheet.element?.querySelector(`.journal-entry-page[data-page-id="${page?.id}"]`);
  const range = pageElement ? findText(pageElement, text) : undefined;
  if ( !range ) {
    ui.notifications.warn("JournalPins.Notifications.TextNotFound", { localize: true });
    return;
  }
  range.startContainer.parentElement?.scrollIntoView({ block: "center" });
  highlight(range);
}

function onActivateNote(note, options) {
  const doc = note.document;
  if ( features.anchorLinks ) {
    const slug = getSlug(doc);
    if ( slug ) options.anchor = slug;
  }
  if ( !features.contentPins ) return;

  const image = getImage(doc);
  if ( image ) {
    showImage(note, image);
    return false;
  }
  const text = getText(doc);
  if ( text && doc.page ) {
    showText(note, options, text);
    return false;
  }
}

/* -------------------------------------------- */

export function registerContentPinHooks() {
  Hooks.on("dropCanvasData", onDropCanvasData);
  Hooks.on("activateNote", onActivateNote);
}

export function registerDragListener() {
  if ( features.contentPins ) window.addEventListener("dragstart", onDragStart, { capture: true });
}
