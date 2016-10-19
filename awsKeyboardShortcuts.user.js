// ==UserScript==
// @name         AWS Keyboard Shortcuts
// @namespace    http://yo1.dog
// @version      0.1
// @description  Adds keyboard shortcuts to the AWS Management Console.
// @author       Mike "yo1dog" Moore
// @match        https://console.aws.amazon.com/*
// @match        https://*.console.aws.amazon.com/*
// @grant        GM_addStyle
// @icon         
// @run-at       document-idle

// ==/UserScript==
/* globals GM_addStyle */

const KEY_BINDINGS_MAP = {
  'alt+s': showSearchBar,
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

const AWS_SERVICE_ALIASES_MAP = {
  /* AWS IoT               */ iot: ['Internet of Things'                     ],
  /* DMS                   */ dms: ['Database Migration Service'             ],
  /* EC2                   */ ec2: ['Elastic Compute Cloud'                  ],
  /* EC2 Container Service */ ecs: ['Elastic Compute Cloud Container Service'],
  /* EMR                   */ emr: ['Elastic MapReduce'                      ],
  /* IAM                   */ iam: ['Identity and Access Management'         ],
  /* RDS                   */ rds: ['Relational Database Service'            ],
  /* S3                    */ s3 : ['Simple Storage Service'                 ],
  /* SES                   */ ses: ['Simple Email Service'                   ],
  /* SNS                   */ sns: ['Simple Notification Service'            ],
  /* SQS                   */ sqs: ['Simple Queue Service'                   ],
  /* SWF                   */ swf: ['Simple Workflow'                        ],
  /* VPC                   */ vpc: ['Virtual Private Cloud'                  ],
  /* WAF                   */ waf: ['Web Application Firewall'               ]
};

const HIDDEN_CSS_CLASS = 'yo1dog-kbsc-hidden';
const SEARCH_INPUT_ID  = 'yo1dog-kbsc-search-input';

const _CSS = `
  .${HIDDEN_CSS_CLASS} {
    display: none !important;
  }`;

let __oneClickShortcutURLs = null;


(function init() {
  // sometimes the console is inside an iframe on the page. Greasemonkey/Tampermonkey will
  // execute our script inside the iframe as well. If we are executing on a page that contains
  // an iframe that contains the console, we should bail.
  // we know we are executing on the actual AWS Management Console if the AWS services meta data
  // exists
  const awsServicesMeta = getAWSServicesMeta();
  const pageIsIFrameContainer = awsServicesMeta? false : true;
  
  if (pageIsIFrameContainer) {
    return;
  }
  
  // some elements in the DOM are added async - we need to wait for them
  waitForDOM(err => {
    if (err) {
      console.error(err);
      return;
    }
    
    try {
      setup(awsServicesMeta);
    }
    catch (err2) {
      console.error(err2);
    }
  });
})();

function setup(awsServicesMeta) {
  // add some style
  GM_addStyle(_CSS);
  
  // create the AWS services objects
  const awsServices = createAWSServices(awsServicesMeta);
  if (awsServices.length === 0) {
    throw new Error('No AWS services created.');
  }
  
  // get the "One-Click Navigation Shortcut" URLs
  __oneClickShortcutURLs = getOneClickShortcutURLs();
  
  // create search bar input element
  const searchInputElem = createSearchInputElem(awsServices);
  
  // inject the search bar into the page
  injectSearchBar(searchInputElem);
  
  // setup keyboard shortcuts
  setupKeyboardShortcuts(searchInputElem);
}

function waitForDOM(cb, numAttempts = 0) {
  // we know all the DOM elements we need have been instered once the Services->All AWS Services submenu
  // has been loaded
  if (document.getElementById('allServices')) {
    cb();
    return;
  }
  
  ++numAttempts;
  if (numAttempts >= 30) {
    return cb(new Error('Timedout waiting for async DOM elements to be added.'));
  }
  
  setTimeout(() => {
    waitForDOM(cb, numAttempts);
  }, 500);
}

function getAWSServicesMeta() {
  // get the meta element
  const metaElem = document.getElementsByName('awsc-mezz-data')[0];
  if (!metaElem) {
    throw new Error('AWS meta element does not exist.');
  }
  
  // get the JSON that is contained the meta elem's content attribute
  const metaJSON = metaElem.getAttribute('content');
  
  // parse the JSON
  let awsMeta;
  try {
    awsMeta = JSON.parse(metaJSON);
  }
  catch(err) {
    throw new Error('AWS meta element contains invalid JSON.');
  }
  
  /*
  {
    services: [
      {
        "regions": [
          "ap-south-1",
          "eu-west-1",
          ...
        ],
        "cregions": [
          "ap-south-1",
          "eu-west-1",
          ...
        ],
        "group": "cdk",
        "label": "EC2",
        "description": "Amazon Elastic Compute Cloud (EC2) provides resizable compute capacity in the cloud.",
        "caption": "Virtual Servers in the Cloud",
        "id": "ec2",
        "url": "/ec2/v2/home"
      },
      ...
    ],
    ...
  }
  */
  const awsServicesMeta = awsMeta.services;
  if (!awsServicesMeta) {
    throw new Error('services missing from AWS meta JSON.');
  }
  
  return awsServicesMeta;
}

function createAWSServices(awsServicesMeta) {
   // get all the services by finding all the items under the "Services"->"All AWS Services" submenu
  const allAWSServicesSubmenuElem = document.getElementById('allServices');
  if (!allAWSServicesSubmenuElem) {
    throw new Error('Unable to find the all AWS services submenu element.');
  }
  
  const awsServiceLIs = allAWSServicesSubmenuElem.getElementsByTagName('li'); // there is one LI for each service
  
  const awsServices = [];
  
  // for each LI...
  for (let i = 0; i < awsServiceLIs.length; ++i) {
    const awsService = createAWSService(awsServicesMeta, awsServiceLIs[i]);
    
    if (awsService) {
      awsServices.push(awsService);
    }
  }
  
  return awsServices;
}

function createAWSService(awsServicesMeta, awsServiceLI) {
  // get the AWS service ID and URL from a custom attributes on the LI
  const id  = awsServiceLI.getAttribute('data-service-id');
  const url = awsServiceLI.getAttribute('data-service-href');
  
  if (!id) {
    throw new Error('ID missing from AWS service LI.');
  }
  if (!url) {
    throw new Error(`URL missing from AWS service LI (ID: ${id}).`);
  }
  
  // find the meta data for the AWS service
  const awsServiceMeta = awsServicesMeta.find(awsServiceMeta => awsServiceMeta.id === id);
  if (!awsServiceMeta) {
    throw new Error('AWS service meta data does not exist for ID: ' + id);
  }
  
  // use the label from the meta
  const label = awsServiceMeta.label;
  
  // get any known aliases
  const aliases = (AWS_SERVICE_ALIASES_MAP[id] || []).slice(0);
  
  // tokenize the label and aliases for searching
  const labelTokens = tokenizeStr(label);
  const aliasesTokens = aliases.map(tokenizeStr);
  
  // clone the LI element to use a search result
  const searchResultLIElem = awsServiceLI.cloneNode(true);
  searchResultLIElem.setAttribute('data-yo1dog-kbsc-type', 'searchResult');
  
  const awsService = {
    id,
    url,
    label,
    aliases,
    labelTokens,
    aliasesTokens,
    searchResultLIElem,
    meta: awsServiceMeta
  };
  return awsService;
}

function tokenizeStr(str) {
  str = str.trim();
  
  let tokens = [];
  
  // split on whitespace
  const spacedTokens = splitOnWhitespace(str);
  
  // split cammel case
  for (let i = 0; i < spacedTokens.length; ++i) {
    // only split on cammel case if the token is longer than 5 chars
    const spacedToken = spacedTokens[i];
    if (spacedToken.length < 5) {
      tokens.push(spacedToken);
      continue;
    }
    
    tokens = tokens.concat(splitOnCammelCase(spacedToken));
  }
  
  // normalize tokens
  for (let i = 0; i < tokens.length; ++i) {
    tokens[i] = normalizeStr(tokens[i]);
  }
  
  // add a token for the original string
  tokens.push(str);
  
  // remove empty tokens
  tokens = tokens.filter(token => token.length > 0);
  
  return tokens;
}

function splitOnWhitespace(str) {
  return str.split(/\s+/);
}
function splitOnCammelCase(str) {
  const parts = [];
  
  let lastIndex = 0;
  for (let i = 1; i < str.length; ++i) {
    const char1 = str.charCodeAt(i - 1);
    const char2 = str.charCodeAt(i);
    
    if (
      char1 >= 97/*a*/ && char1 <= 122/*z*/ &&
      char2 >= 65/*A*/ && char2 <= 90 /*Z*/
    ) {
      parts.push(str.substring(lastIndex, i));
      lastIndex = i;
    }
  }
  
  parts.push(str.substring(lastIndex));
  
  return parts;
}

function normalizeStr(str) {
  // lowercase and remove all non alpha-numeric chars
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function getOneClickShortcutURLs() {
  // get all the "One-Click Navigation Shortcuts" in the top bar
  const navShortcutBarElem = document.getElementById('nav-shortcutBar');
  if (!navShortcutBarElem) {
    throw new Error('Unable to find the navigation shorcut bar element.');
  }
  
  const oneClickShortcutURLs = [];
  
  const shortcutLIs = navShortcutBarElem.getElementsByTagName('li'); // there is on LI for each shortcut
  
  // for each LI...
  for (let i = 0; i < shortcutLIs.length; ++i) {
    const shortcutLI = shortcutLIs[i];
    
    // get the URL from a custom attribute
    const url = shortcutLI.getAttribute('data-service-href');
    if (url) {
      oneClickShortcutURLs.push(url);
    }
  }
  
  return oneClickShortcutURLs;
}

function createSearchInputElem(awsServices) {
  // create the input element
  const inputElem = document.createElement('input');
  inputElem.setAttribute('id',    SEARCH_INPUT_ID);
  inputElem.setAttribute('type',  'text');
  inputElem.setAttribute('value', '');
  
  // bind oninput event which will be called every time the text changes as the user types
  inputElem.addEventListener('input', event => {
    try {
      stopEvent(event);
      const inputText = event.target.value.trim();
      
      // hide the search results if the input text is empty
      if (!inputText) {
        hideSearchResults();
        return false;
      }
      
      // search and show the results
      const searchResults = search(inputText, awsServices);
      showSearchResults(searchResults);
    }
    catch (err) {
      console.error(err);
    }
    
    return false;
  }, false);
  
  return inputElem;
}

function injectSearchBar(searchInputElem) {
  // lets put the search bar at the top of the first list in the "ALL AWS Services" menu
  const allAWSServicesSubmenuElem = document.getElementById('allServices');
  if (!allAWSServicesSubmenuElem) {
    throw new Error('Unable to find the all AWS services submenu element.');
  }
  
  const firstULElem = allAWSServicesSubmenuElem.getElementsByTagName('ul')[0];
  if (!firstULElem) {
    throw new Error('Unable to find the first UL element.');
  }
  
  // create an LI element to house the search input element
  const liElem = document.createElement('li');
  liElem.appendChild(searchInputElem);
  
  // mark the LI element so we can tell it apart from the other LI elements
  liElem.setAttribute('data-yo1dog-kbsc-type', 'searchBar');
  
  // add LI element to top of UL element
  firstULElem.insertBefore(liElem, firstULElem.firstChild);
}

function search(searchStr, awsServices) {
  // normalize search string
  const searchStrNorm = normalizeStr(searchStr);
  
  // if the search string is empty then return none
  if (searchStrNorm.length === 0) {
    return [];
  }
  
  const awsServicesSearchData = [];
  
  // for each AWS service...
  for (let i = 0; i < awsServices.length; ++i) {
    const awsService = awsServices[i];
    
    // create the search data for the service
    const awsServiceSearchData = createAWSServiceSearchData(awsService, searchStrNorm);
    if (awsServiceSearchData) {
      awsServicesSearchData.push(awsServiceSearchData);
    }
  }
  
  // sort the search data
  awsServicesSearchData.sort((dataA, dataB) => {
    // put exact matches first
    if (dataA.exactMatchTokenData && !dataB.exactMatchTokenData) {
      return -1;
    }
    else if (!dataA.exactMatchTokenData && dataB.exactMatchTokenData) {
      return 1;
    }
    else if (dataA.exactMatchTokenData && dataB.exactMatchTokenData) {
      // first sort by token index ascending
      const indexDiff = dataA.exactMatchTokenData.tokenIndex - dataB.exactMatchTokenData.tokenIndex;
      if (indexDiff !== 0) {
        return indexDiff;
      }
      
      // then sort alphabetically
      return dataA.awsService.label.localeCompare(dataB.awsService.label);
    }
    
    // put starting matches second
    if (dataA.startingTokenData && !dataB.startingTokenData) {
      return -1;
    }
    else if (!dataA.startingTokenData && dataB.startingTokenData) {
      return 1;
    }
    else if (dataA.startingTokenData && dataB.startingTokenData) {
      // first sort by token index ascending
      const indexDiff = dataA.startingTokenData.tokenIndex - dataB.startingTokenData.tokenIndex;
      if (indexDiff !== 0) {
        return indexDiff;
      }
      
      // then sort alphabetically
      return dataA.awsService.label.localeCompare(dataB.awsService.label);
    }
    
    // put partial matches last
    // weight the partial matches based on the number of characters in token positions
    const partialWeightA = calculatePartialMatchesWeight(dataA.partialTokensData);
    const partialWeightB = calculatePartialMatchesWeight(dataB.partialTokensData);
    
    return partialWeightA - partialWeightB;
  });
  
  // return the AWS services
  const results = awsServicesSearchData.map(awsServiceSearchData => awsServiceSearchData.awsService);
  return results;
}

function createAWSServiceSearchData(awsService, searchStrNorm) {
  const awsServiceSearchData = {
    awsService
  };
  
  // check for a token that exactly matches the search string
  const exactMatchTokenData = tryExactMatchTokens(awsService.labelTokens, searchStrNorm);
  if (exactMatchTokenData) {
    awsServiceSearchData.exactMatchTokenData = exactMatchTokenData;
    return awsServiceSearchData;
  }
  
  // check for a token that starts with the search string
  const startingTokenData = tryStartingMatchToken(awsService.labelTokens, searchStrNorm);
  if (startingTokenData) {
    awsServiceSearchData.startingTokenData = startingTokenData;
    return awsServiceSearchData;
  }
  
  // check for multiple tokens that start with partial bits of the search string
  const partialTokensData = tryPartialMatchTokens(awsService.labelTokens, searchStrNorm);
  if (partialTokensData) {
    awsServiceSearchData.partialTokensData = partialTokensData;
    return awsServiceSearchData;
  }
  
  return null;
}

function tryExactMatchTokens(tokens, str) {
  for (let i = 0; i < tokens.length; ++i) {
    const token = tokens[i];
    
    if (token === str) {
      const exactMatchTokenData = {
        token,
        tokenIndex: i
      };
      return exactMatchTokenData;
    }
  }
  
  return null;
}

function tryStartingMatchToken(tokens, str) {
  for (let i = 0; i < tokens.length; ++i) {
    const token = tokens[i];
    
    if (token.indexOf(str) === 0) {
      const startingTokenData = {
        token,
        tokenIndex: i
      };
      return startingTokenData;
    }
  }
  
  return null;
}

function tryPartialMatchTokens(tokens, str, tokenIndex = 0, strIndex = 0) {
  // check if we already matched the entire search string
  if (strIndex >= str.length) {
    // the solution is valid!
    const partialTokensData = [];
    return partialTokensData;
  }
  
  if (tokenIndex >= tokens.length) {
    // this should only happen if this function was initally called with an out-of-bound index
    return null;
  }
  
  const token = tokens[tokenIndex];
  const remainingStrLength = str.length - strIndex;
  
  // try all possible combinations by trying different amounts of each token (diffrent sized partial tokens)
  // 
  // the entire string has to be matched by tokens. Therefore, the partial token must be of a length such
  // that the remaining tokens could match the rest of the string. example:
  // - lets say the search string is 10 characters long
  // - there are 4 tokens
  // - we are on the 2nd token and have already matched the first 2 characters so there are 8 characters left to match
  // - the next 2 tokens have lengths of 2 and 3 so combined they can match at most 5 characters
  // - that means this token (the 2nd) must match at least 3 (8 - 5 = 3) characters for this solution to be possible 
  const remainingTokensLengthSum = tokens.reduce((sum, token) => sum + token.length, 0);
  const minLength = Math.max(remainingStrLength - remainingTokensLengthSum, 0); // the min length should never be less than 0
  
  // if the min length is larger than the token's length, then the solution is invalid
  if (minLength > token.length) {
    // go back to the previous token and try a different amount
    return null;
  }
  
  // we can't match past the end of the search string so the max length is the number of remaining
  // characters
  const maxLength = Math.min(token.length, remainingStrLength);
  
  for (let partialTokenLength = maxLength; partialTokenLength >= minLength; --partialTokenLength) {
    const partialToken = token.substring(0, partialTokenLength);
    
    // check if the partial token exists at the current search string position
    // (or if the partial token is empty which means we are skipping the token)
    if (
      partialToken.length > 0 &&
      str.indexOf(partialToken, strIndex) !== strIndex
    ) {
      // it doesn't, try a different amount of the token (a smaller partial token)
      continue;
    }
    
    // it does, we have a potential solution
    const partialTokenData = {
      token,
      partialToken,
      tokenIndex,
      strIndex
    };
    
    let newStrIndex = strIndex + partialToken.length;
    
    // check if we matched the entire search string
    if (newStrIndex >= str.length) {
      // we found a valid solution!
      // Note: it is impossible to get here if we are skipping the token
      const partialTokensData = [partialTokenData];
      return partialTokensData;
    }
    
    // we have not yet match the entire seach string
    // check if the rest of the tokens can match the rest of the string
    const partialTokensData = tryPartialMatchTokens(tokens, str, tokenIndex + 1, newStrIndex);
    if (!partialTokensData) {
      // the rest of the tokens were not able to partially match the rest of the string
      // try a different amount of the token (a smaller partial token)
      continue;
    }
    
    // the rest of the tokens matched the rest of the string
    // the solution is valid
    // add the partial token data to the result (if we aren't skipping the token)
    if (partialToken.length > 0) {
      partialTokensData.unshift(partialTokenData);
    }
    return partialTokensData;
  }
  
  // the solution is invalid
  // go back to the previous token and try a different amount
  return null;
}

function calculatePartialMatchesWeight(partialTokensData) {
  let weight = 0;
  for (let i = 0; i < partialTokensData.length; ++i) {
    const partialTokenData = partialTokensData[i];
    
    weight += partialTokenData.partialToken.length * (partialTokenData.tokenIndex + 1);
  }
  
  return weight;
}

function showSearchResults(awsServices) {
  // show the results in the "Services"->"ALL AWS Services" submenu, under the search bar
  const allAWSServicesSubmenuElem = document.getElementById('allServices');
  if (!allAWSServicesSubmenuElem) {
    throw new Error('Unable to find the all AWS services submenu element.');
  }
  
  // hide all the columns except the first one
  const ulElems = allAWSServicesSubmenuElem.getElementsByTagName('ul');
  for (let i = 1; i < ulElems.length; ++i) {
    hideElem(ulElems[i]);
  }
  
  // remove all the search result and hide all the non-search result LI
  // elements in the first column
  const firstULElem = ulElems[0];
  if (!firstULElem) {
    throw new Error('Unable to find the first UL element.');
  }
  
  const liElems = firstULElem.getElementsByTagName('li');
  for (let i = 0; i < liElems.length; ++i) {
    const liElem = liElems[i];
    
    const type = liElem.getAttribute('data-yo1dog-kbsc-type');
    switch (type) {
      case 'searchBar':
        // ignore the search bar
        break;
      case 'searchResult':
        // remove search results
        liElem.parentElement.removeChild(liElem);
        
        // liElems is not a normal array
        // when an element in the list is removed from the DOM it is also removed
        // from the list
        --i;
        break;
      default:
        // hide everything else (non-search results)
        hideElem(liElem);
        break;
    }
  }
  
  // add the new search results
  for (let i = 0; i < awsServices.length; ++i) {
    firstULElem.appendChild(awsServices[i].searchResultLIElem);
  }
}
function hideSearchResults() {
  const allAWSServicesSubmenuElem = document.getElementById('allServices');
  if (!allAWSServicesSubmenuElem) {
    throw new Error('Unable to find the all AWS services submenu element.');
  }
  
  // unhide all the columns
  const ulElems = allAWSServicesSubmenuElem.getElementsByTagName('ul');
  for (let i = 0; i < ulElems.length; ++i) {
    unhideElem(ulElems[i]);
  }
  
  // remove all the search result and unhide all the non-search result LI
  // elements in the first column
  const firstULElem = ulElems[0];
  if (!firstULElem) {
    throw new Error('Unable to find the first UL element.');
  }
  
  const liElems = firstULElem.getElementsByTagName('li');
  for (let i = 0; i < liElems.length; ++i) {
    const liElem = liElems[i];
    
    const type = liElem.getAttribute('data-yo1dog-kbsc-type');
    switch (type) {
      case 'searchBar':
        // ignore the search bar
        break;
      case 'searchResult':
        // remove search results
        liElem.parentElement.removeChild(liElem);
        
        // liElems is not a normal array
        // when an element in the list is removed from the DOM it is also removed
        // from the list
        --i;
        break;
      default:
        // unhide everything else (non-search results)
        unhideElem(liElem);
        break;
    }
  }
}

function parseKeyBindingsMap(keyBindingsMap) {
  const keyBindings = [];
  
  for (let keyBindingStr in keyBindingsMap) {
    const actionFn = keyBindingsMap[keyBindingStr];
    
    // split the binding into its parts
    const parts = keyBindingStr.split('+');
    
    // the modifers come first and the key is always last
    const modifers = parts.slice(0, parts.length - 1);
    const keyStr   = parts[parts.length - 1];
    
    if (!keyStr || keyStr.length > 1) {
      throw new Error(`Invalid keybinding: '${keyBindingStr}' - key must be one character: '${keyStr}'`);
    }
    
    const keyCode = keyStr.toUpperCase().charCodeAt(0);
    
    let ctrl  = false;
    let alt   = false;
    let meta  = false;
    let shift = false;
    for (let i = 0; i < modifers.length; ++i) {
      const modifer = modifers[i];
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
  
  return keyBindings;
}

function matchKeyBinding(keyBindings, keyCode, modifers) {
  const ctrl  = modifers.ctrl ? true : false;
  const alt   = modifers.alt  ? true : false;
  const meta  = modifers.meta ? true : false;
  const shift = modifers.shift? true : false;
  
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

function setupKeyboardShortcuts() {
  const keyBindings = parseKeyBindingsMap(KEY_BINDINGS_MAP);
  
  document.addEventListener('keydown', event => {
    try {
      const keyCode = event.keyCode;
      const modifers = {
        ctrl : event.ctrlKey,
        alt  : event.altKey,
        meta : event.metaKey,
        shift: event.shiftKey
      };
      
      // check if there is a keybinding for the key and modifers
      const keyBinding = matchKeyBinding(keyBindings, keyCode, modifers);
      if (!keyBinding) {
        return true;
      }
      
      keyBinding.actionFn(event);
      
      stopEvent(event);
      return false;
    }
    catch(err) {
      console.error(err);
    }
  }, false);
}

function showSearchBar() {
  // show the "Services"->"All AWS Services" submenu
  showServicesMenu();
  showAllAWSServicesSubmenu();
  
  // focus on the search input
  const searchInputElem = document.getElementById(SEARCH_INPUT_ID);
  if (!searchInputElem) {
    throw new Error('Unable to find the search input element');
  }
  
  searchInputElem.focus();
}

function goToOneClickShortcut(onClickShortcutIndex) {
  const url = __oneClickShortcutURLs[onClickShortcutIndex];
  if (url) {
    window.location.href = url;
  }
}

function showServicesMenu() {
  // check if the services menu is already open
  const servicesMenuElem = document.getElementById('servicesMenuContent');
  if (!servicesMenuElem) {
    throw new Error('Unable to find the services menu element.');
  }
  
  // we know the menu is open if it is visible
  const servicesMenuIsOpen = servicesMenuElem.style.display !== 'none';
  
  if (servicesMenuIsOpen) {
    return;
  }
  
  // open the service menu
  // we do this by "clicking" on the "Services" button in the navigation bar
  const servicesMenuButtonElem = document.getElementById('nav-servicesMenu');
  if (!servicesMenuElem) {
    throw new Error('Unable to find the services menu button element.');
  }
  
  servicesMenuButtonElem.dispatchEvent(new Event('click'));
}

function showAllAWSServicesSubmenu() {
  // open the "Services"->"All AWS Services" submenu
  // we do this by sending a custom event to the "Services"->"All AWS Services" submenu link
  const allAWSServicesSubmenuLinkElem = document.getElementById('allServicesLink');
  if (!allAWSServicesSubmenuLinkElem) {
    throw new Error('Unable to find the all AWS services submenu link element.');
  }
  
  // NOTE: for some reason neither dispatchEvent nor $().trigger works. But using
  // AWSC.jQuery().trigger does.
  unsafeWindow.AWSC.jQuery(allAWSServicesSubmenuLinkElem).trigger('menu-select.mouseoverMenu');
}


function hideElem(elem) {
  if (elem.className.indexOf(HIDDEN_CSS_CLASS) === -1) {
    elem.className += ' ' + HIDDEN_CSS_CLASS;
  }
}
function unhideElem(elem) {
  elem.className = elem.className.replace(new RegExp(' *' + escapeRegExp(HIDDEN_CSS_CLASS), 'g'), '');
}
function escapeRegExp(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
}

function stopEvent(event) {
  if (event.preventDefault) {
    event.preventDefault();
  }
  if (event.stopPropagation) {
    event.stopPropagation();
  }
  event.cancelBubble = true;
}