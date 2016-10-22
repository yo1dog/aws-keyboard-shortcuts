const fs                    = require('fs');
const searchEngine          = require('./searchEngine');
const createElementFromHTML = require('./utils/createElementFromHTML');
const hideElement           = require('./utils/hideElement');
const unhideElement         = require('./utils/unhideElement');
const elementIsHidden       = require('./utils/elementIsHidden');
const stopEvent             = require('./utils/stopEvent');

const SEARCH_BAR_HTML    = fs.readFileSync(__dirname + '/assets/searchBar.html').toString('utf8');
const SEARCH_RESULT_HTML = fs.readFileSync(__dirname + '/assets/searchResult.html').toString('utf8');


let __searchBarElem         = null;
let __searchInputElem       = null;
let __searchResultsElem     = null;
let __iconSpriteSheetCSSURL = null; // url('http://www.example.com/img.jpg')


function init() {
  injectSearchBar();
  extractIconSpriteSheetURL();
}

function injectSearchBar() {
  // create the search bar element
  const searchBarElem = createElementFromHTML(SEARCH_BAR_HTML);
  
  // get the search input and results elements from the search bar
  const searchInputElem   = searchBarElem.getElementsByClassName('yo1dog-kbsc-searchInput'  )[0];
  const searchResultsElem = searchBarElem.getElementsByClassName('yo1dog-kbsc-searchResults')[0];
  
  // add the search bar element to the page
  document.body.appendChild(searchBarElem);
  
  // attach the event listeners
  // bind oninput event which will be called every time the text changes as the user types
  searchInputElem.addEventListener('input', onSearchInput, false);
  
  // bind blur event
  searchInputElem.addEventListener('blur', onSearchBlur, false);
  
  __searchBarElem     = searchBarElem;
  __searchInputElem   = searchInputElem;
  __searchResultsElem = searchResultsElem;
}

function extractIconSpriteSheetURL() {
  // get the navigation logo element
  const navLogoElem = document.getElementById('nav-logo');
  if (!navLogoElem) {
    return;
  }
  
  // compute the element's style
  const style = getComputedStyle(navLogoElem);
  
  // the background image is the sprite sheet
  // possible formats:
  // url(http://www.example.com/img.jpg)
  // url('http://www.example.com/img.jpg')
  // url("http://www.example.com/img.jpg")
  const iconSpriteSheetCSSURL = style.backgroundImage;
  __iconSpriteSheetCSSURL = iconSpriteSheetCSSURL;
}

function checkInited() {
  if (!__searchBarElem) {
    throw new Error('Attempted to manipulate search bar before initiating it.');
  }
}

function showSearchBar() {
  checkInited();
  unhideElement(__searchBarElem);
}
function focusSearchBar() {
  checkInited();
  __searchInputElem.focus();
}
function hideSearchBar() {
  checkInited();
  hideElement(__searchBarElem);
}
function clearSearchBar() {
  checkInited();
  __searchInputElem.value = '';
  setSearchResults([]);
}
function searchBarIsShowing() {
  checkInited();
  return !elementIsHidden(__searchBarElem);
}
function searchBarHasFocus() {
  checkInited();
  return document.activeElement === __searchInputElem;
}

function moveSelectionUp() {
  checkInited();
  setSelection(-1);
}
function moveSelectionDown() {
  checkInited();
  setSelection(1);
}


function onSearchInput(event) {
  // search using the input text
  const inputText = event.target.value;
  searchAndSetResults(inputText);
  
  return false;
}
function onSearchBlur(event) {
  // wait a delay so clicks on results have a chance to work
  setTimeout(() => {
    // if we have clicked on a search result, dont hide the search bar
    if (document.activeElement.classList.contains('yo1dog-kbsc-searchResult')) {
      return;
    }
    
    // hide the search bar
    hideSearchBar();
    clearSearchBar();
  }, 10);
}

function searchAndSetResults(str) {
  // search and show the results
  const awsServicesSearchResults = searchEngine.search(str);
  setSearchResults(awsServicesSearchResults);
}

function setSearchResults(awsServicesSearchResults) {
  // remove all existing search results
  while (__searchResultsElem.firstChild) {
    __searchResultsElem.removeChild(__searchResultsElem.firstChild);
  }
  
  // add the new search results
  for (let i = 0; i < awsServicesSearchResults.length; ++i) {
    const awsServicesSearchResult = awsServicesSearchResults[i];
    
    const searchResultElem = createSearchResultElem(awsServicesSearchResult);
    __searchResultsElem.appendChild(searchResultElem);
  }
  
  // reset the selection
  setSelection(null);
}

