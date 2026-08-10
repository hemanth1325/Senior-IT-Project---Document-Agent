import os
from typing import AsyncIterator

import httpx

from fastapi import FastAPI
from fastapi import HTTPException
from fastapi import Request

from fastapi.responses import StreamingResponse

from pydantic import BaseModel
from pydantic import Field

from starlette.background import BackgroundTask


app = FastAPI(
    title="MDH Chat Gateway",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


def required_env(name: str) -> str:

    value = os.getenv(name, "").strip()

    if not value:

        raise RuntimeError(
            f"Missing required environment variable: {name}"
        )

    return value


BOOKSTACK_SESSION_INFO_URL = required_env(
    "BOOKSTACK_SESSION_INFO_URL"
)

BOOKSTACK_PUBLIC_ORIGIN = required_env(
    "BOOKSTACK_PUBLIC_ORIGIN"
).rstrip("/")

BOOKSTACK_SESSION_COOKIE = os.getenv(
    "BOOKSTACK_SESSION_COOKIE",
    "bookstack_session"
).strip()


LANGFLOW_INTERNAL_URL = required_env(
    "LANGFLOW_INTERNAL_URL"
).rstrip("/")

LANGFLOW_FLOW_ID = required_env(
    "LANGFLOW_FLOW_ID"
)

LANGFLOW_API_KEY = required_env(
    "LANGFLOW_API_KEY"
)

LANGFLOW_CUSTOM_COMPONENT_ID = os.getenv(
    "LANGFLOW_CUSTOM_COMPONENT_ID",
    "CustomComponent-otOXa"
).strip()


class ChatRequest(BaseModel):

    message: str = Field(
        min_length=1,
        max_length=10000
    )


def unauthorized(
    message: str = "BookStack authentication required"
) -> HTTPException:

    return HTTPException(
        status_code=401,
        detail=message
    )


async def get_authenticated_bookstack_user(
    request: Request
) -> dict:

    # -----------------------------------------------
    # Get ONLY BookStack's session cookie
    # -----------------------------------------------

    session_cookie = request.cookies.get(
        BOOKSTACK_SESSION_COOKIE
    )

    if not session_cookie:

        raise unauthorized()


    # -----------------------------------------------
    # Ask BookStack who this session belongs to
    # -----------------------------------------------

    try:

        async with httpx.AsyncClient(
            timeout=httpx.Timeout(10.0),
            follow_redirects=False
        ) as client:

            response = await client.get(

                BOOKSTACK_SESSION_INFO_URL,

                headers={
                    "Accept": "application/json"
                },

                cookies={
                    BOOKSTACK_SESSION_COOKIE:
                        session_cookie
                }
            )

    except httpx.HTTPError as exc:

        raise HTTPException(
            status_code=502,
            detail=
                "Could not validate the BookStack session."
        ) from exc


    # Login redirect means authentication failed

    if response.status_code in {
        301,
        302,
        303,
        307,
        308
    }:

        raise unauthorized(
            "BookStack session is not authenticated"
        )


    if response.status_code != 200:

        raise unauthorized(
            "BookStack session is invalid or expired"
        )


    try:

        user = response.json()

    except ValueError as exc:

        raise HTTPException(
            status_code=502,
            detail=
                "BookStack session endpoint returned invalid JSON."
        ) from exc


    # -----------------------------------------------
    # REAL AUTHENTICATION CHECK
    # -----------------------------------------------

    if user.get("authenticated") is not True:

        raise unauthorized(
            "BookStack session is not authenticated"
        )


    user_id = user.get(
        "bookstack_user_id"
    )


    if user_id is None:

        raise unauthorized(
            "Authenticated BookStack user ID is missing"
        )


    return {

        "id": str(user_id),

        "name": str(
            user.get("bookstack_user_name")
            or
            "BookStack User"
        )
    }


@app.get("/health")
async def health():

    return {
        "status": "ok"
    }


@app.post("/mdh/chat")
async def chat(
    payload: ChatRequest,
    request: Request
):

    # =================================================
    # 1. Prevent requests from other websites
    # =================================================

    origin = request.headers.get(
        "origin",
        ""
    ).rstrip("/")


    if origin != BOOKSTACK_PUBLIC_ORIGIN:

        raise HTTPException(
            status_code=403,
            detail="Invalid request origin"
        )


    if request.headers.get(
        "x-mdh-chat-request"
    ) != "1":

        raise HTTPException(
            status_code=403,
            detail="Invalid chat request"
        )


    # =================================================
    # 2. Verify BookStack user
    # =================================================

    user = await get_authenticated_bookstack_user(
        request
    )


    # =================================================
    # 3. Generate identity SERVER SIDE
    # =================================================

    langflow_session_id = (
        f"mdh-bookstack-user-{user['id']}"
    )

    litellm_user_id = (
        f"bookstack-user-{user['id']}"
    )


    # =================================================
    # 4. Build Langflow request
    # =================================================

    langflow_payload = {

        "input_type":
            "chat",

        "input_value":
            payload.message,

        "output_type":
            "chat",

        "session_id":
            langflow_session_id,

        "tweaks": {

            LANGFLOW_CUSTOM_COMPONENT_ID: {

                "bookstack_user_id":
                    user["id"],

                "bookstack_user_name":
                    user["name"],

                "litellm_user":
                    litellm_user_id,

                "langflow_session_id":
                    langflow_session_id
            }
        },

        "stream":
            True
    }


    langflow_url = (

        f"{LANGFLOW_INTERNAL_URL}"
        f"/api/v1/run/"
        f"{LANGFLOW_FLOW_ID}"
        f"?stream=true"

    )


    # =================================================
    # 5. Call Langflow SERVER-TO-SERVER
    # =================================================

    client = httpx.AsyncClient(
        timeout=None
    )


    upstream_request = client.build_request(

        "POST",

        langflow_url,

        headers={

            "Content-Type":
                "application/json",

            "Accept":
                "text/event-stream",

            "x-api-key":
                LANGFLOW_API_KEY
        },

        json=
            langflow_payload
    )


    try:

        upstream = await client.send(
            upstream_request,
            stream=True
        )

    except httpx.HTTPError as exc:

        await client.aclose()

        raise HTTPException(
            status_code=502,
            detail=
                "Could not connect to Langflow."
        ) from exc


    # =================================================
    # 6. Langflow error
    # =================================================

    if upstream.status_code >= 400:

        body = await upstream.aread()

        await upstream.aclose()
        await client.aclose()

        detail = body.decode(
            "utf-8",
            errors="replace"
        )[:2000]

        raise HTTPException(

            status_code=502,

            detail=(
                "Langflow request failed "
                f"({upstream.status_code}): "
                f"{detail}"
            )
        )


    # =================================================
    # 7. Stream Langflow response back to browser
    # =================================================

    async def stream_body() -> AsyncIterator[bytes]:

        async for chunk in upstream.aiter_raw():

            yield chunk


    async def cleanup():

        await upstream.aclose()
        await client.aclose()


    content_type = upstream.headers.get(
        "content-type",
        "text/event-stream"
    )


    return StreamingResponse(

        stream_body(),

        media_type=
            content_type,

        headers={

            "Cache-Control":
                "no-cache, no-store",

            "X-Accel-Buffering":
                "no"
        },

        background=
            BackgroundTask(cleanup)
    )