import requests
from lxml import html
from lxml import etree
import re
import os
import json
import base64
parser=etree.HTMLParser(recover=True)
ret=r"([1-5]A|Etudiants|Esisar)"
ret2=r"([1-5]A)"
START_YEAR=2022
session=requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:95.0) Gecko/20100101 Firefox/95.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'fr,fr-FR;q=0.8,en-US;q=0.5,en;q=0.3',
    'Accept-Encoding': 'deflate',
    'Referer': 'https://edt.grenoble-inp.fr/2022-2023/esisar/etudiant/jsp/standard/gui/tree.jsp?forceLoad=false&isDirect=true',
    "Authorization":"Basic %s"%base64.b64encode((os.getenv('EDT_USER')+":"+os.getenv('EDT_PASSWORD')).encode()).decode()
})
CODES=[]
def get(code):
    if code in CODES:return
    CODES.append(code)
    page = session.get(f'https://edt.grenoble-inp.fr/{START_YEAR}-{START_YEAR+1}/esisar/etudiant/jsp/standard/gui/tree.jsp?branchId=%s&expand=false&forceLoad=false&reload=false&scroll=0'%code)
    tree = etree.fromstring(page.content,parser=parser)
    for elem in tree.cssselect('span.treebranch a'):
        if re.match(ret,elem.text):
            parent=elem.getparent().getparent()
            if len(parent.cssselect('a img'))==0:
                continue
            print(">>",elem.text)
            code=elem.get("href").split('checkBranch(')[1].split(',')[0]
            get(code)

response = session.get(f'https://edt.grenoble-inp.fr/{START_YEAR}-{START_YEAR+1}/esisar/etudiant')
page = session.get(f'https://edt.grenoble-inp.fr/{START_YEAR}-{START_YEAR+1}/esisar/etudiant/jsp/standard/gui/tree.jsp?category=trainee&expand=true&forceLoad=false&reload=false&scroll=0')
tree = etree.fromstring(page.content,parser=parser)
for elem in tree.cssselect('span.treebranch a'):
    print(elem.text)
    if re.match(ret,elem.text):
        print(">>",elem.text)
        code=elem.get("href").split('checkBranch(')[1].split(',')[0]
        get(code)


get("trainee")
page = session.get(f'https://edt.grenoble-inp.fr/{START_YEAR}-{START_YEAR+1}/esisar/etudiant/jsp/standard/gui/tree.jsp')
tree = etree.fromstring(page.content,parser=parser)
classes=[]
for elem in tree.cssselect('div.treeline span a'):
    if elem.text and re.match(ret2,elem.text):
        classes.append({
            "code":elem.get("href").split('(')[1].split(',')[0],
            "classe":elem.text
        })

with open('classes.json','w') as f:
    json.dump(classes,f,indent=4)