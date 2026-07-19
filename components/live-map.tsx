"use client";

import {
  useEffect,
  useRef,
  useState
} from "react";

import maplibregl, {
  Map as MapLibreMap,
  type ErrorEvent,
  type GeoJSONSource,
  type StyleSpecification
} from "maplibre-gl";

const SOURCE_ID = "ansem-country-claims";
const GLOW_LAYER_ID = "ansem-country-glow";
const POINT_LAYER_ID = "ansem-country-points";

type BubbleProperties = {
  countryCode: string;
  country: string;
  claims: number;
};

type MapDataResponse = {
  ok?: boolean;
  error?: string;
  totalClaims?: number;
  mappedClaims?: number;
  countries?: number;
  unmappedClaims?: number;
  data?: GeoJSON.FeatureCollection<
    GeoJSON.Point,
    BubbleProperties
  >;
};

const EMPTY_DATA: GeoJSON.FeatureCollection<
  GeoJSON.Point,
  BubbleProperties
> = {
  type: "FeatureCollection",
  features: []
};

const LOCAL_MAP_STYLE: StyleSpecification = {
  version: 8,
  name: "ANSEM WORLD local dark map",

  sources: {
    countries: {
      type: "geojson",
      data: "/world-countries.geojson"
    }
  },

  layers: [
    {
      id: "background",
      type: "background",
      paint: {
        "background-color": "#050705"
      }
    },
    {
      id: "countries-fill",
      type: "fill",
      source: "countries",
      paint: {
        "fill-color": "#0d120e",
        "fill-opacity": 0.98
      }
    },
    {
      id: "countries-line",
      type: "line",
      source: "countries",
      paint: {
        "line-color":
          "rgba(93, 153, 108, 0.52)",

        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          1,
          0.55,
          6,
          1.15
        ]
      }
    }
  ]
};

type MapStatus =
  | "loading"
  | "ready"
  | "error";

