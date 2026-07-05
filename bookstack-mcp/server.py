import base64
import contextlib
import os
from io import BytesIO
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import requests
import uvicorn
from bs4 import BeautifulSoup
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from pypdf import PdfReader
from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Mount, Route


BOOKSTACK_BASE_URL = os.getenv("BOOKSTACK_BASE_URL", "http://bookstack").rstrip("/")
BOOKSTACK_TOKEN_ID = os.getenv("BOOKSTACK_TOKEN_ID")
BOOKSTACK_TOKEN_SECRET = os.getenv("BOOKSTACK_TOKEN_SECRET")

MCP_HOST = os.getenv("MCP_HOST", "0.0.0.0")
MCP_PORT = int(os.getenv("MCP_PORT", "8000"))


mcp = FastMCP(
    name="MDH BookStack MCP Server",
    stateless_http=True,
    json_response=True,
    transport_security=TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=[
            "localhost:*",
            "127.0.0.1:*",
            "bookstack-mcp",
            "bookstack-mcp:*",
            "bookstack-mcp:8000",
        ],
        allowed_origins=[
            "http://localhost:*",
            "http://127.0.0.1:*",
            "http://langflow:*",
            "http://langflow:7860",
        ],
    ),
)


def get_bookstack_headers() -> dict[str, str]:
    if not BOOKSTACK_TOKEN_ID or not BOOKSTACK_TOKEN_SECRET:
        raise RuntimeError(
            "Missing BOOKSTACK_TOKEN_ID or BOOKSTACK_TOKEN_SECRET environment variable."
        )

    return {
        "Authorization": f"Token {BOOKSTACK_TOKEN_ID}:{BOOKSTACK_TOKEN_SECRET}",
        "Accept": "application/json",
    }


def call_bookstack_api(
    path: str,
    params: dict[str, Any] | None = None,
) -> dict[str, Any]:
    url = f"{BOOKSTACK_BASE_URL}{path}"

    response = requests.get(
        url,
        headers=get_bookstack_headers(),
        params=params,
        timeout=60,
    )

    if response.status_code >= 400:
        raise RuntimeError(
            {
                "error": "BookStack API request failed",
                "url": url,
                "status_code": response.status_code,
                "response": response.text,
            }
        )

    return response.json()


def html_to_clean_text(html: str) -> str:
    soup = BeautifulSoup(html or "", "html.parser")

    for tag in soup(["script", "style"]):
        tag.decompose()

    text = soup.get_text(separator="\n", strip=True)

    lines = []
    for line in text.splitlines():
        clean_line = line.strip()
        if clean_line:
            lines.append(clean_line)

    return "\n".join(lines)


def get_uploaded_to_id(uploaded_to: Any) -> int | None:
    if isinstance(uploaded_to, dict):
        uploaded_to = uploaded_to.get("id")

    if uploaded_to is None:
        return None

    try:
        return int(uploaded_to)
    except (TypeError, ValueError):
        return None


def list_all_attachments_internal(max_attachments: int = 10000) -> list[dict[str, Any]]:
    """
    Get all visible BookStack attachments using pagination.
    This is important for get_all_pages_as_rag_text.
    """
    max_attachments = max(1, min(max_attachments, 10000))
    collected_attachments: list[dict[str, Any]] = []

    offset = 0
    batch_size = 500

    while len(collected_attachments) < max_attachments:
        result = call_bookstack_api(
            "/api/attachments",
            {
                "count": batch_size,
                "offset": offset,
            },
        )

        attachments = result.get("data", [])

        if not attachments:
            break

        collected_attachments.extend(attachments)

        total = result.get("total")

        if isinstance(total, int) and offset + len(attachments) >= total:
            break

        if len(attachments) < batch_size:
            break

        offset += batch_size

    return collected_attachments[:max_attachments]


def group_attachments_by_page(
    attachments: list[dict[str, Any]],
) -> dict[int, list[dict[str, Any]]]:
    grouped: dict[int, list[dict[str, Any]]] = {}

    for attachment in attachments:
        page_id = get_uploaded_to_id(attachment.get("uploaded_to"))

        if page_id is None:
            continue

        grouped.setdefault(page_id, []).append(attachment)

    return grouped


def decode_attachment_content(attachment: dict[str, Any]) -> bytes:
    """
    For uploaded files, BookStack returns base64 content.
    For external/link attachments, content is only the URL.
    """
    content = attachment.get("content")

    if not content:
        return b""

    if attachment.get("external"):
        return str(content).encode("utf-8", errors="ignore")

    content_text = str(content).strip()

    if content_text.startswith("data:") and "," in content_text:
        content_text = content_text.split(",", 1)[1]

    return base64.b64decode(content_text, validate=False)


