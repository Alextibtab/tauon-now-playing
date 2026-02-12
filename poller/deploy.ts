import { NowPlayingData } from "../types.ts";

/**
 * Send the latest now playing data to the Deploy API.
 *
 * @param deployUrl Deploy endpoint base URL.
 * @param apiKey Shared API key for authorization.
 * @param data Payload to store.
 * @returns True when the request succeeds.
 */
export async function sendToDeploy(
  deployUrl: string,
  apiKey: string,
  data: NowPlayingData,
): Promise<boolean> {
  try {
    const response = await fetch(`${deployUrl}/api/now-playing`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.warn(`Deploy API error: ${response.status}`);
      return false;
    }

    return true;
  } catch (error) {
    console.warn("Failed to send to Deploy API:", error);
    return false;
  }
}
