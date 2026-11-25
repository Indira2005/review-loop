// Keep the customer chat fitted to the visible screen when a mobile keyboard opens.
(() => {
  const root = document.documentElement;
  const viewport = window.visualViewport;

  function updateVisibleViewport() {
    const height = viewport ? viewport.height : window.innerHeight;
    const top = viewport ? viewport.offsetTop : 0;
    root.style.setProperty("--visible-viewport-height", `${Math.round(height)}px`);
    root.style.setProperty("--visible-viewport-top", `${Math.round(top)}px`);
  }

  updateVisibleViewport();
  window.addEventListener("resize", updateVisibleViewport, { passive: true });
  if (viewport) {
    viewport.addEventListener("resize", updateVisibleViewport, { passive: true });
    viewport.addEventListener("scroll", updateVisibleViewport, { passive: true });
  }
})();
