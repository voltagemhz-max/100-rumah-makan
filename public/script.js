const express = require('express');
const app = express();

const rp = n => 'Rp ' + Number(n).toLocaleString('id-ID');
const F = (k, l, x = {}) => ({ k, l, ...x });

// Kolom/field yang dipakai ulang di beberapa halaman
const f = {
  nama: F('nama', 'Nama'), telepon: F('telepon', 'Telepon'), alamat: F('alamat', 'Alamat'),
  jabatan: F('jabatan', 'Jabatan', { opts: ['Koki', 'Barista', 'Kasir', 'Pelayan'] }),
  shift: F('shift', 'Shift', { opts: ['Pagi', 'Siang', 'Malam'] }),
  harga: F('harga', 'Harga', { type: 'number', money: true }),
  stok: F('stok', 'Stok', { type: 'number' }),
  nomor: F('nomor', 'Nomor meja'), kapasitas: F('kapasitas', 'Kapasitas', { type: 'number' }),
  mstatus: F('status', 'Status', { opts: ['Kosong', 'Terisi', 'Dipesan'] }),
  customerId: F('customerId', 'Pelanggan', { ref: 'customers', show: 'nama' }),
  tableId: F('tableId', 'Meja', { ref: 'tables', show: 'nomor' }),
  menuId: F('menuId', 'Menu', { ref: 'menu', show: 'nama' }),
  jumlah: F('jumlah', 'Jumlah', { type: 'number' }),
  total: F('total', 'Total', { type: 'number', money: true }),
  metode: F('metode', 'Metode bayar', { opts: ['Tunai', 'QRIS', 'Transfer'] }),
  ostatus: F('status', 'Status bayar', { opts: ['Belum bayar', 'Lunas'], badge: true })
};

// Tiap halaman: res = data di server, cols = kolom tabel, form = isi form
const V = {
  pelanggan: { title: 'Data Pelanggan', one: 'pelanggan', res: 'customers', cols: [f.nama, f.telepon, f.alamat], form: [f.nama, f.telepon, f.alamat] },
  karyawan: { title: 'Data Karyawan', one: 'karyawan', res: 'employees', cols: [f.nama, f.jabatan, f.shift, f.telepon], form: [f.nama, f.jabatan, f.shift, f.telepon] },
  makanan: { title: 'Daftar Menu Makanan', one: 'makanan', res: 'menu', filter: r => r.kategori === 'Makanan', preset: { kategori: 'Makanan' }, cols: [f.nama, f.harga, f.stok], form: [f.nama, f.harga, f.stok] },
  minuman: { title: 'Daftar Menu Minuman', one: 'minuman', res: 'menu', filter: r => r.kategori === 'Minuman', preset: { kategori: 'Minuman' }, cols: [f.nama, f.harga, f.stok], form: [f.nama, f.harga, f.stok] },
  meja: { title: 'Manajemen Meja', one: 'meja', res: 'tables', cols: [f.nomor, f.kapasitas, { ...f.mstatus, badge: true }], form: [f.nomor, f.kapasitas, f.mstatus] },
  pesanan: { title: 'Data Pesanan', one: 'pesanan', res: 'orders', preset: { metode: 'Tunai', status: 'Belum bayar' }, cols: [f.customerId, f.tableId, f.menuId, f.jumlah, f.total], form: [f.customerId, f.tableId, f.menuId, f.jumlah] },
  pembayaran: { title: 'Data & Total Pembayaran', one: 'pembayaran', res: 'orders', noAdd: true, noDelete: true, summary: true, cols: [f.customerId, f.menuId, f.jumlah, f.total, f.metode, f.ostatus], form: [f.metode, f.ostatus] }
};
const RES = ['customers', 'employees', 'menu', 'tables', 'orders'];

const data = {};
let cur = 'home', editing = null;
const $ = id => document.getElementById(id);
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); kids.forEach(k => e.append(k)); return e; };

async function api(method, url, body) {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = r.status === 204 ? null : await r.json();
  if (!r.ok) throw new Error(j && j.error ? j.error : 'Terjadi kesalahan, coba lagi');
  return j;
}
const loadAll = () => Promise.all(RES.map(async k => { data[k] = await api('GET', '/api/' + k); }));

