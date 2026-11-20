from dataclasses import dataclass
import io
from pathlib import Path
import re
from typing import Literal
import xml.etree.ElementTree as ET
import zipfile

from pypdf import PdfReader

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_EXTRACTED_CHARS = 50_000
ALLOWED_EXTENSIONS = frozenset({".pdf", ".docx", ".txt"})

_W_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
_CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_MULTI_NEWLINES_RE = re.compile(r"\n{3,}")


class DocumentExtractionError(Exception):
    """Raised when an uploaded file cannot be safely parsed or is unsupported."""

    def __init__(self, detail: str, *, status_code: int = 422) -> None:
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


@dataclass
class ScrubbedDocument:
    """Plain text extracted in memory with document metadata, comments, and deletions stripped."""

    filename: str
    file_type: Literal["pdf", "docx", "txt"]
    text: str
    char_count: int
    page_count: int | None
    stripped_metadata_fields: list[str]
    stripped_comments_count: int
    stripped_revisions_count: int
    truncated: bool


def _clean_text(raw: str) -> tuple[str, bool]:
    normalized = raw.replace("\r\n", "\n").replace("\r", "\n")
    normalized = _CONTROL_CHARS_RE.sub("", normalized)
    normalized = _MULTI_NEWLINES_RE.sub("\n\n", normalized).strip()
    if len(normalized) > MAX_EXTRACTED_CHARS:
        return normalized[:MAX_EXTRACTED_CHARS].rstrip(), True
    return normalized, False


def _local_tag(tag: str) -> str:
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag


def _extract_txt(filename: str, data: bytes) -> ScrubbedDocument:
    try:
        decoded = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        decoded = data.decode("latin-1", errors="replace")

    cleaned, truncated = _clean_text(decoded)
    if not cleaned:
        raise DocumentExtractionError("Uploaded text file is empty.", status_code=422)

    return ScrubbedDocument(
        filename=filename,
        file_type="txt",
        text=cleaned,
        char_count=len(cleaned),
        page_count=None,
        stripped_metadata_fields=[],
        stripped_comments_count=0,
        stripped_revisions_count=0,
        truncated=truncated,
    )


def _walk_docx_node(node: ET.Element, parts: list[str], revision_counter: list[int]) -> None:
    """Recursively collect visible DOCX text while dropping <w:del> tracked deletions."""
    tag = node.tag
    if tag == f"{_W_NS}del":
        revision_counter[0] += 1
        return
    if tag == f"{_W_NS}delText":
        return
    if tag == f"{_W_NS}t" and node.text:
        parts.append(node.text)
        return
    if tag == f"{_W_NS}tab":
        parts.append("\t")
        return
    if tag == f"{_W_NS}br":
        parts.append("\n")
        return

    for child in node:
        _walk_docx_node(child, parts, revision_counter)


