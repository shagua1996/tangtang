"""Verify actual PDF rows, page fill and bounds after node tests/print.cjs.

Requires PyMuPDF (may be installed locally into test-results/pdf-tools).
"""
import json
import sys
from collections import defaultdict
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / 'test-results/pdf-tools'))
import pymupdf

proof = []
for name, count, kind in [
    (f'PAGINATION-{sample}-{kind}', 18 if sample == 18 else 60, kind)
    for sample in [18, 60, 'WRAPPED'] for kind in ['sale', 'production']
] + [('production', 10000, 'production')]:
    with pymupdf.open(root / f'test-results/{name}.pdf') as document:
        sequence = []
        bottoms = []
        all_text = ''
        for index, page in enumerate(document):
            assert abs(page.rect.width - 595) < 1 and abs(page.rect.height - 842) < 1
            text = page.get_text()
            all_text += text
            assert '客户名称' in text and '门板尺寸' in text, f'{name}: repeated table header missing'
            words = page.get_text('words')
            cells = defaultdict(list)
            for word in words:
                if word[0] < 55 and word[4].isdigit():
                    cells[word[5]].append(word[4])
                assert word[0] >= 27 and word[2] <= page.rect.width - 26, (name, index, word)
                assert word[1] >= 27 and word[3] <= page.rect.height - 26, (name, index, word)
            sequence.extend(int(''.join(parts)) for parts in cells.values())
            bottom = max(word[3] for word in words)
            bottoms.append(round(bottom, 1))
            if index < len(document) - 1:
                # At most the next complete wrapped row is left unused, not half a sheet.
                assert bottom > page.rect.height - 100, (name, index, bottom)
        assert sequence == list(range(1, count + 1)), f'{name}: missing/duplicated/split row numbers'
        if kind == 'sale':
            for label in ['合计金额', '应付金额', '实付金额', '销售单位', '收货人']:
                assert all_text.count(label) == 1, (name, label)
        if name == 'production':
            assert 'LAST-LINE-10000' in ''.join(all_text.split())
        else:
            document[0].get_pixmap(matrix=pymupdf.Matrix(1, 1)).save(root / f'test-results/{name}.png')
        proof.append({'file': name, 'pages': len(document), 'rows': count, 'bottomsPt': bottoms})
(root / 'test-results/pagination-proof.json').write_text(json.dumps(proof, indent=2), encoding='utf-8')
print(json.dumps([dict(file=p['file'], pages=p['pages'], rows=p['rows']) for p in proof]))