def extract_pdf_text(file_bytes: bytes) -> str:
    """
    Extract real text from a PDF file.
    This works for normal text PDFs.
    It will not work well for scanned image-only PDFs without OCR.
    """
    if not file_bytes:
        return ""

    pdf_reader = PdfReader(BytesIO(file_bytes))
    text_parts = []

    for page_index, pdf_page in enumerate(pdf_reader.pages, start=1):
        page_text = pdf_page.extract_text() or ""

        if page_text.strip():
            text_parts.append(
                f"\n--- PDF Page {page_index} ---\n{page_text.strip()}"
            )

    return "\n".join(text_parts).strip()


def extract_text_file_content(file_bytes: bytes) -> str:
    if not file_bytes:
        return ""

    return file_bytes.decode("utf-8", errors="ignore").strip()


def extract_attachment_text(attachment_id: int) -> dict[str, Any]:
    """
    Reads one BookStack attachment and extracts text.
    For your uploaded PDF, external should be false and extension should be pdf.
    """
    attachment = call_bookstack_api(f"/api/attachments/{attachment_id}")

    attachment_name = attachment.get("name") or f"attachment-{attachment_id}"
    extension = (attachment.get("extension") or "").lower().strip(".")
    is_external = bool(attachment.get("external"))

    extracted_text = ""
    extraction_error = None

    try:
        if is_external:
            external_url = str(attachment.get("content") or "").strip()
            extracted_text = (
                f"External link attachment: {external_url}\n"
                "This is only a link, not uploaded PDF content. "
                "For best RAG, upload the actual PDF file to BookStack."
            )

        else:
            file_bytes = decode_attachment_content(attachment)

            if extension == "pdf":
                extracted_text = extract_pdf_text(file_bytes)

            elif extension in ["txt", "md", "csv", "json", "xml"]:
                extracted_text = extract_text_file_content(file_bytes)

            elif extension in ["html", "htm"]:
                extracted_text = html_to_clean_text(
                    extract_text_file_content(file_bytes)
                )

            else:
                extracted_text = (
                    f"Attachment '{attachment_name}' was found, "
                    f"but text extraction is not supported for extension '{extension}'."
                )

    except Exception as exc:
        extraction_error = str(exc)
        extracted_text = (
            f"Attachment '{attachment_name}' was found, "
            f"but text extraction failed: {extraction_error}"
        )

    return {
        "id": attachment.get("id"),
        "name": attachment_name,
        "extension": extension,
        "external": is_external,
        "uploaded_to": attachment.get("uploaded_to"),
        "created_at": attachment.get("created_at"),
        "updated_at": attachment.get("updated_at"),
        "links": attachment.get("links"),
        "text": extracted_text,
        "extraction_error": extraction_error,
    }


def build_page_text_with_attachments(
    page: dict[str, Any],
    page_attachments: list[dict[str, Any]] | None = None,
) -> tuple[str, list[dict[str, Any]]]:
    page_id = page.get("id")
    html = page.get("html") or ""

    page_text = html_to_clean_text(html)

    if page_id is None:
        return page_text, []

    attachments = page_attachments or []
    extracted_attachments = []

    for attachment in attachments:
        attachment_id = attachment.get("id")

        if attachment_id is None:
            continue

        extracted_attachment = extract_attachment_text(int(attachment_id))
        extracted_attachments.append(extracted_attachment)

        attachment_text = extracted_attachment.get("text", "")

        if attachment_text.strip():
            page_text = (
                f"{page_text}\n\n"
                f"--- Attachment: {extracted_attachment.get('name')} "
                f"[id={extracted_attachment.get('id')}, "
                f"extension={extracted_attachment.get('extension')}, "
                f"external={extracted_attachment.get('external')}] ---\n"
                f"{attachment_text}"
            )

    return page_text.strip(), extracted_attachments


