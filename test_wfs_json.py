import urllib.request
import xml.etree.ElementTree as ET
import json

lat, lon = 42.3739, 14.1978
delta = 0.001
bbox = f"{lat - delta},{lon - delta},{lat + delta},{lon + delta},urn:ogc:def:crs:EPSG::6706"
url = f"https://wfs.cartografia.agenziaentrate.gov.it/inspire/wfs/owfs01.php?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=CP:CadastralParcel&BBOX={bbox}"

req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
res = urllib.request.urlopen(req, timeout=10).read()
root = ET.fromstring(res)

features = []
ns = {
    'wfs': 'http://www.opengis.net/wfs/2.0',
    'gml': 'http://www.opengis.net/gml/3.2',
    'CP': 'http://mapserver.gis.umn.edu/mapserver'
}

for member in root.findall('wfs:member', ns):
    parcel = list(member)[0]
    label = parcel.find('CP:LABEL', ns)
    ref = parcel.find('CP:NATIONALCADASTRALREFERENCE', ns)
    pos_list = parcel.find('.//gml:posList', ns)
    
    if pos_list is not None and pos_list.text:
        coords_raw = pos_list.text.strip().split()
        # posList has lat lon lat lon
        poly_coords = []
        for i in range(0, len(coords_raw), 2):
            p_lat = float(coords_raw[i])
            p_lon = float(coords_raw[i+1])
            poly_coords.append([p_lon, p_lat])
            
        features.append({
            'type': 'Feature',
            'properties': {
                'label': label.text if label is not None else '',
                'nationalRef': ref.text if ref is not None else ''
            },
            'geometry': {
                'type': 'Polygon',
                'coordinates': [poly_coords]
            }
        })

print(f"Found {len(features)} parcels! Labels: {[f['properties']['label'] for f in features]}")
