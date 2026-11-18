'use strict';

/* ---------- Config ---------- */
const CURRENCY = 'USD'; // change to 'UGX', 'KES', etc.
const STORAGE_KEY = 'kestrel-hotel-v1';
const ROOM_PRICES = { Single: 60, Double: 90, Deluxe: 140, Suite: 250 };

/* ---------- Helpers ---------- */
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: CURRENCY, maximumFractionDigits: 0 }).format(n);
const iso = (d) => d.toISOString().slice(0, 10);
const shift = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return iso(d); };
const today = () => shift(0);
const nights = (a, b) => Math.max(1, Math.round((new Date(b) - new Date(a)) / 864e5));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------- State ---------- */
function seed() {
  const types = ['Single', 'Single', 'Double', 'Double', 'Double', 'Deluxe', 'Deluxe', 'Suite'];
  const rooms = Array.from({ length: 12 }, (_, i) => {
    const type = types[i % types.length];
    return { id: i + 1, number: 101 + i, type, price: ROOM_PRICES[type], status: 'available' };
  });
  const make = (id, guest, phone, roomId, inDay, outDay, status) => {
    const room = rooms.find((r) => r.id === roomId);
    const checkIn = shift(inDay), checkOut = shift(outDay);
    return { id, guest, phone, roomId, checkIn, checkOut, status, total: nights(checkIn, checkOut) * room.price };
  };
  const bookings = [
    make(1, 'Amina Okello', '+256 700 123 456', 3, -1, 2, 'checked-in'),
    make(2, 'Daniel Mugisha', '+256 772 987 654', 6, -2, 1, 'checked-in'),
    make(3, 'Grace Namukasa', '+256 755 321 098', 8, 0, 3, 'reserved'),
    make(4, 'Peter Kamau', '+254 711 456 789', 2, 1, 4, 'reserved'),
    make(5, 'Sofia Martins', '', 5, -4, -1, 'checked-out'),
  ];
  rooms.find((r) => r.id === 3).status = 'occupied';
  rooms.find((r) => r.id === 6).status = 'occupied';
  rooms.find((r) => r.id === 5).status = 'cleaning';
  return { rooms, bookings, nextId: 6 };
}

let state;
try { state = JSON.parse(localStorage.getItem(STORAGE_KEY)) || seed(); } catch { state = seed(); }
const save = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage unavailable */ } };

let currentView = 'dashboard';
let roomFilter = 'all';
const roomOf = (id) => state.rooms.find((r) => r.id === Number(id));
const query = () => $('#search').value.trim().toLowerCase();

/* ---------- Rendering ---------- */
const table = (heads, rows) => rows.length
  ? `<table><thead><tr>${heads.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`
  : '<p class="empty">Nothing here yet. Add a booking to get started.</p>';

function actionButtons(b) {
  if (b.status === 'reserved') return `<button class="btn small primary" data-action="checkin" data-id="${b.id}">Check in</button><button class="btn small danger" data-action="cancel" data-id="${b.id}">Cancel</button>`;
  if (b.status === 'checked-in') return `<button class="btn small" data-action="checkout" data-id="${b.id}">Check out</button>`;
  return '';
}

function bookingRow(b, withActions = true) {
  const r = roomOf(b.roomId);
  return `<tr>
    <td><strong>${esc(b.guest)}</strong><small>${esc(b.phone || 'No phone')}</small></td>
    <td>Room ${r.number}<small>${r.type}</small></td>
    <td>${b.checkIn} to ${b.checkOut}<small>${nights(b.checkIn, b.checkOut)} night(s)</small></td>
    <td>${fmt(b.total)}</td>
    <td><span class="badge ${b.status}">${cap(b.status.replace('-', ' '))}</span></td>
    ${withActions ? `<td><div class="row-actions">${actionButtons(b)}</div></td>` : ''}
  </tr>`;
}

