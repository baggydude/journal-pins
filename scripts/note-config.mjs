import { features } from "./settings.mjs";
import {
  flagField, getDisableAutoIcon, getImage, getKeepBorder, getShareImage, getSlug, getText
} from "./flags.mjs";

const { escapeHTML } = foundry.utils;

function checkboxGroup(key, label, checked, hint = "") {
  return `<div class="form-group" data-journal-pins>
    <label>${game.i18n.localize(label)}</label>
    <div class="form-fields">
      <input type="checkbox" name="${flagField(key)}" ${checked ? "checked" : ""}>
    </div>
    ${hint ? `<p class="hint">${game.i18n.localize(hint)}</p>` : ""}
  </div>`;
}

function slugOptions(page, current) {
  let options = "<option></option>";
  for ( const heading of Object.values(page?.toc ?? {}) ) {
    const selected = heading.slug === current ? " selected" : "";
    options += `<option value="${escapeHTML(heading.slug)}"${selected}>${escapeHTML(heading.text)}</option>`;
  }
  return options;
}

function selectedPage(form) {
  const entry = game.journal.get(form.elements.entryId?.value);
  return entry?.pages.get(form.elements.pageId?.value);
}

function injectSlugField(form, doc) {
  const pageGroup = form.elements.pageId?.closest(".form-group");
  if ( !pageGroup ) return;
  pageGroup.insertAdjacentHTML("afterend", `<div class="form-group" data-journal-pins>
    <label>${game.i18n.localize("JournalPins.Labels.JumpToAnchor")}</label>
    <div class="form-fields">
      <select name="${flagField("slug")}">${slugOptions(doc.page, getSlug(doc))}</select>
    </div>
  </div>`);

  // Refresh the heading list when a different journal or page is picked. Core has already updated the page list
  // by the time this runs because its form listener was attached first. The form element survives re-renders,
  // so the listener is only attached once.
  if ( form.dataset.journalPinsListener ) return;
  form.dataset.journalPinsListener = "true";
  form.addEventListener("change", (event) => {
    if ( !["entryId", "pageId"].includes(event.target.name) ) return;
    const select = form.elements[flagField("slug")];
    if ( select ) select.innerHTML = slugOptions(selectedPage(form), select.value);
  });
}

function injectIconFields(form, doc) {
  const iconFieldset = form.elements["icon.selected"]?.closest("fieldset");
  if ( !iconFieldset ) return;
  let html = "";
  if ( features.dynamicIcons ) {
    html += checkboxGroup("disableAutoIcon", "JournalPins.Labels.DisableAutoIcon", getDisableAutoIcon(doc));
  }
  if ( features.borderRemoval ) {
    html += checkboxGroup("keepBorder", "JournalPins.Labels.ShowIconBorder", getKeepBorder(doc));
  }
  iconFieldset.insertAdjacentHTML("beforeend", html);
}

function injectContentFields(form, doc) {
  const contentFieldset = form.elements.pageId?.closest("fieldset");
  if ( !contentFieldset ) return;
  const i18n = (key) => game.i18n.localize(`JournalPins.Labels.${key}`);
  contentFieldset.insertAdjacentHTML("afterend", `<fieldset data-journal-pins>
    <legend>${i18n("PinOpens")}</legend>
    <div class="form-group">
      <label>${i18n("Image")}</label>
      <div class="form-fields">
        <file-picker name="${flagField("image")}" type="image" value="${escapeHTML(getImage(doc))}"></file-picker>
      </div>
      <p class="hint">${i18n("ImageHint")}</p>
    </div>
    ${checkboxGroup("shareImage", "JournalPins.Labels.ShareImage", getShareImage(doc), "JournalPins.Labels.ShareImageHint")}
    <div class="form-group stacked">
      <label>${i18n("Text")}</label>
      <textarea class="journal-pins-text" name="${flagField("text")}">${escapeHTML(getText(doc))}</textarea>
      <p class="hint">${i18n("TextHint")}</p>
    </div>
  </fieldset>`);
}

export function registerNoteConfigHooks() {
  Hooks.on("renderNoteConfig", (app) => {
    const form = app.form;
    // Each render replaces the form body, so the fields are added again every time.
    if ( !form || form.querySelector("[data-journal-pins]") ) return;
    const doc = app.document;
    if ( features.anchorLinks ) injectSlugField(form, doc);
    injectIconFields(form, doc);
    if ( features.contentPins ) injectContentFields(form, doc);
    app.setPosition({ height: "auto" });
  });
}
