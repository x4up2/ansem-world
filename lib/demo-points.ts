export type CommunityPoint = {
  id: string;
  country: string;
  countryCode: string;
  coordinates: [number, number];
  joinedAt: string;
};

const hubs: Array<{
  country: string;
  countryCode: string;
  lng: number;
  lat: number;
  weight: number;
}> = [
  { country: "United States", countryCode: "US", lng: -98, lat: 38, weight: 32 },
  { country: "France", countryCode: "FR", lng: 2.2, lat: 46.2, weight: 18 },
  { country: "United Kingdom", countryCode: "GB", lng: -2, lat: 54, weight: 12 },
  { country: "Germany", countryCode: "DE", lng: 10.4, lat: 51.2, weight: 11 },
  { country: "Canada", countryCode: "CA", lng: -106, lat: 56, weight: 10 },
  { country: "Brazil", countryCode: "BR", lng: -51, lat: -10, weight: 10 },
  { country: "Japan", countryCode: "JP", lng: 138, lat: 36, weight: 9 },
  { country: "Australia", countryCode: "AU", lng: 134, lat: -25, weight: 8 },
  { country: "South Korea", countryCode: "KR", lng: 128, lat: 36, weight: 7 },
  { country: "Singapore", countryCode: "SG", lng: 103.8, lat: 1.35, weight: 7 },
  { country: "Turkey", countryCode: "TR", lng: 35, lat: 39, weight: 6 },
  { country: "United Arab Emirates", countryCode: "AE", lng: 54.4, lat: 24.4, weight: 6 },
  { country: "India", countryCode: "IN", lng: 78.9, lat: 22.7, weight: 9 },
  { country: "Nigeria", countryCode: "NG", lng: 8.7, lat: 9.1, weight: 5 },
  { country: "South Africa", countryCode: "ZA", lng: 24, lat: -29, weight: 5 },
  { country: "Mexico", countryCode: "MX", lng: -102, lat: 23, weight: 5 },
  { country: "Argentina", countryCode: "AR", lng: -64, lat: -34, weight: 4 },
  { country: "Spain", countryCode: "ES", lng: -3.7, lat: 40.4, weight: 7 },
  { country: "Italy", countryCode: "IT", lng: 12.5, lat: 42.5, weight: 6 },
  { country: "Netherlands", countryCode: "NL", lng: 5.3, lat: 52.1, weight: 5 },
  { country: "Switzerland", countryCode: "CH", lng: 8.2, lat: 46.8, weight: 4 },
  { country: "Portugal", countryCode: "PT", lng: -8.2, lat: 39.6, weight: 4 },
  { country: "Indonesia", countryCode: "ID", lng: 117, lat: -2, weight: 6 },
  { country: "Philippines", countryCode: "PH", lng: 122, lat: 12, weight: 5 },
  { country: "Vietnam", countryCode: "VN", lng: 108, lat: 16, weight: 4 },
  { country: "Thailand", countryCode: "TH", lng: 101, lat: 15, weight: 4 }
];

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeDemoPoints(seed = 73021): CommunityPoint[] {
  const random = mulberry32(seed);
  const points: CommunityPoint[] = [];
  let index = 0;

  for (const hub of hubs) {
    const count = hub.weight * 3;
    for (let i = 0; i < count; i += 1) {
      const spreadLng = hub.countryCode === "US" || hub.countryCode === "CA" ? 20 : 7;
      const spreadLat = hub.countryCode === "US" || hub.countryCode === "CA" ? 9 : 4;
      const lng = Math.max(-178, Math.min(178, hub.lng + (random() - 0.5) * spreadLng));
      const lat = Math.max(-78, Math.min(78, hub.lat + (random() - 0.5) * spreadLat));
      points.push({
        id: `demo-${index}`,
        country: hub.country,
        countryCode: hub.countryCode,
        coordinates: [lng, lat],
        joinedAt: new Date(Date.now() - Math.floor(random() * 86_400_000)).toISOString()
      });
      index += 1;
    }
  }

  return points;
}
