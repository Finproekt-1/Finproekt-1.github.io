"""Обложки статей 1200×670 в фирменном стиле.
Запуск из папки _src:  python3 tools/make_covers.py tools/covers.txt
Формат строки covers.txt:  slug|Строка 1 (тёмная)|Строка 2 (бирюзовая)|Подзаголовок через ·|рисунок
рисунок: bars, line, donut, calendar, coins, scales, chip
Результат: static/img/cover-<slug>.webp — затем укажите "cover": "/img/cover-<slug>.webp" в статье.
Нужны: playwright (chromium), Pillow.
"""
import asyncio, os, sys
from playwright.async_api import async_playwright
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(HERE, '..', 'static', 'img')
T='#3aa99b'; L='#a9dad2'
deco={
'bars':f'<svg width="240" height="260"><rect x="0" y="120" width="40" height="120" rx="6" fill="{L}"/><rect x="60" y="60" width="40" height="180" rx="6" fill="{L}"/><rect x="120" y="90" width="40" height="150" rx="6" fill="{L}"/><rect x="180" y="0" width="40" height="240" rx="6" fill="{T}"/></svg>',
'line':f'<svg width="260" height="240"><polyline points="10,200 70,150 130,170 190,80 250,30" fill="none" stroke="{T}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><circle cx="250" cy="30" r="16" fill="{T}"/><line x1="10" y1="230" x2="250" y2="230" stroke="{L}" stroke-width="6" stroke-linecap="round"/></svg>',
'donut':f'<svg width="240" height="240" viewBox="0 0 42 42"><circle cx="21" cy="21" r="15.9" fill="none" stroke="{L}" stroke-width="6"/><circle cx="21" cy="21" r="15.9" fill="none" stroke="{T}" stroke-width="6" stroke-dasharray="65 35" stroke-dashoffset="25"/></svg>',
'calendar':f'<svg width="250" height="240"><rect x="5" y="20" width="240" height="210" rx="18" fill="none" stroke="{L}" stroke-width="8"/><rect x="5" y="20" width="240" height="50" rx="18" fill="{L}"/>'+''.join(f'<rect x="{25+c*55}" y="{90+r*45}" width="38" height="30" rx="6" fill="{T if (r,c)==(1,2) else L}"/>' for r in range(3) for c in range(4))+'</svg>',
'coins':f'<svg width="240" height="250">'+''.join(f'<rect x="{20+i*75}" y="{200-h}" width="60" height="{h}" rx="30" fill="{T if i==2 else L}"/>' for i,h in enumerate([90,140,200]))+'</svg>',
'scales':f'<svg width="250" height="240"><line x1="125" y1="20" x2="125" y2="220" stroke="{T}" stroke-width="10" stroke-linecap="round"/><line x1="30" y1="60" x2="220" y2="60" stroke="{T}" stroke-width="10" stroke-linecap="round"/><path d="M0 140 L30 60 L60 140 Z" fill="{L}"/><path d="M190 140 L220 60 L250 140 Z" fill="{L}"/><rect x="70" y="210" width="110" height="18" rx="9" fill="{L}"/></svg>',
'chip':f'<svg width="240" height="240"><rect x="50" y="50" width="140" height="140" rx="20" fill="{T}"/><rect x="85" y="85" width="70" height="70" rx="10" fill="#fff"/>'+''.join(f'<rect x="{65+i*30}" y="15" width="12" height="35" rx="6" fill="{L}"/><rect x="{65+i*30}" y="190" width="12" height="35" rx="6" fill="{L}"/><rect x="15" y="{65+i*30}" width="35" height="12" rx="6" fill="{L}"/><rect x="190" y="{65+i*30}" width="35" height="12" rx="6" fill="{L}"/>' for i in range(4))+'</svg>',
}
def html(l1,l2,sub,d):
    return f'''<html><head><style>body{{margin:0;width:1200px;height:670px;background:#eef7f5;font-family:Inter,"Helvetica Neue",Arial,sans-serif;
    background-image:linear-gradient(#e2efec 1px,transparent 1px),linear-gradient(90deg,#e2efec 1px,transparent 1px);background-size:40px 40px}}
    .card{{position:absolute;left:60px;top:60px;width:1080px;height:550px;background:#fff;border:3px solid #cfe7e2;border-radius:36px}}
    .logo{{position:absolute;left:50px;top:40px;height:80px}} .t{{position:absolute;left:50px;top:170px;width:700px}}
    h1{{margin:0;font-size:66px;line-height:1.12;font-weight:900;color:#17202b;letter-spacing:-1px}} h1 span{{color:{T}}}
    p{{margin:28px 0 0;font-size:28px;color:#4b5563}} .d{{position:absolute;right:60px;bottom:50px}}</style></head>
    <body><div class="card"><img class="logo" src="file://{os.path.abspath(os.path.join(IMG,"logo.webp"))}"><div class="t"><h1>{l1}<br><span>{l2}</span></h1><p>{sub}</p></div><div class="d">{deco[d]}</div></div></body></html>'''
async def main(path):
    items = [l.split('|') for l in open(path, encoding='utf-8').read().strip().split('\n') if l.strip()]
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1200, 'height': 670})
        tmp = os.path.join(HERE, '_cover.html')
        for slug, l1, l2, sub, d in items:
            open(tmp, 'w', encoding='utf-8').write(html(l1, l2, sub, d.strip()))
            await pg.goto('file://' + tmp); await pg.wait_for_timeout(200)
            png = os.path.join(HERE, '_cover.png'); await pg.screenshot(path=png)
            Image.open(png).convert('RGB').save(os.path.join(IMG, f'cover-{slug}.webp'), 'WEBP', quality=85)
            print('ok', slug)
        await b.close()
        for f in ('_cover.html', '_cover.png'):
            if os.path.exists(os.path.join(HERE, f)): os.remove(os.path.join(HERE, f))
asyncio.run(main(sys.argv[1]))
