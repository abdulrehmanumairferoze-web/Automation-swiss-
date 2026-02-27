import openpyxl

IMS_PATH = r"D:\Downloads\copy-of-copy-of--swiss-dashboard\automation\downloads\Complete IMS Dec-25.xlsx"

def find_swiss():
    wb = openpyxl.load_workbook(IMS_PATH, read_only=True, data_only=True)
    sheet = wb.active
    found = 0
    for i, row in enumerate(sheet.iter_rows(min_row=1, max_row=5000, values_only=True)):
        for j, cell in enumerate(row):
            if cell and 'SWISS' in str(cell).upper():
                print(f"Row {i+1}, Col {j}: {cell}")
                print(f"Full Row Snippet: {row[:5]}")
                found += 1
                break
        if found > 20: break

if __name__ == "__main__":
    find_swiss()
