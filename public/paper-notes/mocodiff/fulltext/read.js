import { getDocument, GlobalWorkerOptions } from './vendor/pdf.min.js';

GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.js', import.meta.url).href;
const paper = 'https://openaccess.thecvf.com/content/CVPR2026/';
const urls = {
  main: paper + 'papers/Song_MoCoDiff_A_Controllable_Autoregressive_Diffusion_Model_for_Expressive_Motion_Generation_CVPR_2026_paper.pdf',
  supplement: paper + 'supplemental/Song_MoCoDiff_A_Controllable_CVPR_2026_supplemental.zip'
};
const section = new URLSearchParams(location.search).get('part') === 'supplement' ? 'supplement' : 'main';
const isSupplement = section === 'supplement';
const input = document.querySelector('#file');
const forget = document.querySelector('#forget');
const message = document.querySelector('#status');
const article = document.querySelector('#paper-body');
const outline = document.querySelector('#outline');
const sidebar = document.querySelector('.reader-sidebar');
const howto = document.querySelector('#howto');
const link = document.createElement('a');
link.href = urls[section];
link.target = '_blank';
link.rel = 'noopener';
link.textContent = isSupplement ? 'CVF 补充包（ZIP）' : 'CVF 正文（PDF）';
howto.append('首次阅读请下载', link, isSupplement ? '，在此选择这个 ZIP 或其中的 PDF。' : '，在此选择下载的 PDF。', '文字和图表在浏览器内按双栏顺序重排，可使用翻译插件。此浏览器会记住选过的文件。');
document.querySelector('#nav-' + section).setAttribute('aria-current','page');
if (isSupplement) document.title = 'MoCoDiff · 补充材料 HTML 阅读器';
input.accept = isSupplement ? '.pdf,.zip' : '.pdf';
const layout = await fetch('./' + section + '.json').then(r => {
  if (!r.ok) throw new Error('版面文件读取失败，请刷新重试。');
  return r.json();
}).catch(error => {
  message.textContent = '版面信息加载失败，请刷新页面重试。';
  throw error;
});

