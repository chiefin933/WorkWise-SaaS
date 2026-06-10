import urllib.request
import urllib.parse
import json
import time

BASE_URL = "http://127.0.0.1:8000/api"

def request(method, path, data=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f"Bearer {token}"
    
    req_data = None
    if data:
        req_data = json.dumps(data).encode('utf-8')
        
    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            return response.status, json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        try:
            return e.code, json.loads(body)
        except json.JSONDecodeError:
            return e.code, body
    except Exception as e:
        return 500, str(e)

def run():
    timestamp = int(time.time())
    email = f"test_{timestamp}@company.com"
    
    print("1. Registering")
    status, res = request("POST", "/auth/register/", {
        "company_name": "Test Company",
        "email": email,
        "password": "Password123!",
        "first_name": "Test",
        "last_name": "User",
        "plan": "STARTER"
    })
    print(status, res)
    if status != 201: return
    
    print("2. Login")
    status, res = request("POST", "/auth/login/", {
        "email": email,
        "password": "Password123!"
    })
    print(status, res)
    if status != 200: return
    token = res.get('access')
    
    print("3. Create Employee")
    status, res = request("POST", "/employees/", {
        "name": "Jane Doe",
        "email": f"jane_{timestamp}@company.com",
        "phone": "123456789",
        "employment_type": "monthly",
        "salary_basic": "50000",
        "payment_method": "bank"
    }, token)
    print(status, res)
    if status != 201: return
    emp_id = res.get('id')
    
    print("4. Create Leave")
    status, res = request("POST", "/leave/", {
        "employee": emp_id,
        "leave_type": "annual",
        "start_date": "2026-06-01",
        "end_date": "2026-06-05"
    }, token)
    print(status, res)
    
    print("5. Create Attendance")
    status, res = request("POST", "/attendance/", {
        "employee": emp_id,
        "date": "2026-05-14",
        "clock_in": "08:00:00",
        "clock_out": "17:00:00"
    }, token)
    print(status, res)
    
    print("6. Create Payroll Run")
    status, res = request("POST", "/payroll/", {
        "month": 5,
        "year": 2026
    }, token)
    print(status, res)
    if status != 201: return
    pr_id = res.get('id')
    
    print("7. Process Payroll")
    status, res = request("POST", f"/payroll/{pr_id}/process/", token=token)
    print(status, res)

if __name__ == '__main__':
    run()
