const stopEvent = require('./utils/stopEvent');

const KEY_BINDINGS_DEFS = [
  require('./keyBindings/searchBarBindings'),
  require('./keyBindings/oneClickShortcutBindings')
];


function bind() {
  const keyBindings = loadKeyBindings();
  attachKeyListener(keyBindings);
}

function loadKeyBindings() {
  const keyBindings = [];
  
  // for each set of key binding definitions...
  for (let i = 0; i < KEY_BINDINGS_DEFS.length; ++i) {
    const keyBindingDefs = KEY_BINDINGS_DEFS[i];
    
    // for each key binding definition...
    for (let keyBindingStr in keyBindingDefs) {
      const actionFn = keyBindingDefs[keyBindingStr];
      
      // split the binding into its parts
      const parts = keyBindingStr.split('+');
      
      // the modifiers come first and the key is always last
      const modifiers = parts.slice(0, parts.length - 1);
      const keyStr   = parts[parts.length - 1];
      
      // get the key code
      const keyCode = getKeyCodeFromKeyStr(keyStr);
      
      let ctrl  = false;
      let alt   = false;
      let meta  = false;
      let shift = false;
      for (let i = 0; i < modifiers.length; ++i) {
        const modifer = modifiers[i];
        if      (modifer === 'ctrl')  ctrl = true;
        else if (modifer === 'alt')   alt = true;
        else if (modifer === 'meta')  meta = true;
        else if (modifer === 'shift') shift = true;
        else throw new Error(`Invalid keybinding: '${keyBindingStr}' - Unrecognized modifier: '${modifer}'`);
      }
      
      const keyBinding = {
        keyStr,
        keyCode,
        ctrl,
        alt,
        meta,
        shift,
        actionFn
      };
      keyBindings.push(keyBinding);
    }
  }
  
  return keyBindings;
}

function getKeyCodeFromKeyStr(keyStr) {
  // special cases
  switch(keyStr) {
    case 'tab'  : return 9;
    case 'enter': return 13;
    case 'esc'  : return 27;
    case 'left' : return 37;
    case 'up'   : return 38;
    case 'right': return 39;
    case 'down' : return 40;
  }
  
  // otherwise the key should be a single character representing the key on the keyboard
  if (!keyStr || keyStr.length > 1) {
    throw new Error(`Invalid keybinding. Key must be one character: '${keyStr}'`);
  }
  
  return keyStr.toUpperCase().charCodeAt(0);
}

function attachKeyListener(keyBindings) {
  document.addEventListener('keydown', event => {
    keyListener(event, keyBindings);
  }, false);
}

function keyListener(event, keyBindings) {
  // get the key code and modifiers from the keydown event
  const keyCode = event.keyCode;
  const modifiers = {
    ctrl : event.ctrlKey,
    alt  : event.altKey,
    meta : event.metaKey,
    shift: event.shiftKey
  };
  
  const allowEventBubble = onKey(event, keyBindings, keyCode, modifiers);
  
  // stop the event from bubbling if needed
  if (!allowEventBubble) {
    stopEvent(event);
    return false;
  }
  
  return true;
}

function onKey(event, keyBindings, keyCode, modifiers = {}) {
  // check if there is a keybinding for the key and modifiers
  const keyBinding = matchKeyBinding(keyBindings, keyCode, modifiers);
  if (!keyBinding) {
    // allow bubbling of the event if the key is not bound
    return true;
  }
  
  // execute the action bound to the key
  const allowEventBubble = keyBinding.actionFn(event);
  return allowEventBubble;
}

function matchKeyBinding(keyBindings, keyCode, modifiers) {
  const ctrl  = modifiers.ctrl ? true : false;
  const alt   = modifiers.alt  ? true : false;
  const meta  = modifiers.meta ? true : false;
  const shift = modifiers.shift? true : false;
  
  for (let i = 0; i < keyBindings.length; ++i) {
    const keyBinding = keyBindings[i];
    if (
      keyBinding.keyCode === keyCode &&
      keyBinding.ctrl    === ctrl    &&
      keyBinding.alt     === alt     &&
      keyBinding.meta    === meta    &&
      keyBinding.shift   === shift
    ) {
      return keyBinding;
    }
  }
  
  return null;
}


module.exports = {
  bind
};