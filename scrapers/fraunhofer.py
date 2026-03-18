#!/usr/bin/env python3
import sys
import json
import re
import io
import urllib.request
import urllib.error

# We must handle the import gracefully to give clear errors if missing.
try:
    import pdfplumber
except ImportError:
    print(json.dumps({"error": "pdfplumber not installed. Run: pip install pdfplumber"}), file=sys.stderr)
    sys.exit(1)

DAY_MAP = {
    'montag': 'monday',
    'dienstag': 'tuesday',
    'mittwoch': 'wednesday',
    'donnerstag': 'thursday',
    'freitag': 'friday'
}

# English detection words
ENGLISH_WORDS = [' with ', ' and ', ' stir-fry', ' fillet ', ' strips',
                 'meatballs', ' noodles', ' soup', ' sticks with ', ' purée ', ' cream sauce',
                 ' braised ', ' chicken', ' pork ', 'grated', ' fried ', ' filled with ', ' served with ', ' breadcrumbs', ' chips ', ' peas', 'solyanka']

def is_day_marker(text):
    t = text.lower().strip().replace(':', '')
    return t in DAY_MAP

def is_type_marker(text):
    t = text.lower().strip()
    return t in ['vegetarisch', 'vegan']

def is_english_line(text):
    lower = text.lower()
    return any(w in lower for w in ENGLISH_WORDS)

def is_header_or_ignored(text):
    t = text.lower().strip()
    return (
        t.startswith('speiseplan') or
        t.startswith('kenntlichmachung') or
        t.startswith('allergene') or
        t.startswith('www.') or
        t == 'mitarbeiter' or
        t == 'externe' or
        t == 'gäste' or
        t == 'externe gäste' or
        re.match(r'^\d{2}\.\d{2}\.\d{4}', t) or
        'konservierungsstoff' in t or
        'farbstoff' in t or
        'eier*' in t or
        'änderungen vorbehalten' in t or
        'geschwefelt' in t or
        '(h)senf' in t
    )

def is_allergen_superscript(char_dict):
    # Heuristic: Allergen markers are often smaller, elevated (different y0/y1), and single letters/numbers
    # We can also just rely on regex stripping if coordinate checks are too brittle.
    # We will just use regex stripping later on the reconstructed lines.
    pass

def strip_allergens(text):
    # Remove allergens like "SticksF" -> "Sticks", "Hackfleischspieß,F,H" -> "Hackfleischspieß"
    text = text.replace('"', '').replace("'", '')
    
    # Multiple passes to catch all patterns
    for _ in range(5):
        # Allergens in middle: "Hackfleischspieß,F,H" or "Joghurt,D,F" -> keep word
        text = re.sub(r'(\w+),[A-P](,[A-P])*', r'\1', text)
        
        # Single letter at end: "SoßeD" -> "Soße"
        text = re.sub(r'([a-zäöüA-ZÄÖÜß])[A-P]$', r'\1', text)
        text = re.sub(r'([a-zäöüA-ZÄÖÜß])[A-P](?=\s)', r'\1', text)
        
        # Standard allergen pattern at end
        text = re.sub(r'([a-zäöüA-ZÄÖÜß])([A-P](?:,[A-P0-9])*|[0-9]+(?:,[0-9A-P]+)*)$', r'\1', text)
        text = re.sub(r'([a-zäöüA-ZÄÖÜß])([A-P](?:,[A-P0-9])*|[0-9]+(?:,[0-9A-P]+)*)(?=\s)', r'\1', text)
    
    return text


def fetch_pdf(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req) as response:
            return response.read()
    except Exception as e:
        print(f"Error downloading PDF: {e}", file=sys.stderr)
        sys.exit(1)

def normalize_dish_name(name):
    import unicodedata
    # Remove type markers before normalizing (vegan, vegetarisch, vge, vg)
    cleaned = re.sub(r'\s+(vegan|vegetarisch|vge|vg)$', '', name.lower(), flags=re.IGNORECASE)
    # Also remove allergens from the middle: "Joghurt Pfannkuchen,D,F" -> "Joghurt Pfannkuchen"
    cleaned = re.sub(r',[A-P](,[A-P])*(?=\s|$|,|\))', '', cleaned, flags=re.IGNORECASE)
    n = unicodedata.normalize('NFKD', cleaned)
    return ''.join(c for c in n if c.isalnum())

def is_subset(key1, key2):
    # Check if one normalized name is contained in the other
    return key1 in key2 or key2 in key1

def filter_duplicates(menu):
    for day in menu:
        dishes = menu[day]
        seen = {}
        unique_dishes = []
        for dish in dishes:
            key = normalize_dish_name(dish['name'])
            if key and len(key) > 5:
                # Check for existing key that's a subset
                found = None
                for existing_key in seen:
                    if is_subset(key, existing_key):
                        found = existing_key
                        break
                
                if not found:
                    seen[key] = dish
                    unique_dishes.append(dish)
                else:
                    # Compare and keep the better one (more info, better price)
                    existing = seen[found]
                    # Prefer entry with more text or has complete price info
                    if len(dish['name']) > len(existing['name']):
                        # Replace in unique_dishes
                        for i, d in enumerate(unique_dishes):
                            if normalize_dish_name(d['name']) == found:
                                unique_dishes[i] = dish
                                seen[found] = dish
                                break
            else:
                unique_dishes.append(dish)
        menu[day] = unique_dishes
    return menu

