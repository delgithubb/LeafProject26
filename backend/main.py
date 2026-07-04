import base64
import binascii
import os
from typing import Tuple

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from pydantic import BaseModel, Field, field_validator

# Load environment variables from .env
load_dotenv()

app = FastAPI(title="A-Level Maths Tutor Backend", version="0.1.0")


# Allow the frontend dev server to talk to the backend locally
cors_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"http://localhost(:\d+)?|http://127\.0\.0\.1(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ErrorRegion(BaseModel):
    bbox: list[float] = Field(
        ...,
        description="Normalized [x, y, width, height] for the error region relative to the image.",
    )
    image_relative_bbox: list[float] = Field(
        ...,
        description="Normalized [x, y, width, height] for the same error line region relative to the full image.",
    )
    line_index: int
    explanation: str

    @field_validator("bbox", "image_relative_bbox")
    @classmethod
    def validate_bbox(cls, value: list[float]) -> list[float]:
        if len(value) != 4:
            raise ValueError("bbox values must contain exactly four numbers: [x, y, width, height]")
        return value


class CompletionStep(BaseModel):
    text: str
    bbox: list[float] = Field(
        ...,
        description="Normalized [x, y, width, height] for the completion text box relative to the image.",
    )
    image_relative_bbox: list[float] = Field(
        ...,
        description="Normalized [x, y, width, height] for the completion text box relative to the full image.",
    )
    image_relative_line_position: list[float] = Field(
        ...,
        description="Normalized [x, y] coordinate for the line where this completion should appear relative to the image.",
    )
    font_size_px: int

    @field_validator("bbox", "image_relative_bbox")
    @classmethod
    def validate_completion_bbox(cls, value: list[float]) -> list[float]:
        if len(value) != 4:
            raise ValueError("completion bbox values must contain exactly four numbers: [x, y, width, height]")
        return value

    @field_validator("image_relative_line_position")
    @classmethod
    def validate_line_position(cls, value: list[float]) -> list[float]:
        if len(value) != 2:
            raise ValueError("completion line position must contain exactly two numbers: [x, y]")
        return value


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
    api_key = os.getenv("GEMINI_API_KEY")

    # --- DEBUG LOGS START ---
    print("\n=== DEBUG: GEMINI INITIALIZATION ===")
    print(f"Type of api_key variable: {type(api_key)}")
    if api_key:
        print(f"API Key Length: {len(api_key)} characters")
        print(f"API Key starts with: '{api_key[:7]}...'")
        print(f"API Key ends with: '...{api_key[-4:] if len(api_key) > 4 else ''}'")
    else:
        print("CRITICAL: GEMINI_API_KEY is completely empty or None!")
    print("====================================\n")
    # --- DEBUG LOGS END ---

    if not api_key:
        raise RuntimeError("Missing GEMINI_API_KEY environment variable.")

    try:
        # Explicitly pass the key argument
        return genai.Client(api_key=api_key)
    except Exception as exc:  # pragma: no cover
        raise RuntimeError(f"Failed to initialize Gemini client inside try-except: {exc}") from exc


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
2. Compare it to the expected method.
3. Return structured feedback in JSON only.
4. For each error region, provide a box that covers the full mistaken line or term.
5. Make each box slightly larger than the handwriting, with about 8-12% padding.
6. If the handwriting is small or unclear, prefer a slightly wider box over a very tight one.
7. Keep the box dimensions at least around 0.03 to 0.05 of the image when possible.
8. Just respond with one block of completion text with any extra working needed all together and its position a bit beneath the written working create a new line after every 25 characters.
9. However for each character in each line, create a bbox for each incorrect character and if there are multiple in the same line make them horizontally aligned.
10. Do not create boxes for error carried forward from previous lines, only for the first instance of the error.
11. Ensure all boxes belong to a line of working. If unsure, highlight the whole line
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