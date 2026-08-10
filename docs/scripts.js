  const map = L.map("map");

  L.tileLayer(
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
    }
  ).addTo(map);

  map.setView(
    [51.0149, -3.1024],
    11
  );

  const markers = new Map();

  let allVehicles = [];
  let serviceGroups = [];
  let selectedRoute = "all";

  const routeColours = {
    "21": "route-21",
    "22": "route-22",
    "28": "route-28"
  };

  function formatAge(seconds) {

    if (seconds < 10) {
      return "Updated just now";
    }

    if (seconds < 60) {
      return `Updated ${seconds} seconds ago`;
    }

    const minutes = Math.floor(seconds / 60);

    if (minutes < 60) {
      return `Updated ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    }

    const hours = Math.floor(minutes / 60);

    return `Updated ${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  function formatTime(timestamp) {

    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });

  }

  function statusTitle(status) {

    switch (status) {

      case "live":
        return "🟢 Live bus data";

      case "backup":
        return "🟠 Backup bus data";

      case "stale":
        return "🔴 Stale bus data";

      case "sample":
        return "🔵 Sample bus data";

      default:
        return "Bus data";

    }

  }

function createBusIcon(vehicle) {

  const colourClass =  routeColours[vehicle.route] ?? "route-neutral";
  const bearing = Number(vehicle.bearing ?? 0);

  return L.divIcon({

    className: "",

    html: `
      <div
        class="bus-marker ${colourClass}"
        style="position: relative;"
      >
        ${vehicle.route}

        <div
          class="bus-direction"
          style="transform: rotate(${bearing}deg)"
        ></div>

      </div>
    `,

    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18]

  });

}
  function createPopup(vehicle) {

    const mph =
      vehicle.speed_mps * 2.23694;

    return `

      <div class="popup-route">
        Route ${vehicle.route}
      </div>

      <div class="popup-destination">
        ${vehicle.origin} → ${vehicle.destination}
      </div>

      <div class="popup-details">

        <strong>Operator:</strong>
        ${vehicle.operator}<br>

        <strong>Vehicle:</strong>
        ${vehicle.vehicle_id}<br>

        <strong>Speed:</strong>
        ${mph.toFixed(1)} mph<br>

        <strong>Recorded:</strong>
        ${formatTime(vehicle.recorded_at)}

      </div>

    `;

  }

  function updateMarkers() {

const selectedGroup =
  serviceGroups.find(
    group => group.ref === selectedRoute
  );

const visibleVehicles =
  selectedRoute === "all"
    ? allVehicles
    : allVehicles.filter(
        vehicle =>
          selectedGroup?.services.includes(vehicle.route)
      );

    const activeIds =
      new Set(
        visibleVehicles.map(
          vehicle => vehicle.vehicle_id
        )
      );

    for (const vehicle of visibleVehicles) {

      const position = [
        vehicle.latitude,
        vehicle.longitude
      ];

      let marker =
        markers.get(vehicle.vehicle_id);

      if (!marker) {

        marker = L.marker(
          position,
          {
            icon: createBusIcon(vehicle)
          }
        );

        marker.bindPopup(
          createPopup(vehicle)
        );

        marker.addTo(map);

        markers.set(
          vehicle.vehicle_id,
          marker
        );

      } else {

        marker.setLatLng(position);

        marker.setIcon(
          createBusIcon(vehicle)
        );

        marker.setPopupContent(
          createPopup(vehicle)
        );

        if (!map.hasLayer(marker)) {
          marker.addTo(map);
        }

      }

    }

    for (const [id, marker] of markers) {

      if (!activeIds.has(id)) {

        map.removeLayer(marker);

      }

    }

  }

function getServiceGroupVehicleCount(group) {
  return allVehicles.filter(vehicle => group.services.includes(vehicle.route)).length;
}

