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

def get_current_kw():
    today = datetime.now()
    if today.weekday() >= 5:  # Samstag = 5, Sonntag = 6
        today = today + timedelta(days=(7 - today.weekday()))  # Nächsten Montag
    return today.isocalendar()[1], today.year

def find_week_page(pdf):
    current_kw, _ = get_current_kw()
    for page_num, page in enumerate(pdf.pages, 1):
        text = page.extract_text()
        if not text:
            continue
        match = re.search(r'(\d{1,2})\.(\d{1,2})\.(\d{2,4})', text)
        if match:
            try:
                day = int(match.group(1))
                month = int(match.group(2))
                year = int(match.group(3))
                if year < 100:
                    year += 2000
                dt = datetime(year, month, day)
                kw = dt.isocalendar()[1]
                if kw == current_kw:
                    return page_num
            except:
                pass
    return 1

def detect_type(text):
    lower = text.lower()
    # Check for vegan first (exact match)
    if 'vegan' in lower:
        return 'vegan'
    # Check for vegetarisch/vegi - these are vegetarian, not vegan
    if 'vegetarisch' in lower or 'vegi' in lower:
        return 'vegetarian'
    # Check for meat indicators (must check before vegetarian)
    meat_indicators = ['hähnchen', 'schwein', 'rind', 'kasseler', 'krustenbraten', 'fisch', 'wurst', 'gulasch', 'geschnetzeltes', 'chicken', 'schnitzel', 'ragout', 'spareribs', 'hackfleisch', 'rinder', 'rinders']
    for m in meat_indicators:
        if m in lower:
            return 'meat'
    # Check for vegetarian indicators (cheese, etc.)
    veg_indicators = ['soja', 'tofu', 'seitan', 'pie', 'lasagne', 'linsen', 'kichererbsen', 'blumenkohl', 'cardy', 'gorgonzola', 'käse', 'ricotta', 'mozzarella', 'hummus', 'tortilla', 'gorgonzal']
    for v in veg_indicators:
        if v in lower:
            return 'vegetarian'
    return 'meat'

