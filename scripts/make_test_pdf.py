import fitz

with fitz.open() as doc:
    doc.new_page().insert_text((40, 60), "Ada: Hello from the uploaded comic!")
    doc.save("/tmp/panel-e2e.pdf")

with fitz.open() as doc:
    for text in ["Grandpa: I am terrified!", "Grandpa: We can find the light."]:
        doc.new_page().insert_text((40, 60), text)
    doc.save("/tmp/panel-casting-e2e.pdf")
