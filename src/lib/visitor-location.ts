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

export function getVisitorCountry(headers: Headers) {
    return normalizeCountry(getHeaderValue(headers, COUNTRY_HEADER_KEYS));
}

export function getClientIp(headers: Headers) {
    const directIp = getHeaderValue(headers, CLIENT_IP_HEADER_KEYS);
    if (directIp) return directIp;

    const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    return forwardedFor ?? "";
}

interface IpWhoResponse {
    success: boolean;
    ip: string;
    country?: string;
    connection?: {
        asn?: number;
        org?: string;
        isp?: string;
    };
}

const ANTEL_KEYWORDS = ["antel", "administración nacional de telecomunicaciones"];

export async function isAntelNetwork(clientIp: string): Promise<boolean> {
    if (import.meta.env.DEV) return true; // Avoid unnecessary API calls during development
    if (!clientIp) return false;

    try {
        const res = await fetch(`https://ipwho.is/${clientIp}?fields=ip,connection.org,connection.isp`, {
            signal: AbortSignal.timeout(3000),
        });
        if (!res.ok) return false;

        const data: IpWhoResponse = await res.json();
        if (!data.success) return false;

        const org = data.connection?.org?.toLowerCase() ?? "";
        const isp = data.connection?.isp?.toLowerCase() ?? "";

        return ANTEL_KEYWORDS.some((kw) => org.includes(kw) || isp.includes(kw));
    } catch {
        return false;
    }
}
