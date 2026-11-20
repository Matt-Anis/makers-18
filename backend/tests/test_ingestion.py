from collections.abc import Generator
import io
from pathlib import Path
import zipfile

from fastapi.testclient import TestClient
from pypdf import PdfWriter
from pypdf.generic import (
    ArrayObject,
    DecodedStreamObject,
    DictionaryObject,
    NameObject,
    TextStringObject,
)
import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

import app.main as main_module
from app.db import Base, build_engine, get_db
from app.main import app
from app.models import AuditLog, User, UserRole
from app.security import hash_password


def _make_test_docx() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            "docProps/core.xml",
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
            'xmlns:dc="http://purl.org/dc/elements/1.1/">'
            "<dc:creator>Secret Author Name</dc:creator>"
            "<cp:lastModifiedBy>Hidden Reviewer</cp:lastModifiedBy>"
            "</cp:coreProperties>",
        )
        zf.writestr(
            "word/comments.xml",
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            '<w:comment w:id="1" w:author="Counsel">'
            "<w:p><w:r><w:t>Confidential margin note DO NOT SHARE</w:t></w:r></w:p>"
            "</w:comment>"
            "</w:comments>",
        )
        zf.writestr(
            "word/document.xml",
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            "<w:body>"
            "<w:p>"
            "<w:r><w:t>SERVICE AGREEMENT between Atlas Tech and Karim Benali. </w:t></w:r>"
            '<w:del w:id="2"><w:r><w:delText>DELETED SECRET PENALTY 999999</w:delText></w:r></w:del>'
            '<w:ins w:id="3"><w:r><w:t>Standard liability cap applies.</w:t></w:r></w:ins>'
            "</w:p>"
            "</w:body>"
            "</w:document>",
        )
    return buf.getvalue()


def _make_test_pdf(*, with_text: bool = True) -> bytes:
    writer = PdfWriter()
    page = writer.add_blank_page(width=612, height=792)
    writer.add_metadata(
        {
            "/Author": "Secret PDF Author",
            "/Creator": "Internal Legal Word",
            "/Title": "Confidential Draft",
        }
    )
    if with_text:
        font = DictionaryObject(
            {
                NameObject("/Type"): NameObject("/Font"),
                NameObject("/Subtype"): NameObject("/Type1"),
                NameObject("/BaseFont"): NameObject("/Helvetica"),
            }
        )
        font_ref = writer._add_object(font)
        page[NameObject("/Resources")] = DictionaryObject(
            {NameObject("/Font"): DictionaryObject({NameObject("/F1"): font_ref})}
        )
        stream = DecodedStreamObject()
        stream.set_data(b"BT /F1 12 Tf 72 720 Td (Agreement between Sonatrach and Nadia Mansouri.) Tj ET")
        page[NameObject("/Contents")] = writer._add_object(stream)

        annot = DictionaryObject(
            {
                NameObject("/Type"): NameObject("/Annot"),
                NameObject("/Subtype"): NameObject("/Text"),
                NameObject("/Contents"): TextStringObject("Secret sticky note annotation"),
            }
        )
        page[NameObject("/Annots")] = ArrayObject([writer._add_object(annot)])

    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


@pytest.fixture()
def ingestion_env(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> Generator[tuple[TestClient, sessionmaker[Session]], None, None]:
    db_file = tmp_path / "test_ingestion.db"
    test_engine = build_engine(f"sqlite:///{db_file}")
    TestingSessionLocal = sessionmaker(
        bind=test_engine,
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
    )
    monkeypatch.setattr(main_module, "engine", test_engine)
    monkeypatch.setattr(main_module, "SessionLocal", TestingSessionLocal)
    Base.metadata.create_all(bind=test_engine)

    with TestingSessionLocal() as db:
        db.add(
            User(
                email="anis@acme.local",
                full_name="Anis User",
                role=UserRole.USER.value,
                password_hash=hash_password("anis-secret-123"),
                is_active=True,
            )
        )
        db.commit()

    def override_get_db() -> Generator[Session, None, None]:
        with TestingSessionLocal() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as test_client:
            yield test_client, TestingSessionLocal
    finally:
        app.dependency_overrides.clear()
        test_engine.dispose()


def test_ingestion_extracts_and_strips_docx_pdf_and_txt(ingestion_env) -> None:
    client, session_factory = ingestion_env

    # Unauthenticated uploads are rejected.
    unauth = client.post(
        "/ingestion/extract",
        files={"file": ("note.txt", b"hello", "text/plain")},
    )
    assert unauth.status_code == 401

    login = client.post(
        "/auth/login",
        json={"email": "anis@acme.local", "password": "anis-secret-123"},
    )
    assert login.status_code == 200

    # 1) DOCX: extracts visible + inserted text, strips core metadata, comments, and w:del text.
    docx_res = client.post(
        "/ingestion/extract",
        files={
            "file": (
                "nda.docx",
                _make_test_docx(),
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
        },
    )
    assert docx_res.status_code == 200
    docx_body = docx_res.json()
    assert docx_body["file_type"] == "docx"
    assert "SERVICE AGREEMENT between Atlas Tech and Karim Benali." in docx_body["text"]
    assert "Standard liability cap applies." in docx_body["text"]
    assert "Secret Author Name" not in docx_res.text
    assert "Hidden Reviewer" not in docx_res.text
    assert "Confidential margin note" not in docx_res.text
    assert "DELETED SECRET PENALTY" not in docx_res.text
    assert "core:creator" in docx_body["stripped_metadata_fields"]
    assert docx_body["stripped_comments_count"] == 1
    assert docx_body["stripped_revisions_count"] == 1

    # 2) PDF: extracts page text while stripping PDF metadata and sticky note annotations.
    pdf_res = client.post(
        "/ingestion/extract",
        files={"file": ("contract.pdf", _make_test_pdf(with_text=True), "application/pdf")},
    )
    assert pdf_res.status_code == 200
    pdf_body = pdf_res.json()
    assert pdf_body["file_type"] == "pdf"
    assert pdf_body["page_count"] == 1
    assert "Agreement between Sonatrach and Nadia Mansouri." in pdf_body["text"]
    assert "Secret PDF Author" not in pdf_res.text
    assert "Secret sticky note annotation" not in pdf_res.text
    assert "Author" in pdf_body["stripped_metadata_fields"]
    assert pdf_body["stripped_comments_count"] == 1

    # 3) Scanned / empty PDF fails clearly with 422.
    empty_pdf = client.post(
        "/ingestion/extract",
        files={"file": ("scan.pdf", _make_test_pdf(with_text=False), "application/pdf")},
    )
    assert empty_pdf.status_code == 422

    # 4) TXT with UTF-8 BOM & control chars + unsupported extension rejected cleanly.
    txt_res = client.post(
        "/ingestion/extract",
        files={"file": ("clause.txt", b"\xef\xbb\xbfClause 1:\x00 Confidentiality.", "text/plain")},
    )
    assert txt_res.status_code == 200
    assert txt_res.json()["text"] == "Clause 1: Confidentiality."

    bad_ext = client.post(
        "/ingestion/extract",
        files={"file": ("malware.exe", b"MZ...", "application/octet-stream")},
    )
    assert bad_ext.status_code == 400

    # Metadata-only audit logs recorded with zero raw document text.
    with session_factory() as db:
        logs = list(db.scalars(select(AuditLog).where(AuditLog.action == "document.extracted")))
        assert len(logs) == 3