const filteredBookings = () => {
  const q = query();
  return state.bookings
    .filter((b) => !q || b.guest.toLowerCase().includes(q) || String(roomOf(b.roomId).number).includes(q))
    .sort((a, b) => b.id - a.id);
};

function renderDashboard() {
  const total = state.rooms.length;
  const count = (s) => state.rooms.filter((r) => r.status === s).length;
  const occupied = count('occupied'), available = count('available'), cleaning = count('cleaning');
  const arrivals = state.bookings.filter((b) => b.status === 'reserved' && b.checkIn === today()).length;
  const revenue = state.bookings.filter((b) => b.status !== 'reserved').reduce((sum, b) => sum + b.total, 0);

  $('#stats').innerHTML = `
    <div class="stat lead"><span>Occupancy</span><strong>${Math.round((occupied / total) * 100)}%</strong></div>
    <div class="stat"><span>Rooms available</span><strong>${available}</strong></div>
    <div class="stat"><span>Arrivals today</span><strong>${arrivals}</strong></div>
    <div class="stat"><span>Revenue from stays</span><strong>${fmt(revenue)}</strong></div>`;

  const parts = [['Available', available, 'var(--green)'], ['Occupied', occupied, 'var(--blue)'], ['Cleaning', cleaning, 'var(--amber)']];
  $('#statusbar').innerHTML = parts.map(([, n, c]) => `<div style="width:${(n / total) * 100}%;background:${c}"></div>`).join('');
  $('#legend').innerHTML = parts.map(([l, n, c]) => `<span><i class="dot" style="background:${c}"></i>${l}: ${n}</span>`).join('');

  $('#dashTable').innerHTML = table(['Guest', 'Room', 'Stay', 'Total', 'Status'], filteredBookings().slice(0, 5).map((b) => bookingRow(b, false)));
}

function renderRooms() {
  const filters = ['all', 'available', 'occupied', 'cleaning'];
  $('#roomFilters').innerHTML = filters.map((f) => `<button class="chip ${f === roomFilter ? 'active' : ''}" data-filter="${f}">${cap(f)}</button>`).join('');
  const q = query();
  const list = state.rooms.filter((r) => (roomFilter === 'all' || r.status === roomFilter) && (!q || String(r.number).includes(q) || r.type.toLowerCase().includes(q)));
  $('#roomGrid').innerHTML = list.map((r) => `
    <article class="room ${r.status}">
      <div class="room-top"><div class="room-number">${r.number}</div><span class="badge ${r.status}">${cap(r.status)}</span></div>
      <p>${r.type} room</p>
      <div class="room-bottom">
        <strong>${fmt(r.price)}<small> / night</small></strong>
        ${r.status === 'available' ? `<button class="btn small primary" data-action="book" data-id="${r.id}">Book</button>` : ''}
        ${r.status === 'cleaning' ? `<button class="btn small" data-action="clean" data-id="${r.id}">Mark clean</button>` : ''}
      </div>
    </article>`).join('') || '<p class="empty">No rooms match.</p>';
}

function renderBookings() {
  $('#bookingTable').innerHTML = table(['Guest', 'Room', 'Stay', 'Total', 'Status', 'Actions'], filteredBookings().map((b) => bookingRow(b)));
}

function renderGuests() {
  const q = query();
  const guests = {};
  state.bookings.forEach((b) => {
    const g = guests[b.guest] ||= { name: b.guest, phone: b.phone, stays: 0, spent: 0, last: '' };
    g.stays++; g.spent += b.total; g.phone = g.phone || b.phone;
    if (b.checkIn > g.last) g.last = b.checkIn;
  });
  const rows = Object.values(guests)
    .filter((g) => !q || g.name.toLowerCase().includes(q))
    .map((g) => `<tr><td><strong>${esc(g.name)}</strong></td><td>${esc(g.phone || 'No phone')}</td><td>${g.stays}</td><td>${fmt(g.spent)}</td><td>${g.last}</td></tr>`);
  $('#guestTable').innerHTML = table(['Guest', 'Phone', 'Stays', 'Total spent', 'Last arrival'], rows);
}

