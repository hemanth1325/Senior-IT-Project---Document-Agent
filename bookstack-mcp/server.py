import base64
import contextlib
import os
from io import BytesIO
from typing import Any

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


def simplify_page(page: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": page.get("id"),
        "name": page.get("name"),
        "slug": page.get("slug"),
        "book_id": page.get("book_id"),
        "chapter_id": page.get("chapter_id"),
        "url": page.get("url"),
        "created_at": page.get("created_at"),
        "updated_at": page.get("updated_at"),
    }


def list_attachments_for_page_internal(page_id: int) -> list[dict[str, Any]]:
    result = call_bookstack_api(
        "/api/attachments",
        {
            "count": 500,
            "filter[uploaded_to]": page_id,
        },
    )

    attachments = result.get("data", [])

    filtered_attachments = []

    for attachment in attachments:
        uploaded_to = attachment.get("uploaded_to")

        if isinstance(uploaded_to, int) and uploaded_to == page_id:
            filtered_attachments.append(attachment)
            continue

        if isinstance(uploaded_to, dict) and uploaded_to.get("id") == page_id:
            filtered_attachments.append(attachment)
            continue

        if str(uploaded_to) == str(page_id):
            filtered_attachments.append(attachment)
            continue

    return filtered_attachments


def decode_attachment_content(attachment: dict[str, Any]) -> bytes:
    content = attachment.get("content")

    if not content:
        return b""

    if attachment.get("external"):
        return str(content).encode("utf-8", errors="ignore")

    return base64.b64decode(content)


def extract_pdf_text(file_bytes: bytes) -> str:
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
    attachment = call_bookstack_api(f"/api/attachments/{attachment_id}")

    attachment_name = attachment.get("name") or f"attachment-{attachment_id}"
    extension = (attachment.get("extension") or "").lower().strip(".")
    is_external = bool(attachment.get("external"))

    file_bytes = decode_attachment_content(attachment)

    extracted_text = ""

    if is_external:
        extracted_text = file_bytes.decode("utf-8", errors="ignore").strip()

    elif extension == "pdf":
        extracted_text = extract_pdf_text(file_bytes)

    elif extension in ["txt", "md", "csv", "json", "xml", "html"]:
        extracted_text = extract_text_file_content(file_bytes)

    else:
        extracted_text = (
            f"Attachment '{attachment_name}' was found, "
            f"but text extraction is not supported for extension '{extension}'."
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
    }


def build_page_text_with_attachments(
    page: dict[str, Any],
) -> tuple[str, list[dict[str, Any]]]:
    page_id = page.get("id")
    html = page.get("html") or ""

    page_text = html_to_clean_text(html)

    if page_id is None:
        return page_text, []

    attachments = list_attachments_for_page_internal(int(page_id))

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
                f"--- Attachment: {extracted_attachment.get('name')} ---\n"
                f"{attachment_text}"
            )

    return page_text.strip(), extracted_attachments


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
def bookstack_status() -> dict[str, Any]:
    """
    Check whether the MCP server can connect to the BookStack API.
    """
    result = call_bookstack_api("/api/pages", {"count": 1})

    return {
        "status": "connected",
        "bookstack_base_url": BOOKSTACK_BASE_URL,
        "sample_result_keys": list(result.keys()),
    }


@mcp.tool()
def list_pages(count: int = 20, offset: int = 0) -> dict[str, Any]:
    """
    List BookStack pages.
    """
    count = max(1, min(count, 100))
    offset = max(0, offset)

    result = call_bookstack_api(
        "/api/pages",
        {
            "count": count,
            "offset": offset,
        },
    )

    pages = result.get("data", [])

    return {
        "total": result.get("total"),
        "count": count,
        "offset": offset,
        "pages": [simplify_page(page) for page in pages],
    }


@mcp.tool()
def get_page(page_id: int, include_attachments: bool = True) -> dict[str, Any]:
    """
    Get one BookStack page by page ID.

    If include_attachments is true, supported attachment text is added
    to the returned page text.
    """
    page = call_bookstack_api(f"/api/pages/{page_id}")

    if include_attachments:
        text, attachments = build_page_text_with_attachments(page)
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
        "attachments": attachments,
    }


@mcp.tool()
def get_page_as_rag_text(
    page_id: int,
    include_attachments: bool = True,
) -> dict[str, Any]:
    """
    Get one BookStack page as clean text for Langflow RAG ingestion.
    """
    page = get_page(
        page_id=page_id,
        include_attachments=include_attachments,
    )

    return {
        "page_id": page.get("id"),
        "page_name": page.get("name"),
        "page_url": page.get("url"),
        "rag_text": format_page_for_rag(page),
    }


@mcp.tool()
def search_bookstack(query: str, count: int = 10) -> dict[str, Any]:
    """
    Search BookStack content using the BookStack search API.
    """
    if not query.strip():
        raise ValueError("query cannot be empty")

    count = max(1, min(count, 50))

    result = call_bookstack_api(
        "/api/search",
        {
            "query": query,
            "count": count,
        },
    )

    return result


@mcp.tool()
def list_page_attachments(page_id: int) -> dict[str, Any]:
    """
    List all attachments uploaded to a specific BookStack page.
    """
    attachments = list_attachments_for_page_internal(page_id)

    return {
        "page_id": page_id,
        "total_attachments": len(attachments),
        "attachments": attachments,
    }


@mcp.tool()
def get_attachment_text(attachment_id: int) -> dict[str, Any]:
    """
    Extract readable text from a BookStack attachment.

    Supported attachment types:
    PDF, TXT, MD, CSV, JSON, XML, HTML.
    """
    return extract_attachment_text(attachment_id)


@mcp.tool()
def get_all_pages(
    max_pages: int = 200,
    include_attachments: bool = True,
) -> dict[str, Any]:
    """
    Get all BookStack pages with clean text.

    This returns structured page data.
    Use get_all_pages_as_rag_text when you want one plain text block
    for Langflow RAG ingestion.
    """
    max_pages = max(1, min(max_pages, 500))

    collected_pages = []
    offset = 0
    batch_size = 50

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

            full_page = get_page(
                page_id=int(page_id),
                include_attachments=include_attachments,
            )

            collected_pages.append(full_page)

        offset += batch_size

    return {
        "total_collected": len(collected_pages),
        "include_attachments": include_attachments,
        "pages": collected_pages,
    }


@mcp.tool()
def get_all_pages_as_rag_text(
    max_pages: int = 200,
    include_attachments: bool = True,
) -> dict[str, Any]:
    """
    Get all BookStack pages as one clean RAG text block.

    This is the easiest tool to use in Langflow before Split Text,
    Embeddings, and ChromaDB.
    """
    result = get_all_pages(
        max_pages=max_pages,
        include_attachments=include_attachments,
    )

    pages = result.get("pages", [])

    rag_text_parts = []

    for page in pages:
        rag_text_parts.append(format_page_for_rag(page))

    return {
        "total_pages": len(pages),
        "include_attachments": include_attachments,
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