function createSearchResultElem(awsServicesSearchResult) {
  const awsService           = awsServicesSearchResult.awsService;
  const matchedLabelStrParts = awsServicesSearchResult.matchedLabelStrParts;
  
  // create the base search result element
  const searchResultElem = createElementFromHTML(SEARCH_RESULT_HTML);
  searchResultElem.__yo1dog_kbsc_awsService = awsService;
  
  // set the style on the icon element
  const searchResultIconElem = searchResultElem.getElementsByClassName('yo1dog-kbsc-searchResultIcon')[0];
  
  // get the icon sprite height from an attribute on the icon element
  const iconSpriteHeightStr = searchResultIconElem.getAttribute('data-yo1dog-kbsc-sprite-height');
  if (!iconSpriteHeightStr) {
    throw new Error('Sprite height attribute missing from the icon element.');
  }
  
  const iconSpriteHeight = parseInt(iconSpriteHeightStr);
  if (isNaN(iconSpriteHeight)) {
    throw new Error('Sprite height attribute on the icon element is invalid. Must be a number: ' + iconSpriteHeightStr);
  }
  
  const iconSpriteStyle = getIconSpriteStyle(awsService.iconSpriteIndex, iconSpriteHeight);
  Object.assign(searchResultIconElem.style, iconSpriteStyle);
  
  // set the label
  const searchResultLabelElem = searchResultElem.getElementsByClassName('yo1dog-kbsc-searchResultLabel')[0];
  
  // split the label into matched and not match parts
  const results = splitStrMatches(awsService.label, matchedLabelStrParts);
  
  for (let i = 0; i < results.length; ++i) {
    const {substr, wasMatched} = results[i];
    
    
    const spanElem = document.createElement('span');
    spanElem.classList.add(
      wasMatched? 'yo1dog-kbsc-searchResultLabelMatched' : 'yo1dog-kbsc-searchResultLabelUnmatched'
    );
    
    const textNode = document.createTextNode(substr);
    spanElem.appendChild(textNode);
    searchResultLabelElem.appendChild(spanElem);
  }
  
  // set the link
  searchResultElem.setAttribute('href', awsService.url);
  
  // bind the onmousemove event to the result so we can set the selection
  searchResultElem.addEventListener('mousemove', onSearchResultMouseMove, false);
  
  // bind the onmouseleave event to unset the selection
  searchResultElem.addEventListener('mouseleave', onSearchResultMouseLeave, false);
  
  return searchResultElem;
}

function onSearchResultMouseMove(event) {
  // mousemove event is fired for parent and all children
  let elem = event.target;
  
  // find the search result element if the element is a child
  while (elem && !elem.classList.contains('yo1dog-kbsc-searchResult')) {
    elem = elem.parentElement;
  }
  
  // check if we were able to find the search result element
  if (!elem) {
    return;
  }
  
  const searchResultElem = elem;
  setSelection(searchResultElem);
  
  stopEvent(event);
  return false;
}
function onSearchResultMouseLeave(event) {
  // mouseleave event is fired for only the parent
  // unselect the search result element
  const searchResultElem = event.target;
  unmarkSearchResultElemSelected(searchResultElem);
}

function splitStrMatches(str, matchedStrParts) {
  const results = [];
  
  let lastIndex = 0;
  for (let i = 0; i < matchedStrParts.length; ++i) {
    const matchedStrPart = matchedStrParts[i];
    const matchedStrPartEndIndex = matchedStrPart.index + matchedStrPart.length;
    
    const unmatchedSubstr = str.substring(lastIndex, matchedStrPart.index);
    const matchedSubstr = str.substring(matchedStrPart.index, matchedStrPartEndIndex);
    
    if (unmatchedSubstr.length > 0) {
      results.push({
        wasMatched: false,
        substr: unmatchedSubstr
      });
    }
    
    results.push({
      wasMatched: true,
      substr: matchedSubstr
    });
    
    lastIndex = matchedStrPartEndIndex;
  }
  
  const unmatchedSubstr = str.substring(lastIndex);
  if (unmatchedSubstr.length > 0) {
    results.push({
      wasMatched: false,
      substr: unmatchedSubstr
    });
  }
  
  return results;
}

