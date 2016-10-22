module.exports = function stopEvent(event) {
  if (event.preventDefault) {
    event.preventDefault();
  }
  if (event.stopPropagation) {
    event.stopPropagation();
  }
  event.cancelBubble = true;
};