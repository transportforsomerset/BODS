import type { BusData, BusVehicle } from "./types";

const BODS_API_URL =
  "https://data.bus-data.dft.gov.uk/api/v1/datafeed";

const TEST_SERVICES = new Set([
  "21",
  "21A",
  "22",
  "22A",
  "X22",
  "28",
  "PR",
  "SF1",
]);

function getTagValue(xml: string, tag: string): string | null {
  const match = xml.match(
    new RegExp(`<${tag}>([^<]*)</${tag}>`)
  );

  return match?.[1] ?? null;
}

function cleanText(value: string): string {
  return value
    .replace(/\\_/g, " ")
    .replace(/_/g, " ")
    .trim();
}

export async function fetchBodsData(): Promise<BusData> {
  const apiKey = process.env.BODS_API_KEY;

  if (!apiKey) {
    throw new Error("BODS_API_KEY secret is not set.");
  }

  const boundingBox = "-3.15,50.98,-3.05,51.05";

  const url = new URL(BODS_API_URL);

  url.searchParams.set("boundingBox", boundingBox);
  url.searchParams.set("api_key", apiKey);

  console.log("Requesting BODS live vehicle data...");
  console.log(`Bounding box: ${boundingBox}`);

  const response = await fetch(url);

  console.log(
    `HTTP status: ${response.status} ${response.statusText}`
  );

  console.log(
    `Content-Type: ${
      response.headers.get("content-type") ?? "unknown"
    }`
  );

  const xml = await response.text();

  console.log(`Response size: ${xml.length} characters`);

  if (!response.ok) {
    console.error(xml.slice(0, 500));
    throw new Error(
      `BODS request failed: HTTP ${response.status}: ${response.statusText}`
    );
  }

  if (!xml.trim()) {
    throw new Error("BODS returned an empty response.");
  }

  console.log("BODS request succeeded.");

  const vehicleActivities =
    xml.match(
      /<VehicleActivity>[\s\S]*?<\/VehicleActivity>/g
    ) ?? [];

  console.log(
    `VehicleActivity records found: ${vehicleActivities.length}`
  );

  const vehicles: BusVehicle[] = [];

  for (const activity of vehicleActivities) {
    const line =
      getTagValue(activity, "LineRef") ??
      getTagValue(activity, "PublishedLineName");

    if (!line || !TEST_SERVICES.has(line)) {
      continue;
    }

    const vehicleId = getTagValue(activity, "VehicleRef");

    if (!vehicleId) {
      continue;
    }

    const locationMatch = activity.match(
      /<VehicleLocation>[\s\S]*?<Longitude>([^<]+)<\/Longitude>[\s\S]*?<Latitude>([^<]+)<\/Latitude>[\s\S]*?<\/VehicleLocation>/
    );

    if (!locationMatch) {
      continue;
    }

    const longitude = Number(locationMatch[1]);
    const latitude = Number(locationMatch[2]);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      continue;
    }

    const vehicle: BusVehicle = {
      vehicle_id: vehicleId,
      route: line,
      operator: cleanText(
        getTagValue(activity, "OperatorRef") ?? ""
      ),
      direction: cleanText(
        getTagValue(activity, "DirectionRef") ?? ""
      ),
      origin: cleanText(
        getTagValue(activity, "OriginName") ?? ""
      ),
      destination: cleanText(
        getTagValue(activity, "DestinationName") ?? ""
      ),
      latitude,
      longitude,
      bearing: Number(
        getTagValue(activity, "Bearing") ?? 0
      ),
      recorded_at:
        getTagValue(activity, "RecordedAtTime") ??
        new Date().toISOString(),
    };

    vehicles.push(vehicle);
  }

  console.log(`Matching vehicles: ${vehicles.length}`);

  return {
    generated_at: new Date().toISOString(),
    source: "BODS",
    data_age_seconds: 0,
    vehicle_count: vehicles.length,
    vehicles,
  };
}
