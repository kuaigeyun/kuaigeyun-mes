import httpx
import json
import asyncio

async def list_functions():
    url = "http://127.0.0.1:8200/api/inngest"
    # Disable proxies
    mounts = {
        "all://": None
    }
    try:
        async with httpx.AsyncClient(mounts=mounts) as client:
            response = await client.get(url)
            print(f"Status Code: {response.status_code}")
            # print(f"Raw Response: {response.text[:500]}")
            if response.status_code == 200:
                data = response.json()
                print(f"Function Count: {data.get('function_count')}")
                for fn in data.get('functions', []):
                    print(f"- {fn.get('id')}")
            else:
                print(f"Error Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(list_functions())
