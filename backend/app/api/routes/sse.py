import asyncio
import json
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from app.api.auth import get_current_user
from app.models.user import User
from app.utils.sse_manager import sse_manager

router = APIRouter(prefix="/sse", tags=["sse"])

@router.get("")
async def sse_notifications(current_user: User = Depends(get_current_user)):
    """SSE endpoint to stream real-time library notifications to the logged in user."""
    
    async def event_generator():
        queue = asyncio.Queue()
        sse_manager.subscribe(current_user.email, queue)
        
        # Send initial connection confirmation
        yield "data: " + json.dumps({"type": "connection", "message": "SSE connected"}) + "\n\n"
        
        try:
            while True:
                # Retrieve notification items from queue or keep connection alive with a ping
                try:
                    notification = await asyncio.wait_for(queue.get(), timeout=20.0)
                    yield f"data: {json.dumps(notification)}\n\n"
                except asyncio.TimeoutError:
                    # Send ping to prevent connection timeout
                    yield "data: " + json.dumps({"type": "ping"}) + "\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            sse_manager.unsubscribe(current_user.email, queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
