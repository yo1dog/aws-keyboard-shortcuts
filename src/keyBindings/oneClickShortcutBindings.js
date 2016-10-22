const oneClickShortcutsMgr = require('../oneClickShortcutsMgr');

module.exports = {
  'alt+1': event => {goToOneClickShortcut(0);},
  'alt+2': event => {goToOneClickShortcut(1);},
  'alt+3': event => {goToOneClickShortcut(2);},
  'alt+4': event => {goToOneClickShortcut(3);},
  'alt+5': event => {goToOneClickShortcut(4);},
  'alt+6': event => {goToOneClickShortcut(5);},
  'alt+7': event => {goToOneClickShortcut(6);},
  'alt+8': event => {goToOneClickShortcut(7);},
  'alt+9': event => {goToOneClickShortcut(8);},
  'alt+0': event => {goToOneClickShortcut(9);}
};

function goToOneClickShortcut(oneClickShortcutIndex) {
  const urls = oneClickShortcutsMgr.getURLs();
  const url = urls[oneClickShortcutIndex];
  
  if (url) {
    window.location.href = url;
  }
  
  return false;
}
