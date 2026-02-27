target_file = r'c:\Users\Admini\Desktop\avance 0602\script.js'

with open(target_file, 'r', encoding='utf-8') as f:
    content = f.read()

old_block = """    window.postes = [];\n\n    await poleManager.fetchPoles(newCenter.lat, newCenter.lng, fetchRadius);"""

new_block = """    window.postes = [];

    try {
        await poleManager.fetchPoles(newCenter.lat, newCenter.lng, fetchRadius);
        console.log(`Fetched ${window.postes.length} poles at new location`);
    } catch (err) {
        console.warn('No se pudieron obtener postes en la nueva ubicacion, se mantendran posiciones calculadas.', err);
    }"""

if old_block in content:
    content = content.replace(old_block, new_block)
    with open(target_file, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed fetchPoles error handling.")
else:
    # Try line by line search
    idx = content.find('window.postes = [];\n\n    await poleManager.fetchPoles')
    print(f"Exact block not found. Searching variant... Found at: {idx}")
    # Try a different variant
    old2 = 'window.postes = [];\r\n\r\n    await poleManager.fetchPoles(newCenter.lat, newCenter.lng, fetchRadius);'
    if old2 in content:
        content = content.replace(old2, new_block)
        with open(target_file, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Fixed with CRLF variant.")
    else:
        print("Block not found. Printing surrounding text...")
        idx2 = content.find('poleManager.fetchPoles(newCenter.lat')
        if idx2 != -1:
            print(repr(content[idx2-100:idx2+200]))
