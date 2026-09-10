"""Clerk session-token verification, exposed as a FastAPI dependency."""

from clerk_backend_api import Clerk
from fastapi import HTTPException, Request

from .config import ALLOWED_ORIGINS, CLERK_JWT_KEY, CLERK_SECRET_KEY

# The SDK moved this class between releases. Try both known locations.
try:
    from clerk_backend_api.security.types import AuthenticateRequestOptions
except ModuleNotFoundError:  # pragma: no cover
    from clerk_backend_api.jwks_helpers import AuthenticateRequestOptions

clerk = Clerk(bearer_auth=CLERK_SECRET_KEY)


def _build_options() -> AuthenticateRequestOptions:
    """Pass jwt_key only when we have one.

    With it, verification is a local signature check. Without it the SDK
    fetches Clerk's JWKS over the network - slower, but still correct.
    """
    kwargs = {"authorized_parties": ALLOWED_ORIGINS}
    if CLERK_JWT_KEY:
        kwargs["jwt_key"] = CLERK_JWT_KEY
    try:
        return AuthenticateRequestOptions(**kwargs)
    except TypeError:  # pragma: no cover - very old SDKs
        return AuthenticateRequestOptions(authorized_parties=ALLOWED_ORIGINS)


def get_current_user(request: Request) -> str:
    """Verify the Clerk token and return the Clerk user id (the `sub` claim)."""
    try:
        state = clerk.authenticate_request(request, _build_options())
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Auth service error: {exc}")

    if not state.is_signed_in:
        raise HTTPException(status_code=401, detail=str(state.reason))

    user_id = (state.payload or {}).get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token has no subject claim.")
    return user_id