function cell(c, row) {
  if (c.ref) { const x = data[c.ref].find(i => i.id === row[c.k]); return x ? x[c.show] : '(dihapus)'; }
  if (c.money) return rp(row[c.k]);
  if (c.badge) {
    const good = row[c.k] === 'Lunas' || row[c.k] === 'Kosong';
    return el('span', { className: 'badge ' + (good ? 'ok' : 'warn'), textContent: row[c.k] });
  }
  return String(row[c.k]);
}

function render() {
  [...$('nav').children].forEach(a => a.classList.toggle('active', a.hash === '#' + cur));
  const box = $('content');
  box.replaceChildren();
  $('summary').hidden = true;

  if (cur === 'home') {
    $('title').textContent = 'Selamat Datang di Dashboard Restoran';
    $('add').hidden = true;
    const paid = data.orders.filter(o => o.status === 'Lunas').reduce((s, o) => s + o.total, 0);
    const stat = (n, l) => el('div', { className: 'card-box' }, el('strong', { textContent: n }), l);
    box.append(el('p', { className: 'summary', textContent: 'Silakan gunakan menu navigasi di atas untuk mengelola data restoran.' }),
      el('div', { className: 'stats' },
        stat(data.customers.length, 'Pelanggan'), stat(data.employees.length, 'Karyawan'),
        stat(data.menu.length, 'Menu'), stat(data.tables.length, 'Meja'),
        stat(data.orders.length, 'Pesanan'), stat(rp(paid), 'Pembayaran lunas')));
    return;
  }

  const v = V[cur];
  const rows = data[v.res].filter(v.filter || (() => true));
  $('title').textContent = v.title;
  $('add').hidden = !!v.noAdd;
  $('add').textContent = 'Tambah ' + v.one;

  if (v.summary) {
    const sum = o => o.reduce((s, x) => s + x.total, 0);
    $('summary').textContent = `Sudah dibayar ${rp(sum(rows.filter(o => o.status === 'Lunas')))}. Belum dibayar ${rp(sum(rows.filter(o => o.status !== 'Lunas')))}.`;
    $('summary').hidden = false;
  }

  const head = el('tr');
  v.cols.forEach(c => head.append(el('th', { textContent: c.l, className: c.type === 'number' ? 'num' : '' })));
  head.append(el('th'));
  const body = el('tbody');
  if (!rows.length) body.append(el('tr', {}, el('td', { colSpan: 20, className: 'empty', textContent: `Belum ada data ${v.one}.` })));
  rows.forEach(row => {
    const tr = el('tr');
    v.cols.forEach(c => tr.append(el('td', { className: c.type === 'number' ? 'num' : '' }, cell(c, row))));
    const act = el('td', { className: 'num' }, el('button', { className: 'btn sm ghost', textContent: 'Ubah', onclick: () => openForm(row) }));
    if (!v.noDelete) act.append(' ', el('button', { className: 'btn sm danger', textContent: 'Hapus', onclick: () => remove(row) }));
    tr.append(act);
    body.append(tr);
  });
  box.append(el('div', { className: 'scroll' }, el('table', {}, el('thead', {}, head), body)));
}

function openForm(row) {
  const v = V[cur];
  editing = row || null;
  $('dlgTitle').textContent = (row ? 'Ubah ' : 'Tambah ') + v.one;
  $('err').textContent = '';
  $('fields').replaceChildren();
  v.form.forEach(c => {
    let input;
    if (c.ref || c.opts) {
      input = el('select', { name: c.k, required: true });
      (c.ref ? data[c.ref].map(i => [i.id, i[c.show]]) : c.opts.map(o => [o, o]))
        .forEach(([val, t]) => input.append(el('option', { value: val, textContent: t })));
    } else input = el('input', { name: c.k, required: true, type: c.type || 'text', min: c.type ? 0 : undefined });
    if (row) input.value = row[c.k];
    $('fields').append(el('label', { textContent: c.l }, input));
  });
  $('dlg').showModal();
}

async function remove(row) {
  if (!confirm('Hapus data ini?')) return;
  try { await api('DELETE', `/api/${V[cur].res}/${row.id}`); await refresh(); } catch (e) { alert(e.message); }
}
async function refresh() { await loadAll(); render(); }

