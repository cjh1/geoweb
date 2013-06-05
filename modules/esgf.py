import requests
import libxml2
import uuid
import json
import cherrypy
import geoweb
import urlparse

def extract_variables(doc_node):
  text_nodes = doc_node.xpathEval('./arr[@name="variable"]/str/text()')

  return map(lambda x: x.get_content(), text_nodes)

def _extract_url(doc_node):
  return doc_node.xpathEval('./arr[@name="url"][1]/str/text()')[0].get_content()

streams = dict()

def query(site_url, query):
  r = requests.get("%s/esg-search/search?query=%s" % ( site_url, query))
  xml = r.text

  files = []

  doc = libxml2.parseDoc(r.text)
  for node in doc.xpathEval('/response/result/doc'):
    #print node
    url = _extract_url(node);
    parts = urlparse.urlparse(url)
    server_url = "%s://%s" % (parts.scheme, parts.netloc) 

    r = requests.get(url)

    if r.status_code != 200:
      print "error getting catalogue"
      return

    #print r.text
    context = libxml2.parseDoc(r.text).xpathNewContext()
    context.xpathRegisterNs("ns","http://www.unidata.ucar.edu/namespaces/thredds/InvCatalog/v1.0")

    # Need to get the HTTPServer service so know the base URL
    base = context.xpathEval('//ns:service[@serviceType="HTTPServer"]/@base')[0].get_content()

    for node in context.xpathEval('//ns:dataset/ns:access[@urlPath]/..'):
      try:
          url = node.xpathEval('./@urlPath')[0].get_content() # can probably use string function here
          name = node.xpathEval('./@name')[0].get_content()
          id = node.xpathEval('./@ID')[0].get_content()
          context.setContextNode(node)
          variables = map(lambda x : {'name': x.get_content()}, context.xpathEval('./ns:variables/ns:variable/@name'))


          file = dict()
          file['url'] = "%s%s%s" % (server_url, base, url)
          file['name'] = name
          file['id'] = id
          file['variables'] = variables

          files.append(file)

          yield file
      except IndexError:
          pass

#print (query("http://pcmdi9.llnl.gov", "cloud")).next()

def download(url):
    cherrypy.log(url)
    r = requests.get(url, stream=True, 
                 auth=('https://pcmdi9.llnl.gov/esgf-idp/openid/cjh1', 'J!fL7{0<'))

    cherrypy.log("status: " + str(r.status_code))
    

def read(url):
    # Have we already downloaded this file?
    download(url)
    
def run(method, url=None, expr=None, vars=None, streamId=None, cancel=False):
    response = geoweb.empty_response();

    cherrypy.log("method: %s" % (method))

    if method == 'query':
        streamId = str(uuid.uuid1())
        cherrypy.log("id: %s" % (streamId))
        streams[streamId] = query("http://pcmdi9.llnl.gov", expr)
        response['result'] = {'hasNext': True, 'streamId': streamId }
    elif method == 'stream':
        if cancel:
            if streamId in streams:
                del streams[streamId]
            response['result'] = {'hasNext': False}
        try:
            if streamId in streams:
                response['result'] = {'hasNext': True,
                                      'streamId': streamId,
                                      'data': [streams[streamId].next()] };
            else:
                response['result'] = {'hasNext': False}
        except StopIteration:
            response['result'] = {'hasNext': False}
    elif method == 'read':
        url = url.strip('"')
        read(url);
    else:
        raise RuntimeError("illegal method '%s' in module 'esgf'" % (method))

    cherrypy.log("response: %s" % (str(response)))

    return json.dumps(response)

  #for var in node.xpathEval('./arr[@name="variable"]/str/text()'):
  #  print var.get_content()





