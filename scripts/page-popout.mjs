import { MODULE_ID } from "./constants.mjs";
import { features } from "./settings.mjs";

const { ApplicationV2 } = foundry.applications.api;

/**
 * One journal page in a window of its own. The page is drawn by its own view sheet inside the same wrappers a
 * journal uses, so it looks the same as it does in the journal. Links clicked in it open in the journal, so the
 * popout stays where it is.
 */
export class PagePopout extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    classes: ["journal-sheet", "journal-entry", "journal-pins-popout"],
    window: {
      icon: "fa-solid fa-up-right-from-square",
      resizable: true
    },
    position: {
      width: 640,
      height: 720
    }
  };

  /**
   * @param {JournalEntryPage} page
   * @param {object} [options]
   */
  constructor(page, options={}) {
    super({ ...options, id: PagePopout.idFor(page) });
    this.page = page;
  }

  /** The page's own view sheet, which renders its content. */
  #sheet;

  static idFor(page) {
    return `${MODULE_ID}-popout-${page.id}`;
  }

  /** @override */
  get title() {
    return this.page.name;
  }

  /** @override */
  async _renderHTML() {
    const sheetClass = this.page._getSheetClass();
    this.#sheet ??= new sheetClass({
      id: `${this.id}-view`,
      tag: "div",
      document: this.page,
      mode: "view",
      window: { frame: false, positioned: false }
    });
    await this.#sheet.render({ force: true });

    const article = document.createElement("article");
    article.className = ["journal-entry-page", this.page.type, `level${this.page.title.level}`,
      ...(this.#sheet.options.viewClasses ?? [])].join(" ");
    article.dataset.pageId = this.page.id;
    article.replaceChildren(...this.#sheet.element.children);

    const pages = document.createElement("div");
    pages.className = "journal-entry-pages scrollable locked";
    pages.append(article);

    const content = document.createElement("section");
    content.className = "journal-entry-content flexcol";
    content.append(pages);
    return content;
  }

  /** @override */
  _replaceHTML(result, content) {
    content.replaceChildren(result);
  }
}

/**
 * Open a page in its own window, or bring its window to the front if it's already open.
 * @param {JournalEntryPage|undefined} page
 */
export function popOutPage(page) {
  if ( !page ) return;
  if ( !page._getSheetClass()?.isV2 ) {
    ui.notifications.warn("JournalPins.Notifications.PopOutUnsupported", { localize: true });
    return;
  }
  const existing = foundry.applications.instances.get(PagePopout.idFor(page));
  if ( existing ) {
    existing.render({ force: true });
    existing.bringToFront();
    return;
  }
  new PagePopout(page).render({ force: true });
}

function popoutFor(page) {
  return foundry.applications.instances.get(PagePopout.idFor(page));
}

/* -------------------------------------------- */

function onPageContextOptions(app, options) {
  const getPage = li => app.document?.pages?.get(li.dataset.pageId);
  options.push({
    label: "JournalPins.PopOut.Label",
    icon: "fa-solid fa-up-right-from-square",
    visible: li => !!getPage(li),
    onClick: (event, li) => popOutPage(getPage(li))
  });
}

function onJournalHeaderControls(app, controls) {
  controls.push({
    label: "JournalPins.PopOut.Current",
    icon: "fa-solid fa-up-right-from-square",
    visible: () => !!app.pageId,
    onClick: () => popOutPage(app.document?.pages?.get(app.pageId))
  });
}

export function registerPagePopoutHooks() {
  if ( !features.pagePopout ) return;
  Hooks.on("getJournalEntryPageContextOptions", onPageContextOptions);
  Hooks.on("getHeaderControlsJournalEntrySheet", onJournalHeaderControls);
  // Keep open popouts in step with their pages
  Hooks.on("updateJournalEntryPage", page => popoutFor(page)?.render());
  Hooks.on("deleteJournalEntryPage", page => popoutFor(page)?.close());
}
