import json
import ssl
import uuid

import websockets
import asyncio

from .log import logger


class FashionAIClient:
    def __init__(self, uri, service_id):
        self.uri = uri
        self.websocket = None
        self.service_id = service_id
        self.cancelled = False

    async def connect(self):
        ssl_context = ssl._create_unverified_context()
        self.websocket = await websockets.connect(self.uri, ssl=ssl_context)
        asyncio.create_task(self.listen())  # Start listening immediately after connection

    async def listen(self):
        """Continuously listen for incoming messages."""
        if self.websocket is not None:
            try:
                async for message in self.websocket:
                    logger.info(f"FASHION_AI Received: {message}")
                    # await self.handle_message(message)
            except websockets.exceptions.ConnectionClosedError as e:
                logger.info(f"FASHION_AI Connection closed with error: {e}")
                await self.reconnect()

    async def stream_start(self, app_id, channel, stream_id):
        await self.send_message(
                {
                    "request_id": str(uuid.uuid4()),
                    "service_id": self.service_id,
                    "token": app_id,
                    "channel_id": channel,
                    "user_id": stream_id,
                    "signal": "STREAM_START",
                }
            )
        
    async def stream_stop(self):
        await self.send_message(
                {
                    "request_id": str(uuid.uuid4()),
                    "service_id": self.service_id,
                    "signal": "STREAM_STOP",
                }
            )

    async def render_start(self):
        await self.send_message(
            {
                "request_id": str(uuid.uuid4()),
                "service_id": self.service_id,
                "signal": "RENDER_START",
            }
        )
        self.cancelled = False

    async def send_inputText(self, inputText):
        if self.cancelled:
            await self.render_start()
        await self.send_message(
           {
                "request_id": str(uuid.uuid4()),
                "service_id": self.service_id,
                "signal": "RENDER_CONTENT",
                "text": inputText,
            }
        )

    async def send_interrupt(self):
        await self.send_message(
           {
                "service_id": self.service_id,
                "signal": "RENDER_CANCEL",
            }
        )
        self.cancelled = True


    async def send_message(self, message):
        if self.websocket is not None:
            try:
                await self.websocket.send(json.dumps(message))
                logger.info(f"FASHION_AI Sent: {message}")
                # response = await asyncio.wait_for(self.websocket.recv(), timeout=2)
                # logger.info(f"FASHION_AI Received: {response}")
            except websockets.exceptions.ConnectionClosedError as e:
                logger.info(f"FASHION_AI Connection closed with error: {e}")
                await self.reconnect()
            except asyncio.TimeoutError:
                logger.info("FASHION_AI Timeout waiting for response")
        else:
            logger.info("FASHION_AI WebSocket is not connected.")

    async def close(self):
        if self.websocket is not None:
            await self.websocket.close()
            logger.info("FASHION_AI WebSocket connection closed.")
        else:
            logger.info("FASHION_AI WebSocket is not connected.")

    async def reconnect(self):
        logger.info("FASHION_AI Reconnecting...")
        await self.close()
        await self.connect()

    async def heartbeat(self, interval):
        while True:
            await asyncio.sleep(interval)
            try:
                await self.send_inputText("ping")
            except websockets.exceptions.ConnectionClosedError:
                break