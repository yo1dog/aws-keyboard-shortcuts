let __awsServiceSearchMetas = null;

function init(awsServices) {
  // create search meta data for each AWS service
  const awsServiceSearchMetas = [];
  for (let i = 0; i < awsServices.length; ++i) {
    const awsService = awsServices[i];
    
    const awsServiceSearchMeta = {
      // tokenize the label and aliases for searching
      labelTokens: tokenizeStr(awsService.label),
      aliasesTokens: awsService.aliases.map(tokenizeStr),
      awsService
    };
    
    awsServiceSearchMetas.push(awsServiceSearchMeta);
  }
  
  __awsServiceSearchMetas = awsServiceSearchMetas;
}


function search(searchStr) {
  if (!__awsServiceSearchMetas) {
    throw new Error('Attempted to search before initiated. Call searchEngine.init() first.');
  }
  
  // normalize search string and remove whitespace
  const searchStrNorm = normalizeStr(searchStr).replace(/\s+/g, '');
  
  // if the search string is empty then return none
  if (searchStrNorm.length === 0) {
    return [];
  }
  
  const awsServicesSearchData = [];
  
  // for each AWS service...
  for (let i = 0; i < __awsServiceSearchMetas.length; ++i) {
    const awsServiceSearchMeta = __awsServiceSearchMetas[i];
    
    // create the search data for the service
    const awsServiceSearchData = createAWSServiceSearchData(awsServiceSearchMeta, searchStrNorm);
    if (awsServiceSearchData) {
      awsServicesSearchData.push(awsServiceSearchData);
    }
  }
  
  // sort the search data
  awsServicesSearchData.sort((dataA, dataB) => {
    // put exact label matches first
    if (dataA.exactMatchLabelTokenData && !dataB.exactMatchLabelTokenData) {
      return -1;
    }
    else if (!dataA.exactMatchLabelTokenData && dataB.exactMatchLabelTokenData) {
      return 1;
    }
    else if (dataA.exactMatchLabelTokenData && dataB.exactMatchLabelTokenData) {
      // first sort by token index ascending
      const indexDiff = dataA.exactMatchLabelTokenData.tokenIndex - dataB.exactMatchLabelTokenData.tokenIndex;
      if (indexDiff !== 0) {
        return indexDiff;
      }
      
      // then sort alphabetically
      return (
        dataA.awsServiceSearchMeta.awsService.label.localeCompare(
        dataB.awsServiceSearchMeta.awsService.label)
      );
    }
    
    // put starting label matches second
    if (dataA.startingLabelTokenData && !dataB.startingLabelTokenData) {
      return -1;
    }
    else if (!dataA.startingLabelTokenData && dataB.startingLabelTokenData) {
      return 1;
    }
    else if (dataA.startingLabelTokenData && dataB.startingLabelTokenData) {
      // first sort by token index ascending
      const indexDiff = dataA.startingLabelTokenData.tokenIndex - dataB.startingLabelTokenData.tokenIndex;
      if (indexDiff !== 0) {
        return indexDiff;
      }
      
      // then sort alphabetically
      return (
        dataA.awsServiceSearchMeta.awsService.label.localeCompare(
        dataB.awsServiceSearchMeta.awsService.label)
      );
    }
    
    // put partial matches last
    // weight the partial label matches based on the number of characters in token positions
    const partialWeightA = calculatePartialMatchesWeight(dataA.partialLabelTokensData);
    const partialWeightB = calculatePartialMatchesWeight(dataB.partialLabelTokensData);
    
    return partialWeightA - partialWeightB;
  });
  
  // conver the search data into search results
  const awsServicesSearchResults = createAWSServiceSearchResults(awsServicesSearchData);
  return awsServicesSearchResults;
}

function createAWSServiceSearchData(awsServiceSearchMeta, searchStrNorm) {
  const awsServiceSearchData = {
    awsServiceSearchMeta
  };
  
  // check for a token that exactly matches the search string
  const exactMatchLabelTokenData = tryExactMatchTokens(awsServiceSearchMeta.labelTokens, searchStrNorm);
  if (exactMatchLabelTokenData) {
    awsServiceSearchData.exactMatchLabelTokenData = exactMatchLabelTokenData;
    return awsServiceSearchData;
  }
  
  // check for a token that starts with the search string
  const startingLabelTokenData = tryStartingMatchToken(awsServiceSearchMeta.labelTokens, searchStrNorm);
  if (startingLabelTokenData) {
    awsServiceSearchData.startingLabelTokenData = startingLabelTokenData;
    return awsServiceSearchData;
  }
  
  // check for multiple tokens that start with partial bits of the search string
  const partialLabelTokensData = tryPartialMatchTokens(awsServiceSearchMeta.labelTokens, searchStrNorm);
  if (partialLabelTokensData) {
    awsServiceSearchData.partialLabelTokensData = partialLabelTokensData;
    return awsServiceSearchData;
  }
  
  return null;
}

