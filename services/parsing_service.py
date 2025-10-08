import pandas as pd
from camelot.io import read_pdf as camelot_read_pdf
from tabula.io import read_pdf



# Parser for resumes
def parse_resume_text(text: str, ner_pipeline):
    result = ner_pipeline(text)
    # Convert numpy.float32 to float for JSON serialization
    for entity in result:
        if "score" in entity:
            entity["score"] = float(entity["score"])
    return {"entities": result}

#General use, digital documents
def parse_document_text(text: str, ner_pipeline):
    """
    Parse general digital document text using a NER pipeline.
    Returns extracted entities.
    """
    result = ner_pipeline(text)
    # Convert numpy.float32 to float for JSON serialization
    for entity in result:
        if "score" in entity:
            entity["score"] = float(entity["score"])
    return {"entities": result}

def extract_tables_from_pdf(pdf_path, pages="all"):
    """
    Extract tables from a PDF using tabula-py.
    Returns a list of pandas DataFrames, one for each table found.
    """
    # Read tables from PDF
    tables = read_pdf(pdf_path, pages=pages, multiple_tables=True)
    return tables

def extract_tables_with_camelot(pdf_path, pages="all"):
    """
    Extract tables from a PDF using Camelot.
    Returns a list of pandas DataFrames, one for each table found.
    """
    tables = camelot_read_pdf(pdf_path, pages=pages)
    dataframes = [table.df for table in tables]
    return dataframes

def export_tables_to_csv(tables, base_filename="table"):
    """
    Export a list of pandas DataFrames to CSV files.
    Each table will be saved as base_filename_{idx+1}.csv
    """
    for idx, table in enumerate(tables):
        filename = f"{base_filename}_{idx+1}.csv"
        table.to_csv(filename, index=False)
        print(f"Exported: {filename}")

# Example usage:
if __name__ == "__main__":
    pdf_file = "us-030.pdf"
    tables = extract_tables_with_camelot(pdf_file)
    export_tables_to_csv(tables)