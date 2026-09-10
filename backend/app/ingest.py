"""Turn a URL or an uploaded file into plain text for the model."""

from html.parser import HTMLParser
from io import BytesIO
from urllib.parse import urlparse
from urllib.request import Request as UrlRequest, urlopen

from fastapi import HTTPException, UploadFile
from pypdf import PdfReader

_MAX_DOWNLOAD_BYTES = 2_000_000


class _TextParser(HTMLParser):
    """Collect visible text, skipping script/style/noscript blocks."""

    _SKIP = {"script", "style", "noscript"}

    def __init__(self):
        super().__init__()
        self.parts: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag in self._SKIP:
            self._skip_depth += 1

    def handle_endtag(self, tag):
        if tag in self._SKIP and self._skip_depth:
            self._skip_depth -= 1

    def handle_data(self, data):
        if not self._skip_depth:
            cleaned = " ".join(data.split())
            if cleaned:
                self.parts.append(cleaned)


def read_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(status_code=400, detail="Enter a valid http(s) URL.")

    request = UrlRequest(url, headers={"User-Agent": "NotesToQuiz/1.0"})
    try:
        with urlopen(request, timeout=15) as response:
            data = response.read(_MAX_DOWNLOAD_BYTES)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read that URL: {exc}")

    parser = _TextParser()
    parser.feed(data.decode("utf-8", errors="replace"))
    return "\n".join(parser.parts)


async def read_upload(upload: UploadFile) -> tuple[str, str]:
    """Return (text, source_type) for a PDF / TXT / Markdown upload."""
    content = await upload.read()
    filename = (upload.filename or "uploaded file").lower()
    suffix = filename.rsplit(".", 1)[-1] if "." in filename else ""

    if suffix == "pdf" or upload.content_type == "application/pdf":
        try:
            reader = PdfReader(BytesIO(content))
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Could not read that PDF: {exc}")
        return text, "pdf"

    if suffix in {"txt", "md", "markdown"} or (upload.content_type or "").startswith("text/"):
        return content.decode("utf-8", errors="replace"), "text"

    raise HTTPException(status_code=400, detail="Upload a PDF, TXT, or Markdown file.")
