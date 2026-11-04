#!/usr/bin/env python3
"""Static site generator for finproekt-1.ru.

Usage: python3 build.py            -> builds ./dist
Content: src/content/blog/*.md (JSON front matter between --- lines),
         src/data/cases.json, reviews.json, site.json, redirects.json.
"""
import json, os, re, shutil, datetime, html, glob
import markdown
from jinja2 import Environment, FileSystemLoader
from markupsafe import Markup

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
DIST = os.path.join(ROOT, 'dist')
site = json.load(open(f'{SRC}/data/site.json'))
ICONS = json.load(open(f'{SRC}/data/icons.json'))
MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря']
import hashlib
VER = hashlib.md5(b''.join(open(f, 'rb').read() for f in sorted(glob.glob(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', '*', '*.*'))))).hexdigest()[:10]


def icon(name, cls=''):
    inner = ICONS.get(name, '')
    return Markup(f'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-{name} {cls}" aria-hidden="true">{inner}</svg>')


def date_ru(d):
    y, m, dd = map(int, d.split('-'))
    return f'{dd} {MONTHS[m-1]} {y}'


env = Environment(loader=FileSystemLoader(f'{SRC}/templates'), autoescape=True)
env.globals.update(icon=icon, site=site)


def partial(name):
    s = open(f'{SRC}/partials/{name}').read()
    s = re.sub(r'\{\{icon:([\w-]+):([^}]*)\}\}', lambda m: str(icon(m.group(1), m.group(2))), s)
    return s


HEADER = partial('header.html')
FOOTER = partial('footer.html')
ORG = {
    "@context": "https://schema.org", "@type": "Organization", "name": site['name'], "url": site['url'],
    "logo": site['url'] + '/img/logo.webp', "telephone": site['phone'], "email": site['email'],
    "sameAs": [site['telegram']],
    "contactPoint": {"@type": "ContactPoint", "telephone": site['phone'], "contactType": "sales", "availableLanguage": "Russian"},
}
pages = []  # (path, lastmod)


def write(path, content_html, title, description, jsonld=None, og_type='website', image=None, lastmod=None, robots=None, sitemap=True):
    if path not in ('/', '/404.html') and not path.endswith('/'):
        path = path + '/'
    page = dict(path=path, title=title, description=description, jsonld=jsonld or [], og_type=og_type, image=image, robots=robots)
    out = env.get_template('base.html').render(page=page, header=Markup(HEADER), footer=Markup(FOOTER), content=Markup(content_html), ver=VER)
    out = re.sub(r'href="(/(?:blog|baza-znanij|cases|privacy|terms|audit|finotdel|cfo|marketplejsy)(?:/[\w%-]+)?)(#[^"]*)?"', lambda m: f'href="{m.group(1)}/{m.group(2) or ""}"', out)
    fp = DIST + (path if path.endswith('.html') else (path.rstrip('/') + '/index.html'))
    os.makedirs(os.path.dirname(fp), exist_ok=True)
    open(fp, 'w').write(out)
    if sitemap:
        pages.append((path, lastmod or datetime.date.today().isoformat()))


def breadcrumbs(items):
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": n, "item": site['url'] + (u if u == '/' else u + '/')} for i, (n, u) in enumerate(items)]}


TODAY = (datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) + datetime.timedelta(hours=3)).date().isoformat()  # Moscow date
SECTIONS = {
    'blog': dict(dir='blog', path='/blog', name='Блог', back='Назад в блог',
                 h1='Экспертные статьи о <span class="text-primary">финансах бизнеса</span>',
                 lead='Полезные материалы от команды ФинПроект-1: управление финансами, налоговое планирование, аудит и рост прибыли.',
                 title='Блог о финансах бизнеса — статьи ФинПроект-1',
                 desc='Статьи об управленческом учёте, финансовом планировании, Cash Flow, кассовых разрывах и росте прибыли. Практические советы от команды ФинПроект-1.'),
    'kb': dict(dir='kb', path='/baza-znanij', name='База знаний', back='Назад в базу знаний',
               h1='База знаний о <span class="text-primary">финансах бизнеса</span>',
               lead='Термины, методики и практические ответы на вопросы собственников: учёт, отчётность, налоги, деньги компании.',
               title='База знаний о финансах бизнеса — ФинПроект-1',
               desc='Справочник для собственников бизнеса: управленческий учёт, P&L, ДДС, баланс, налоги, финансовые показатели и практические инструкции от ФинПроект-1.'),
}


def load_posts(d='blog'):
    posts = []
    for f in glob.glob(f'{SRC}/content/{d}/*.md'):
        raw = open(f).read()
        _, fm, body = raw.split('---', 2)
        p = json.loads(fm)
        if p.get('draft') or p['date'] > TODAY:  # future-dated = scheduled
            continue
        md = markdown.Markdown(extensions=['tables', 'sane_lists', 'smarty'], extension_configs={'smarty': {'substitutions': {'left-double-quote': '«', 'right-double-quote': '»'}}})
        p['html'] = Markup(md.convert(body.strip()))
        p['date_ru'] = date_ru(p['date'])
        posts.append(p)
    posts.sort(key=lambda p: (p['date'], p['slug']), reverse=True)
    return posts


def build():
    if os.path.exists(DIST):
        shutil.rmtree(DIST)
    shutil.copytree(f'{ROOT}/static', DIST)

    # --- home
    reviews = json.load(open(f'{SRC}/data/reviews.json'))
    svc_ld = [{"@context": "https://schema.org", "@type": "Service", "name": s['name'], "provider": {"@type": "Organization", "name": site['name']}, "areaServed": "RU", "offers": {"@type": "Offer", "priceCurrency": "RUB", "description": s['price']}} for s in site['services'][:8]]
    write('/', partial('home_main.html'), site['default_title'], site['default_description'],
          jsonld=[ORG, {"@context": "https://schema.org", "@type": "WebSite", "name": site['name'], "url": site['url']}] + svc_ld)

    # --- preview of the new home structure (noindex, not in sitemap) — until approved
    if os.path.exists(f'{SRC}/partials/home_preview.html'):
        write('/preview', partial('home_preview.html'), 'Предпросмотр главной — ФинПроект-1', site['default_description'], robots='noindex, nofollow', sitemap=False)

    # --- blog + knowledge base
    posts = []
    for key, sec in SECTIONS.items():
        items = load_posts(sec['dir'])
        if key == 'blog':
            posts = items
        if not items and key != 'blog':
            continue
        write(sec['path'], env.get_template('blog_list.html').render(posts=items, sec=sec), sec['title'], sec['desc'],
              jsonld=[breadcrumbs([('Главная', '/'), (sec['name'], sec['path'])])],
              lastmod=items[0].get('updated', items[0]['date']) if items else None)
        for p in items:
            same = [q for q in items if q['slug'] != p['slug']]
            related = same[:4]
            url = site['url'] + sec['path'] + '/' + p['slug'] + '/'
            ld = {"@context": "https://schema.org", "@type": "BlogPosting" if key == 'blog' else "Article", "headline": p['title'], "description": p['meta_description'],
                  "datePublished": p['date'], "dateModified": p.get('updated', p['date']), "inLanguage": "ru",
                  "mainEntityOfPage": url,
                  "author": {"@type": "Organization", "name": site['name']},
                  "publisher": {"@type": "Organization", "name": site['name'], "logo": {"@type": "ImageObject", "url": site['url'] + '/img/logo.webp'}}}
            if p.get('cover'):
                ld['image'] = site['url'] + p['cover']
            jl = [ld, breadcrumbs([('Главная', '/'), (sec['name'], sec['path']), (p['title'], sec['path'] + '/' + p['slug'])])]
            if p.get('faq'):
                jl.append({"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in p['faq']]})
            write(sec['path'] + '/' + p['slug'], env.get_template('blog_post.html').render(p=p, related=related, sec=sec),
                  p['meta_title'], p['meta_description'], og_type='article', image=p.get('cover') or None,
                  jsonld=jl, lastmod=p.get('updated', p['date']))

    # --- cases
    cases = json.load(open(f'{SRC}/data/cases.json'))
    for c in cases:
        ms = c.get('metrics') or []
        main = next((m for m in ms if m.get('before')), ms[0] if ms else None)
        c['main_metric'] = main
        c['other_metrics'] = [m for m in ms if m is not main][:2]
    counts = {}
    for c in cases:
        counts[c['niche']] = counts.get(c['niche'], 0) + 1
    niches = sorted(counts.items(), key=lambda x: -x[1])
    write('/cases', env.get_template('cases_list.html').render(cases=cases, niches=niches),
          'Кейсы клиентов — результаты внедрения финансового отдела | ФинПроект-1',
          'Реальные кейсы ФинПроект-1: рост выручки и прибыли, устранение кассовых разрывов, финансовые модели и налоговое планирование для бизнеса из разных ниш.',
          jsonld=[breadcrumbs([('Главная', '/'), ('Кейсы', '/cases')])])
    for c in cases:
        others = [o for o in cases if o['slug'] != c['slug']][:3]
        desc = (c.get('description') or '')[:155]
        write('/cases/' + c['slug'], env.get_template('case.html').render(c=c, others=others),
              f"{c['title']} — кейс ФинПроект-1", desc,
              jsonld=[breadcrumbs([('Главная', '/'), ('Кейсы', '/cases'), (c['title'], '/cases/' + c['slug'])])],
              lastmod=(c.get('updated_at') or '')[:10] or None)

    # --- service landing pages (draft → noindex, not in sitemap, not linked)
    bys = {c['slug']: c for c in cases}
    for sp in json.load(open(f'{SRC}/data/service_pages.json')):
        sc = [bys[x] for x in sp.get('cases', []) if x in bys]
        jl = [breadcrumbs([('Главная', '/'), (sp['kicker'], '/' + sp['slug'])]),
              {"@context": "https://schema.org", "@type": "Service", "name": sp['service'], "description": sp['meta_description'],
               "provider": {"@type": "Organization", "name": site['name'], "url": site['url']}, "areaServed": "RU",
               "offers": {"@type": "Offer", "priceCurrency": "RUB", "description": sp['price']}},
              {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": re.sub(r'<[^>]+>', '', a)}} for q, a in sp['faq']]}]
        write('/' + sp['slug'], env.get_template('service.html').render(s=sp, cases=sc), sp['meta_title'], sp['meta_description'],
              jsonld=jl, robots='noindex, nofollow' if sp.get('draft') else None, sitemap=not sp.get('draft'))

    # --- legal
    write('/privacy', partial('privacy_main.html'), 'Политика конфиденциальности — ФинПроект-1', 'Политика обработки и защиты персональных данных пользователей сайта ФинПроект-1.', lastmod='2026-03-12')
    write('/terms', partial('terms_main.html'), 'Условия использования — ФинПроект-1', 'Пользовательское соглашение сайта ФинПроект-1.', lastmod='2026-03-12')
    write('/404.html', '<section class="pt-36 pb-24 text-center"><div class="container mx-auto px-4"><h1 class="text-5xl font-black text-foreground mb-4">404</h1><p class="text-muted-foreground mb-8">Такой страницы нет. Возможно, она переехала.</p><a href="/" class="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground h-11 px-8 font-medium">На главную</a></div></section>',
          'Страница не найдена — ФинПроект-1', 'Страница не найдена.', robots='noindex, follow', sitemap=False)

    # --- sitemap, robots, rss, redirects
    sm = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for path, lm in pages:
        sm.append(f'  <url><loc>{site["url"]}{path}</loc><lastmod>{lm}</lastmod></url>')
    sm.append('</urlset>')
    open(f'{DIST}/sitemap.xml', 'w').write('\n'.join(sm) + '\n')
    open(f'{DIST}/robots.txt', 'w').write(f'User-agent: *\nAllow: /\nDisallow: /404.html\nDisallow: /preview/\n\nSitemap: {site["url"]}/sitemap.xml\n')
    items = []
    for p in posts[:30]:
        d = datetime.datetime.strptime(p['date'], '%Y-%m-%d').strftime('%a, %d %b %Y 09:00:00 +0300')
        items.append(f'<item><title>{html.escape(p["title"])}</title><link>{site["url"]}/blog/{p["slug"]}/</link><guid>{site["url"]}/blog/{p["slug"]}/</guid><pubDate>{d}</pubDate><description>{html.escape(p["description"])}</description></item>')
    open(f'{DIST}/rss.xml', 'w').write(f'<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>ФинПроект-1 — Блог</title><link>{site["url"]}/blog</link><description>Статьи о финансах бизнеса</description><language>ru</language>{"".join(items)}</channel></rss>\n')
    redirects = json.load(open(f'{SRC}/data/redirects.json'))
    from urllib.parse import quote
    lines = []
    for old, new in redirects:
        lines.append(f'{quote(old)} {new}/ 301')
    open(f'{DIST}/_redirects', 'w').write('\n'.join(lines) + '\n')
    # nginx/apache-independent fallback: per-old-URL static redirect pages
    for old, new in redirects:
        fp = DIST + old + '/index.html'
        os.makedirs(os.path.dirname(fp), exist_ok=True)
        open(fp, 'w').write(f'<!doctype html><meta charset="utf-8"><title>Перенаправление</title><link rel="canonical" href="{site["url"]}{new}/"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0; url={new}/"><a href="{new}/">{new}/</a>')
    print(f'built {len(pages)} pages, {len(posts)} posts, {len(cases)} cases, {len(redirects)} redirects')


if __name__ == '__main__':
    build()