function tryExactMatchTokens(tokens, searchStr) {
  for (let i = 0; i < tokens.length; ++i) {
    const token = tokens[i];
    
    if (token.tokenStr === searchStr) {
      const exactMatchTokenData = {
        token,
        tokenIndex: i,
        matchedStrPart: token.strPart
      };
      return exactMatchTokenData;
    }
  }
  
  return null;
}

function tryStartingMatchToken(tokens, searchStr) {
  for (let i = 0; i < tokens.length; ++i) {
    const token = tokens[i];
    
    if (token.tokenStr.indexOf(searchStr) !== 0) {
      continue;
    }
    
    const matchedStrPartIndex  = token.strPart.index;
    const matchedStrPartLength = searchStr.length;
    
    const matchedStrPart = {
      index : matchedStrPartIndex,
      length: matchedStrPartLength,
      substr: token.strPart.substr.substr(0, matchedStrPartLength)
    };
    
    const startingTokenData = {
      token,
      tokenIndex: i,
      matchedStrPart
    };
    return startingTokenData;
  }
  
  return null;
}

function tryPartialMatchTokens(tokens, searchStr, tokenIndex = 0, searchStrIndex = 0) {
  // check if we already matched the entire search string
  if (searchStrIndex >= searchStr.length) {
    // the solution is valid!
    const partialTokensData = [];
    return partialTokensData;
  }
  
  if (tokenIndex >= tokens.length) {
    // this should only happen if this function was initally called with an out-of-bound index
    return null;
  }
  
  const token = tokens[tokenIndex];
  const tokenStr = token.tokenStr;
  const remainingStrLength = searchStr.length - searchStrIndex;
  
  // try all possible combinations by trying different amounts of each token (diffrent sized partial tokens)
  // 
  // the entire string has to be matched by tokens. Therefore, the partial token must be of a length such
  // that the remaining tokens could match the rest of the string. example:
  // - lets say the search string is 10 characters long
  // - there are 4 tokens
  // - we are on the 2nd token and have already matched the first 2 characters so there are 8 characters left to match
  // - the next 2 tokens have lengths of 2 and 3 so combined they can match at most 5 characters
  // - that means this token (the 2nd) must match at least 3 (8 - 5 = 3) characters for this solution to be possible 
  const remainingTokensLengthSum = tokens.reduce((sum, token) => sum + token.tokenStr.length, 0);
  const minLength = Math.max(remainingStrLength - remainingTokensLengthSum, 0); // the min length should never be less than 0
  
  // if the min length is larger than the token's length, then the solution is invalid
  if (minLength > tokenStr.length) {
    // go back to the previous token and try a different amount
    return null;
  }
  
  // we can't match past the end of the search string so the max length is the number of remaining
  // characters
  const maxLength = Math.min(tokenStr.length, remainingStrLength);
  
  for (let partialTokenLength = maxLength; partialTokenLength >= minLength; --partialTokenLength) {
    const partialTokenStr = tokenStr.substring(0, partialTokenLength);
    
    // check if the partial token exists at the current search string position
    // (or if the partial token is empty which means we are skipping the token)
    if (
      partialTokenStr.length > 0 &&
      searchStr.indexOf(partialTokenStr, searchStrIndex) !== searchStrIndex
    ) {
      // it doesn't, try a different amount of the token (a smaller partial token)
      continue;
    }
    
    // it does, we have a potential solution
    const matchedStrPartIndex  = token.strPart.index;
    const matchedStrPartLength = partialTokenStr.length;
    
    const matchedStrPart = {
      index : matchedStrPartIndex,
      length: matchedStrPartLength,
      substr: token.strPart.substr.substr(0, matchedStrPartLength)
    };
    
    const partialTokenData = {
      token,
      partialTokenStr,
      tokenIndex,
      searchStrIndex,
      matchedStrPart
    };
    
    let newSearchStrIndex = searchStrIndex + partialTokenStr.length;
    
    // check if we matched the entire search string
    if (newSearchStrIndex >= searchStr.length) {
      // we found a valid solution!
      // Note: it is impossible to get here if we are skipping the token
      const partialTokensData = [partialTokenData];
      return partialTokensData;
    }
    
    // we have not yet match the entire seach string
    // check if the rest of the tokens can match the rest of the search string
    const partialTokensData = tryPartialMatchTokens(tokens, searchStr, tokenIndex + 1, newSearchStrIndex);
    if (!partialTokensData) {
      // the rest of the tokens were not able to partially match the rest of the string
      // try a different amount of the token (a smaller partial token)
      continue;
    }
    
    // the rest of the tokens matched the rest of the string
    // the solution is valid
    // add the partial token data to the result (if we aren't skipping the token)
    if (partialTokenStr.length > 0) {
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
    
    weight += partialTokenData.matchedStrPart.length * (partialTokenData.tokenIndex + 1);
  }
  
  return weight;
}



function tokenizeStr(str) {
  // split string into token parts
  const strParts = [];
  
  // split on whitespace
  const wStrParts = splitOnWhitespace(str);
  
  // split cammel case
  for (let i = 0; i < wStrParts.length; ++i) {
    const wStrPart = wStrParts[i];
    
    // only split cammel case if the part is at least 4 characters
    if (wStrPart.substr.length < 4) {
      strParts.push(wStrPart);
      continue;
    }
    
    const cStrParts = splitOnCammelCase(wStrPart.substr);
    
    for (let j = 0; j < cStrParts.length; ++j) {
      const cStrPart = cStrParts[j];
      
      // make the parts relative to the original string
      cStrPart.index += wStrPart.index;
      strParts.push(cStrPart);
    }
  }
  
  // create tokens from the parts
  const tokens = strParts.map(strPart => {
    return {
      strPart,
      tokenStr: normalizeStr(strPart.substr)
    };
  });
  
  return tokens;
}

function splitOnWhitespace(str) {
  const strParts = [];
  let lastWhitespaceIndex = -1;
  
  const regex = /\s+/g;
  let result;
  while ((result = regex.exec(str))) {
    const nextWhitespaceIndex = result.index;
    
    // use all the characters between the last whitespace and the next white space
    const strPartIndex  = lastWhitespaceIndex + 1;
    const strPartLength = nextWhitespaceIndex - strPartIndex; 
    
    // set the last whitespace for the next itteration
    lastWhitespaceIndex = result.index + result[0].length - 1;
    
    // skip empty parts (this should only happen if the string starts with whitespace)
    if (strPartLength === 0) {
      continue;
    }
    
    const strPart = {
      index : strPartIndex,
      length: strPartLength,
      substr: str.substr(strPartIndex, strPartLength)
    };
    strParts.push(strPart);
  }
  
  // add the part after the last whitespace
  const strPartIndex  = lastWhitespaceIndex + 1;
  const strPartLength = str.length - strPartIndex;
  
  // skip empty parts (this should only happen if the string ends with whitespace or is empty)
  if (strPartLength > 0) {
    const strPart = {
      index : strPartIndex,
      length: strPartLength,
      substr: str.substr(strPartIndex, strPartLength)
    };
    strParts.push(strPart);
  }
  
  return strParts;
}

function splitOnCammelCase(str) {
  const strParts = [];
  
  let lastIndex = 0;
  for (let i = 1; i < str.length; ++i) {
    const char1 = str.charCodeAt(i - 1);
    const char2 = str.charCodeAt(i);
    
    if (
      char1 >= 97/*a*/ && char1 <= 122/*z*/ &&
      char2 >= 65/*A*/ && char2 <= 90 /*Z*/
    ) {
      const strPartIndex = lastIndex;
      const strPartLength = i - strPartIndex;
      
      const strPart = {
        index : strPartIndex,
        length: strPartLength,
        substr: str.substr(strPartIndex, strPartLength)
      };
      strParts.push(strPart);
      
      lastIndex = i;
    }
  }
  
  const strPartIndex = lastIndex;
  const strPartLength = str.length - strPartIndex;
  
  // skip empty parts (this should only happen if the string is empty)
  if (strPartLength > 0) {
    const strPart = {
      index : strPartIndex,
      length: strPartLength,
      substr: str.substr(strPartIndex, strPartLength)
    };
    strParts.push(strPart);
  }
  
  return strParts;
}

function createAWSServiceSearchResults(awsServicesSearchData) {
  return awsServicesSearchData.map(createAWSServiceSearchResult);
}
function createAWSServiceSearchResult(awsServiceSearchData) {
  // get the AWS service object
  const awsService = awsServiceSearchData.awsServiceSearchMeta.awsService;
  
  // get the parts of the string that were matched
  const matchedLabelStrParts = [];
  
  if (awsServiceSearchData.exactMatchLabelTokenData) {
    matchedLabelStrParts.push(awsServiceSearchData.exactMatchLabelTokenData.matchedStrPart);
  }
  else if (awsServiceSearchData.startingLabelTokenData) {
    matchedLabelStrParts.push(awsServiceSearchData.startingLabelTokenData.matchedStrPart);
  }
  else if (awsServiceSearchData.partialLabelTokensData) {
    for (let i = 0; i < awsServiceSearchData.partialLabelTokensData.length; ++i) {
      const partialLabelTokenData = awsServiceSearchData.partialLabelTokensData[i];
      
      matchedLabelStrParts.push(partialLabelTokenData.matchedStrPart);
    }
  }
  
  const awsServiceSearchResult = {
    awsService,
    matchedLabelStrParts
  };
  return awsServiceSearchResult;
}


function normalizeStr(str) {
  // lowercase
  return str.toLowerCase();
}


module.exports = {
  init,
  search
};