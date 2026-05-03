#!/usr/bin/env python3
import sys
import json

WEEKLY_SPECIAL = {
    "dish": "Weißer Spargel",
    "description": "mit mit Sauce Hollandaise, Hinterschinken und Butterkartoffeln",
    "price": "8,90 €",
    "isWeeklySpecial": True
}

MANUAL_MENU = {
    "monday":    {"dish": "Hähnchenschnitzel in Kürbispanade", "description": "mit Sauce Hollandaise und Petersilienkartoffeln", "type": "meat"},
    "tuesday":   {"dish": "Ofenkartoffel mit Frühlingsquark", "description": "mit Hähnchenstreifen", "type": "meat"},
    "wednesday": {"dish": "Currywurst mit Pommes Frites", "description": "", "type": "meat"},
    "thursday":  {"dish": "Bunter Salat „Mediterran“", "description": "mit Hirtenkäse und Oliven", "type": "vegetarian"},
    "friday":    {"dish": "Seelachsfilet mit Kartoffel-Gurkensalat", "description": "", "type": "meat"},
}

def build_menu():
    menu = {}

    for day_key in ["monday", "tuesday", "wednesday", "thursday", "friday"]:
        entry = MANUAL_MENU.get(day_key)
        if not entry:
            menu[day_key] = []
            continue

        menu[day_key] = [
            {
                "name": entry["dish"],
                "price": "7,50 €",
                "description": entry.get("description", ""),
                "bistro": "Porta",
                "type": entry.get("type", "meat")
            },
            {
                "name": WEEKLY_SPECIAL["dish"],
                "price": WEEKLY_SPECIAL.get("price", ""),
                "description": WEEKLY_SPECIAL.get("description", ""),
                "bistro": "Porta",
                "type": "meat",
                "isWeeklySpecial": True
            }
        ]

    return menu

if __name__ == "__main__":
    menu_data = build_menu()
    print(json.dumps(menu_data, ensure_ascii=False))