def is_allergen_word(text):
    text = text.strip().upper().rstrip(',')
    single_allergens = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'K', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'W']
    multi_allergens = ['IA', 'IB', 'IC', 'ID', 'IE', 'IF', 'IG', 'IH', 'IK', 'IL', 'IM', 'IN', 'IP', 'IR', 'IS', 'IT', 'IV', 'IX', 'III',
                     'IA,', 'IB,', 'IC,', 'ID,', 'IE,', 'IF,', 'IG,', 'IH,', 'IK,', 'IL,', 'IM,', 'IN,', 'IP,', 'IR,', 'IS,', 'IT,', 'IV,', 'IX,', 'III,',
                     'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
    if text in single_allergens or text in multi_allergens:
        return True
    if re.match(r'^[A-Z],\s*[A-Z0-9IVX]', text):
        return True
    return False

def is_nutrition_word(text):
    text = text.strip()
    lower = text.lower()
    if any(x in lower for x in ['kcal', 'f:', 'kh:', 'ew:', 'bs:']):
        return True
    if re.match(r'^[\d]+[.,][\d]+g?$', text):
        return True
    if re.match(r'^[\d]+[.,][\d]+$', text):
        return True
    if text == 'g' or text == 'g,':
        return True
    return False

def is_allergen_line(text):
    text = text.strip().upper()
    return bool(re.match(r'^[A-Z][a-z]?(,\s*[A-Z0-9IVX]+)+$', text.strip())) and len(text) < 20

def is_date_line(text):
    return bool(re.match(r'^\d{2}\.\d{2}\.$', text.strip()))

def is_day_name(text):
    return text.lower() in DAY_MAP

def fetch_pdf(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, context=ssl_context) as response:
        return response.read()

def get_dish_from_column(col_words):
    if not col_words:
        return None, 'meat'
    
    col_words.sort(key=lambda x: (x[1], x[0]))
    
    dish_parts = []
    prev_y = None
    
    for x, y, text in col_words:
        text_stripped = text.strip()
        
        if is_day_name(text_stripped):
            continue
        if is_date_line(text_stripped):
            continue
        if is_allergen_line(text_stripped):
            continue
        if is_allergen_word(text_stripped):
            continue
        if is_nutrition_word(text_stripped):
            continue
        if re.match(r'^[\d,\.\s]+$', text_stripped):
            continue
        
        # If we hit a gap in Y, stop (end of dish)
        if prev_y is not None and y - prev_y > 15:
            if dish_parts:
                break
        
        prev_y = y
        dish_parts.append(text_stripped)
    
    if not dish_parts:
        return None, 'meat'
    
    # Detect type BEFORE cleaning (so we catch "vegan" in original text)
    dish_raw = ' '.join(dish_parts)
    dish_type = detect_type(dish_raw)
    
    # Now clean the dish name
    dish = dish_raw
    
    # More aggressive final cleanup - handle edge cases
    dish = re.sub(r'sixty\.\d+', '', dish)
    # Remove standalone "g" or "g," at the end
    dish = re.sub(r'\s+g,?\s*$', '', dish)
    # Remove "Xg" pattern (like "7g" without space) anywhere
    dish = re.sub(r'(\d+)g\b', r'\1', dish)
    # Remove trailing numbers attached to words (like "Rahmchampignons7")
    dish = re.sub(r'(\w)(\d+)$', r'\1', dish)
    
    for _ in range(25):
        prev = dish
        # Remove allergen+nutrition anywhere: "III, 26,3g, 70,7g, 13,9g, 7g"
        dish = re.sub(r'\s+[A-ZIVX]+,\s+[\d]+[.,][\d]+g?(,\s+[\d]+[.,][\d]+g?)*,?\s*', '', dish)
        # Remove just numbers at end
        dish = re.sub(r'\s+[\d]+[.,][\d]+g?,?\s*$', '', dish)
        # Remove standalone numbers at end (like "7" from "Rahmchampignons7")
        dish = re.sub(r'\s+\d+\s*$', '', dish)
        # Remove trailing allergen patterns like ", Ia, VII"
        dish = re.sub(r', [A-Za-z]+(, [A-Za-z0-9IVX]+)*$', '', dish)
        # Remove trailing single allergen like "VI", "IX", "Ia"
        dish = re.sub(r'\s+[A-Z][A-ZIVX]+$', '', dish)
        dish = re.sub(r'\s+[A-Z][a-z]$', '', dish)
        # Remove " - vegan" or "VI - vegan" patterns
        dish = re.sub(r'\s+[A-ZIVX]+\s*-\s*vegan$', '', dish, flags=re.IGNORECASE)
        dish = re.sub(r'\s*-\s*vegan$', '', dish, flags=re.IGNORECASE)
        dish = re.sub(r',\s*$', '', dish)
        if dish == prev:
            break
    dish = re.sub(r'\s+', ' ', dish)
    dish = dish.strip()
    
    if len(dish) > 3:
        return dish, dish_type
    return None, 'meat'

def parse_pdf(pdf_bytes):
    menu = {}
    day_order = ['montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag']
    
    # Column boundaries based on PDF analysis:
    col_bounds = [0, 320, 570, 850]
    
    # Extract Eintopf once from the whole page
    eintopf_data = None
    
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        page_num = find_week_page(pdf)
        page = pdf.pages[page_num - 1]
        words = page.extract_words(x_tolerance=3, y_tolerance=3)
        
        # Find Eintopf from the whole page
        for w in words:
            text = w['text']
            if 'eintopf' in text.lower():
                x, y = w['x0'], w['top']
                nearby = [(ww['x0'], ww['top'], ww['text']) for ww in words if abs(ww['top'] - y) < 40 and abs(ww['x0'] - x) < 200]
                price = '5,57 €'
                description_parts = []
                for px, py, ptext in nearby:
                    m = re.search(r'([\d]+[.,][\d]+)\s*€', ptext)
                    if m:
                        price = m.group(1) + ' €'
                    # Skip nutrition, allergen, and price-related text
                    if any(x in ptext.lower() for x in ['kcal', 'f:', 'kh:', 'ew:', 'bs:', 'g,', 'g ', ', g']):
                        continue
                    if re.match(r'^[\d]+[.,]?[\d]*g?$', ptext):
                        continue
                    # Look for description - can be left or right of "Eintopf"
                    if abs(px - x) < 150 and abs(py - y) < 30 and 'eintopf' not in ptext.lower() and 'woche' not in ptext.lower() and '€' not in ptext and '/' not in ptext and 'staff' not in ptext.lower() and 'guest' not in ptext.lower():
                        if re.match(r'^[A-Za-zÄÖÜäöüß]', ptext):
                            if ptext.lower() not in ['der', 'g']:
                                description_parts.append((px, py, ptext))
                # Sort by position (top to bottom, left to right)
                description_parts.sort(key=lambda t: (t[1], t[0]))
                description = ' '.join([t[2] for t in description_parts]) if description_parts else ''
                if not description:
                    description = 'Feuriger Kichererbseneintopf'
                eintopf_data = {
                    'name': 'Eintopf der Woche',
                    'price': price,
                    'description': description,
                    'bistro': 'Nationalbibliothek',
                    'type': 'meat'
                }
                break
        
        day_positions = {}
        for w in words:
            if w['text'].lower() in day_order:
                day_positions[w['text'].lower()] = w['top']
        
        sorted_days = sorted(day_positions.items(), key=lambda x: x[1])
        
        for i, (day_name, day_y) in enumerate(sorted_days):
            next_y = sorted_days[i + 1][1] if i + 1 < len(sorted_days) else day_y + 200
            
            current_day = DAY_MAP[day_name]
            menu[current_day] = []
            
            tag_words = [(w['x0'], w['top'], w['text']) for w in words 
                        if day_y - 20 <= w['top'] < next_y and w['text'].strip()]
            
            cols = [[], [], []]
            for x, y, text in tag_words:
                if col_bounds[0] <= x < col_bounds[1]:
                    cols[0].append((x, y, text))
                elif col_bounds[1] <= x < col_bounds[2]:
                    cols[1].append((x, y, text))
                elif col_bounds[2] <= x < col_bounds[3]:
                    cols[2].append((x, y, text))
            
            # Extract dish from each column
            # Column 1 (VeggieZauber) is always vegetarian
            # Column 2+3: use automatic detection
            col_prices = ['7,55 €', '8,05 €', '8,75 €']
            for col_idx, col_words in enumerate(cols):
                result = get_dish_from_column(col_words)
                if result:
                    dish, dish_type = result
                    # Override type for column 1 (always vegetarian)
                    final_type = 'vegetarian' if col_idx == 0 else dish_type
                    menu[current_day].append({
                        'name': dish,
                        'price': col_prices[col_idx],
                        'description': '',
                        'bistro': 'Nationalbibliothek',
                        'type': final_type
                    })
            
            # Add Eintopf at the end of each day
            if eintopf_data:
                menu[current_day].append(eintopf_data)
    
    return menu

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 nationalbibliothek.py <pdf_url>")
        sys.exit(1)
    
    url = sys.argv[1]
    pdf_bytes = fetch_pdf(url)
    menu_data = parse_pdf(pdf_bytes)
    print(json.dumps(menu_data, ensure_ascii=False))
