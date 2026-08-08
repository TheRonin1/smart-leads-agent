import axios from "axios";

const api = axios.create({ baseURL: "/api" });

export interface VacancyDTO {
  hoarding_id: string;
  location: string;
  size: string;
  traffic_score: number;
  monthly_rate: number;
  category: "Premium" | "Standard" | "Budget";
  free_from: string;
  already_vacant: boolean;
  days_until_vacant: number;
  revenue_at_risk_per_month: number;
  last_booking: { booking_id: string; customer_id: string; end_date: string };
}

export interface VacanciesResponse {
  reference_date: string;
  count: number;
  total_revenue_at_risk_per_month: number;
  vacancies: VacancyDTO[];
}

export interface LeadDTO {
  customer_id: string;
  name: string;
  industry: string;
  budget_band: "Low" | "Mid" | "High";
  relationship_score: number;
  is_cold_relationship: boolean;
  score: number;
  score_breakdown: {
    industryFit: number;
    budgetFit: number;
    relationship: number;
    pastBookingAffinity: number;
    weights: Record<string, number>;
  };
  reasons: string[];
}

export interface LeadsResponse {
  hoarding: VacancyDTO & { _id?: string };
  leads: LeadDTO[];
  candidates_considered: number;
  candidates_excluded_on_budget: number;
}

export interface PitchResponse {
  hoarding_id: string;
  customer_id: string;
  pitch_text: string;
  suggested_rate: number;
  rate_card_base: number;
  discount_pct: number;
  site_facts: { location: string; size: string; traffic_score: number; category: string };
  customer_history: { past_bookings: number; past_value: number; booked_this_site_before: boolean };
}

export interface RenewalResponse {
  customer_id: string;
  name: string;
  repeat_bookings_on_site: number;
  days_since_contact: number;
  relationship_score: number;
  renewal_likelihood: number;
  verdict: string;
}

export const getVacancies = () => api.get<VacanciesResponse>("/vacancies").then(r => r.data);
export const getLeads = (hoardingId: string) => api.get<LeadsResponse>(`/leads/${hoardingId}`).then(r => r.data);
export const getPitch = (hoardingId: string, customerId: string) =>
  api.get<PitchResponse>(`/pitch/${hoardingId}/${customerId}`).then(r => r.data);
export const getRenewal = (hoardingId: string, customerId: string) =>
  api.get<RenewalResponse>(`/leads/${hoardingId}/renewal/${customerId}`).then(r => r.data);

export default api;