function render() {
  renderDashboard(); renderRooms(); renderBookings(); renderGuests();
}

/* ---------- Navigation ---------- */
function showView(name) {
  currentView = name;
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
  $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  $('#viewTitle').textContent = cap(name);
}

/* ---------- Booking modal ---------- */
const modal = $('#modal'), form = $('#bookingForm');
const isFree = (roomId, inDate, outDate) => !state.bookings.some((b) =>
  b.roomId === roomId && b.status !== 'checked-out' && b.checkIn < outDate && inDate < b.checkOut);

function refreshRoomOptions(selected) {
  const keep = selected ?? Number($('#roomSelect').value);
  const free = state.rooms.filter((r) => isFree(r.id, $('#checkIn').value, $('#checkOut').value));
  $('#roomSelect').innerHTML = free.length
    ? free.map((r) => `<option value="${r.id}" ${r.id === keep ? 'selected' : ''}>Room ${r.number}, ${r.type} (${fmt(r.price)})</option>`).join('')
    : '<option value="">No rooms free for these dates</option>';
  updateTotal();
}

function updateTotal() {
  const room = roomOf($('#roomSelect').value);
  const inD = $('#checkIn').value, outD = $('#checkOut').value;
  $('#totalLabel').textContent = room && outD > inD ? `Total: ${fmt(nights(inD, outD) * room.price)} for ${nights(inD, outD)} night(s)` : 'Choose valid dates and a room';
}

function openModal(roomId) {
  form.reset();
  $('#checkIn').value = today();
  $('#checkOut').value = shift(1);
  refreshRoomOptions(roomId ? Number(roomId) : null);
  modal.hidden = false;
  form.guest.focus();
}
const closeModal = () => { modal.hidden = true; };

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const room = roomOf(data.get('room'));
  const checkIn = data.get('checkIn'), checkOut = data.get('checkOut');
  if (!room) return toast('Pick an available room first');
  if (checkOut <= checkIn) return toast('Check-out must be after check-in');
  state.bookings.push({
    id: state.nextId++, guest: data.get('guest').trim(), phone: data.get('phone').trim(),
    roomId: room.id, checkIn, checkOut, status: 'reserved', total: nights(checkIn, checkOut) * room.price,
  });
  save(); render(); closeModal();
  toast(`Booking saved for ${data.get('guest').trim()}`);
});

['#checkIn', '#checkOut'].forEach((s) => $(s).addEventListener('change', () => refreshRoomOptions()));
$('#roomSelect').addEventListener('change', updateTotal);
$('#cancelModal').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

/* ---------- Actions ---------- */
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2400);
}

document.addEventListener('click', (e) => {
  const nav = e.target.closest('[data-view]');
  if (nav) return showView(nav.dataset.view);

  const chip = e.target.closest('[data-filter]');
  if (chip) { roomFilter = chip.dataset.filter; return renderRooms(); }

  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const id = Number(btn.dataset.id);
  const booking = state.bookings.find((b) => b.id === id);

  switch (btn.dataset.action) {
    case 'book': return openModal(id);
    case 'clean': roomOf(id).status = 'available'; toast('Room is ready for guests'); break;
    case 'checkin':
      if (roomOf(booking.roomId).status !== 'available') return toast('That room is not ready yet');
      booking.status = 'checked-in'; roomOf(booking.roomId).status = 'occupied';
      toast(`${booking.guest} checked in`); break;
    case 'checkout':
      booking.status = 'checked-out'; roomOf(booking.roomId).status = 'cleaning';
      toast(`${booking.guest} checked out. Room needs cleaning`); break;
    case 'cancel':
      state.bookings = state.bookings.filter((b) => b.id !== id);
      toast('Booking cancelled'); break;
  }
  save(); render();
});

$('#newBooking').addEventListener('click', () => openModal());
$('#search').addEventListener('input', render);

/* ---------- Start ---------- */
$('#todayLabel').textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
render();