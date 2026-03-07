import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { DOMParser } from "xmldom";
import toGeoJSON from "@mapbox/togeojson";

export async function GET() {
  const racesDir = path.join(process.cwd(), "public", "races");

  if (!fs.existsSync(racesDir)) {
    return NextResponse.json([]);
  }

  const gpxFiles = fs
    .readdirSync(racesDir)
    .filter((f) => f.endsWith(".gpx"));

  const collections = gpxFiles.map((file) => {
    const xml = fs.readFileSync(path.join(racesDir, file), "utf-8");
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    return toGeoJSON.gpx(doc);
  });

  return NextResponse.json(collections);
}
