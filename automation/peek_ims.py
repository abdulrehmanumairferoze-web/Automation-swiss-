import openpyxl

IMS_PATH = r"D:\Downloads\copy-of-copy-of--swiss-dashboard\automation\downloads\Complete IMS Dec-25.xlsx"

def peek():
    wb = openpyxl.load_workbook(IMS_PATH, read_only=True, data_only=True)
    sheet = wb.active
    for i, row in enumerate(sheet.iter_rows(min_row=1, max_row=100, values_only=True)):
        print(f"Row {i+1}: {row[:6]}")

if __name__ == "__main__":
    peek()
