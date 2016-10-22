const searchBarMgr = require('../searchBarMgr');

module.exports = {
  'alt+s'    : toggleSearchBar,
  'esc'      : hideAndClearSearchBar,
  'up'       : moveSearchBarSelectionUp,
  'down'     : moveSearchBarSelectionDown,
  'shift+tab': moveSearchBarSelectionUp,
  'tab'      : moveSearchBarSelectionDown,
  'enter'    : chooseSearchBarSelection
};

function toggleSearchBar(event) {
  if (searchBarMgr.searchBarIsShowing()) {
    return hideAndClearSearchBar(event);
  }
  else {
    return showAndFocusSearchBar(event);
  }
}

function showAndFocusSearchBar(event) {
  searchBarMgr.showSearchBar();
  searchBarMgr.focusSearchBar();
  return false;
}

function hideAndClearSearchBar(event) {
  if (!searchBarMgr.searchBarIsShowing()) {
    return true;
  }
  
  searchBarMgr.hideSearchBar();
  searchBarMgr.clearSearchBar();
  return false;
}

function moveSearchBarSelectionUp() {
  if (!searchBarMgr.searchBarHasFocus()) {
    return true;
  }
  
  searchBarMgr.moveSelectionUp();
  return false;
}

function moveSearchBarSelectionDown() {
  if (!searchBarMgr.searchBarHasFocus()) {
    return true;
  }
  
  searchBarMgr.moveSelectionDown();
  return false;
}

function chooseSearchBarSelection() {
  if (!searchBarMgr.searchBarHasFocus()) {
    return true;
  }
  
  // choose the selected AWS service
  let awsService = searchBarMgr.getSelectedSearchResultAWSService();
  
  // if no service is selected, use the first one
  if (!awsService) {
    awsService = searchBarMgr.getFirstSearchResultAWSService();
  }
  
  if (awsService) {
    top.window.location.href = awsService.url;
  }
  
  return false;
}