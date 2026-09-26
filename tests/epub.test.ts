import {test} from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {JSDOM} from 'jsdom';
import {parseEpub} from '../src/utils/epubParser.ts';

test('parses EPUB metadata and readable chapters in spine order', async () => {
  const previousParser = globalThis.DOMParser;
  Object.assign(globalThis, {DOMParser: new JSDOM('').window.DOMParser});
  try {
    const zip = new JSZip();
    zip.file('META-INF/container.xml', '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/book.opf"/></rootfiles></container>');
    zip.file('OEBPS/book.opf', '<package xmlns="http://www.idpf.org/2007/opf"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Test Library</dc:title><dc:creator>Reader</dc:creator></metadata><manifest><item id="two" href="text/two.xhtml" media-type="application/xhtml+xml"/><item id="one" href="text/one.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="text/nav.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="one"/><itemref idref="nav" linear="no"/><itemref idref="two"/></spine></package>');
    zip.file('OEBPS/text/one.xhtml', '<html><body><h1>Opening</h1><p>First &amp; complete chapter.</p><script>ignore this</script></body></html>');
    zip.file('OEBPS/text/two.xhtml', '<html><body><h1>Ending</h1><p>Last chapter remains readable.</p></body></html>');
    zip.file('OEBPS/text/nav.xhtml', '<html><body><nav>Do not read this</nav></body></html>');
    const bytes = await zip.generateAsync({type:'arraybuffer'});
    const book = await parseEpub(bytes, 'sample.epub');
    assert.equal(book.title, 'Test Library');
    assert.equal(book.author, 'Reader');
    assert.deepEqual(book.chapters.map(chapter => chapter.title), ['Opening', 'Ending']);
    assert.match(book.chapters[0].content, /First & complete chapter/);
    assert.doesNotMatch(book.chapters[0].content, /ignore this/);
  } finally {
    if (previousParser) Object.assign(globalThis, {DOMParser: previousParser});
    else delete (globalThis as any).DOMParser;
  }
});

test('rejects corrupt archives with a useful import error', async () => {
  await assert.rejects(parseEpub(new TextEncoder().encode('not an epub').buffer), /valid ePub or zip archive/);
});
