/* globals GM_addStyle */
const fs                   = require('fs');
const awsServicesMgr       = require('./awsServicesMgr');
const oneClickShortcutsMgr = require('./oneClickShortcutsMgr');
const searchEngine         = require('./searchEngine');
const searchBarMgr         = require('./searchBarMgr');
const keyBindingsMgr       = require('./keyBindingsMgr');

const _CSS = fs.readFileSync(__dirname + '/assets/style.css').toString('utf8');


(function init() {
  // sometimes the console is inside an iframe on the page. Greasemonkey/Tampermonkey will
  // execute our script inside the iframe as well. If we are executing on a page that contains
  // an iframe that contains the console, we should bail.
  // we know we are executing on the actual AWS Management Console if the AWS meta data element
  // exists
  const awsMetaElem = awsServicesMgr.getAWSMetaElem();
  const pageIsAWSConsole = awsMetaElem? true : false;
  
  if (!pageIsAWSConsole) {
    return;
  }
  
  // get everything setup
  setup();
})();


function setup(awsServicesMeta) {
  // inject the CSS
  GM_addStyle(_CSS); /* jshint ignore:line */ // don't warn about GM_addStyle being uppercase
  
  // extract the AWS Services
  awsServicesMgr.extractAWSServices();
  
  const awsServices = awsServicesMgr.getAWSServices();
  if (awsServices.length === 0) {
    throw new Error('No AWS services extracted.');
  }
  
  // extract the "One-Click Navigation Shortcut" URLs
  oneClickShortcutsMgr.extractURLs();
  
  // initiate the search engine with the AWS services
  searchEngine.init(awsServices);
  
  // inject the search bar into the page and hide it
  searchBarMgr.init();
  searchBarMgr.hideSearchBar();
  
  // bind the key bindings
  keyBindingsMgr.bind();
}