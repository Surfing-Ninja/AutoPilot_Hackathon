# app/services/document_pipeline.py
import io
import fitz  # PyMuPDF
import pytesseract
from PIL import Image

def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract text from PDF using PyMuPDF. Fallbacks to Tesseract for image-based PDFs."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    full_text = ""
    
    for page in doc:
        text = page.get_text()
        if not text.strip():
            # If no text found, try OCR
            pix = page.get_pixmap()
            img = Image.open(io.BytesIO(pix.tobytes()))
            text = pytesseract.image_to_string(img)
        full_text += text + "\n"
        
    return full_text

def process_document(pdf_bytes: bytes) -> dict:
    """
    Pipeline Flow:
    1. PDF Upload -> 2. OCR Extraction -> 3. Clause Extraction -> 4. Risk Detection -> 5. Vector Embeddings
    """
    text = extract_text_from_pdf(pdf_bytes)
    
    # NOTE: ChromaDB and LangChain embeddings would be initialized here.
    # For the hackathon context, we mock the heavy embedding part to avoid long model downloads,
    # but the architecture is in place.
    
    # Dummy clause extraction and risk detection logic based on text content
    risks = []
    if "SLA" not in text:
        risks.append("Missing SLA clause")
    if "liability" in text.lower():
        risks.append("Contains liability clause - needs human review")
        
    return {
        "raw_text_length": len(text),
        "risks_detected": risks,
        "summary": "Document processed successfully with OCR pipeline.",
        "requires_human_review": len(risks) > 0
    }
