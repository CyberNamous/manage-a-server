export function setupTooltips() {
  // Native title remains a fallback; focus help also works without a mouse.
  const bubble = document.createElement('div'); bubble.className = 'tooltip-bubble'; bubble.hidden = true; bubble.id = 'control-help'; document.body.append(bubble);
  let owner = null, timer;
  const hide = () => { bubble.hidden = true; if (owner?.getAttribute('aria-describedby') === bubble.id) owner.removeAttribute('aria-describedby'); owner = null; clearTimeout(timer); };
  document.addEventListener('focusin', event => {
    hide(); const element = event.target.closest('[title]'); if (!element) return;
    owner = element; bubble.textContent = element.title; bubble.hidden = false;
    const rect = element.getBoundingClientRect();
    bubble.style.left = `${Math.max(8, Math.min(window.innerWidth - bubble.offsetWidth - 8, rect.left))}px`;
    bubble.style.top = `${Math.max(8, Math.min(window.innerHeight - bubble.offsetHeight - 8, rect.bottom + 8))}px`;
    if (!element.hasAttribute('aria-describedby')) element.setAttribute('aria-describedby', bubble.id);
    timer = setTimeout(hide, 4500);
  });
  document.addEventListener('focusout', hide); document.addEventListener('pointerdown', hide, { passive: true });
  window.addEventListener('scroll', hide, { passive: true, capture: true });
}
