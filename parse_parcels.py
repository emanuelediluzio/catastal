import sys
import json
import urllib.request
import xml.etree.ElementTree as ET

def get_parcels(lat, lon, delta=0.0015):
    lat = float(lat)
    lon = float(lon)
    delta = float(delta)
    bbox = f"{lat - delta},{lon - delta},{lat + delta},{lon + delta},urn:ogc:def:crs:EPSG::6706"
    url = f"https://wfs.cartografia.agenziaentrate.gov.it/inspire/wfs/owfs01.php?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=CP:CadastralParcel&BBOX={bbox}"
    
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            xml_data = response.read()
    except Exception as e:
        return {"error": str(e), "features": []}

    try:
        root = ET.fromstring(xml_data)
    except Exception as e:
        return {"error": "XML Parse error", "features": []}

    features = []
    ns = {
        'wfs': 'http://www.opengis.net/wfs/2.0',
        'gml': 'http://www.opengis.net/gml/3.2',
        'CP': 'http://mapserver.gis.umn.edu/mapserver'
    }

    for member in root.findall('wfs:member', ns):
        parcel = list(member)[0] if len(member) > 0 else None
        if parcel is None:
            continue

        label_el = parcel.find('CP:LABEL', ns)
        ref_el = parcel.find('CP:NATIONALCADASTRALREFERENCE', ns)
        admin_el = parcel.find('CP:ADMINISTRATIVEUNIT', ns)
        inspire_el = parcel.find('CP:INSPIREID_LOCALID', ns)

        label = label_el.text if label_el is not None else ""
        ref = ref_el.text if ref_el is not None else ""
        admin = admin_el.text if admin_el is not None else ""
        inspire = inspire_el.text if inspire_el is not None else ""

        pos_lists = parcel.findall('.//gml:posList', ns)
        for pl in pos_lists:
            if not pl.text:
                continue
            raw_pts = pl.text.strip().split()
            coords = []
            for i in range(0, len(raw_pts), 2):
                p_lat = float(raw_pts[i])
                p_lon = float(raw_pts[i+1])
                coords.append([p_lon, p_lat]) # GeoJSON: lon, lat

            if len(coords) >= 3:
                features.append({
                    "type": "Feature",
                    "properties": {
                        "label": label,
                        "nationalRef": ref,
                        "adminUnit": admin,
                        "inspireId": inspire
                    },
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [coords]
                    }
                })

    return {
        "type": "FeatureCollection",
        "features": features
    }

if __name__ == "__main__":
    lat = sys.argv[1] if len(sys.argv) > 1 else "42.3739"
    lon = sys.argv[2] if len(sys.argv) > 2 else "14.1978"
    delta = sys.argv[3] if len(sys.argv) > 3 else "0.0015"
    result = get_parcels(lat, lon, delta)
    print(json.dumps(result))
