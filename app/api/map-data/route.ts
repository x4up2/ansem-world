import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";
import { area } from "@turf/area";
import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon";
import { centerOfMass } from "@turf/center-of-mass";
import { polygon } from "@turf/helpers";
import { pointOnFeature } from "@turf/point-on-feature";
import countries2to3 from "countries-list/minimal/countries.2to3.min.json";

import { COUNTRIES } from "@/lib/countries";
import { getCountryClaimCounts } from "@/lib/country-claims";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CountryProperties = {
  name?: string;
  iso_a3?: string;
};

type CountryFeature = GeoJSON.Feature<
  GeoJSON.Polygon | GeoJSON.MultiPolygon,
  CountryProperties
>;

const ISO2_TO_ISO3 =
  countries2to3 as Record<string, string>;

const COUNTRY_NAMES = new Map<string, string>(
  COUNTRIES.map(
    ({ code, name }) =>
      [code, name] as [string, string]
  )
);

/*
 * Natural Earth uses "-99" instead of an ISO-3 code
 * for a few country geometries.
 */
const NATURAL_EARTH_ISO3_OVERRIDES: Record<string, string> = {
  France: "FRA",
  Norway: "NOR",
  Kosovo: "XKX"
};


/*
 * For MultiPolygon countries, use the largest land component.
 * This prevents overseas territories or distant islands from
 * moving the marker away from the country's main territory.
 */
function getLargestLandPolygon(
  feature: CountryFeature
): GeoJSON.Feature<
  GeoJSON.Polygon,
  CountryProperties
> {
  if (feature.geometry.type === "Polygon") {
    return {
      type: "Feature",
      geometry: feature.geometry,
      properties: feature.properties ?? {}
    };
  }

  let largestPolygon:
    | GeoJSON.Feature<
        GeoJSON.Polygon,
        CountryProperties
      >
    | null = null;

  let largestArea = -1;

  for (
    const coordinates of
    feature.geometry.coordinates
  ) {
    const candidate = polygon(
      coordinates,
      feature.properties ?? {}
    ) as GeoJSON.Feature<
      GeoJSON.Polygon,
      CountryProperties
    >;

    const candidateArea = area(candidate);

    if (candidateArea > largestArea) {
      largestArea = candidateArea;
      largestPolygon = candidate;
    }
  }

  if (!largestPolygon) {
    throw new Error(
      `No polygon found for ${
        feature.properties?.name ?? "country"
      }`
    );
  }

  return largestPolygon;
}

function getRepresentativeCountryPoint(
  feature: CountryFeature
): GeoJSON.Feature<GeoJSON.Point> {
  const mainLand =
    getLargestLandPolygon(feature);

  const calculatedCenter =
    centerOfMass(mainLand);

  /*
   * A center of mass may fall outside a highly concave
   * polygon. In that rare case, use a guaranteed internal
   * point on the main landmass.
   */
  if (
    booleanPointInPolygon(
      calculatedCenter,
      mainLand
    )
  ) {
    return calculatedCenter;
  }

  return pointOnFeature(mainLand);
}


export async function GET() {
  try {
    const [claimCounts, rawWorld] = await Promise.all([
      getCountryClaimCounts(),

      readFile(
        path.join(
          process.cwd(),
          "public",
          "world-countries.geojson"
        ),
        "utf8"
      )
    ]);

    const world = JSON.parse(rawWorld) as GeoJSON.FeatureCollection<
      GeoJSON.Polygon | GeoJSON.MultiPolygon,
      CountryProperties
    >;

    const countriesByIso3 = new Map<
      string,
      CountryFeature
    >();

    for (const feature of world.features) {
      const featureName =
        feature.properties?.name?.trim() ?? "";

      const rawIso3 =
        feature.properties?.iso_a3?.toUpperCase();

      const iso3 =
        rawIso3 && rawIso3 !== "-99"
          ? rawIso3
          : NATURAL_EARTH_ISO3_OVERRIDES[featureName];

      if (iso3) {
        countriesByIso3.set(iso3, feature);
      }
    }

    const features: GeoJSON.Feature<
      GeoJSON.Point,
      {
        countryCode: string;
        country: string;
        claims: number;
      }
    >[] = [];

    const unmappedCountryCodes: string[] = [];
    let unmappedClaims = 0;

    for (const claimCount of claimCounts) {
      const iso3 =
        ISO2_TO_ISO3[claimCount.countryCode];

      const countryFeature = iso3
        ? countriesByIso3.get(iso3)
        : undefined;

      if (!countryFeature) {
        unmappedCountryCodes.push(
          claimCount.countryCode
        );

        unmappedClaims += claimCount.claims;
        continue;
      }

      const representativePoint =
        getRepresentativeCountryPoint(
          countryFeature
        );

      features.push({
        type: "Feature",
        geometry: representativePoint.geometry,
        properties: {
          countryCode: claimCount.countryCode,
          country:
            COUNTRY_NAMES.get(
              claimCount.countryCode
            ) ??
            countryFeature.properties?.name ??
            claimCount.countryCode,

          claims: claimCount.claims
        }
      });
    }

    const totalClaims = claimCounts.reduce(
      (total, country) =>
        total + country.claims,
      0
    );

    return NextResponse.json(
      {
        ok: true,
        totalClaims,
        mappedClaims: totalClaims - unmappedClaims,
        countries: features.length,
        unmappedClaims,
        unmappedCountryCodes,
        data: {
          type: "FeatureCollection",
          features
        }
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    console.error(
      "Unable to generate map data:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error: "Unable to load verified map claims."
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }
}
