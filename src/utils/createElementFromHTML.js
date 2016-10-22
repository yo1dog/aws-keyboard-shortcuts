module.exports = function createElementFromHTML(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.firstChild;
};