async function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('mocodiff-reader', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('papers');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function cached(action, file) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('papers', action === 'get' ? 'readonly' : 'readwrite');
      const store = tx.objectStore('papers');
      const request = action === 'put' ? store.put(file, section) : store[action](section);
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

function make(tag, text) {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  return element;
}

function textInBox(items, box) {
  const [,l,b,r,t] = box;
  const lines = [];
  const lineDistance = box[0] === 'cell' ? 4.8 : 2.2;
  const selected = items.filter(item => item.x >= l-1 && item.x <= r+1 && item.cy >= b-1 && item.cy <= t+1);
  selected.sort((a,z) => z.y - a.y || a.left-z.left);
  for (const item of selected) {
    let line = lines[lines.length-1];
    if (!line || Math.abs(line[0].y - item.y) > lineDistance) {
      lines.push([item]);
    } else line.push(item);
  }
  const strings = lines.map(line => {
    line.sort((a,z) => a.left-z.left);
    let text = '';
    let right = -Infinity;
    for (const item of line) {
      if (text && !/\s$/u.test(text) && !/^\s/u.test(item.text) && item.left - right > 1.15) text += ' ';
      text += item.text;
      right = item.left + item.width;
    }
    return text.trim();
  });
  return strings.join('\n').replace(/([a-z])-\n(?=[a-z])/g,'$1').replace(/\s+/gu,' ').normalize('NFKC').trim();
}

function paperCredits() {
  const authors = [['Wenfeng Song','1'],['Xuehan Wang','1'],['Shuai Li','2,3*'],['Yi Chen','4'],['Yuting Guo','1'],['Zhenyu Wu','3'],['Xingliang Jin','5'],['Chenglizhao Chen','6'],['Fei Hou','7,8'],['Hongyu Wu','3'],['Aimin Hao','3,9']];
  const institutions = ['Beijing Information Science and Technology University, China','Zhongguancun Laboratory, China','State Key Laboratory of Virtual Reality Technology and Systems, Beihang University','Beijing Technology and Business University','East China Normal University','College of Computer Science and Technology, China University of Petroleum (East China)','Key Laboratory of System Software (CAS), Institute of Software, Chinese Academy of Sciences','University of Chinese Academy of Sciences','Research Unit of Virtual Human and Virtual Surgery (2019RU004), Chinese Academy of Medical Sciences'];
  const wrapper = make('section');
  const byline = make('p');
  authors.forEach(([name,affiliation],index) => {
    if (index) byline.append(', ');
    byline.append(name,make('sup',affiliation));
  });
  const list = make('ol');
  institutions.forEach(name => list.append(make('li',name)));
  wrapper.append(byline,list,make('p','* Corresponding author'));
  return wrapper;
}

function tableFromCells(items, cells) {
  const table = make('table');
  const rows = new Map();
  for (const [r,c,rowSpan,colSpan,header,l,b,right,t] of cells.slice().sort((a,z) => a[0]-z[0] || a[1]-z[1])) {
    if (!rows.has(r)) rows.set(r,table.insertRow());
    const cell = make(header ? 'th' : 'td', textInBox(items,['cell',l,b,right,t]));
    cell.rowSpan = rowSpan; cell.colSpan = colSpan;
    rows.get(r).append(cell);
  }
  return table;
}

async function crop(source, viewport, box) {
  const [, l, b, r, t] = box;
  const [x1,y1,x2,y2] = viewport.convertToViewportRectangle([l,b,r,t]);
  const x = Math.floor(Math.min(x1,x2)), y = Math.floor(Math.min(y1,y2));
  const w = Math.max(1, Math.ceil(Math.abs(x2-x1))), h = Math.max(1,Math.ceil(Math.abs(y2-y1)));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(source,x,y,w,h,0,0,w,h);
  const blob = await new Promise(resolve => c.toBlob(resolve,'image/png'));
  return URL.createObjectURL(blob);
}

let objectUrls = [];
let pdfDoc;
function clearContent() {
  for (const url of objectUrls) URL.revokeObjectURL(url);
  objectUrls = [];
  article.replaceChildren(); outline.replaceChildren(); sidebar.hidden = true;
  if (pdfDoc) { pdfDoc.destroy(); pdfDoc = undefined; }
}

async function display(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const digest = await crypto.subtle.digest('SHA-256',bytes);
  const fingerprint = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2,'0')).join('');
  if (fingerprint !== layout.fingerprint) throw new Error('文件版本与版面不符，请使用上方 CVF 链接下载的对应文件。');
  clearContent();
  const pdfUrl = URL.createObjectURL(blob);
  objectUrls.push(pdfUrl);
  pdfDoc = await getDocument({data:bytes, isEvalSupported:false, useSystemFonts:true}).promise;
  for (let n=1;n<=pdfDoc.numPages;n++) {
    message.textContent = '正在重排第 ' + n + ' / ' + pdfDoc.numPages + ' 页…';
    const page = await pdfDoc.getPage(n);
    const content = await page.getTextContent();
    const items = content.items.filter(i => i.str?.trim()).map(i => ({
      text:i.str, width:i.width, left:i.transform[4], x:i.transform[4]+i.width/2,
      y:i.transform[5], cy:i.transform[5]+i.height*.28
    })).filter(i => !(isSupplement && /^\d{1,3}$/.test(i.text.trim()) && (i.x < 69 || i.x > 545)));
    const viewport = page.getViewport({scale:1.8});
    const pageBoxes = layout.pages[n-1];
    const fragment = document.createDocumentFragment();
    const pageLink = make('a',(isSupplement ? 'Supplement' : 'Paper') + ' · PDF p. '+n+' ↗');
    pageLink.className = 'page-marker';
    pageLink.id = 'page-' + n;
    pageLink.href = pdfUrl+'#page='+n;
    pageLink.target = '_blank'; pageLink.rel = 'noopener';
    fragment.append(pageLink);
    let canvas;
    for (const [index,box] of pageBoxes.entries()) {
      const label = box[0];
      if (label === 'credits') { fragment.append(paperCredits()); continue; }
      const text = textInBox(items,box);
      if (['picture','table','formula','code'].includes(label)) {
        if (!canvas) {
          canvas = document.createElement('canvas');
          canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
          await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
        }
        const url = await crop(canvas,viewport,box);
        objectUrls.push(url);
        const figure = make('figure');
        const zoom = make('a'); zoom.href = url; zoom.target = '_blank'; zoom.rel = 'noopener';
        const image = make('img'); image.src = url;
        image.alt = 'Original '+label+', PDF page '+n;
        zoom.append(image); figure.append(zoom);
        if (text && label !== 'picture') {
          const detail = make('details');
          detail.append(make('summary',label === 'table' ? 'Read table' : 'Text'),
            label === 'table' && box[5]?.length ? tableFromCells(items,box[5]) : make('p',text));
          figure.append(detail);
        }
        fragment.append(figure);
      } else if (text) {
        if (label === 'section_header') {
          const heading = make('h2',text);
          heading.id = 'section-'+n+'-'+index;
          const toc = make('a',text);
          toc.href = '#'+heading.id;
          const li = make('li'); li.append(toc); outline.append(li);
          fragment.append(heading);
        } else {
          const p=make('p',text); p.className = label; fragment.append(p);
        }
      }
    }
    article.append(fragment); page.cleanup();
  }
  sidebar.hidden = false;
  message.textContent = '已重排 '+pdfDoc.numPages+' 页。点击图表查看原图，点击页码对照 PDF。';
}

async function handleFile(file) {
  forget.disabled = input.disabled = true;
  try {
    let pdf = file;
    if (/\.zip$/i.test(file.name)) {
      if (!isSupplement) throw new Error('请在「补充材料」页面选择 ZIP。');
      const { unzipSync } = await import('./vendor/unzip.js');
      message.textContent = '正在从 CVF 补充包读取 PDF…';
      const files = unzipSync(new Uint8Array(await file.arrayBuffer()),{
        filter: entry => /\.pdf$/i.test(entry.name) && !entry.name.includes('__MACOSX') && entry.originalSize < 30_000_000
      });
      const papers=Object.values(files);
      if (papers.length !== 1) throw new Error('请选择 CVF 的补充 ZIP，或直接选择其中的补充 PDF。');
      pdf = new Blob([papers[0]],{type:'application/pdf'});
    }
    await display(pdf);
    try { await cached('put',pdf); forget.hidden = false; }
    catch { message.textContent += ' 当前浏览器没有保存所选文件。'; }
  } catch (err) { message.textContent = err.message; }
  finally { input.value=''; forget.disabled = input.disabled = false; }
}

input.addEventListener('change', () => { if (input.files[0]) handleFile(input.files[0]); });
forget.addEventListener('click',async () => {
  try { await cached('delete'); clearContent(); forget.hidden = true; message.textContent='已清除本部分的文件。'; }
  catch { message.textContent='文件清除失败，请检查当前浏览器的站点存储设置。'; }
});
try {
  input.disabled = true;
  const stored = await cached('get');
  if (stored) { await display(stored); forget.hidden = false; }
} catch (err) { message.textContent = '可以重新选择 CVF 文件。'; }
finally { input.disabled = false; }
