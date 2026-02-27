import openpyxl

IMS_PATH = r"D:\Downloads\copy-of-copy-of--swiss-dashboard\automation\downloads\Complete IMS Dec-25.xlsx"

def find_omep():
    wb = openpyxl.load_workbook(IMS_PATH, read_only=True, data_only=True)
    sheet = wb.active
    for i, row in enumerate(sheet.iter_rows(min_row=1, max_row=1000, values_only=True)):
        if any('OMEPRAZOLE' in str(cell).upper() for cell in row if cell):
            print(f"Row {i+1}: {row[:10]}")

if __name__ == "__main__":
    find_omep()
