import requests
import libxml2
import uuid
import json
import cherrypy
import geoweb
import urlparse
import requests
from myproxy.client import MyProxyClient
#from esgf.download import download
import esgf.download


def extract_variables(doc_node):
  text_nodes = doc_node.xpathEval('./arr[@name="variable"]/str/text()')

  return map(lambda x: x.get_content(), text_nodes)

def _extract_url(doc_node):
  return doc_node.xpathEval('./arr[@name="url"][1]/str/text()')[0].get_content()

streams = dict()


#print (query("http://pcmdi9.llnl.gov", "cloud")).next()

#def aquire_certificate(user, password):
#    myproxy = MyProxyClient(hostname='pcmdi9.llnl.gov')
#    credentials = myproxy.logon(user, password, bootstrap=True)
#
#    with open('/tmp/%s.esgf' % (user), 'w') as fd:
#        fd.write(credentials[0])
#        fd.write(credentials[1])
#
#download_status_map = {}
#
#def download_status(url, user):
#    url = 'http://esgdata1.nccs.nasa.gov/thredds/fileServer/obs4MIPs/NASA-GSFC/TRMM/observations/atmos/pr/mon/grid/NASA-GSFC/TRMM/pr_TRMM-L3_v7A_200001-200912.nc'
#    cherrypy.log(str(download_status_map))
#    key = user + url
#    if key in download_status_map:
#        return download_status_map[user+url]
#
#def download(url, user, password):

    #    aquire_certificate(user, password)
#
#    cert_path = '/tmp/%s.esgf' % (user)
#
#    request = requests.get(url,
#                           cert=(cert_path, cert_path), verify=False, stream=True)
#
#    cherrypy.log(str(request))
#
#    url = 'http://esgdata1.nccs.nasa.gov/thredds/fileServer/obs4MIPs/NASA-GSFC/TRMM/observations/atmos/pr/mon/grid/NASA-GSFC/TRMM/pr_TRMM-L3_v7A_200001-200912.nc'
#
#    status_key = user + url;
#    content_length = 1 #= request.headers['content-length']
#    downloaded  = 0
#    for block in request.iter_content(1024):
#        if not block:
#            break
#        downloaded += 1024
#        cherrypy.log(str(downloaded))
#        download_status_map[status_key] = downloaded / content_length

def read(url, user, password):
    # Have we already downloaded this file?
    download(url, user, password)


  #for var in node.xpathEval('./arr[@name="variable"]/str/text()'):
  #  print var.get_content()





