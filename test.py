import matplotlib.pyplot as plt
from doctr.models import ocr_predictor
from doctr.io import DocumentFile
from doctr.utils.visualization import visualize_page


# Load a document (can be image or PDF)
doc = DocumentFile.from_images("samp.jpg")  # or DocumentFile.from_pdf("file.pdf")

# Load pretrained OCR model (detection + recognition)
model = ocr_predictor(det_arch="db_resnet34", reco_arch="crnn_vgg16_bn", pretrained=True)

# Run OCR
result = model(doc)





# Export results as a Python dict (JSON-serializable)
exported = result.export() #export() for structured JSON script, render() for raw text

def search_word(exported_doc, query: str):
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

page_dict = exported["pages"][0]

image = doc[0]


# Print extracted text page by page
for page in exported["pages"]:
    print("---- PAGE ----")
    for block in page["blocks"]:
        for line in block["lines"]:
            line_text = " ".join([word["value"] for word in line["words"]])
            print(line_text)
            
search_results = search_word(exported, "CAMPUS")  # Palitan ang "example" ng hinahanap na salita
print("Search Results:", search_results)
            
visualize_page(page_dict, image) #visualization ng output
plt.show()