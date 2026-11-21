/* Optional enhancements. The text, contents and image links also work offline without JS. */
(() => {
  const toc = document.getElementById('paper-toc');
  const desktop = window.matchMedia('(min-width: 1024px)');
  if (toc) {
    const setContentsLayout = () => { toc.open = desktop.matches; };
    setContentsLayout();
    desktop.addEventListener('change', setContentsLayout);
    toc.addEventListener('click', event => {
      if (!desktop.matches && event.target.closest('a[href^="#"]')) toc.open = false;
    });
  }

  const viewer = document.getElementById('image-viewer');
  const image = document.getElementById('image-viewer-image');
  const imageLink = document.getElementById('image-viewer-link');
  const closeButton = document.getElementById('image-viewer-close');
  if (!viewer || typeof viewer.showModal !== 'function') return;
  let origin = null;

  document.addEventListener('click', event => {
    const link = event.target.closest('a[data-image-zoom]');
    if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const preview = link.querySelector('img');
    if (!preview) return;
    event.preventDefault();
    origin = link;
    image.src = link.href;
    image.alt = preview.alt;
    imageLink.href = link.href;
    document.documentElement.classList.add('image-viewer-open');
    viewer.showModal();
  });
  closeButton.addEventListener('click', () => viewer.close());
  viewer.addEventListener('click', event => {
    if (event.target !== viewer) return;
    const rect = viewer.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) viewer.close();
  });
  viewer.addEventListener('close', () => {
    document.documentElement.classList.remove('image-viewer-open');
    image.removeAttribute('src');
    origin?.focus();
  });
})();