$('frm').addEventListener('submit', async e => {
  e.preventDefault();
  const v = V[cur];
  const body = { ...(editing || {}), ...(editing ? {} : v.preset), ...Object.fromEntries(new FormData(e.target)) };
  if (!editing && v.preset) Object.assign(body, v.preset, Object.fromEntries(new FormData(e.target)));
  try {
    if (editing) await api('PUT', `/api/${v.res}/${editing.id}`, body);
    else await api('POST', '/api/' + v.res, body);
    $('dlg').close();
    await refresh();
  } catch (err) { $('err').textContent = err.message; }
});
$('cancel').onclick = () => $('dlg').close();
$('add').onclick = () => openForm(null);

function route() { const h = location.hash.slice(1); cur = h === 'home' || V[h] ? h : 'home'; if (data.orders) render(); }
window.addEventListener('hashchange', route);
loadAll().then(() => { route(); render(); }).catch(() => { $('title').textContent = 'Data gagal dimuat. Muat ulang halaman.'; });

* { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, sans-serif; }
body { background-color: #121212; color: #ffffff; padding: 20px; }
header { display: flex; justify-content: space-between; align-items: center; gap: 12px; background-color: #1e1e1e; padding: 15px 25px; border-radius: 8px; margin-bottom: 20px; }
.logo { color: #ff9800; font-weight: bold; font-size: 1.2rem; white-space: nowrap; }
.nav-menu { display: flex; flex-wrap: wrap; gap: 10px; }
.nav-menu a { color: #ffffff; text-decoration: none; padding: 8px 12px; border-radius: 4px; background-color: #2c2c2c; transition: 0.2s; }
.nav-menu a:hover, .nav-menu a.active { background-color: #ff9800; color: #121212; font-weight: bold; }
.main-container { background-color: #1e1e1e; padding: 25px; border-radius: 8px; min-height: 350px; }
.page-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 15px; }
.page-head h2 { color: #ff9800; }
.summary { margin-bottom: 15px; color: #bdbdbd; }
.card-box { background-color: #2c2c2c; padding: 15px; border-radius: 6px; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
.stats .card-box strong { display: block; font-size: 1.6rem; color: #ff9800; }
.scroll { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; background-color: #2c2c2c; border-radius: 6px; }
th, td { padding: 11px 14px; text-align: left; border-bottom: 1px solid #3a3a3a; white-space: nowrap; }
th { color: #ff9800; }
tr:last-child td { border-bottom: 0; }
.num { text-align: right; }
.empty { padding: 20px; text-align: center; color: #9e9e9e; }
.badge { padding: 2px 10px; border-radius: 99px; background: #3a3a3a; font-size: 0.85rem; }
.badge.ok { background: #1b5e20; } .badge.warn { background: #6d4c00; }
.btn { background: #ff9800; color: #121212; font-weight: bold; border: 0; border-radius: 4px; padding: 8px 14px; cursor: pointer; }
.btn:hover { background: #ffb74d; }
.btn.ghost { background: #2c2c2c; color: #fff; font-weight: normal; }
.btn.sm { padding: 4px 10px; font-size: 0.85rem; }
.btn.danger { background: #c62828; color: #fff; }
button:focus-visible, input:focus-visible, select:focus-visible, a:focus-visible { outline: 3px solid #ffb74d; outline-offset: 2px; }
dialog { margin: auto; border: 0; border-radius: 8px; padding: 0; width: min(420px, 92vw); background: #1e1e1e; color: #fff; }
dialog::backdrop { background: #000a; }
form { padding: 22px; }
form h3 { color: #ff9800; margin-bottom: 14px; }
label { display: block; margin-bottom: 12px; }
input, select { display: block; width: 100%; margin-top: 4px; padding: 9px 10px; background: #2c2c2c; color: #fff; border: 1px solid #444; border-radius: 4px; }
.err { color: #ff8a80; min-height: 1.3em; margin-bottom: 6px; }
.actions { display: flex; justify-content: flex-end; gap: 8px; }
@media (max-width: 700px) { header { flex-direction: column; align-items: flex-start; } .main-container { padding: 16px; } }
