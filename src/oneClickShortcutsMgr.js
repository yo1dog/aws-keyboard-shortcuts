let __oneClickShortcutURLs = null;

function extractURLs() {
  // get all the "One-Click Navigation Shortcuts" in the top bar
  const navShortcutBarElem = document.getElementById('nav-shortcutBar');
  if (!navShortcutBarElem) {
    throw new Error('Unable to find the navigation shorcut bar element.');
  }
  
  const oneClickShortcutURLs = [];
  
  const shortcutLIs = navShortcutBarElem.getElementsByTagName('li'); // there is one LI for each shortcut
  
  // for each LI...
  for (let i = 0; i < shortcutLIs.length; ++i) {
    const shortcutLI = shortcutLIs[i];
    
    // get the URL from a custom attribute
    const url = shortcutLI.getAttribute('data-service-href');
    if (url) {
      oneClickShortcutURLs.push(url);
    }
  }
  
  __oneClickShortcutURLs = oneClickShortcutURLs;
}

function getURLs() {
  if (!__oneClickShortcutURLs) {
    throw new Error('Attempted to get one click shortcut URLs before they were extracted.');
  }
  
  return __oneClickShortcutURLs.slice(0);
}


module.exports = {
  extractURLs,
  getURLs
};