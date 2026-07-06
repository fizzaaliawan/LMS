import json
import os

import redis

REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")
SEARCH_CACHE_TTL = int(os.environ.get("SEARCH_CACHE_TTL_SECONDS", "60"))

_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)


def get_cached_search(query: str):
    raw = _client.get(f"search:{query.lower()}")
    return json.loads(raw) if raw else None


def set_cached_search(query: str, results: list[dict]) -> None:
    _client.setex(f"search:{query.lower()}", SEARCH_CACHE_TTL, json.dumps(results))


def invalidate_search_cache() -> None:
    """Call this whenever books are added/removed so search results stay fresh."""
    for key in _client.scan_iter("search:*"):
        _client.delete(key)