const ICON_SPRITE_HEIGHTS = [
  24,
  20,
  16,
  31
];

function getIconSpriteStyle(spriteIndex, spriteHeight) {
  // get the row the sprites of the given height are in
  const spriteRow = ICON_SPRITE_HEIGHTS.indexOf(spriteHeight);
  if (spriteRow === -1) {
    throw new Error('Invalid sprite height: ' + spriteHeight);
  }
  
  // calculate the y offset based on the row the sprite is in
  // add up the heights of all the rows above the row the sprite is in
  let yOffset = 0;
  for (let i = 0; i < spriteRow; ++i) {
    const rowHeight = ICON_SPRITE_HEIGHTS[i];
    yOffset += rowHeight;
  }
  
  // calculate the x offset based on the index (column) the sprite is in
  // sprites are always 32 pixels apart
  const xOffset = spriteIndex * 32;
  
  // sprites are always square
  const width  = spriteHeight;
  const height = spriteHeight;
  
  const iconSpriteStyle = {
    backgroundImage   : __iconSpriteSheetCSSURL || '',
    backgroundPosition: `${-xOffset}px ${-yOffset}px`,
    width             : width + 'px',
    height            : height + 'px'
  };
  return iconSpriteStyle;
}


// pass in null to reset the selection
function setSelection(arg) {
  // get the search result elements
  const searchResultElems = __searchBarElem.getElementsByClassName('yo1dog-kbsc-searchResult');
  
  // find the currently selected result element
  let selectedIndex = -1;
  let selectedSearchResultElem = null;
  for (let i = 0; i < searchResultElems.length; ++i) {
    const searchResultElem = searchResultElems[i];
    
    if (searchResultElem.classList.contains('yo1dog-kbsc-searchResultSelected')) {
      selectedIndex = i;
      selectedSearchResultElem = searchResultElem;
      break;
    }
  }
  
  // calculate the taget selection element
  let targetSelectionResultElem;
  
  if (typeof arg === 'number') {
    // use an offset from the current selection if we were given a number
    const delta = arg;
    let targetSelectionIndex = selectedIndex + delta;
  
    // clamp the selection index to the selection bounds
    if (targetSelectionIndex >= searchResultElems.length) {
      targetSelectionIndex = searchResultElems.length - 1;
    }
    
    if (targetSelectionIndex > -1) {
      targetSelectionResultElem = searchResultElems[targetSelectionIndex];
    }
  }
  else {
    // use the given search result element
    targetSelectionResultElem = arg;
  }
  
  // check if the selection has actually changed
  if (selectedSearchResultElem === targetSelectionResultElem) {
    return;
  }
  
  // remove the selected class from the currently selected result element (if there is one)
  if (selectedSearchResultElem) {
    unmarkSearchResultElemSelected(selectedSearchResultElem);
  }
  
  // add the selected class to the target element (if there is one)
  if (targetSelectionResultElem) {
    markSearchResultElemSelected(targetSelectionResultElem);
  }
}

function markSearchResultElemSelected(searchResultElem) {
  searchResultElem.classList.add('yo1dog-kbsc-searchResultSelected');
}
function unmarkSearchResultElemSelected(searchResultElem) {
  searchResultElem.classList.remove('yo1dog-kbsc-searchResultSelected');
}

function getSelectedSearchResultAWSService() {
  const selectedSearchResultElem = __searchResultsElem.getElementsByClassName('yo1dog-kbsc-searchResult yo1dog-kbsc-searchResultSelected')[0];
  if (!selectedSearchResultElem) {
    return null;
  }
  
  const selectedSearchResultAWSService = selectedSearchResultElem.__yo1dog_kbsc_awsService;
  return selectedSearchResultAWSService;
}
function getFirstSearchResultAWSService() {
  const firstSearchResultElem = __searchResultsElem.getElementsByClassName('yo1dog-kbsc-searchResult')[0];
  if (!firstSearchResultElem) {
    return null;
  }
  
  const firstSearchResultAWSService = firstSearchResultElem.__yo1dog_kbsc_awsService;
  return firstSearchResultAWSService;
}


module.exports = {
  init,
  showSearchBar,
  focusSearchBar,
  hideSearchBar,
  clearSearchBar,
  searchBarIsShowing,
  searchBarHasFocus,
  moveSelectionUp,
  moveSelectionDown,
  searchAndSetResults,
  getSelectedSearchResultAWSService,
  getFirstSearchResultAWSService
};