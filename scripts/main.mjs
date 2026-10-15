import { registerSettings } from "./settings.mjs";
import { registerNoteClass } from "./note-object.mjs";
import { registerNoteConfigHooks } from "./note-config.mjs";
import { registerContentPinHooks, registerDragListener } from "./content-pins.mjs";

Hooks.once("init", () => {
  registerSettings();
  registerNoteClass();
  registerNoteConfigHooks();
  registerContentPinHooks();
});

Hooks.once("ready", () => {
  registerDragListener();
});