def get_page_internal(
    page_id: int,
    include_attachments: bool = True,
    page_attachments: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    page = call_bookstack_api(f"/api/pages/{page_id}")

    if include_attachments:
        text, attachments = build_page_text_with_attachments(
            page=page,
            page_attachments=page_attachments,
        )
    else:
        text = html_to_clean_text(page.get("html") or "")
        attachments = []

    return {
        "id": page.get("id"),
        "name": page.get("name"),
        "slug": page.get("slug"),
        "book_id": page.get("book_id"),
        "chapter_id": page.get("chapter_id"),
        "url": page.get("url"),
        "created_at": page.get("created_at"),
        "updated_at": page.get("updated_at"),
        "text": text,
        "attachment_count": len(attachments),
        "attachments": attachments,
    }


def format_page_for_rag(page: dict[str, Any]) -> str:
    page_name = page.get("name") or "Untitled Page"
    page_id = page.get("id")
    page_url = page.get("url") or ""
    updated_at = page.get("updated_at") or ""
    page_text = page.get("text") or ""

    return "\n".join(
        [
            "==============================",
            f"PAGE TITLE: {page_name}",
            f"PAGE ID: {page_id}",
            f"PAGE URL: {page_url}",
            f"UPDATED AT: {updated_at}",
            "CONTENT:",
            page_text,
            "==============================",
        ]
    )


@mcp.tool()
def get_attachment_text(attachment_id: int) -> dict[str, Any]:
    """
    Test one attachment.
    Use this first to confirm PDF extraction works.
    """
    return extract_attachment_text(attachment_id)


@mcp.tool()
def list_all_attachments(max_attachments: int = 10000) -> dict[str, Any]:
    """
    Debug tool: shows whether MCP can see BookStack attachments.
    """
    attachments = list_all_attachments_internal(max_attachments=max_attachments)

    return {
        "total_collected": len(attachments),
        "attachments": attachments,
    }


@mcp.tool()
def get_all_pages(
    max_pages: int = 5000,
    include_attachments: bool = True,
    max_attachments: int = 10000,
) -> dict[str, Any]:
    """
    Get all BookStack pages.
    If include_attachments=true, uploaded PDF text is added into page text.
    """
    max_pages = max(1, min(max_pages, 10000))

    collected_pages = []
    offset = 0
    batch_size = 500

    attachments_by_page: dict[int, list[dict[str, Any]]] = {}
    total_attachments_found = 0

    if include_attachments:
        all_attachments = list_all_attachments_internal(
            max_attachments=max_attachments
        )
        total_attachments_found = len(all_attachments)
        attachments_by_page = group_attachments_by_page(all_attachments)

    while len(collected_pages) < max_pages:
        list_result = call_bookstack_api(
            "/api/pages",
            {
                "count": batch_size,
                "offset": offset,
            },
        )

        page_items = list_result.get("data", [])

        if not page_items:
            break

        for page_item in page_items:
            if len(collected_pages) >= max_pages:
                break

            page_id = page_item.get("id")

            if page_id is None:
                continue

            page_attachments = attachments_by_page.get(int(page_id), [])

            full_page = get_page_internal(
                page_id=int(page_id),
                include_attachments=include_attachments,
                page_attachments=page_attachments,
            )

            collected_pages.append(full_page)

        total = list_result.get("total")

        if isinstance(total, int) and offset + len(page_items) >= total:
            break

        if len(page_items) < batch_size:
            break

        offset += batch_size

    total_attachments_added_to_pages = sum(
        page.get("attachment_count", 0) for page in collected_pages
    )

    return {
        "total_collected": len(collected_pages),
        "include_attachments": include_attachments,
        "total_attachments_found": total_attachments_found,
        "total_attachments_added_to_pages": total_attachments_added_to_pages,
        "pages": collected_pages,
    }


@mcp.tool()
def get_all_pages_as_rag_text(
    max_pages: int = 5000,
    include_attachments: bool = True,
    max_attachments: int = 10000,
) -> dict[str, Any]:
    """
    Main tool for Langflow RAG.
    Output should go to Split Text -> Embeddings -> ChromaDB.
    """
    result = get_all_pages(
        max_pages=max_pages,
        include_attachments=include_attachments,
        max_attachments=max_attachments,
    )

    pages = result.get("pages", [])

    rag_text_parts = []

    for page in pages:
        rag_text_parts.append(format_page_for_rag(page))

    return {
        "total_pages": len(pages),
        "include_attachments": include_attachments,
        "total_attachments_found": result.get("total_attachments_found"),
        "total_attachments_added_to_pages": result.get(
            "total_attachments_added_to_pages"
        ),
        "rag_text": "\n\n".join(rag_text_parts),
    }


async def health_check(request):
    return JSONResponse(
        {
            "status": "ok",
            "service": "bookstack-mcp",
            "bookstack_base_url": BOOKSTACK_BASE_URL,
        }
    )


@contextlib.asynccontextmanager
async def lifespan(app: Starlette):
    async with mcp.session_manager.run():
        yield


app = Starlette(
    routes=[
        Route("/health", health_check),
        Mount("/", app=mcp.streamable_http_app()),
    ],
    lifespan=lifespan,
)


if __name__ == "__main__":
    uvicorn.run(
        app,
        host=MCP_HOST,
        port=MCP_PORT,
    )