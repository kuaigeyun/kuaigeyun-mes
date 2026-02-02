
import urllib.request
import urllib.error
import urllib.parse
import json
import time
import sys

# Base API URL
BASE_URL = "http://localhost:8000/api/v1"

def wait_for_server(url, timeout=60):
    start_time = time.time()
    print(f"⏳ Waiting for server at {url}...")
    while time.time() - start_time < timeout:
        try:
            urllib.request.urlopen("http://localhost:8000/docs", timeout=2)
            print("✅ Server is up!")
            return True
        except:
            time.sleep(2)
            print(".", end="", flush=True)
    print("\n❌ Server wait timed out.")
    return False

def make_request(url, method="GET", headers=None, data=None):
    try:
        if data:
            data = json.dumps(data).encode('utf-8')
            if headers:
                headers['Content-Type'] = 'application/json'
        
        req = urllib.request.Request(url, method=method, headers=headers or {}, data=data)
        with urllib.request.urlopen(req) as response:
            return 200, json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8')
    except Exception as e:
        return -1, str(e)

def sync_manifest():
    if not wait_for_server(BASE_URL):
        return

    print("\n🚀 Starting auto-sync process...")
    
    # 1. Login as Guest
    print("🔑 Attempting Guest Login...")
    
    status, result = make_request(f"{BASE_URL}/auth/guest-login", method="POST")
    if status != 200:
        print(f"❌ Guest Login Failed: {status} {result}")
        return

    token = result["access_token"]
    tenant_id = str(result["user"]["tenant_id"])
    print(f"✅ Guest Login Successful. Token obtained. Tenant ID: {tenant_id}")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Tenant-ID": tenant_id
    }

    # 1.5 Scan for plugins (using correct prefix /core/applications)
    print("🔍 Scanning for plugins...")
    status, result = make_request(f"{BASE_URL}/core/applications/scan", method="POST", headers=headers)
    if status == 200:
        print(f"✅ Scan Complete. Found {len(result)} apps.")
    else:
        print(f"⚠️ Scan Failed (might be permission issue or URL wrong): {status}")
        try:
             print(result)
        except: pass
        # Continue anyway

    # 2. Sync Manifest (using correct prefix /core/applications)
    print("🔄 Syncing 'kuaizhizao' manifest...")
    status, result = make_request(
        f"{BASE_URL}/core/applications/sync-manifest/kuaizhizao", 
        method="POST", 
        headers=headers
    )

    if status == 200:
         print("✅ Manifest Sync Successful!")
         print(result)
    else:
         print(f"❌ Manifest Sync Failed: {status}")
         print(result)

if __name__ == "__main__":
    sync_manifest()
