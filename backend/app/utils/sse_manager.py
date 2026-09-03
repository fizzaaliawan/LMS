import asyncio
import json
from typing import Dict, Set

class SSEManager:
    def __init__(self):
        self.listeners: Dict[str, Set[asyncio.Queue]] = {}

    def subscribe(self, email: str, queue: asyncio.Queue):
        if email not in self.listeners:
            self.listeners[email] = set()
        self.listeners[email].add(queue)

    def unsubscribe(self, email: str, queue: asyncio.Queue):
        if email in self.listeners:
            self.listeners[email].discard(queue)
            if not self.listeners[email]:
                del self.listeners[email]

    def broadcast(self, email: str, notification_data: dict):
        if email in self.listeners:
            for queue in self.listeners[email]:
                queue.put_nowait(notification_data)

sse_manager = SSEManager()
