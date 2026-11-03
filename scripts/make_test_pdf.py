import fitz

with fitz.open() as doc:
    doc.new_page().insert_text((40, 60), "Ada: Hello from the uploaded comic!")
    doc.save("/tmp/panel-e2e.pdf")
