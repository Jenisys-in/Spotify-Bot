import httpx
import traceback

async def get_public_ip_info(proxy_url=None):
    try:
        transport = httpx.AsyncHTTPTransport(proxy=httpx.Proxy(proxy_url)) if proxy_url else None

        async with httpx.AsyncClient(transport=transport, timeout=10.0) as client:
            resp = await client.get("https://ipinfo.io/json")
            data = resp.json()
            return {
                "ip": data.get("ip"),
                "country": data.get("country")
            }
    except Exception as e:
        traceback.print_exc()
        print(f"[WARN] Failed to get IP info: {e}")
        return {"ip": "Unknown", "country": "Unknown"}
