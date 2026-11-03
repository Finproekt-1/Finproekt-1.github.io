# Сайт finproekt-1.ru

Статический сайт. Сборка: `python3 build.py` (нужны python3, markdown, jinja2) → папка `dist/`.

- Статьи блога: `src/content/blog/*.md` (настройки в JSON между строками `---`).
- Кейсы, отзывы, контакты, услуги: `src/data/*.json`.
- Главная страница: `src/partials/home_main.html`.
- Шапка и подвал: `src/partials/header.html`, `footer.html`.
- Стили: `static/css/base.css` (исходные), `static/css/custom.css` (дополнения).
- Скрипты (квиз, формы, чат): `static/js/site.js`.
- Заявки и ИИ-чат пока идут через старый бэкенд (Supabase), адреса в `src/data/site.json`.

## Публикация по расписанию

- База знаний: `src/content/kb/*.md` → раздел `/baza-znanij/` (ссылка только в подвале и в sitemap).
- Блог: `src/content/blog/*.md`. Черновики на согласовании — `src/content/blog_drafts/` (не публикуются).
- Статья с датой `date` в будущем не попадает на сайт, пока эта дата не наступит (по Москве).
- GitHub Actions (`.github/workflows/deploy.yml`) собирает сайт при каждом push и каждый день в 06:05 МСК —
  так статьи выходят сами в свою дату. В настройках Pages источник должен быть «GitHub Actions».
- FAQ в front matter (`"faq": [["вопрос","ответ"], ...]`) превращается в разметку FAQPage.
