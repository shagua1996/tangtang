"""Independent PDF verification; run after tests/print.cjs with PyMuPDF installed."""
import json
import sys
from collections import defaultdict
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / 'test-results/pdf-tools'))
import pymupdf

out = root / 'test-results/coverage-2026-11-17'
out.mkdir(parents=True, exist_ok=True)
proof = {}
for kind in ['sale', 'production', 'label']:
    with pymupdf.open(root / f'test-results/{kind}.pdf') as document:
        assert all(page.rect.width < page.rect.height for page in document)
        text = ''.join(page.get_text() for page in document)
        proof[kind] = {'pages': len(document), 'widthPt': document[0].rect.width, 'heightPt': document[0].rect.height}
        if kind == 'production':
            sequence = []
            wrapped_numbers = 0
            for page in document:
                # Narrow portrait sequence cells wrap 4+ digits onto separate lines.
                # Reassemble only words from the same PDF text block and first column.
                cells = defaultdict(list)
                for word in page.get_text('words'):
                    if word[0] < 55 and word[4].isdigit():
                        cells[word[5]].append(word[4])
                sequence.extend(int(''.join(parts)) for parts in cells.values())
                wrapped_numbers += sum(len(parts) > 1 for parts in cells.values())
            assert sequence == list(range(1, 10001)), 'PDF must contain exactly rows 1..10000 in order'
            assert 'LAST-LINE-10000' in ''.join(text.split())
            assert all('芃悦居木门生产单' in page.get_text() for page in document)
            proof[kind].update(rows=len(sequence), continuous=True, repeatedChineseTitle=True, finalMarker=True, wrappedSequenceCells=wrapped_numbers)
            document[0].get_pixmap(matrix=pymupdf.Matrix(1, 1)).save(out / 'production-first.png')
            document[-1].get_pixmap(matrix=pymupdf.Matrix(1, 1)).save(out / 'production-last.png')
        elif kind == 'sale':
            assert '芃悦居木门销售单' in text
            document[0].get_pixmap().save(out / 'sale-first.png')
        else:
            assert '客户名称' in text and '900*2100*150' in text
            proof[kind]['caveat'] = 'A4 PDF carrier only; physical label stock and driver dimensions are not validated.'
            document[0].get_pixmap().save(out / 'label-first.png')
(out / 'pdf-proof.json').write_text(json.dumps(proof, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(proof, ensure_ascii=True))
