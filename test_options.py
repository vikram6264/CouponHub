import http.client
conn = http.client.HTTPConnection('127.0.0.1',8001, timeout=5)
conn.request('OPTIONS','/api/users/login', headers={'Origin':'http://127.0.0.1:8001','Access-Control-Request-Method':'POST'})
resp = conn.getresponse()
print(resp.status, resp.reason)
print(resp.getheaders())
print(resp.read().decode())
