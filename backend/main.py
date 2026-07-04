import base64
import binascii
import os
from typing import Tuple

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

# Load environment variables from .env
load_dotenv()

app = FastAPI(title="A-Level Maths Tutor Backend", version="0.1.0")

# Allow the frontend dev server to talk to the backend locally
cors_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ErrorRegion(BaseModel):
    bbox: list[float]
    line_index: int
    explanation: str


class CompletionStep(BaseModel):
    text: str
    bbox: list[float]
    font_size_px: int


class MarkingResult(BaseModel):
    detected_lines: list[str]
    errors: list[ErrorRegion]
    completions: list[CompletionStep]
    summary: str


class MarkRequest(BaseModel):
    session_id: str | None = None
    question_id: str | None = None
    question_text: str = Field(..., min_length=1)
    image_base64: str = Field(..., min_length=1)
    marks: int | None = None
    model: str = Field(default_factory=lambda: os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite"))


class HealthResponse(BaseModel):
    status: str


def _decode_image_payload(image_payload: str) -> Tuple[bytes, str]:
    """Accept either a raw base64 string or a data URL and return bytes plus MIME type."""
    if image_payload.startswith("data:"):
        header, encoded = image_payload.split(",", 1)
        if ";base64" not in header:
            raise ValueError("Only base64 data URLs are supported.")
        mime_type = header.split(":", 1)[1].split(";", 1)[0]
        if not mime_type.startswith("image/"):
            raise ValueError("The image payload must be an image MIME type.")
        payload = encoded
    else:
        mime_type = "image/png"
        payload = image_payload

    try:
        image_bytes = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("Invalid base64 image payload.") from exc

    return image_bytes, mime_type


def _get_gemini_client() -> genai.Client:
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError("Missing GEMINI_API_KEY or GOOGLE_API_KEY environment variable.")

    try:
        return genai.Client(api_key=api_key)
    except Exception as exc:  # pragma: no cover - defensive initialization guard
        raise RuntimeError(f"Failed to initialize Gemini client: {exc}") from exc


@app.post("/api/mark", response_model=MarkingResult)
async def mark_work(payload: MarkRequest) -> MarkingResult:
    """Send a student whiteboard image plus question context to Gemini for structured feedback."""
    if not payload.question_text.strip():
        raise HTTPException(status_code=400, detail="Question text cannot be empty.")

    try:
        image_bytes, mime_type = _decode_image_payload(payload.image_base64)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not image_bytes:
        raise HTTPException(status_code=400, detail="Image payload cannot be empty.")

    prompt = f"""
You are an A-level maths marking assistant. Review the handwritten student working shown in the image.

Question text:
{payload.question_text}

Marks available: {payload.marks if payload.marks is not None else 'unknown'}

Instructions:
1. Read the working line by line.
2. Compare it to the expected A-level method for the given question.
3. Return structured feedback in JSON only.
4. Use normalized bounding boxes in the range [0, 1] relative to the image.
5. For missing or incorrect steps, include short completion steps positioned below the last valid line.
6. Keep the summary concise and encouraging.
"""

    try:
        client = _get_gemini_client()
        response = client.models.generate_content(
            model=payload.model,
            contents=[
                types.Part.from_text(text=prompt),
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=MarkingResult,
            ),
        )

        response_text = getattr(response, "text", None)
        if not response_text:
            raise ValueError("Gemini returned an empty response.")

        return MarkingResult.model_validate_json(response_text)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Gemini API Error: {exc}") from exc


@app.get("/api/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    return HealthResponse(status="healthy")


@app.get("/health", response_model=HealthResponse)
def legacy_health_check() -> HealthResponse:
    return HealthResponse(status="healthy")