/** UNEXECUTED augmentation: append after the existing SC09 fixture has bound
 * QS-WALL-A and QS-WALL-B. No fixture/store writes and no assumed full-hash text.
 * Root's final DANS1 snapshot must run this and inspect the captured screenshots. */
const disclosure = '[data-testid="qs-binding-provenance-QS-WALL-A"]';
const captures = 'proof/growth/2026-09-19-sc09-provenance-disclosure/captures';
export default [
  ['set', 'viewport', '1024', '768'],
  ['eval', `(() => {
    const details = document.querySelector('${disclosure}');
    if (!details) throw Error('Bound-row full provenance disclosure is missing');
    const summary = details.querySelector('summary');
    summary.scrollIntoView({block:'center',inline:'nearest'});
    if (details.open) summary.click();
    return { initiallyClosed: !details.open };
  })()`],
  ['find', 'role', 'DisclosureTriangle', 'click', '--name', 'Full binding provenance for QS-WALL-A', '--exact'],
  ['wait', '--fn', `document.querySelector('${disclosure}')?.open === true`],
  ['eval', `(() => {
    const details = document.querySelector('${disclosure}');
    const row = details.closest('[data-testid^="qs-binding-row-"]');
    const pane = details.closest('.studio-main');
    const summary = details.querySelector('summary'), control = summary.getBoundingClientRect();
    if (control.width < 44 || control.height < 44) throw Error('Full provenance control is below 44px');
    const geometry = details.querySelector('[data-qs-binding-hash="geometry"]');
    const source = details.querySelector('[data-qs-binding-hash="source"]');
    const hash = geometry.textContent.trim(), sourceHash = source.textContent.trim();
    if (!/^[a-f0-9]{64}$/.test(hash) || !/^[a-f0-9]{64}$/.test(sourceHash)) throw Error('A full unabridged SHA-256 is not visible');
    const shortened = row.querySelector('.qs-binding-entity > span[title]');
    if (shortened?.getAttribute('title') !== hash) throw Error('Full geometry hash differs from recorded overview identity');
    if (window.__SC09_PROOF__?.sourceSha256 !== sourceHash) throw Error('Full source hash differs from exact fixture bytes');
    for (const element of [geometry, source]) {
      const range = document.createRange(); range.selectNodeContents(element);
      const cell = element.closest('td').getBoundingClientRect();
      for (const rect of range.getClientRects()) if (rect.left < cell.left - 1 || rect.right > cell.right + 1) throw Error('Full hash text clips beyond its evidence cell');
      if (element.scrollWidth > element.clientWidth + 1) throw Error('Full hash has hidden horizontal overflow');
    }
    if (pane.scrollWidth > pane.clientWidth + 1) throw Error('Expanded provenance overflows the estimate pane');
    details.scrollIntoView({block:'center',inline:'nearest'});
    return {geometrySha256:hash,sourceSha256:sourceHash,width:control.width,height:control.height,status:row.dataset.bindingStatus};
  })()`],
  ['screenshot', `${captures}/sc09-full-binding-provenance-tablet-1024x768.png`],
  ['find', 'role', 'DisclosureTriangle', 'click', '--name', 'Full binding provenance for QS-WALL-A', '--exact'],
  ['eval', `(() => {
    const footer = document.querySelector('.workspace-diagnostics');
    const toggle = footer?.querySelector('.workspace-diagnostics-toggle');
    if (!footer || !toggle) throw Error('Diagnostics footer is missing');
    window.__SC09_DIAGNOSTICS_WAS_OPEN__ = toggle.getAttribute('aria-expanded') === 'true';
    if (window.__SC09_DIAGNOSTICS_WAS_OPEN__) toggle.click();
    return true;
  })()`],
  ['wait', '--fn', `document.querySelector('.workspace-diagnostics-toggle')?.getAttribute('aria-expanded') === 'false'`],
  ['eval', `(() => {
    const footer = document.querySelector('.workspace-diagnostics');
    const toggle = footer.querySelector('.workspace-diagnostics-toggle');
    const box = toggle.getBoundingClientRect(), bounds = footer.getBoundingClientRect();
    if (document.getElementById('workspace-diagnostics-content')) throw Error('Collapsed diagnostics unexpectedly retains visible content');
    if (box.left < bounds.left - 1 || box.right > bounds.right + 1 || box.top < bounds.top - 1 || box.bottom > bounds.bottom + 1 || box.bottom > innerHeight + 1) throw Error('Collapsed diagnostics toggle is actually clipped');
    return {collapsed:true,footer:[bounds.left,bounds.top,bounds.width,bounds.height],toggle:[box.left,box.top,box.width,box.height]};
  })()`],
  ['find', 'role', 'button', 'click', '--name', 'Expand workspace diagnostics', '--exact'],
  ['wait', '--fn', `document.querySelector('.workspace-diagnostics-toggle')?.getAttribute('aria-expanded') === 'true' && document.getElementById('workspace-diagnostics-content')`],
  ['eval', `(() => {
    const footer = document.querySelector('.workspace-diagnostics'), bounds = footer.getBoundingClientRect();
    const bar = footer.querySelector('.workspace-diagnostics-bar');
    const content = document.getElementById('workspace-diagnostics-content');
    if (footer.scrollWidth > footer.clientWidth + 1 || bar.scrollWidth > bar.clientWidth + 1) throw Error('Expanded diagnostics header overflows');
    for (const control of bar.querySelectorAll('button')) {
      const box = control.getBoundingClientRect();
      if (box.left < bounds.left - 1 || box.right > bounds.right + 1 || box.bottom > innerHeight + 1) throw Error('Expanded diagnostics control is clipped: '+control.textContent.trim());
    }
    if (content.scrollHeight > content.clientHeight + 1 && !/auto|scroll/.test(getComputedStyle(content).overflowY)) throw Error('Expanded diagnostics content is clipped instead of scrollable');
    return {expanded:true,headerWidth:bar.clientWidth,headerContent:bar.scrollWidth,contentHeight:content.clientHeight,contentScrollHeight:content.scrollHeight};
  })()`],
  ['screenshot', `${captures}/sc09-diagnostics-expanded-tablet-1024x768.png`],
  ['eval', `(() => { const toggle=document.querySelector('.workspace-diagnostics-toggle'); if(!window.__SC09_DIAGNOSTICS_WAS_OPEN__ && toggle?.getAttribute('aria-expanded')==='true') toggle.click(); return true; })()`],
];
