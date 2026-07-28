import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = process.cwd();
const noise = m => /Could not load/i.test(String(m));

async function boot(file, query='') {
  const vc = new VirtualConsole();
  const errs=[]; vc.on('jsdomError', e=>{ if(!noise(e.message)) errs.push(e.message); });
  const dom = new JSDOM(readFileSync(resolve(root,file),'utf8'), {
    runScripts:'dangerously', resources:'usable', virtualConsole:vc, pretendToBeVisual:true,
    url: pathToFileURL(resolve(root,file)).href + (query?'?'+query:'') });
  await new Promise(r=>{ dom.window.addEventListener('load', r); setTimeout(r,900); });
  return {dom, doc:dom.window.document, errs};
}
let fail=0;
const t=(name,cond,extra='')=>{ console.log((cond?'ok    ':'FAIL  ')+name+(cond?'':'  '+extra)); if(!cond) fail++; };

// --- PLP: deep link by category
{
  const {doc} = await boot('collection.html','cat=Tennis%20Necklaces');
  const n = doc.querySelectorAll('#plpGrid .card').length;
  t('PLP deep-links to a category', doc.querySelector('#plpTitle').textContent==='Tennis Necklaces');
  t('PLP shows only that category', n>0 && n<=9, `got ${n}`);
  t('PLP renders an active-filter chip', !!doc.querySelector('#activeChips .chip'));
}
// --- PLP: price cap + sort
{
  const {dom,doc} = await boot('collection.html','max=999');
  const count = doc.querySelector('#plpCount').textContent;
  t('PLP price cap filters', /piece/.test(count), count);
  const sel = doc.querySelector('#plpSort'); sel.value='high';
  sel.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
  const first = doc.querySelector('#plpGrid .card .price__now')?.textContent;
  t('PLP re-sorts on change', !!first, String(first));
}
// --- PLP: clear all
{
  const {dom,doc} = await boot('collection.html','cat=Heart%20Necklaces');
  doc.querySelector('[data-clear="all"]').dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true}));
  t('PLP clear-all restores full catalogue', doc.querySelector('#plpCount').textContent.startsWith('13'), doc.querySelector('#plpCount').textContent);
}
// --- Checkout: rejects empty, flags bad phone
{
  const {dom,doc} = await boot('checkout.html');
  const form = doc.querySelector('#coForm');
  form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
  t('Checkout blocks an empty form', doc.querySelectorAll('.field--error').length>0);
  doc.querySelector('#fn').value='Aanya'; doc.querySelector('#ln').value='K';
  doc.querySelector('#em').value='a@b.com'; doc.querySelector('#ph').value='12345';
  doc.querySelector('#ad').value='12 Road'; doc.querySelector('#ct').value='Pune';
  doc.querySelector('#pc').value='411001';
  form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
  t('Checkout rejects an invalid phone', doc.querySelector('#ph').closest('.field').classList.contains('field--error'));
}
// --- PDP: swatch + qty
{
  const {dom,doc} = await boot('product.html','p=ad-solitaire-radiance');
  t('PDP renders the right product', doc.querySelector('#pdpInfo h1').textContent==='Radiance Solitaire Necklace');
  doc.querySelector('#qtyUp').dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true}));
  t('PDP quantity stepper increments', doc.querySelector('#qtyVal').textContent==='2');
  const sws = doc.querySelectorAll('#pdpSwatches .swatch');
  t('PDP offers more than one finish', sws.length > 1, String(sws.length));
  const sw = sws[sws.length - 1];
  sw.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true}));
  t('PDP finish swatch updates label', doc.querySelector('#finishLabel').textContent===sw.dataset.finish);
  doc.querySelector('#pdpAdd').dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true}));
  t('PDP add-to-bag updates badge', doc.querySelector('#cartCount').textContent==='2', doc.querySelector('#cartCount').textContent);
}
console.log(`\n${fail} failure(s)`);
process.exit(fail?1:0);
