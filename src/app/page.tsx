"use client";

import dynamic from "next/dynamic";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { MapRestaurant } from "@/components/RestaurantMap";

const RestaurantMap = dynamic(() => import("@/components/RestaurantMap"), {
  ssr: false,
  loading: () => <div className="grid h-full min-h-[460px] animate-pulse place-items-center rounded-2xl bg-gradient-to-br from-pink-50 via-purple-50 to-sky-50 text-sm font-semibold text-violet-700">Preparing your map…</div>,
});

interface Restaurant extends Omit<MapRestaurant, "latitude" | "longitude"> {
  city: string;
  address: string;
  website_url: string;
  google_rating: number | null;
  yelp_rating: number | null;
  celiac_notes: string;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}
interface Feedback { id: string; restaurant_id: string; member_name: string; score: number; notes: string }
type Draft = { score: number; notes: string };
type Center = { lat: number; lon: number; label: string };
type Bounds = { north: number; south: number; east: number; west: number };

const nameKey = "celisafe-traveler-name";
const fieldClass = "w-full rounded-xl border border-violet-100 bg-white/90 px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100";
const scoreAverage = (entries: Feedback[]) => entries.length ? entries.reduce((sum, entry) => sum + entry.score, 0) / entries.length : null;
const initialCenter: Center = { lat: 39.5, lon: -98.35, label: "United States" };

