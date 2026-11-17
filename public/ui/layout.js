let activeTab = 'build';
export function selectTab(tab, focus = false) {
  if (!['build', 'customers', 'events', 'goals'].includes(tab)) return;
  activeTab = tab;
  for (const panel of document.querySelectorAll('[data-tab]')) panel.classList.toggle('tab-active', panel.dataset.tab === tab);
  for (const button of document.querySelectorAll('[data-action="tab"]')) button.setAttribute('aria-pressed', String(button.dataset.value === tab));
  const panel = document.querySelector(`[data-tab="${tab}"]`);
  if (focus && panel) {
    panel.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    panel.setAttribute('tabindex', '-1'); panel.focus({ preventScroll: true });
  }
}
export function setupLayout() {
  function update() {
    const width = window.innerWidth;
    document.documentElement.dataset.layout = width < 600 ? 'compact' : width < 1024 ? 'medium' : width <= 1920 ? 'wide' : 'ultra';
    selectTab(activeTab);
  }
  let queued = false;
  window.addEventListener('resize', () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; update(); }); } }, { passive: true });
  update();
}
