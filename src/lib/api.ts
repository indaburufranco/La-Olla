import { supabase } from "./supabase";

// ─── Tipos que ya usa la app (App.tsx) ─────────────────────────────────────
type MenuItem = {
  id: number;
  name: string;
  desc: string;
  price: number;
  category: string;
  img: string;
  tags: string[];
  available: boolean;
  visible: boolean;
  sortOrder: number;
};

type Order = {
  id: string;
  timestamp: string;
  items: { name: string; price: number; qty?: number; date: string }[];
  total: number;
  note: string;
  status: "pendiente" | "confirmado" | "entregado";
};

type WeeklySubscriber = {
  id: string;
  name: string;
  plan: string;
  address: string;
  phone: string;
  since: string;
};

// ─── Menú ───────────────────────────────────────────────────────────────────
export async function uploadMenuImage(file: File): Promise<string> {
  const ext = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from("menu-images").upload(fileName, file);
  if (error) throw error;
  const { data } = supabase.storage.from("menu-images").getPublicUrl(fileName);
  return data.publicUrl;
}

function rowToMenuItem(row: any): MenuItem {
  return {
    id: row.id,
    name: row.name,
    desc: row.description ?? "",
    price: Number(row.price),
    category: row.category,
    img: row.image_url ?? "",
    tags: row.tags ?? [],
    available: row.available ?? true,
    visible: row.visible ?? true,
    sortOrder: row.sort_order ?? row.id,
  };
}

export async function fetchMenuItems(): Promise<MenuItem[]> {
  const { data, error } = await supabase.from("menu_items").select("*").order("sort_order").order("id");
  if (error) throw error;
  return (data ?? []).map(rowToMenuItem);
}

export async function reorderMenuItem(id: number, sortOrder: number): Promise<void> {
  const { error } = await supabase.from("menu_items").update({ sort_order: sortOrder }).eq("id", id);
  if (error) throw error;
}

export async function toggleMenuItemAvailability(id: number, available: boolean): Promise<void> {
  const { error } = await supabase.from("menu_items").update({ available }).eq("id", id);
  if (error) throw error;
}

export async function toggleMenuItemVisibility(id: number, visible: boolean): Promise<void> {
  const { error } = await supabase.from("menu_items").update({ visible }).eq("id", id);
  if (error) throw error;
}

// Recibe el estado anterior y el nuevo estado propuesto por el panel admin,
// calcula qué se agregó / editó / borró, lo aplica en Supabase, y devuelve
// el estado real (ya con los ids que asignó la base de datos).
export async function syncMenuItems(prev: MenuItem[], next: MenuItem[]): Promise<MenuItem[]> {
  const prevIds = new Set(prev.map((i) => i.id));
  const nextIds = new Set(next.map((i) => i.id));

  const toInsert = next.filter((i) => !prevIds.has(i.id));
  const toDelete = prev.filter((i) => !nextIds.has(i.id));
  const toUpdate = next.filter((i) => prevIds.has(i.id));

  for (const item of toInsert) {
    const { error } = await supabase.from("menu_items").insert({
      name: item.name,
      description: item.desc,
      price: item.price,
      category: item.category,
      image_url: item.img,
      tags: item.tags,
      available: item.available,
      sort_order: item.sortOrder,
    });
    if (error) throw error;
  }

  for (const item of toDelete) {
    const { error } = await supabase.from("menu_items").delete().eq("id", item.id);
    if (error) throw error;
  }

  for (const item of toUpdate) {
    const { error } = await supabase
      .from("menu_items")
      .update({
        name: item.name,
        description: item.desc,
        price: item.price,
        category: item.category,
        image_url: item.img,
        tags: item.tags,
        available: item.available,
        sort_order: item.sortOrder,
      })
      .eq("id", item.id);
    if (error) throw error;
  }

  return fetchMenuItems();
}

// ─── Suscriptores ───────────────────────────────────────────────────────────
function rowToSubscriber(row: any): WeeklySubscriber {
  return {
    id: String(row.id),
    name: row.name,
    plan: row.plan,
    address: row.address ?? "",
    phone: row.phone ?? "",
    since: row.since,
  };
}

export async function fetchSubscribers(): Promise<WeeklySubscriber[]> {
  const { data, error } = await supabase.from("subscribers").select("*").order("id");
  if (error) throw error;
  return (data ?? []).map(rowToSubscriber);
}

