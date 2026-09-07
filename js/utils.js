export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getRelativePos(el, containerEl) {
  const elRect = el.getBoundingClientRect();
  const containerRect = containerEl.getBoundingClientRect();
  return { left: elRect.left - containerRect.left, top: elRect.top - containerRect.top };
}
