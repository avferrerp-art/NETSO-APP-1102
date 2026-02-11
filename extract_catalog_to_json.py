import pandas as pd
import json

try:
    # Read excel, header=2 means 3rd row is header, but we will ignore names and use indices
    df = pd.read_excel('catalogo.xlsx', header=2)
    
    # We'll use iloc to access columns by position to avoid encoding issues
    # Col 0: Unnamed: 0 (Nan)
    # Col 1: Nombre Comun (App)
    # Col 2: Nombre Odoo
    # Col 3: Unidad
    # Col 4: Cantidad
    # Col 5: Redondeo
    # Col 6: Logica

    product_mapping = {}
    material_rules = {}

    for _, row in df.iterrows():
        # Safeguard against index out of bounds if file structure changed, but assuming it matches inspect
        try:
            app_name = str(row.iloc[1]).strip()
            if app_name == 'nan' or not app_name: continue

            per_unit_raw = row.iloc[4]
            qty_per_unit = 1
            try:
                qty_per_unit = float(per_unit_raw)
            except:
                qty_per_unit = 1

            # Mapping Data
            odoo_name = str(row.iloc[2]).strip()
            
            # Rule Data
            unit = str(row.iloc[3]).strip()
            rounding = str(row.iloc[5]).strip()
            logic = str(row.iloc[6]).strip()

            if odoo_name and odoo_name != 'nan':
                product_mapping[app_name] = odoo_name
            
            material_rules[app_name] = {
                "unit": unit if unit != 'nan' else 'u',
                "qty_per_unit": qty_per_unit,
                "rounding": rounding if rounding != 'nan' else 'LIBRE',
                "logic": logic if logic != 'nan' else 'Manual'
            }
        except Exception as row_err:
            continue

    print("PRODUCT_MAPPING_JSON_START")
    print(json.dumps(product_mapping, indent=4, ensure_ascii=False))
    print("PRODUCT_MAPPING_JSON_END")

    print("MATERIAL_RULES_JSON_START")
    print(json.dumps(material_rules, indent=4, ensure_ascii=False))
    print("MATERIAL_RULES_JSON_END")

except Exception as e:
    print("Error:", e)
