#!/usr/bin/env python3
"""Сборка страниц Kadema UI.
Исходники страниц лежат в ui/pages/<имя>.src.html и содержат вставки:
  {{head:Заголовок вкладки}}  — <head> с подключением kadema-ui.css/js
  {{header}} / {{header:services}} — шапка (с подсветкой пункта «Услуги»)
  {{modal}}   — окно с формой
  {{footer}}  — подвал с логотипом-видео
  {{logo}}    — логотип (SVG)
Результат: <папка из первой строки-комментария <!-- out: ../direct/index.html -->>.
Запуск:  python3 ui/build.py            (собрать все страницы)
"""
import pathlib, re
UI = pathlib.Path(__file__).resolve().parent
part = lambda n: (UI / 'partials' / f'{n}.html').read_text(encoding='utf-8')
HEAD = '''<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{t}</title>
<link rel="stylesheet" href="{rel}ui/kadema-ui.css">
<script src="{rel}ui/kadema-ui.js" defer></script>'''

def build(src):
    s = src.read_text(encoding='utf-8')
    out = re.search(r'<!--\s*out:\s*(\S+)\s*-->', s).group(1)
    dest = (src.parent / out).resolve()
    rel = '../' * (len(dest.relative_to(UI.parent).parts) - 1)
    s = re.sub(r'<!--\s*out:.*?-->\n?', '', s)
    s = re.sub(r'\{\{head:(.*?)\}\}', lambda m: HEAD.format(t=m.group(1), rel=rel), s)
    s = re.sub(r'\{\{header(?::(\w+))?\}\}', lambda m: part('header').replace('{{cur_services}}', ' aria-current="page"' if m.group(1) == 'services' else ''), s)
    s = s.replace('{{modal}}', part('modal')).replace('{{footer}}', part('footer'))
    s = s.replace('{{logo}}', part('logo').strip())
    s = s.replace('../kadema-digital/', rel + 'kadema-digital/').replace('../direct/', rel + 'direct/')
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(s, encoding='utf-8')
    print('→', dest.relative_to(UI.parent))

for f in sorted((UI / 'pages').glob('*.src.html')):
    build(f)
