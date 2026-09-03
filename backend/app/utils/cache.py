import json
import os
import redis
from app.config.config import settings

# In-memory fallback dictionary for local runs/testing without Redis
_fallback_cache: dict[str, str] = {}
_use_redis = False

try:
    _client = redis.Redis.from_url(
        settings.REDIS_URL,
        decode_responses=True,
        socket_connect_timeout=0.1,
        socket_timeout=0.1
    )
    # Ping to check if server is actually listening
    _client.ping()
    _use_redis = True
except Exception:
    _client = None
    _use_redis = False

def get_cached_search(query: str):
    if _use_redis and _client is not None:
        try:
            raw = _client.get(f"search:{query.lower()}")
            return json.loads(raw) if raw else None
        except Exception:
            pass
    raw = _fallback_cache.get(query.lower())
    return json.loads(raw) if raw else None

def set_cached_search(query: str, results: list[dict]) -> None:
    if _use_redis and _client is not None:
        try:
            _client.setex(f"search:{query.lower()}", settings.SEARCH_CACHE_TTL_SECONDS, json.dumps(results))
            return
        except Exception:
            pass
    _fallback_cache[query.lower()] = json.dumps(results)

def invalidate_search_cache() -> None:
    """Clear all book search cache entries."""
    if _use_redis and _client is not None:
        try:
            keys = list(_client.scan_iter("search:*"))
            for key in keys:
                _client.delete(key)
            return
        except Exception:
            pass
    _fallback_cache.clear()
