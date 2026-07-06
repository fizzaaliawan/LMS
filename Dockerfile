# syntax=docker/dockerfile:1

FROM python:3.12-slim AS base

# uv installs itself as a static binary - no pip involved anywhere in this build
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/app/.venv \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

# Install dependencies first (cache-friendly layer)
COPY pyproject.toml uv.lock* ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-dev || \
    uv sync --no-install-project --no-dev

# Copy source and install the project itself
COPY app ./app
COPY migrations ./migrations
COPY alembic.ini ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --no-dev

# Non-root user for runtime security
RUN groupadd -r library && useradd -r -g library library \
    && chown -R library:library /app
USER library

ENTRYPOINT ["library"]
CMD ["--help"]
