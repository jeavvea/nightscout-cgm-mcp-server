import { NightScoutEntry, JWTResponse, TreatmentResponse } from '../types.js';

export class NightScoutClient {
  private baseUrl: string;
  private accessToken: string;
  private jwtToken: string | null = null;

  constructor(baseUrl: string, accessToken: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.accessToken = accessToken;
  }

  async getJWTToken(): Promise<string> {
    if (this.jwtToken) {
      return this.jwtToken;
    }

    const url = `${this.baseUrl}/api/v2/authorization/request/${this.accessToken}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to get JWT token: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as JWTResponse;
    this.jwtToken = data.token;
    return this.jwtToken;
  }

  async getEntries(startDate: number, endDate: number, limit: number = 1000): Promise<NightScoutEntry[]> {
    const token = await this.getJWTToken();

    const params = new URLSearchParams({
      'find[date][$gte]': startDate.toString(),
      'find[date][$lte]': endDate.toString(),
      count: limit.toString(),
    });

    const url = `${this.baseUrl}/api/v1/entries.json?${params}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch entries: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    return (Array.isArray(data) ? data : []) as NightScoutEntry[];
  }

  async addTreatment(treatment: {
    eventType: string;
    carbs: number;
    created_at?: string;
    notes?: string;
    enteredBy?: string;
  }): Promise<TreatmentResponse | TreatmentResponse[]> {
    const token = await this.getJWTToken();

    // Ensure created_at is in ISO format
    const treatmentData = {
      ...treatment,
      created_at: treatment.created_at || new Date().toISOString(),
    };

    const url = `${this.baseUrl}/api/v1/treatments/`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(treatmentData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to add treatment: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = (await response.json()) as TreatmentResponse | TreatmentResponse[];
    return data;
  }
}
