declare module "@mapbox/togeojson" {
  import { FeatureCollection } from "geojson";
  export function gpx(doc: Document): FeatureCollection;
  export function kml(doc: Document): FeatureCollection;
}

declare module "xmldom" {
  export class DOMParser {
    parseFromString(source: string, mimeType: string): Document;
  }
}