def _extract_docx(filename: str, data: bytes) -> ScrubbedDocument:
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile as exc:
        raise DocumentExtractionError("Invalid or corrupted DOCX file.", status_code=422) from exc

    with zf:
        names = set(zf.namelist())
        if "word/document.xml" not in names:
            raise DocumentExtractionError(
                "DOCX archive is missing word/document.xml.", status_code=422
            )

        # Record non-empty document metadata field names that are intentionally excluded.
        stripped_metadata: list[str] = []
        for prop_path, prefix in (("docProps/core.xml", "core"), ("docProps/app.xml", "app")):
            if prop_path not in names:
                continue
            try:
                root = ET.fromstring(zf.read(prop_path))
                for elem in root:
                    if elem.text and elem.text.strip():
                        stripped_metadata.append(f"{prefix}:{_local_tag(elem.tag)}")
            except ET.ParseError:
                continue

        # Count review comments excluded from extraction.
        stripped_comments = 0
        if "word/comments.xml" in names:
            try:
                comments_root = ET.fromstring(zf.read("word/comments.xml"))
                stripped_comments = len(comments_root.findall(f".//{_W_NS}comment"))
            except ET.ParseError:
                stripped_comments = 0

        # Parse visible paragraphs and table cells while dropping tracked deletions (<w:del>).
        try:
            doc_root = ET.fromstring(zf.read("word/document.xml"))
        except ET.ParseError as exc:
            raise DocumentExtractionError("Could not parse DOCX XML content.", status_code=422) from exc

        revision_counter = [0]
        paragraphs: list[str] = []
        for para in doc_root.findall(f".//{_W_NS}p"):
            parts: list[str] = []
            _walk_docx_node(para, parts, revision_counter)
            line = "".join(parts).strip()
            if line:
                paragraphs.append(line)

    cleaned, truncated = _clean_text("\n\n".join(paragraphs))
    if not cleaned:
        raise DocumentExtractionError("No extractable text found in DOCX file.", status_code=422)

    return ScrubbedDocument(
        filename=filename,
        file_type="docx",
        text=cleaned,
        char_count=len(cleaned),
        page_count=None,
        stripped_metadata_fields=sorted(set(stripped_metadata)),
        stripped_comments_count=stripped_comments,
        stripped_revisions_count=revision_counter[0],
        truncated=truncated,
    )


def _extract_pdf(filename: str, data: bytes) -> ScrubbedDocument:
    try:
        reader = PdfReader(io.BytesIO(data))
    except Exception as exc:  # noqa: BLE001 — malformed PDF
        raise DocumentExtractionError("Invalid or corrupted PDF file.", status_code=422) from exc

    if reader.is_encrypted:
        raise DocumentExtractionError(
            "Password-protected PDFs are not supported. Upload an unlocked PDF.",
            status_code=422,
        )

    stripped_metadata: list[str] = []
    if reader.metadata:
        for key, value in reader.metadata.items():
            if value is not None and str(value).strip():
                stripped_metadata.append(str(key).lstrip("/"))

    stripped_comments = 0
    page_texts: list[str] = []
    for page in reader.pages:
        annots = page.get("/Annots")
        if annots is not None:
            try:
                resolved = annots.get_object()
                if isinstance(resolved, list):
                    stripped_comments += len(resolved)
            except Exception:  # noqa: BLE001
                pass
        extracted = page.extract_text() or ""
        if extracted.strip():
            page_texts.append(extracted.strip())

    cleaned, truncated = _clean_text("\n\n".join(page_texts))
    if not cleaned:
        raise DocumentExtractionError(
            "No extractable text found in PDF (scanned image-only PDFs require OCR, which is not enabled yet).",
            status_code=422,
        )

    return ScrubbedDocument(
        filename=filename,
        file_type="pdf",
        text=cleaned,
        char_count=len(cleaned),
        page_count=len(reader.pages),
        stripped_metadata_fields=sorted(set(stripped_metadata)),
        stripped_comments_count=stripped_comments,
        stripped_revisions_count=0,
        truncated=truncated,
    )


def extract_and_scrub_document(filename: str, data: bytes) -> ScrubbedDocument:
    """
    Validate and extract plain text from .pdf, .docx, or .txt entirely in memory while
    stripping document metadata, comments/annotations, and DOCX tracked deletions.
    """
    safe_name = Path(filename or "document.txt").name
    ext = Path(safe_name).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise DocumentExtractionError(
            f"Unsupported file type '{ext or 'unknown'}'. Upload a .pdf, .docx, or .txt file.",
            status_code=400,
        )
    if not data:
        raise DocumentExtractionError("Uploaded file is empty.", status_code=422)
    if len(data) > MAX_UPLOAD_BYTES:
        raise DocumentExtractionError(
            f"File exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB upload limit.",
            status_code=413,
        )

    if ext == ".txt":
        return _extract_txt(safe_name, data)
    if ext == ".docx":
        return _extract_docx(safe_name, data)
    return _extract_pdf(safe_name, data)
