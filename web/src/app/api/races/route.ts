import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { DOMParser } from "xmldom";
import toGeoJSON from "@mapbox/togeojson";

export async function GET(request: NextRequest) {
  const racesDir = path.join(process.cwd(), "public", "races");

  if (!fs.existsSync(racesDir)) {
    return NextResponse.json([]);
  }

  const raceIdFilter = request.nextUrl.searchParams.get("id");

  const gpxFiles = fs
    .readdirSync(racesDir)
    .filter((f) => f.endsWith(".gpx"));

  const races = gpxFiles.map((file) => {
    const id = file.replace(".gpx", "");
    const xml = fs.readFileSync(path.join(racesDir, file), "utf-8");
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    const geojson = toGeoJSON.gpx(doc);
    const nameEl = doc.getElementsByTagName("name")[0];
    const name = nameEl?.textContent || id;
    return { id, name, geojson };
  });

  const filtered = raceIdFilter
    ? races.filter((r) => r.id === raceIdFilter)
    : races;

  return NextResponse.json(filtered);
}
