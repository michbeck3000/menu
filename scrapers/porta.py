#!/usr/bin/env python3
import sys
import json
import re
import io
import urllib.request
import ssl

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

WEEKLY_SPECIAL = {
    "dish": "Tortelloni-Gemüse-Pfanne",
    "description": "Tortelloni mit einer Füllung aus Paprika, Zucchini und Tomaten in cremiger, veganer Sauce nach Käse-Sahne-Art mit Gemüse, auch mit extra Hähnchenstreifen (+ 3 €)",
    "price": ",90 €",
    "isWeeklySpecial": True
}

# --- MANUELLE EINGABE SCHALTER ---
# Setze diesen Schalter auf True, um manuell eingegebene Gerichte zu verwenden,
# anstatt das PDF von der Webseite zu scrapen.
MANUAL_MODE = True

# Trage hier deine manuellen Gerichte für die jeweiligen Wochentage ein.
# Jedes Gericht benötigt die Felder: 'name', 'price', 'description', 'type' ('meat', 'vegetarian' oder 'vegan')
MANUAL_MENU = {
    'monday': [
        {
            'name': 'Hähnchenschnitzel in Kübispanade',
            'price': '7,50 €',
            'description': 'mit Sauce Hollandaise und Petersilienkartoffeln',
            'type': 'meat'
        }
    ],
    'tuesday': [
        {
            'name': 'Ofenkartoffel mit Frühlingsquark',
            'price': '7,50 €',
            'description': 'mit Hähnchenstreifen',
            'type': 'meat'
        }
    ],
    'wednesday': [
        {
            'name': 'Currywurst mit Pommes Frites',
            'price': '7,50 €',
            'description': '',
            'type': 'meat'
        }
    ],
    'thursday': [
        {
            'name': 'Bunter Salat „Mediterran“',
            'price': '7,50 €',
            'description': 'mit Hirtenkäse und Oliven',
            'type': 'vegetarian'
        }
    ],
    'friday': [
        {
            'name': 'Seelachsfilet',
            'price': '7,50 €',
            'description': 'mit Kartoffel-Gurkensalat',
            'type': 'meat'
        }
    ]
}

def detect_type(text):
    lower = text.lower()
    if 'vegan' in lower:
        return 'vegan'
    if 'vegetarisch' in lower:
        return 'vegetarian'
    meat_indicators = ['hähnchen', 'chicken', 'schwein', 'rind', 'fisch', 'wurst', 'currywurst', 'schnitzel', 'seel', 'lachs']
    for m in meat_indicators:
        if m in lower:
            return 'meat'
    return 'meat'

def fetch_pdf(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, context=ssl_context) as response:
        return response.read()

def split_name_description(text):
    words = text.split()
    name_parts = []
    desc_parts = []
    
    for word in words:
        if word.isupper() and word.isalpha():
            name_parts.append(word)
        else:
            desc_parts.append(word)
    
    name = ' '.join(name_parts)
    description = ' '.join(desc_parts)
    
    return name, description

def parse_pdf(pdf_bytes):
    menu = {}
    
    weekly_special = None
    if WEEKLY_SPECIAL.get('dish'):
        weekly_special = {
            'name': WEEKLY_SPECIAL['dish'],
            'price': WEEKLY_SPECIAL.get('price', ''),
            'description': WEEKLY_SPECIAL.get('description', ''),
            'bistro': 'Porta',
            'type': 'meat',
            'isWeeklySpecial': WEEKLY_SPECIAL.get('isWeeklySpecial', False)
        }
    
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        page = pdf.pages[0]
        text = page.extract_text()
    
    lines = text.split('\n')
    
    current_day = None
    dish_lines = []
    
    ignore_phrases = ['wackelpudding', 'als nachtisch', 'diesen mittags-', 'angeboten', '+1.50', 'restaurant', 
                    'essen gut – alles gut.', 'leckere mittagsangebote immer ab 11 uhr', 
                    'alle abbildungen sind beispielabbildungen.', 'beispielabbildungen']
    
    for line in lines:
        line_clean = line.strip()
        if not line_clean:
            continue
        
        line_lower = line_clean.lower()
        
        if line_lower.rstrip(':') in DAY_MAP:
            if current_day and dish_lines:
                dish_text = ' '.join(dish_lines)
                
                is_veg = 'vegetarisch' in dish_text.lower()
                dish_text = re.sub(r'\s*vegetarisch\s*', '', dish_text, flags=re.IGNORECASE)
                
                dish_text = re.sub(r'\s+je\s+', ' ', dish_text)
                dish_text = re.sub(r'\s+-\s+', ' ', dish_text)
                dish_text = re.sub(r'\s+', ' ', dish_text)
                
                dish_name, dish_desc = split_name_description(dish_text)
                
                dish_type = 'vegetarian' if is_veg else detect_type(dish_text)
                
                if dish_name:
                    menu[current_day].append({
                        'name': dish_name,
                        'price': '7,50 €',
                        'description': dish_desc,
                        'bistro': 'Porta',
                        'type': dish_type
                    })
                    
                    if weekly_special:
                        menu[current_day].append(weekly_special)
            
            current_day = DAY_MAP[line_lower.rstrip(':')]
            menu[current_day] = []
            dish_lines = []
        elif current_day:
            skip = False
            for ig in ignore_phrases:
                if ig in line_lower:
                    skip = True
                    break
            if skip:
                continue
            dish_lines.append(line_clean)
    
    if current_day and dish_lines:
        dish_text = ' '.join(dish_lines)
        
        is_veg = 'vegetarisch' in dish_text.lower()
        dish_text = re.sub(r'\s*vegetarisch\s*', '', dish_text, flags=re.IGNORECASE)
        
        dish_text = re.sub(r'\s+je\s+', ' ', dish_text)
        dish_text = re.sub(r'\s+-\s+', ' ', dish_text)
        dish_text = re.sub(r'\s+', ' ', dish_text)
        
        dish_name, dish_desc = split_name_description(dish_text)
        
        dish_type = 'vegetarian' if is_veg else detect_type(dish_text)
        
        if dish_name:
            menu[current_day].append({
                'name': dish_name,
                'price': '7,50 €',
                'description': dish_desc,
                'bistro': 'Porta',
                'type': dish_type
            })
            
            if weekly_special:
                menu[current_day].append(weekly_special)
    
    return menu

if __name__ == "__main__":
    if MANUAL_MODE:
        # Bereite die manuellen Daten im erwarteten Format vor
        menu_data = {}
        for day, dishes in MANUAL_MENU.items():
            menu_data[day] = []
            for dish in dishes:
                menu_data[day].append({
                    'name': dish.get('name', ''),
                    'price': dish.get('price', '7,50 €'),
                    'description': dish.get('description', ''),
                    'bistro': 'Porta',
                    'type': dish.get('type', 'meat'),
                    'isWeeklySpecial': dish.get('isWeeklySpecial', False)
                })
        print(json.dumps(menu_data, ensure_ascii=False))
        sys.exit(0)

    if len(sys.argv) < 2 or not sys.argv[1]:
        print("Usage: python3 porta.py <pdf_url>")
        sys.exit(1)
    
    url = sys.argv[1]
    pdf_bytes = fetch_pdf(url)
    menu_data = parse_pdf(pdf_bytes)
    print(json.dumps(menu_data, ensure_ascii=False))
