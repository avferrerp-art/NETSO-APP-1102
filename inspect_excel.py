import pandas as pd

try:
    df = pd.read_excel('catalogo.xlsx')
    print("Columns:", df.columns.tolist())
    print("First 3 rows:")
    print(df.head(3).to_dict(orient='records'))
except Exception as e:
    print("Error reading excel:", e)
