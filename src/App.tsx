import { useState, useMemo, useEffect } from "react";
import {
  fetchMenuItems, syncMenuItems, uploadMenuImage, toggleMenuItemAvailability, toggleMenuItemVisibility, reorderMenuItem,
  fetchSubscribers, syncSubscribers,
  fetchOrders, createOrder, deleteOrder, updateOrderStatus,
  fetchWeeklyPlans, syncWeeklyPlans,
  type WeeklyPlan,
} from "./lib/api";
import { supabase } from "./lib/supabase";
import { siteConfig } from "./lib/siteConfig";

// --- Types ---
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

type CartItem = { id: number; name: string; price: number; qty: number; date: string };

type Order = {
  id: string;
  timestamp: string;
  items: { name: string; price: number; qty?: number; date: string }[]; // price = precio unitario. qty ausente = pedido viejo (tratar como 1)
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

const CATEGORIES = ["todos", "entrada", "principal", "postre"];

function formatPrice(n: number) {
  return `$${n.toLocaleString("es-AR")}`;
}

function getAvailableDates() {
  const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i + 1);
    return { label: `${d.getDate()} ${months[d.getMonth()]}`, value: d.toISOString().split("T")[0], dayName: days[d.getDay()] };
  });
}

function waLink(message: string) {
  return `https://wa.me/${siteConfig.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
function Nav({ cartCount, onCartClick, onAdminClick }: { cartCount: number; onCartClick: () => void; onAdminClick: () => void }) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4" style={{ background: "rgba(250,247,242,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid #DDD8CF" }}>
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="flex flex-col leading-none text-left hover:opacity-75 transition-opacity"
      >
        <span style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "1.35rem", fontWeight: 600, color: "#2D4A22" }}>{siteConfig.businessName}</span>
        <span style={{ fontSize: "0.65rem", letterSpacing: "0.15em", color: "#5A5A56", textTransform: "uppercase" }}>{siteConfig.tagline}</span>
      </button>

      <div className="hidden md:flex items-center gap-8" style={{ fontSize: "0.85rem", color: "#5A5A56" }}>
        <a href="#menu" className="hover:text-[#C4622D] transition-colors">Menú del día</a>
        <a href="#pedidos" className="hover:text-[#C4622D] transition-colors">Hacer pedido</a>
        <a href="#viandas" className="hover:text-[#C4622D] transition-colors">Viandas semanales</a>
        <a href="#contacto" className="hover:text-[#C4622D] transition-colors">Contacto</a>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={onAdminClick} className="flex items-center gap-1.5 px-2 md:px-3 py-2 rounded-lg transition-colors hover:bg-[#F0EBE1]" style={{ fontSize: "0.75rem", color: "#5A5A56" }} aria-label="Panel administrador">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span className="hidden md:inline">Admin</span>
        </button>
        <button onClick={onCartClick} className="relative flex items-center gap-2 px-4 py-2 rounded-full transition-all hover:opacity-80" style={{ background: "#2D4A22", color: "#FAF7F2", fontSize: "0.85rem" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
          <span>Pedido</span>
          {cartCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold" style={{ background: "#C4622D", color: "#FAF7F2" }}>{cartCount}</span>
          )}
        </button>
      </div>
    </nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative min-h-screen flex items-end pb-24 pt-20 overflow-hidden" style={{ background: "#2D4A22" }}>
      <div className="absolute inset-0">
        <img src="https://images.unsplash.com/photo-1650855543392-44edbd4e03cf?w=1600&h=1000&fit=crop&auto=format" alt="Mesa con comida casera abundante" className="w-full h-full object-cover opacity-40" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #2D4A22 40%, transparent 100%)" }} />
      </div>
      <div className="relative z-10 max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-end w-full">
        <div>
          <p className="mb-4" style={{ fontSize: "0.75rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#E07A45" }}>Comida hecha con amor · Uruguay</p>
          <h1 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "clamp(3rem, 7vw, 5.5rem)", lineHeight: 1.05, color: "#FAF7F2", fontWeight: 300 }}>
            La cocina<br /><em style={{ fontWeight: 400, fontStyle: "italic" }}>de mamá</em><br />en tu mesa
          </h1>
          <p className="mt-6 max-w-sm" style={{ color: "#BFC9B8", lineHeight: 1.7, fontSize: "1rem" }}>
            Comidas caseras elaboradas con ingredientes frescos. Pedí hasta una semana de anticipación o armá tu plan de viandas semanal.
          </p>
          <div className="mt-8 flex gap-4 flex-wrap">
            <a href="#pedidos" className="px-6 py-3 rounded-full font-medium transition-all hover:opacity-90" style={{ background: "#C4622D", color: "#FAF7F2", fontSize: "0.9rem" }}>Hacer un pedido</a>
            <a href="#viandas" className="px-6 py-3 rounded-full font-medium transition-all hover:bg-white/10" style={{ border: "1px solid rgba(255,255,255,0.3)", color: "#FAF7F2", fontSize: "0.9rem" }}>Ver viandas semanales</a>
          </div>
        </div>
        <div className="hidden md:grid grid-cols-2 gap-3">
          {[{ label: "Platos esta semana", value: "18" }, { label: "Clientes satisfechos", value: "340+" }, { label: "Años de experiencia", value: "12" }, { label: "Pedidos mínimo", value: "1 día" }].map((s) => (
            <div key={s.label} className="p-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
              <div style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "2rem", color: "#FAF7F2", fontWeight: 600 }}>{s.value}</div>
              <div style={{ fontSize: "0.75rem", color: "#8FA887", marginTop: "0.25rem" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Menu Section ─────────────────────────────────────────────────────────────
function MenuSection({ menuItems, onAdd }: { menuItems: MenuItem[]; onAdd: (item: MenuItem, date: string) => void }) {
  const [cat, setCat] = useState("todos");
  const dates = useMemo(() => getAvailableDates(), []);
  const [selectedDate] = useState(dates[0].value);
  const visibleItems = menuItems.filter((m) => m.visible);
  const filtered = cat === "todos" ? visibleItems : visibleItems.filter((m) => m.category === cat);

  return (
    <section id="menu" className="py-24 px-6" style={{ background: "#FAF7F2" }}>
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <p style={{ fontSize: "0.7rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#C4622D", marginBottom: "0.5rem" }}>Lo que cocinamos hoy</p>
            <h2 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "clamp(2rem, 4vw, 3rem)", color: "#1A1A18", fontWeight: 400 }}>Menú del día</h2>
          </div>
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCat(c)} className="px-4 py-1.5 rounded-full capitalize transition-all" style={{ background: cat === c ? "#2D4A22" : "transparent", color: cat === c ? "#FAF7F2" : "#5A5A56", border: cat === c ? "1px solid #2D4A22" : "1px solid #DDD8CF", fontSize: "0.8rem" }}>{c}</button>
            ))}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((item) => (
            <article key={item.id} className="rounded-2xl overflow-hidden group" style={{ background: "#FFFFFF", border: "1px solid #DDD8CF", opacity: item.available ? 1 : 0.6 }}>
              <div className="relative h-48 overflow-hidden" style={{ background: "#E8E3D8" }}>
                <img src={item.img} alt={item.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" style={{ filter: item.available ? "none" : "grayscale(60%)" }} />
                {item.tags.length > 0 && (
                  <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap">
                    {item.tags.map((t) => <span key={t} className="px-2 py-0.5 rounded-full text-xs" style={{ background: "rgba(45,74,34,0.85)", color: "#FAF7F2", backdropFilter: "blur(4px)" }}>{t}</span>)}
                  </div>
                )}
                {!item.available && (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(26,26,24,0.35)" }}>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ background: "#1A1A18", color: "#FAF7F2" }}>Agotado hoy</span>
                  </div>
                )}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "1.1rem", color: "#1A1A18", fontWeight: 400 }}>{item.name}</h3>
                  <span style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "1.1rem", color: "#C4622D", fontWeight: 600, whiteSpace: "nowrap" }}>{formatPrice(item.price)}</span>
                </div>
                <p style={{ fontSize: "0.82rem", color: "#5A5A56", lineHeight: 1.5 }}>{item.desc}</p>
                <button onClick={() => onAdd(item, selectedDate)} disabled={!item.available} className="mt-4 w-full py-2.5 rounded-xl font-medium transition-all hover:opacity-80 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: "#2D4A22", color: "#FAF7F2", fontSize: "0.85rem" }}>
                  {item.available ? "+ Agregar al pedido" : "Agotado hoy"}
                </button>
              </div>
            </article>
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-16" style={{ color: "#5A5A56" }}>No hay platos en esta categoría por el momento.</div>
        )}
      </div>
    </section>
  );
}

// ─── Order Section ─────────────────────────────────────────────────────────────
function OrderSection({ menuItems: allMenuItems, onAdd, note, onNoteChange }: { menuItems: MenuItem[]; onAdd: (item: MenuItem, date: string) => void; note: string; onNoteChange: (v: string) => void }) {
  const menuItems = allMenuItems.filter((m) => m.visible);
  const dates = useMemo(() => getAvailableDates(), []);
  const [selectedDate, setSelectedDate] = useState(dates[0].value);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);

  const toggle = (id: number) => setSelectedItems((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handleAdd = () => {
    selectedItems.forEach((id) => {
      const item = menuItems.find((m) => m.id === id);
      if (item) onAdd(item, selectedDate);
    });
    setSelectedItems([]);
  };

  const total = selectedItems.reduce((s, id) => s + (menuItems.find((m) => m.id === id)?.price ?? 0), 0);
  const selectedDateLabel = dates.find((d) => d.value === selectedDate);

  return (
    <section id="pedidos" className="py-24 px-6" style={{ background: "#F0EBE1" }}>
      <div className="max-w-6xl mx-auto">
        <div className="mb-12">
          <p style={{ fontSize: "0.7rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#C4622D", marginBottom: "0.5rem" }}>Programá tu comida</p>
          <h2 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "clamp(2rem, 4vw, 3rem)", color: "#1A1A18", fontWeight: 400 }}>Hacer un pedido</h2>
          <p className="mt-2" style={{ color: "#5A5A56", fontSize: "0.9rem" }}>Podés pedir hasta 7 días de anticipación. Entrega o retiro disponible.</p>
        </div>
        <div className="grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-8">
            <div>
              <h3 className="mb-4 flex items-center gap-2" style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "1.2rem", color: "#1A1A18" }}>
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold" style={{ background: "#2D4A22", color: "#FAF7F2" }}>1</span>
                Elegí el día de entrega
              </h3>
              <div className="flex gap-2 flex-wrap">
                {dates.map((d) => (
                  <button key={d.value} onClick={() => setSelectedDate(d.value)} className="flex flex-col items-center px-4 py-3 rounded-xl transition-all min-w-[72px]" style={{ background: selectedDate === d.value ? "#2D4A22" : "#FFFFFF", color: selectedDate === d.value ? "#FAF7F2" : "#1A1A18", border: selectedDate === d.value ? "1px solid #2D4A22" : "1px solid #DDD8CF" }}>
                    <span style={{ fontSize: "0.65rem", opacity: 0.7 }}>{d.dayName}</span>
                    <span style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "1.1rem", fontWeight: 600 }}>{d.label.split(" ")[0]}</span>
                    <span style={{ fontSize: "0.65rem", opacity: 0.7 }}>{d.label.split(" ")[1]}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="mb-4 flex items-center gap-2" style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "1.2rem", color: "#1A1A18" }}>
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold" style={{ background: "#2D4A22", color: "#FAF7F2" }}>2</span>
                Seleccioná tus platos
              </h3>
              <div className="space-y-2.5">
                {menuItems.map((item) => {
                  const sel = selectedItems.includes(item.id);
                  return (
                    <div key={item.id} onClick={() => toggle(item.id)} className="flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all" style={{ background: "#FFFFFF", border: sel ? "1.5px solid #2D4A22" : "1px solid #DDD8CF" }}>
                      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0" style={{ background: "#E8E3D8" }}>
                        <img src={item.img} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "0.95rem", color: "#1A1A18" }}>{item.name}</span>
                          <span className="text-xs capitalize px-2 py-0.5 rounded-full" style={{ background: "#F0EBE1", color: "#5A5A56" }}>{item.category}</span>
                        </div>
                        <p style={{ fontSize: "0.78rem", color: "#5A5A56" }}>{item.desc}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div style={{ fontFamily: "Fraunces, Georgia, serif", color: "#C4622D", fontWeight: 600 }}>{formatPrice(item.price)}</div>
                        <div className={`mt-1 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all`} style={{ borderColor: sel ? "#2D4A22" : "#DDD8CF", background: sel ? "#2D4A22" : "transparent" }}>
                          {sel && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#FAF7F2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <h3 className="mb-3 flex items-center gap-2" style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "1.2rem", color: "#1A1A18" }}>
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold" style={{ background: "#2D4A22", color: "#FAF7F2" }}>3</span>
                Aclaraciones o alergias
              </h3>
              <textarea value={note} onChange={(e) => onNoteChange(e.target.value)} placeholder="Ej: sin cebolla, celíaco, alergia al maní..." rows={3} className="w-full rounded-xl p-4 resize-none outline-none" style={{ border: "1px solid #DDD8CF", background: "#FFFFFF", fontSize: "0.875rem", color: "#1A1A18" }} />
            </div>
          </div>
          <div className="lg:sticky lg:top-24 self-start">
            <div className="rounded-2xl p-6" style={{ background: "#FFFFFF", border: "1px solid #DDD8CF" }}>
              <h3 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "1.1rem", color: "#1A1A18", marginBottom: "1rem" }}>Resumen del pedido</h3>
              {selectedItems.length === 0 ? (
                <p style={{ fontSize: "0.85rem", color: "#5A5A56", textAlign: "center", padding: "2rem 0" }}>Seleccioná platos para armar tu pedido</p>
              ) : (
                <div className="space-y-3 mb-4">
                  {selectedItems.map((id) => {
                    const item = menuItems.find((m) => m.id === id)!;
                    return (
                      <div key={id} className="flex justify-between gap-2" style={{ fontSize: "0.85rem" }}>
                        <span style={{ color: "#1A1A18" }}>{item.name}</span>
                        <span style={{ color: "#C4622D", fontWeight: 500 }}>{formatPrice(item.price)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {selectedItems.length > 0 && (
                <>
                  <div className="py-3 my-2" style={{ borderTop: "1px solid #DDD8CF", borderBottom: "1px solid #DDD8CF" }}>
                    <div className="flex justify-between mt-2">
                      <span style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "1rem" }}>Total</span>
                      <span style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "1.1rem", color: "#C4622D", fontWeight: 600 }}>{formatPrice(total)}</span>
                    </div>
                  </div>
                  {selectedDateLabel && (
                    <div className="flex items-center gap-2 mb-4" style={{ fontSize: "0.78rem", color: "#5A5A56" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      Entrega: {selectedDateLabel.dayName}, {selectedDateLabel.label}
                    </div>
                  )}
                </>
              )}
              <button onClick={handleAdd} disabled={selectedItems.length === 0} className="w-full py-3 rounded-xl font-medium transition-all hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed" style={{ background: "#C4622D", color: "#FAF7F2", fontSize: "0.9rem" }}>
                Agregar al carrito
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Viandas Section ──────────────────────────────────────────────────────────
function ViandasSection({ plans }: { plans: WeeklyPlan[] }) {
  const [selected, setSelected] = useState<number | null>(null);

  const handleConsultar = () => {
    const plan = plans.find((p) => p.id === selected);
    if (!plan) return;
    const msg = `Hola! Me interesa el *${plan.name}* (${formatPrice(plan.price)}/semana). ¿Pueden darme más información sobre cómo contratar y los días de entrega?`;
    window.open(waLink(msg), "_blank");
  };

  return (
    <section id="viandas" className="py-24 px-6" style={{ background: "#1A1A18" }}>
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-end mb-14">
          <div>
            <p style={{ fontSize: "0.7rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#E07A45", marginBottom: "0.5rem" }}>Sin preocuparte por qué comer</p>
            <h2 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "clamp(2rem, 4vw, 3rem)", color: "#FAF7F2", fontWeight: 400, lineHeight: 1.1 }}>
              Viandas<br /><em style={{ fontStyle: "italic", fontWeight: 300 }}>semanales</em>
            </h2>
          </div>
          <p style={{ color: "#8A8A84", lineHeight: 1.7, fontSize: "0.9rem" }}>
            Armamos tu semana para que solo tengas que calentar y disfrutar. Menú variado, ingredientes frescos, entrega los lunes.
          </p>
        </div>
        {plans.length === 0 ? (
          <p className="text-center py-10" style={{ color: "#8A8A84", fontSize: "0.9rem" }}>Todavía no hay planes cargados.</p>
        ) : (
        <div className="grid md:grid-cols-3 gap-5 mb-10">
          {plans.map((plan) => (
            <div key={plan.id} onClick={() => setSelected(plan.id)} className="rounded-2xl p-7 cursor-pointer transition-all relative" style={{ background: plan.bgColor, outline: selected === plan.id ? "2px solid #C4622D" : "2px solid transparent", outlineOffset: "2px" }}>
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold" style={{ background: "#C4622D", color: "#FAF7F2" }}>Más popular</div>
              )}
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: plan.highlight ? "#8FA887" : "#5A5A56" }}>{plan.desc}</p>
              <h3 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "1.5rem", fontWeight: 400, color: plan.accentColor }}>{plan.name}</h3>
              <div className="my-5">
                <span style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "2.2rem", fontWeight: 600, color: plan.accentColor }}>{formatPrice(plan.price)}</span>
                <span className="text-sm ml-2" style={{ color: plan.highlight ? "#8FA887" : "#5A5A56" }}>/semana</span>
              </div>
              <ul className="space-y-2 mb-6">
                {plan.includes.map((inc) => (
                  <li key={inc} className="flex items-center gap-2 text-sm" style={{ color: plan.highlight ? "#BFC9B8" : "#5A5A56" }}>
                    <span style={{ color: plan.highlight ? "#E07A45" : "#C4622D" }}>✓</span>{inc}
                  </li>
                ))}
              </ul>
              <button onClick={(e) => { e.stopPropagation(); setSelected(plan.id); }} className="w-full py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80" style={{ background: plan.highlight ? "#C4622D" : "#2D4A22", color: "#FAF7F2" }}>
                {selected === plan.id ? "✓ Seleccionado" : "Elegir este plan"}
              </button>
            </div>
          ))}
        </div>
        )}
        {selected && (
          <div className="rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div>
              <p style={{ color: "#8A8A84", fontSize: "0.8rem" }}>Plan seleccionado</p>
              <p style={{ fontFamily: "Fraunces, Georgia, serif", color: "#FAF7F2", fontSize: "1.2rem" }}>
                {plans.find((p) => p.id === selected)?.name} — {formatPrice(plans.find((p) => p.id === selected)?.price ?? 0)}/semana
              </p>
            </div>
            <button onClick={handleConsultar} className="flex items-center gap-2 px-8 py-3 rounded-full font-medium transition-all hover:opacity-80 whitespace-nowrap" style={{ background: "#25D366", color: "#FFFFFF", fontSize: "0.9rem" }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.116 1.527 5.847L0 24l6.343-1.503A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.817 9.817 0 01-5.003-1.368l-.36-.214-3.727.883.932-3.632-.235-.373A9.818 9.818 0 0112 2.182c5.426 0 9.818 4.392 9.818 9.818 0 5.427-4.392 9.818-9.818 9.818z"/></svg>
              Consultar por WhatsApp
            </button>
          </div>
        )}
        <div className="mt-10 grid sm:grid-cols-3 gap-4">
          {[{ icon: "📦", title: "Entrega los lunes", desc: "Recibís la semana completa de una vez, lista para guardar en la heladera." }, { icon: "🥗", title: "Menú variado", desc: "Cada semana un menú diferente para que no te aburras de comer lo mismo." }, { icon: "♻️", title: "Envases reutilizables", desc: "Trabajamos con envases retornables. El planeta y tu bolsillo te lo agradecen." }].map((feat) => (
            <div key={feat.title} className="p-5 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{feat.icon}</div>
              <h4 style={{ color: "#FAF7F2", fontFamily: "Fraunces, Georgia, serif", fontSize: "1rem", marginBottom: "0.25rem" }}>{feat.title}</h4>
              <p style={{ color: "#8A8A84", fontSize: "0.82rem", lineHeight: 1.6 }}>{feat.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Gallery ──────────────────────────────────────────────────────────────────
function GallerySection() {
  return (
    <section className="py-20 px-6" style={{ background: "#FAF7F2" }}>
      <div className="max-w-6xl mx-auto">
        <p className="text-center mb-10" style={{ fontSize: "0.7rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#C4622D" }}>Así cocinamos</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[{ id: "1671225603584-8412a795a2d2", h: "h-64", span: "col-span-2" }, { id: "1543352632-5a4b24e4d2a6", h: "h-64", span: "" }, { id: "1543352632-fea6d4f83e78", h: "h-64", span: "" }, { id: "1667499745120-f9bcef8f584e", h: "h-48", span: "" }, { id: "1569420077790-afb136b3bb8c", h: "h-48", span: "col-span-2" }, { id: "1774290687310-eb245b815517", h: "h-48", span: "" }].map((img, i) => (
            <div key={i} className={`${img.span} ${img.h} rounded-2xl overflow-hidden`} style={{ background: "#E8E3D8" }}>
              <img src={`https://images.unsplash.com/photo-${img.id}?w=600&h=400&fit=crop&auto=format`} alt="Comida casera" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Contact Section ──────────────────────────────────────────────────────────
function ContactSection() {
  const [form, setForm] = useState({ nombre: "", tel: "", msg: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = `Hola! Soy *${form.nombre}*${form.tel ? ` (${form.tel})` : ""}.\n\n${form.msg}`;
    window.open(waLink(text), "_blank");
    setForm({ nombre: "", tel: "", msg: "" });
  };

  return (
    <section id="contacto" className="py-24 px-6" style={{ background: "#F0EBE1" }}>
      <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-16 items-center">
        <div>
          <p style={{ fontSize: "0.7rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#C4622D", marginBottom: "0.5rem" }}>Hablemos</p>
          <h2 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "clamp(2rem, 4vw, 2.8rem)", color: "#1A1A18", fontWeight: 400 }}>Contacto</h2>
          <p className="mt-4" style={{ color: "#5A5A56", lineHeight: 1.7, fontSize: "0.9rem" }}>
            ¿Tenés alguna consulta, restricción alimentaria o querés armar un pedido especial? Escribinos y te respondemos a la brevedad.
          </p>
          <div className="mt-8 space-y-4">
            {[{ icon: "📱", label: "WhatsApp", val: siteConfig.whatsappDisplay }, { icon: "📍", label: "Zona de entrega", val: siteConfig.deliveryZone }, { icon: "🕐", label: "Horario de atención", val: siteConfig.attentionHours }].map((c) => (
              <div key={c.label} className="flex items-start gap-3">
                <span style={{ fontSize: "1.2rem" }}>{c.icon}</span>
                <div>
                  <p style={{ fontSize: "0.72rem", color: "#5A5A56", textTransform: "uppercase", letterSpacing: "0.1em" }}>{c.label}</p>
                  <p style={{ color: "#1A1A18", fontSize: "0.9rem" }}>{c.val}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm mb-2" style={{ color: "#5A5A56" }}>
            Al enviar, se abrirá WhatsApp con tu mensaje listo para enviar al <strong>{siteConfig.whatsappDisplay}</strong>.
          </p>
          {[{ id: "nombre", label: "Nombre", type: "text", placeholder: "Tu nombre" }, { id: "tel", label: "Tu teléfono (opcional)", type: "tel", placeholder: "+598 09..." }].map((f) => (
            <div key={f.id}>
              <label style={{ fontSize: "0.75rem", color: "#5A5A56", display: "block", marginBottom: "0.4rem" }}>{f.label}</label>
              <input type={f.type} placeholder={f.placeholder} value={form[f.id as keyof typeof form]} onChange={(e) => setForm((p) => ({ ...p, [f.id]: e.target.value }))} className="w-full px-4 py-3 rounded-xl outline-none" style={{ border: "1px solid #DDD8CF", background: "#FFFFFF", fontSize: "0.875rem" }} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: "0.75rem", color: "#5A5A56", display: "block", marginBottom: "0.4rem" }}>Mensaje</label>
            <textarea rows={4} placeholder="¿En qué te podemos ayudar?" value={form.msg} onChange={(e) => setForm((p) => ({ ...p, msg: e.target.value }))} className="w-full px-4 py-3 rounded-xl outline-none resize-none" style={{ border: "1px solid #DDD8CF", background: "#FFFFFF", fontSize: "0.875rem" }} />
          </div>
          <button type="submit" className="w-full py-3 rounded-xl font-medium transition-all hover:opacity-80 flex items-center justify-center gap-2" style={{ background: "#25D366", color: "#FFFFFF" }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.116 1.527 5.847L0 24l6.343-1.503A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.817 9.817 0 01-5.003-1.368l-.36-.214-3.727.883.932-3.632-.235-.373A9.818 9.818 0 0112 2.182c5.426 0 9.818 4.392 9.818 9.818 0 5.427-4.392 9.818-9.818 9.818z"/></svg>
            Enviar por WhatsApp
          </button>
        </form>
      </div>
    </section>
  );
}

// ─── Cart Drawer ──────────────────────────────────────────────────────────────
function CartDrawer({ cart, onClose, onRemove, onClear, onConfirm }: { cart: CartItem[]; onClose: () => void; onRemove: (id: number, date: string) => void; onClear: () => void; onConfirm: () => void }) {
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const dates = useMemo(() => getAvailableDates(), []);
  const labelFor = (val: string) => { const d = dates.find((d) => d.value === val); return d ? `${d.dayName} ${d.label}` : val; };
  const grouped = cart.reduce((acc, item) => { const k = item.date; if (!acc[k]) acc[k] = []; acc[k].push(item); return acc; }, {} as Record<string, CartItem[]>);

  const handleConfirm = () => {
    const lines = Object.entries(grouped).map(([date, items]) => {
      const itemsList = items.map((i) => `• ${i.name} x${i.qty} — ${formatPrice(i.price * i.qty)}`).join("\n");
      return `*Entrega ${labelFor(date)}:*\n${itemsList}`;
    }).join("\n\n");
    const msg = `Hola! Quiero hacer el siguiente pedido:\n\n${lines}\n\n*Total: ${formatPrice(total)}*\n\n¿Pueden confirmar disponibilidad?`;
    onConfirm();
    window.open(waLink(msg), "_blank");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onClose} />
      <div className="relative w-full max-w-md h-full flex flex-col" style={{ background: "#FAF7F2" }}>
        <div className="flex items-center justify-between p-6" style={{ borderBottom: "1px solid #DDD8CF" }}>
          <h2 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "1.4rem", color: "#1A1A18" }}>Tu pedido</h2>
          <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors" style={{ color: "#5A5A56" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {cart.length === 0 ? (
            <div className="text-center py-16">
              <div style={{ fontSize: "3rem" }}>🍽️</div>
              <p className="mt-4" style={{ color: "#5A5A56", fontSize: "0.9rem" }}>Tu pedido está vacío</p>
              <button onClick={onClose} className="mt-4 text-sm underline" style={{ color: "#C4622D" }}>Ver el menú</button>
            </div>
          ) : Object.entries(grouped).map(([date, items]) => (
            <div key={date} className="mb-6">
              <p className="mb-3 flex items-center gap-2" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "#5A5A56" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Entrega: {labelFor(date)}
              </p>
              <div className="space-y-2.5">
                {items.map((item) => (
                  <div key={`${item.id}-${date}`} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "#FFFFFF", border: "1px solid #DDD8CF" }}>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: "0.875rem", color: "#1A1A18", fontWeight: 500 }}>{item.name}</p>
                      <p style={{ fontSize: "0.78rem", color: "#C4622D" }}>{formatPrice(item.price)}</p>
                    </div>
                    <button onClick={() => onRemove(item.id, date)} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-red-50 transition-colors" style={{ color: "#5A5A56" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {cart.length > 0 && (
          <div className="p-6" style={{ borderTop: "1px solid #DDD8CF" }}>
            <div className="flex justify-between mb-4">
              <span style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "1rem" }}>Total</span>
              <span style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "1.1rem", color: "#C4622D", fontWeight: 600 }}>{formatPrice(total)}</span>
            </div>
            <button onClick={handleConfirm} className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-medium transition-all hover:opacity-80 mb-3" style={{ background: "#25D366", color: "#FFFFFF", fontSize: "0.9rem" }}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.116 1.527 5.847L0 24l6.343-1.503A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.817 9.817 0 01-5.003-1.368l-.36-.214-3.727.883.932-3.632-.235-.373A9.818 9.818 0 0112 2.182c5.426 0 9.818 4.392 9.818 9.818 0 5.427-4.392 9.818-9.818 9.818z"/></svg>
              Confirmar por WhatsApp
            </button>
            <button onClick={onClear} className="w-full py-2 text-sm transition-colors hover:text-red-600" style={{ color: "#5A5A56" }}>Vaciar pedido</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────
