const xml2js = require('xml2js');
const fs = require('fs');
const xml = `<?xml version='1.0' encoding="UTF-8" ?>
<wfs:FeatureCollection
   xmlns:CP="http://mapserver.gis.umn.edu/mapserver"
   xmlns:gml="http://www.opengis.net/gml/3.2"
   xmlns:wfs="http://www.opengis.net/wfs/2.0">
    <wfs:member>
      <CP:CadastralParcel>
        <CP:msGeometry>
          <gml:Polygon>
            <gml:exterior>
              <gml:LinearRing>
                <gml:posList srsDimension="2">42.37 14.19 42.38 14.19</gml:posList>
              </gml:LinearRing>
            </gml:exterior>
          </gml:Polygon>
        </CP:msGeometry>
        <CP:INSPIREID_LOCALID>IT.AGE.PLA.C632_002200.10</CP:INSPIREID_LOCALID>
        <CP:LABEL>10</CP:LABEL>
        <CP:NATIONALCADASTRALREFERENCE>C632_002200.10</CP:NATIONALCADASTRALREFERENCE>
        <CP:ADMINISTRATIVEUNIT>C632</CP:ADMINISTRATIVEUNIT>
      </CP:CadastralParcel>
    </wfs:member>
</wfs:FeatureCollection>`;

const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true });
parser.parseString(xml, (err, result) => {
  if(err) console.error(err);
  console.log(JSON.stringify(result, null, 2));
});
