import urllib.request
import xml.etree.ElementTree as ET

lat, lon, delta = 42.3739, 14.1978, 0.0015
bbox = f"{lat - delta},{lon - delta},{lat + delta},{lon + delta},urn:ogc:def:crs:EPSG::6706"
url = f"https://wfs.cartografia.agenziaentrate.gov.it/inspire/wfs/owfs01.php?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=CP:CadastralParcel&BBOX={bbox}"

req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
res = urllib.request.urlopen(req, timeout=10).read()
root = ET.fromstring(res)
print("Tags in root:")
for m in root.findall('{http://www.opengis.net/wfs/2.0}member'):
    parcel = list(m)[0]
    print(parcel.tag)
    for c in parcel:
        print("  ", c.tag)
    break
