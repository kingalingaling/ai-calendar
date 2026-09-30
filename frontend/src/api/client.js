import axios from "axios";

// In production, use the deployed backend URL; locally, fall back to '/api' for Vite's proxy
const backendBase = import.meta.env.VITE_API_URL;
const baseURL = backendBase ? `${backendBase.replace(/\/+$/, "")}/api` : "/api";

export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});
