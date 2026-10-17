import { registerSettings } from "./settings.mjs";
import { registerNoteClass } from "./note-object.mjs";
import { registerNoteConfigHooks } from "./note-config.mjs";
import { registerContentPinHooks, registerDragListener } from "./content-pins.mjs";
import { registerPagePopoutHooks } from "./page-popout.mjs";

Hooks.once("init", () => {
  registerSettings();
  registerNoteClass();
  registerNoteConfigHooks();
  registerContentPinHooks();
});

Hooks.once("setup", () => {
  registerPagePopoutHooks();
});

Hooks.once("ready", () => {
  registerDragListener();
});
