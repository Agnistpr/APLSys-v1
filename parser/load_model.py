from transformers.models.auto.tokenization_auto import AutoTokenizer
from transformers.models.auto.modeling_auto import AutoModelForTokenClassification
from transformers.pipelines import pipeline

model_name = "parser/model/bert-base-NER" #General Purpose NER model
tokenizer = AutoTokenizer.from_pretrained(model_name, local_files_only=True)
model = AutoModelForTokenClassification.from_pretrained(model_name, local_files_only=True)






ner_pipeline = pipeline("token-classification", model=model, tokenizer=tokenizer)
