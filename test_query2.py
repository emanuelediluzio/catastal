import urllib.request

# Try EPSG:4258 or EPSG:25833
# EPSG:25833 in Chieti: Easting ~ 433800, Northing ~ 4691600
# Or EPSG:6706 with text/plain, text/html
for fmt in ['text/plain', 'text/html', 'application/vnd.ogc.gml']:
    for lyr in ['CP.CadastralParcel', 'CP.CadastralZoning']:
        url = f"https://wms.cartografia.agenziaentrate.gov.it/inspire/wms/ows01.php?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&LAYERS={lyr}&QUERY_LAYERS={lyr}&CRS=EPSG:6706&BBOX=42.370,14.195,42.378,14.205&WIDTH=400&HEIGHT=400&I=200&J=200&INFO_FORMAT={fmt}"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        try:
            with urllib.request.urlopen(req) as resp:
                res = resp.read().decode('utf-8', errors='ignore')
                print(f"{lyr} {fmt} -> len {len(res.strip())}")
                if len(res.strip()) > 250:
                    print(res[:300])
        except Exception as e:
            print(f"err: {e}")