function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pwd });
    setLoading(false);
    if (error) {
      setErr("Email o contraseña incorrectos.");
    } else {
      onLogin();
    }
  };

  return (
    <div className="flex items-center justify-center h-full" style={{ background: "#FAF7F2" }}>
      <div className="w-full max-w-sm p-8 rounded-2xl" style={{ background: "#FFFFFF", border: "1px solid #DDD8CF" }}>
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "#2D4A22" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FAF7F2" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <h2 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "1.4rem", color: "#1A1A18" }}>Panel Admin</h2>
          <p style={{ fontSize: "0.82rem", color: "#5A5A56", marginTop: "0.25rem" }}>{siteConfig.businessName} · Cocina casera</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label style={{ fontSize: "0.75rem", color: "#5A5A56", display: "block", marginBottom: "0.4rem" }}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@laolla.com" className="w-full px-4 py-3 rounded-xl outline-none" style={{ border: `1px solid ${err ? "#C4622D" : "#DDD8CF"}`, background: "#FAF7F2", fontSize: "0.875rem" }} />
          </div>
          <div>
            <label style={{ fontSize: "0.75rem", color: "#5A5A56", display: "block", marginBottom: "0.4rem" }}>Contraseña</label>
            <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="••••••••" className="w-full px-4 py-3 rounded-xl outline-none" style={{ border: `1px solid ${err ? "#C4622D" : "#DDD8CF"}`, background: "#FAF7F2", fontSize: "0.875rem" }} />
            {err && <p style={{ fontSize: "0.75rem", color: "#C4622D", marginTop: "0.3rem" }}>{err}</p>}
          </div>
          <button type="submit" disabled={loading} className="w-full py-3 rounded-xl font-medium transition-all hover:opacity-80 disabled:opacity-60" style={{ background: "#2D4A22", color: "#FAF7F2" }}>
            {loading ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}

type AdminTab = "pedidos" | "estadisticas" | "suscriptores" | "menu" | "planes";

function AdminPanel({ orders, menuItems, subscribers, weeklyPlans, onClose, onMenuUpdate, onToggleAvailability, onToggleVisibility, onReorderMenu, onSubscribersUpdate, onWeeklyPlansUpdate, onOrderDelete, onOrderStatusChange, onOrderAddManual }: {
  orders: Order[];
  menuItems: MenuItem[];
  subscribers: WeeklySubscriber[];
  weeklyPlans: WeeklyPlan[];
  onClose: () => void;
  onMenuUpdate: (items: MenuItem[]) => void;
  onToggleAvailability: (id: number, available: boolean) => void;
  onToggleVisibility: (id: number, visible: boolean) => void;
  onReorderMenu: (id: number, direction: "up" | "down") => void;
  onSubscribersUpdate: (subs: WeeklySubscriber[]) => void;
  onWeeklyPlansUpdate: (plans: WeeklyPlan[]) => void;
  onOrderDelete: (id: string) => void;
  onOrderStatusChange: (id: string, status: Order["status"]) => void;
  onOrderAddManual: (items: { name: string; price: number; qty?: number; date: string }[], total: number, note: string) => void;
}) {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null); // null = todavía verificando
  const [tab, setTab] = useState<AdminTab>("pedidos");
  const [sidebarOpen, setSidebarOpen] = useState(false); // solo relevante en mobile

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setLoggedIn(!!data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setLoggedIn(!!session));
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const tabItems: [AdminTab, string, string][] = [["pedidos", "Pedidos", "📋"], ["estadisticas", "Estadísticas", "📊"], ["planes", "Planes de viandas", "🥘"], ["suscriptores", "Suscriptores", "📆"], ["menu", "Editor de menú", "🍽️"]];
  const currentTabLabel = tabItems.find(([id]) => id === tab)?.[1] ?? "";

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#F5F3EF" }}>
      {/* Admin Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-4 flex-shrink-0" style={{ background: "#2D4A22" }}>
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          {loggedIn && (
            <button onClick={() => setSidebarOpen((v) => !v)} className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.15)" }} aria-label="Abrir menú">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FAF7F2" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
          )}
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 hidden sm:flex" style={{ background: "rgba(255,255,255,0.15)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FAF7F2" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <div className="min-w-0">
            <span style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "1.05rem", color: "#FAF7F2" }}>{loggedIn ? currentTabLabel : "Panel Admin"}</span>
            <span className="hidden sm:inline" style={{ fontSize: "0.7rem", color: "#8FA887", marginLeft: "0.5rem" }}>{siteConfig.businessName}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
          {loggedIn && (
            <button onClick={handleLogout} className="px-2.5 md:px-4 py-1.5 rounded-lg text-xs md:text-sm transition-all hover:bg-white/10 whitespace-nowrap" style={{ color: "#FAF7F2", border: "1px solid rgba(255,255,255,0.2)" }}>
              Cerrar sesión
            </button>
          )}
          <button onClick={onClose} className="px-2.5 md:px-4 py-1.5 rounded-lg text-xs md:text-sm transition-all hover:bg-white/10 whitespace-nowrap" style={{ color: "#FAF7F2", border: "1px solid rgba(255,255,255,0.2)" }}>
            ← Volver
          </button>
        </div>
      </div>

      {loggedIn === null ? (
        <div className="flex items-center justify-center h-full" style={{ color: "#5A5A56", fontSize: "0.85rem" }}>Verificando sesión…</div>
      ) : !loggedIn ? (
        <AdminLogin onLogin={() => setLoggedIn(true)} />
      ) : (
        <div className="flex flex-1 overflow-hidden relative">
          {/* Overlay para cerrar el sidebar tocando afuera, solo en mobile */}
          {sidebarOpen && (
            <div className="md:hidden fixed inset-0 z-10" style={{ background: "rgba(0,0,0,0.3)", top: "60px" }} onClick={() => setSidebarOpen(false)} />
          )}

          {/* Sidebar */}
          <aside
            className={`flex-shrink-0 flex flex-col gap-1 p-4 transition-transform duration-200 md:translate-x-0 md:static md:z-auto fixed top-[60px] bottom-0 left-0 z-20 w-64 md:w-56 overflow-y-auto ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
            style={{ background: "#FFFFFF", borderRight: "1px solid #DDD8CF" }}
          >
            {tabItems.map(([id, label, icon]) => (
              <button key={id} onClick={() => { setTab(id); setSidebarOpen(false); }} className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all w-full" style={{ background: tab === id ? "#2D4A22" : "transparent", color: tab === id ? "#FAF7F2" : "#5A5A56", fontSize: "0.875rem" }}>
                <span>{icon}</span>{label}
                {id === "pedidos" && orders.length > 0 && (
                  <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full" style={{ background: tab === id ? "rgba(255,255,255,0.2)" : "#C4622D", color: "#FAF7F2" }}>{orders.length}</span>
                )}
              </button>
            ))}
          </aside>

          {/* Content */}
          <main className="flex-1 overflow-y-auto p-4 md:p-8">
            {tab === "pedidos" && <AdminOrders orders={orders} menuItems={menuItems} onDelete={onOrderDelete} onStatusChange={onOrderStatusChange} onAddManual={onOrderAddManual} />}
            {tab === "estadisticas" && <AdminStats orders={orders} />}
            {tab === "planes" && <AdminPlans plans={weeklyPlans} onUpdate={onWeeklyPlansUpdate} />}
            {tab === "suscriptores" && <AdminSubscribers subscribers={subscribers} plans={weeklyPlans} onUpdate={onSubscribersUpdate} />}
            {tab === "menu" && <AdminMenu menuItems={menuItems} onUpdate={onMenuUpdate} onToggleAvailability={onToggleAvailability} onToggleVisibility={onToggleVisibility} onReorder={onReorderMenu} />}
          </main>
        </div>
      )}
    </div>
  );
}

function ManualOrderForm({ menuItems, onSave, onCancel }: { menuItems: MenuItem[]; onSave: (items: { name: string; price: number; qty?: number; date: string }[], total: number, note: string) => void; onCancel: () => void }) {
  const dates = useMemo(() => getAvailableDates(), []);
  const [date, setDate] = useState(dates[0]?.value ?? "");
  const [qtyById, setQtyById] = useState<Record<number, number>>({});
  const [note, setNote] = useState("");

  const changeQty = (id: number, delta: number) => setQtyById((prev) => {
    const next = Math.max(0, (prev[id] ?? 0) + delta);
    return { ...prev, [id]: next };
  });

  const selectedEntries = (Object.entries(qtyById) as [string, number][]).filter(([, qty]) => qty > 0);
  const total = selectedEntries.reduce((s, [id, qty]) => s + (menuItems.find((m) => m.id === Number(id))?.price ?? 0) * qty, 0);

  const handleSave = () => {
    if (selectedEntries.length === 0) return;
    const items = selectedEntries.map(([id, qty]) => {
      const m = menuItems.find((mi) => mi.id === Number(id))!;
      return { name: m.name, price: m.price, qty, date };
    });
    onSave(items, total, note);
  };

  return (
    <div className="mb-6 p-6 rounded-2xl" style={{ background: "#FFFFFF", border: "1px solid #DDD8CF" }}>
      <h3 className="mb-4" style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "1.1rem", color: "#1A1A18" }}>Pedido manual</h3>

      <label style={{ fontSize: "0.75rem", color: "#5A5A56", display: "block", marginBottom: "0.4rem" }}>Fecha de entrega</label>
      <select value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 rounded-lg outline-none mb-4" style={{ border: "1px solid #DDD8CF", fontSize: "0.875rem" }}>
        {dates.map((d) => <option key={d.value} value={d.value}>{d.dayName} {d.label}</option>)}
      </select>

      <label style={{ fontSize: "0.75rem", color: "#5A5A56", display: "block", marginBottom: "0.4rem" }}>Platos y cantidad</label>
      <div className="space-y-2 mb-4">
        {menuItems.map((item) => {
          const qty = qtyById[item.id] ?? 0;
          return (
            <div key={item.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ border: qty > 0 ? "1.5px solid #2D4A22" : "1px solid #DDD8CF", background: qty > 0 ? "#F0EBE1" : "#FAF7F2" }}>
              <div>
                <span style={{ fontSize: "0.85rem", color: "#1A1A18" }}>{item.name}</span>
                <span style={{ fontSize: "0.78rem", color: "#C4622D", fontWeight: 500, marginLeft: "0.5rem" }}>{formatPrice(item.price)}</span>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => changeQty(item.id, -1)} disabled={qty === 0} className="w-7 h-7 rounded-full flex items-center justify-center disabled:opacity-30" style={{ border: "1px solid #DDD8CF", color: "#5A5A56" }}>−</button>
                <span style={{ minWidth: "1.2rem", textAlign: "center", fontSize: "0.9rem", color: "#1A1A18" }}>{qty}</span>
                <button onClick={() => changeQty(item.id, 1)} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ border: "1px solid #DDD8CF", color: "#2D4A22" }}>+</button>
              </div>
            </div>
          );
        })}
      </div>

      <label style={{ fontSize: "0.75rem", color: "#5A5A56", display: "block", marginBottom: "0.4rem" }}>Nota (opcional, ej: nombre del cliente)</label>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej: Pedido telefónico de Juana" className="w-full px-3 py-2 rounded-lg outline-none mb-4" style={{ border: "1px solid #DDD8CF", fontSize: "0.875rem" }} />

      <div className="flex items-center justify-between mb-4">
        <span style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "1rem" }}>Total</span>
        <span style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "1.1rem", color: "#C4622D", fontWeight: 600 }}>{formatPrice(total)}</span>
      </div>

      <div className="flex gap-2">
        <button onClick={handleSave} disabled={selectedEntries.length === 0} className="px-5 py-2 rounded-xl font-medium disabled:opacity-50" style={{ background: "#2D4A22", color: "#FAF7F2" }}>Guardar pedido</button>
        <button onClick={onCancel} className="px-5 py-2 rounded-xl transition-all hover:bg-gray-100" style={{ fontSize: "0.875rem", color: "#5A5A56" }}>Cancelar</button>
      </div>
    </div>
  );
}

function AdminStats({ orders }: { orders: Order[] }) {
  const totalFacturado = orders.reduce((s, o) => s + o.total, 0);
  const cantidadPedidos = orders.length;
  const ticketPromedio = cantidadPedidos > 0 ? totalFacturado / cantidadPedidos : 0;

  const porEstado: Record<string, number> = { pendiente: 0, confirmado: 0, entregado: 0 };
  orders.forEach((o) => { porEstado[o.status] = (porEstado[o.status] ?? 0) + 1; });

  const conteoPlatos: Record<string, { count: number; total: number }> = {};
  orders.forEach((o) => {
    o.items.forEach((item) => {
      const qty = item.qty ?? 1;
      if (!conteoPlatos[item.name]) conteoPlatos[item.name] = { count: 0, total: 0 };
      conteoPlatos[item.name].count += qty;
      conteoPlatos[item.name].total += item.price * qty;
    });
  });
  const topPlatos = Object.entries(conteoPlatos).sort((a, b) => b[1].count - a[1].count).slice(0, 5);

  const statCard = (label: string, value: string) => (
    <div className="p-5 rounded-2xl" style={{ background: "#FFFFFF", border: "1px solid #DDD8CF" }}>
      <p style={{ fontSize: "0.75rem", color: "#5A5A56", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
      <p style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "1.6rem", color: "#1A1A18", marginTop: "0.3rem" }}>{value}</p>
    </div>
  );

  return (
    <div>
      <h2 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "1.6rem", color: "#1A1A18", marginBottom: "0.5rem" }}>Estadísticas</h2>
      <p style={{ color: "#5A5A56", fontSize: "0.875rem", marginBottom: "1.5rem" }}>Resumen calculado sobre todos los pedidos cargados (WhatsApp + manuales).</p>

      {orders.length === 0 ? (
        <div className="text-center py-20 rounded-2xl" style={{ background: "#FFFFFF", border: "1px solid #DDD8CF" }}>
          <p style={{ color: "#5A5A56", fontSize: "0.9rem" }}>Todavía no hay pedidos para calcular estadísticas.</p>
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-3 gap-4 mb-4">
            {statCard("Total facturado", formatPrice(totalFacturado))}
            {statCard("Cantidad de pedidos", String(cantidadPedidos))}
            {statCard("Ticket promedio", formatPrice(Math.round(ticketPromedio)))}
          </div>

          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            {(["pendiente", "confirmado", "entregado"] as const).map((s) => statCard(`Pedidos ${s}`, String(porEstado[s] ?? 0)))}
          </div>

          <div className="p-6 rounded-2xl" style={{ background: "#FFFFFF", border: "1px solid #DDD8CF" }}>
            <h3 className="mb-4" style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "1.1rem", color: "#1A1A18" }}>Platos más pedidos</h3>
            {topPlatos.length === 0 ? (
              <p style={{ color: "#5A5A56", fontSize: "0.85rem" }}>Sin datos todavía.</p>
            ) : (
              <div className="space-y-2">
                {topPlatos.map(([name, data], i) => (
                  <div key={name} className="flex items-center justify-between py-2" style={{ borderBottom: i < topPlatos.length - 1 ? "1px solid #F0EBE1" : "none" }}>
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold" style={{ background: "#F0EBE1", color: "#2D4A22" }}>{i + 1}</span>
                      <span style={{ fontSize: "0.9rem", color: "#1A1A18" }}>{name}</span>
                    </div>
                    <div className="text-right">
                      <span style={{ fontSize: "0.85rem", color: "#5A5A56" }}>{data.count} {data.count === 1 ? "unidad" : "unidades"}</span>
                      <span style={{ fontSize: "0.85rem", color: "#C4622D", fontWeight: 600, marginLeft: "0.75rem" }}>{formatPrice(data.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function AdminOrders({ orders, menuItems, onDelete, onStatusChange, onAddManual }: {
  orders: Order[];
  menuItems: MenuItem[];
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: Order["status"]) => void;
  onAddManual: (items: { name: string; price: number; qty?: number; date: string }[], total: number, note: string) => void;
}) {
  const statusColor: Record<string, string> = { pendiente: "#C4622D", confirmado: "#2D4A22", entregado: "#5A5A56" };
  const [showForm, setShowForm] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "1.6rem", color: "#1A1A18" }}>Pedidos recibidos</h2>
        <button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all hover:opacity-80" style={{ background: "#C4622D", color: "#FAF7F2", fontSize: "0.875rem" }}>
          + Agregar pedido manual
        </button>
      </div>
      <p style={{ color: "#5A5A56", fontSize: "0.875rem", marginBottom: "1.5rem" }}>Los pedidos confirmados vía WhatsApp aparecen aquí. También podés cargar o borrar pedidos a mano.</p>

      {showForm && (
        <ManualOrderForm
          menuItems={menuItems}
          onCancel={() => setShowForm(false)}
          onSave={(items, total, note) => { onAddManual(items, total, note); setShowForm(false); }}
        />
      )}

      {orders.length === 0 ? (
        <div className="text-center py-20 rounded-2xl" style={{ background: "#FFFFFF", border: "1px solid #DDD8CF" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📭</div>
          <p style={{ color: "#5A5A56", fontSize: "0.9rem" }}>Aún no hay pedidos.</p>
          <p style={{ color: "#8A8A84", fontSize: "0.78rem", marginTop: "0.5rem" }}>Los pedidos se registran cuando el cliente confirma por WhatsApp, o los podés cargar a mano.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="rounded-2xl p-6" style={{ background: "#FFFFFF", border: "1px solid #DDD8CF" }}>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p style={{ fontSize: "0.75rem", color: "#5A5A56" }}>{order.timestamp}</p>
                  <p style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "1.1rem", color: "#1A1A18" }}>Pedido #{order.id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select value={order.status} onChange={(e) => onStatusChange(order.id, e.target.value as Order["status"])} className="px-2 py-1 rounded-full text-xs font-medium capitalize outline-none" style={{ background: statusColor[order.status] + "20", color: statusColor[order.status], border: "none" }}>
                    <option value="pendiente">pendiente</option>
                    <option value="confirmado">confirmado</option>
                    <option value="entregado">entregado</option>
                  </select>
                  <button onClick={() => { if (confirm("¿Borrar este pedido?")) onDelete(order.id); }} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-red-50" style={{ color: "#C4622D" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                  </button>
                </div>
              </div>
              <div className="space-y-1 mb-4">
                {order.items.map((item, i) => {
                  const qty = item.qty ?? 1; // pedidos viejos no tienen qty guardada, se asume 1
                  return (
                    <div key={i} className="flex justify-between text-sm" style={{ color: "#5A5A56" }}>
                      <span>{item.name} {qty > 1 && <strong style={{ color: "#1A1A18" }}>×{qty}</strong>} <span style={{ fontSize: "0.75rem" }}>· {item.date}</span></span>
                      <span>{formatPrice(item.price * qty)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between pt-3" style={{ borderTop: "1px solid #DDD8CF" }}>
                <span style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "0.95rem" }}>Total</span>
                <span style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "1rem", color: "#C4622D", fontWeight: 600 }}>{formatPrice(order.total)}</span>
              </div>
              {order.note && (
                <div className="mt-3 pt-3" style={{ borderTop: "1px dashed #DDD8CF" }}>
                  <p style={{ fontSize: "0.7rem", color: "#5A5A56", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.2rem" }}>Nota del cliente</p>
                  <p style={{ fontSize: "0.85rem", color: "#1A1A18", fontStyle: "italic" }}>{order.note}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminSubscribers({ subscribers, plans, onUpdate }: { subscribers: WeeklySubscriber[]; plans: WeeklyPlan[]; onUpdate: (s: WeeklySubscriber[]) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", plan: "", address: "", phone: "" });

  const add = () => {
    if (!form.name.trim()) return;
    const newSub: WeeklySubscriber = { id: `s${Date.now()}`, name: form.name, plan: form.plan, address: form.address, phone: form.phone, since: new Date().toISOString().split("T")[0] };
    onUpdate([...subscribers, newSub]);
    setForm({ name: "", plan: "", address: "", phone: "" });
    setShowForm(false);
  };

  const remove = (id: string) => onUpdate(subscribers.filter((s) => s.id !== id));

  const planColors: Record<string, string> = { "Plan Básico": "#2D4A22", "Plan Completo": "#C4622D", "Plan Familiar": "#5A5A56" };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "1.6rem", color: "#1A1A18" }}>Suscriptores semanales</h2>
          <p style={{ color: "#5A5A56", fontSize: "0.875rem" }}>{subscribers.length} {subscribers.length === 1 ? "suscriptor activo" : "suscriptores activos"}</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all hover:opacity-80" style={{ background: "#2D4A22", color: "#FAF7F2", fontSize: "0.875rem" }}>
          + Agregar suscriptor
        </button>
      </div>

      {showForm && (
        <div className="mb-6 p-6 rounded-2xl" style={{ background: "#FFFFFF", border: "1px solid #DDD8CF" }}>
          <h3 className="mb-4" style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "1.1rem", color: "#1A1A18" }}>Nuevo suscriptor</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {[{ key: "name", label: "Nombre *", placeholder: "Nombre completo" }, { key: "phone", label: "Teléfono", placeholder: "+598 09..." }, { key: "address", label: "Dirección", placeholder: "Calle y número" }].map((f) => (
              <div key={f.key}>
                <label style={{ fontSize: "0.75rem", color: "#5A5A56", display: "block", marginBottom: "0.3rem" }}>{f.label}</label>
                <input value={form[f.key as keyof typeof form]} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} className="w-full px-3 py-2 rounded-lg outline-none" style={{ border: "1px solid #DDD8CF", fontSize: "0.875rem" }} />
              </div>
            ))}
            <div>
              <label style={{ fontSize: "0.75rem", color: "#5A5A56", display: "block", marginBottom: "0.3rem" }}>Plan</label>
              <select value={form.plan} onChange={(e) => setForm((p) => ({ ...p, plan: e.target.value }))} className="w-full px-3 py-2 rounded-lg outline-none" style={{ border: "1px solid #DDD8CF", fontSize: "0.875rem" }}>
                <option value="">Elegir plan…</option>
                {plans.map((p) => <option key={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={add} className="px-5 py-2 rounded-xl font-medium transition-all hover:opacity-80" style={{ background: "#2D4A22", color: "#FAF7F2", fontSize: "0.875rem" }}>Guardar</button>
            <button onClick={() => setShowForm(false)} className="px-5 py-2 rounded-xl transition-all hover:bg-gray-100" style={{ fontSize: "0.875rem", color: "#5A5A56" }}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {subscribers.map((sub) => (
          <div key={sub.id} className="flex items-center gap-4 p-5 rounded-2xl" style={{ background: "#FFFFFF", border: "1px solid #DDD8CF" }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold" style={{ background: planColors[sub.plan] ?? "#2D4A22", fontSize: "0.875rem" }}>
              {sub.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "1rem", color: "#1A1A18" }}>{sub.name}</span>
                <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: (planColors[sub.plan] ?? "#2D4A22") + "18", color: planColors[sub.plan] ?? "#2D4A22" }}>{sub.plan}</span>
              </div>
              <div className="flex gap-4 mt-0.5 flex-wrap">
                {sub.phone && <span style={{ fontSize: "0.78rem", color: "#5A5A56" }}>📱 {sub.phone}</span>}
                {sub.address && <span style={{ fontSize: "0.78rem", color: "#5A5A56" }}>📍 {sub.address}</span>}
                <span style={{ fontSize: "0.78rem", color: "#8A8A84" }}>Desde {sub.since}</span>
              </div>
            </div>
            <button onClick={() => remove(sub.id)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-red-50 flex-shrink-0" style={{ color: "#C4622D" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ItemForm({ item, onChange, onSave, onCancel, saveLabel }: { item: Omit<MenuItem, "id"> & { id?: number }; onChange: (f: string, v: string | number) => void; onSave: () => void; onCancel: () => void; saveLabel: string }) {
  const fieldStyle = { border: "1px solid #DDD8CF", fontSize: "0.875rem", borderRadius: "0.5rem", padding: "0.5rem 0.75rem", width: "100%", outline: "none" };
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const url = await uploadMenuImage(file);
      onChange("img", url);
    } catch (err) {
      console.error(err);
      const detail = err instanceof Error ? err.message : String(err);
      setUploadError(`No se pudo subir la imagen: ${detail}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-5 rounded-xl mt-3" style={{ background: "#FAF7F2", border: "1px solid #DDD8CF" }}>
      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        {[{ key: "name", label: "Nombre del plato", type: "text" }, { key: "desc", label: "Descripción", type: "text" }].map((f) => (
          <div key={f.key}>
            <label style={{ fontSize: "0.72rem", color: "#5A5A56", display: "block", marginBottom: "0.25rem" }}>{f.label}</label>
            <input type={f.type} value={String((item as Record<string, unknown>)[f.key] ?? "")} onChange={(e) => onChange(f.key, e.target.value)} style={fieldStyle} />
          </div>
        ))}
        <div>
          <label style={{ fontSize: "0.72rem", color: "#5A5A56", display: "block", marginBottom: "0.25rem" }}>Precio ($)</label>
          <input type="number" value={item.price} onChange={(e) => onChange("price", Number(e.target.value))} style={fieldStyle} />
        </div>
        <div>
          <label style={{ fontSize: "0.72rem", color: "#5A5A56", display: "block", marginBottom: "0.25rem" }}>Categoría</label>
          <select value={item.category} onChange={(e) => onChange("category", e.target.value)} style={fieldStyle}>
            {["entrada", "principal", "postre"].map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label style={{ fontSize: "0.72rem", color: "#5A5A56", display: "block", marginBottom: "0.25rem" }}>Foto del plato</label>
          <input type="file" accept="image/*" onChange={handleFileChange} disabled={uploading} style={{ fontSize: "0.8rem" }} />
          {uploading && <p style={{ fontSize: "0.75rem", color: "#5A5A56", marginTop: "0.25rem" }}>Subiendo imagen…</p>}
          {uploadError && <p style={{ fontSize: "0.75rem", color: "#C4622D", marginTop: "0.25rem" }}>{uploadError}</p>}
        </div>
      </div>
      {item.img && (
        <div className="mb-3 h-28 rounded-lg overflow-hidden" style={{ background: "#E8E3D8" }}>
          <img src={item.img} alt="preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={onSave} disabled={uploading} className="px-4 py-2 rounded-lg font-medium text-sm hover:opacity-80 disabled:opacity-50" style={{ background: "#2D4A22", color: "#FAF7F2" }}>{saveLabel}</button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm hover:bg-gray-100" style={{ color: "#5A5A56" }}>Cancelar</button>
      </div>
    </div>
  );
}

function AdminMenu({ menuItems, onUpdate, onToggleAvailability, onToggleVisibility, onReorder }: { menuItems: MenuItem[]; onUpdate: (items: MenuItem[]) => void; onToggleAvailability: (id: number, available: boolean) => void; onToggleVisibility: (id: number, visible: boolean) => void; onReorder: (id: number, direction: "up" | "down") => void }) {
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [showNew, setShowNew] = useState(false);
  const nextSortOrder = () => (menuItems.length > 0 ? Math.max(...menuItems.map((m) => m.sortOrder)) + 1 : 1);
  const [newItem, setNewItem] = useState<Omit<MenuItem, "id">>({ name: "", desc: "", price: 0, category: "principal", img: "", tags: [], available: true, visible: true, sortOrder: nextSortOrder() });

  const saveEdit = () => {
    if (!editing) return;
    onUpdate(menuItems.map((m) => m.id === editing.id ? editing : m));
    setEditing(null);
  };

  const deleteItem = (id: number) => onUpdate(menuItems.filter((m) => m.id !== id));

  const addNew = () => {
    if (!newItem.name.trim()) return;
    const item: MenuItem = { ...newItem, id: Date.now(), tags: newItem.tags, sortOrder: nextSortOrder() };
    onUpdate([...menuItems, item]);
    setNewItem({ name: "", desc: "", price: 0, category: "principal", img: "", tags: [], available: true, visible: true, sortOrder: nextSortOrder() });
    setShowNew(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "1.6rem", color: "#1A1A18" }}>Editor de menú</h2>
          <p style={{ color: "#5A5A56", fontSize: "0.875rem" }}>{menuItems.length} platos en el menú actual</p>
        </div>
        <button onClick={() => { setShowNew((v) => !v); setEditing(null); }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all hover:opacity-80" style={{ background: "#C4622D", color: "#FAF7F2", fontSize: "0.875rem" }}>
          + Agregar plato
        </button>
      </div>

      {showNew && (
        <div className="mb-6 p-6 rounded-2xl" style={{ background: "#FFFFFF", border: "1px solid #DDD8CF" }}>
          <h3 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "1.1rem", color: "#1A1A18", marginBottom: "0.5rem" }}>Nuevo plato</h3>
          <ItemForm item={newItem} onChange={(f, v) => setNewItem((p) => ({ ...p, [f]: v }))} onSave={addNew} onCancel={() => setShowNew(false)} saveLabel="Agregar al menú" />
        </div>
      )}

      <div className="space-y-3">
        {menuItems.map((item, idx) => (
          <div key={item.id} className="rounded-2xl overflow-hidden" style={{ background: "#FFFFFF", border: item.available ? "1px solid #DDD8CF" : "1px solid #E8B8A0", opacity: item.visible ? (item.available ? 1 : 0.75) : 0.5 }}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4">
              <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button onClick={() => onReorder(item.id, "up")} disabled={idx === 0} className="w-6 h-6 rounded flex items-center justify-center disabled:opacity-25 hover:bg-gray-100" style={{ color: "#5A5A56" }} aria-label="Mover arriba">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15"/></svg>
                  </button>
                  <button onClick={() => onReorder(item.id, "down")} disabled={idx === menuItems.length - 1} className="w-6 h-6 rounded flex items-center justify-center disabled:opacity-25 hover:bg-gray-100" style={{ color: "#5A5A56" }} aria-label="Mover abajo">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                </div>
                <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0" style={{ background: "#E8E3D8" }}>
                  <img src={item.img} alt={item.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "1rem", color: "#1A1A18" }}>{item.name}</span>
                    <span className="text-xs capitalize px-2 py-0.5 rounded-full" style={{ background: "#F0EBE1", color: "#5A5A56" }}>{item.category}</span>
                    {!item.available && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#C4622D20", color: "#C4622D" }}>Agotado</span>}
                    {!item.visible && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#5A5A5620", color: "#5A5A56" }}>Oculto</span>}
                  </div>
                  <p style={{ fontSize: "0.8rem", color: "#5A5A56" }}>{item.desc}</p>
                  <p style={{ fontSize: "0.85rem", color: "#C4622D", fontWeight: 600, marginTop: "0.2rem" }}>{formatPrice(item.price)}</p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap sm:flex-nowrap sm:flex-shrink-0">
                <button onClick={() => onToggleVisibility(item.id, !item.visible)} className="px-3 py-1.5 rounded-lg text-sm transition-all hover:opacity-80" style={{ color: item.visible ? "#5A5A56" : "#2D4A22", border: `1px solid ${item.visible ? "#DDD8CF" : "#2D4A22"}` }}>
                  {item.visible ? "Ocultar" : "Mostrar"}
                </button>
                <button onClick={() => onToggleAvailability(item.id, !item.available)} className="px-3 py-1.5 rounded-lg text-sm transition-all hover:opacity-80" style={{ color: item.available ? "#C4622D" : "#2D4A22", border: `1px solid ${item.available ? "#C4622D" : "#2D4A22"}` }}>
                  {item.available ? "Marcar agotado" : "Marcar disponible"}
                </button>
                <button onClick={() => { setEditing(editing?.id === item.id ? null : { ...item }); setShowNew(false); }} className="px-3 py-1.5 rounded-lg text-sm transition-all hover:bg-gray-100" style={{ color: "#2D4A22", border: "1px solid #DDD8CF" }}>
                  {editing?.id === item.id ? "Cerrar" : "Editar"}
                </button>
                <button onClick={() => deleteItem(item.id)} className="px-3 py-1.5 rounded-lg text-sm transition-all hover:bg-red-50" style={{ color: "#C4622D", border: "1px solid #DDD8CF" }}>Borrar</button>
              </div>
            </div>
            {editing?.id === item.id && (
              <div className="px-4 pb-4">
                <ItemForm item={editing} onChange={(f, v) => setEditing((p) => p ? { ...p, [f]: v } : p)} onSave={saveEdit} onCancel={() => setEditing(null)} saveLabel="Guardar cambios" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Admin: Planes de viandas ────────────────────────────────────────────────
function PlanForm({ plan, onChange, onSave, onCancel, saveLabel }: { plan: Omit<WeeklyPlan, "id"> & { id?: number }; onChange: (f: string, v: string | number | boolean | string[]) => void; onSave: () => void; onCancel: () => void; saveLabel: string }) {
  const fieldStyle = { border: "1px solid #DDD8CF", fontSize: "0.875rem", borderRadius: "0.5rem", padding: "0.5rem 0.75rem", width: "100%", outline: "none" };
  const includesText = plan.includes.join("\n");

  return (
    <div className="p-5 rounded-xl mt-3" style={{ background: "#FAF7F2", border: "1px solid #DDD8CF" }}>
      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label style={{ fontSize: "0.72rem", color: "#5A5A56", display: "block", marginBottom: "0.25rem" }}>Nombre del plan</label>
          <input value={plan.name} onChange={(e) => onChange("name", e.target.value)} style={fieldStyle} />
        </div>
        <div>
          <label style={{ fontSize: "0.72rem", color: "#5A5A56", display: "block", marginBottom: "0.25rem" }}>Descripción corta</label>
          <input value={plan.desc} onChange={(e) => onChange("desc", e.target.value)} style={fieldStyle} />
        </div>
        <div>
          <label style={{ fontSize: "0.72rem", color: "#5A5A56", display: "block", marginBottom: "0.25rem" }}>Precio por semana ($)</label>
          <input type="number" value={plan.price} onChange={(e) => onChange("price", Number(e.target.value))} style={fieldStyle} />
        </div>
        <div className="flex items-center gap-2 mt-5">
          <input type="checkbox" id="highlight" checked={plan.highlight} onChange={(e) => onChange("highlight", e.target.checked)} />
          <label htmlFor="highlight" style={{ fontSize: "0.82rem", color: "#5A5A56" }}>Marcar como "Más popular"</label>
        </div>
        <div className="sm:col-span-2">
          <label style={{ fontSize: "0.72rem", color: "#5A5A56", display: "block", marginBottom: "0.25rem" }}>Qué incluye (una línea por ítem)</label>
          <textarea rows={4} value={includesText} onChange={(e) => onChange("includes", e.target.value.split("\n"))} style={{ ...fieldStyle, resize: "vertical" }} placeholder={"1 principal por día\nPan casero incluido"} />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onSave} className="px-4 py-2 rounded-lg font-medium text-sm hover:opacity-80" style={{ background: "#2D4A22", color: "#FAF7F2" }}>{saveLabel}</button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm hover:bg-gray-100" style={{ color: "#5A5A56" }}>Cancelar</button>
      </div>
    </div>
  );
}

function AdminPlans({ plans, onUpdate }: { plans: WeeklyPlan[]; onUpdate: (plans: WeeklyPlan[]) => void }) {
  const [editing, setEditing] = useState<WeeklyPlan | null>(null);
  const [showNew, setShowNew] = useState(false);
  const blankPlan: Omit<WeeklyPlan, "id"> = { name: "", desc: "", price: 0, includes: [], highlight: false, bgColor: "#F0EBE1", accentColor: "#2D4A22", sortOrder: plans.length + 1 };
  const [newPlan, setNewPlan] = useState<Omit<WeeklyPlan, "id">>(blankPlan);

  const saveEdit = () => {
    if (!editing) return;
    onUpdate(plans.map((p) => p.id === editing.id ? editing : p));
    setEditing(null);
  };

  const deletePlan = (id: number) => {
    if (confirm("¿Borrar este plan?")) onUpdate(plans.filter((p) => p.id !== id));
  };

  const addNew = () => {
    if (!newPlan.name.trim()) return;
    const plan: WeeklyPlan = { ...newPlan, id: Date.now() };
    onUpdate([...plans, plan]);
    setNewPlan(blankPlan);
    setShowNew(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "1.6rem", color: "#1A1A18" }}>Planes de viandas semanales</h2>
          <p style={{ color: "#5A5A56", fontSize: "0.875rem" }}>{plans.length} {plans.length === 1 ? "plan activo" : "planes activos"}</p>
        </div>
        <button onClick={() => { setShowNew((v) => !v); setEditing(null); }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all hover:opacity-80" style={{ background: "#C4622D", color: "#FAF7F2", fontSize: "0.875rem" }}>
          + Agregar plan
        </button>
      </div>

      {showNew && (
        <div className="mb-6 p-6 rounded-2xl" style={{ background: "#FFFFFF", border: "1px solid #DDD8CF" }}>
          <h3 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "1.1rem", color: "#1A1A18", marginBottom: "0.5rem" }}>Nuevo plan</h3>
          <PlanForm plan={newPlan} onChange={(f, v) => setNewPlan((p) => ({ ...p, [f]: v }))} onSave={addNew} onCancel={() => setShowNew(false)} saveLabel="Agregar plan" />
        </div>
      )}

      <div className="space-y-3">
        {plans.map((plan) => (
          <div key={plan.id} className="rounded-2xl overflow-hidden" style={{ background: "#FFFFFF", border: "1px solid #DDD8CF" }}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "1rem", color: "#1A1A18" }}>{plan.name}</span>
                  {plan.highlight && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#C4622D20", color: "#C4622D" }}>Más popular</span>}
                </div>
                <p style={{ fontSize: "0.8rem", color: "#5A5A56" }}>{plan.desc}</p>
                <p style={{ fontSize: "0.85rem", color: "#C4622D", fontWeight: 600, marginTop: "0.2rem" }}>{formatPrice(plan.price)}/semana · {plan.includes.length} ítems incluidos</p>
              </div>
              <div className="flex gap-2 sm:flex-shrink-0">
                <button onClick={() => { setEditing(editing?.id === plan.id ? null : { ...plan }); setShowNew(false); }} className="px-3 py-1.5 rounded-lg text-sm transition-all hover:bg-gray-100" style={{ color: "#2D4A22", border: "1px solid #DDD8CF" }}>
                  {editing?.id === plan.id ? "Cerrar" : "Editar"}
                </button>
                <button onClick={() => deletePlan(plan.id)} className="px-3 py-1.5 rounded-lg text-sm transition-all hover:bg-red-50" style={{ color: "#C4622D", border: "1px solid #DDD8CF" }}>Borrar</button>
              </div>
            </div>
            {editing?.id === plan.id && (
              <div className="px-4 pb-4">
                <PlanForm plan={editing} onChange={(f, v) => setEditing((p) => p ? { ...p, [f]: v } as WeeklyPlan : p)} onSave={saveEdit} onCancel={() => setEditing(null)} saveLabel="Guardar cambios" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer({ onAdminClick }: { onAdminClick: () => void }) {
  return (
    <footer className="py-12 px-6" style={{ background: "#2D4A22" }}>
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <p style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "1.2rem", color: "#FAF7F2" }}>{siteConfig.businessName}</p>
          <p style={{ fontSize: "0.75rem", color: "#8FA887", marginTop: "0.2rem" }}>{siteConfig.footerTagline}</p>
        </div>
        <p style={{ fontSize: "0.78rem", color: "#8FA887" }}>Hecho con amor y buenos ingredientes · {new Date().getFullYear()}</p>
        <button onClick={onAdminClick} className="text-xs transition-colors hover:text-white" style={{ color: "#8FA887" }}>
          Administrador
        </button>
      </div>
    </footer>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderNote, setOrderNote] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [subscribers, setSubscribers] = useState<WeeklySubscriber[]>([]);
  const [weeklyPlans, setWeeklyPlans] = useState<WeeklyPlan[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Cargar menú, pedidos, suscriptores y planes desde Supabase al abrir la página
  useEffect(() => {
    (async () => {
      try {
        const [menu, ords, subs, plans] = await Promise.all([fetchMenuItems(), fetchOrders(), fetchSubscribers(), fetchWeeklyPlans()]);
        setMenuItems(menu);
        setOrders(ords);
        setSubscribers(subs);
        setWeeklyPlans(plans);
      } catch (err) {
        console.error(err);
        setLoadError("No se pudo conectar con la base de datos. Revisá tu archivo .env y que las tablas existan en Supabase.");
      } finally {
        setLoadingData(false);
      }
    })();
  }, []);

  const handleMenuUpdate = async (next: MenuItem[]) => {
    const prev = menuItems;
    setMenuItems(next); // actualiza la UI al instante
    try {
      const synced = await syncMenuItems(prev, next);
      setMenuItems(synced); // reemplaza con los ids reales de la base de datos
    } catch (err) {
      console.error(err);
      setMenuItems(prev); // si falló, volvemos atrás
      alert("No se pudo guardar el cambio en el menú. Intentá de nuevo.");
    }
  };

  const handleToggleAvailability = async (id: number, available: boolean) => {
    const prev = menuItems;
    setMenuItems((p) => p.map((m) => m.id === id ? { ...m, available } : m)); // instantáneo
    try {
      await toggleMenuItemAvailability(id, available);
    } catch (err) {
      console.error(err);
      setMenuItems(prev);
      alert("No se pudo actualizar la disponibilidad. Intentá de nuevo.");
    }
  };

  const handleToggleVisibility = async (id: number, visible: boolean) => {
    const prev = menuItems;
    setMenuItems((p) => p.map((m) => m.id === id ? { ...m, visible } : m)); // instantáneo
    try {
      await toggleMenuItemVisibility(id, visible);
    } catch (err) {
      console.error(err);
      setMenuItems(prev);
      alert("No se pudo actualizar la visibilidad. Intentá de nuevo.");
    }
  };

  const handleReorderMenu = async (id: number, direction: "up" | "down") => {
    const prev = menuItems;
    const idx = prev.findIndex((m) => m.id === id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (idx === -1 || swapIdx < 0 || swapIdx >= prev.length) return;

    const a = prev[idx];
    const b = prev[swapIdx];
    const next = [...prev];
    next[idx] = { ...b, sortOrder: a.sortOrder };
    next[swapIdx] = { ...a, sortOrder: b.sortOrder };
    next.sort((x, y) => x.sortOrder - y.sortOrder);
    setMenuItems(next); // instantáneo

    try {
      await Promise.all([reorderMenuItem(a.id, b.sortOrder), reorderMenuItem(b.id, a.sortOrder)]);
    } catch (err) {
      console.error(err);
      setMenuItems(prev);
      alert("No se pudo reordenar el menú. Intentá de nuevo.");
    }
  };

  const handleSubscribersUpdate = async (next: WeeklySubscriber[]) => {
    const prev = subscribers;
    setSubscribers(next);
    try {
      const synced = await syncSubscribers(prev, next);
      setSubscribers(synced);
    } catch (err) {
      console.error(err);
      setSubscribers(prev);
      alert("No se pudo guardar el cambio en los suscriptores. Intentá de nuevo.");
    }
  };

  const handleWeeklyPlansUpdate = async (next: WeeklyPlan[]) => {
    const prev = weeklyPlans;
    setWeeklyPlans(next);
    try {
      const synced = await syncWeeklyPlans(prev, next);
      setWeeklyPlans(synced);
    } catch (err) {
      console.error(err);
      setWeeklyPlans(prev);
      alert("No se pudo guardar el cambio en los planes. Intentá de nuevo.");
    }
  };

  const addToCart = (item: MenuItem, date: string) => {
    setCart((prev) => {
      const ex = prev.find((c) => c.id === item.id && c.date === date);
      if (ex) return prev.map((c) => c.id === item.id && c.date === date ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { id: item.id, name: item.name, price: item.price, qty: 1, date }];
    });
  };

  const removeFromCart = (id: number, date: string) => setCart((prev) => prev.filter((c) => !(c.id === id && c.date === date)));

  const confirmOrder = async () => {
    if (cart.length === 0) return;
    const items = cart.map((c) => ({ name: c.name, price: c.price, qty: c.qty, date: c.date }));
    const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
    try {
      const updated = await createOrder(items, total, orderNote);
      setOrders(updated);
      setCart([]);
      setOrderNote("");
    } catch (err) {
      console.error(err);
      alert("No se pudo registrar el pedido en la base de datos. El mensaje de WhatsApp se envía igual, pero avisale al admin.");
      setCart([]);
      setOrderNote("");
    }
  };

  const handleOrderDelete = async (id: string) => {
    try {
      setOrders(await deleteOrder(id));
    } catch (err) {
      console.error(err);
      alert("No se pudo borrar el pedido. Intentá de nuevo.");
    }
  };

  const handleOrderStatusChange = async (id: string, status: Order["status"]) => {
    const prev = orders;
    setOrders((p) => p.map((o) => o.id === id ? { ...o, status } : o)); // actualiza la UI al instante
    try {
      setOrders(await updateOrderStatus(id, status));
    } catch (err) {
      console.error(err);
      setOrders(prev);
      alert("No se pudo actualizar el estado del pedido. Intentá de nuevo.");
    }
  };

  const handleOrderAddManual = async (items: { name: string; price: number; qty?: number; date: string }[], total: number, note: string) => {
    try {
      setOrders(await createOrder(items, total, note));
    } catch (err) {
      console.error(err);
      alert("No se pudo guardar el pedido manual. Intentá de nuevo.");
    }
  };

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  // Lock scroll when admin or drawer is open
  useEffect(() => {
    document.body.style.overflow = adminOpen || drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [adminOpen, drawerOpen]);

  if (loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#FAF7F2" }}>
        <p style={{ color: "#5A5A56", fontSize: "0.9rem" }}>Cargando {siteConfig.businessName}…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#FAF7F2" }}>
        <div className="max-w-md text-center p-8 rounded-2xl" style={{ background: "#FFFFFF", border: "1px solid #DDD8CF" }}>
          <p style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>⚠️</p>
          <p style={{ color: "#1A1A18", fontWeight: 500, marginBottom: "0.5rem" }}>No pudimos cargar los datos</p>
          <p style={{ color: "#5A5A56", fontSize: "0.85rem" }}>{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Nav cartCount={cartCount} onCartClick={() => setDrawerOpen(true)} onAdminClick={() => setAdminOpen(true)} />
      <Hero />
      <MenuSection menuItems={menuItems} onAdd={addToCart} />
      <OrderSection menuItems={menuItems} onAdd={addToCart} note={orderNote} onNoteChange={setOrderNote} />
      <ViandasSection plans={weeklyPlans} />
      <GallerySection />
      <ContactSection />
      <Footer onAdminClick={() => setAdminOpen(true)} />

      {drawerOpen && (
        <CartDrawer cart={cart} onClose={() => setDrawerOpen(false)} onRemove={removeFromCart} onClear={() => setCart([])} onConfirm={confirmOrder} />
      )}

      {adminOpen && (
        <AdminPanel
          orders={orders}
          menuItems={menuItems}
          subscribers={subscribers}
          weeklyPlans={weeklyPlans}
          onClose={() => setAdminOpen(false)}
          onMenuUpdate={handleMenuUpdate}
          onToggleAvailability={handleToggleAvailability}
          onToggleVisibility={handleToggleVisibility}
          onReorderMenu={handleReorderMenu}
          onSubscribersUpdate={handleSubscribersUpdate}
          onWeeklyPlansUpdate={handleWeeklyPlansUpdate}
          onOrderDelete={handleOrderDelete}
          onOrderStatusChange={handleOrderStatusChange}
          onOrderAddManual={handleOrderAddManual}
        />
      )}
    </div>
  );
}
