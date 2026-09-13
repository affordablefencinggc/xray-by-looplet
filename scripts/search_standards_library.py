"""Index original PDF pages locally, and return source-linked excerpts for assistants."""
import argparse
import hashlib
import json
import re
import sqlite3
from pathlib import Path

LIBRARY = Path(__file__).resolve().parents[1] / 'downloads/standards'
DATABASE = LIBRARY / 'search.sqlite'

def index():
    import pypdfium2 as pdfium
    catalogue = json.loads((LIBRARY/'CATALOG.json').read_text())
    with sqlite3.connect(DATABASE) as db:
        db.execute('CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, metadata TEXT, pages INTEGER, empty_pages INTEGER)')
        db.execute('CREATE VIRTUAL TABLE IF NOT EXISTS passages USING fts5(document_id UNINDEXED, page UNINDEXED, text)')
        for entry in catalogue['documents']:
            # Summaries must never masquerade as published standards in results.
            if entry['kind'] != 'source_pdf' or db.execute('SELECT 1 FROM documents WHERE id=?',(entry['id'],)).fetchone():
                continue
            source = LIBRARY / entry['local_path']
            with source.open('rb') as stream:
                if hashlib.file_digest(stream,'sha256').hexdigest() != entry['sha256']:
                    raise ValueError(f"Source changed: {entry['filename']}")
            empty = 0
            try:
                with pdfium.PdfDocument(source) as pdf:
                    pages = len(pdf)
                    for number in range(pages):
                        page = pdf[number]
                        try:
                            textpage = page.get_textpage()
                            try:
                                text = textpage.get_text_range()
                            finally:
                                textpage.close()
                        finally:
                            page.close()
                        if text.strip():
                            db.execute('INSERT INTO passages VALUES (?,?,?)',(entry['id'],number+1,text))
                        else:
                            empty += 1
                db.execute('INSERT INTO documents VALUES (?,?,?,?)',(entry['id'],json.dumps(entry),pages,empty))
                db.commit()
                print(json.dumps(dict(file=entry['filename'],pages=pages,empty_pages=empty)),flush=True)
            except Exception:
                db.rollback()
                raise

def search(topic, edition=None):
    words = re.findall(r'[A-Za-z0-9]+',topic)[:12]
    if not words:
        return []
    query = ' AND '.join('"'+word+'"' for word in words)
    with sqlite3.connect(f'file:{DATABASE.as_posix()}?mode=ro',uri=True) as db:
        sql = '''SELECT d.metadata, p.page, snippet(passages,2,'','', ' … ',64)
          FROM passages p JOIN documents d ON d.id=p.document_id
          WHERE passages MATCH ?'''
        parameters = [query]
        if edition:
            sql += " AND json_extract(d.metadata,'$.edition')=?"
            parameters.append(edition)
        sql += ' ORDER BY rank LIMIT 20'
        return [dict(document=json.loads(metadata),pdf_page=int(page),excerpt=excerpt)
                for metadata,page,excerpt in db.execute(sql,parameters)]

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--index',action='store_true')
    parser.add_argument('--query')
    parser.add_argument('--edition')
    args = parser.parse_args()
    if args.index:
        index()
    elif args.query:
        print(json.dumps(search(args.query,args.edition),ensure_ascii=False,indent=2))
    else:
        parser.error('Choose --index or --query')
