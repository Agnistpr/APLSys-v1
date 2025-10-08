from doctr.models import ocr_predictor
from doctr.io import DocumentFile
from doctr.utils.visualization import visualize_page
import matplotlib.pyplot as plt
import layoutparser as lp
from layoutparser.models import Detectron2LayoutModel
import cv2
from PIL import Image
import numpy as np
import os
from dotenv import load_dotenv
from utils.img_to_b64 import image_to_base64
import requests
import json
import re
from operator import itemgetter
load_dotenv()


GEMINI_MODEL = "gemini-2.5-pro"
BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Load once at startup
ocr_model = ocr_predictor(det_arch="db_resnet34", reco_arch="crnn_vgg16_bn", pretrained=True)

async def run_ocr(file):
    # This runs inference on each new document
    content = await file.read()
    doc = DocumentFile.from_images([content])
    result = ocr_model(doc).export() #export() for structured JSON script, render() for raw text
    
    #print extracted text page by page
    for page in result["pages"]:
        print("---- PAGE ----")
        for block in page["blocks"]:
            for line in block["lines"]:
                line_text = " ".join([word["value"] for word in line["words"]])
                print(line_text)
    
    return result


def extract_tables_from_image(image_path):
    """
    Detect tables in an image using LayoutParser's PubLayNet model.
    Returns a list of table bounding boxes and cropped table images.
    """
    # Load image
    image = cv2.imread(image_path)
    if image is None:
        raise FileNotFoundError(f"Image at path '{image_path}' could not be loaded.")
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    model = Detectron2LayoutModel(
        config_path='lp://PubLayNet/faster_rcnn_R_50_FPN_3x/config',
        label_map={0: "Text", 1: "Title", 2: "List", 3: "Table", 4: "Figure"},
        extra_config=["MODEL.ROI_HEADS.SCORE_THRESH_TEST", 0.8]
    )

    # Detect layout
    layout = model.detect(image_rgb)

    # Filter for tables
    tables = [b for b in layout if b.type == "Table"]

    table_results = []
    for idx, table in enumerate(tables):
        x1, y1, x2, y2 = map(int, table.coordinates)
        table_img = image_rgb[y1:y2, x1:x2]
        table_results.append({
            "bbox": [x1, y1, x2, y2],
            "image": table_img
        })
        # Optionally, save or display the cropped table image
        # Image.fromarray(table_img).save(f"table_{idx+1}.png")

    return table_results

def run_ocr_on_document(file):
    # If file is bytes (uploaded file content)
    if isinstance(file, bytes):
        doc = DocumentFile.from_images([file])
    else:
        # If file is a path string
        if isinstance(file, str) and file.lower().endswith(".pdf"):
            doc = DocumentFile.from_pdf(file)
        else:
            doc = DocumentFile.from_images(file)
    model = ocr_model
    result = model(doc)
    exported = result.export()
    return doc, exported

async def search_word(exported_doc, query: str):
    """Search for words in OCR output and return matches with their boxes"""
    matches = []
    for page_idx, page in enumerate(exported_doc["pages"]):
        for block in page["blocks"]:
            for line in block["lines"]:
                for word in line["words"]:
                    if query.lower() in word["value"].lower():
                        matches.append({
                            "page": page_idx,
                            "word": word["value"],
                            "box": word["geometry"]  # normalized (x_min, y_min, x_max, y_max)
                        })
    return matches

def collect_all_pages(file_path):
    doc, exported = run_ocr_on_document(file_path)
    pages = []
    for page_idx, (page_dict, image) in enumerate(zip(exported["pages"], doc)):
        # Collect text for this page
        lines = []
        for block in page_dict["blocks"]:
            for line in block["lines"]:
                line_text = " ".join([word["value"] for word in line["words"]])
                lines.append(line_text)
        page_text = "\n".join(lines)
        pages.append({
            "page_number": page_idx + 1,
            "text": page_text,
            "image": image,
            "ocr_data": page_dict
        })
    return pages

def ocr_and_visualize(file_path, search_query=None):
    doc, exported = run_ocr_on_document(file_path)
    for page_idx, (page_dict, image) in enumerate(zip(exported["pages"], doc)):
        print(f"---- PAGE {page_idx+1} ----")
        for block in page_dict["blocks"]:
            for line in block["lines"]:
                line_text = " ".join([word["value"] for word in line["words"]])
                print(line_text)
        if search_query:
            search_results = search_word(exported, search_query)
            print("Search Results:", search_results)
        visualize_page(page_dict, image)
        plt.show()

# Example usage:
if __name__ == "__main__":
    print("Running OCR and visualization...")
    pages = collect_all_pages("SampMulti.pdf")
    for page in pages:
        print(f"Page {page['page_number']} Text:\n{page['text']}\n")
        print(page["text"])
        visualize_page(page["ocr_data"], page["image"])
        plt.show()
        input("Press Enter to go to the next page...")
    # print("Extracting tables from image...")
    # result = detect_table_layout("table3.jpg")# python -m services.ocr_service
    # print(result)
    # visualize_table_layout("table3.jpg", result)
