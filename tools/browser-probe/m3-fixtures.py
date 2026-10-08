"""Synthetic KBV-BFB barcode fixtures, never patient records.

Reproduce using pdf417gen==0.8.1, reportlab==4.4.10 and Pillow.
The KBV field layout is checked deterministically against BFB 4.80 §3.11.1.
"""
from pathlib import Path
import json
from pdf417gen import encode, render_image
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

target = Path(__file__).parent / "fixtures" / "m3"
target.mkdir(parents=True, exist_ok=True)
fields = [
    "13", "", "10", "Müller", "Zoë", "19750308", "", "104212059",
    "A123456780", "1", "00", "00", "123456789", "987654321", "20261007",
    "2", "E11.74", "", "DF", "a", "", "Hornhautabtragung", "6", "", "",
    "", "", "", "", "1-2", "1", "0", "",
]
assert len(fields) == 33
text = "\t".join(fields)
(target / "muster13.json").write_text(json.dumps(fields, ensure_ascii=False) + "\n", encoding="utf-8")
for name, data in [("muster13", text), ("unsupported", text.replace("13\t\t10", "13\t\t09", 1))]:
    image = render_image(encode(data, columns=8, security_level=3, encoding="iso-8859-15"), scale=3, ratio=3, padding=24)
    image.save(target / f"{name}.png")
    if name == "muster13":
        image.rotate(90, expand=True).save(target / "muster13-rotated.png")
        sheet = canvas.Canvas(str(target / "muster13.pdf"), pagesize=(595, 842))
        sheet.setTitle("Synthetic Muster 13 barcode test - no patient data")
        sheet.drawString(40, 790, "SYNTHETISCHER TEST - KEIN PATIENT")
        sheet.drawImage(ImageReader(image), 30, 450, width=535, height=535 * image.height / image.width)
        sheet.save()
        sheet = canvas.Canvas(str(target / "muster13-page2.pdf"), pagesize=(595, 842))
        sheet.drawString(40, 790, "SYNTHETISCH - LEERE SEITE")
        sheet.showPage()
        sheet.drawImage(ImageReader(image), 30, 450, width=535, height=535 * image.height / image.width)
        sheet.save()
        multi = canvas.Canvas(str(target / "two-prescriptions.pdf"), pagesize=(595, 842))
        for surname in ("Müller", "Schneider"):
            other = fields.copy()
            other[3] = surname
            img = render_image(encode("\t".join(other), columns=8, security_level=3, encoding="iso-8859-15"), scale=3, ratio=3, padding=24)
            multi.drawImage(ImageReader(img), 30, 450, width=535, height=535 * img.height / img.width)
            multi.showPage()
        multi.save()
        large = canvas.Canvas(str(target / "large-page.pdf"), pagesize=(2000, 2000))
        large.drawImage(ImageReader(image), 100, 1400, width=900, height=900 * image.height / image.width)
        large.save()
        duplicate = canvas.Canvas(str(target / "duplicate-barcode.pdf"), pagesize=(595, 842))
        for _ in range(2):
            duplicate.drawImage(ImageReader(image), 30, 450, width=535, height=535 * image.height / image.width)
            duplicate.showPage()
        duplicate.save()
        too_many = canvas.Canvas(str(target / "six-pages.pdf"), pagesize=(595, 842))
        for _ in range(6):
            too_many.drawString(40, 790, "SYNTHETISCH - SEITENLIMIT")
            too_many.showPage()
        too_many.save()
print("Synthetic fixtures:", target)
