const BODS_API_URL =
  "https://data.bus-data.dft.gov.uk/api/v1/datafeed/";

/*
 * Services we're currently interested in testing.
 *
 * 21 / 21A - local services
 * 22 / 22A - local services
 * 28       - local service
 * PR       - Taunton Park & Ride
 * SF1      - Berry's coach service to London
 */
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
  const accessCode = process.env.BODS_API_KEY;

  if (!accessCode) {
    throw new Error("BODS_ACCESS_CODE secret is not set.");
  }

  console.log("Requesting BODS live vehicle data...");

  const url = new URL(BODS_API_URL);

  url.searchParams.set("api", accessCode);

  // Current test area around Taunton.
  url.searchParams.set(
    "boundingBox",
    "-3.15,50.98,-3.05,51.05"
  );

  const response = await fetch(url);

  console.log(`HTTP status: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    throw new Error(
      `BODS request failed: HTTP ${response.status}: ${response.statusText}`
    );
  }

  const xml = await response.text();

  console.log(`Response size: ${xml.length} characters`);

  /*
   * We deliberately don't parse the XML with regular expressions.
   *
   * This first version simply proves that the live request and
   * service filtering are working. We'll replace this section with
   * a proper XML parser next.
   */

  const vehicleActivities =
    xml.match(/<VehicleActivity>[\s\S]*?<\/VehicleActivity>/g) ?? [];

  console.log(`VehicleActivity records found: ${vehicleActivities.length}`);

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

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
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
      bearing: Number(getTagValue(activity, "Bearing") ?? 0),
      recorded_at:
        getTagValue(activity, "RecordedAtTime") ??
        new Date().toISOString(),
    };

    vehicles.push(vehicle);
  }

  console.log(`Matching vehicles: ${vehicles.length}`);

  for (const vehicle of vehicles) {
    console.log(
      `${vehicle.route}: ${vehicle.vehicle_id} → ${vehicle.destination} ` +
      `(${vehicle.latitude}, ${vehicle.longitude})`
    );
  }

  console.log("BODS live data processing complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
