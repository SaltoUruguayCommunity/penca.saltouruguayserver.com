type RequestWithCf = Request & {
    cf?: {
        country?: string;
        asOrganization?: string;
    };
};

const COUNTRY_HEADER_KEYS = ["cf-ipcountry", "x-vercel-ip-country", "x-country-code", "x-country"];
const CLIENT_IP_HEADER_KEYS = ["cf-connecting-ip", "true-client-ip", "x-real-ip", "x-client-ip"];

function normalizeCountry(value: string | null | undefined) {
    return value?.trim().toUpperCase() ?? "";
}

function getHeaderValue(headers: Headers, keys: string[]) {
    for (const key of keys) {
        const value = headers.get(key)?.trim();
        if (value) return value;
    }

    return "";
}

export function getVisitorCountry(headers: Headers, request?: Request) {
    const cfCountry = request ? normalizeCountry((request as RequestWithCf).cf?.country) : "";
    const headerCountry = normalizeCountry(getHeaderValue(headers, COUNTRY_HEADER_KEYS));

    return cfCountry || headerCountry;
}

export function getClientIp(headers: Headers) {
    const directIp = getHeaderValue(headers, CLIENT_IP_HEADER_KEYS);
    if (directIp) return directIp;

    const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    return forwardedFor ?? "";
}

export function isAntelNetwork(headers: Headers, clientIp: string, request?: Request) {
    const organization = request ? (request as RequestWithCf).cf?.asOrganization?.toLowerCase() ?? "" : "";
    if (organization.includes("antel")) return true;

    return clientIp.startsWith("179.") || clientIp.startsWith("167.");
}