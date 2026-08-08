import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export const getVacancies = () => api.get('/vacancies').then(r => r.data);
export const getLeads = (hoardingId) => api.get(`/leads/${hoardingId}`).then(r => r.data);
export const getPitch = (hoardingId, customerId) => api.get(`/pitch/${hoardingId}/${customerId}`).then(r => r.data);
export const getRenewal = (hoardingId, customerId) => api.get(`/leads/${hoardingId}/renewal/${customerId}`).then(r => r.data);

export default api;