export function LiveMap() {
  const containerRef =
    useRef<HTMLDivElement | null>(null);

  const mapRef =
    useRef<MapLibreMap | null>(null);

  const [status, setStatus] =
    useState<MapStatus>("loading");

  const [errorMessage, setErrorMessage] =
    useState("");

  const [mapData, setMapData] =
    useState(EMPTY_DATA);

  const [summary, setSummary] = useState({
    totalClaims: 0,
    countries: 0
  });

  const [dataError, setDataError] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadClaims() {
      try {
        const response = await fetch(
          "/api/map-data",
          {
            cache: "no-store"
          }
        );

        const body =
          (await response.json()) as MapDataResponse;

        if (
          !response.ok ||
          !body.ok ||
          !body.data
        ) {
          throw new Error(
            body.error ??
              "Claim data could not be loaded."
          );
        }

        if (cancelled) {
          return;
        }

        setMapData(body.data);

        setSummary({
          totalClaims: body.mappedClaims ?? 0,
          countries: body.countries ?? 0
        });

        setDataError("");
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : "Claim data could not be loaded.";

        console.error(
          "ANSEM WORLD claim data error:",
          error
        );

        setDataError(message);
      }
    }

    void loadClaims();

    const refreshTimer = window.setInterval(
      loadClaims,
      60_000
    );

    window.addEventListener(
      "ansem-claim-updated",
      loadClaims
    );

    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);

      window.removeEventListener(
        "ansem-claim-updated",
        loadClaims
      );
    };
  }, []);

  useEffect(() => {
    if (
      !containerRef.current ||
      mapRef.current
    ) {
      return;
    }

    let map: MapLibreMap;

    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: LOCAL_MAP_STYLE,
        center: [8, 18],
        zoom: 1.35,
        minZoom: 0.8,
        maxZoom: 7,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        renderWorldCopies: false
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to initialize the map.";

      console.error(
        "ANSEM WORLD map initialization failed:",
        error
      );

      setErrorMessage(message);
      setStatus("error");
      return;
    }

    mapRef.current = map;

    map.addControl(
      new maplibregl.NavigationControl({
        showCompass: false
      }),
      "bottom-right"
    );

    map.addControl(
      new maplibregl.AttributionControl({
        compact: true
      }),
      "bottom-left"
    );

    map.on("error", (event: ErrorEvent) => {
      console.error(
        "ANSEM WORLD MapLibre error:",
        event.error
      );

      setErrorMessage(
        (current) =>
          current ||
          event.error?.message ||
          "A map resource could not be loaded."
      );
    });

    map.on("load", () => {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: EMPTY_DATA
      });

      map.addLayer({
        id: GLOW_LAYER_ID,
        type: "circle",
        source: SOURCE_ID,

        paint: {
          /*
           * Radius follows sqrt(claims), so the
           * visible area follows the claim count.
           */
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],

            1,
            [
              "min",
              38,
              [
                "max",
                9,
                [
                  "*",
                  7,
                  [
                    "sqrt",
                    [
                      "to-number",
                      ["get", "claims"],
                      1
                    ]
                  ]
                ]
              ]
            ],

            6,
            [
              "min",
              62,
              [
                "max",
                15,
                [
                  "*",
                  11,
                  [
                    "sqrt",
                    [
                      "to-number",
                      ["get", "claims"],
                      1
                    ]
                  ]
                ]
              ]
            ]
          ],

          "circle-color": "#22ff62",
          "circle-opacity": 0.19,
          "circle-blur": 1,
          "circle-stroke-width": 0
        }
      });

      map.addLayer({
        id: POINT_LAYER_ID,
        type: "circle",
        source: SOURCE_ID,

        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],

            1,
            [
              "min",
              25,
              [
                "max",
                4,
                [
                  "*",
                  4,
                  [
                    "sqrt",
                    [
                      "to-number",
                      ["get", "claims"],
                      1
                    ]
                  ]
                ]
              ]
            ],

            6,
            [
              "min",
              42,
              [
                "max",
                7,
                [
                  "*",
                  6.5,
                  [
                    "sqrt",
                    [
                      "to-number",
                      ["get", "claims"],
                      1
                    ]
                  ]
                ]
              ]
            ]
          ],

          "circle-color": "#22ff62",
          "circle-opacity": 0.94,

          "circle-stroke-color":
            "rgba(210,255,221,.9)",

          "circle-stroke-width": 0.8
        }
      });

      const popup = new maplibregl.Popup({
        closeButton: false,
        offset: 12,
        className: "ansem-popup"
      });

      map.on(
        "mouseenter",
        POINT_LAYER_ID,
        (event) => {
          map.getCanvas().style.cursor =
            "pointer";

          const feature =
            event.features?.[0];

          if (
            !feature ||
            feature.geometry.type !== "Point"
          ) {
            return;
          }

          const country = String(
            feature.properties?.country ??
              "ANSEM WORLD"
          );

          const claims = Number(
            feature.properties?.claims ?? 0
          );

          const popupContent =
            document.createElement("div");

          const title =
            document.createElement("strong");

          title.textContent = country;

          const detail =
            document.createElement("span");

          detail.textContent =
            `${claims.toLocaleString()} verified ` +
            `${claims === 1 ? "bull" : "bulls"}`;

          popupContent.append(title, detail);

          popup
            .setLngLat(
              feature.geometry
                .coordinates as [number, number]
            )
            .setDOMContent(popupContent)
            .addTo(map);
        }
      );

      map.on(
        "mouseleave",
        POINT_LAYER_ID,
        () => {
          map.getCanvas().style.cursor = "";
          popup.remove();
        }
      );

      map.resize();
      setStatus("ready");
    });

    const resizeObserver =
      new ResizeObserver(() => map.resize());

    resizeObserver.observe(
      containerRef.current
    );

    const loadingTimeout =
      window.setTimeout(() => {
        setStatus((current) => {
          if (current !== "loading") {
            return current;
          }

          setErrorMessage(
            "The map took too long to initialize."
          );

          return "error";
        });
      }, 12_000);

    return () => {
      window.clearTimeout(loadingTimeout);
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (status !== "ready") {
      return;
    }

    const map = mapRef.current;

    if (!map) {
      return;
    }

    const source =
      map.getSource(SOURCE_ID) as
        | GeoJSONSource
        | undefined;

    source?.setData(mapData);
  }, [mapData, status]);

  useEffect(() => {
    if (status !== "ready") {
      return;
    }

    const map = mapRef.current;

    if (!map) {
      return;
    }

    let pulse = 0;

    const timer = window.setInterval(() => {
      pulse = (pulse + 1) % 4;

      if (map.getLayer(GLOW_LAYER_ID)) {
        map.setPaintProperty(
          GLOW_LAYER_ID,
          "circle-opacity",
          0.12 + pulse * 0.035
        );
      }
    }, 700);

    return () =>
      window.clearInterval(timer);
  }, [status]);

  return (
    <div className="map-shell">
      <div
        ref={containerRef}
        className="map-canvas"
        style={{
          width: "100%",
          height: "100%"
        }}
        aria-label="Verified ANSEM claims grouped by country"
      />

      {status === "loading" && (
        <div className="map-loading">
          INITIALIZING THE HERD…
        </div>
      )}

      {status === "error" && (
        <div
          className="map-error"
          role="alert"
        >
          <strong>MAP COULD NOT START</strong>
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="map-vignette" />

      <div className="map-live-badge">
        <span /> VERIFIED COMMUNITY MAP
      </div>

      <div className="map-legend">
        {dataError
          ? "CLAIM DATA UNAVAILABLE"
          : summary.totalClaims === 0
            ? "NO VERIFIED HOLDERS MAPPED YET"
            : `${summary.countries} ${
                summary.countries === 1
                  ? "COUNTRY"
                  : "COUNTRIES"
              } · ${summary.totalClaims.toLocaleString()} VERIFIED ${
                summary.totalClaims === 1
                  ? "BULL"
                  : "BULLS"
              }`}
      </div>
    </div>
  );
}
