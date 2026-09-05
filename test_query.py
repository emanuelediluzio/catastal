import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET

# Test GetFeatureInfo around Chieti Foglio 21 P.lla 8
# Lat ~ 42.3739, Lon ~ 14.1978
# Let's test different bboxes and I, J
# In WMS 1.3.0 EPSG:6706: bbox is minLat, minLon, maxLat, maxLon
delta = 0.002
minLat = 42.3729
maxLat = 42.3749
minLon = 14.1968
maxLon = 14.1988

url = f"https://wms.cartografia.agenziaentrate.gov.it/inspire/wms/ows01.php?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&LAYERS=CP.CadastralParcel&QUERY_LAYERS=CP.CadastralParcel&CRS=EPSG:6706&BBOX={minLat},{minLon},{maxLat},{maxLon}&WIDTH=101&HEIGHT=101&I=50&J=50&INFO_FORMAT=application/vnd.ogc.gml"

req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as resp:
        content = resp.read().decode('utf-8', errors='ignore')
        print("Response length:", len(content))
        print("Response snippet:", content[:500])
except Exception as e:
    print("Error:", e)
