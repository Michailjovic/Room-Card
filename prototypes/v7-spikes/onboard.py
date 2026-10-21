import json,urllib.request as u
B='http://localhost:8123';CID=B+'/'
def post(path,data,tok=None,form=False):
    h={'Content-Type':'application/x-www-form-urlencoded' if form else 'application/json'}
    if tok:h['Authorization']='Bearer '+tok
    body=(data if form else json.dumps(data)).encode()
    return json.loads(u.urlopen(u.Request(B+path,body,h)).read())
r=post('/api/onboarding/users',{'client_id':CID,'name':'Admin','username':'admin','password':'admin12345','language':'en'})
t=post('/auth/token','grant_type=authorization_code&code=%s&client_id=%s'%(r['auth_code'],CID),form=True)
tok=t['access_token']
post('/api/onboarding/core_config',{},tok)
post('/api/onboarding/analytics',{},tok)
post('/api/onboarding/integration',{'client_id':CID,'redirect_uri':CID+'?auth_callback=1'},tok)
json.dump({'access_token':tok,'refresh_token':t['refresh_token'],'expires_in':t['expires_in']},open('tokens.json','w'))
print('ok',tok[:12])
