import asyncio
import httpx

async def test_inngest_connection():
    url = "http://127.0.0.1:8288/"
    # Disable proxies
    mounts = {
        "all://": None
    }
    try:
        async with httpx.AsyncClient(mounts=mounts) as client:
            response = await client.get(url)
            print(f"Status Code: {response.status_code}")
            print(f"Response Content: {response.text[:200]}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_inngest_connection())
