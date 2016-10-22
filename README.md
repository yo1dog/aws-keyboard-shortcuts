# AWS Keyboard Shortcuts
Adds keyboard shortcuts to the AWS Console

## Install
1. Install the Greasemonkey or Tampermonkey extension.
2. Click [here](https://github.com/yo1dog/aws-keyboard-shortcuts/raw/master/userScript/awsKeyboardShortcuts.user.js).

## Use
1. Press alt+s to open the quick search bar
2. Start typing the AWS Service you want to go to
3. Press enter to select the top search result or use arrow keys/tab to select a search result then press enter

## Build
1. Install browserify: `npm install browserify -g`
2. Install dependencies: `npm install`
3. Run the `./build` bash script.

The bash script simply runs browserify against `./src/index.js`, prepends `./userScript/userScriptDef`
to the top, then outputs it all to `./userScript/awsKeyboardShortcuts.user.js` 
