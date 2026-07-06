#!/usr/bin/env python3
import sys
import json
import re
import io
import urllib.request
import ssl
from datetime import datetime, timedelta

try:
    import pdfplumber
except ImportError:
    print(json.dumps({"error": "pdfplumber not installed"}))
    sys.exit(1)

ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

DAY_MAP = {
    'montag': 'monday',
    'dienstag': 'tuesday',
    'mittwoch': 'wednesday',
    'donnerstag': 'thursday',
    'freitag': 'friday'
}

SURCHARGE = 1.50

MEAT_INDICATORS = [
    'hähnchen', 'schwein', 'rind', 'kasseler', 'krustenbraten',
    'fisch', 'wurst', 'gulasch', 'geschnetzeltes', 'chicken',
    'schnitzel', 'ragout', 'spareribs', 'hackfleisch', 'rinder',
    'rinders', 'gyros', 'würstchen', 'steak', 'boulette', 'fleisch', 'hack'
]

VEG_INDICATORS = [
    'soja', 'tofu', 'seitan', 'pie', 'lasagne', 'linsen',
    'kichererbsen', 'blumenkohl', 'gorgonzola', 'käse', 'ricotta',
    'mozzarella', 'hummus', 'tortilla', 'spinat', 'knödel',
    'semmelknödel', 'reibekuchen', 'apfelmus', 'kartoffel',
    'gurkensalat', 'rührei', 'ofenkartoffel', 'tomaten',
    'mischgemüse', 'baguette', 'kräuterquark', 'nudelsalat',
    'reissalat', 'gemüse', 'ei', 'gurken', 'paprika',
    'zitronensoße', 'zitrone', 'kartoffeln'
]

def detect_type(text):
    lower = text.lower()
    if 'vegan' in lower:
        return 'vegan'
    if 'vegetarisch' in lower or 'vegi' in lower:
        return 'vegetarian'
    for m in MEAT_INDICATORS:
        if m in lower:
            return 'meat'
    for v in VEG_INDICATORS:
        if v in lower:
            return 'vegetarian'
    return 'meat'

def fetch_pdf(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, context=ssl_context) as response:
        return response.read()

def add_surcharge(price_str):
    m = re.match(r'(\d+),(\d{2})\s*€', price_str.strip())
    if not m:
        return price_str
    base = float(f"{m.group(1)}.{m.group(2)}")
    final = base + SURCHARGE
    return f"{final:.2f}".replace('.', ',') + ' €'

def parse_pdf(pdf_bytes):
    menu = {}
    day_order = ['montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag']

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        page = pdf.pages[0]
        words = page.extract_words(x_tolerance=3, y_tolerance=3)

        columns = {'left': [], 'right': []}
        for w in words:
            if w['x0'] < 300:
                columns['left'].append(w)
            else:
                columns['right'].append(w)

        for key in columns:
            columns[key].sort(key=lambda w: (w['top'], w['x0']))

        day_to_col = {
            'montag': 'left', 'dienstag': 'left', 'mittwoch': 'left',
            'donnerstag': 'right', 'freitag': 'right'
        }

        day_y_positions = {}
        for day_name in day_order:
            col = columns[day_to_col[day_name]]
            for w in col:
                if w['text'].lower() == day_name:
                    day_y_positions[day_name] = w['top']
                    break

        ständige_y = float('inf')
        for w in words:
            if 'ständige' in w['text'].lower():
                ständige_y = w['top']
                break

        def get_day_words(day_name):
            col = columns[day_to_col[day_name]]
            day_y = day_y_positions.get(day_name)
            if day_y is None:
                return []

            next_y = float('inf')
            for nd in day_order:
                if nd != day_name and day_to_col[nd] == day_to_col[day_name]:
                    ny = day_y_positions.get(nd, float('inf'))
                    if ny > day_y:
                        next_y = min(next_y, ny)

            next_y = min(next_y, ständige_y)

            return [w for w in col if day_y < w['top'] < next_y]

        def parse_breakfast(day_name):
            wl = get_day_words(day_name)
            if not wl:
                return []

            lines = []
            cl = [wl[0]]
            for w in wl[1:]:
                if abs(w['top'] - cl[0]['top']) <= 4:
                    cl.append(w)
                else:
                    lines.append(cl)
                    cl = [w]
            if cl:
                lines.append(cl)

            dishes = []
            current_name = ""
            current_price = None

            for line in lines:
                text = ' '.join(w['text'] for w in line).strip()

                if not text:
                    continue
                if text.lower().strip() in day_order:
                    continue
                if 'aufschlag' in text.lower() or 'außerhaus' in text.lower():
                    continue
                if re.match(r'^[\d,\s.\-/]+$', text):
                    continue

                has_cb = '☐' in text or '☑' in text or '☒' in text

                if has_cb:
                    if current_name and current_price is not None:
                        dishes.append({
                            'name': re.sub(r'-\s+', '-', re.sub(r'\s+', ' ', current_name).strip()),
                            'price': add_surcharge(current_price)
                        })
                        current_name = ""
                        current_price = None

                    pm = re.search(r'(\d+,\d{2})\s*€', text)
                    if pm:
                        current_price = pm.group(0)
                        rest = text
                        for ch in ['☐', '☑', '☒']:
                            rest = rest.replace(ch, '')
                        rest = re.sub(r'\d+,\d{2}\s*€', '', rest).strip()
                        current_name = rest
                    else:
                        rest = text
                        for ch in ['☐', '☑', '☒']:
                            rest = rest.replace(ch, '')
                        s = rest.strip()
                        if s:
                            current_name = s
                elif current_name:
                    if current_price is None:
                        pm = re.search(r'(\d+,\d{2})\s*€', text)
                        if pm:
                            current_price = pm.group(0)
                            text = re.sub(r'\d+,\d{2}\s*€', '', text).strip()
                    current_name += ' ' + text

            if current_name and current_price is not None:
                dishes.append({
                    'name': re.sub(r'-\s+', '-', re.sub(r'\s+', ' ', current_name).strip()),
                    'price': add_surcharge(current_price)
                })

            return dishes

        for day_name in day_order:
            eng_day = DAY_MAP[day_name]
            parsed = parse_breakfast(day_name)
            dishes_for_day = []
            for d in parsed:
                dishes_for_day.append({
                    'name': d['name'],
                    'price': d['price'],
                    'description': '',
                    'bistro': 'Nationalbibliothek',
                    'type': detect_type(d['name'])
                })
            if dishes_for_day:
                menu[eng_day] = dishes_for_day

    for day in ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']:
        if day not in menu or len(menu[day]) == 0:
            menu[day] = [{
                'name': 'Keine Daten vorhanden',
                'price': '',
                'description': '',
                'bistro': 'Nationalbibliothek',
                'type': 'meat'
            }]

    return menu

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 nationalbibliothek.py <pdf_url>")
        sys.exit(1)

    url = sys.argv[1]
    pdf_bytes = fetch_pdf(url)
    menu_data = parse_pdf(pdf_bytes)
    print(json.dumps(menu_data, ensure_ascii=False))