export default function Home() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [city, setCity] = useState("");
  const [traveler, setTraveler] = useState("");
  const [sort, setSort] = useState<"reviews" | "circle">("reviews");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [form, setForm] = useState({ name: "", city: "", address: "", websiteUrl: "", googleRating: "", yelpRating: "", celiacNotes: "", latitude: "", longitude: "" });
  const [center, setCenter] = useState<Center>(initialCenter);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      const [placesResponse, notesResponse] = await Promise.all([fetch("/api/restaurants"), fetch("/api/restaurants/feedback")]);
      if (!placesResponse.ok || !notesResponse.ok) throw new Error("Could not load saved places. Check your Supabase configuration and setup SQL.");
      const [placeRows, noteRows] = await Promise.all([placesResponse.json(), notesResponse.json()]);
      setRestaurants(placeRows);
      setFeedback(noteRows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load restaurants.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const storedTraveler = window.localStorage.getItem(nameKey);
    if (storedTraveler) queueMicrotask(() => setTraveler(storedTraveler));
    queueMicrotask(() => void load());
  }, []);

  const searchCity = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setLookingUp(true);
    setError("");
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not find this city.");
      const nextCenter: Center = { lat: result.latitude, lon: result.longitude, label: result.label };
      setCenter(nextCenter);
      setBounds(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not find this city.");
    } finally {
      setLookingUp(false);
    }
  }, []);

  const mapPlaces = useMemo(() => restaurants
    .filter((place) => place.latitude !== null && place.longitude !== null)
    .map((place) => ({ ...place, latitude: Number(place.latitude), longitude: Number(place.longitude) })), [restaurants]);

  const visiblePlaces = useMemo(() => {
    const query = city.trim().toLocaleLowerCase();
    return mapPlaces
      .filter((place) => {
        if (query && !place.city.toLocaleLowerCase().includes(query)) return false;
        if (!bounds) return true;
        return place.latitude >= bounds.south && place.latitude <= bounds.north && place.longitude >= bounds.west && place.longitude <= bounds.east;
      })
      .sort((a, b) => {
        const aCircle = scoreAverage(feedback.filter((entry) => entry.restaurant_id === a.id)) ?? 0;
        const bCircle = scoreAverage(feedback.filter((entry) => entry.restaurant_id === b.id)) ?? 0;
        const aPublic = Math.max(a.google_rating ?? -1, a.yelp_rating ?? -1);
        const bPublic = Math.max(b.google_rating ?? -1, b.yelp_rating ?? -1);
        return sort === "reviews" ? bPublic - aPublic || bCircle - aCircle : bCircle - aCircle || bPublic - aPublic;
      });
  }, [mapPlaces, feedback, city, bounds, sort]);

  const nearbyPlaceIds = useMemo(() => new Set(visiblePlaces.map((place) => place.id)), [visiblePlaces]);
  const unsavedNearby = useMemo(() => mapPlaces.filter((place) => !nearbyPlaceIds.has(place.id) && (!city.trim() || place.city.toLocaleLowerCase().includes(city.trim().toLocaleLowerCase()))), [mapPlaces, nearbyPlaceIds, city]);
  const discoverUrl = `https://www.google.com/maps/search/${encodeURIComponent(`celiac friendly gluten free restaurants ${city.trim() || "restaurants"}`)}`;
  const mapLink = (place: Restaurant) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name} ${place.address} ${place.city}`)}`;

  const addPlace = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      let latitude = form.latitude ? Number(form.latitude) : null;
      let longitude = form.longitude ? Number(form.longitude) : null;
      if (latitude === null && longitude === null) {
        const geoResponse = await fetch(`/api/geocode?q=${encodeURIComponent(`${form.address ? `${form.address}, ` : ""}${form.city}`)}`);
        const geo = await geoResponse.json();
        if (geoResponse.ok) { latitude = geo.latitude; longitude = geo.longitude; }
      }
      const response = await fetch("/api/restaurants", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, latitude: latitude ?? "", longitude: longitude ?? "" }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not save restaurant.");
      setRestaurants((current) => [payload, ...current]);
      setCity(form.city);
      if (payload.latitude !== null && payload.longitude !== null) {
        setCenter({ lat: Number(payload.latitude), lon: Number(payload.longitude), label: payload.city }); setBounds(null);
      }
      setForm({ name: "", city: "", address: "", websiteUrl: "", googleRating: "", yelpRating: "", celiacNotes: "", latitude: "", longitude: "" });
      setMessage("Saved and shared with your circle!");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save restaurant."); }
    finally { setSaving(false); }
  };

  const draftFor = (place: Restaurant): Draft => {
    const saved = feedback.find((entry) => entry.restaurant_id === place.id && entry.member_name === traveler.trim());
    return drafts[place.id] ?? { score: saved?.score ?? 5, notes: saved?.notes ?? "" };
  };
  const saveFeedback = async (place: Restaurant) => {
    if (!traveler.trim()) { setError("Add your name in Your profile before saving a rating or note."); return; }
    setError(""); setMessage("");
    try {
      const response = await fetch("/api/restaurants/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId: place.id, memberName: traveler.trim(), ...draftFor(place) }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not save your note.");
      setFeedback((current) => [payload, ...current.filter((entry) => !(entry.restaurant_id === place.id && entry.member_name === traveler.trim()))]);
      setMessage(`Your score and note for ${place.name} are shared.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save your note."); }
  };

  const reviewLinks = (place: Restaurant) => ({
    google: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name} ${place.city}`)}`,
    yelp: `https://www.yelp.com/search?find_desc=${encodeURIComponent(place.name)}&find_loc=${encodeURIComponent(place.city)}`,
  });

  return (
    <div className="space-y-7">
      <section className="relative isolate overflow-hidden rounded-[2rem] border border-white/70 bg-gradient-to-br from-pink-100 via-purple-100 to-sky-100 p-6 shadow-[0_24px_70px_rgba(108,76,142,0.12)] sm:p-10 lg:p-12">
        <div className="absolute -right-10 -top-20 -z-10 h-72 w-72 rounded-full bg-white/45 blur-3xl" /><div className="absolute -bottom-28 left-1/3 -z-10 h-64 w-64 rounded-full bg-emerald-200/35 blur-3xl" />
        <div className="grid gap-8 lg:grid-cols-[1fr_19rem] lg:items-end"><div className="max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/60 px-3 py-1.5 text-xs font-bold uppercase tracking-[.16em] text-violet-800"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Gluten-free travel, together</p>
          <h1 className="mt-5 text-4xl font-black leading-[1.06] tracking-tight text-slate-900 sm:text-6xl">Good food.<br /><span className="bg-gradient-to-r from-violet-700 via-pink-600 to-sky-600 bg-clip-text text-transparent">Peace of mind.</span></h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-700 sm:text-lg">A shared, feel-good guide to celiac-aware restaurant finds—saved with your circle’s tips, ratings, and links.</p>
          <a href={discoverUrl} target="_blank" rel="noreferrer" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-violet-700 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-900/15 transition hover:-translate-y-0.5 hover:bg-violet-800">Explore places on Google Maps <span aria-hidden="true">↗</span></a>
          <p className="mt-3 text-xs leading-5 text-slate-600">Open Google Maps to browse external restaurants, then save the ones you want to keep in Celisafe.</p>
        </div><form onSubmit={(event) => { event.preventDefault(); void searchCity(city); }} className="grid gap-2 rounded-2xl border border-white/80 bg-white/70 p-4 text-sm font-bold text-slate-800 shadow-sm backdrop-blur">
          <label htmlFor="city-search">Where are you headed?</label><span className="relative"><span aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2">⌕</span><input id="city-search" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Type a city or destination" className={`${fieldClass} pl-9`} /></span><button disabled={lookingUp || !city.trim()} className="rounded-xl bg-violet-100 px-4 py-2.5 text-sm font-bold text-violet-900 hover:bg-violet-200 disabled:opacity-50">{lookingUp ? "Finding city…" : "Show this city on the map"}</button><span className="text-xs font-medium text-slate-500">Saved finds appear again whenever you search the same city.</span>
        </form></div>
      </section>

      {(error || message) && <p role={error ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${error ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>{error || message}</p>}

      <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3 px-1"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-violet-700">The map and list work together</p><h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">{center.label.split(",")[0] || "Explore places"}</h2><p className="mt-1 text-sm text-slate-600">{visiblePlaces.length} saved {visiblePlaces.length === 1 ? "place" : "places"} in this map area{unsavedNearby.length > 0 ? ` · ${unsavedNearby.length} outside the current view` : ""}</p></div><label className="grid gap-1 text-xs font-semibold text-slate-500">Rank by<select value={sort} onChange={(event) => setSort(event.target.value as "reviews" | "circle")} className="rounded-xl border border-violet-100 bg-white px-3 py-2 text-sm text-slate-800"><option value="reviews">Google / Yelp reviews</option><option value="circle">Our circle ratings</option></select></label></div>

          <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
            <div className="h-[460px] overflow-hidden rounded-2xl border border-white shadow-[0_15px_45px_rgba(74,52,95,0.1)]"><RestaurantMap center={[center.lat, center.lon]} places={mapPlaces} selectedId={selectedId} onSelect={setSelectedId} onViewport={setBounds} /></div>
            <div className="max-h-[460px] space-y-3 overflow-y-auto pr-1" aria-label="Restaurants visible in the current map area">
              {loading ? <div className="rounded-2xl border border-white bg-white/80 p-6 text-sm text-slate-600">Loading your shared places…</div> : visiblePlaces.length === 0 ? <div className="rounded-2xl border border-dashed border-violet-200 bg-white/75 p-7 text-center"><div className="text-3xl" aria-hidden="true">🗺️</div><h3 className="mt-3 font-bold text-slate-900">No saved finds in this view yet</h3><p className="mt-2 text-sm leading-5 text-slate-600">Pan or zoom the map to see saved restaurants there. Add a place using the form, or explore Google Maps.</p><a href={discoverUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-xl bg-violet-100 px-4 py-2 text-sm font-bold text-violet-900 hover:bg-violet-200">Explore options ↗</a></div> : visiblePlaces.map((place, index) => {
                const placeFeedback = feedback.filter((entry) => entry.restaurant_id === place.id); const average = scoreAverage(placeFeedback); const draft = draftFor(place); const links = reviewLinks(place);
                return <article key={place.id} onMouseEnter={() => setSelectedId(place.id)} onMouseLeave={() => setSelectedId(null)} className={`rounded-2xl border bg-white/95 p-4 shadow-sm transition ${selectedId === place.id ? "border-violet-300 ring-2 ring-violet-100" : "border-white"}`}>
                  <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sky-100 text-xs font-black text-sky-800">{index + 1}</span><div className="min-w-0"><h3 className="truncate font-black text-slate-900">{place.name}</h3><p className="mt-0.5 truncate text-xs text-slate-500">{place.address ? `${place.address} · ` : ""}{place.city}</p></div></div><a href={mapLink(place)} target="_blank" rel="noreferrer" aria-label={`Directions to ${place.name}`} className="shrink-0 rounded-lg bg-sky-50 px-2.5 py-1.5 text-xs font-bold text-sky-800 hover:bg-sky-100">Directions ↗</a></div>
                  <div className="mt-3 flex flex-wrap gap-2">{place.google_rating !== null ? <a href={links.google} target="_blank" rel="noreferrer" className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-800 hover:bg-blue-100"><span aria-label="Google rating">G</span> ★ {place.google_rating.toFixed(1)}</a> : <a href={links.google} target="_blank" rel="noreferrer" className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100">Google reviews ↗</a>}{place.yelp_rating !== null ? <a href={links.yelp} target="_blank" rel="noreferrer" className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-800 hover:bg-rose-100"><span aria-label="Yelp rating">Yelp</span> ★ {place.yelp_rating.toFixed(1)}</a> : <a href={links.yelp} target="_blank" rel="noreferrer" className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100">Yelp reviews ↗</a>}<span className="rounded-lg bg-violet-50 px-2.5 py-1.5 text-xs font-bold text-violet-800">★ {average !== null ? `${average.toFixed(1)} circle` : "No circle score"}</span></div>
                  {place.celiac_notes && <p className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/80 px-3 py-2.5 text-xs leading-5 text-emerald-950">{place.celiac_notes}</p>}
                  <div className="mt-3 border-t border-slate-100 pt-3"><div className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] gap-2"><select aria-label={`Your score for ${place.name}`} value={draft.score} onChange={(event) => setDrafts((current) => ({ ...current, [place.id]: { ...draft, score: Number(event.target.value) } }))} className="rounded-lg border border-violet-100 bg-white px-2 py-2 text-xs text-slate-800">{[5, 4, 3, 2, 1].map((score) => <option key={score} value={score}>★ {score}/5</option>)}</select><input aria-label={`Note for ${place.name}`} value={draft.notes} onChange={(event) => setDrafts((current) => ({ ...current, [place.id]: { ...draft, notes: event.target.value } }))} maxLength={2000} placeholder="Note for the group" className="min-w-0 rounded-lg border border-violet-100 px-2 py-2 text-xs text-slate-800 outline-none focus:border-violet-400" /><button type="button" onClick={() => void saveFeedback(place)} className="rounded-lg bg-pink-100 px-3 py-2 text-xs font-bold text-pink-900 hover:bg-pink-200">Save</button></div>{placeFeedback.filter((entry) => entry.notes).map((entry) => <p key={entry.id} className="mt-2 rounded-lg bg-purple-50 px-2.5 py-2 text-xs text-slate-600"><strong className="text-slate-800">{entry.member_name} · {entry.score}/5:</strong> {entry.notes}</p>)}</div>
                </article>;
              })}
              {!loading && unsavedNearby.length > 0 && <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600"><strong>{unsavedNearby.length} saved elsewhere.</strong> Pan or zoom the map to bring them into the visible list.</div>}
            </div>
          </div>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-24">
          <section className="rounded-2xl border border-white bg-white/85 p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-[.16em] text-violet-700">Your profile</p><h2 className="mt-1 text-lg font-black text-slate-900">Who’s sharing?</h2><p className="mt-1 text-sm leading-5 text-slate-600">Use a consistent name so your tips and scores are recognizable.</p><input value={traveler} onChange={(event) => { setTraveler(event.target.value); window.localStorage.setItem(nameKey, event.target.value); }} maxLength={50} placeholder="Your name" className={`${fieldClass} mt-3`} /><p className="mt-2 text-xs text-slate-500">Invite your whole circle—there’s no member cap.</p></section>

          <form id="add-restaurant" onSubmit={addPlace} className="scroll-mt-24 rounded-2xl border border-white bg-white/90 p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-[.16em] text-pink-700">Add to the collection</p><h2 className="mt-1 text-lg font-black text-slate-900">Save a restaurant</h2><div className="mt-4 grid gap-3"><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Restaurant name" className={fieldClass} /><input required value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} placeholder="City / destination" className={fieldClass} /><input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Street address (optional)" className={fieldClass} /><input type="url" value={form.websiteUrl} onChange={(event) => setForm({ ...form, websiteUrl: event.target.value })} placeholder="Website link (optional)" className={fieldClass} /><div className="grid grid-cols-2 gap-2"><label className="grid gap-1 text-[11px] font-bold text-slate-500">Google score<input type="number" min="0" max="5" step="0.1" value={form.googleRating} onChange={(event) => setForm({ ...form, googleRating: event.target.value })} placeholder="e.g. 4.7" className={fieldClass} /></label><label className="grid gap-1 text-[11px] font-bold text-slate-500">Yelp score<input type="number" min="0" max="5" step="0.1" value={form.yelpRating} onChange={(event) => setForm({ ...form, yelpRating: event.target.value })} placeholder="e.g. 4.5" className={fieldClass} /></label></div><details className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"><summary className="cursor-pointer text-xs font-semibold text-slate-600">Map pin not in right place? Add coordinates</summary><div className="mt-3 grid grid-cols-2 gap-2"><input type="number" step="any" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} placeholder="Latitude" className={fieldClass} /><input type="number" step="any" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} placeholder="Longitude" className={fieldClass} /></div></details><textarea value={form.celiacNotes} onChange={(event) => setForm({ ...form, celiacNotes: event.target.value })} placeholder="Celiac-friendly details, source, or questions to ask" rows={3} maxLength={2000} className={fieldClass} /><button disabled={saving} className="rounded-xl bg-violet-700 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-violet-800 disabled:opacity-50">{saving ? "Saving…" : "Share with the circle"}</button></div></form>
        </aside>
      </section>

      <p className="rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-xs leading-5 text-amber-950"><strong>A quick safety note:</strong> A gluten-free menu or community review can’t guarantee a meal is safe for celiac disease. Confirm ingredients, dedicated preparation, and cross-contact controls directly with restaurant staff.</p>
    </div>
  );
}
