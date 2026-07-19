import { getCountryDataList } from "countries-list";

export const COUNTRIES = getCountryDataList()
  .map((country) => ({
    code: country.iso2,
    name: country.name
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "en"));

export const COUNTRY_CODE_SET = new Set<string>(
  COUNTRIES.map((country) => country.code)
);