export async function syncSubscribers(prev: WeeklySubscriber[], next: WeeklySubscriber[]): Promise<WeeklySubscriber[]> {
  const prevIds = new Set(prev.map((s) => s.id));
  const nextIds = new Set(next.map((s) => s.id));

  const toInsert = next.filter((s) => !prevIds.has(s.id));
  const toDelete = prev.filter((s) => !nextIds.has(s.id));

  for (const sub of toInsert) {
    const { error } = await supabase.from("subscribers").insert({
      name: sub.name,
      plan: sub.plan,
      address: sub.address,
      phone: sub.phone,
    });
    if (error) throw error;
  }

  for (const sub of toDelete) {
    const { error } = await supabase.from("subscribers").delete().eq("id", sub.id);
    if (error) throw error;
  }

  return fetchSubscribers();
}

// ─── Pedidos ────────────────────────────────────────────────────────────────
function rowToOrder(row: any): Order {
  return {
    id: String(row.id),
    timestamp: new Date(row.created_at).toLocaleString("es-UY"),
    items: row.items,
    total: Number(row.total),
    note: row.note ?? "",
    status: row.status,
  };
}

export async function fetchOrders(): Promise<Order[]> {
  const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToOrder);
}

export async function createOrder(items: { name: string; price: number; qty?: number; date: string }[], total: number, note = ""): Promise<Order[]> {
  const { error } = await supabase.from("orders").insert({ items, total, note, status: "pendiente" });
  if (error) throw error;
  return fetchOrders();
}

export async function deleteOrder(id: string): Promise<Order[]> {
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) throw error;
  return fetchOrders();
}

export async function updateOrderStatus(id: string, status: Order["status"]): Promise<Order[]> {
  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  if (error) throw error;
  return fetchOrders();
}

// ─── Planes de viandas semanales ─────────────────────────────────────────────
export type WeeklyPlan = {
  id: number;
  name: string;
  desc: string;
  price: number;
  includes: string[];
  highlight: boolean;
  bgColor: string;
  accentColor: string;
  sortOrder: number;
};

function rowToPlan(row: any): WeeklyPlan {
  return {
    id: row.id,
    name: row.name,
    desc: row.description ?? "",
    price: Number(row.price),
    includes: row.includes ?? [],
    highlight: row.highlight ?? false,
    bgColor: row.bg_color ?? "#F0EBE1",
    accentColor: row.accent_color ?? "#2D4A22",
    sortOrder: row.sort_order ?? 0,
  };
}

export async function fetchWeeklyPlans(): Promise<WeeklyPlan[]> {
  const { data, error } = await supabase.from("weekly_plans").select("*").order("sort_order");
  if (error) throw error;
  return (data ?? []).map(rowToPlan);
}

export async function syncWeeklyPlans(prev: WeeklyPlan[], next: WeeklyPlan[]): Promise<WeeklyPlan[]> {
  const prevIds = new Set(prev.map((p) => p.id));
  const nextIds = new Set(next.map((p) => p.id));

  const toInsert = next.filter((p) => !prevIds.has(p.id));
  const toDelete = prev.filter((p) => !nextIds.has(p.id));
  const toUpdate = next.filter((p) => prevIds.has(p.id));

  for (const plan of toInsert) {
    const { error } = await supabase.from("weekly_plans").insert({
      name: plan.name,
      description: plan.desc,
      price: plan.price,
      includes: plan.includes,
      highlight: plan.highlight,
      bg_color: plan.bgColor,
      accent_color: plan.accentColor,
      sort_order: plan.sortOrder,
    });
    if (error) throw error;
  }

  for (const plan of toDelete) {
    const { error } = await supabase.from("weekly_plans").delete().eq("id", plan.id);
    if (error) throw error;
  }

  for (const plan of toUpdate) {
    const { error } = await supabase
      .from("weekly_plans")
      .update({
        name: plan.name,
        description: plan.desc,
        price: plan.price,
        includes: plan.includes,
        highlight: plan.highlight,
        bg_color: plan.bgColor,
        accent_color: plan.accentColor,
        sort_order: plan.sortOrder,
      })
      .eq("id", plan.id);
    if (error) throw error;
  }

  return fetchWeeklyPlans();
}
