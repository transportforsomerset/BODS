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
  "SF2",
  "SF3"
]);

interface BusVehicle {
  vehicle_id: string;
  route: string;
  operator: string;
  direction: string;
  origin: string;
  destination: string;
  latitude: number;
  longitude: number;
  bearing: number;
  recorded_at: string;
}

function getTagValue(xml: string, tag: string): string | null {
  const match = xml.match(
    new RegExp(`<${tag}>([^<]*)</${tag}>`)
  );

  return match?.[1] ?? null;
}

async function main() {
  const apiKey = process.env.BODS_API_KEY;

  if (!apiKey) {
    throw new Error("BODS_API_KEY secret is not set.");
  }

  // Small test area around Taunton.
  // Format:
  // minLongitude,minLatitude,maxLongitude,maxLatitude
  const boundingBox = "-3.15,50.98,-3.05,51.05";

  const url = new URL(BODS_API_URL);

  // These are the same parameters used by our
  // known-working test-bods.ts script.
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
    console.error("BODS request failed.");
    console.error(`HTTP ${response.status}: ${response.statusText}`);
    console.error(xml.slice(0, 500));
    process.exit(1);
  }

  if (!xml.trim()) {
    console.error("BODS returned an empty response.");
    process.exit(1);
  }

  console.log("BODS request succeeded.");

  /*
   * Temporarily identify VehicleActivity records.
   *
   * We will replace the XML extraction below with a proper
   * XML parser once we've confirmed the live data is being
   * retrieved successfully.
   */
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
      operator: getTagValue(activity, "OperatorRef") ?? "",
      direction: getTagValue(activity, "DirectionRef") ?? "",
      origin: getTagValue(activity, "OriginName") ?? "",
      destination: getTagValue(activity, "DestinationName") ?? "",
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

  for (const vehicle of vehicles) {
    console.log(
      `${vehicle.route}: ${vehicle.vehicle_id} → ` +
      `${vehicle.destination} ` +
      `(${vehicle.latitude}, ${vehicle.longitude})`
    );
  }

  console.log("BODS live data processing complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