function buildRouteButtons() {
  const routeBar = document.querySelector(".route-bar");

  for (const group of serviceGroups) {
    const button = document.createElement("button");

    button.className = "route-button";
    button.dataset.route = group.ref;
    const label = group.name ?? group.ref;
    const count = getServiceGroupVehicleCount(group);

    button.textContent = `${label} (${count})`;

    button.addEventListener("click", () => {
      selectedRoute = group.ref;
      document.querySelectorAll(".route-button").forEach(item =>item.classList.remove("selected"));
      button.classList.add("selected");
      updateMarkers();
    });

    routeBar.appendChild(button);
  }

  const allButton =
    document.querySelector(
      '[data-route="all"]'
    );

  allButton.addEventListener(
    "click",
    () => {
      selectedRoute = "all";

      document
        .querySelectorAll(".route-button")
        .forEach(
          item =>
            item.classList.remove("selected")
        );

      allButton.classList.add("selected");
      updateMarkers();
    }
  );
}

function updateRouteButtonCounts() {
  for (const group of serviceGroups) {
    const button = document.querySelector(
      `[data-route="${group.ref}"]`
    );

    if (!button) {
      continue;
    }

    const label = group.name ?? group.ref;
    const count = getServiceGroupVehicleCount(group);

    button.textContent = `${label} (${count})`;
  }
}

  let firstLoad = true;

  async function loadData() {

    try {

      const cacheBust = Date.now();

      const [
  busResponse,
  statusResponse,
  servicesResponse
] = await Promise.all([
  fetch(
    `buses.json?${cacheBust}`,
    {
      cache: "no-store"
    }
  ),
  fetch(
    `status.json?${cacheBust}`,
    {
      cache: "no-store"
    }
  ),
  fetch(
    `services.json?${cacheBust}`,
    {
      cache: "no-store"
    }
  )
]);

      if (!busResponse.ok) {
        throw new Error(
          `Bus data HTTP ${busResponse.status}`
        );
      }

      if (!statusResponse.ok) {
        throw new Error(
          `Status HTTP ${statusResponse.status}`
        );
      }
      if (!servicesResponse.ok) {
        throw new Error(
          `Services HTTP ${servicesResponse.status}`
        );
      }

      const data    = await busResponse.json();
      const status  = await statusResponse.json();
      
      serviceGroups = await servicesResponse.json();

      allVehicles = data.vehicles;

      updateRouteButtonCounts();
      updateMarkers();

      const generated =
        new Date(status.generated_at);

      const ageSeconds =
        Math.max(
          0,
          Math.floor(
            (Date.now() -
              generated.getTime()) / 1000
          )
        );

      const statusElement =
        document.getElementById("status");

      statusElement.className =
        `status ${status.status}`;

      statusElement.innerHTML = `

        <div class="status-title">
          ${statusTitle(status.status)}
        </div>

        <div class="status-age">
          ${formatAge(ageSeconds)}
        </div>

        <div class="status-details">
          ${data.vehicle_count}
          vehicles ·
          Data timestamp
          ${formatTime(status.generated_at)}
        </div>

      `;

      if (
        firstLoad &&
        data.vehicles.length > 0
      ) {

        const bounds =
          L.latLngBounds(
            data.vehicles.map(
              vehicle => [
                vehicle.latitude,
                vehicle.longitude
              ]
            )
          );

        map.fitBounds(
          bounds.pad(0.15)
        );

        firstLoad = false;

      }

      if (
        document.querySelectorAll(
          ".route-button"
        ).length === 1
      ) {

        buildRouteButtons();

      }

    } catch (error) {

      console.error(error);

      const statusElement =
        document.getElementById("status");

      statusElement.className =
        "status stale";

      statusElement.innerHTML = `

        <div class="status-title">
          🔴 Data unavailable
        </div>

        <div class="status-age">
          Unable to retrieve bus data.
        </div>

      `;

    }

  }

  loadData();

  setInterval(
    loadData,
    10000
  );
