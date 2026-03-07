export async function GET() {
  return Response.json({
    mapboxToken: process.env.MAPBOX_TOKEN,
  });
}