def parse_pdf(pdf_bytes):
    menu = {}
    current_day = None
    
    # pdfplumber extracts layout accurately
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            # We can extract a table or just words with their rects.
            # Extract words provides a good balance. We group words by top coordinate (y-tolerance).
            words = page.extract_words(
                x_tolerance=3, 
                y_tolerance=3, 
                keep_blank_chars=False, 
                use_text_flow=True, 
                horizontal_ltr=True
            )
            
            # Group words into lines
            # A line is defined as words with similar 'top' or 'bottom'
            lines = []
            if not words:
                continue
                
            current_line = [words[0]]
            
            for word in words[1:]:
                # If the word's top is within 4 pixels of the current line's top, it's on the same line
                if abs(word['top'] - current_line[0]['top']) <= 4:
                    current_line.append(word)
                else:
                    lines.append(current_line)
                    current_line = [word]
            
            if current_line:
                lines.append(current_line)
                
            # Now we have visual lines. 
            # In Fraunhofer PDFs, dishes are on the left (x0 < 400), prices on the right (x0 > 450)
            
            # Process lines
            for line_words in lines:
                # Reconstruct left part and right part
                left_words = [w['text'] for w in line_words if w['x0'] < 420]
                right_words = [w['text'] for w in line_words if w['x0'] >= 420]
                
                left_text = " ".join(left_words).strip()
                prices = [w for w in right_words if re.match(r'^\d+[.,]\d+$', w) or '€' in w]
                # Clean up prices: extract just the "X,XX" or "X,XX €"
                clean_prices = []
                for p in right_words:
                    m = re.search(r'(\d+[.,]\d+)\s*€?', p)
                    if m:
                        clean_prices.append(m.group(1).replace('.', ',') + ' €')
                
                if not left_text and not clean_prices:
                    continue
                    
                if '--debug' in sys.argv:
                    print(f"DEBUG ROW: left_text='{left_text}' prices={clean_prices} eng={is_english_line(left_text)} head={is_header_or_ignored(left_text)}", file=sys.stderr)

                if is_header_or_ignored(left_text):
                    continue
                    
                if is_day_marker(left_text):
                    current_day = DAY_MAP[left_text.lower().replace(':', '')]
                    if current_day not in menu:
                        menu[current_day] = []
                    continue
                    
                if not current_day:
                    continue
                    
                # Extract portion label
                lower_left = left_text.lower()
                row_portion = None
                if 'klein' in lower_left: row_portion = 'klein'
                elif 'groß' in lower_left: row_portion = 'groß'
                
                # Extract type label
                row_type = None
                if 'vegan' in lower_left: row_type = 'vegan'
                elif 'vegetarisch' in lower_left: row_type = 'vegetarian'
                
                # Check if english
                is_english = is_english_line(left_text)
                is_standalone_label = is_type_marker(left_text) or row_portion in ['klein', 'groß']
                
                # Calculate external price (always the last one in the row)
                external_price = ""
                if len(clean_prices) >= 2:
                    external_price = clean_prices[-1]
                elif len(clean_prices) == 1:
                    external_price = clean_prices[0]
                    
                # If we have a current dish, maybe update it
                if current_day and len(menu.get(current_day, [])) > 0:
                    current_dish = menu[current_day][-1]
                    if row_type:
                        current_dish['type'] = row_type
                    if row_portion == 'groß' and clean_prices:
                        current_dish['price'] = external_price
                        
                # Fix: Sometimes prices appear on their own visual line (no left_text) just below the dish
                if not left_text and clean_prices and current_day and len(menu.get(current_day, [])) > 0:
                    current_dish = menu[current_day][-1]
                    # Only update if the current dish has no price, or if this is an explicit update (e.g. groß)
                    if not current_dish['price']:
                        current_dish['price'] = external_price
                    # If it already had a small price, append it to the new large price
                    elif '(' not in current_dish['price']:
                        old_price = current_dish['price']
                        # if the new price is different, it's likely the large price
                        if old_price != external_price:
                            current_dish['price'] = f"{external_price} (klein {old_price})"
                    continue
                        
                # New German dish line
                # Often, allergen markers get parsed as separate words or attached. 
                # We strip them from the reconstructed string.
                if not is_english and not is_standalone_label and len(left_text) > 3:
                    clean_name = strip_allergens(left_text)
                    
                    initial_price = external_price
                    
                    # Also detect vegan from the name
                    type_from_name = 'meat'
                    if 'vegan' in clean_name.lower():
                        type_from_name = 'vegan'
                    elif 'vegetarisch' in clean_name.lower():
                        type_from_name = 'vegetarian'
                        
                    menu[current_day].append({
                        'name': clean_name,
                        'price': initial_price,
                        'description': '',
                        'bistro': 'Fraunhofer',
                        'type': row_type or type_from_name
                    })
                    
                # If it's an english translation line, it might contain the large price!
                elif is_english and current_day and len(menu.get(current_day, [])) > 0 and clean_prices:
                    current_dish = menu[current_day][-1]
                    old_price = current_dish['price']
                    if old_price and '(' not in old_price and old_price != external_price:
                        # We found a new price on the English line, which is the "groß" price!
                        current_dish['price'] = f"{external_price} (klein {old_price})"

    # Filter duplicate dishes
    menu = filter_duplicates(menu)
    
    return menu

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 fraunhofer.py <pdf_url>", file=sys.stderr)
        sys.exit(1)
        
    url = sys.argv[1]
    pdf_bytes = fetch_pdf(url)
    menu_data = parse_pdf(pdf_bytes)
    
    # Print JSON to stdout for the JS runtime to consume
    print(json.dumps(menu_data, ensure_ascii=False))
